import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ABOUT } from '../shared/content';
import { metaForPath } from './seo';
import { setup, signedIn } from './testUtils';

describe('over ons', () => {
  it('is a page with its own title and in the sitemap', async () => {
    const ctx = setup();
    expect(metaForPath('/over-ons')).toMatchObject({ title: 'Over ons', status: 200 });
    expect((await request(ctx.app).get('/sitemap.xml')).text).toContain('/over-ons');
  });

  it('can be edited in the admin and reset', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/content');
    await client.put('/api/admin/content/about').send({ ...body.about, story: [] }).expect(400);
    await client.put('/api/admin/content/about').send({ ...body.about, whyText: 'Omdat we van auto’s houden.' }).expect(200);
    expect(ABOUT.whyText).toBe('Omdat we van auto’s houden.');
    await client.delete('/api/admin/content/about').expect(200);
    expect(ABOUT.whyText).not.toBe('Omdat we van auto’s houden.');
  });
});
