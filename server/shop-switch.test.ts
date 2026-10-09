import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { SHOP } from '../shared/content';
import { metaForPath } from './seo';
import { setup, signedIn } from './testUtils';

const order = {
  items: [{ productId: 'microfiber-towel', quantity: 1 }],
  customer: { email: 'klant@example.com', name: 'Sanne', country: 'NL', street: 'Kerkstraat', houseNumber: '1', postalCode: '7511AB', city: 'Enschede' },
  acceptTerms: true,
};

describe('webshop switch', () => {
  it('hides the shop and refuses orders while switched off', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    await request(ctx.app).put('/api/admin/content/shop').send({ enabled: false }).expect(403);
    await client.put('/api/admin/content/shop').send({ enabled: 'nee' }).expect(400);
    const off = await client.put('/api/admin/content/shop').send({ enabled: false }).expect(200);
    expect(SHOP.enabled).toBe(false);
    expect(off.body.embed).toContain('"shop":{"enabled":false}');

    const res = await request(ctx.app).post('/api/orders').send(order).expect(503);
    expect(res.body.error).toMatch(/webshop is op dit moment gesloten/);
    expect(metaForPath('/shop')).toMatchObject({ status: 404, noindex: true });
    expect(metaForPath('/shop/microvezel-doek').status).toBe(404);
    const sitemap = (await request(ctx.app).get('/sitemap.xml')).text;
    expect(sitemap).not.toContain('/shop');
    expect(sitemap).toContain('/diensten');

    await client.put('/api/admin/content/shop').send({ enabled: true }).expect(200);
    await request(ctx.app).post('/api/orders').send(order).expect(201);
    expect(metaForPath('/shop').status).toBe(200);
  });
});
