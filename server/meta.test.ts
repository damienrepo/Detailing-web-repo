import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { getOrderById } from './orders';
import { normalizePhone, purchasePayload, retryMetaPurchases, sha256 } from './meta';
import { setup } from './testUtils';

const META = { pixelId: '1033375359727182', accessToken: 'test-token', testEventCode: undefined as string | undefined };
const customer = {
  email: 'Klant@Example.com',
  name: 'Sanne de Vries',
  phone: '06 12 34 56 78',
  street: 'Kerkstraat',
  houseNumber: '12a',
  postalCode: '7511 ab',
  city: 'Den Haag',
  country: 'NL',
};
const CONSENT = 'd2g_consent=granted; _fbp=fb.1.1700000000000.123456789; _fbc=fb.1.1700000000000.IwAR0abc';

function metaFetch(status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(status === 200 ? '{"events_received":1}' : '{"error":{}}', { status }));
}

async function paidOrder(ctx: ReturnType<typeof setup>, cookie?: string) {
  const req = request(ctx.app).post('/api/orders').set('User-Agent', 'TestBrowser/1.0').set('X-Forwarded-For', '203.0.113.9');
  if (cookie) req.set('Cookie', cookie);
  const { body } = await req
    .send({ items: [{ productId: 'microfiber-towel', quantity: 2 }], customer, acceptTerms: true, shippingMethod: 'delivery' })
    .expect(201);
  const paymentId = body.checkoutUrl.split('/').pop();
  return { publicId: body.orderId as string, paymentId: paymentId as string };
}

const sentBodies = (fetch: ReturnType<typeof metaFetch>) => fetch.mock.calls.map(([, init]) => JSON.parse(String(init!.body)));

describe('Meta Conversions API', () => {
  it('sends exactly one Purchase for a paid order, however often the webhook comes in', async () => {
    const fetch = metaFetch();
    const ctx = setup({ meta: META }, { metaFetch: fetch });
    const { paymentId } = await paidOrder(ctx, CONSENT);
    ctx.payments.settle(paymentId, 'paid');

    await Promise.all([1, 2, 3].map(() => request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200)));
    await ctx.app.locals.metaIdle();
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://graph.facebook.com/v26.0/1033375359727182/events?access_token=test-token');
    const [event] = sentBodies(fetch)[0].data;
    const order = ctx.db.prepare('SELECT number, subtotal FROM orders').get() as { number: string; subtotal: number };
    expect(event).toMatchObject({
      event_name: 'Purchase',
      event_id: order.number,
      action_source: 'website',
      event_source_url: 'http://localhost:3000/afrekenen',
      custom_data: { currency: 'EUR', value: order.subtotal / 100, content_type: 'product', content_ids: ['microfiber-towel'], num_items: 2, order_id: order.number },
    });
    expect(event.user_data).toEqual({
      em: [sha256('klant@example.com')],
      ph: [sha256('31612345678')],
      fn: [sha256('sanne')],
      ln: [sha256('de vries')],
      ct: [sha256('denhaag')],
      zp: [sha256('7511ab')],
      country: [sha256('nl')],
      external_id: [sha256(order.number)],
      client_ip_address: '203.0.113.9',
      client_user_agent: 'TestBrowser/1.0',
      fbp: 'fb.1.1700000000000.123456789',
      fbc: 'fb.1.1700000000000.IwAR0abc',
    });
    expect(Math.abs(event.event_time - Date.now() / 1000)).toBeLessThan(60);
    expect(sentBodies(fetch)[0]).not.toHaveProperty('test_event_code');
  });

  it('also sends when the thank-you page notices the payment first', async () => {
    const fetch = metaFetch();
    const ctx = setup({ meta: META }, { metaFetch: fetch });
    const { publicId, paymentId } = await paidOrder(ctx, CONSENT);
    ctx.payments.settle(paymentId, 'paid');
    await request(ctx.app).get(`/api/orders/${publicId}`).expect(200);
    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    await ctx.app.locals.metaIdle();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends nothing without marketing consent, and stores no IP or cookies then', async () => {
    const fetch = metaFetch();
    const ctx = setup({ meta: META }, { metaFetch: fetch });
    const { paymentId } = await paidOrder(ctx, 'd2g_consent=denied; _fbp=fb.1.1700000000000.123456789');
    ctx.payments.settle(paymentId, 'paid');
    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    await ctx.app.locals.metaIdle();
    expect(fetch).not.toHaveBeenCalled();
    expect(ctx.db.prepare('SELECT marketing_consent, fbp, client_ip, client_user_agent FROM orders').get()).toEqual({ marketing_consent: 0, fbp: null, client_ip: null, client_user_agent: null });
  });

  it('sends nothing for cancelled, failed or expired payments', async () => {
    const fetch = metaFetch();
    const ctx = setup({ meta: META }, { metaFetch: fetch });
    const { publicId, paymentId } = await paidOrder(ctx, CONSENT);
    ctx.payments.settle(paymentId, 'failed');
    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    expect((await request(ctx.app).get(`/api/orders/${publicId}`)).body.status).toBe('failed');
    await ctx.app.locals.metaIdle();
    await retryMetaPurchases(ctx.db, META, fetch);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps answering Mollie with 200 when Meta fails, and retries later', async () => {
    const failing = metaFetch(500);
    const ctx = setup({ meta: META }, { metaFetch: failing });
    const { paymentId } = await paidOrder(ctx, CONSENT);
    ctx.payments.settle(paymentId, 'paid');
    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    await ctx.app.locals.metaIdle();
    expect(failing).toHaveBeenCalledTimes(1);
    const row = () => ctx.db.prepare('SELECT meta_purchase_sent_at AS sent, meta_attempts AS attempts, meta_last_error AS error FROM orders').get() as { sent: string | null; attempts: number; error: string | null };
    expect(row()).toMatchObject({ sent: null, attempts: 1 });
    expect(row().error).toContain('HTTP 500');

    const working = metaFetch();
    await retryMetaPurchases(ctx.db, META, working);
    await retryMetaPurchases(ctx.db, META, working);
    expect(working).toHaveBeenCalledTimes(1);
    expect(row()).toMatchObject({ attempts: 2, error: null });
    expect(row().sent).not.toBeNull();
  });

  it('includes the test event code only when it is set, and does nothing without a token', async () => {
    const fetch = metaFetch();
    const ctx = setup({ meta: { ...META, testEventCode: 'TEST123' } }, { metaFetch: fetch });
    const { paymentId } = await paidOrder(ctx, CONSENT);
    ctx.payments.settle(paymentId, 'paid');
    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    await ctx.app.locals.metaIdle();
    expect(sentBodies(fetch)[0].test_event_code).toBe('TEST123');

    const none = metaFetch();
    const off = setup({ meta: { pixelId: META.pixelId } }, { metaFetch: none });
    const second = await paidOrder(off, CONSENT);
    off.payments.settle(second.paymentId, 'paid');
    await request(off.app).post('/api/webhooks/mollie').type('form').send({ id: second.paymentId }).expect(200);
    await off.app.locals.metaIdle();
    expect(none).not.toHaveBeenCalled();
  });

  it('leaves out empty fields instead of hashing them (pickup, no phone, one name)', async () => {
    const ctx = setup({ meta: META });
    const { body } = await request(ctx.app)
      .post('/api/orders')
      .set('Cookie', 'd2g_consent=granted')
      .send({ items: [{ productId: 'microfiber-towel', quantity: 1 }], customer: { ...customer, name: 'Cher', phone: '' }, acceptTerms: true, shippingMethod: 'pickup' })
      .expect(201);
    const id = (ctx.db.prepare('SELECT id FROM orders WHERE public_id = ?').get(body.orderId) as { id: number }).id;
    const { user_data } = purchasePayload(getOrderById(ctx.db, id)!).data[0];
    expect(Object.keys(user_data).sort()).toEqual(['client_ip_address', 'country', 'em', 'external_id', 'fn']);
  });

  it('tells the browser the Pixel ID, never the token', async () => {
    const ctx = setup({ meta: META });
    const config = (await request(ctx.app).get('/api/config')).body;
    expect(config.metaPixelId).toBe(META.pixelId);
    expect(JSON.stringify(config)).not.toContain('test-token');
    expect((await request(setup().app).get('/api/config')).body).not.toHaveProperty('metaPixelId');
  });

  it('normalises phone numbers to digits with country code', () => {
    expect(normalizePhone('06 12 34 56 78', 'NL')).toBe('31612345678');
    expect(normalizePhone('+31 6 1234 5678', 'NL')).toBe('31612345678');
    expect(normalizePhone('0031612345678', 'NL')).toBe('31612345678');
    expect(normalizePhone('0470 12 34 56', 'BE')).toBe('32470123456');
    expect(normalizePhone('31612345678', 'NL')).toBe('31612345678');
  });
});
