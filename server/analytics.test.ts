import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bucketStarts, buildReport, classifySource, listSessions, normalizePath, parseUserAgent, sessionDetail, type RawData } from '../shared/analytics';
import { demoAnalytics } from '../shared/analyticsDemo';
import { Analytics } from './analytics';
import { openDb } from './db';
import { setup, signedIn } from './testUtils';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ctx = { ip: '203.0.113.7', userAgent: CHROME, host: 'shop.test' };
const pageview = (id: string, path: string, extra: Record<string, unknown> = {}) => ({ t: 'pageview', id, path, device: 'desktop', lang: 'nl-NL', tz: 'Europe/Amsterdam', ...extra });
const range = (data: RawData) => ({ from: 0, to: Math.max(...data.sessions.map((s) => s.started_at)) + 1, tz: 'Europe/Amsterdam' });

describe('classifying visits', () => {
  it('keeps private order ids out of page paths', () => {
    expect(normalizePath('/bestelling/abcDEF123?x=1')).toBe('/bestelling');
    expect(normalizePath('/shop/kit/?utm_source=ig#top')).toBe('/shop/kit');
    expect(normalizePath('//diensten')).toBe('/diensten');
  });

  it('sorts referrers and campaign tags into channels', () => {
    expect(classifySource({ host: 'google.nl' })).toEqual({ channel: 'search', referrer: 'google.nl' });
    expect(classifySource({ host: 'l.instagram.com' }).channel).toBe('social');
    expect(classifySource({ host: 'chatgpt.com' }).channel).toBe('ai');
    expect(classifySource({ host: 'gemini.google.com' }).channel).toBe('ai');
    expect(classifySource({ host: null })).toEqual({ channel: 'direct', referrer: null });
    expect(classifySource({ host: 'marktplaats.nl' }).channel).toBe('referral');
    expect(classifySource({ host: null, utmSource: 'google', utmMedium: 'cpc' }).channel).toBe('paid');
    expect(classifySource({ host: null, utmSource: 'nieuwsbrief', utmMedium: 'email' }).channel).toBe('email');
    expect(classifySource({ host: null, utmSource: 'flyer' })).toEqual({ channel: 'campaign', referrer: 'flyer' });
  });

  it('recognises browsers, systems and bots', () => {
    expect(parseUserAgent(CHROME)).toEqual({ browser: 'Chrome', os: 'Windows', bot: false });
    expect(parseUserAgent(IPHONE)).toMatchObject({ browser: 'Safari', os: 'iOS' });
    expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)').bot).toBe(true);
    expect(parseUserAgent('').bot).toBe(true);
  });

  it('builds day buckets that follow local midnight across a clock change', () => {
    const from = Date.UTC(2026, 9, 20, 22); // 21 Oct, 00:00 in Amsterdam (summer time)
    const to = Date.UTC(2026, 10, 1, 23); // 2 Nov, 00:00 (winter time)
    const starts = bucketStarts(from, to, 'day', 'Europe/Amsterdam');
    expect(starts).toHaveLength(12);
    // After the clock goes back on 25 October, local midnight is 23:00 UTC instead of 22:00.
    expect(new Date(starts[4]).toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(new Date(starts[5]).toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(new Date(starts.at(-1)!).toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });
});

describe('collecting statistics', () => {
  it('groups pageviews into one visit and records time, scroll and actions', () => {
    const analytics = new Analytics(openDb(':memory:'));
    const t = Date.UTC(2026, 5, 1, 10);
    expect(analytics.collect(pageview('aaaaaaaa1', '/', { ref: 'https://www.google.nl/search?q=detailing' }), ctx, t)).toBe(true);
    expect(analytics.collect({ t: 'engage', id: 'aaaaaaaa1', d: 42_000, s: 80, title: 'Home | Detail2Go' }, ctx, t + 42_000)).toBe(true);
    expect(analytics.collect(pageview('aaaaaaaa2', '/afspraak'), ctx, t + 45_000)).toBe(true);
    expect(analytics.collect({ t: 'event', id: 'aaaaaaaa2', name: 'booking', label: 'polijsten' }, ctx, t + 90_000)).toBe(true);

    const data = analytics.load(t - 1000, t + 3_600_000);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({ channel: 'search', referrer: 'google.nl', entry_path: '/', browser: 'Chrome', country: 'NL', language: 'nl' });
    expect(data.pageviews.map((p) => [p.path, p.duration, p.scroll])).toEqual([
      ['/', 42_000, 80],
      ['/afspraak', 0, null],
    ]);
    const report = buildReport(data, { from: t - 1000, to: t + 3_600_000, tz: 'Europe/Amsterdam' });
    expect(report.totals).toMatchObject({ sessions: 1, visitors: 1, pageviews: 2, bookings: 1, conversions: 1, bounceRate: 0 });
    expect(report.funnels[0].steps.map((s) => s.sessions)).toEqual([1, 1, 1, 1]);
  });

  it('starts a new visit after 30 minutes of silence and never stores the IP address', () => {
    const db = openDb(':memory:');
    const analytics = new Analytics(db);
    const t = Date.UTC(2026, 5, 1, 10);
    analytics.collect(pageview('bbbbbbbb1', '/'), ctx, t);
    analytics.collect(pageview('bbbbbbbb2', '/shop'), ctx, t + 31 * 60_000);
    analytics.collect(pageview('bbbbbbbb3', '/'), { ...ctx, ip: '198.51.100.1' }, t + 31 * 60_000);
    const sessions = db.prepare('SELECT * FROM analytics_sessions').all();
    expect(sessions).toHaveLength(3);
    expect(JSON.stringify(sessions)).not.toContain('203.0.113.7');
    const visitors = new Set(sessions.map((s) => (s as { visitor: string }).visitor));
    expect(visitors.size).toBe(2);
  });

  it('ignores bots, admin pages, invalid messages and duplicate payments', () => {
    const analytics = new Analytics(openDb(':memory:'));
    const t = Date.UTC(2026, 5, 1, 10);
    expect(analytics.collect(pageview('cccccccc1', '/'), { ...ctx, userAgent: 'Googlebot/2.1' }, t)).toBe(false);
    expect(analytics.collect(pageview('cccccccc2', '/admin/statistieken'), ctx, t)).toBe(false);
    expect(analytics.collect({ t: 'pageview', id: 'x', path: '/' }, ctx, t)).toBe(false);
    expect(analytics.collect({ t: 'engage', id: 'unknown00', d: 1000 }, ctx, t)).toBe(false);
    analytics.collect(pageview('cccccccc3', '/bestelling/secretid123'), ctx, t);
    expect(analytics.collect({ t: 'event', id: 'cccccccc3', name: 'purchase', label: 'D2G-1', value: 4995 }, ctx, t)).toBe(true);
    expect(analytics.collect({ t: 'event', id: 'cccccccc3', name: 'purchase', label: 'D2G-1', value: 4995 }, ctx, t + 5000)).toBe(false);
    const data = analytics.load(t - 1000, t + 60_000);
    expect(data.pageviews.map((p) => p.path)).toEqual(['/bestelling']);
    expect(buildReport(data, { from: t - 1000, to: t + 60_000, tz: 'UTC' }).totals.revenue).toBe(4995);
  });

  it('caps time on a page and ignores the referrer when returning from payment', () => {
    const analytics = new Analytics(openDb(':memory:'));
    const t = Date.UTC(2026, 5, 1, 10);
    analytics.collect(pageview('dddddddd1', '/bestelling/abc', { ref: 'https://www.mollie.com/checkout' }), ctx, t);
    analytics.collect({ t: 'engage', id: 'dddddddd1', d: 5 * 3_600_000 }, ctx, t + 1000);
    const data = analytics.load(t - 1000, t + 60_000);
    expect(data.sessions[0].channel).toBe('direct');
    expect(data.pageviews[0].duration).toBe(30 * 60_000);
  });
});

describe('statistics endpoints', () => {
  it('collects from visitors but not from signed-in admins or other sites', async () => {
    const ctx2 = setup();
    const send = (body: object, headers: Record<string, string> = {}) =>
      request(ctx2.app).post('/api/collect').set('Content-Type', 'text/plain').set('User-Agent', CHROME).set('Host', 'shop.test').set(headers).send(JSON.stringify(body));
    await send(pageview('eeeeeeee1', '/')).expect(204);
    await send(pageview('eeeeeeee2', '/'), { Origin: 'https://evil.example', 'User-Agent': IPHONE }).expect(204);
    const count = () => (ctx2.db.prepare('SELECT COUNT(*) AS n FROM analytics_pageviews').get() as { n: number }).n;
    expect(count()).toBe(1);

    const admin = await signedIn(ctx2);
    await admin.post('/api/collect').set('Content-Type', 'text/plain').set('User-Agent', IPHONE).send(JSON.stringify(pageview('eeeeeeee3', '/shop'))).expect(204);
    expect(count()).toBe(1);

    await request(ctx2.app).get(`/api/admin/analytics?from=0&to=${Date.now() + 1000}`).set('Host', 'shop.test').expect(401);
    const report = await admin.get(`/api/admin/analytics?from=${Date.now() - 86_400_000}&to=${Date.now() + 1000}&tz=Europe/Amsterdam`).expect(200);
    expect(report.body).toMatchObject({ hasData: true, totals: { sessions: 1, pageviews: 1 } });
    await admin.get(`/api/admin/analytics?from=${Date.now() - 86_400_000}&to=${Date.now() + 1000}&channel=social`).expect(200).expect((r) => expect(r.body.totals.sessions).toBe(0));
    await admin.get('/api/admin/analytics?from=10&to=5').expect(400);

    const list = await admin.get(`/api/admin/analytics/sessions?from=${Date.now() - 86_400_000}&to=${Date.now() + 1000}`).expect(200);
    expect(list.body.total).toBe(1);
    const detail = await admin.get(`/api/admin/analytics/sessions/${list.body.sessions[0].id}`).expect(200);
    expect(detail.body.timeline).toHaveLength(1);
    await admin.get('/api/admin/analytics/live').expect(200).expect((r) => expect(r.body.visitors).toBe(1));

    await admin.delete('/api/admin/analytics').expect(200);
    expect(count()).toBe(0);
  });
});

describe('the report', () => {
  const data = demoAnalytics(Date.UTC(2026, 9, 11, 12), 400);
  const opts = { from: Date.UTC(2025, 9, 11), to: Date.UTC(2026, 9, 11, 12), tz: 'Europe/Amsterdam' };

  it('handles a year of visits quickly and consistently', () => {
    const started = performance.now();
    const report = buildReport(data, opts);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(report.range.bucket).toBe('week');
    expect(report.totals.sessions).toBeGreaterThan(5000);
    expect(report.series.reduce((n, p) => n + p.sessions, 0)).toBe(report.totals.sessions);
    expect(report.channels.reduce((n, c) => n + c.sessions, 0)).toBe(report.totals.sessions);
    expect(report.heatmap.flat().reduce((a, b) => a + b, 0)).toBe(report.totals.sessions);
    for (const f of report.funnels) for (let i = 1; i < f.steps.length; i++) expect(f.steps[i].sessions).toBeLessThanOrEqual(f.steps[i - 1].sessions);
    expect(report.insights.length).toBeGreaterThan(0);
  });

  it('narrows everything to the filtered visits and explains a single page', () => {
    const all = buildReport(data, opts);
    const mobile = buildReport(data, { ...opts, filters: { device: 'mobile' } });
    expect(mobile.totals.sessions).toBe(all.devices.find((d) => d.key === 'mobile')!.sessions);
    expect(mobile.devices.map((d) => d.key)).toEqual(['mobile']);
    const page = buildReport(data, { ...opts, filters: { page: '/afspraak' } });
    expect(page.pageDetail?.path).toBe('/afspraak');
    const exits = page.pageDetail!.next.find((x) => x.kind === 'exit')!.count;
    expect(exits).toBe(page.pages.find((p) => p.path === '/afspraak')!.exits);
    expect(page.pageDetail!.next.reduce((n, x) => n + x.count, 0)).toBeLessThanOrEqual(page.pageDetail!.views);
  });

  it('lists visits newest first and shows one step by step', () => {
    const list = listSessions(data, range(data), 0, 5);
    expect(list.sessions).toHaveLength(5);
    expect(list.sessions[0].startedAt).toBeGreaterThanOrEqual(list.sessions[1].startedAt);
    const detail = sessionDetail(data, list.sessions[0].id)!;
    expect(detail.timeline.filter((i) => i.type === 'page')).toHaveLength(detail.pageviews);
  });
});
