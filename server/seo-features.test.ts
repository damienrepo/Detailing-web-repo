import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { recordNotFound, listNotFound, normalizePath } from './redirects';
import { indexNowKey, sitemapEntries } from './sitemap';
import { setup, signedIn } from './testUtils';

describe('SEO A3: redirects and the 404 monitor', () => {
  it('sends the old Wix pages to their new address with a 301', async () => {
    const ctx = setup();
    const res = await request(ctx.app).get('/about-us').expect(301);
    expect(res.headers.location).toBe('/over-ons');
    expect((await request(ctx.app).get('/Algemene-Voorwaarden/?ref=x').expect(301)).headers.location).toBe('/voorwaarden?ref=x');
    expect(ctx.db.prepare(`SELECT hits FROM redirects WHERE from_path = '/about-us'`).get()).toEqual({ hits: 1 });
  });

  it('lets the admin redirect a missing page, without loops or redirecting the app itself', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    recordNotFound(ctx.db, '/oude-pagina', 'https://www.google.com/');
    expect((await client.get('/api/admin/redirects').expect(200)).body.notFound[0]).toMatchObject({ path: '/oude-pagina', hits: 1, referrer: 'https://www.google.com/' });

    const view = (await client.post('/api/admin/redirects').send({ from: '/Oude-Pagina/', to: '/diensten/ppf' }).expect(200)).body;
    expect(view.notFound).toEqual([]);
    expect(view.pages).toContain('/diensten/ppf');
    expect((await request(ctx.app).get('/oude-pagina').expect(301)).headers.location).toBe('/diensten/ppf');

    await client.post('/api/admin/redirects').send({ from: '/api/health', to: '/' }).expect(400);
    await client.post('/api/admin/redirects').send({ from: '/a', to: '/a' }).expect(400);
    await client.post('/api/admin/redirects').send({ from: '/b', to: '/about-us' }).expect(400); // /about-us is itself redirected
    await client.post('/api/admin/redirects').send({ from: '/c', to: 'javascript:alert(1)' }).expect(400);
    await client.delete('/api/admin/redirects?from=/oude-pagina').expect(200);
    await request(ctx.app).get('/oude-pagina').expect(404);
  });

  it('ignores scanners and keeps the log small', () => {
    const ctx = setup();
    for (const p of ['/wp-login.php', '/.env', '/admin/x', '/api/x', '/assets/a.js', '/services/x.jpg']) recordNotFound(ctx.db, p);
    expect(listNotFound(ctx.db)).toEqual([]);
    recordNotFound(ctx.db, '/services');
    recordNotFound(ctx.db, '/Services/');
    expect(listNotFound(ctx.db)).toMatchObject([{ path: '/services', hits: 2 }]);
    expect(normalizePath('/Over%20ons//?x=1')).toBe('/over ons');
  });
});

describe('SEO A4: one address for the whole site', () => {
  it('sends other hosts to the canonical address, but leaves the API alone', async () => {
    const ctx = setup({ production: true, appUrl: 'https://www.detail2go.nl' });
    const res = await request(ctx.app).get('/diensten?x=1').set('Host', 'detailing-web-repo-production.up.railway.app').expect(301);
    expect(res.headers.location).toBe('https://www.detail2go.nl/diensten?x=1');
    await request(ctx.app).get('/api/health').set('Host', 'healthcheck.railway.app').expect(200);
    await request(ctx.app).get('/robots.txt').set('Host', 'www.detail2go.nl').expect(200);
  });
});

describe('SEO A6: sitemap and IndexNow', () => {
  it('lists pages with their last change and photos', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    await client.post('/api/admin/team').send({ name: 'Bram', role: 'Detailer', bio: '', quote: '', photo: 'team', facts: [], visible: true }).expect(201);
    const xml = (await request(ctx.app).get('/sitemap.xml').expect(200)).text;
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toMatch(/<loc>http:\/\/localhost:3000\/team<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>\s*<image:image><image:loc>http:\/\/localhost:3000\/services\/team\.jpg<\/image:loc>/);
    expect(xml).toContain('<loc>http://localhost:3000/diensten/ppf</loc>');
    const entries = sitemapEntries(ctx.db, 'https://www.detail2go.nl');
    expect(entries.find((e) => e.path === '/voorwaarden')).toEqual({ path: '/voorwaarden', images: [] });
  });

  it('serves its key and announces changes made in the admin', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 200 }));
    const ctx = setup({ appUrl: 'https://www.detail2go.nl' }, { indexNowFetch: fetch });
    const key = indexNowKey(ctx.db);
    expect((await request(ctx.app).get(`/${key}.txt`).expect(200)).text).toBe(key);
    await request(ctx.app).get(`/${'0'.repeat(32)}.txt`).expect(404);

    const client = await signedIn(ctx);
    await client.post('/api/admin/team').send({ name: 'Stein', role: 'Detailer', bio: '', quote: '', photo: null, facts: [], visible: true }).expect(201);
    await ctx.app.locals.indexNow.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.indexnow.org/indexnow');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ host: 'www.detail2go.nl', key, keyLocation: `https://www.detail2go.nl/${key}.txt` });
    expect(body.urlList).toContain('https://www.detail2go.nl/team');

    await ctx.app.locals.indexNow.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stays silent in development', async () => {
    const fetch = vi.fn(async () => new Response(''));
    const ctx = setup({}, { indexNowFetch: fetch });
    const client = await signedIn(ctx);
    await client.post('/api/admin/team').send({ name: 'Stein', role: 'Detailer', bio: '', quote: '', photo: null, facts: [], visible: true }).expect(201);
    await ctx.app.locals.indexNow.flush();
    expect(fetch).not.toHaveBeenCalled();
  });
});
