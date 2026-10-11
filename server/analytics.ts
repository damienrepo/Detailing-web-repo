// Cookieless website statistics. The browser sends pageviews, time on page and a few actions to /api/collect.
// A visitor is recognised for one day by a hash of IP address + browser with a salt that is replaced every
// night and then deleted, so visits can't be linked across days and the IP address itself is never stored.
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
]);

/** Most events a single visit can record; stops a misbehaving page from flooding the table. */
const MAX_EVENTS_PER_SESSION = 200;

type Context = { ip: string; userAgent: string; host: string };

export class Analytics {
  private salt?: { day: string; value: string };
  private lastPurge = 0;

  constructor(private db: Db) {}

  private visitorHash(ctx: Context, now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (this.salt?.day !== day) {
      this.db.prepare('INSERT OR IGNORE INTO analytics_salt (day, salt) VALUES (?, ?)').run(day, randomToken());
      this.db.prepare('DELETE FROM analytics_salt WHERE day != ?').run(day);
      const { salt } = this.db.prepare('SELECT salt FROM analytics_salt WHERE day = ?').get(day) as { salt: string };
      this.salt = { day, value: salt };
    }
    return sha256(`${this.salt.value}|${ctx.ip}|${ctx.userAgent}`).slice(0, 22);
  }

  /** Records one message from the tracker. Returns false when it was ignored (bot, invalid, unknown page). */
  collect(body: unknown, ctx: Context, now = Date.now()): boolean {
    const parsed = collectSchema.safeParse(body);
    if (!parsed.success) return false;
    const ua = parseUserAgent(ctx.userAgent);
    if (ua.bot) return false;
    this.purge(now);
    const msg = parsed.data;

    if (msg.t === 'pageview') {
      const path = normalizePath(msg.path);
      if (path === '/admin' || path.startsWith('/admin/')) return false;
      const visitor = this.visitorHash(ctx, now);
      return this.db.transaction(() => {
        const open = this.db
          .prepare('SELECT id FROM analytics_sessions WHERE visitor = ? AND last_seen_at > ? ORDER BY last_seen_at DESC LIMIT 1')
          .get(visitor, now - SESSION_GAP_MS) as { id: number } | undefined;
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
        const inserted = this.db
          .prepare('INSERT OR IGNORE INTO analytics_pageviews (session_id, client_id, path, created_at) VALUES (?, ?, ?, ?)')
          .run(sessionId, msg.id, path, now).changes;
        this.db.prepare('UPDATE analytics_sessions SET last_seen_at = ? WHERE id = ?').run(now, sessionId);
        return inserted > 0;
      })();
    }

    const pv = this.db.prepare('SELECT id, session_id, path, created_at FROM analytics_pageviews WHERE client_id = ?').get(msg.id) as
      | { id: number; session_id: number; path: string; created_at: number }
      | undefined;
    // Only the page that is still open can report; a stale id can't rewrite history.
    if (!pv || now - pv.created_at > 12 * 3_600_000) return false;

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
      return true;
    }

    const label = msg.label || null;
    // An order is paid once, however often the customer reloads the confirmation page.
    if (msg.name === 'purchase' && (!label || this.db.prepare(`SELECT 1 FROM analytics_events WHERE name = 'purchase' AND label = ?`).get(label))) return false;
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM analytics_events WHERE session_id = ?').get(pv.session_id) as { n: number };
    if (n >= MAX_EVENTS_PER_SESSION) return false;
    this.db
      .prepare('INSERT INTO analytics_events (session_id, name, path, label, value, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      // A 404 is reported by the page that doesn't exist, so its own path is the useful label.
      .run(pv.session_id, msg.name, pv.path, msg.name === 'not_found' ? pv.path : label, msg.value ?? null, now);
    this.db.prepare('UPDATE analytics_sessions SET last_seen_at = MAX(last_seen_at, ?) WHERE id = ?').run(now, pv.session_id);
    return true;
  }

  /** Visits that started in [from, to), plus the period of equal length before it for comparison. */
  load(from: number, to: number): RawData {
    const start = from - (to - from);
    return this.rows('s.started_at >= ? AND s.started_at < ?', [start, to]);
  }

  loadSession(id: number): RawData {
    return this.rows('s.id = ?', [id]);
  }

  private rows(where: string, params: number[]): RawData {
    return {
      sessions: this.db
        .prepare(`SELECT id, visitor, started_at, last_seen_at, entry_path, channel, referrer, utm_campaign, device, browser, os, country, language FROM analytics_sessions s WHERE ${where}`)
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
