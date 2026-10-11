// Dutch number, time and label formatting for the statistics screens.
import {
  CHANNEL_LABELS,
  COUNTRY_NAMES,
  DEVICE_LABELS,
  EVENT_INFO,
  LANGUAGE_NAMES,
  type Bucket,
  type Channel,
  type Device,
  type EventName,
  type FilterKey,
} from '../../../shared/analytics';
import { getProduct } from '../../../shared/catalog';
import { formatPrice } from '../../../shared/pricing';
import { getService } from '../../../shared/services';

const whole = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('nl-NL', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtNumber = (n: number) => (Math.abs(n) >= 100_000 ? compact.format(n) : whole.format(n));
export const fmtPercent = (x: number, digits = 0) => `${(x * 100).toFixed(digits).replace('.', ',')}%`;
export const fmtMoney = (cents: number) => formatPrice(cents);

/** "45 s", "2 m 05 s", "1 u 12 m". */
export function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} m ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} u ${String(m % 60).padStart(2, '0')} m`;
}

export const fmtSeconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

const dayShort = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
const dayLong = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const dateTime = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });

export const fmtDateTime = (ts: number) => dateTime.format(ts);
export const fmtTime = (ts: number) => timeOnly.format(ts);

/** Axis label (short) or tooltip label (long) for a chart bucket. */
export function bucketLabel(start: number, bucket: Bucket, long = false) {
  if (bucket === 'hour') return long ? `${dayShort.format(start)}, ${timeOnly.format(start)}` : timeOnly.format(start);
  if (bucket === 'week') return long ? `week van ${dayShort.format(start)}` : dayShort.format(start);
  return long ? dayLong.format(start) : dayShort.format(start);
}

/** A page's own title without the site name, or its address. */
export function pageName(path: string, title?: string | null) {
  if (path === '/') return 'Homepage';
  const clean = title?.split(' | ')[0]?.trim();
  return clean || path;
}

export function eventLabel(name: EventName) {
  return EVENT_INFO[name]?.label ?? name;
}

/** Makes an event's detail readable: product and service ids become their names. */
export function eventDetail(name: EventName, label: string | null) {
  if (!label) return '';
  if (name === 'add_to_cart') return getProduct(label)?.name ?? label;
  if (name === 'booking') return getService(label)?.name ?? label;
  if (name === 'purchase') return `Bestelling ${label}`;
  return label;
}

export function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}

export function languageName(code: string) {
  return LANGUAGE_NAMES[code] ?? (code === 'xx' ? 'Onbekend' : code.toUpperCase());
}

/** Human label for a filter value, e.g. channel "search" → "Zoekmachines". */
export function valueLabel(key: FilterKey, value: string, titles?: Map<string, string | null>) {
  switch (key) {
    case 'channel':
      return CHANNEL_LABELS[value as Channel] ?? value;
    case 'device':
      return DEVICE_LABELS[value as Device] ?? value;
    case 'country':
      return countryName(value);
    case 'language':
      return languageName(value);
    case 'event':
      return eventLabel(value as EventName);
    case 'page':
    case 'entry':
    case 'exit':
      return pageName(value, titles?.get(value));
    default:
      return value;
  }
}
