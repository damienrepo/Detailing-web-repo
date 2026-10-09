import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { metaForPath, renderIndex } from './seo';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('renderIndex', () => {
  it('puts the product title, description and canonical URL in the HTML', () => {
    const page = renderIndex(html, '/shop/interior-care-kit', 'https://example.nl');
    expect(page.status).toBe(200);
    expect(page.html).toContain('<title>Interior Care Kit | Detail2Go</title>');
    expect(page.html).toMatch(/name="description"\s+content="Cleaner, borstel en doek[^"]*€\s?29,95 incl\. btw\."/);
    expect(page.html).toContain('<link rel="canonical" href="https://example.nl/shop/interior-care-kit" />');
    expect(page.html).toContain('content="https://example.nl/og-image.png"');
    expect(page.html).not.toContain('noindex');
  });

  it('describes service pages, with a price when there is one', () => {
    const coating = metaForPath('/diensten/coatings');
    expect(coating).toMatchObject({ title: 'Glascoating', status: 200 });
    expect(coating.description).toMatch(/Vanaf €\s?1\.119,25 incl\. btw\.$/);
    expect(metaForPath('/diensten/ppf').description).toMatch(/Prijs op aanvraag\.$/);
    expect(metaForPath('/diensten').status).toBe(200);
  });

  it('returns 404 for unknown pages, products and services', () => {
    expect(renderIndex(html, '/bestaat-niet', 'https://example.nl').status).toBe(404);
    expect(metaForPath('/shop/onbekend').status).toBe(404);
    expect(metaForPath('/diensten/onbekend').status).toBe(404);
  });

  it('keeps private pages out of search results', () => {
    expect(renderIndex(html, '/bestelling/abc_123', 'https://example.nl').html).toContain('noindex');
    expect(metaForPath('/afrekenen').noindex).toBe(true);
  });

  it('escapes values', () => {
    expect(renderIndex(html, '/', 'https://example.nl/"x').html).not.toContain('/"x"');
  });
});
