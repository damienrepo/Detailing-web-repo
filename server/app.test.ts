import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';
import type { Mail } from './mail';
import { MockProvider, MollieProvider } from './payments';

const customer = {
  email: 'klant@example.com',
  name: 'Sanne de Vries',
  phone: '0612345678',
  street: 'Kerkstraat',
  houseNumber: '12a',
  postalCode: '1017gb',
  city: 'Amsterdam',
  country: 'NL',
};

function setup(overrides: Partial<ReturnType<typeof loadConfig>> = {}) {
  const config = { ...loadConfig({}), adminPassword: 'geheim', notifyEmail: 'shop@example.com', ...overrides };
  const db = openDb(':memory:');
  const payments = new MockProvider(config.appUrl);
  const sent: Mail[] = [];
  const app = createApp({ config, db, payments, mailer: { send: async (m) => void sent.push(m) } });
  return { app, db, payments, sent };
}

describe('checkout', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  async function placeOrder(items = [{ productId: 'interior-kit', quantity: 1 }]) {
    return request(ctx.app).post('/api/orders').send({ items, customer, acceptTerms: true });
  }

  it('creates an order priced on the server and returns a checkout URL', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ items: [{ productId: 'interior-kit', quantity: 1, price: 1 }], customer, acceptTerms: true });
    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toMatch(/\/api\/dev\/mock-checkout\/tr_mock_/);

    const order = await request(ctx.app).get(`/api/orders/${res.body.orderId}`);
    expect(order.body).toMatchObject({ number: 'LU-1001', status: 'open', subtotal: 2995, shipping: 495, total: 3490 });
    expect(order.body.address.postalCode).toBe('1017GB');
    expect(order.body).not.toHaveProperty('id');
  });

  it('validates the customer details', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({
        items: [{ productId: 'interior-kit', quantity: 1 }],
        customer: { ...customer, email: 'geen-email', postalCode: '123' },
        acceptTerms: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.fields).toMatchObject({
      email: 'Vul een geldig e-mailadres in',
      postalCode: 'Vul een geldige postcode in',
    });
  });

  it('reports empty required fields in Dutch', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ items: [{ productId: 'interior-kit', quantity: 1 }], customer: { ...customer, name: '  ', city: '' }, acceptTerms: true });
    expect(res.body.fields).toMatchObject({ name: 'Vul dit veld in', city: 'Vul dit veld in' });
  });

  it('rejects a Belgian postcode for a Dutch address', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ items: [{ productId: 'interior-kit', quantity: 1 }], customer: { ...customer, postalCode: '2000' }, acceptTerms: true });
    expect(res.body.fields.postalCode).toBe('Deze postcode past niet bij het gekozen land');
  });

  it('requires accepting the terms', async () => {
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ items: [{ productId: 'interior-kit', quantity: 1 }], customer, acceptTerms: false });
    expect(res.status).toBe(400);
  });

  it('rejects unknown products', async () => {
    const res = await placeOrder([{ productId: 'gratis', quantity: 1 }]);
    expect(res.status).toBe(400);
  });

  it('marks the order paid and mails once when the payment succeeds', async () => {
    const { body } = await placeOrder();
    const paymentId = body.checkoutUrl.split('/').pop();
    ctx.payments.settle(paymentId, 'paid');

    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    await request(ctx.app).post('/api/webhooks/mollie').type('form').send({ id: paymentId }).expect(200);
    const order = await request(ctx.app).get(`/api/orders/${body.orderId}`);

    expect(order.body.status).toBe('paid');
    expect(ctx.sent.map((m) => m.to)).toEqual(['klant@example.com', 'shop@example.com']);
    expect(ctx.sent[0].text).toContain('LU-1001');
  });

  it('syncs the payment status when the customer returns without a webhook', async () => {
    const { body } = await placeOrder();
    ctx.payments.settle(body.checkoutUrl.split('/').pop(), 'paid');
    const order = await request(ctx.app).get(`/api/orders/${body.orderId}`);
    expect(order.body.status).toBe('paid');
  });

  it('lets the customer retry a failed payment', async () => {
    const { body } = await placeOrder();
    ctx.payments.settle(body.checkoutUrl.split('/').pop(), 'failed');
    expect((await request(ctx.app).get(`/api/orders/${body.orderId}`)).body.status).toBe('failed');

    const retry = await request(ctx.app).post(`/api/orders/${body.orderId}/pay`);
    expect(retry.status).toBe(200);
    ctx.payments.settle(retry.body.checkoutUrl.split('/').pop(), 'paid');
    expect((await request(ctx.app).get(`/api/orders/${body.orderId}`)).body.status).toBe('paid');
    expect((await request(ctx.app).post(`/api/orders/${body.orderId}/pay`)).status).toBe(409);
  });

  it('runs the mock checkout page end to end', async () => {
    const { body } = await placeOrder();
    const path = new URL(body.checkoutUrl).pathname;
    await request(ctx.app).get(path).expect(200).expect(/Testbetaling/);
    const res = await request(ctx.app).post(path).type('form').send({ status: 'paid' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toContain(`/bestelling/${body.orderId}`);
  });

  it('returns 404 for unknown orders', async () => {
    await request(ctx.app).get('/api/orders/onbekend').expect(404);
  });

  it('disables checkout when no payment provider is configured', async () => {
    const config = { ...loadConfig({}) };
    const app = createApp({ config, db: openDb(':memory:'), mailer: { send: async () => {} } });
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 'interior-kit', quantity: 1 }], customer, acceptTerms: true });
    expect(res.status).toBe(503);
    expect((await request(app).get('/api/config')).body).toEqual({ payments: 'off' });
  });
});

describe('bookings', () => {
  const booking = {
    serviceId: 'coating',
    vehicle: 'Volkswagen Golf 8',
    preferredDate: '2026-11-03',
    name: 'Jan Jansen',
    email: 'jan@example.com',
    phone: '0612345678',
    postalCode: '',
    message: '',
    website: '',
  };

  it('stores the request and notifies both sides', async () => {
    const { app, db, sent } = setup();
    await request(app).post('/api/bookings').send(booking).expect(201);
    const row = db.prepare('SELECT * FROM bookings').get() as { vehicle: string; postal_code: null; status: string };
    expect(row).toMatchObject({ vehicle: 'Volkswagen Golf 8', postal_code: null, status: 'new' });
    expect(sent.map((m) => m.to)).toEqual(['jan@example.com', 'shop@example.com']);
  });

  it('rejects spam bots that fill the honeypot', async () => {
    const { app } = setup();
    await request(app)
      .post('/api/bookings')
      .send({ ...booking, website: 'http://spam.example' })
      .expect(400);
  });

  it('rejects unknown services', async () => {
    const { app } = setup();
    await request(app)
      .post('/api/bookings')
      .send({ ...booking, serviceId: 'velgen' })
      .expect(400);
  });
});

describe('admin', () => {
  it('requires the admin password', async () => {
    const { app } = setup();
    await request(app).get('/api/admin/orders').expect(401);
    await request(app).get('/api/admin/orders').set('Authorization', 'Bearer fout').expect(401);
    await request(app).get('/api/admin/orders').set('Authorization', 'Bearer geheim').expect(200);
  });

  it('is disabled without a password', async () => {
    const { app } = setup({ adminPassword: undefined });
    await request(app).get('/api/admin/orders').set('Authorization', 'Bearer ').expect(503);
  });

  it('ships paid orders and mails the tracking code', async () => {
    const { app, payments, sent } = setup();
    const { body } = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 'interior-cleaner', quantity: 1 }], customer, acceptTerms: true });
    const auth = { Authorization: 'Bearer geheim' };

    const [order] = (await request(app).get('/api/admin/orders').set(auth)).body;
    await request(app).post(`/api/admin/orders/${order.id}/ship`).set(auth).send({}).expect(409);

    payments.settle(body.checkoutUrl.split('/').pop(), 'paid');
    await request(app).get(`/api/orders/${body.orderId}`);
    const shipped = await request(app)
      .post(`/api/admin/orders/${order.id}/ship`)
      .set(auth)
      .send({ trackingCode: '3SABCD1234567' });
    expect(shipped.body).toMatchObject({ status: 'shipped', tracking_code: '3SABCD1234567' });
    expect(sent.at(-1)!.text).toContain('3SABCD1234567-NL-1017GB');
  });
});

describe('site files', () => {
  it('serves robots.txt and a sitemap with every product', async () => {
    const { app } = setup();
    await request(app).get('/robots.txt').expect(200).expect(/Sitemap: http:\/\/localhost:3000\/sitemap.xml/);
    const sitemap = await request(app).get('/sitemap.xml').expect(200);
    expect(sitemap.text).toContain('/shop/interior-care-kit');
  });

  it('sets a content security policy in production', async () => {
    const { app } = setup({ production: true });
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});

describe('MollieProvider', () => {
  it('creates payments with the Mollie v2 request format', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({
          id: 'tr_abc',
          status: 'open',
          metadata: { order: 'pub1' },
          _links: { checkout: { href: 'https://www.mollie.com/checkout/abc' } },
        }),
        { status: 201 },
      );
    }) as unknown as typeof fetch;
    const mollie = new MollieProvider('test_123', fakeFetch);
    const payment = await mollie.create({
      amount: 3490,
      description: 'Bestelling LU-1001',
      redirectUrl: 'https://example.com/bestelling/pub1',
      orderPublicId: 'pub1',
    });

    expect(mollie.mode).toBe('test');
    expect(captured!.url).toBe('https://api.mollie.com/v2/payments');
    expect(JSON.parse(captured!.init.body as string)).toMatchObject({
      amount: { currency: 'EUR', value: '34.90' },
      metadata: { order: 'pub1' },
    });
    expect((captured!.init.headers as Record<string, string>).Authorization).toBe('Bearer test_123');
    expect(payment).toEqual({
      id: 'tr_abc',
      status: 'open',
      method: undefined,
      checkoutUrl: 'https://www.mollie.com/checkout/abc',
      orderPublicId: 'pub1',
    });
  });
});

