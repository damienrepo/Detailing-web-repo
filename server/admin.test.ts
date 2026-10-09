import fs from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getProduct, PRODUCTS } from '../shared/catalog';
import { SITE } from '../shared/site';
import { renderIndex } from './seo';
import { ADMIN, adminClient, setup, signedIn } from './testUtils';
import { currentCounter, totpCode } from './totp';
import { createCipher, hashPassword, verifyPassword } from './security';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { exportSeed, importSeed } from './seed';

const customer = {
  email: 'klant@example.com',
  name: 'Sanne de Vries',
  street: 'Kerkstraat',
  houseNumber: '12a',
  postalCode: '7511AB',
  city: 'Enschede',
  country: 'NL',
};

/** A minimal JPEG header with the given size; enough for the server's format check. */
function fakeJpeg(width: number, height: number) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xe0, 0x00, 0x04, 0, 0]), sof, Buffer.from([0xff, 0xd9])]).toString('base64');
}

describe('security primitives', () => {
  it('hashes passwords with a salt and verifies them', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(a).not.toContain('correct');
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('Correct horse battery', a)).toBe(false);
  });

  it('encrypts values bound to their field', () => {
    const cipher = createCipher(crypto.randomBytes(32));
    const sealed = cipher.encrypt('test_geheim', 'setting:mollieApiKey');
    expect(sealed).not.toContain('geheim');
    expect(cipher.decrypt(sealed, 'setting:mollieApiKey')).toBe('test_geheim');
    expect(() => cipher.decrypt(sealed, 'setting:smtpPass')).toThrow();
  });
});

describe('first-time setup', () => {
  it('needs the setup code from the server console and a strong password', async () => {
    const ctx = setup();
    const client = adminClient(request.agent(ctx.app));
    expect((await client.get('/api/admin/session')).body).toEqual({ state: 'setup' });

    const account = { name: 'Damiën', email: 'damien@example.com', password: 'een lange en sterke zin' };
    await client.post('/api/admin/setup').send({ ...account, code: 'AAAA-BBBB-CCCC' }).expect(401);
    const weak = await client.post('/api/admin/setup').send({ ...account, code: ctx.auth.setupCode, password: 'kort' }).expect(400);
    expect(weak.body.fields.password).toMatch(/minimaal 12/);

    const ok = await client.post('/api/admin/setup').send({ ...account, code: ctx.auth.setupCode!.toLowerCase().replace(/-/g, '') }).expect(200);
    expect(ok.body.state).toBe('ok');
    expect((await client.get('/api/admin/session')).body.state).toBe('ok');
    // The code is single use.
    await client.post('/api/admin/setup').send({ ...account, code: 'x' }).expect(409);
  });
});

describe('login', () => {
  it('sets a session cookie that scripts cannot read', async () => {
    const ctx = setup();
    await ctx.auth.createUser(ADMIN);
    const res = await adminClient(request.agent(ctx.app)).post('/api/admin/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(res.body.user).toEqual({ id: 1, email: ADMIN.email, name: ADMIN.name, totpEnabled: false });
    expect(JSON.stringify(res.body)).not.toContain('hash');
  });

  it('gives the same answer for unknown accounts and wrong passwords, then locks out', async () => {
    const ctx = setup();
    await ctx.auth.createUser(ADMIN);
    const client = adminClient(request.agent(ctx.app));
    const unknown = await client.post('/api/admin/login').send({ email: 'niemand@example.com', password: 'x' }).expect(401);
    const wrong = await client.post('/api/admin/login').send({ email: ADMIN.email, password: 'fout' }).expect(401);
    expect(unknown.body.error).toBe(wrong.body.error);

    for (let i = 0; i < 4; i++) await client.post('/api/admin/login').send({ email: ADMIN.email, password: 'fout' });
    const blocked = await client.post('/api/admin/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(429);
    expect(blocked.body.error).toMatch(/Te veel mislukte pogingen/);
  });

  it('refuses requests from other sites', async () => {
    const ctx = setup();
    await ctx.auth.createUser(ADMIN);
    await request(ctx.app).post('/api/admin/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(403);
    await request(ctx.app)
      .post('/api/admin/login')
      .set('Host', 'shop.test')
      .set('Origin', 'https://evil.example')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: ADMIN.email, password: ADMIN.password })
      .expect(403);
  });

  it('logs out and invalidates the session', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    await client.post('/api/admin/logout').expect(200);
    await client.get('/api/admin/orders').expect(401);
  });

  it('marks admin responses as not cacheable', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const res = await client.get('/api/admin/orders');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('two-factor authentication', () => {
  it('asks for an authenticator code after the password and refuses a replayed code', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    await client.post('/api/admin/account/2fa/start').send({ password: 'fout' }).expect(400);
    const { body } = await client.post('/api/admin/account/2fa/start').send({ password: ADMIN.password }).expect(200);
    expect(body.qr).toMatch(/^data:image\/png;base64,/);
    const secret = body.secret.replace(/ /g, '');
    await client.post('/api/admin/account/2fa/confirm').send({ code: '000000' }).expect(400);
    await client.post('/api/admin/account/2fa/confirm').send({ code: totpCode(secret, currentCounter()) }).expect(200);

    const fresh = adminClient(request.agent(ctx.app));
    const step1 = await fresh.post('/api/admin/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(200);
    expect(step1.body.state).toBe('2fa');
    await fresh.get('/api/admin/orders').expect(401);
    // The code used to confirm set-up cannot be used again.
    await fresh.post('/api/admin/login/2fa').send({ code: totpCode(secret, currentCounter()) }).expect(401);
    const step2 = await fresh.post('/api/admin/login/2fa').send({ code: totpCode(secret, currentCounter() + 1) }).expect(200);
    expect(step2.body.user.totpEnabled).toBe(true);
    await fresh.get('/api/admin/orders').expect(200);
  });
});

describe('integration settings', () => {
  it('stores secrets encrypted and never returns them', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const key = 'test_abcdefghijklmnopqrstuvwxyz1234';
    await client.put('/api/admin/settings').send({ mollieApiKey: 'geen-key' }).expect(400);
    const res = await client.put('/api/admin/settings').send({ mollieApiKey: key, smtpPass: 'mailgeheim', smtpHost: 'smtp.example.com' }).expect(200);

    expect(JSON.stringify(res.body)).not.toContain(key);
    expect(JSON.stringify(res.body)).not.toContain('mailgeheim');
    expect(res.body.values.mollieApiKey).toMatchObject({ set: true, hint: 'test_…1234' });
    expect(res.body.values.smtpHost.value).toBe('smtp.example.com');

    const stored = ctx.db.prepare('SELECT value FROM settings').all() as { value: string }[];
    expect(stored.map((r) => r.value).join()).not.toMatch(/abcdefgh|mailgeheim|smtp\.example/);

    const audit = (await client.get('/api/admin/account')).body.audit;
    expect(audit[0]).toMatchObject({ action: 'settings_changed' });
    expect(JSON.stringify(audit)).not.toContain(key);
  });

  it('keeps settings from the environment read-only', async () => {
    const ctx = setup({ mollieApiKey: 'test_fromenvironment1234567890abcd' });
    const client = await signedIn(ctx);
    const res = await client.put('/api/admin/settings').send({ mollieApiKey: 'test_abcdefghijklmnopqrstuvwxyz1234' }).expect(200);
    expect(res.body.values.mollieApiKey).toMatchObject({ fromEnv: true, hint: 'test_…abcd' });
  });
});

describe('content', () => {
  it('updates business details on the site and in the page HTML', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/content').expect(200);
    const bad = await client.put('/api/admin/content/site').send({ ...body.site, kvk: '123' }).expect(400);
    expect(bad.body.fields.kvk).toMatch(/8 cijfers/);

    const saved = await client.put('/api/admin/content/site').send({ ...body.site, phone: '06 11 22 33 44', kvk: '12345678' }).expect(200);
    expect(SITE.phone).toBe('06 11 22 33 44');
    expect(SITE.phoneHref).toBe('+31611223344');
    const html = renderIndex('<html><head><title></title></head></html>', '/', 'https://example.nl', { contentJson: saved.body.embed }).html;
    expect(html).toContain('<script type="application/json" id="site-content">');
    expect(html).toContain('06 11 22 33 44');

    await client.delete('/api/admin/content/site').expect(200);
    expect(SITE.kvk).toBe('00000000');
  });

  it('cannot break out of the embedded JSON', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/content');
    const saved = await client.put('/api/admin/content/home').send({ ...body.home, heroText: '</script><script>alert(1)</script>' }).expect(200);
    expect(saved.body.embed).not.toContain('</script>');
  });

  it('adds products that can be bought at the new price, and hides them', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const product = {
      id: 'velgenreiniger',
      slug: 'velgenreiniger',
      sku: 'D2G-VR-500',
      name: 'Velgenreiniger',
      category: 'Reiniger',
      tagline: 'Verwijdert remstof zonder schrobben.',
      description: ['Zuurvrije velgenreiniger.'],
      price: 1495,
      size: '500 ml',
      highlights: [],
      specs: [],
      usage: [],
      inStock: true,
    };
    await client.post('/api/admin/products').send({ ...product, sku: 'D2G-KIT-01' }).expect(400);
    await client.post('/api/admin/products').send(product).expect(201);
    expect(getProduct('velgenreiniger')?.price).toBe(1495);

    const order = await request(ctx.app).post('/api/orders').send({ items: [{ productId: 'velgenreiniger', quantity: 2 }], customer, acceptTerms: true });
    expect(order.status).toBe(201);
    expect((await request(ctx.app).get(`/api/orders/${order.body.orderId}`)).body.subtotal).toBe(2990);

    await client.put('/api/admin/products/velgenreiniger').send({ ...product, hidden: true }).expect(200);
    await request(ctx.app).post('/api/orders').send({ items: [{ productId: 'velgenreiniger', quantity: 1 }], customer, acceptTerms: true }).expect(400);
    await client.delete('/api/admin/products/interior-cleaner').expect(409);
    expect(PRODUCTS.length).toBe(5);
  });
});

describe('blog', () => {
  it('only shows published posts whose date has come', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const post = { title: 'Wintertips', slug: 'wintertips', excerpt: 'Zo kom je de winter door.', body: '## Pekel\nSpoel vaak.', cover: null, status: 'draft', publishedAt: null };
    const created = await client.post('/api/admin/posts').send(post).expect(201);
    await request(ctx.app).get('/api/posts/wintertips').expect(404);

    await client.put(`/api/admin/posts/${created.body.id}`).send({ ...post, status: 'published', publishedAt: '2999-01-01' }).expect(200);
    expect((await request(ctx.app).get('/api/posts')).body).toEqual([]);

    await client.put(`/api/admin/posts/${created.body.id}`).send({ ...post, status: 'published' }).expect(200);
    expect((await request(ctx.app).get('/api/posts/wintertips')).body.body).toContain('Pekel');
    expect((await request(ctx.app).get('/sitemap.xml')).text).toContain('/blog/wintertips');
    await client.post('/api/admin/posts').send(post).expect(400);
  });
});

describe('team', () => {
  it('shows visible members in the chosen order', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const member = { name: 'Damiën', role: 'Medeoprichter', bio: 'Begon met wassen op de oprit.', quote: '', photo: null, facts: [{ label: 'Droomauto', value: '911 GT3' }], visible: true };
    const a = (await client.post('/api/admin/team').send(member).expect(201)).body;
    const b = (await client.post('/api/admin/team').send({ ...member, name: 'Stein', visible: false }).expect(201)).body;
    await client.post('/api/admin/team').send({ ...member, name: '' }).expect(400);
    await adminClient(request.agent(ctx.app)).post('/api/admin/team').send(member).expect(401);
    expect((await request(ctx.app).get('/api/team')).body.map((m: { name: string }) => m.name)).toEqual(['Damiën']);

    await client.put(`/api/admin/team/${b.id}`).send({ ...member, name: 'Stein' }).expect(200);
    await client.put('/api/admin/team-order').send({ ids: [b.id] }).expect(400);
    await client.put('/api/admin/team-order').send({ ids: [b.id, a.id] }).expect(200);
    const team = (await request(ctx.app).get('/api/team')).body;
    expect(team.map((m: { name: string }) => m.name)).toEqual(['Stein', 'Damiën']);
    expect(team[0].facts).toEqual([{ label: 'Droomauto', value: '911 GT3' }]);
    expect(team[0]).not.toHaveProperty('visible');

    await client.delete(`/api/admin/team/${a.id}`).expect(200);
    expect((await request(ctx.app).get('/api/team')).body).toHaveLength(1);
  });
});

describe('seed', () => {
  it('copies content into a fresh installation only', async () => {
    const from = setup();
    const client = await signedIn(from);
    await client.post('/api/admin/team').send({ name: 'Stein', role: 'Medeoprichter', bio: '', quote: '', photo: null, facts: [], visible: true }).expect(201);
    from.db.prepare('INSERT INTO content (key, value) VALUES (?, ?)').run('home', '{}');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
    expect(exportSeed(from.db, from.config.uploadsDir, dir)).toMatchObject({ content: 1, team_members: 1 });

    const fresh = setup();
    expect(importSeed(fresh.db, fresh.config.uploadsDir, dir)).toBe(true);
    expect((await request(fresh.app).get('/api/team')).body.map((m: { name: string }) => m.name)).toEqual(['Stein']);
    expect(fresh.auth.hasUsers()).toBe(false);
    // Never a second time, and never over existing content.
    expect(importSeed(fresh.db, fresh.config.uploadsDir, dir)).toBe(false);
    expect(importSeed(from.db, from.config.uploadsDir, dir)).toBe(false);
  });
});

describe('media', () => {
  it('accepts real JPEGs only and serves them as images', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    await client
      .post('/api/admin/media')
      .send({ name: 'nep', alt: '', large: Buffer.from('<svg onload=alert(1)>').toString('base64'), small: fakeJpeg(10, 10) })
      .expect(400);
    const { body } = await client.post('/api/admin/media').send({ name: 'Cayman', alt: 'Zwarte Porsche', large: fakeJpeg(1600, 1067), small: fakeJpeg(800, 533) }).expect(201);
    expect(body.id).toMatch(/^m_[a-z0-9]{16}$/);
    expect(body).toMatchObject({ width: 1600, height: 1067 });

    const file = await request(ctx.app).get(`/media/${body.id}.jpg`).expect(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    await request(ctx.app).get('/media/..%2Fshop.db').expect(404);
    expect(fs.existsSync(`${ctx.config.uploadsDir}/${body.id}-sm.jpg`)).toBe(true);

    const { body: content } = await client.get('/api/admin/content');
    await client.put('/api/admin/content/home').send({ ...content.home, heroImage: body.id }).expect(200);
    const blocked = await client.delete(`/api/admin/media/${body.id}`).expect(409);
    expect(blocked.body.usage).toEqual(['Homepage']);
    await client.delete(`/api/admin/media/${body.id}?force=1`).expect(200);
    await request(ctx.app).get(`/media/${body.id}.jpg`).expect(404);
  });
});
