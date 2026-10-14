// 301 redirects and the 404 monitor (A3 in docs/SEO-PLAN.md). Pages that are requested but don't exist (old
// links, typos, the old Wix site) are logged, so the admin can send them on to the right page with one click.
import type { Db } from './db';

export type Redirect = { from: string; to: string; hits: number; lastHitAt: string | null; createdAt: string };
export type NotFound = { path: string; hits: number; referrer: string | null; firstSeenAt: string; lastSeenAt: string };

/** At most this many 404 paths are kept; the least requested go first. */
const MAX_NOT_FOUND = 1000;

/** "/About-Us/?x=1" → "/about-us". Paths are matched without case, query or trailing slash. */
export function normalizePath(path: string): string {
  let p = path.split(/[?#]/)[0] || '/';
  try {
    p = decodeURI(p);
  } catch {
    /* keep it encoded */
  }
  p = p.toLowerCase().replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p.startsWith('/') ? p : `/${p}`;
}

/** Paths that are never redirected or logged: the app's own machinery and files. */
const RESERVED = /^\/(api|admin|assets|media)(\/|$)|^\/(services|products|ppf)\//;

/** Requests by vulnerability scanners and bots: not worth showing in the admin. */
const NOISE = /\.(php\d?|asp|aspx|jsp|cgi|env|git|sql|bak|ini|log|ya?ml|xml|txt|map|json)$|\/(wp-|wordpress|xmlrpc|\.well-known|\.git|cgi-bin|phpmyadmin|vendor\/)/i;

export function findRedirect(db: Db, path: string): string | undefined {
  const from = normalizePath(path);
  const row = db.prepare('SELECT to_path FROM redirects WHERE from_path = ?').get(from) as { to_path: string } | undefined;
  if (!row) return undefined;
  db.prepare(`UPDATE redirects SET hits = hits + 1, last_hit_at = datetime('now') WHERE from_path = ?`).run(from);
  return row.to_path;
}

export function recordNotFound(db: Db, path: string, referrer?: string) {
  const p = normalizePath(path);
  if (p.length > 300 || RESERVED.test(p) || NOISE.test(p)) return;
  const ref = referrer && /^https?:\/\//.test(referrer) ? referrer.slice(0, 300) : null;
  db.prepare(
    `INSERT INTO not_found (path, referrer) VALUES (?, ?)
     ON CONFLICT(path) DO UPDATE SET hits = hits + 1, last_seen_at = datetime('now'), referrer = COALESCE(excluded.referrer, referrer)`,
  ).run(p, ref);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM not_found').get() as { n: number };
  if (n > MAX_NOT_FOUND) {
    db.prepare('DELETE FROM not_found WHERE path IN (SELECT path FROM not_found ORDER BY hits ASC, last_seen_at ASC LIMIT ?)').run(n - MAX_NOT_FOUND);
  }
}

export function listRedirects(db: Db): Redirect[] {
  const rows = db.prepare('SELECT * FROM redirects ORDER BY created_at DESC, from_path').all() as {
    from_path: string;
    to_path: string;
    hits: number;
    last_hit_at: string | null;
    created_at: string;
  }[];
  return rows.map((r) => ({ from: r.from_path, to: r.to_path, hits: r.hits, lastHitAt: r.last_hit_at, createdAt: r.created_at }));
}

export function listNotFound(db: Db, limit = 200): NotFound[] {
  const rows = db.prepare('SELECT * FROM not_found ORDER BY hits DESC, last_seen_at DESC LIMIT ?').all(limit) as {
    path: string;
    hits: number;
    referrer: string | null;
    first_seen_at: string;
    last_seen_at: string;
  }[];
  return rows.map((r) => ({ path: r.path, hits: r.hits, referrer: r.referrer, firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at }));
}

/** Returns an error message for an unusable redirect, or undefined when it can be saved. */
export function redirectProblem(db: Db, from: string, to: string): string | undefined {
  if (!from.startsWith('/') || from === '/') return 'Vul het oude adres in als pad, bijv. /about-us.';
  if (RESERVED.test(from)) return 'Dit adres hoort bij de website zelf en kan niet worden doorverwezen.';
  if (!/^\/[^\s]*$/.test(to) && !/^https:\/\/[^\s]+$/.test(to)) return 'Vul een pad op de site in (bijv. /diensten/ppf) of een volledig https-adres.';
  if (to.startsWith('/') && normalizePath(to) === from) return 'Het nieuwe adres is hetzelfde als het oude.';
  // No chains or loops: the target may not itself be redirected.
  if (to.startsWith('/') && db.prepare('SELECT 1 FROM redirects WHERE from_path = ?').get(normalizePath(to))) {
    return 'Het nieuwe adres wordt zelf ook doorverwezen. Kies de uiteindelijke pagina.';
  }
  return undefined;
}

export function saveRedirect(db: Db, from: string, to: string) {
  db.transaction(() => {
    db.prepare(
      `INSERT INTO redirects (from_path, to_path) VALUES (?, ?)
       ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path`,
    ).run(from, to);
    // Existing redirects pointing at the old address now go straight to the new one.
    db.prepare('UPDATE redirects SET to_path = ? WHERE to_path = ?').run(to, from);
    db.prepare('DELETE FROM not_found WHERE path = ?').run(from);
  })();
}

export function deleteRedirect(db: Db, from: string) {
  return db.prepare('DELETE FROM redirects WHERE from_path = ?').run(normalizePath(from)).changes > 0;
}

export function dismissNotFound(db: Db, path: string) {
  return db.prepare('DELETE FROM not_found WHERE path = ?').run(normalizePath(path)).changes > 0;
}
