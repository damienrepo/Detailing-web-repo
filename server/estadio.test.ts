import crypto from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { freeStarts, localNow, maxOverlap, toUtc, type EstadioPublicInfo } from '../shared/estadio';
import { describeVehicle } from './estadio';
import { setup, signedIn } from './testUtils';

const day = { date: '2026-11-26', start: 540, end: 720, capacity: 1, interval: 30, breakStart: null, breakEnd: null };

describe('Estadio availability', () => {
  it('offers start times where the whole job fits', () => {
    // 09:00–12:00, a 60-minute job: 09:00 … 11:00.
    expect(freeStarts(day, [], 60)).toEqual([540, 570, 600, 630, 660]);
    // 10:00–11:00 taken: nothing that overlaps it.
    expect(freeStarts(day, [{ start: 600, end: 660 }], 60)).toEqual([540, 660]);
  });

  it('allows as many cars at once as the capacity', () => {
    const taken = [{ start: 540, end: 660 }];
    expect(freeStarts({ ...day, capacity: 2 }, taken, 60)).toEqual([540, 570, 600, 630, 660]);
    expect(freeStarts({ ...day, capacity: 2 }, [...taken, { start: 570, end: 630 }], 60)).toEqual([630, 660]);
    expect(maxOverlap([{ start: 540, end: 600 }, { start: 600, end: 660 }], 540, 660)).toBe(1);
  });

  it('keeps the break free and hides times that are too soon', () => {
    expect(freeStarts({ ...day, breakStart: 600, breakEnd: 630 }, [], 60)).toEqual([540, 630, 660]);
    const notBefore = (Math.round(Date.UTC(2026, 10, 26) / 86_400_000)) * 1440 + 600;
    expect(freeStarts(day, [], 60, notBefore)).toEqual([600, 630, 660]);
  });

  it('converts Dutch local time to UTC across summer and winter time', () => {
    expect(toUtc('2026-11-26', 540).toISOString()).toBe('2026-11-26T08:00:00.000Z');
    expect(toUtc('2026-07-01', 540).toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(localNow(new Date('2026-07-01T22:30:00Z'))).toEqual({ date: '2026-07-02', minutes: 30 });
  });
});

describe('Estadio bookings', () => {
  let now: Date;
  let ctx: ReturnType<typeof setup>;
  const customer = { name: 'Sanne de Vries', email: 'sanne@example.com', phone: '06 1234 5678', company: 'Studio Twente', plate: 'ab-123 c', vehicle: 'Zwarte Golf', parking: 'Bij de laadpalen', notes: '' };

  beforeEach(() => {
    now = new Date('2026-11-24T08:00:00Z'); // Tuesday 09:00 in Enschede
    ctx = setup({}, { clock: () => now });
  });

  async function addDay(overrides = {}) {
    const admin = await signedIn(ctx);
    await admin
      .post('/api/admin/estadio/days')
      .send({ dates: ['2026-11-26'], day: { start: 540, end: 720, capacity: 1, interval: 30, note: '', ...overrides } })
      .expect(201);
    const info = (await request(ctx.app).get('/api/estadio').expect(200)).body as EstadioPublicInfo;
    return { admin, info, dayId: info.days[0].id };
  }

  it('shows open days with free times per package', async () => {
    const { info } = await addDay();
    expect(info.packages.map((p) => p.id)).toEqual(['opfris', 'interieur', 'premium']);
    expect(info.days).toHaveLength(1);
    expect(info.days[0].slots.opfris).toEqual([540, 570, 600, 630, 660]);
    expect(info.days[0].slots.premium).toEqual([540, 570, 600]);
  });

  it('books a time, mails both sides and never double-books it', async () => {
    const { dayId } = await addDay();
    const res = await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'premium', dayId, start: 540, ...customer }).expect(201);
    expect(res.body).toMatchObject({ plate: 'AB-123-C', packageName: 'Premium Pakket (Interieur & exterieur)', price: 16000, start: 540, end: 660, changeable: true });
    expect(res.body).not.toHaveProperty('id');

    expect(ctx.sent.map((m) => m.to)).toEqual(['sanne@example.com', 'shop@example.com']);
    expect(ctx.sent[0].subject).toContain('donderdag 26 november om 09:00');
    expect(ctx.sent[0].html).toContain(`/estadio/boeking/${res.body.publicId}`);
    expect(ctx.sent[1].replyTo).toBe('sanne@example.com');

    // Someone else on the same time, or the same car twice that day.
    const taken = await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 600, ...customer, plate: 'XX-999-X' });
    expect(taken.status).toBe(409);
    const twice = await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 660, ...customer, plate: 'AB123C' });
    expect(twice.status).toBe(409);
    expect(twice.body.fields.plate).toBeDefined();

    const info = (await request(ctx.app).get('/api/estadio')).body as EstadioPublicInfo;
    expect(info.days[0].slots.opfris).toEqual([660]);
  });

  it('validates the details in Dutch', async () => {
    const { dayId } = await addDay();
    const res = await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'premium', dayId, start: 540, ...customer, email: 'nee', plate: '!' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toMatchObject({ email: 'Vul een geldig e-mailadres in', plate: 'Vul een geldig kenteken in, bijv. AB-123-C' });
  });

  it('lets the customer move and cancel until the deadline, and offers a calendar file', async () => {
    const { dayId } = await addDay();
    const booked = (await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 540, ...customer }).expect(201)).body;
    const url = `/api/estadio/bookings/${booked.publicId}`;

    const ics = await request(ctx.app).get(`${url}/agenda.ics`).expect(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.text).toContain('DTSTART:20261126T080000Z');
    expect(ics.text).toContain('DTEND:20261126T090000Z');

    const moved = await request(ctx.app).post(`${url}/reschedule`).send({ dayId, start: 600, packageId: 'interieur' }).expect(200);
    expect(moved.body).toMatchObject({ start: 600, end: 690, price: 11000 });
    expect(ctx.sent.at(-2)!.subject).toContain('verplaatst');

    // 24 hours before 10:00 on Thursday has passed.
    now = new Date('2026-11-25T09:30:00Z');
    const late = await request(ctx.app).post(`${url}/cancel`).send({});
    expect(late.status).toBe(409);
    expect((await request(ctx.app).get(url)).body.changeable).toBe(false);

    now = new Date('2026-11-24T08:00:00Z');
    await request(ctx.app).post(`${url}/cancel`).send({}).expect(200);
    expect((await request(ctx.app).get(url)).body.status).toBe('cancelled');
    await request(ctx.app).post(`${url}/cancel`).send({}).expect(409);
    await request(ctx.app).get('/api/estadio/bookings/onbekend-maar-lang-genoeg-123').expect(404);
  });

  it('keeps the admin routes for signed-in admins', async () => {
    await request(ctx.app).get('/api/admin/estadio').expect(401);
    const { admin, dayId } = await addDay();
    const overview = await admin.get('/api/admin/estadio').expect(200);
    expect(overview.body.days[0]).toMatchObject({ date: '2026-11-26', booked: 0 });
    await admin.post('/api/admin/estadio/days').send({ dates: ['2026-11-26'], day: { start: 540, end: 720, capacity: 1, interval: 30 } }).expect(409);
    await admin.post('/api/admin/estadio/days').send({ dates: ['2026-11-01'], day: { start: 540, end: 720, capacity: 1, interval: 30 } }).expect(400);

    // A booking by phone, without e-mail, then the day can't shrink around it.
    const view = await admin.post(`/api/admin/estadio/days/${dayId}/bookings`).send({ packageId: 'premium', start: 600, name: 'Bram', plate: 'GH-456-J' }).expect(201);
    expect(view.body.bookings).toHaveLength(1);
    await admin.put(`/api/admin/estadio/days/${dayId}`).send({ start: 540, end: 690, capacity: 1, interval: 30 }).expect(409);
    await admin.delete(`/api/admin/estadio/days/${dayId}`).expect(409);

    const id = view.body.bookings[0].id;
    await admin.post(`/api/admin/estadio/bookings/${id}/status`).send({ status: 'done' }).expect(200);
    const csv = await admin.get(`/api/admin/estadio/days/${dayId}/export.csv`).expect(200);
    expect(csv.text).toContain('GH-456-J');
    expect(csv.text).toContain('Klaar');
  });

  it('cancels a whole day and mails everyone on it', async () => {
    const { admin, dayId } = await addDay({ capacity: 2 });
    await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 540, ...customer }).expect(201);
    await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 540, ...customer, email: 'tom@example.com', plate: 'ZZ-11-ZZ' }).expect(201);
    ctx.sent.length = 0;
    const res = await admin.post(`/api/admin/estadio/days/${dayId}/cancel`).send({ message: 'Het regent pijpenstelen.' }).expect(200);
    expect(res.body.day.open).toBe(false);
    expect(ctx.sent.map((m) => m.to).sort()).toEqual(['sanne@example.com', 'tom@example.com']);
    expect(ctx.sent[0].text).toContain('Het regent pijpenstelen.');
    expect((await request(ctx.app).get('/api/estadio')).body.days).toEqual([]);
    await admin.delete(`/api/admin/estadio/days/${dayId}`).expect(200);
  });

  it('sends one reminder the day before, from 10:00', async () => {
    const { dayId } = await addDay();
    await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 540, ...customer }).expect(201);
    const remind = ctx.app.locals.estadioReminders as () => Promise<number>;
    ctx.sent.length = 0;

    now = new Date('2026-11-25T08:30:00Z'); // 09:30, too early
    expect(await remind()).toBe(0);
    now = new Date('2026-11-25T10:00:00Z');
    // The booking was made at 08:00 UTC the day before: SQLite's "now" is real time, so backdate it.
    ctx.db.prepare(`UPDATE estadio_bookings SET created_at = '2026-11-24 08:00:00'`).run();
    expect(await remind()).toBe(1);
    expect(ctx.sent[0].subject).toContain('Morgen');
    expect(await remind()).toBe(0);
  });
});

describe('Estadio host', () => {
  const production = { production: true, appUrl: 'https://www.detail2go.nl', estadioUrl: 'https://estadio.detail2go.nl' };

  it('sends the admin on the Estadio host to the main site, and /estadio to the subdomain', async () => {
    const { app } = setup(production);
    const admin = await request(app).get('/admin').set('Host', 'estadio.detail2go.nl');
    expect(admin.status).toBe(302);
    expect(admin.headers.location).toBe('https://www.detail2go.nl/admin/estadio');

    const old = await request(app).get('/estadio/boeking/abc?x=1').set('Host', 'www.detail2go.nl');
    expect(old.headers.location).toBe('https://estadio.detail2go.nl/boeking/abc?x=1');

    // Not sent to the canonical host like other hosts are.
    const page = await request(app).get('/').set('Host', 'estadio.detail2go.nl');
    expect(page.status).not.toBe(301);
    const robots = await request(app).get('/robots.txt').set('Host', 'estadio.detail2go.nl');
    expect(robots.text).toContain('Disallow: /');
  });
});

describe('Estadio vehicle lookup (RDW)', () => {
  it('writes brand, model and colour the way people say them', () => {
    expect(describeVehicle({ merk: 'AUDI', handelsbenaming: 'AUDI A6', eerste_kleur: 'GRIJS', datum_eerste_toelating: '20050204' })).toEqual({
      found: true,
      brand: 'Audi',
      model: 'A6',
      color: 'grijs',
      year: '2005',
      description: 'Audi A6, grijs',
    });
    expect(describeVehicle({ merk: 'MERCEDES-BENZ', handelsbenaming: 'GLC 300 E 4MATIC', eerste_kleur: 'DIVERSEN' })).toMatchObject({ description: 'Mercedes-Benz GLC 300 E 4MATIC' });
    expect(describeVehicle({ merk: 'VOLKSWAGEN', handelsbenaming: 'GOLF GTI', eerste_kleur: 'WIT' })).toMatchObject({ description: 'Volkswagen Golf GTI, wit' });
    expect(describeVehicle({ merk: 'KIA', handelsbenaming: 'NIRO', eerste_kleur: 'BLAUW' })).toMatchObject({ description: 'Kia Niro, blauw' });
    expect(describeVehicle({ merk: 'BMW', handelsbenaming: 'X3 XDRIVE20I', eerste_kleur: 'ZWART' })).toMatchObject({ description: 'BMW X3 XDRIVE20I, zwart' });
    expect(describeVehicle({})).toEqual({ found: false });
  });

  it('looks a plate up once, through the server', async () => {
    const calls: string[] = [];
    const rdwFetch = (async (url: string) => {
      calls.push(url);
      const body = url.includes('kenteken=GV482K') ? [{ merk: 'TESLA', handelsbenaming: 'MODEL 3', eerste_kleur: 'GRIJS', datum_eerste_toelating: '20210315' }] : [];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const { app } = setup({}, { rdwFetch });

    const found = await request(app).get('/api/estadio/voertuig/gv-482-k').expect(200);
    expect(found.body).toMatchObject({ found: true, description: 'Tesla Model 3, grijs', year: '2021' });
    await request(app).get('/api/estadio/voertuig/GV482K').expect(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('opendata.rdw.nl');

    expect((await request(app).get('/api/estadio/voertuig/XX999X').expect(200)).body).toEqual({ found: false });
    await request(app).get('/api/estadio/voertuig/ABC').expect(400);
  });

  it('says so when the RDW is down', async () => {
    const rdwFetch = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const { app } = setup({}, { rdwFetch });
    const res = await request(app).get('/api/estadio/voertuig/GV482K');
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('zelf in');
  });
});

describe('Estadio in Google Calendar', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccount = JSON.stringify({
    type: 'service_account',
    client_email: 'estadio@detail2go-site.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  const customer = { name: 'Sanne de Vries', email: 'sanne@example.com', phone: '0612345678', plate: 'AB-123-C', vehicle: 'Audi A3, blauw' };

  /** A pretend Google: records the calls, answers like the Calendar API. */
  function fakeGoogle(options: { calendarExists?: boolean } = {}) {
    const calls: { method: string; url: string; body?: Record<string, unknown> }[] = [];
    let n = 0;
    const googleFetch = (async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
      if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'token', expires_in: 3600 });
      if (options.calendarExists === false) return json({ error: { message: 'Not Found' } }, 404);
      if (method === 'GET') return json({ summary: 'Detail2Go planning', items: [] });
      if (method === 'POST') return json({ id: `event${++n}` });
      if (method === 'PUT') return json({ id: url.split('/').pop() });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const events = () => calls.filter((c) => c.url.includes('/calendar/v3/'));
    return { googleFetch, calls, events };
  }

  async function connected(google = fakeGoogle()) {
    const now = new Date('2026-11-24T08:00:00Z');
    const ctx = setup({}, { clock: () => now, googleFetch: google.googleFetch });
    const admin = await signedIn(ctx);
    await admin.post('/api/admin/estadio/days').send({ dates: ['2026-11-26'], day: { start: 540, end: 720, capacity: 2, interval: 30 } }).expect(201);
    const dayId = (await request(ctx.app).get('/api/estadio')).body.days[0].id;
    const idle = () => (ctx.app.locals.estadioCalendarIdle as () => Promise<void>)();
    return { ctx, admin, dayId, idle, google };
  }

  it('connects after a test write, and adds bookings made before', async () => {
    const { ctx, admin, dayId, idle, google } = await connected();
    await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'opfris', dayId, start: 540, ...customer }).expect(201);
    expect(google.events()).toHaveLength(0);

    const res = await admin.put('/api/admin/estadio/google').send({ serviceAccount, calendarId: 'planning@group.calendar.google.com' }).expect(200);
    expect(res.body).toMatchObject({ connected: true, enabled: true, calendarName: 'Detail2Go planning', serviceEmail: 'estadio@detail2go-site.iam.gserviceaccount.com' });
    expect(res.body).not.toHaveProperty('account');
    await idle();
    // The test event (added and removed), then the existing booking.
    expect(google.events().map((c) => c.method)).toEqual(['GET', 'POST', 'DELETE', 'POST']);
    const event = google.events()[3].body!;
    expect(event).toMatchObject({
      summary: 'AB-123-C · Opfris Pakket · Sanne de Vries',
      start: { dateTime: '2026-11-26T09:00:00', timeZone: 'Europe/Amsterdam' },
      end: { dateTime: '2026-11-26T10:00:00', timeZone: 'Europe/Amsterdam' },
      colorId: '10',
    });
    expect(event.description).toContain('Tel: 0612345678');
    expect((await admin.get('/api/admin/estadio/google')).body).toMatchObject({ synced: 1, failed: 0 });
  });

  it('follows the booking: moved, marked done, cancelled', async () => {
    const { ctx, admin, dayId, idle, google } = await connected();
    await admin.put('/api/admin/estadio/google').send({ serviceAccount, calendarId: 'planning@group.calendar.google.com' }).expect(200);
    await idle();
    google.calls.length = 0;

    const booked = (await request(ctx.app).post('/api/estadio/bookings').send({ packageId: 'premium', dayId, start: 540, ...customer }).expect(201)).body;
    await idle();
    expect(google.events().map((c) => c.method)).toEqual(['POST']);
    expect(google.events()[0].body).toMatchObject({ colorId: '5' });

    await request(ctx.app).post(`/api/estadio/bookings/${booked.publicId}/reschedule`).send({ dayId, start: 570, packageId: 'premium' }).expect(200);
    await idle();
    expect(google.events().at(-1)).toMatchObject({ method: 'PUT', body: { start: { dateTime: '2026-11-26T09:30:00' } } });

    const id = (await admin.get(`/api/admin/estadio/days/${dayId}`)).body.bookings[0].id;
    await admin.post(`/api/admin/estadio/bookings/${id}/status`).send({ status: 'done' }).expect(200);
    await idle();
    expect(String(google.events().at(-1)!.body!.summary)).toMatch(/^✓ AB-123-C/);

    // Nothing changed: no extra call.
    const count = google.events().length;
    await (ctx.app.locals.estadioCalendarSync as () => Promise<void>)();
    expect(google.events()).toHaveLength(count);

    await admin.post(`/api/admin/estadio/bookings/${id}/status`).send({ status: 'cancelled' }).expect(200);
    await idle();
    expect(google.events().at(-1)!.method).toBe('DELETE');
  });

  it('explains what is wrong when the calendar cannot be reached', async () => {
    const { admin } = await connected(fakeGoogle({ calendarExists: false }));
    const res = await admin.put('/api/admin/estadio/google').send({ serviceAccount, calendarId: 'verkeerd@group.calendar.google.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Agenda niet gevonden');
    expect(res.body.error).toContain('estadio@detail2go-site.iam.gserviceaccount.com');
    expect((await admin.get('/api/admin/estadio/google')).body.connected).toBe(false);

    const bad = await admin.put('/api/admin/estadio/google').send({ serviceAccount: '{"type":"user"}', calendarId: 'x@group.calendar.google.com' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.serviceAccount).toBeDefined();
  });
});
