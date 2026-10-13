// Website statistics. The browser sends pageviews, time on page and a few actions to /api/collect.
// Every visit is counted without cookies: a visitor is recognised for one day by a hash of IP address + browser
// with a salt that is replaced every night and then deleted, so the IP address itself is never stored.
// On top of that, visitors who may get the statistics cookie (see statisticsCookieAllowed) get a random id in a
// first-party HttpOnly cookie, so their visits can be linked across days: returning visitors, and which channel
// first brought in a customer. The id is never shared and is unlinked again when the visitor objects.
import { z } from 'zod';
import {
  classifySource,
  countryFromTimezone,
  DEVICES,
  EVENT_NAMES,
  languageCode,
  MAX_PAGE_MS,
  normalizePath,
  parseUserAgent,
  referrerHost,
  RETENTION_DAYS,
  SESSION_GAP_MS,
  statisticsCookieAllowed,
  type RawData,
} from '../shared/analytics';
import type { Db } from './db';
import { randomToken, sha256 } from './security';

const clientId = z.string().regex(/^[a-z0-9]{8,32}$/i);
const text = (max: number) => z.string().trim().max(max).nullish();

export const collectSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('pageview'),
    id: clientId,
    path: z.string().min(1).max(500),
    ref: z.string().max(1000).nullish(),
    utm: z.object({ source: text(100), medium: text(100), campaign: text(100) }).nullish(),
    paid: z.boolean().optional(),
    device: z.enum(DEVICES),
    lang: text(35),
    tz: text(64),
  }),
  z.object({
    t: z.literal('engage'),
    id: clientId,
    d: z.number().int().min(0).max(100_000_000),
    s: z.number().int().min(0).max(100).nullish(),
    title: text(200),
    load: z.number().int().min(0).max(120_000).nullish(),
  }),
  z.object({
    t: z.literal('event'),
    id: clientId,
    name: z.enum(EVENT_NAMES),
    label: text(200),
    value: z.number().int().min(0).max(1_000_000_000).nullish(),
  }),
  // The visitor just accepted statistics cookies: link the visit that is already running.
  z.object({ t: z.literal('consent'), id: clientId }),
  // The visitor objected: forget the cookie id.
  z.object({ t: z.literal('optout') }),
]);

export const VISITOR_COOKIE = 'd2g_vid';
export const STATS_CONSENT_COOKIE = 'd2g_stats';
const VID = /^[A-Za-z0-9_-]{16,40}$/;

/** Most events a single visit can record; stops a misbehaving page from flooding the table. */
const MAX_EVENTS_PER_SESSION = 200;

export type CollectContext = {
  ip: string;
  userAgent: string;
  host: string;
  /** The statistics cookie id the browser sent, if any. */
  vid?: string | null;
  /** The visitor's choice about statistics cookies, if they made one. */
  statsConsent?: 'granted' | 'denied' | null;
};

/** `setVid`: send this id in the statistics cookie; `clearVid`: remove the cookie. */
export type CollectResult = { recorded: boolean; setVid?: string; clearVid?: boolean };

export class Analytics {
  private salt?: { day: string; value: string };
  private lastPurge = 0;

  constructor(private db: Db) {}

  private visitorHash(ctx: CollectContext, now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (this.salt?.day !== day) {
      this.db.prepare('INSERT OR IGNORE INTO analytics_salt (day, salt) VALUES (?, ?)').run(day, randomToken());
      this.db.prepare('DELETE FROM analytics_salt WHERE day != ?').run(day);
      const { salt } = this.db.prepare('SELECT salt FROM analytics_salt WHERE day = ?').get(day) as { salt: string };
      this.salt = { day, value: salt };
    }
    return sha256(`${this.salt.value}|${ctx.ip}|${ctx.userAgent}`).slice(0, 22);
  }

  /** Marks a visit as belonging to a cookie visitor, with its number and where the visitor first came from. */
  private link(sessionId: number, vid: string) {
    const prior = this.db
      .prepare('SELECT COUNT(*) AS n, MIN(started_at) AS first FROM analytics_sessions WHERE vid = ? AND id != ?')
      .get(vid, sessionId) as { n: number; first: number | null };
    const first = this.db
      .prepare('SELECT channel, referrer FROM analytics_sessions WHERE vid = ? AND id != ? ORDER BY started_at LIMIT 1')
      .get(vid, sessionId) as { channel: string; referrer: string | null } | undefined;
    this.db
      .prepare(
        `UPDATE analytics_sessions SET vid = @vid, visit_no = @visitNo,
           first_seen_at = COALESCE(@firstSeen, started_at),
           first_channel = COALESCE(@firstChannel, channel),
           first_referrer = CASE WHEN @firstChannel IS NULL THEN referrer ELSE @firstReferrer END
         WHERE id = @id AND vid IS NULL`,
      )
      .run({ id: sessionId, vid, visitNo: prior.n + 1, firstSeen: prior.first, firstChannel: first?.channel ?? null, firstReferrer: first?.referrer ?? null });
  }

  /** Forgets a cookie id: the visits stay counted, but can no longer be linked to each other. */
  forget(vid: string) {
    this.db
      .prepare('UPDATE analytics_sessions SET vid = NULL, visit_no = NULL, first_seen_at = NULL, first_channel = NULL, first_referrer = NULL WHERE vid = ?')
      .run(vid);
  }

  /** Records one message from the tracker and says what to do with the statistics cookie. */
  collect(body: unknown, ctx: CollectContext, now = Date.now()): CollectResult {
    const parsed = collectSchema.safeParse(body);
    if (!parsed.success) return { recorded: false };
    const msg = parsed.data;
    const knownVid = ctx.vid && VID.test(ctx.vid) ? ctx.vid : null;

    if (msg.t === 'optout') {
      if (knownVid) this.forget(knownVid);
      return { recorded: Boolean(knownVid), clearVid: Boolean(ctx.vid) };
    }

    const ua = parseUserAgent(ctx.userAgent);
    if (ua.bot) return { recorded: false };
    this.purge(now);

    if (msg.t === 'pageview') {
      const path = normalizePath(msg.path);
      if (path === '/admin' || path.startsWith('/admin/')) return { recorded: false };
      const allowed = statisticsCookieAllowed(ctx.statsConsent, msg.tz);
      if (!allowed && knownVid) this.forget(knownVid);
      const visitor = this.visitorHash(ctx, now);
      let vid: string | null = null;
      const recorded = this.db.transaction(() => {
        const since = now - SESSION_GAP_MS;
        type Open = { id: number; vid: string | null } | undefined;
        const byHash = (onlyUnlinked: boolean) =>
          this.db
            .prepare(`SELECT id, vid FROM analytics_sessions WHERE visitor = ? ${onlyUnlinked ? 'AND vid IS NULL' : ''} AND last_seen_at > ? ORDER BY last_seen_at DESC LIMIT 1`)
            .get(visitor, since) as Open;
        let open: Open;
        if (allowed && knownVid) {
          open = (this.db.prepare('SELECT id, vid FROM analytics_sessions WHERE vid = ? AND last_seen_at > ? ORDER BY last_seen_at DESC LIMIT 1').get(knownVid, since) as Open) ?? byHash(true);
          vid = knownVid;
        } else {
          // No cookie came back (blocked, or the first response is still on its way): continue the running visit
          // and reuse its id rather than splitting the visit up.
          open = byHash(false);
          if (allowed) vid = open?.vid ?? randomToken(16);
        }
        let sessionId = open?.id;
        if (!sessionId) {
          // Coming back from the payment page isn't a new source; the referrer would be the bank or Mollie.
          const returning = path === '/bestelling';
          let host = returning ? null : referrerHost(msg.ref);
          if (host && host === ctx.host.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')) host = null;
          const { channel, referrer } = classifySource({
            host,
            utmSource: returning ? null : msg.utm?.source,
            utmMedium: returning ? null : msg.utm?.medium,
            paid: !returning && msg.paid,
          });
          sessionId = Number(
            this.db
              .prepare(
                `INSERT INTO analytics_sessions (visitor, started_at, last_seen_at, entry_path, channel, referrer, utm_campaign, device, browser, os, country, language)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .run(visitor, now, now, path, channel, referrer, (!returning && msg.utm?.campaign) || null, msg.device, ua.browser, ua.os, countryFromTimezone(msg.tz), languageCode(msg.lang)).lastInsertRowid,
          );
        }
        if (vid) this.link(sessionId, vid);
        const inserted = this.db
          .prepare('INSERT OR IGNORE INTO analytics_pageviews (session_id, client_id, path, created_at) VALUES (?, ?, ?, ?)')
          .run(sessionId, msg.id, path, now).changes;
        this.db.prepare('UPDATE analytics_sessions SET last_seen_at = ? WHERE id = ?').run(now, sessionId);
        return inserted > 0;
      })();
      return { recorded, setVid: vid && vid !== ctx.vid ? vid : undefined, clearVid: !vid && Boolean(ctx.vid) };
    }

    const pv = this.db.prepare('SELECT id, session_id, path, created_at FROM analytics_pageviews WHERE client_id = ?').get(msg.id) as
      | { id: number; session_id: number; path: string; created_at: number }
      | undefined;
    // Only the page that is still open can report; a stale id can't rewrite history.
    if (!pv || now - pv.created_at > 12 * 3_600_000) return { recorded: false };

    if (msg.t === 'consent') {
      if (ctx.statsConsent !== 'granted') return { recorded: false };
      const vid = knownVid ?? randomToken(16);
      this.link(pv.session_id, vid);
      return { recorded: true, setVid: vid !== ctx.vid ? vid : undefined };
    }

    if (msg.t === 'engage') {
      this.db
        .prepare(
          `UPDATE analytics_pageviews SET
             duration = MAX(duration, @d),
             scroll = CASE WHEN @s IS NULL THEN scroll ELSE MAX(COALESCE(scroll, 0), @s) END,
             title = COALESCE(@title, title),
             load_ms = COALESCE(load_ms, @load)
           WHERE id = @id`,
        )
        .run({ id: pv.id, d: Math.min(msg.d, MAX_PAGE_MS), s: msg.s ?? null, title: msg.title || null, load: msg.load || null });
      this.db.prepare('UPDATE analytics_sessions SET last_seen_at = MAX(last_seen_at, ?) WHERE id = ?').run(now, pv.session_id);
      return { recorded: true };
    }

    const label = msg.label || null;
    // An order is paid once, however often the customer reloads the confirmation page.
    if (msg.name === 'purchase' && (!label || this.db.prepare(`SELECT 1 FROM analytics_events WHERE name = 'purchase' AND label = ?`).get(label))) return { recorded: false };
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM analytics_events WHERE session_id = ?').get(pv.session_id) as { n: number };
    if (n >= MAX_EVENTS_PER_SESSION) return { recorded: false };
    this.db
      .prepare('INSERT INTO analytics_events (session_id, name, path, label, value, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      // A 404 is reported by the page that doesn't exist, so its own path is the useful label.
      .run(pv.session_id, msg.name, pv.path, msg.name === 'not_found' ? pv.path : label, msg.value ?? null, now);
    this.db.prepare('UPDATE analytics_sessions SET last_seen_at = MAX(last_seen_at, ?) WHERE id = ?').run(now, pv.session_id);
    return { recorded: true };
  }

  /** Visits that started in [from, to), plus the period of equal length before it for comparison. */
  load(from: number, to: number): RawData {
    const start = from - (to - from);
    return this.rows('s.started_at >= ? AND s.started_at < ?', [start, to]);
  }

  /** One visit together with every other visit of the same cookie visitor. */
  loadSession(id: number): RawData {
    return this.rows('(s.id = ? OR s.vid = (SELECT vid FROM analytics_sessions WHERE id = ? AND vid IS NOT NULL))', [id, id]);
  }

  private rows(where: string, params: number[]): RawData {
    return {
      sessions: this.db
        .prepare(
          `SELECT id, visitor, started_at, last_seen_at, entry_path, channel, referrer, utm_campaign, device, browser, os, country, language,
                  vid, visit_no, first_seen_at, first_channel, first_referrer
           FROM analytics_sessions s WHERE ${where}`,
        )
        .all(...params) as RawData['sessions'],
      pageviews: this.db
        .prepare(`SELECT p.id, p.session_id, p.path, p.title, p.created_at, p.duration, p.scroll, p.load_ms FROM analytics_pageviews p JOIN analytics_sessions s ON s.id = p.session_id WHERE ${where}`)
        .all(...params) as RawData['pageviews'],
      events: this.db
        .prepare(`SELECT e.id, e.session_id, e.name, e.path, e.label, e.value, e.created_at FROM analytics_events e JOIN analytics_sessions s ON s.id = e.session_id WHERE ${where}`)
        .all(...params) as RawData['events'],
    };
  }

  /** Visitors active in the last five minutes and the page each one is on. */
  live(now = Date.now()) {
    const since = now - 5 * 60_000;
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM analytics_sessions WHERE last_seen_at > ?').get(since) as { n: number };
    const pages = this.db
      .prepare(
        `SELECT path, COUNT(*) AS count FROM (
           SELECT p.path, MAX(p.created_at) FROM analytics_pageviews p JOIN analytics_sessions s ON s.id = p.session_id
           WHERE s.last_seen_at > ? GROUP BY p.session_id
         ) GROUP BY path ORDER BY count DESC LIMIT 10`,
      )
      .all(since) as { path: string; count: number }[];
    return { visitors: n, pages };
  }

  hasData() {
    return Boolean(this.db.prepare('SELECT 1 FROM analytics_sessions LIMIT 1').get());
  }

  clear() {
    this.db.prepare('DELETE FROM analytics_sessions').run();
  }

  /** Deletes statistics older than the retention period; runs at most once an hour. */
  purge(now = Date.now()) {
    if (now - this.lastPurge < 3_600_000) return;
    this.lastPurge = now;
    this.db.prepare('DELETE FROM analytics_sessions WHERE started_at < ?').run(now - RETENTION_DAYS * 86_400_000);
  }
}
