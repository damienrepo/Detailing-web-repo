// Website statistics: what the tracker records, how a visit is classified, and the report the admin shows.
// The server and the demo build both run `buildReport` over the same raw rows, so they always agree.

// --- Vocabulary ------------------------------------------------------------------------

export const EVENT_NAMES = ['add_to_cart', 'checkout', 'purchase', 'booking', 'call', 'email', 'whatsapp', 'outbound', 'not_found', 'js_error'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const EVENT_INFO: Record<EventName, { label: string; description: string }> = {
  booking: { label: 'Afspraak aangevraagd', description: 'Het afspraakformulier is verstuurd.' },
  purchase: { label: 'Bestelling betaald', description: 'De betaling van een bestelling is gelukt.' },
  checkout: { label: 'Bestelling geplaatst', description: 'Het bestelformulier is verstuurd en de klant ging naar de betaalpagina.' },
  add_to_cart: { label: 'In winkelwagen gelegd', description: 'Een product is aan de winkelwagen toegevoegd.' },
  call: { label: 'Telefoonnummer aangeklikt', description: 'Op een telefoonnummer geklikt (bellen).' },
  whatsapp: { label: 'WhatsApp geopend', description: 'Op een WhatsApp-link geklikt.' },
  email: { label: 'E-mailadres aangeklikt', description: 'Op een e-mailadres geklikt.' },
  outbound: { label: 'Externe link', description: 'Naar een andere website gegaan, bijv. Instagram of Google Maps.' },
  not_found: { label: 'Pagina niet gevonden', description: 'Een pagina geopend die niet bestaat (404).' },
  js_error: { label: 'Foutmelding', description: 'Er ging iets mis in de browser van de bezoeker.' },
};

/** Events that count as a conversion: someone became a customer or asked for an appointment. */
export const GOALS: EventName[] = ['booking', 'purchase'];

export const DEVICES = ['mobile', 'tablet', 'desktop'] as const;
export type Device = (typeof DEVICES)[number];
export const DEVICE_LABELS: Record<Device, string> = { mobile: 'Mobiel', tablet: 'Tablet', desktop: 'Computer' };

export const CHANNELS = ['direct', 'search', 'ai', 'social', 'referral', 'email', 'paid', 'campaign'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: 'Direct',
  search: 'Zoekmachines',
  ai: 'AI-assistenten',
  social: 'Social media',
  referral: 'Andere websites',
  email: 'E-mail',
  paid: 'Advertenties',
  campaign: 'Campagnes',
};
export const CHANNEL_HINTS: Record<Channel, string> = {
  direct: 'Adres getypt, bladwijzer, of een app die geen herkomst doorgeeft (zoals WhatsApp).',
  search: 'Google, Bing, DuckDuckGo, Ecosia en andere zoekmachines.',
  ai: 'ChatGPT, Perplexity, Gemini, Copilot en andere AI-assistenten.',
  social: 'Instagram, Facebook, TikTok, LinkedIn, YouTube en meer.',
  referral: 'Een link op een andere website.',
  email: 'Een link in een e-mail of nieuwsbrief.',
  paid: 'Betaalde advertenties (Google Ads, Meta-advertenties).',
  campaign: 'Links met een eigen campagnelabel (utm).',
};

/** Filters narrow every number on the dashboard to the visits that match all of them. */
export const FILTER_KEYS = ['channel', 'referrer', 'campaign', 'device', 'browser', 'os', 'country', 'language', 'page', 'entry', 'exit', 'event'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

export const FILTER_LABELS: Record<FilterKey, string> = {
  channel: 'Kanaal',
  referrer: 'Bron',
  campaign: 'Campagne',
  device: 'Apparaat',
  browser: 'Browser',
  os: 'Systeem',
  country: 'Land',
  language: 'Taal',
  page: 'Bezocht',
  entry: 'Binnengekomen op',
  exit: 'Vertrokken vanaf',
  event: 'Actie',
};

/** A visit ends after 30 minutes without activity. */
export const SESSION_GAP_MS = 30 * 60_000;
/** Time on a single page is capped, so a tab left open overnight doesn't skew the averages. */
export const MAX_PAGE_MS = 30 * 60_000;
/** A visit counts as "engaged" (not a bounce) from this long, or from two pages or a conversion. */
export const ENGAGED_MS = 10_000;
/** Raw statistics are deleted after this many days (about 25 months). */
export const RETENTION_DAYS = 760;

// --- Normalising and classifying ------------------------------------------------------

/** Order and payment links contain private ids, so they are counted under one path. */
export function normalizePath(raw: string): string {
  let p = (raw.split(/[?#]/)[0] || '/').replace(/\/{2,}/g, '/');
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (p.startsWith('/bestelling/')) return '/bestelling';
  if (p.startsWith('/demo-betaling/')) return '/demo-betaling';
  return p.slice(0, 200);
}

const AI = /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|meta\.ai|mistral\.ai)$/;
const SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|startpage\.com|yandex\.[a-z]+|baidu\.com|qwant\.com|search\.brave\.com|kagi\.com)$/;
const SOCIAL = /(^|\.)(facebook\.com|fb\.me|instagram\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|pinterest\.[a-z.]+|tiktok\.com|youtube\.com|youtu\.be|reddit\.com|snapchat\.com|whatsapp\.com|wa\.me|threads\.net|bsky\.app|telegram\.org|t\.me)$/;
const WEBMAIL = /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com|webmail\.[a-z.]+)$/;
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid[_-]?social|display|cpm|cpv|ads?|retargeting)$/;
const EMAIL_MEDIUM = /^(e-?mail|newsletter|nieuwsbrief|mailing)$/;
const SOCIAL_MEDIUM = /^(social|social[_-]?media|sm|organic[_-]?social)$/;

/** "www.google.nl" → "google.nl"; returns null for anything that isn't a web address. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname.toLowerCase().replace(/^www\./, '').slice(0, 100) || null;
  } catch {
    return null;
  }
}

/** Where a visit came from, from the referring site and any campaign tags on the link. */
export function classifySource(input: { host: string | null; utmSource?: string | null; utmMedium?: string | null; paid?: boolean }): { channel: Channel; referrer: string | null } {
  const medium = input.utmMedium?.toLowerCase().trim() ?? '';
  const source = input.utmSource?.toLowerCase().trim() || null;
  const host = input.host;
  const name = source ?? host;
  const tagged = (hostLike: string) => (AI.test(hostLike) ? 'ai' : SEARCH.test(hostLike) || /^(google|bing|duckduckgo|ecosia)$/.test(hostLike) ? 'search' : SOCIAL.test(hostLike) || /^(facebook|instagram|tiktok|linkedin|youtube|pinterest|twitter|x|meta|ig|fb)$/.test(hostLike) ? 'social' : null);

  if (input.paid || PAID_MEDIUM.test(medium)) return { channel: 'paid', referrer: name };
  if (EMAIL_MEDIUM.test(medium) || source === 'newsletter' || source === 'nieuwsbrief') return { channel: 'email', referrer: name };
  if (SOCIAL_MEDIUM.test(medium)) return { channel: 'social', referrer: name };
  if (source) return { channel: tagged(source) ?? 'campaign', referrer: source };
  if (!host) return { channel: 'direct', referrer: null };
  if (WEBMAIL.test(host)) return { channel: 'email', referrer: host };
  return { channel: tagged(host) ?? 'referral', referrer: host };
}

const BOT = /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|httpclient|phantom|selenium|puppeteer|playwright|bingpreview|vercel|datadog/i;

/** A rough browser and system name; enough to spot "all Safari users leave on the checkout". */
export function parseUserAgent(ua: string): { browser: string; os: string; bot: boolean } {
  const bot = !ua || BOT.test(ua);
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS|Chromium/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Overig';
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Overig';
  return { browser, os, bot };
}

const TIMEZONE_COUNTRY: Record<string, string> = {
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Berlin': 'DE',
  'Europe/Busingen': 'DE',
  'Europe/Luxembourg': 'LU',
  'Europe/Paris': 'FR',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Europe/Lisbon': 'PT',
  'Europe/Rome': 'IT',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Copenhagen': 'DK',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO',
  'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR',
  'Europe/Kyiv': 'UA',
  'Europe/Kiev': 'UA',
  'America/Curacao': 'CW',
  'America/Aruba': 'AW',
  'America/Paramaribo': 'SR',
};

export const COUNTRY_NAMES: Record<string, string> = {
  NL: 'Nederland',
  BE: 'België',
  DE: 'Duitsland',
  LU: 'Luxemburg',
  FR: 'Frankrijk',
  GB: 'Verenigd Koninkrijk',
  IE: 'Ierland',
  ES: 'Spanje',
  PT: 'Portugal',
  IT: 'Italië',
  AT: 'Oostenrijk',
  CH: 'Zwitserland',
  DK: 'Denemarken',
  SE: 'Zweden',
  NO: 'Noorwegen',
  FI: 'Finland',
  PL: 'Polen',
  CZ: 'Tsjechië',
  HU: 'Hongarije',
  RO: 'Roemenië',
  BG: 'Bulgarije',
  GR: 'Griekenland',
  TR: 'Turkije',
  UA: 'Oekraïne',
  CW: 'Curaçao',
  AW: 'Aruba',
  SR: 'Suriname',
  US: 'Verenigde Staten',
  EU: 'Elders in Europa',
  AM: 'Amerika',
  AS: 'Azië',
  AF: 'Afrika',
  OC: 'Oceanië',
  XX: 'Onbekend',
};

/** Country guessed from the device's time zone; we never look up IP addresses. */
export function countryFromTimezone(tz: string | null | undefined): string {
  if (!tz) return 'XX';
  if (TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz];
  const region = tz.split('/')[0];
  return region === 'Europe' ? 'EU' : region === 'America' ? 'AM' : region === 'Asia' ? 'AS' : region === 'Africa' ? 'AF' : region === 'Australia' || region === 'Pacific' ? 'OC' : 'XX';
}

export const LANGUAGE_NAMES: Record<string, string> = {
  nl: 'Nederlands',
  de: 'Duits',
  en: 'Engels',
  fr: 'Frans',
  es: 'Spaans',
  it: 'Italiaans',
  pl: 'Pools',
  tr: 'Turks',
  ar: 'Arabisch',
  pt: 'Portugees',
  uk: 'Oekraïens',
  ru: 'Russisch',
  ro: 'Roemeens',
  zh: 'Chinees',
};

export function languageCode(lang: string | null | undefined): string {
  const code = (lang ?? '').toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code) ? code : 'xx';
}

// --- Time zones ----------------------------------------------------------------------

/** Local calendar parts of timestamps in a time zone, with the UTC offset cached per hour. */
export function zoned(tz: string) {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  }
  const cache = new Map<number, number>();
  const offset = (ts: number) => {
    const hour = Math.floor(ts / 3_600_000);
    let o = cache.get(hour);
    if (o === undefined) {
      const parts = fmt.formatToParts(new Date(hour * 3_600_000));
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      o = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')) - hour * 3_600_000;
      cache.set(hour, o);
    }
    return o;
  };
  return {
    /** Monday = 0 … Sunday = 6. */
    parts(ts: number) {
      const d = new Date(ts + offset(ts));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hour: d.getUTCHours(), weekday: (d.getUTCDay() + 6) % 7 };
    },
    /** The timestamp of local midnight on the given date (month is 0-based; days may overflow). */
    midnight(year: number, month: number, day: number) {
      const guess = Date.UTC(year, month, day);
      const first = guess - offset(guess);
      return guess - offset(first);
    },
  };
}

// --- Raw rows --------------------------------------------------------------------------

export type SessionRow = {
  id: number;
  visitor: string;
  started_at: number;
  last_seen_at: number;
  entry_path: string;
  channel: Channel;
  referrer: string | null;
  utm_campaign: string | null;
  device: Device;
  browser: string;
  os: string;
  country: string;
  language: string;
};

export type PageviewRow = {
  id: number;
  session_id: number;
  path: string;
  title: string | null;
  created_at: number;
  duration: number;
  scroll: number | null;
  load_ms: number | null;
};

export type EventRow = {
  id: number;
  session_id: number;
  name: EventName;
  path: string;
  label: string | null;
  value: number | null;
  created_at: number;
};

export type RawData = { sessions: SessionRow[]; pageviews: PageviewRow[]; events: EventRow[] };

// --- Report ------------------------------------------------------------------------------

export type Metrics = {
  visitors: number;
  sessions: number;
  pageviews: number;
  /** Share of visits that left after one page within 10 seconds, 0–1. */
  bounceRate: number;
  /** Average active time per visit, in ms. */
  avgDuration: number;
  pagesPerSession: number;
  /** Visits with a booking or a paid order. */
  conversions: number;
  conversionRate: number;
  bookings: number;
  orders: number;
  /** Paid order value in cents. */
  revenue: number;
};

export type SeriesMetric = 'visitors' | 'sessions' | 'pageviews' | 'avgDuration' | 'bounceRate' | 'conversions';
export type SeriesValues = Record<SeriesMetric, number>;
export type SeriesPoint = SeriesValues & { start: number; prev: SeriesValues | null; prevStart: number };

export type Bucket = 'hour' | 'day' | 'week';

export type DimRow = { key: string; sessions: number; visitors: number; conversions: number; bounceRate: number; avgDuration: number };

export type PageRow = {
  path: string;
  title: string | null;
  views: number;
  visitors: number;
  entries: number;
  exits: number;
  /** Average active time on the page, ms (only views where it was measured). */
  avgTime: number;
  /** Average furthest scroll position, 0–100, or null when not measured. */
  scroll: number | null;
  /** Of the visits that started here, the share that bounced. */
  bounceRate: number;
  exitRate: number;
  loadMs: number | null;
};

export type EventSummary = { name: EventName; count: number; sessions: number; value: number; top: { label: string; count: number }[] };

export type FunnelStep = { label: string; sessions: number };
export type Funnel = { id: 'booking' | 'shop'; title: string; steps: FunnelStep[] };

export type Insight = {
  tone: 'good' | 'warn' | 'info';
  title: string;
  text: string;
  filter?: { key: FilterKey; value: string };
};

export type PageDetail = {
  path: string;
  title: string | null;
  views: number;
  visitors: number;
  avgTime: number;
  scroll: number | null;
  exitRate: number;
  previous: { key: string; kind: 'page' | 'channel'; count: number }[];
  next: { key: string; kind: 'page' | 'exit'; count: number }[];
  /** Views by furthest scroll position: <25%, 25–50%, 50–75%, 75–100%. */
  scrollBands: number[];
  events: { name: EventName; count: number }[];
};

export type Report = {
  range: { from: number; to: number; bucket: Bucket; tz: string };
  totals: Metrics;
  previous: Metrics;
  series: SeriesPoint[];
  pages: PageRow[];
  entryPages: DimRow[];
  exitPages: DimRow[];
  channels: DimRow[];
  referrers: DimRow[];
  campaigns: DimRow[];
  devices: DimRow[];
  browsers: DimRow[];
  os: DimRow[];
  countries: DimRow[];
  languages: DimRow[];
  events: EventSummary[];
  funnels: Funnel[];
  /** Visits by weekday (Monday first) and hour of the day. */
  heatmap: number[][];
  issues: {
    notFound: { path: string; count: number }[];
    errors: { message: string; count: number; path: string }[];
    slowPages: { path: string; loadMs: number; views: number }[];
  };
  insights: Insight[];
  pageDetail: PageDetail | null;
};

export type SessionSummary = {
  id: number;
  startedAt: number;
  duration: number;
  pageviews: number;
  channel: Channel;
  referrer: string | null;
  campaign: string | null;
  device: Device;
  browser: string;
  os: string;
  country: string;
  language: string;
  paths: string[];
  goals: EventName[];
  events: number;
};

export type TimelineItem =
  | { type: 'page'; at: number; path: string; title: string | null; duration: number; scroll: number | null; loadMs: number | null }
  | { type: 'event'; at: number; path: string; name: EventName; label: string | null; value: number | null };

export type SessionDetail = SessionSummary & { timeline: TimelineItem[] };

export type ReportOptions = { from: number; to: number; tz: string; filters?: Filters; shopEnabled?: boolean };

// --- Building the report ------------------------------------------------------------

type Visit = {
  s: SessionRow;
  pvs: PageviewRow[];
  evs: EventRow[];
  /** Effective active time per pageview, same order as pvs. */
  times: number[];
  duration: number;
  exit: string;
  engaged: boolean;
  goals: Set<EventName>;
};

/** Pageviews without a measured time (the beacon got lost) fall back to the gap until the next page. */
function enrich(data: RawData): Map<number, Visit> {
  const visits = new Map<number, Visit>();
  for (const s of data.sessions) visits.set(s.id, { s, pvs: [], evs: [], times: [], duration: 0, exit: s.entry_path, engaged: false, goals: new Set() });
  for (const pv of data.pageviews) visits.get(pv.session_id)?.pvs.push(pv);
  for (const ev of data.events) visits.get(ev.session_id)?.evs.push(ev);
  for (const v of visits.values()) {
    v.pvs.sort((a, b) => a.created_at - b.created_at || a.id - b.id);
    v.evs.sort((a, b) => a.created_at - b.created_at || a.id - b.id);
    v.times = v.pvs.map((pv, i) => {
      if (pv.duration > 0) return Math.min(pv.duration, MAX_PAGE_MS);
      const next = v.pvs[i + 1];
      return next ? Math.min(Math.max(0, next.created_at - pv.created_at), MAX_PAGE_MS) : 0;
    });
    v.duration = v.times.reduce((a, b) => a + b, 0);
    v.exit = v.pvs.at(-1)?.path ?? v.s.entry_path;
    for (const ev of v.evs) if (GOALS.includes(ev.name)) v.goals.add(ev.name);
    v.engaged = v.pvs.length > 1 || v.duration >= ENGAGED_MS || v.goals.size > 0;
  }
  return visits;
}

function matches(v: Visit, filters: Filters) {
  for (const [key, value] of Object.entries(filters) as [FilterKey, string][]) {
    if (value === undefined || value === '') continue;
    const ok =
      key === 'channel' ? v.s.channel === value
      : key === 'referrer' ? (v.s.referrer ?? '') === value
      : key === 'campaign' ? (v.s.utm_campaign ?? '') === value
      : key === 'device' ? v.s.device === value
      : key === 'browser' ? v.s.browser === value
      : key === 'os' ? v.s.os === value
      : key === 'country' ? v.s.country === value
      : key === 'language' ? v.s.language === value
      : key === 'page' ? v.pvs.some((pv) => pv.path === value)
      : key === 'entry' ? (v.pvs[0]?.path ?? v.s.entry_path) === value
      : key === 'exit' ? v.exit === value
      : key === 'event' ? v.evs.some((ev) => ev.name === value)
      : true;
    if (!ok) return false;
  }
  return true;
}

function metrics(visits: Visit[]): Metrics {
  const sessions = visits.length;
  const visitors = new Set(visits.map((v) => v.s.visitor)).size;
  const pageviews = visits.reduce((n, v) => n + v.pvs.length, 0);
  const bounces = visits.filter((v) => !v.engaged).length;
  const conversions = visits.filter((v) => v.goals.size > 0).length;
  let bookings = 0;
  let orders = 0;
  let revenue = 0;
  for (const v of visits)
    for (const ev of v.evs) {
      if (ev.name === 'booking') bookings++;
      if (ev.name === 'purchase') {
        orders++;
        revenue += ev.value ?? 0;
      }
    }
  return {
    visitors,
    sessions,
    pageviews,
    bounceRate: sessions ? bounces / sessions : 0,
    avgDuration: sessions ? visits.reduce((n, v) => n + v.duration, 0) / sessions : 0,
    pagesPerSession: sessions ? pageviews / sessions : 0,
    conversions,
    conversionRate: sessions ? conversions / sessions : 0,
    bookings,
    orders,
    revenue,
  };
}

function seriesValues(visits: Visit[]): SeriesValues {
  const m = metrics(visits);
  return { visitors: m.visitors, sessions: m.sessions, pageviews: m.pageviews, avgDuration: m.avgDuration, bounceRate: m.bounceRate, conversions: m.conversions };
}

export function bucketFor(from: number, to: number): Bucket {
  const days = (to - from) / 86_400_000;
  return days <= 2 ? 'hour' : days <= 120 ? 'day' : 'week';
}

/** Bucket start times covering [from, to), aligned to local hours, days or Mondays. */
export function bucketStarts(from: number, to: number, bucket: Bucket, tz: string): number[] {
  const z = zoned(tz);
  const starts: number[] = [];
  if (bucket === 'hour') {
    for (let t = Math.floor(from / 3_600_000) * 3_600_000; t < to && starts.length < 100; t += 3_600_000) starts.push(t);
    return starts;
  }
  const p = z.parts(from);
  let day = bucket === 'week' ? p.day - p.weekday : p.day;
  const step = bucket === 'week' ? 7 : 1;
  for (let t = z.midnight(p.year, p.month, day); t < to && starts.length < 400; t = z.midnight(p.year, p.month, (day += step))) starts.push(t);
  return starts;
}

function indexOf(starts: number[], ts: number) {
  let lo = 0;
  let hi = starts.length - 1;
  if (hi < 0 || ts < starts[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= ts) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function dims(visits: Visit[], keyOf: (v: Visit) => string | null, limit = 50): DimRow[] {
  const groups = new Map<string, Visit[]>();
  for (const v of visits) {
    const key = keyOf(v);
    if (key === null || key === '') continue;
    const list = groups.get(key);
    if (list) list.push(v);
    else groups.set(key, [v]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const m = metrics(list);
      return { key, sessions: m.sessions, visitors: m.visitors, conversions: m.conversions, bounceRate: m.bounceRate, avgDuration: m.avgDuration };
    })
    .sort((a, b) => b.sessions - a.sessions || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function pageRows(visits: Visit[]): PageRow[] {
  type Acc = { views: number; visitors: Set<string>; entries: number; bounces: number; exits: number; time: number; timed: number; scroll: number; scrolled: number; load: number; loads: number; title: string | null; titleAt: number };
  const pages = new Map<string, Acc>();
  for (const v of visits) {
    v.pvs.forEach((pv, i) => {
      let a = pages.get(pv.path);
      if (!a) pages.set(pv.path, (a = { views: 0, visitors: new Set(), entries: 0, bounces: 0, exits: 0, time: 0, timed: 0, scroll: 0, scrolled: 0, load: 0, loads: 0, title: null, titleAt: 0 }));
      a.views++;
      a.visitors.add(v.s.visitor);
      if (i === 0) {
        a.entries++;
        if (!v.engaged) a.bounces++;
      }
      if (i === v.pvs.length - 1) a.exits++;
      if (v.times[i] > 0) {
        a.time += v.times[i];
        a.timed++;
      }
      if (pv.scroll !== null) {
        a.scroll += pv.scroll;
        a.scrolled++;
      }
      if (pv.load_ms) {
        a.load += pv.load_ms;
        a.loads++;
      }
      if (pv.title && pv.created_at >= a.titleAt) {
        a.title = pv.title;
        a.titleAt = pv.created_at;
      }
    });
  }
  return [...pages.entries()]
    .map(([path, a]) => ({
      path,
      title: a.title,
      views: a.views,
      visitors: a.visitors.size,
      entries: a.entries,
      exits: a.exits,
      avgTime: a.timed ? a.time / a.timed : 0,
      scroll: a.scrolled ? a.scroll / a.scrolled : null,
      bounceRate: a.entries ? a.bounces / a.entries : 0,
      exitRate: a.views ? a.exits / a.views : 0,
      loadMs: a.loads ? a.load / a.loads : null,
    }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path));
}

function eventSummaries(visits: Visit[]): EventSummary[] {
  const acc = new Map<EventName, { count: number; sessions: Set<number>; value: number; labels: Map<string, number> }>();
  for (const v of visits)
    for (const ev of v.evs) {
      let a = acc.get(ev.name);
      if (!a) acc.set(ev.name, (a = { count: 0, sessions: new Set(), value: 0, labels: new Map() }));
      a.count++;
      a.sessions.add(v.s.id);
      a.value += ev.value ?? 0;
      if (ev.label) a.labels.set(ev.label, (a.labels.get(ev.label) ?? 0) + 1);
    }
  return EVENT_NAMES.filter((name) => acc.has(name)).map((name) => {
    const a = acc.get(name)!;
    return {
      name,
      count: a.count,
      sessions: a.sessions.size,
      value: a.value,
      top: [...a.labels.entries()].map(([label, count]) => ({ label, count })).sort((x, y) => y.count - x.count).slice(0, 10),
    };
  });
}

/** Each step counts visits that reached it or any later step, so the funnel never widens. */
function funnel(visits: Visit[], id: Funnel['id'], title: string, steps: { label: string; test: (v: Visit) => boolean }[]): Funnel {
  const reached = steps.map(() => 0);
  for (const v of visits) {
    let deepest = -1;
    steps.forEach((step, i) => {
      if (step.test(v)) deepest = i;
    });
    for (let i = 0; i <= deepest; i++) reached[i]++;
  }
  return { id, title, steps: steps.map((s, i) => ({ label: s.label, sessions: reached[i] })) };
}

const visited = (v: Visit, test: (path: string) => boolean) => v.pvs.some((pv) => test(pv.path));
const did = (v: Visit, name: EventName) => v.evs.some((ev) => ev.name === name);

function funnels(visits: Visit[], shopEnabled: boolean): Funnel[] {
  const result = [
    funnel(visits, 'booking', 'Afspraak aanvragen', [
      { label: 'Bezoek', test: () => true },
      { label: 'Dienst bekeken', test: (v) => visited(v, (p) => p === '/diensten' || p.startsWith('/diensten/')) },
      { label: 'Afspraakformulier geopend', test: (v) => visited(v, (p) => p === '/afspraak') },
      { label: 'Aanvraag verstuurd', test: (v) => did(v, 'booking') },
    ]),
  ];
  const shopActivity = visits.some((v) => visited(v, (p) => p === '/shop' || p.startsWith('/shop/')));
  if (shopEnabled || shopActivity)
    result.push(
      funnel(visits, 'shop', 'Webshop', [
        { label: 'Bezoek', test: () => true },
        { label: 'Product bekeken', test: (v) => visited(v, (p) => p.startsWith('/shop/')) },
        { label: 'In winkelwagen', test: (v) => did(v, 'add_to_cart') },
        { label: 'Naar afrekenen', test: (v) => visited(v, (p) => p === '/afrekenen') },
        { label: 'Bestelling geplaatst', test: (v) => did(v, 'checkout') },
        { label: 'Betaald', test: (v) => did(v, 'purchase') },
      ]),
    );
  return result;
}

function pageDetail(visits: Visit[], path: string): PageDetail | null {
  const prev = new Map<string, { kind: 'page' | 'channel'; count: number }>();
  const next = new Map<string, { kind: 'page' | 'exit'; count: number }>();
  const bands = [0, 0, 0, 0];
  const events = new Map<EventName, number>();
  const bump = <K extends string>(map: Map<string, { kind: K; count: number }>, key: string, kind: K) => {
    const e = map.get(key);
    if (e) e.count++;
    else map.set(key, { kind, count: 1 });
  };
  for (const v of visits) {
    v.pvs.forEach((pv, i) => {
      if (pv.path !== path) return;
      if (i === 0) bump(prev, v.s.channel, 'channel');
      else bump(prev, v.pvs[i - 1].path, 'page');
      if (i === v.pvs.length - 1) bump(next, '', 'exit');
      else bump(next, v.pvs[i + 1].path, 'page');
      if (pv.scroll !== null) bands[Math.min(3, Math.floor(pv.scroll / 25))]++;
    });
    for (const ev of v.evs) if (ev.path === path) events.set(ev.name, (events.get(ev.name) ?? 0) + 1);
  }
  const row = pageRows(visits).find((r) => r.path === path);
  if (!row) return null;
  const sorted = <T extends { count: number }>(m: Map<string, T>) => [...m.entries()].map(([key, e]) => ({ key, ...e })).sort((a, b) => b.count - a.count).slice(0, 8);
  return {
    path,
    title: row.title,
    views: row.views,
    visitors: row.visitors,
    avgTime: row.avgTime,
    scroll: row.scroll,
    exitRate: row.exitRate,
    previous: sorted(prev),
    next: sorted(next),
    scrollBands: bands,
    events: [...events.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const WEEKDAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

/** Short, plain-language observations, most actionable first. */
function insights(r: Omit<Report, 'insights' | 'pageDetail' | 'range'>, pages: PageRow[]): Insight[] {
  const out: (Insight & { weight: number })[] = [];
  const { totals, previous } = r;
  const name = (p: PageRow) => (p.path === '/' ? 'de homepage' : `“${(p.title ?? p.path).split(' | ')[0]}”`);
  if (totals.sessions === 0) return [];

  if (previous.sessions >= 20) {
    const change = (totals.sessions - previous.sessions) / previous.sessions;
    if (Math.abs(change) >= 0.2) {
      out.push({
        weight: change > 0 ? 3 : 8,
        tone: change > 0 ? 'good' : 'warn',
        title: change > 0 ? `${pct(change)} meer bezoek dan de vorige periode` : `${pct(-change)} minder bezoek dan de vorige periode`,
        text: change > 0 ? 'Mooi! Kijk bij Bronnen waar de groei vandaan komt, en doe daar meer van.' : 'Kijk bij Bronnen welk kanaal is teruggelopen. Is er bijvoorbeeld een advertentie of post gestopt?',
      });
    }
  }

  const nf = r.issues.notFound.reduce((n, x) => n + x.count, 0);
  if (nf > 0) {
    const top = r.issues.notFound[0];
    out.push({
      weight: 9,
      tone: 'warn',
      title: `${nf}× kwam iemand op een pagina die niet bestaat`,
      text: `Het vaakst ${top.path}. Zoek uit welke link daarheen wijst (een oude post, Google of een advertentie) en pas die aan.`,
      filter: { key: 'event', value: 'not_found' },
    });
  }

  const errors = r.issues.errors.reduce((n, x) => n + x.count, 0);
  if (errors > 0) {
    out.push({
      weight: 7,
      tone: 'warn',
      title: `${errors} foutmelding${errors === 1 ? '' : 'en'} bij bezoekers`,
      text: `Bijvoorbeeld op ${r.issues.errors[0].path}. Zie Problemen onderaan; geef dit door aan je websitebouwer.`,
    });
  }

  const cart = r.events.find((e) => e.name === 'add_to_cart');
  const paid = r.events.find((e) => e.name === 'purchase');
  if (cart && cart.sessions >= 5) {
    const lost = 1 - (paid?.sessions ?? 0) / cart.sessions;
    if (lost >= 0.5)
      out.push({
        weight: 8,
        tone: 'warn',
        title: `${pct(lost)} van de winkelwagens wordt niet afgerekend`,
        text: 'Bekijk de Webshop-trechter om te zien waar mensen afhaken. Verzendkosten en een lange checkout zijn de bekendste oorzaken.',
        filter: { key: 'event', value: 'add_to_cart' },
      });
  }

  const bookingPage = pages.find((p) => p.path === '/afspraak');
  const booked = r.events.find((e) => e.name === 'booking')?.sessions ?? 0;
  if (bookingPage && bookingPage.visitors >= 10 && booked / bookingPage.visitors < 0.25) {
    out.push({
      weight: 8,
      tone: 'warn',
      title: 'Veel bezoekers openen het afspraakformulier maar versturen het niet',
      text: `${bookingPage.visitors} bezoekers bekeken het formulier, ${booked} verstuurden het. Minder verplichte velden of een duidelijke prijsindicatie kan helpen.`,
      filter: { key: 'page', value: '/afspraak' },
    });
  }

  const leaky = pages.filter((p) => p.entries >= 15 && p.bounceRate >= 0.6).sort((a, b) => b.entries * b.bounceRate - a.entries * a.bounceRate)[0];
  if (leaky)
    out.push({
      weight: 6,
      tone: 'warn',
      title: `Veel bezoekers haken direct af op ${name(leaky)}`,
      text: `${pct(leaky.bounceRate)} van wie hier binnenkomt gaat binnen 10 seconden weer weg. Zet een duidelijke knop bovenaan, bijv. naar ‘Afspraak maken’.`,
      filter: { key: 'page', value: leaky.path },
    });

  const shallow = pages.filter((p) => p.views >= 20 && p.scroll !== null && p.scroll < 40).sort((a, b) => b.views - a.views)[0];
  if (shallow)
    out.push({
      weight: 4,
      tone: 'info',
      title: `Op ${name(shallow)} lezen bezoekers maar ${Math.round(shallow.scroll!)}% van de pagina`,
      text: 'Zet het belangrijkste (prijs, wat je krijgt, de afspraakknop) zo hoog mogelijk.',
      filter: { key: 'page', value: shallow.path },
    });

  const slow = r.issues.slowPages[0];
  if (slow && slow.loadMs >= 3000)
    out.push({
      weight: 5,
      tone: 'warn',
      title: `${name(pages.find((p) => p.path === slow.path) ?? ({ path: slow.path, title: null } as PageRow))} laadt traag (${(slow.loadMs / 1000).toFixed(1).replace('.', ',')} s)`,
      text: 'Bezoekers op een telefoon haken dan sneller af. Grote foto’s zijn de meest voorkomende oorzaak.',
    });

  const mobile = r.devices.find((d) => d.key === 'mobile');
  if (mobile && totals.sessions >= 30 && mobile.sessions / totals.sessions >= 0.55)
    out.push({
      weight: 2,
      tone: 'info',
      title: `${pct(mobile.sessions / totals.sessions)} bezoekt je site op een telefoon`,
      text: 'Controleer nieuwe pagina’s, foto’s en acties daarom altijd eerst op je eigen telefoon.',
      filter: { key: 'device', value: 'mobile' },
    });

  if (totals.conversions >= 3) {
    const best = r.channels.filter((c) => c.sessions >= 15 && c.conversions > 0).sort((a, b) => b.conversions / b.sessions - a.conversions / a.sessions)[0];
    if (best && best.conversions / best.sessions >= totals.conversionRate * 1.4)
      out.push({
        weight: 3,
        tone: 'good',
        title: `Je beste bezoekers komen via: ${(CHANNEL_LABELS[best.key as Channel] ?? best.key).toLowerCase()}`,
        text: `${pct(best.conversions / best.sessions)} daarvan vraagt een afspraak aan of bestelt, tegen ${pct(totals.conversionRate)} gemiddeld.`,
        filter: { key: 'channel', value: best.key },
      });
  }

  if (totals.sessions >= 50) {
    let peak = { d: 0, h: 0, n: 0 };
    r.heatmap.forEach((row, d) => row.forEach((n, h) => n > peak.n && (peak = { d, h, n })));
    out.push({
      weight: 1,
      tone: 'info',
      title: `Het drukst op ${WEEKDAYS[peak.d]} rond ${peak.h}:00`,
      text: 'Plaats nieuwe berichten of acties net voor dit moment, dan zien de meeste mensen ze.',
    });
  }

  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map(({ weight: _w, ...i }) => i);
}

export function buildReport(data: RawData, opts: ReportOptions): Report {
  const { from, to, tz } = opts;
  const filters = opts.filters ?? {};
  const span = to - from;
  const all = enrich(data);
  const current: Visit[] = [];
  const before: Visit[] = [];
  for (const v of all.values()) {
    if (!matches(v, filters)) continue;
    if (v.s.started_at >= from && v.s.started_at < to) current.push(v);
    else if (v.s.started_at >= from - span && v.s.started_at < from) before.push(v);
  }

  const bucket = bucketFor(from, to);
  const starts = bucketStarts(from, to, bucket, tz);
  const prevStarts = starts.map((s) => s - span);
  const groups = starts.map(() => [] as Visit[]);
  const prevGroups = starts.map(() => [] as Visit[]);
  for (const v of current) {
    const i = indexOf(starts, v.s.started_at);
    if (i >= 0) groups[i].push(v);
  }
  for (const v of before) {
    const i = indexOf(prevStarts, v.s.started_at);
    if (i >= 0) prevGroups[i].push(v);
  }
  const series: SeriesPoint[] = starts.map((start, i) => ({ start, prevStart: prevStarts[i], ...seriesValues(groups[i]), prev: before.length ? seriesValues(prevGroups[i]) : null }));

  const z = zoned(tz);
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const v of current) {
    const p = z.parts(v.s.started_at);
    heatmap[p.weekday][p.hour]++;
  }

  const pages = pageRows(current);
  const events = eventSummaries(current);
  const notFound = events.find((e) => e.name === 'not_found')?.top.map((t) => ({ path: t.label, count: t.count })) ?? [];
  const errorMap = new Map<string, { count: number; path: string }>();
  for (const v of current)
    for (const ev of v.evs)
      if (ev.name === 'js_error') {
        const key = ev.label ?? 'Onbekende fout';
        const e = errorMap.get(key);
        if (e) e.count++;
        else errorMap.set(key, { count: 1, path: ev.path });
      }

  const partial = {
    totals: metrics(current),
    previous: metrics(before),
    series,
    pages: pages.slice(0, 100),
    entryPages: dims(current, (v) => v.pvs[0]?.path ?? v.s.entry_path),
    exitPages: dims(current, (v) => v.exit),
    channels: dims(current, (v) => v.s.channel),
    referrers: dims(current, (v) => v.s.referrer),
    campaigns: dims(current, (v) => v.s.utm_campaign),
    devices: dims(current, (v) => v.s.device),
    browsers: dims(current, (v) => v.s.browser),
    os: dims(current, (v) => v.s.os),
    countries: dims(current, (v) => v.s.country),
    languages: dims(current, (v) => v.s.language),
    events,
    funnels: funnels(current, opts.shopEnabled ?? true),
    heatmap,
    issues: {
      notFound,
      errors: [...errorMap.entries()].map(([message, e]) => ({ message, ...e })).sort((a, b) => b.count - a.count).slice(0, 10),
      slowPages: pages
        .filter((p) => p.loadMs !== null && p.views >= 3)
        .map((p) => ({ path: p.path, loadMs: p.loadMs!, views: p.views }))
        .sort((a, b) => b.loadMs - a.loadMs)
        .slice(0, 5),
    },
  };

  return {
    range: { from, to, bucket, tz },
    ...partial,
    insights: insights(partial, pages),
    pageDetail: filters.page ? pageDetail(current, filters.page) : null,
  };
}

function summary(v: Visit): SessionSummary {
  return {
    id: v.s.id,
    startedAt: v.s.started_at,
    duration: v.duration,
    pageviews: v.pvs.length,
    channel: v.s.channel,
    referrer: v.s.referrer,
    campaign: v.s.utm_campaign,
    device: v.s.device,
    browser: v.s.browser,
    os: v.s.os,
    country: v.s.country,
    language: v.s.language,
    paths: v.pvs.map((pv) => pv.path).slice(0, 30),
    goals: [...v.goals],
    events: v.evs.length,
  };
}

/** The most recent visits matching the filters, newest first. */
export function listSessions(data: RawData, opts: ReportOptions, offset = 0, limit = 25): { total: number; sessions: SessionSummary[] } {
  const filters = opts.filters ?? {};
  const visits = [...enrich(data).values()].filter((v) => v.s.started_at >= opts.from && v.s.started_at < opts.to && matches(v, filters)).sort((a, b) => b.s.started_at - a.s.started_at);
  return { total: visits.length, sessions: visits.slice(offset, offset + limit).map(summary) };
}

/** One visit, page by page, with everything the visitor did in between. */
export function sessionDetail(data: RawData, id: number): SessionDetail | null {
  const v = enrich(data).get(id);
  if (!v) return null;
  const timeline: TimelineItem[] = [
    ...v.pvs.map((pv, i): TimelineItem => ({ type: 'page', at: pv.created_at, path: pv.path, title: pv.title, duration: v.times[i], scroll: pv.scroll, loadMs: pv.load_ms })),
    ...v.evs.map((ev): TimelineItem => ({ type: 'event', at: ev.created_at, path: ev.path, name: ev.name, label: ev.label, value: ev.value })),
  ].sort((a, b) => a.at - b.at || (a.type === 'page' ? -1 : 1));
  return { ...summary(v), timeline };
}
