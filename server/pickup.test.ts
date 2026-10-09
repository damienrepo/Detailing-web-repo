import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PICKUP } from '../shared/pricing';
import { setup, signedIn } from './testUtils';

const contact = { email: 'klant@example.com', name: 'Sanne de Vries', country: 'NL' };
const address = { street: 'Kerkstraat', houseNumber: '12a', postalCode: '7511ab', city: 'Enschede' };
const items = [{ productId: 'microfiber-towel', quantity: 1 }];

describe('pickup orders', () => {
  it('need no address and have no shipping cost', async () => {
    const ctx = setup();
    const res = await request(ctx.app)
      .post('/api/orders')
      .send({ items, shippingMethod: 'pickup', customer: contact, acceptTerms: true })
      .expect(201);
    const order = (await request(ctx.app).get(`/api/orders/${res.body.orderId}`)).body;
    expect(order).toMatchObject({ shippingMethod: 'pickup', shipping: 0, total: 795 });
    expect(order.address.street).toBe('');
  });

  it('still require an address for delivery', async () => {
    const ctx = setup();
    const res = await request(ctx.app).post('/api/orders').send({ items, customer: contact, acceptTerms: true }).expect(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['street', 'houseNumber', 'postalCode', 'city']));
    await request(ctx.app)
      .post('/api/orders')
      .send({ items, shippingMethod: 'delivery', customer: { ...contact, ...address }, acceptTerms: true })
      .expect(201);
  });

  it('are refused when pickup is switched off in the admin', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/content');
    await client
      .put('/api/admin/content/shipping')
      .send({ ...body.shipping, pickup: { ...body.shipping.pickup, enabled: false }, deliveryEnabled: false })
      .expect(400);
    await client.put('/api/admin/content/shipping').send({ ...body.shipping, pickup: { ...body.shipping.pickup, enabled: false } }).expect(200);
    expect(PICKUP.enabled).toBe(false);
    const res = await request(ctx.app).post('/api/orders').send({ items, shippingMethod: 'pickup', customer: contact, acceptTerms: true }).expect(400);
    expect(res.body.error).toMatch(/Afhalen is op dit moment niet mogelijk/);
    await client.delete('/api/admin/content/shipping').expect(200);
    expect(PICKUP.enabled).toBe(true);
  });

  it('go from paid to ready (mailing the customer) to collected', async () => {
    const ctx = setup();
    const { body } = await request(ctx.app).post('/api/orders').send({ items, shippingMethod: 'pickup', customer: contact, acceptTerms: true });
    ctx.payments.settle(body.checkoutUrl.split('/').pop(), 'paid');
    await request(ctx.app).get(`/api/orders/${body.orderId}`);
    expect(ctx.sent.find((m) => m.to === 'shop@example.com')!.text).toContain('AFHALEN');

    const client = await signedIn(ctx);
    const [order] = (await client.get('/api/admin/orders')).body;
    await client.post(`/api/admin/orders/${order.id}/ship`).send({}).expect(409);
    await client.post(`/api/admin/orders/${order.id}/ready`).send({}).expect(200);
    expect(ctx.sent.at(-1)).toMatchObject({ to: 'klant@example.com', subject: `Je bestelling ${order.number} ligt klaar` });
    const collected = await client.post(`/api/admin/orders/${order.id}/collected`).send({}).expect(200);
    expect(collected.body.status).toBe('collected');
    expect((await request(ctx.app).get(`/api/orders/${body.orderId}`)).body.status).toBe('collected');
  });
});
