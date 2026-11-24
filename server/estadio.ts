// Estadio: wash days at Estadio Parkweg, booked on www.detail2go.nl/estadio and managed in the admin (Estadio).
// The booking page talks to /api/estadio; the admin to /api/admin/estadio. See shared/estadio.ts for the rules.
import crypto from 'node:crypto';
import type { Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';
import { EMAIL } from '../shared/email';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUSES,
  calendarStamp,
  DEFAULT_PACKAGES,
  DEFAULT_SETTINGS,
  dayNumber,
  formatDate,
  formatEuro,
  formatTime,
  freeStarts,
  localNow,
  maxOverlap,
  moment,
  toUtc,
  type EstadioBooking,
  type EstadioBookingStatus,
  type EstadioDay,
  type EstadioPackage,
  type EstadioPublicInfo,
  type EstadioSettings,
  type PublicEstadioBooking,
} from '../shared/estadio';
import { adminBookingSchema, bookingRequestSchema, daySchema, newDaysSchema, packagesSchema, rescheduleSchema, settingsSchema } from '../shared/estadioSchemas';
import { SITE } from '../shared/site';
import { fieldErrors } from '../shared/validation';
import type { Config } from './config';
import type { Db } from './db';
import { CalendarError, GoogleCalendar, parseServiceAccount, type CalendarEvent, type ServiceAccount } from './googleCalendar';
import { sendSafely, type Mail, type Mailer } from './mail';
import { renderEmail, type EmailBlock, type EmailContent } from './mailTemplates';
import { sha256, type Cipher } from './security';

/** Errors with a Dutch message (and optional per-field messages); app.ts turns them into JSON. */
export class EstadioError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    throw new EstadioError(400, Object.values(fields)[0] ?? 'Controleer de ingevulde gegevens.', fields);
  }
  return parsed.data;
}

// --- Storage --------------------------------------------------------------------------

type DayRow = {
  id: number;
  date: string;
  start_min: number;
  end_min: number;
  capacity: number;
  interval_min: number;
  break_start_min: number | null;
  break_end_min: number | null;
  open: number;
  note: string;
};

type BookingRow = {
  id: number;
  public_id: string;
  day_id: number;
  date: string;
  start_min: number;
  end_min: number;
  package_id: string;
  package_name: string;
  price: number;
  status: EstadioBookingStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  plate: string;
  vehicle: string;
  parking: string;
  notes: string;
  source: 'online' | 'admin';
  cancelled_by: 'customer' | 'admin' | null;
  created_at: string;
};

const toDay = (r: DayRow): EstadioDay => ({
  id: r.id,
  date: r.date,
  start: r.start_min,
  end: r.end_min,
  capacity: r.capacity,
  interval: r.interval_min,
  breakStart: r.break_start_min,
  breakEnd: r.break_end_min,
  open: Boolean(r.open),
  note: r.note,
});

const toBooking = (r: BookingRow): EstadioBooking => ({
  id: r.id,
  publicId: r.public_id,
  dayId: r.day_id,
  date: r.date,
  start: r.start_min,
  end: r.end_min,
  packageId: r.package_id,
  packageName: r.package_name,
  price: r.price,
  status: r.status,
  name: r.name,
  email: r.email,
  phone: r.phone,
  company: r.company,
  plate: r.plate,
  vehicle: r.vehicle,
  parking: r.parking,
  notes: r.notes,
  source: r.source,
  cancelledBy: r.cancelled_by,
  createdAt: r.created_at,
});

export type GoogleSetup = { account: ServiceAccount; calendarId: string; calendarName: string; enabled: boolean };

/** What the admin sees of the Google Calendar connection (never the key itself). */
export type GoogleStatus = {
  connected: boolean;
  enabled: boolean;
  serviceEmail?: string;
  calendarId?: string;
  calendarName?: string;
  /** Upcoming bookings in the calendar, waiting, and failed (with the latest error). */
  synced: number;
  waiting: number;
  failed: number;
  lastError?: string;
};

const BOOKING_SELECT = 'SELECT b.*, d.date FROM estadio_bookings b JOIN estadio_days d ON d.id = b.day_id';

export class EstadioStore {
  constructor(private db: Db) {}

  private config<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM estadio_config WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return structuredClone(fallback);
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return structuredClone(fallback);
    }
  }

  private saveConfig(key: string, value: unknown) {
    this.db
      .prepare(`INSERT INTO estadio_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`)
      .run(key, JSON.stringify(value));
  }

  /** The Google Calendar connection, stored encrypted (it holds the service account's private key). */
  google(cipher: Cipher): GoogleSetup | undefined {
    const sealed = this.config<string>('google', '');
    if (!sealed) return undefined;
    try {
      return JSON.parse(cipher.decrypt(sealed, 'estadio:google')) as GoogleSetup;
    } catch {
      console.error('[estadio] Google-koppeling kon niet worden ontsleuteld (andere SECRET_KEY?)');
      return undefined;
    }
  }

  saveGoogle(cipher: Cipher, setup: GoogleSetup | undefined) {
    if (!setup) this.db.prepare(`DELETE FROM estadio_config WHERE key = 'google'`).run();
    else this.saveConfig('google', cipher.encrypt(JSON.stringify(setup), 'estadio:google'));
  }

  settings(): EstadioSettings {
    // New settings added later get their default value.
    return { ...DEFAULT_SETTINGS, ...this.config<Partial<EstadioSettings>>('settings', {}) };
  }

  saveSettings(settings: EstadioSettings) {
    this.saveConfig('settings', settings);
  }

  packages(): EstadioPackage[] {
    return this.config('packages', DEFAULT_PACKAGES);
  }

  savePackages(packages: EstadioPackage[]) {
    this.saveConfig('packages', packages);
  }

  day(id: number): EstadioDay | undefined {
    const row = this.db.prepare('SELECT * FROM estadio_days WHERE id = ?').get(id) as DayRow | undefined;
    return row && toDay(row);
  }

  days(): EstadioDay[] {
    return (this.db.prepare('SELECT * FROM estadio_days ORDER BY date').all() as DayRow[]).map(toDay);
  }

  /** Time ranges taken on a day by bookings that occupy a spot, optionally leaving one booking out. */
  taken(dayId: number, exceptId?: number) {
    return this.db
      .prepare(`SELECT start_min AS start, end_min AS end FROM estadio_bookings WHERE day_id = ? AND status != 'cancelled' AND id != ?`)
      .all(dayId, exceptId ?? -1) as { start: number; end: number }[];
  }

  booking(id: number): EstadioBooking | undefined {
    const row = this.db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id) as BookingRow | undefined;
    return row && toBooking(row);
  }

  bookingByPublicId(publicId: string): EstadioBooking | undefined {
    const row = this.db.prepare(`${BOOKING_SELECT} WHERE b.public_id = ?`).get(publicId) as BookingRow | undefined;
    return row && toBooking(row);
  }

  bookingsForDay(dayId: number): EstadioBooking[] {
    return (this.db.prepare(`${BOOKING_SELECT} WHERE b.day_id = ? ORDER BY b.start_min, b.id`).all(dayId) as BookingRow[]).map(toBooking);
  }

  /** Per day: active bookings and their value, for the admin overview. */
  dayTotals(): Record<number, { booked: number; revenue: number }> {
    const rows = this.db
      .prepare(`SELECT day_id, COUNT(*) AS booked, SUM(price) AS revenue FROM estadio_bookings WHERE status != 'cancelled' GROUP BY day_id`)
      .all() as { day_id: number; booked: number; revenue: number }[];
    return Object.fromEntries(rows.map((r) => [r.day_id, { booked: r.booked, revenue: r.revenue }]));
  }
}

// --- Rules ----------------------------------------------------------------------------

type Clock = () => Date;

const nowMoment = (clock: Clock) => {
  const n = localNow(clock());
  return moment(n.date, n.minutes);
};

/** The moment (see `moment`) before which an online change is still allowed. */
const changeDeadline = (b: Pick<EstadioBooking, 'date' | 'start'>, settings: EstadioSettings) => moment(b.date, b.start) - settings.cancelHours * 60;

function momentText(m: number) {
  const date = new Date(Math.floor(m / 1440) * 86_400_000).toISOString().slice(0, 10);
  return `${formatDate(date)}, ${formatTime(((m % 1440) + 1440) % 1440)}`;
}

export function publicBooking(b: EstadioBooking, settings: EstadioSettings, clock: Clock): PublicEstadioBooking {
  const deadline = changeDeadline(b, settings);
  return {
    publicId: b.publicId,
    date: b.date,
    start: b.start,
    end: b.end,
    packageId: b.packageId,
    packageName: b.packageName,
    price: b.price,
    name: b.name,
    email: b.email,
    phone: b.phone,
    company: b.company,
    plate: b.plate,
    vehicle: b.vehicle,
    parking: b.parking,
    notes: b.notes,
    status: b.status,
    changeable: b.status === 'booked' && nowMoment(clock) < deadline,
    changeDeadline: momentText(deadline),
  };
}

/**
 * Open days from today on, with the start times still free per visible package. `exceptId`: a booking being moved,
 * whose own time counts as free.
 */
export function publicInfo(store: EstadioStore, clock: Clock, siteUrl: string, exceptId?: number): EstadioPublicInfo {
  const settings = store.settings();
  const packages = store.packages().filter((p) => p.visible);
  const today = localNow(clock()).date;
  const notBefore = nowMoment(clock) + settings.closeHours * 60;
  const days = settings.enabled
    ? store
        .days()
        .filter((d) => d.open && d.date >= today)
        .map((d) => {
          const taken = store.taken(d.id, exceptId);
          return {
            id: d.id,
            date: d.date,
            start: d.start,
            end: d.end,
            note: d.note,
            slots: Object.fromEntries(packages.map((p) => [p.id, freeStarts(d, taken, p.duration, notBefore)])),
          };
        })
    : [];
  return { settings, packages, days, siteUrl };
}

/** Checks a requested time against the day and the bookings on it; throws a clear message when it does not fit. */
function assertSlot(store: EstadioStore, input: { dayId: number; start: number; packageId: string }, options: { clock: Clock; exceptId?: number; admin?: boolean; force?: boolean }) {
  const settings = store.settings();
  const pkg = store.packages().find((p) => p.id === input.packageId && (p.visible || options.admin));
  if (!pkg) throw new EstadioError(400, 'Kies een pakket', { packageId: 'Kies een pakket' });
  const day = store.day(input.dayId);
  if (!day || (!day.open && !options.admin)) throw new EstadioError(404, 'Deze dag is niet (meer) beschikbaar. Kies een andere dag.');
  if (!options.admin && !settings.enabled) throw new EstadioError(503, 'Boeken is op dit moment niet mogelijk.');
  const end = input.start + pkg.duration;
  if (options.force) {
    if (input.start < day.start || end > day.end) throw new EstadioError(409, `Kies een tijd tussen ${formatTime(day.start)} en ${formatTime(day.end - pkg.duration)}.`);
  } else {
    const notBefore = options.admin ? -Infinity : nowMoment(options.clock) + settings.closeHours * 60;
    if (!freeStarts(day, store.taken(day.id, options.exceptId), pkg.duration, notBefore).includes(input.start)) {
      throw new EstadioError(409, 'Deze tijd is net door iemand anders geboekt of niet meer beschikbaar. Kies een andere tijd.');
    }
  }
  return { day, pkg, end };
}

/** Throws when a day's new hours, break or capacity would no longer fit its bookings. */
function assertDayFits(store: EstadioStore, dayId: number, day: z.infer<typeof daySchema>) {
  const bookings = store.bookingsForDay(dayId).filter((b) => b.status !== 'cancelled');
  const outside = bookings.filter(
    (b) => b.start < day.start || b.end > day.end || (day.breakStart != null && day.breakEnd != null && b.start < day.breakEnd && b.end > day.breakStart),
  );
  if (outside.length) {
    const who = outside.map((b) => `${b.name} (${formatTime(b.start)})`).join(', ');
    throw new EstadioError(409, `Dit past niet meer bij de afspraken van ${who}. Verplaats die eerst.`);
  }
  if (maxOverlap(bookings, day.start, day.end) > day.capacity) {
    throw new EstadioError(409, `Er staan op sommige momenten meer dan ${day.capacity} auto’s tegelijk ingepland. Verplaats eerst een afspraak.`);
  }
}

// --- Vehicle lookup (RDW) -----------------------------------------------------------------

/** What the booking page shows and fills in after a plate is typed. */
export type VehicleInfo = { found: false } | { found: true; brand: string; model: string; color: string; year: string; description: string };

type RdwRow = { merk?: string; handelsbenaming?: string; eerste_kleur?: string; datum_eerste_toelating?: string };

/** Brands written in capitals; everything else becomes "Volkswagen", "Mercedes-Benz". */
const BRAND_CAPS = new Set(['BMW', 'MG', 'DS', 'BYD', 'GMC', 'KGM', 'NIO', 'XPENG', 'VW']);
const NO_COLOR = /^(diversen|niet geregistreerd|n\.v\.t\.?|onbekend)$/i;

/**
 * "VOLKSWAGEN" → "Volkswagen". Words with digits (XC60, ID.3) stay as they are, and in model names so do short
 * abbreviations (GLC, GTI, RS), while ordinary words become "Golf", "Sportback".
 */
function tidy(text: string, kind: 'brand' | 'model') {
  return text
    .trim()
    .split(/\s+/)
    .map((w) =>
      /\d/.test(w) || (kind === 'brand' ? BRAND_CAPS.has(w.toUpperCase()) : w.replace(/\W/g, '').length <= 3)
        ? w.toUpperCase()
        : w.toLowerCase().replace(/(^|[-/])\p{L}/gu, (c) => c.toUpperCase()),
    )
    .join(' ');
}

/** Turns an RDW record into "Tesla Model 3, grijs". */
export function describeVehicle(row: RdwRow): VehicleInfo {
  const brand = row.merk ? tidy(row.merk, 'brand') : '';
  let model = row.handelsbenaming ? tidy(row.handelsbenaming, 'model') : '';
  // The trade name sometimes repeats the brand: "AUDI A6".
  if (brand && model.toLowerCase().startsWith(`${brand.toLowerCase()} `)) model = model.slice(brand.length + 1);
  const color = row.eerste_kleur && !NO_COLOR.test(row.eerste_kleur.trim()) ? row.eerste_kleur.trim().toLowerCase() : '';
  if (!brand && !model) return { found: false };
  const description = [[brand, model].filter(Boolean).join(' '), color].filter(Boolean).join(', ');
  return { found: true, brand, model, color, year: row.datum_eerste_toelating?.slice(0, 4) ?? '', description };
}

// --- Calendar ---------------------------------------------------------------------------

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Folds lines longer than 75 bytes, as calendar files require. */
function fold(line: string) {
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
    }
    current += ch;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function calendarFile(b: EstadioBooking, settings: EstadioSettings, manageUrl: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Detail2Go//Estadio//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:estadio-${b.publicId}@detail2go.nl`,
    `DTSTAMP:${calendarStamp(new Date())}`,
    `DTSTART:${calendarStamp(toUtc(b.date, b.start))}`,
    `DTEND:${calendarStamp(toUtc(b.date, b.end))}`,
    `SUMMARY:${icsText(`${SITE.name}: ${b.packageName} (${b.plate})`)}`,
    `LOCATION:${icsText(`${settings.locationName}, ${settings.address}`)}`,
    `DESCRIPTION:${icsText(`${b.packageName} voor ${b.plate}. De tijd is een indicatie.\nBekijken, verplaatsen of annuleren: ${manageUrl}`)}`,
    `URL:${manageUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

// --- E-mails ----------------------------------------------------------------------------

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const when = (b: Pick<EstadioBooking, 'date' | 'start'>) => `${formatDate(b.date)} om ${formatTime(b.start)}`;

function bookingRows(b: EstadioBooking, settings: EstadioSettings): [string, string][] {
  return [
    ['Pakket', b.packageName],
    ['Datum', formatDate(b.date, { year: true })],
    ['Tijd', `${formatTime(b.start)} – ${formatTime(b.end)} (indicatie)`],
    ['Locatie', `${settings.locationName}\n${settings.address}`],
    ['Kenteken', b.plate],
    ...(b.vehicle ? ([['Auto', b.vehicle]] as [string, string][]) : []),
    ...(b.parking ? ([['Staat op', b.parking]] as [string, string][]) : []),
    ['Prijs', `${formatEuro(b.price)} excl. btw`],
  ];
}

type MailContext = { settings: EstadioSettings; appUrl: string; estadioUrl: string };

const manageLink = (ctx: MailContext, b: EstadioBooking) => `${ctx.estadioUrl}/boeking/${b.publicId}`;

function customerMail(b: EstadioBooking, ctx: MailContext, content: Omit<EmailContent, 'note'>): Mail {
  const full: EmailContent = { ...content, note: `Je ontvangt deze e-mail omdat je een afspraak maakte via ${ctx.estadioUrl.replace(/^https?:\/\//, '')}.` };
  const { html, text } = renderEmail(full, EMAIL.design, ctx.appUrl);
  return { to: b.email, subject: full.subject, text, html };
}

const practicalBlock = (settings: EstadioSettings): EmailBlock[] => (settings.practical.length ? [{ type: 'box', title: 'Goed om te weten', lines: settings.practical }] : []);

const changeNote = (settings: EstadioSettings) =>
  settings.cancelHours > 0
    ? `Iets veranderd? Je kunt je afspraak tot ${settings.cancelHours} uur van tevoren zelf verplaatsen of annuleren via de knop hierboven. Daarna kun je ons bellen of appen op ${SITE.phone}.`
    : `Iets veranderd? Via de knop hierboven kun je je afspraak verplaatsen of annuleren.`;

export const estadioMails = {
  confirmed(b: EstadioBooking, ctx: MailContext): Mail {
    return customerMail(b, ctx, {
      subject: `Je afspraak bij ${ctx.settings.locationName}: ${when(b)}`,
      preheader: `${b.packageName} voor ${b.plate}. Tot dan!`,
      heading: 'Je afspraak staat vast',
      intro: `Hoi ${firstName(b.name)}, bedankt voor je boeking. Op ${when(b)} gaan we bij ${ctx.settings.locationName} aan de slag met je auto.`,
      button: { label: 'Bekijken of wijzigen', url: manageLink(ctx, b) },
      blocks: [{ type: 'details', title: 'Je afspraak', rows: bookingRows(b, ctx.settings) }, ...practicalBlock(ctx.settings)],
      closing: changeNote(ctx.settings),
    });
  },

  moved(b: EstadioBooking, ctx: MailContext): Mail {
    return customerMail(b, ctx, {
      subject: `Je afspraak is verplaatst naar ${when(b)}`,
      preheader: `${b.packageName} voor ${b.plate}`,
      heading: 'Je afspraak is verplaatst',
      intro: `Hoi ${firstName(b.name)}, je afspraak staat nu op ${when(b)}.`,
      button: { label: 'Bekijken of wijzigen', url: manageLink(ctx, b) },
      blocks: [{ type: 'details', title: 'Je afspraak', rows: bookingRows(b, ctx.settings) }],
      closing: changeNote(ctx.settings),
    });
  },

  reminder(b: EstadioBooking, ctx: MailContext): Mail {
    return customerMail(b, ctx, {
      subject: `Morgen: je auto bij ${ctx.settings.locationName} om ${formatTime(b.start)}`,
      preheader: `${b.packageName} voor ${b.plate}`,
      heading: 'Tot morgen!',
      intro: `Hoi ${firstName(b.name)}, een herinnering: morgen om ${formatTime(b.start)} gaan we aan de slag met je auto (${b.plate}).`,
      button: { label: 'Bekijken of wijzigen', url: manageLink(ctx, b) },
      blocks: [{ type: 'details', title: 'Je afspraak', rows: bookingRows(b, ctx.settings) }, ...practicalBlock(ctx.settings)],
    });
  },

  cancelled(b: EstadioBooking, ctx: MailContext, by: 'customer' | 'admin', message?: string): Mail {
    return customerMail(b, ctx, {
      subject: `Je afspraak van ${formatDate(b.date)} is geannuleerd`,
      preheader: `${b.packageName} voor ${b.plate}`,
      heading: 'Je afspraak is geannuleerd',
      intro:
        by === 'customer'
          ? `Hoi ${firstName(b.name)}, je afspraak van ${when(b)} is geannuleerd. Jammer! Je bent altijd welkom op een volgende wasdag.`
          : `Hoi ${firstName(b.name)}, helaas moeten we je afspraak van ${when(b)} annuleren.${message ? `\n\n${message}` : ''}\n\nOnze excuses voor het ongemak. Kies gerust een nieuwe tijd.`,
      button: { label: 'Nieuwe afspraak maken', url: ctx.estadioUrl },
      blocks: [{ type: 'details', title: 'Geannuleerde afspraak', rows: bookingRows(b, ctx.settings).filter(([k]) => k !== 'Locatie') }],
    });
  },
};

/** Short notifications for Detail2Go itself. */
function shopMail(to: string, b: EstadioBooking, ctx: MailContext, subject: string, intro: string): Mail {
  const content: EmailContent = {
    subject,
    preheader: `${b.name} · ${b.plate} · ${b.phone || b.email}`,
    heading: subject,
    intro,
    button: { label: 'Open de dagplanning', url: `${ctx.appUrl}/admin/estadio/dag/${b.dayId}` },
    blocks: [
      {
        type: 'details',
        rows: [
          ...bookingRows(b, ctx.settings).filter(([k]) => k !== 'Locatie'),
          ['Naam', b.name],
          ['Bedrijf', b.company || '-'],
          ['Telefoon', b.phone || '-'],
          ['E-mail', b.email || '-'],
          ['Opmerking', b.notes || '-'],
        ],
      },
    ],
  };
  const { html, text } = renderEmail(content, EMAIL.design, ctx.appUrl);
  return { to, subject, text, html, ...(b.email ? { replyTo: b.email } : {}) };
}

// --- Routes -----------------------------------------------------------------------------

export type EstadioDeps = {
  db: Db;
  config: Config;
  mailer: Mailer;
  notifyEmail: () => string | undefined;
  rateLimit: (limit: number, windowMs: number) => RequestHandler;
  audit: (req: Request, action: string, detail?: string) => void;
  clock?: Clock;
  /** Fetch used for the RDW lookup (tests). */
  fetch?: typeof fetch;
  /** Encrypts the Google Calendar key at rest. */
  cipher: Cipher;
  /** Fetch used for Google Calendar (tests). */
  googleFetch?: typeof fetch;
};

/** Google Calendar colours per package position, like the old Calendly: green, blue, yellow, then others. */
const EVENT_COLORS = ['10', '9', '5', '3', '6', '2', '4', '11'];

/** The calendar event for a booking: plate and name up front, everything needed on the day in the description. */
export function calendarEvent(b: EstadioBooking, settings: EstadioSettings, packages: EstadioPackage[], appUrl: string): CalendarEvent {
  const prefix = b.status === 'done' ? '✓ ' : b.status === 'no_show' ? '✗ Niet gekomen: ' : '';
  const index = packages.findIndex((p) => p.id === b.packageId);
  const at = (minutes: number) => ({ dateTime: `${b.date}T${formatTime(minutes)}:00`, timeZone: 'Europe/Amsterdam' });
  return {
    summary: `${prefix}${b.plate} · ${b.packageName.replace(/\s*\(.*\)$/, '')} · ${b.name}`,
    location: `${settings.locationName}, ${settings.address}`,
    description: `${[
      `${b.packageName} — ${formatEuro(b.price)} excl. btw`,
      [b.name, b.company].filter(Boolean).join(' · '),
      b.phone && `Tel: ${b.phone}`,
      b.email && `E-mail: ${b.email}`,
      b.vehicle && `Auto: ${b.vehicle}`,
      b.parking && `Staat op: ${b.parking}`,
      b.notes && `Opmerking: ${b.notes}`,
    ]
      .filter(Boolean)
      .join('\n')}\n\nDagplanning: ${appUrl}/admin/estadio/dag/${b.dayId}`,
    start: at(b.start),
    end: at(b.end),
    status: 'confirmed',
    ...(index >= 0 ? { colorId: EVENT_COLORS[index % EVENT_COLORS.length] } : {}),
    extendedProperties: { private: { estadioBooking: String(b.id) } },
  };
}

const route =
  (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  };

const PUBLIC_ID = /^[A-Za-z0-9_-]{20,40}$/;
const newPublicId = () => crypto.randomBytes(18).toString('base64url');

export function createEstadio(deps: EstadioDeps) {
  const { db, config, mailer } = deps;
  const clock = deps.clock ?? (() => new Date());
  const store = new EstadioStore(db);
  const rdwFetch = deps.fetch ?? fetch;
  // Vehicle details rarely change: remember lookups for a day, so a returning visitor costs RDW nothing.
  const vehicles = new Map<string, { info: VehicleInfo; at: number }>();

  async function lookupVehicle(plate: string): Promise<VehicleInfo> {
    const cached = vehicles.get(plate);
    if (cached && Date.now() - cached.at < 86_400_000) return cached.info;
    let rows: RdwRow[];
    try {
      const res = await rdwFetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${plate}&$select=merk,handelsbenaming,eerste_kleur,datum_eerste_toelating`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`RDW ${res.status}`);
      rows = (await res.json()) as RdwRow[];
    } catch (err) {
      console.error('[estadio] RDW:', err instanceof Error ? err.message : err);
      throw new EstadioError(502, 'De RDW is nu niet bereikbaar. Vul merk en model gerust zelf in.');
    }
    const info = Array.isArray(rows) && rows[0] ? describeVehicle(rows[0]) : ({ found: false } as const);
    if (vehicles.size > 2000) vehicles.clear();
    vehicles.set(plate, { info, at: Date.now() });
    return info;
  }

  const mailContext = (): MailContext => ({ settings: store.settings(), appUrl: config.appUrl, estadioUrl: config.estadioUrl });

  // --- Google Calendar: every booking mirrored in the shared calendar, in the background ---

  const googleFetch = deps.googleFetch ?? fetch;
  let client: { key: string; calendar: GoogleCalendar } | undefined;
  const calendar = () => {
    const setup = store.google(deps.cipher);
    if (!setup?.enabled) return undefined;
    const key = `${setup.account.client_email}|${setup.calendarId}`;
    if (client?.key !== key) client = { key, calendar: new GoogleCalendar(setup.account, setup.calendarId, googleFetch) };
    return client.calendar;
  };

  type EventRow = { booking_id: number; event_id: string | null; hash: string | null; error: string | null };
  const eventRow = (id: number) => db.prepare('SELECT * FROM estadio_calendar_events WHERE booking_id = ?').get(id) as EventRow | undefined;
  const saveEventRow = (id: number, eventId: string | null, hash: string | null, error: string | null) =>
    db
      .prepare(
        `INSERT INTO estadio_calendar_events (booking_id, event_id, hash, error, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(booking_id) DO UPDATE SET event_id = excluded.event_id, hash = excluded.hash, error = excluded.error, updated_at = excluded.updated_at`,
      )
      .run(id, eventId, hash, error);

  /** Brings one booking's event in line with the booking: create, update, or remove when cancelled. */
  async function syncEvent(id: number) {
    const cal = calendar();
    if (!cal) return;
    const b = store.booking(id);
    const row = eventRow(id);
    try {
      if (!b || b.status === 'cancelled') {
        if (row?.event_id) await cal.remove(row.event_id);
        if (row) db.prepare('DELETE FROM estadio_calendar_events WHERE booking_id = ?').run(id);
        return;
      }
      const event = calendarEvent(b, store.settings(), store.packages(), config.appUrl);
      const hash = sha256(JSON.stringify(event));
      if (row?.event_id && row.hash === hash && !row.error) return;
      let eventId = row?.event_id ?? null;
      if (!eventId || !(await cal.update(eventId, event))) eventId = await cal.insert(event);
      saveEventRow(id, eventId, hash, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[estadio] Google Agenda, afspraak ${id}:`, message);
      saveEventRow(id, row?.event_id ?? null, row?.hash ?? null, message.slice(0, 500));
    }
  }

  // One write at a time, in order, so a quick move-then-cancel can never end up as a stray event.
  const queue = new Set<number>();
  let running: Promise<void> | undefined;
  function queueSync(...ids: number[]) {
    if (!ids.length || !calendar()) return;
    ids.forEach((id) => queue.add(id));
    kick();
  }
  function kick() {
    if (running || !queue.size) return;
    running = (async () => {
      while (queue.size) {
        const [next] = queue;
        queue.delete(next);
        await syncEvent(next);
      }
    })().finally(() => {
      running = undefined;
      // Anything queued in the last moment.
      kick();
    });
  }
  async function calendarIdle() {
    while (running) await running;
  }

  /** Checks every booking from today on (and earlier failures), e.g. after connecting or when Google was down. */
  async function syncAll() {
    if (!calendar()) return;
    const today = localNow(clock()).date;
    const ids = db
      .prepare(
        `SELECT b.id FROM estadio_bookings b JOIN estadio_days d ON d.id = b.day_id
         LEFT JOIN estadio_calendar_events e ON e.booking_id = b.id
         WHERE d.date >= ? OR e.error IS NOT NULL`,
      )
      .all(today) as { id: number }[];
    queueSync(...ids.map((r) => r.id));
    await calendarIdle();
  }

  function googleStatus(): GoogleStatus {
    const setup = store.google(deps.cipher);
    const today = localNow(clock()).date;
    const rows = db
      .prepare(
        `SELECT e.event_id, e.error FROM estadio_bookings b JOIN estadio_days d ON d.id = b.day_id
         LEFT JOIN estadio_calendar_events e ON e.booking_id = b.id
         WHERE d.date >= ? AND b.status != 'cancelled'`,
      )
      .all(today) as { event_id: string | null; error: string | null }[];
    const lastError = (db.prepare('SELECT error FROM estadio_calendar_events WHERE error IS NOT NULL ORDER BY updated_at DESC LIMIT 1').get() as { error: string } | undefined)?.error;
    return {
      connected: Boolean(setup),
      enabled: Boolean(setup?.enabled),
      serviceEmail: setup?.account.client_email,
      calendarId: setup?.calendarId,
      calendarName: setup?.calendarName,
      synced: rows.filter((r) => r.event_id && !r.error).length,
      waiting: rows.filter((r) => !r.event_id && !r.error).length,
      failed: rows.filter((r) => r.error).length,
      lastError,
    };
  }

  async function notifyCustomer(b: EstadioBooking, build: (ctx: MailContext) => Mail) {
    if (b.email) await sendSafely(mailer, build(mailContext()));
  }
  async function notifyShop(b: EstadioBooking, subject: string, intro: string) {
    const to = deps.notifyEmail();
    if (to) await sendSafely(mailer, shopMail(to, b, mailContext(), subject, intro));
  }

  const insertBooking = db.prepare(
    `INSERT INTO estadio_bookings (public_id, day_id, start_min, end_min, package_id, package_name, price, name, email, phone, company, plate, vehicle, parking, notes, source)
     VALUES (@publicId, @dayId, @start, @end, @packageId, @packageName, @price, @name, @email, @phone, @company, @plate, @vehicle, @parking, @notes, @source)`,
  );

  /** Books in one transaction, so two people can never take the last spot at the same moment. */
  function book(input: z.infer<typeof bookingRequestSchema> | z.infer<typeof adminBookingSchema>, source: 'online' | 'admin') {
    return db.transaction(() => {
      const { day, pkg, end } = assertSlot(store, input, { clock, admin: source === 'admin', force: 'force' in input && input.force });
      const double = db
        .prepare(`SELECT 1 FROM estadio_bookings WHERE day_id = ? AND status != 'cancelled' AND REPLACE(plate, '-', '') = ?`)
        .get(day.id, input.plate.replace(/-/g, ''));
      if (double) throw new EstadioError(409, 'Voor dit kenteken staat op deze dag al een afspraak. Wil je iets wijzigen? Gebruik de link in je bevestigingsmail.', { plate: 'Voor dit kenteken staat op deze dag al een afspraak' });
      const { lastInsertRowid } = insertBooking.run({
        publicId: newPublicId(),
        dayId: day.id,
        start: input.start,
        end,
        packageId: pkg.id,
        packageName: `${pkg.name}${pkg.scope ? ` (${pkg.scope})` : ''}`,
        price: pkg.price,
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        plate: input.plate,
        vehicle: input.vehicle,
        parking: input.parking,
        notes: input.notes,
        source,
      });
      return store.booking(Number(lastInsertRowid))!;
    })();
  }

  function move(b: EstadioBooking, input: z.infer<typeof rescheduleSchema>, options: { admin?: boolean; force?: boolean } = {}) {
    return db.transaction(() => {
      const { day, pkg, end } = assertSlot(store, input, { clock, exceptId: b.id, ...options });
      db.prepare(
        `UPDATE estadio_bookings SET day_id = ?, start_min = ?, end_min = ?, package_id = ?, package_name = ?, price = ?, reminder_sent_at = NULL, updated_at = datetime('now') WHERE id = ?`,
      ).run(day.id, input.start, end, pkg.id, `${pkg.name}${pkg.scope ? ` (${pkg.scope})` : ''}`, pkg.price, b.id);
      return store.booking(b.id)!;
    })();
  }

  function cancel(b: EstadioBooking, by: 'customer' | 'admin') {
    db.prepare(`UPDATE estadio_bookings SET status = 'cancelled', cancelled_by = ?, cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(by, b.id);
    return store.booking(b.id)!;
  }

  /** The customer's own booking, found by the unguessable id in their link. */
  function ownBooking(req: Request) {
    const id = String(req.params.publicId);
    const b = PUBLIC_ID.test(id) ? store.bookingByPublicId(id) : undefined;
    if (!b) throw new EstadioError(404, 'Deze afspraak bestaat niet. Controleer de link in je bevestigingsmail.');
    return b;
  }

  function assertChangeable(b: EstadioBooking) {
    if (b.status !== 'booked') throw new EstadioError(409, 'Deze afspraak kan niet meer worden gewijzigd.');
    if (nowMoment(clock) >= changeDeadline(b, store.settings())) {
      throw new EstadioError(409, `Online wijzigen kan tot ${store.settings().cancelHours} uur van tevoren. Bel of app ons op ${SITE.phone}.`);
    }
  }

  // --- Public (the booking page) ---

  function publicRoutes(api: Router) {
    api.get('/estadio', (req, res) => {
      res.set('Cache-Control', 'no-store');
      const moving = typeof req.query.boeking === 'string' && PUBLIC_ID.test(req.query.boeking) ? store.bookingByPublicId(req.query.boeking) : undefined;
      res.json(publicInfo(store, clock, config.appUrl, moving?.status === 'booked' ? moving.id : undefined));
    });

    /** Brand, model and colour for a Dutch plate, from the RDW's open data (no personal data involved). */
    api.get(
      '/estadio/voertuig/:plate',
      deps.rateLimit(60, 10 * 60_000),
      route(async (req, res) => {
        const plate = String(req.params.plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!/^[A-Z0-9]{6}$/.test(plate)) throw new EstadioError(400, 'Vul een Nederlands kenteken in.');
        res.set('Cache-Control', 'private, max-age=86400');
        res.json(await lookupVehicle(plate));
      }),
    );

    api.post(
      '/estadio/bookings',
      deps.rateLimit(10, 10 * 60_000),
      route(async (req, res) => {
        const input = parse(bookingRequestSchema, req.body);
        const b = book(input, 'online');
        queueSync(b.id);
        await notifyCustomer(b, (ctx) => estadioMails.confirmed(b, ctx));
        await notifyShop(b, `Nieuwe boeking Estadio: ${formatDate(b.date, { short: true })} ${formatTime(b.start)}`, `${b.name} heeft een ${b.packageName} geboekt.`);
        res.status(201).json(publicBooking(b, store.settings(), clock));
      }),
    );

    api.get(
      '/estadio/bookings/:publicId',
      deps.rateLimit(120, 10 * 60_000),
      route((req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(publicBooking(ownBooking(req), store.settings(), clock));
      }),
    );

    api.get(
      '/estadio/bookings/:publicId/agenda.ics',
      deps.rateLimit(120, 10 * 60_000),
      route((req, res) => {
        const b = ownBooking(req);
        res
          .type('text/calendar; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="detail2go-${b.date}.ics"`)
          .send(calendarFile(b, store.settings(), `${config.estadioUrl}/boeking/${b.publicId}`));
      }),
    );

    api.post(
      '/estadio/bookings/:publicId/cancel',
      deps.rateLimit(20, 10 * 60_000),
      route(async (req, res) => {
        const b = ownBooking(req);
        assertChangeable(b);
        const cancelled = cancel(b, 'customer');
        queueSync(b.id);
        await notifyCustomer(cancelled, (ctx) => estadioMails.cancelled(cancelled, ctx, 'customer'));
        await notifyShop(cancelled, `Geannuleerd: Estadio ${formatDate(b.date, { short: true })} ${formatTime(b.start)}`, `${b.name} heeft de afspraak geannuleerd. De tijd is weer vrij.`);
        res.json(publicBooking(cancelled, store.settings(), clock));
      }),
    );

    api.post(
      '/estadio/bookings/:publicId/reschedule',
      deps.rateLimit(20, 10 * 60_000),
      route(async (req, res) => {
        const b = ownBooking(req);
        assertChangeable(b);
        const moved = move(b, parse(rescheduleSchema, req.body));
        queueSync(b.id);
        await notifyCustomer(moved, (ctx) => estadioMails.moved(moved, ctx));
        await notifyShop(
          moved,
          `Verplaatst: Estadio ${formatDate(moved.date, { short: true })} ${formatTime(moved.start)}`,
          `${moved.name} heeft de afspraak verplaatst van ${when(b)} (${b.packageName}) naar ${when(moved)} (${moved.packageName}).`,
        );
        res.json(publicBooking(moved, store.settings(), clock));
      }),
    );
  }

  // --- Admin ---

  const bookingFor = (req: Request) => {
    const b = store.booking(Number(req.params.id));
    if (!b) throw new EstadioError(404, 'Deze afspraak bestaat niet.');
    return b;
  };
  const dayFor = (req: Request) => {
    const day = store.day(Number(req.params.id));
    if (!day) throw new EstadioError(404, 'Deze dag bestaat niet.');
    return day;
  };
  const dayView = (day: EstadioDay) => {
    const packages = store.packages();
    const taken = store.taken(day.id);
    return {
      day,
      bookings: store.bookingsForDay(day.id),
      packages,
      free: Object.fromEntries(packages.map((p) => [p.id, freeStarts(day, taken, p.duration)])),
      estadioUrl: config.estadioUrl,
    };
  };
  const dayRow = (d: z.infer<typeof daySchema>) => ({
    start: d.start,
    end: d.end,
    capacity: d.capacity,
    interval: d.interval,
    breakStart: d.breakStart,
    breakEnd: d.breakEnd,
    open: d.open ? 1 : 0,
    note: d.note,
  });

  function adminRoutes(admin: Router) {
    admin.get('/estadio/google', (_req, res) => {
      res.json(googleStatus());
    });

    /** Connects (or changes) the shared calendar; tests the connection with a real write before saving. */
    admin.put(
      '/estadio/google',
      route(async (req, res) => {
        const input = parse(
          z.object({
            serviceAccount: z.string().max(10_000).optional(),
            calendarId: z.string().trim().min(3, 'Vul de Agenda-ID in').max(300),
            enabled: z.boolean().default(true),
          }),
          req.body,
        );
        const current = store.google(deps.cipher);
        let account: ServiceAccount;
        try {
          account = input.serviceAccount?.trim() ? parseServiceAccount(input.serviceAccount) : current?.account ?? parseServiceAccount('');
        } catch (err) {
          throw new EstadioError(400, (err as Error).message, { serviceAccount: (err as Error).message });
        }
        let calendarName = current?.calendarId === input.calendarId ? current.calendarName : input.calendarId;
        if (input.enabled) {
          try {
            calendarName = await new GoogleCalendar(account, input.calendarId, googleFetch).check();
          } catch (err) {
            if (err instanceof CalendarError) throw new EstadioError(400, err.message);
            throw new EstadioError(502, 'Google is niet bereikbaar. Probeer het zo opnieuw.');
          }
        }
        store.saveGoogle(deps.cipher, { account, calendarId: input.calendarId, calendarName, enabled: input.enabled });
        deps.audit(req, 'estadio_google_saved', `${input.calendarId} (${input.enabled ? 'aan' : 'uit'})`);
        // Bookings made before the connection go into the calendar too.
        void syncAll();
        res.json(googleStatus());
      }),
    );

    admin.delete('/estadio/google', (req, res) => {
      store.saveGoogle(deps.cipher, undefined);
      client = undefined;
      deps.audit(req, 'estadio_google_removed');
      res.json(googleStatus());
    });

    admin.post(
      '/estadio/google/sync',
      route(async (_req, res) => {
        db.prepare('UPDATE estadio_calendar_events SET hash = NULL WHERE error IS NOT NULL').run();
        await syncAll();
        res.json(googleStatus());
      }),
    );

    admin.get('/estadio', (_req, res) => {
      const totals = store.dayTotals();
      const packages = store.packages();
      res.json({
        settings: store.settings(),
        packages,
        estadioUrl: config.estadioUrl,
        today: localNow(clock()).date,
        days: store.days().map((d) => {
          const taken = store.taken(d.id);
          return {
            ...d,
            booked: totals[d.id]?.booked ?? 0,
            revenue: totals[d.id]?.revenue ?? 0,
            // Free start times for the shortest visible package: "is the day full?"
            free: Math.min(...packages.filter((p) => p.visible).map((p) => freeStarts(d, taken, p.duration).length)),
          };
        }),
      });
    });

    admin.put(
      '/estadio/settings',
      route((req, res) => {
        const settings = parse(settingsSchema, req.body);
        store.saveSettings(settings);
        deps.audit(req, 'estadio_settings_saved');
        // The location is in every event.
        void syncAll();
        res.json(store.settings());
      }),
    );

    admin.put(
      '/estadio/packages',
      route((req, res) => {
        const packages = parse(packagesSchema, req.body);
        if (!packages.some((p) => p.visible)) throw new EstadioError(400, 'Zet minstens één pakket aan.');
        store.savePackages(packages);
        deps.audit(req, 'estadio_packages_saved');
        res.json(store.packages());
      }),
    );

    admin.post(
      '/estadio/days',
      route((req, res) => {
        const { dates, day } = parse(newDaysSchema, req.body);
        const today = localNow(clock()).date;
        const unique = [...new Set(dates)].sort();
        if (unique.some((d) => d < today)) throw new EstadioError(400, 'Kies datums vanaf vandaag.');
        const existing = unique.filter((d) => db.prepare('SELECT 1 FROM estadio_days WHERE date = ?').get(d));
        if (existing.length) throw new EstadioError(409, `Er staat al een wasdag op ${existing.map((d) => formatDate(d)).join(', ')}.`);
        const insert = db.prepare(
          `INSERT INTO estadio_days (date, start_min, end_min, capacity, interval_min, break_start_min, break_end_min, open, note)
           VALUES (@date, @start, @end, @capacity, @interval, @breakStart, @breakEnd, @open, @note)`,
        );
        db.transaction(() => unique.forEach((date) => insert.run({ date, ...dayRow(day) })))();
        deps.audit(req, 'estadio_days_added', unique.join(', '));
        res.status(201).json({ ok: true });
      }),
    );

    admin.get(
      '/estadio/days/:id',
      route((req, res) => {
        res.json(dayView(dayFor(req)));
      }),
    );

    admin.put(
      '/estadio/days/:id',
      route((req, res) => {
        const current = dayFor(req);
        const day = parse(daySchema, req.body);
        db.transaction(() => {
          assertDayFits(store, current.id, day);
          db.prepare(
            `UPDATE estadio_days SET start_min = @start, end_min = @end, capacity = @capacity, interval_min = @interval,
             break_start_min = @breakStart, break_end_min = @breakEnd, open = @open, note = @note WHERE id = @id`,
          ).run({ id: current.id, ...dayRow(day) });
        })();
        deps.audit(req, 'estadio_day_saved', current.date);
        res.json(dayView(store.day(current.id)!));
      }),
    );

    admin.delete(
      '/estadio/days/:id',
      route((req, res) => {
        const day = dayFor(req);
        const active = store.bookingsForDay(day.id).filter((b) => b.status === 'booked').length;
        if (active) throw new EstadioError(409, `Er ${active === 1 ? 'staat nog 1 afspraak' : `staan nog ${active} afspraken`} op deze dag. Annuleer de dag eerst; de klanten krijgen dan een mail.`);
        db.prepare('DELETE FROM estadio_days WHERE id = ?').run(day.id);
        deps.audit(req, 'estadio_day_deleted', day.date);
        res.json({ ok: true });
      }),
    );

    /** Cancels every booking on the day (each customer gets a mail) and closes the day. */
    admin.post(
      '/estadio/days/:id/cancel',
      route(async (req, res) => {
        const day = dayFor(req);
        const message = parse(z.object({ message: z.string().trim().max(1000).default('') }), req.body ?? {}).message;
        const bookings = store.bookingsForDay(day.id).filter((b) => b.status === 'booked');
        db.transaction(() => {
          bookings.forEach((b) => cancel(b, 'admin'));
          db.prepare('UPDATE estadio_days SET open = 0 WHERE id = ?').run(day.id);
        })();
        queueSync(...bookings.map((b) => b.id));
        for (const b of bookings) await notifyCustomer(b, (ctx) => estadioMails.cancelled(b, ctx, 'admin', message));
        deps.audit(req, 'estadio_day_cancelled', `${day.date} (${bookings.length} afspraken)`);
        res.json(dayView(store.day(day.id)!));
      }),
    );

    admin.get(
      '/estadio/days/:id/export.csv',
      route((req, res) => {
        const day = dayFor(req);
        const cell = (v: string | number) => {
          const s = String(v ?? '');
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = ['Datum', 'Tijd', 'Status', 'Pakket', 'Prijs excl. btw', 'Naam', 'Bedrijf', 'E-mail', 'Telefoon', 'Kenteken', 'Auto', 'Staat op', 'Opmerking'];
        const rows = store
          .bookingsForDay(day.id)
          .map((b) => [
            b.date,
            `${formatTime(b.start)}-${formatTime(b.end)}`,
            BOOKING_STATUS_LABEL[b.status],
            b.packageName,
            (b.price / 100).toFixed(2).replace('.', ','),
            b.name,
            b.company,
            b.email,
            b.phone,
            b.plate,
            b.vehicle,
            b.parking,
            b.notes,
          ]);
        res
          .type('text/csv; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="estadio-${day.date}.csv"`)
          .send('\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n'));
      }),
    );

    admin.post(
      '/estadio/days/:id/bookings',
      route(async (req, res) => {
        const day = dayFor(req);
        const input = parse(adminBookingSchema, { ...req.body, dayId: day.id });
        const b = book(input, 'admin');
        queueSync(b.id);
        await notifyCustomer(b, (ctx) => estadioMails.confirmed(b, ctx));
        deps.audit(req, 'estadio_booking_added', `${b.name} (${b.plate}) ${b.date} ${formatTime(b.start)}`);
        res.status(201).json(dayView(day));
      }),
    );

    admin.put(
      '/estadio/bookings/:id',
      route((req, res) => {
        const b = bookingFor(req);
        const details = parse(adminBookingSchema.pick({ name: true, email: true, phone: true, company: true, plate: true, vehicle: true, parking: true, notes: true }), req.body);
        db.prepare(
          `UPDATE estadio_bookings SET name = @name, email = @email, phone = @phone, company = @company, plate = @plate, vehicle = @vehicle,
           parking = @parking, notes = @notes, updated_at = datetime('now') WHERE id = @id`,
        ).run({ ...details, id: b.id });
        queueSync(b.id);
        res.json(dayView(store.day(b.dayId)!));
      }),
    );

    admin.post(
      '/estadio/bookings/:id/status',
      route(async (req, res) => {
        const b = bookingFor(req);
        const { status, notify, message } = parse(
          z.object({ status: z.enum(BOOKING_STATUSES), notify: z.boolean().default(false), message: z.string().trim().max(1000).default('') }),
          req.body,
        );
        if (status === 'cancelled') {
          if (b.status !== 'cancelled') {
            const cancelled = cancel(b, 'admin');
            if (notify) await notifyCustomer(cancelled, (ctx) => estadioMails.cancelled(cancelled, ctx, 'admin', message));
          }
        } else {
          // Back from cancelled: only when the spot is still free.
          if (b.status === 'cancelled') assertSlot(store, b, { clock, exceptId: b.id, admin: true });
          db.prepare(`UPDATE estadio_bookings SET status = ?, cancelled_by = NULL, cancelled_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(status, b.id);
        }
        queueSync(b.id);
        deps.audit(req, 'estadio_booking_status', `${b.name} (${b.plate}): ${BOOKING_STATUS_LABEL[status]}`);
        res.json(dayView(store.day(b.dayId)!));
      }),
    );

    admin.post(
      '/estadio/bookings/:id/move',
      route(async (req, res) => {
        const b = bookingFor(req);
        const input = parse(rescheduleSchema.extend({ notify: z.boolean().default(true), force: z.boolean().default(false) }), req.body);
        if (b.status === 'cancelled') throw new EstadioError(409, 'Een geannuleerde afspraak kan niet worden verplaatst.');
        const moved = move(b, input, { admin: true, force: input.force });
        queueSync(b.id);
        if (input.notify) await notifyCustomer(moved, (ctx) => estadioMails.moved(moved, ctx));
        deps.audit(req, 'estadio_booking_moved', `${b.name} (${b.plate}) naar ${moved.date} ${formatTime(moved.start)}`);
        res.json(dayView(store.day(b.dayId)!));
      }),
    );
  }

  /** Sends tomorrow's reminders, from 10:00 on the day before. Safe to call often. */
  async function sendReminders() {
    const settings = store.settings();
    if (!settings.reminders) return 0;
    const now = localNow(clock());
    if (now.minutes < 10 * 60) return 0;
    const tomorrow = new Date((dayNumber(now.date) + 1) * 86_400_000).toISOString().slice(0, 10);
    // Bookings made in the last few hours just got their confirmation; a reminder on top would be noise.
    const rows = db
      .prepare(
        `${BOOKING_SELECT} WHERE d.date = ? AND b.status = 'booked' AND b.email != '' AND b.reminder_sent_at IS NULL AND b.created_at <= datetime(?, '-3 hours')`,
      )
      .all(tomorrow, clock().toISOString().slice(0, 19).replace('T', ' ')) as BookingRow[];
    for (const row of rows) {
      const b = toBooking(row);
      // Claim it first, so a slow mail server can never lead to two reminders.
      const claimed = db.prepare(`UPDATE estadio_bookings SET reminder_sent_at = datetime('now') WHERE id = ? AND reminder_sent_at IS NULL`).run(b.id).changes;
      if (claimed) await sendSafely(mailer, estadioMails.reminder(b, mailContext()));
    }
    return rows.length;
  }

  return { store, publicRoutes, adminRoutes, sendReminders, syncAll, calendarIdle };
}

