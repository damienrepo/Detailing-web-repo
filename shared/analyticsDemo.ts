// Believable, made-up statistics for the demo build, which has no server to collect real ones.
// Always the same for the same day, so the demo looks stable between reloads.
import type { Channel, Device, EventName, EventRow, PageviewRow, RawData, SessionRow } from './analytics';
import { PRODUCTS } from './catalog';
import { SERVICES } from './services';

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(rnd: () => number, options: [T, number][]): T {
  const total = options.reduce((n, [, w]) => n + w, 0);
  let r = rnd() * total;
  for (const [value, w] of options) if ((r -= w) <= 0) return value;
  return options[options.length - 1][0];
}

const TITLE = (name: string) => `${name} | Detail2Go`;

export function demoAnalytics(now = Date.now(), days = 400): RawData {
  const rnd = random(Math.floor(now / 86_400_000));
  const services = SERVICES.filter((s) => !s.hidden);
  const products = PRODUCTS.filter((p) => !p.hidden);
  const titles = new Map<string, string>([
    ['/', 'Detail2Go — Autodetailing in Enschede'],
    ['/diensten', TITLE('Diensten')],
    ['/afspraak', TITLE('Afspraak maken')],
    ['/over-ons', TITLE('Over ons')],
    ['/team', TITLE('Team')],
    ['/contact', TITLE('Contact')],
    ['/shop', TITLE('Shop')],
    ['/afrekenen', TITLE('Afrekenen')],
    ['/bestelling', TITLE('Je bestelling')],
    ['/blog', TITLE('Blog')],
    ['/blog/auto-wassen-in-de-winter', TITLE('Je auto wassen in de winter: zo doe je het goed')],
    ['/blog/coating-of-wax', TITLE('Coating of wax: wat past bij jouw auto?')],
    ['/voorwaarden', TITLE('Algemene voorwaarden')],
    ['/privacy', TITLE('Privacyverklaring')],
    ...services.map((s): [string, string] => [`/diensten/${s.id}`, TITLE(s.name)]),
    ...products.map((p): [string, string] => [`/shop/${p.slug}`, TITLE(p.name)]),
  ]);
  const servicePages = services.map((s) => `/diensten/${s.id}`);
  const productPages = products.map((p) => `/shop/${p.slug}`);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];

  const next = (path: string): string | null => {
    if (path === '/afrekenen' || path === '/bestelling') return null;
    if (path.startsWith('/diensten/')) return weighted<string | null>(rnd, [['/afspraak', 3], [pick(servicePages), 2], ['/diensten', 1], ['/', 0.5], [null, 4]]);
    if (path === '/diensten') return weighted<string | null>(rnd, [[pick(servicePages), 6], ['/afspraak', 1], [null, 2]]);
    if (path.startsWith('/shop/')) return weighted<string | null>(rnd, [[pick(productPages), 2], ['/shop', 1.5], ['/afrekenen', 1.2], [null, 4]]);
    if (path === '/shop') return weighted<string | null>(rnd, [[pick(productPages), 6], [null, 2]]);
    if (path === '/afspraak') return weighted<string | null>(rnd, [['/contact', 0.5], [pick(servicePages), 1], [null, 5]]);
    if (path.startsWith('/blog/')) return weighted<string | null>(rnd, [['/blog', 1], [pick(servicePages), 1.5], ['/shop', 0.7], [null, 6]]);
    return weighted<string | null>(rnd, [['/diensten', 2.5], [pick(servicePages), 3], ['/afspraak', 1.5], ['/shop', 1.2], ['/over-ons', 0.8], ['/team', 0.4], ['/contact', 0.6], ['/blog', 0.5], [null, 4]]);
  };

  const sessions: SessionRow[] = [];
  const pageviews: PageviewRow[] = [];
  const events: EventRow[] = [];
  let pvId = 0;
  let evId = 0;
  const startDay = new Date(now);
  startDay.setHours(0, 0, 0, 0);
  startDay.setDate(startDay.getDate() - days + 1);

  for (let d = 0; d < days; d++) {
    const day = new Date(startDay);
    day.setDate(day.getDate() + d);
    const weekday = (day.getDay() + 6) % 7;
    const month = day.getMonth();
    const trend = 0.65 + (0.5 * d) / days;
    const season = [0.7, 0.75, 0.95, 1.15, 1.25, 1.2, 1.1, 1.05, 1.1, 1.0, 0.85, 0.75][month];
    const week = [0.95, 0.9, 0.95, 1.0, 1.1, 1.3, 0.85][weekday];
    const count = Math.round(42 * trend * season * week * (0.8 + rnd() * 0.4));
    const visitorsToday: string[] = [];

    for (let i = 0; i < count; i++) {
      const hour = weighted(rnd, Array.from({ length: 24 }, (_, h): [number, number] => [h, h < 7 ? 0.2 : h < 9 ? 1.5 : h < 12 ? 3 : h < 14 ? 4 : h < 17 ? 3 : h < 19 ? 3.5 : h < 22 ? 4.5 : 1.5]));
      const start = day.getTime() + hour * 3_600_000 + Math.floor(rnd() * 3_600_000);
      if (start > now) continue;
      const channel = weighted<Channel>(rnd, [['search', 42], ['direct', 24], ['social', 15], ['referral', 5], ['paid', d > days - 60 ? 12 : 3], ['ai', 2 + (4 * d) / days], ['email', 2]]);
      const referrer =
        channel === 'search' ? weighted(rnd, [['google.nl', 8], ['google.com', 2], ['bing.com', 1], ['duckduckgo.com', 0.5], ['ecosia.org', 0.5]])
        : channel === 'social' ? weighted(rnd, [['instagram.com', 6], ['facebook.com', 3], ['tiktok.com', 2], ['youtube.com', 0.5]])
        : channel === 'referral' ? weighted(rnd, [['marktplaats.nl', 2], ['autoweek.nl', 1], ['enschede.nl', 1], ['trustpilot.com', 1]])
        : channel === 'ai' ? weighted(rnd, [['chatgpt.com', 5], ['perplexity.ai', 1], ['gemini.google.com', 1]])
        : channel === 'paid' ? 'google'
        : channel === 'email' ? 'nieuwsbrief'
        : null;
      const device = weighted<Device>(rnd, [['mobile', 64], ['desktop', 30], ['tablet', 6]]);
      const [browser, os] =
        device === 'desktop'
          ? weighted(rnd, [[['Chrome', 'Windows'], 45], [['Edge', 'Windows'], 18], [['Safari', 'macOS'], 14], [['Chrome', 'macOS'], 10], [['Firefox', 'Windows'], 8], [['Firefox', 'Linux'], 2]])
          : weighted(rnd, [[['Safari', 'iOS'], 48], [['Chrome', 'Android'], 38], [['Samsung Internet', 'Android'], 10], [['Chrome', 'iOS'], 4]]);
      const country = weighted(rnd, [['NL', 88], ['DE', 8], ['BE', 3], ['XX', 1]]);
      const visitor = visitorsToday.length && rnd() < 0.12 ? pick(visitorsToday) : `v${d}-${i}`;
      visitorsToday.push(visitor);

      const entry =
        channel === 'social' ? weighted(rnd, [['/', 3], [pick(servicePages), 3], ['/shop', 1], [pick(productPages), 1]])
        : channel === 'paid' ? weighted(rnd, [['/diensten/polijsten', 2], ['/diensten/coatings', 2], ['/afspraak', 1]])
        : channel === 'email' ? weighted(rnd, [['/shop', 2], ['/blog/coating-of-wax', 2]])
        : channel === 'ai' ? weighted(rnd, [[pick(servicePages), 3], ['/', 1]])
        : weighted(rnd, [['/', 8], [pick(servicePages), 6], ['/diensten', 2], ['/shop', 1.5], [pick(productPages), 1.5], ['/blog/auto-wassen-in-de-winter', 1], ['/blog/coating-of-wax', 0.8], ['/afspraak', 1], ['/contact', 0.6], ['/actie-zomer-2025', 0.15]]);

      const id = sessions.length + 1;
      const session: SessionRow = {
        id,
        visitor,
        started_at: start,
        last_seen_at: start,
        entry_path: entry,
        channel,
        referrer,
        utm_campaign: channel === 'paid' ? weighted(rnd, [['voorjaarsactie-polijsten', 2], ['coating-2026', 1]]) : channel === 'email' ? 'nieuwsbrief-maart' : null,
        device,
        browser,
        os,
        country,
        language: country === 'DE' ? 'de' : country === 'XX' ? 'en' : rnd() < 0.03 ? 'en' : 'nl',
      };
      sessions.push(session);

      let t = start;
      let path: string | null = entry;
      let cart = false;
      for (let step = 0; path && step < 12; step++) {
        const bounce = step === 0 && rnd() < (path === '/actie-zomer-2025' ? 0.9 : channel === 'paid' ? 0.45 : 0.32);
        const seconds = bounce ? 2 + rnd() * 7 : 8 + rnd() ** 2 * (path.startsWith('/blog/') ? 260 : path.startsWith('/diensten/') ? 170 : 90);
        const heavy = path === '/diensten/ppf' || path === '/';
        pageviews.push({
          id: ++pvId,
          session_id: id,
          path,
          title: path === '/actie-zomer-2025' ? TITLE('Pagina niet gevonden') : (titles.get(path) ?? null),
          created_at: t,
          duration: Math.round(seconds * 1000),
          scroll: Math.round(Math.min(100, bounce ? 15 + rnd() * 25 : 30 + rnd() * 75 - (path === '/diensten/coatings' ? 25 : 0))),
          load_ms: step === 0 ? Math.round((heavy ? 1600 : 900) + rnd() ** 2 * (heavy ? 3200 : 1800) * (device === 'mobile' ? 1.4 : 1)) : null,
        });
        const ev = (name: EventName, label: string | null = null, value: number | null = null) => events.push({ id: ++evId, session_id: id, name, path: path!, label, value, created_at: t + Math.round(seconds * 600) });
        if (path === '/actie-zomer-2025') ev('not_found', path);
        if (path.startsWith('/shop/') && rnd() < 0.22) {
          const product = products.find((p) => `/shop/${p.slug}` === path);
          if (product) {
            ev('add_to_cart', product.id, 1);
            cart = true;
          }
        }
        if (path === '/afspraak' && rnd() < 0.24) ev('booking', pick(services).id);
        if (path === '/contact' && rnd() < 0.18) ev(weighted<EventName>(rnd, [['call', 3], ['whatsapp', 2], ['email', 1]]), weighted(rnd, [['053 123 45 67', 1]]));
        if (device === 'mobile' && rnd() < 0.025) ev('call', '053 123 45 67');
        if (rnd() < 0.015) ev('outbound', weighted(rnd, [['instagram.com', 3], ['google.com', 2]]));
        if (path === '/afrekenen' && cart && rnd() < 0.55) {
          const total = Math.round(2500 + rnd() * 9000);
          ev('checkout', null, total);
          if (rnd() < 0.85) {
            t += Math.round(seconds * 1000) + 90_000;
            path = '/bestelling';
            pageviews.push({ id: ++pvId, session_id: id, path, title: titles.get(path)!, created_at: t, duration: 25_000, scroll: 80, load_ms: null });
            ev('purchase', `D2G-${String(id).padStart(5, '0')}`, total);
            break;
          }
        }
        if (os === 'iOS' && path === '/afrekenen' && rnd() < 0.04) ev('js_error', "undefined is not an object (evaluating 'r.items')");
        t += Math.round(seconds * 1000) + 500;
        path = bounce ? null : next(path);
        if (path === '/afrekenen' && !cart) path = null;
      }
      session.last_seen_at = t;
    }
  }
  return { sessions, pageviews, events };
}
