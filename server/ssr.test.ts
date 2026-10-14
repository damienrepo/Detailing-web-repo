import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { SITE } from '../shared/site';
import { businessSchema, faqSchema, openingHours } from '../shared/schema';
import { render } from '../src/entry-server';
import { injectRender, shouldServerRender, ssrDataFor } from './ssr';
import { setup, signedIn } from './testUtils';

const ORIGIN = 'https://www.detail2go.nl';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('server rendering', () => {
  it('renders every public page with its text and valid JSON-LD', async () => {
    const pages: [string, string, string[]][] = [
      ['/', 'Diensten', ['business', 'website', 'faq']],
      ['/diensten', 'PPF lakbeschermingsfolie', ['services', 'breadcrumbs']],
      ['/diensten/ppf', 'Hoe onderhoud ik PPF?', ['service', 'breadcrumbs', 'faq']],
      ['/shop/interior-care-kit', 'Interieur', ['product', 'breadcrumbs']],
      ['/contact', SITE.phone, ['business', 'breadcrumbs']],
      ['/privacy', 'Cookies', []],
      ['/bestaat-niet', 'bestaat niet', []],
    ];
    for (const [url, expected, ld] of pages) {
      const out = await render({ url, origin: ORIGIN, data: {}, content: {}, contentKey: 'test' });
      expect(text(out.html), url).toContain(expected);
      expect(Object.keys(out.structuredData).sort(), url).toEqual([...ld].sort());
      for (const json of Object.values(out.structuredData)) expect(JSON.parse(JSON.stringify(json))).toMatchObject({ '@context': 'https://schema.org' });
    }
  });

  it('renders preloaded data, such as the team and a blog post', async () => {
    const team = await render({
      url: '/team',
      origin: ORIGIN,
      data: { team: [{ id: 1, name: 'Stein Veldman', role: 'Medeoprichter', bio: 'Begon op de oprit.', quote: '', photo: null, facts: [] }] },
      content: {},
      contentKey: 'test',
    });
    expect(text(team.html)).toContain('Stein Veldman');
    const missing = await render({ url: '/blog/weg', origin: ORIGIN, data: { post: { slug: 'weg', data: null } }, content: {}, contentKey: 'test' });
    expect(text(missing.html)).toContain('bestaat niet');
  });

  it('uses the content edited in the admin', async () => {
    const out = await render({ url: '/contact', origin: ORIGIN, data: {}, content: { site: { ...SITE, phone: '06 99 88 77 66' } }, contentKey: 'edited' });
    expect(text(out.html)).toContain('06 99 88 77 66');
    await render({ url: '/contact', origin: ORIGIN, data: {}, content: {}, contentKey: 'default' });
  });

  it('serves server-rendered HTML for public pages only', async () => {
    expect(shouldServerRender('/diensten/ppf')).toBe(true);
    for (const p of ['/admin', '/admin/producten', '/afrekenen', '/bestelling/abc']) expect(shouldServerRender(p)).toBe(false);
  });

  it('cannot be broken out of with data containing </script>', () => {
    const html = injectRender('<html><head></head><body><div id="root"></div></body></html>', { html: '<p>x</p>', structuredData: { faq: { a: '</script><script>alert(1)</script>' } } }, { team: [] });
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('<div id="root"><p>x</p></div>');
    expect(html).toContain('id="ssr-data"');
  });

  it('preloads the team and published posts per page', async () => {
    const ctx = setup();
    const client = await signedIn(ctx);
    await client.post('/api/admin/team').send({ name: 'Bram', role: 'Detailer', bio: '', quote: '', photo: null, facts: [], visible: true }).expect(201);
    expect(ssrDataFor(ctx.db, '/over-ons').team?.map((m) => m.name)).toEqual(['Bram']);
    expect(ssrDataFor(ctx.db, '/blog/geen-bericht')).toEqual({ post: { slug: 'geen-bericht', data: null } });
    expect(ssrDataFor(ctx.db, '/diensten')).toEqual({});
    expect((await request(ctx.app).get('/api/health')).status).toBe(200);
  });
});

describe('structured data', () => {
  it('reads opening hours as typed in the admin', () => {
    expect(
      openingHours([
        { days: 'Maandag – vrijdag', time: '08:30 – 18:00' },
        { days: 'Zaterdag', time: '(Op Afspraak)' },
        { days: 'Zondag', time: 'Gesloten' },
        { days: 'za, zo', time: '10.00 - 16.00' },
      ]),
    ).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:30', closes: '18:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday'], opens: '10:00', closes: '16:00' },
    ]);
    expect(openingHours([{ days: 'Altijd', time: '9 uur' }])).toEqual([]);
  });

  it('describes the business with address, hours, area and profiles', () => {
    const business = businessSchema(ORIGIN);
    expect(business).toMatchObject({ '@type': 'AutomotiveBusiness', '@id': `${ORIGIN}/#business`, url: `${ORIGIN}/`, telephone: SITE.phone });
    expect(business.sameAs).toEqual([SITE.social.instagram, SITE.social.tiktok]);
    expect(business.areaServed).toEqual([{ '@type': 'City', name: SITE.address.city }, { '@type': 'AdministrativeArea', name: 'Twente' }]);
    expect(faqSchema([])).toBeUndefined();
  });
});
