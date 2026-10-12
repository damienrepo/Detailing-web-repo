import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { adminClient, setup, signedIn } from './testUtils';
import { TRANSLATE_LIMITS, translatable } from './translate';

/** Stand-in for Claude: "Hallo" → "[en] Hallo". */
const fakeEngine = () => vi.fn(async (texts: string[]) => texts.map((t) => `[en] ${t}`));

describe('translation', () => {
  it('is off until there is an API key', async () => {
    const ctx = setup();
    expect((await request(ctx.app).get('/api/config')).body.translate).toBe(false);
    const res = await request(ctx.app).post('/api/translate').send({ lang: 'en', texts: ['Afspraak aanvragen'] }).expect(200);
    expect(res.body.translations).toEqual({});
  });

  it('translates each text once and serves it from storage after that', async () => {
    const engine = fakeEngine();
    const ctx = setup({}, { translateEngine: engine });
    expect((await request(ctx.app).get('/api/config')).body.translate).toBe(true);

    const texts = ['Afspraak aanvragen', 'Over ons', '€ 16,95', 'info@detail2go.nl', 'Afspraak aanvragen'];
    const first = await request(ctx.app).post('/api/translate').send({ lang: 'en', texts }).expect(200);
    expect(first.body.translations).toEqual({ 'Afspraak aanvragen': '[en] Afspraak aanvragen', 'Over ons': '[en] Over ons' });
    expect(engine).toHaveBeenCalledTimes(1);
    expect(engine.mock.calls[0][0]).toEqual(['Afspraak aanvragen', 'Over ons']);

    await request(ctx.app).post('/api/translate').send({ lang: 'en', texts: ['Over ons'] }).expect(200);
    expect(engine).toHaveBeenCalledTimes(1);
    expect((await request(ctx.app).get('/api/translations/en')).body).toEqual({ 'Afspraak aanvragen': '[en] Afspraak aanvragen', 'Over ons': '[en] Over ons' });
    await request(ctx.app).get('/api/translations/de').expect(400);
  });

  it('caps new text per visitor so the endpoint cannot run up the bill', async () => {
    const engine = fakeEngine();
    const ctx = setup({}, { translateEngine: engine });
    const big = (i: number) => `Zin ${i} ${'x'.repeat(1990)}`.slice(0, 2000);
    let translated = 0;
    for (let round = 0; round < 4; round++) {
      const texts = Array.from({ length: 5 }, (_, i) => big(round * 5 + i));
      translated += Object.keys((await request(ctx.app).post('/api/translate').send({ lang: 'en', texts }).expect(200)).body.translations).length;
    }
    expect(translated * 2000).toBeLessThanOrEqual(TRANSLATE_LIMITS.perClientHourly);
    expect(translated).toBeGreaterThan(0);
  });

  it('rejects oversized requests', async () => {
    const ctx = setup({}, { translateEngine: fakeEngine() });
    await request(ctx.app).post('/api/translate').send({ lang: 'en', texts: ['x'.repeat(2001)] }).expect(400);
    await request(ctx.app).post('/api/translate').send({ lang: 'fr', texts: ['Hallo'] }).expect(400);
  });

  it('can be tested and cleared in the admin', async () => {
    const ctx = setup({}, { translateEngine: fakeEngine() });
    const client = await signedIn(ctx);
    await client.put('/api/admin/settings').send({ anthropicApiKey: 'geen-sleutel' }).expect(400);
    await client.put('/api/admin/settings').send({ anthropicApiKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz' }).expect(200);
    const settings = (await client.get('/api/admin/settings').expect(200)).body;
    expect(settings.values.anthropicApiKey).toMatchObject({ set: true, hint: 'sk-ant-…wxyz' });
    expect(JSON.stringify(settings)).not.toContain('abcdefghijklmnop');

    expect((await client.post('/api/admin/settings/test-translate').send({}).expect(200)).body.sample).toBe('[en] Vraag vrijblijvend een afspraak aan');
    await request(ctx.app).post('/api/translate').send({ lang: 'en', texts: ['Diensten'] }).expect(200);
    expect((await client.get('/api/admin/settings')).body.translations).toBe(1);
    expect((await client.delete('/api/admin/translations').expect(200)).body.translations).toBe(0);
    await adminClient(request.agent(ctx.app)).delete('/api/admin/translations').expect(401);
  });

  it('only sends text with words in it', () => {
    expect(translatable('Bel ons')).toBe(true);
    expect(translatable('06 22 76 75 54')).toBe(false);
    expect(translatable('https://www.detail2go.nl')).toBe(false);
    expect(translatable('x'.repeat(2001))).toBe(false);
  });
});
