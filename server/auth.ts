// Admin accounts, cookie sessions, login throttling, two-factor authentication and the audit log.
import express, { type NextFunction, type Request, type Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { Db } from './db';
import { getDummyHash, hashPassword, passwordProblem, randomToken, safeEqual, sha256, verifyPassword, type Cipher } from './security';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

export type AdminUser = { id: number; email: string; name: string; totpEnabled: boolean };

type UserRow = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  totp_secret: string | null;
  totp_last_counter: number | null;
  last_login_at: string | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminUser;
    adminToken?: string;
  }
}

const MINUTE = 60_000;
export const SESSION = {
  /** Signed out this long after signing in, whatever happens. */
  absolute: 12 * 60 * MINUTE,
  /** Signed out after this long without activity. */
  idle: 2 * 60 * MINUTE,
  /** Time to enter the authenticator code after the password. */
  twoFactor: 5 * MINUTE,
};

const LIMITS = { perAccount: 5, perIp: 20, window: 15 * MINUTE };

const GENERIC_LOGIN_ERROR = 'E-mailadres of wachtwoord klopt niet.';

/** Counts failures per key in a sliding window. */
class Throttle {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}
  private recent(key: string, now: number) {
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    this.hits.set(key, list);
    return list;
  }
  blocked(key: string, now = Date.now()) {
    return this.recent(key, now).length >= this.limit;
  }
  /** Minutes until the oldest failure in the window expires. */
  retryAfter(key: string, now = Date.now()) {
    const list = this.recent(key, now);
    return list.length ? Math.max(1, Math.ceil((list[0] + this.windowMs - now) / MINUTE)) : 0;
  }
  fail(key: string, now = Date.now()) {
    this.recent(key, now).push(now);
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some((t) => t > now - this.windowMs)) this.hits.delete(k);
  }
  reset(key: string) {
    this.hits.delete(key);
  }
}

function formatSetupCode(raw: string) {
  const chars = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
  return chars.match(/.{1,4}/g)!.join('-');
}

const emailSchema = z.email('Vul een geldig e-mailadres in').max(200).transform((v) => v.trim().toLowerCase());
const passwordSchema = z.string().max(200);

export class Auth {
  private accountThrottle = new Throttle(LIMITS.perAccount, LIMITS.window);
  private ipThrottle = new Throttle(LIMITS.perIp, LIMITS.window);
  private pendingTotp = new Map<number, { secret: string; expires: number }>();
  /** One-time code needed to create the first account; printed in the server console. */
  setupCode?: string;

  constructor(
    private db: Db,
    private cipher: Cipher,
    readonly secureCookies: boolean,
  ) {
    if (!this.hasUsers()) this.setupCode = formatSetupCode(randomToken(12));
  }

  get cookieName() {
    return this.secureCookies ? '__Host-d2g_admin' : 'd2g_admin';
  }

  hasUsers() {
    return Boolean(this.db.prepare('SELECT 1 FROM admin_users LIMIT 1').get());
  }

  private toUser(row: UserRow): AdminUser {
    return { id: row.id, email: row.email, name: row.name, totpEnabled: Boolean(row.totp_secret) };
  }

  private userRow(id: number) {
    return this.db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as UserRow | undefined;
  }

  audit(userId: number | null, action: string, req?: Request, detail?: string) {
    this.db.prepare('INSERT INTO admin_audit (user_id, action, detail, ip) VALUES (?, ?, ?, ?)').run(userId, action, detail ?? null, req?.ip ?? null);
  }

  async createUser(input: { email: string; name: string; password: string }): Promise<AdminUser> {
    const hash = await hashPassword(input.password);
    const info = this.db
      .prepare('INSERT INTO admin_users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(input.email.trim().toLowerCase(), input.name.trim(), hash);
    this.setupCode = undefined;
    return this.toUser(this.userRow(Number(info.lastInsertRowid))!);
  }

  private createSession(userId: number, stage: 'full' | '2fa', req: Request) {
    const token = randomToken();
    const now = Date.now();
    const expires = now + (stage === 'full' ? SESSION.absolute : SESSION.twoFactor);
    this.db
      .prepare(
        `INSERT INTO admin_sessions (token_hash, user_id, stage, created_at, last_seen_at, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(sha256(token), userId, stage, now, now, expires, req.ip ?? null, (req.get('user-agent') ?? '').slice(0, 300));
    // Housekeeping: drop expired sessions.
    this.db.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR last_seen_at < ?').run(now, now - SESSION.absolute);
    return { token, expires };
  }

  /** Resolves a session cookie; slides the idle timeout on every use. */
  resolve(token: string | undefined, stage: 'full' | '2fa' = 'full'): AdminUser | undefined {
    if (!token) return undefined;
    const now = Date.now();
    const row = this.db.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(sha256(token)) as
      | { user_id: number; stage: string; expires_at: number; last_seen_at: number }
      | undefined;
    if (!row || row.stage !== stage || row.expires_at < now || (stage === 'full' && row.last_seen_at < now - SESSION.idle)) return undefined;
    this.db.prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?').run(now, sha256(token));
    const user = this.userRow(row.user_id);
    return user && this.toUser(user);
  }

  revoke(token: string) {
    this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token));
  }

  revokeAll(userId: number, exceptToken?: string) {
    this.db.prepare('DELETE FROM admin_sessions WHERE user_id = ? AND token_hash != ?').run(userId, exceptToken ? sha256(exceptToken) : '');
  }

  setCookie(res: Response, token: string, expires: number) {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'strict',
      path: '/',
      maxAge: expires - Date.now(),
    });
  }

  clearCookie(res: Response) {
    res.clearCookie(this.cookieName, { httpOnly: true, secure: this.secureCookies, sameSite: 'strict', path: '/' });
  }

  readCookie(req: Request) {
    const header = req.get('cookie') ?? '';
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === this.cookieName) return decodeURIComponent(rest.join('='));
    }
    return undefined;
  }

  // --- Login ---------------------------------------------------------------

  async login(req: Request, res: Response, emailRaw: unknown, password: unknown) {
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
    const ip = req.ip ?? 'unknown';
    if (this.ipThrottle.blocked(ip) || this.accountThrottle.blocked(email)) {
      const minutes = Math.max(this.ipThrottle.retryAfter(ip), this.accountThrottle.retryAfter(email));
      this.audit(null, 'login_blocked', req, email.slice(0, 200));
      return { error: `Te veel mislukte pogingen. Probeer het over ${minutes} ${minutes === 1 ? 'minuut' : 'minuten'} opnieuw.`, status: 429 };
    }
    const row = email ? (this.db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email) as UserRow | undefined) : undefined;
    // Always run a hash comparison so response times do not reveal which accounts exist.
    const ok = await verifyPassword(typeof password === 'string' ? password : '', row?.password_hash ?? (await getDummyHash()));
    if (!row || !ok) {
      this.ipThrottle.fail(ip);
      if (email) this.accountThrottle.fail(email);
      this.audit(row?.id ?? null, 'login_failed', req, email.slice(0, 200));
      return { error: GENERIC_LOGIN_ERROR, status: 401 };
    }
    this.accountThrottle.reset(email);
    if (row.totp_secret) {
      const { token, expires } = this.createSession(row.id, '2fa', req);
      this.setCookie(res, token, expires);
      return { state: '2fa' as const };
    }
    return this.completeLogin(req, res, row);
  }

  async verifySecondFactor(req: Request, res: Response, code: unknown) {
    const pendingToken = this.readCookie(req);
    const user = this.resolve(pendingToken, '2fa');
    if (!user || !pendingToken) return { error: 'Je sessie is verlopen. Log opnieuw in.', status: 401 };
    const row = this.userRow(user.id)!;
    const key = `2fa:${row.email}`;
    if (this.accountThrottle.blocked(key)) return { error: 'Te veel onjuiste codes. Log over een kwartier opnieuw in.', status: 429 };
    const counter = verifyTotp(this.cipher.decrypt(row.totp_secret!, `totp:${row.id}`), String(code ?? ''), row.totp_last_counter);
    if (counter === null) {
      this.accountThrottle.fail(key);
      this.audit(row.id, '2fa_failed', req);
      return { error: 'Deze code klopt niet. Controleer je authenticator-app.', status: 401 };
    }
    this.accountThrottle.reset(key);
    this.db.prepare('UPDATE admin_users SET totp_last_counter = ? WHERE id = ?').run(counter, row.id);
    this.revoke(pendingToken);
    return this.completeLogin(req, res, row);
  }

  private completeLogin(req: Request, res: Response, row: UserRow) {
    const { token, expires } = this.createSession(row.id, 'full', req);
    this.setCookie(res, token, expires);
    this.db.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`).run(row.id);
    this.audit(row.id, 'login', req);
    return { state: 'ok' as const, user: this.toUser(row) };
  }

  // --- Account -------------------------------------------------------------

  async checkPassword(userId: number, password: unknown) {
    const row = this.userRow(userId);
    return Boolean(row && typeof password === 'string' && (await verifyPassword(password, row.password_hash)));
  }

  async changePassword(userId: number, next: string) {
    this.db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), userId);
  }

  async startTotp(user: AdminUser) {
    const secret = generateTotpSecret();
    this.pendingTotp.set(user.id, { secret, expires: Date.now() + 10 * MINUTE });
    const uri = otpauthUri(secret, user.email, 'Detail2Go');
    return { secret: secret.match(/.{1,4}/g)!.join(' '), uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
  }

  confirmTotp(userId: number, code: unknown) {
    const pending = this.pendingTotp.get(userId);
    if (!pending || pending.expires < Date.now()) return false;
    const counter = verifyTotp(pending.secret, String(code ?? ''), null);
    if (counter === null) return false;
    this.db
      .prepare('UPDATE admin_users SET totp_secret = ?, totp_last_counter = ? WHERE id = ?')
      .run(this.cipher.encrypt(pending.secret, `totp:${userId}`), counter, userId);
    this.pendingTotp.delete(userId);
    return true;
  }

  disableTotp(userId: number) {
    this.db.prepare('UPDATE admin_users SET totp_secret = NULL, totp_last_counter = NULL WHERE id = ?').run(userId);
  }

  verifyCurrentTotp(userId: number, code: unknown) {
    const row = this.userRow(userId);
    if (!row?.totp_secret) return true;
    const counter = verifyTotp(this.cipher.decrypt(row.totp_secret, `totp:${row.id}`), String(code ?? ''), row.totp_last_counter);
    if (counter === null) return false;
    this.db.prepare('UPDATE admin_users SET totp_last_counter = ? WHERE id = ?').run(counter, row.id);
    return true;
  }

  sessions(userId: number, currentToken?: string) {
    const rows = this.db
      .prepare(`SELECT token_hash, created_at, last_seen_at, ip, user_agent FROM admin_sessions WHERE user_id = ? AND stage = 'full' AND expires_at > ? ORDER BY last_seen_at DESC`)
      .all(userId, Date.now()) as { token_hash: string; created_at: number; last_seen_at: number; ip: string; user_agent: string }[];
    const current = currentToken ? sha256(currentToken) : '';
    return rows.map((r) => ({
      current: r.token_hash === current,
      createdAt: new Date(r.created_at).toISOString(),
      lastSeenAt: new Date(r.last_seen_at).toISOString(),
      ip: r.ip,
      device: describeDevice(r.user_agent),
    }));
  }

  auditLog(limit = 50) {
    return this.db
      .prepare(
        `SELECT a.action, a.detail, a.ip, a.created_at, u.name AS user FROM admin_audit a
         LEFT JOIN admin_users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?`,
      )
      .all(limit);
  }
}

function describeDevice(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} op ${os}` : browser;
}

// --- HTTP layer ----------------------------------------------------------------

/**
 * Blocks cross-site requests: state-changing admin calls must come from our own pages
 * (same Origin) and carry a header that plain HTML forms cannot set.
 */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const source = req.get('origin') ?? req.get('referer');
  let sameHost = false;
  try {
    sameHost = Boolean(source) && new URL(source!).host === req.get('host');
  } catch {
    sameHost = false;
  }
  if (!sameHost || req.get('x-requested-with') !== 'XMLHttpRequest') {
    res.status(403).json({ error: 'Verzoek geweigerd.' });
    return;
  }
  next();
}

export function createAuthRouter(auth: Auth) {
  const router = express.Router();

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const token = auth.readCookie(req);
    const user = auth.resolve(token);
    if (!user) {
      res.status(401).json({ error: 'Je bent niet (meer) ingelogd.' });
      return;
    }
    req.admin = user;
    req.adminToken = token;
    next();
  };

  router.get('/session', (req, res) => {
    if (!auth.hasUsers()) return res.json({ state: 'setup' });
    const token = auth.readCookie(req);
    const user = auth.resolve(token);
    if (user) return res.json({ state: 'ok', user });
    if (auth.resolve(token, '2fa')) return res.json({ state: '2fa' });
    res.json({ state: 'login' });
  });

  const setupSchema = z.object({ code: z.string().max(40), name: z.string().trim().min(1, 'Vul je naam in').max(80), email: emailSchema, password: passwordSchema });

  router.post('/setup', async (req, res) => {
    if (auth.hasUsers() || !auth.setupCode) return res.status(409).json({ error: 'Er is al een beheerder aangemaakt.' });
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { code, name, email, password } = parsed.data;
    if (!safeEqual(formatSetupCode(code), auth.setupCode)) {
      auth.audit(null, 'setup_failed', req);
      return res.status(401).json({ error: 'De setupcode klopt niet. Je vindt hem in het venster waarin de server draait.' });
    }
    const problem = passwordProblem(password, email);
    if (problem) return res.status(400).json({ error: problem, fields: { password: problem } });
    const user = await auth.createUser({ name, email, password });
    auth.audit(user.id, 'account_created', req);
    res.json(await auth.login(req, res, email, password));
  });

  router.post('/login', async (req, res) => {
    const result = await auth.login(req, res, req.body?.email, req.body?.password);
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    res.json(result);
  });

  router.post('/login/2fa', async (req, res) => {
    const result = await auth.verifySecondFactor(req, res, req.body?.code);
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    res.json(result);
  });

  router.post('/logout', (req, res) => {
    const token = auth.readCookie(req);
    const user = auth.resolve(token);
    if (token) auth.revoke(token);
    if (user) auth.audit(user.id, 'logout', req);
    auth.clearCookie(res);
    res.json({ ok: true });
  });

  // Mounted after requireAdmin.
  const account = express.Router();

  account.get('/account', (req, res) => {
    res.json({ user: req.admin, sessions: auth.sessions(req.admin!.id, req.adminToken), audit: auth.auditLog() });
  });

  account.post('/account/password', async (req, res) => {
    const { current, next } = req.body ?? {};
    if (!(await auth.checkPassword(req.admin!.id, current))) {
      return res.status(400).json({ error: 'Je huidige wachtwoord klopt niet.', fields: { current: 'Je huidige wachtwoord klopt niet.' } });
    }
    const problem = typeof next === 'string' ? passwordProblem(next, req.admin!.email) : 'Vul een nieuw wachtwoord in.';
    if (problem) return res.status(400).json({ error: problem, fields: { next: problem } });
    await auth.changePassword(req.admin!.id, next);
    auth.revokeAll(req.admin!.id, req.adminToken);
    auth.audit(req.admin!.id, 'password_changed', req);
    res.json({ ok: true });
  });

  account.post('/account/sessions/revoke-others', (req, res) => {
    auth.revokeAll(req.admin!.id, req.adminToken);
    auth.audit(req.admin!.id, 'sessions_revoked', req);
    res.json({ ok: true });
  });

  account.post('/account/2fa/start', async (req, res) => {
    if (!(await auth.checkPassword(req.admin!.id, req.body?.password))) {
      return res.status(400).json({ error: 'Je wachtwoord klopt niet.', fields: { password: 'Je wachtwoord klopt niet.' } });
    }
    res.json(await auth.startTotp(req.admin!));
  });

  account.post('/account/2fa/confirm', (req, res) => {
    if (!auth.confirmTotp(req.admin!.id, req.body?.code)) {
      return res.status(400).json({ error: 'Deze code klopt niet. Probeer de volgende code uit je app.', fields: { code: 'Deze code klopt niet.' } });
    }
    auth.revokeAll(req.admin!.id, req.adminToken);
    auth.audit(req.admin!.id, '2fa_enabled', req);
    res.json({ ok: true });
  });

  account.post('/account/2fa/disable', async (req, res) => {
    if (!(await auth.checkPassword(req.admin!.id, req.body?.password))) {
      return res.status(400).json({ error: 'Je wachtwoord klopt niet.', fields: { password: 'Je wachtwoord klopt niet.' } });
    }
    if (!auth.verifyCurrentTotp(req.admin!.id, req.body?.code)) {
      return res.status(400).json({ error: 'Deze code klopt niet.', fields: { code: 'Deze code klopt niet.' } });
    }
    auth.disableTotp(req.admin!.id);
    auth.audit(req.admin!.id, '2fa_disabled', req);
    res.json({ ok: true });
  });

  return { router, account, requireAdmin };
}
