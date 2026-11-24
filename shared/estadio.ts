// Estadio: bookings for the monthly wash days at Estadio Parkweg, served on its own subdomain
// (estadio.detail2go.nl). Shared by the server, the Estadio booking app and the admin.
// --- Packages and settings ------------------------------------------------------------

export type EstadioPackage = {
  /** Stable id, also used in links: ?pakket=premium */
  id: string;
  name: string;
  /** What it covers, shown as a label: "Interieur & exterieur". */
  scope: string;
  /** Price in cents, excluding VAT. */
  price: number;
  /** Minutes the car is blocked in the planning. */
  duration: number;
  intro: string;
  groups: { title: string; items: string[] }[];
  /** Small label on the card, e.g. "Meest compleet". */
  badge: string;
  visible: boolean;
};

export type EstadioSettings = {
  /** Off: the page shows a notice and nothing can be booked. */
  enabled: boolean;
  headline: string;
  intro: string;
  locationName: string;
  address: string;
  /** Practical information shown before booking and in the confirmation mail. */
  practical: string[];
  /** How payment works, shown under the prices. */
  paymentNote: string;
  /** Customers can cancel or move their appointment until this many hours before it starts. */
  cancelHours: number;
  /** Booking closes this many hours before a time slot starts. */
  closeHours: number;
  /** A reminder mail the day before. */
  reminders: boolean;
};

export const DEFAULT_PACKAGES: EstadioPackage[] = [
  {
    id: 'opfris',
    name: 'Opfris Pakket',
    scope: 'Interieur & exterieur',
    price: 9000,
    duration: 60,
    intro: 'Een frisse boost voor je auto, terwijl jij aan het werk bent.',
    groups: [
      { title: 'Exterieur', items: ['Volledige exterieurreiniging'] },
      { title: 'Interieur (basis)', items: ['Interieur stofzuigen, inclusief matten en onder de matten', 'Ruiten aan binnen- en buitenzijde schoon'] },
    ],
    badge: '',
    visible: true,
  },
  {
    id: 'interieur',
    name: 'Interieur Pakket',
    scope: 'Alleen interieur',
    price: 11000,
    duration: 90,
    intro: 'Dezelfde interieurbehandeling als het Premium Pakket, maar dan zonder het exterieur.',
    groups: [
      {
        title: 'Interieur',
        items: ['Grondige reiniging van het volledige interieur', 'Verwijderen van vlekken en vuil', 'Afnemen van alle oppervlakken en knoppen'],
      },
    ],
    badge: '',
    visible: true,
  },
  {
    id: 'premium',
    name: 'Premium Pakket',
    scope: 'Interieur & exterieur',
    price: 16000,
    duration: 120,
    intro: 'Laat je auto weer stralen: een volledige reiniging van zowel het interieur als het exterieur.',
    groups: [
      { title: 'Interieur', items: ['Alle knopjes, naden en vlekken zorgvuldig schoongemaakt'] },
      { title: 'Exterieur', items: ['Insecten, vuil en aanslag professioneel verwijderd'] },
    ],
    badge: 'Meest compleet',
    visible: true,
  },
];

export const DEFAULT_SETTINGS: EstadioSettings = {
  enabled: true,
  headline: 'Je auto schoon, terwijl jij werkt.',
  intro:
    'Eén keer per maand staat Detail2Go op het terrein van Estadio Parkweg. Kies je pakket en een tijd, parkeer je auto zoals altijd en wij doen de rest.',
  locationName: 'Estadio Parkweg',
  address: 'Parkweg 102, 7545 MV Enschede',
  practical: [
    'Parkeer je auto zoals altijd op het terrein van Estadio Parkweg.',
    'Voor interieurbehandelingen hebben we je autosleutel nodig. We stemmen op de dag zelf met je af waar we hem ophalen en terugbrengen.',
    'De tijden zijn een indicatie en kunnen iets uitlopen.',
  ],
  paymentNote: 'Alle prijzen zijn exclusief btw.',
  cancelHours: 24,
  closeHours: 1,
  reminders: true,
};

// --- Days, bookings -------------------------------------------------------------------

export type EstadioDay = {
  id: number;
  /** YYYY-MM-DD, local date in the Netherlands. */
  date: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** Cars that can be worked on at the same time. */
  capacity: number;
  /** Minutes between possible start times. */
  interval: number;
  breakStart: number | null;
  breakEnd: number | null;
  /** Closed days are hidden from the booking page. */
  open: boolean;
  note: string;
};

export const BOOKING_STATUSES = ['booked', 'done', 'no_show', 'cancelled'] as const;
export type EstadioBookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<EstadioBookingStatus, string> = {
  booked: 'Gepland',
  done: 'Klaar',
  no_show: 'Niet gekomen',
  cancelled: 'Geannuleerd',
};

/** Bookings that occupy a spot in the planning. */
export const occupies = (status: EstadioBookingStatus) => status !== 'cancelled';

/** A booking as the admin sees it. */
export type EstadioBooking = {
  id: number;
  publicId: string;
  dayId: number;
  date: string;
  start: number;
  end: number;
  packageId: string;
  packageName: string;
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
  cancelledBy: 'customer' | 'admin' | null;
  createdAt: string;
};

/** What the customer sees on their own booking page. */
export type PublicEstadioBooking = Pick<
  EstadioBooking,
  'publicId' | 'date' | 'start' | 'end' | 'packageId' | 'packageName' | 'price' | 'name' | 'email' | 'phone' | 'company' | 'plate' | 'vehicle' | 'parking' | 'notes'
> & {
  status: EstadioBookingStatus;
  /** Can still be cancelled or moved online. */
  changeable: boolean;
  /** Last moment to change online, "maandag 23 november, 09:00". */
  changeDeadline: string;
};

/** A day on the booking page: start times still free, per package. */
export type PublicEstadioDay = {
  id: number;
  date: string;
  start: number;
  end: number;
  note: string;
  slots: Record<string, number[]>;
};

export type EstadioPublicInfo = {
  settings: EstadioSettings;
  packages: EstadioPackage[];
  days: PublicEstadioDay[];
  /** detail2go.nl, for links to the main site (privacy, terms). */
  siteUrl: string;
};

// --- Time -----------------------------------------------------------------------------

export const TIME_ZONE = 'Europe/Amsterdam';

/** 540 → "09:00" */
export function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "09:00" → 540 */
export function parseTime(text: string): number | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 90 → "1,5 uur", 60 → "1 uur", 45 → "45 min" */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace('.', ',')} uur`;
}

/** 9000 → "€ 90", 9950 → "€ 99,50" */
export function formatEuro(cents: number) {
  const euros = cents / 100;
  return `€ ${Number.isInteger(euros) ? euros : euros.toFixed(2).replace('.', ',')}`;
}

const dateFromIso = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** "2026-11-24" → "dinsdag 24 november" (or with year when asked). */
export function formatDate(date: string, options: { year?: boolean; short?: boolean } = {}) {
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'UTC',
    weekday: options.short ? 'short' : 'long',
    day: 'numeric',
    month: options.short ? 'short' : 'long',
    ...(options.year ? { year: 'numeric' } : {}),
  })
    .format(dateFromIso(date))
    .replace(/\./g, '');
}

/** Days since 1970-01-01 for a YYYY-MM-DD date; lets us compare dates and times without time zones. */
export function dayNumber(date: string) {
  return Math.round(dateFromIso(date).getTime() / 86_400_000 - 0.5);
}

/** Today's date and the minutes after midnight in the Netherlands. */
export function localNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Minutes on a shared scale (date + time in the Netherlands), for "is this before that". */
export const moment = (date: string, minutes: number) => dayNumber(date) * 1440 + minutes;

/** The UTC instant of a date and time in the Netherlands (for calendar files and links). */
export function toUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  // The offset of the Netherlands at that moment (+60 in winter, +120 in summer).
  const local = localNow(new Date(guess));
  const offset = moment(local.date, local.minutes) - moment(date, minutes);
  return new Date(guess - offset * 60_000);
}

/** "20261124T080000Z", the format of calendar files and Google Calendar links. */
export const calendarStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// --- Availability ---------------------------------------------------------------------

type Occupied = { start: number; end: number };

/**
 * Start times on a day where a job of `duration` minutes still fits: inside opening hours, not across the break,
 * and never more cars at once than the day's capacity. `notBefore` (minutes on the `moment` scale) hides times
 * that are too close to now.
 */
export function freeStarts(day: Pick<EstadioDay, 'date' | 'start' | 'end' | 'capacity' | 'interval' | 'breakStart' | 'breakEnd'>, taken: Occupied[], duration: number, notBefore = -Infinity): number[] {
  const out: number[] = [];
  const step = Math.max(5, day.interval);
  for (let t = day.start; t + duration <= day.end; t += step) {
    const end = t + duration;
    if (moment(day.date, t) < notBefore) continue;
    if (day.breakStart != null && day.breakEnd != null && t < day.breakEnd && end > day.breakStart) continue;
    if (maxOverlap(taken, t, end) < day.capacity) out.push(t);
  }
  return out;
}

/** The highest number of bookings running at the same time within [start, end). */
export function maxOverlap(taken: Occupied[], start: number, end: number) {
  const inside = taken.filter((b) => b.start < end && b.end > start);
  // The count can only rise where a booking starts, so check the window's start and every start inside it.
  const points = [start, ...inside.map((b) => b.start).filter((s) => s > start)];
  return Math.max(0, ...points.map((p) => inside.filter((b) => b.start <= p && b.end > p).length));
}

/** True when booking [start, start+duration) on this day fits the opening hours, break and capacity. */
export function fits(day: Parameters<typeof freeStarts>[0], taken: Occupied[], start: number, duration: number) {
  return freeStarts(day, taken, duration).includes(start);
}
