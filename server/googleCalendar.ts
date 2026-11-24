// A small Google Calendar client for one shared calendar, signed in as a Google service account (a "robot"
// account the calendar is shared with). Uses only node:crypto and fetch; no Google SDK.
import crypto from 'node:crypto';

export type ServiceAccount = { client_email: string; private_key: string };

/** A Google event as we write it (see the Calendar API "Events" resource). */
export type CalendarEvent = {
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  /** "confirmed" also brings back an event someone deleted by hand while the booking still stands. */
  status?: 'confirmed';
  extendedProperties?: { private: Record<string, string> };
};

/** A Google error with a message that tells the admin what to do. */
export class CalendarError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Reads the JSON key file downloaded from Google Cloud; throws a Dutch message when it isn't one. */
export function parseServiceAccount(json: string): ServiceAccount {
  let data: Partial<ServiceAccount> & { type?: string };
  try {
    data = JSON.parse(json);
  } catch {
    throw new CalendarError('Dit is geen geldig JSON-bestand. Plak de volledige inhoud van het gedownloade sleutelbestand.', 400);
  }
  if (data.type !== 'service_account' || !data.client_email?.endsWith('.gserviceaccount.com') || !data.private_key?.includes('PRIVATE KEY')) {
    throw new CalendarError('Dit lijkt geen sleutel van een service-account. Kies bij het service-account: Sleutels → Sleutel toevoegen → JSON.', 400);
  }
  return { client_email: data.client_email, private_key: data.private_key };
}

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export class GoogleCalendar {
  private token?: { value: string; expires: number };

  constructor(
    private account: ServiceAccount,
    private calendarId: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  /** An access token for the service account (valid an hour, reused until shortly before it expires). */
  private async accessToken() {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(
      JSON.stringify({ iss: this.account.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }),
    )}`;
    let signature: string;
    try {
      signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(this.account.private_key, 'base64url');
    } catch {
      throw new CalendarError('De sleutel in het JSON-bestand is ongeldig. Download een nieuwe sleutel.', 400);
    }
    const res = await this.fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !data.access_token) {
      throw new CalendarError(
        data.error === 'invalid_grant'
          ? 'Google accepteert deze sleutel niet (meer). Maak bij het service-account een nieuwe JSON-sleutel aan.'
          : `Inloggen bij Google lukt niet: ${data.error_description ?? data.error ?? res.status}`,
        res.status || 502,
      );
    }
    this.token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await this.fetchFn(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 204) return null;
    const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; errors?: { reason?: string }[] } };
    if (!res.ok) throw new CalendarError(this.explain(res.status, data.error?.message ?? '', data.error?.errors?.[0]?.reason ?? ''), res.status);
    return data;
  }

  /** Google's English errors, turned into what the admin has to do. */
  private explain(status: number, message: string, reason: string) {
    const who = this.account.client_email;
    if (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(message)) {
      return 'De Google Calendar API staat nog uit in je Google Cloud-project. Zet hem aan en probeer het over een paar minuten opnieuw.';
    }
    if (status === 404) return `Agenda niet gevonden. Klopt de Agenda-ID, en heb je de agenda gedeeld met ${who}?`;
    if (status === 403 && /writer|access|forbidden/i.test(`${reason} ${message}`)) {
      return `Het service-account mag nog geen afspraken maken. Deel de agenda met ${who} met de rechten ‘Wijzigingen aanbrengen in afspraken’.`;
    }
    return `Google gaf een fout (${status}): ${message || reason || 'onbekend'}`;
  }

  /** The calendar's name; fails when the account can't see the calendar. */
  async name(): Promise<string> {
    const data = await this.request<{ summary?: string }>('GET', '/events?maxResults=1');
    return data?.summary ?? this.calendarId;
  }

  async insert(event: CalendarEvent): Promise<string> {
    const data = await this.request<{ id: string }>('POST', '/events', event);
    return data!.id;
  }

  /** Updates an event; returns false when it no longer exists (deleted in the calendar by hand). */
  async update(id: string, event: CalendarEvent): Promise<boolean> {
    try {
      await this.request('PUT', `/events/${encodeURIComponent(id)}`, event);
      return true;
    } catch (err) {
      if (err instanceof CalendarError && (err.status === 404 || err.status === 410)) return false;
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.request('DELETE', `/events/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof CalendarError && (err.status === 404 || err.status === 410)) return;
      throw err;
    }
  }

  /** Proves the account can write: adds a short test event and removes it again. */
  async check(): Promise<string> {
    const calendar = await this.name();
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const id = await this.insert({
      summary: 'Test Detail2Go (wordt direct verwijderd)',
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: start, timeZone: 'UTC' },
    });
    await this.remove(id);
    return calendar;
  }
}
