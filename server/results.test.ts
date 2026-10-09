import { describe, expect, it } from 'vitest';
import { HOME } from '../shared/content';
import { homeSchema } from '../shared/schemas';
import { ContentStore } from './content';
import { setup, signedIn } from './testUtils';

describe('recent projects on the homepage', () => {
  it('store a series of photos per project', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    const { body } = await client.get('/api/admin/content');
    const results = [{ images: ['ppf-folie', 'ppf-aanbrengen', 'ppf-motorkap'], title: 'Porsche 911', text: 'Full front PPF' }];
    await client.put('/api/admin/content/home').send({ ...body.home, results: [{ ...results[0], images: [] }] }).expect(400);
    await client.put('/api/admin/content/home').send({ ...body.home, results }).expect(200);
    expect(HOME.results[0].images).toEqual(['ppf-folie', 'ppf-aanbrengen', 'ppf-motorkap']);
  });

  it('turn an older single photo into a one-photo series', () => {
    const old = { ...HOME, results: [{ image: 'coatings', title: 'Ferrari', text: 'Coating' }] };
    const parsed = homeSchema.parse(old);
    expect(parsed.results[0]).toEqual({ images: ['coatings'], title: 'Ferrari', text: 'Coating' });
  });

  it('read older saves from the database without losing them', () => {
    const ctx = setup();
    ctx.db.prepare("INSERT INTO content (key, value) VALUES ('home', ?)").run(JSON.stringify({ ...HOME, results: [{ image: 'team', title: 'Team', text: 'Wij' }] }));
    new ContentStore(ctx.db);
    expect(HOME.results).toEqual([{ images: ['team'], title: 'Team', text: 'Wij' }]);
  });
});
