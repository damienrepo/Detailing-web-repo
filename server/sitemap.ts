// The sitemap and IndexNow (A6 in docs/SEO-PLAN.md). The sitemap lists every public page with the date it last
// changed and its photos; IndexNow tells Bing, Yandex and others right away when content changes.
import crypto from 'node:crypto';
import { listedProducts, productPhotos } from '../shared/catalog';
import { ABOUT, HOME, SHOP } from '../shared/content';
import { absoluteImage } from '../shared/schema';
import { listedServices } from '../shared/services';
import { listPublishedPosts } from './blog';
import type { Db } from './db';
import { listVisibleTeam } from './team';

export type SitemapEntry = { path: string; lastmod?: string; images: string[] };

/** SQLite "2026-10-14 09:30:00" (UTC) → "2026-10-14". */
const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : undefined);
const latest = (...values: (string | undefined)[]) => values.filter(Boolean).sort().at(-1);

function contentChanged(db: Db, key: string) {
  const row = db.prepare('SELECT updated_at FROM content WHERE key = ?').get(key) as { updated_at: string } | undefined;
  return day(row?.updated_at);
}

/** Every public page, in the order of the site. A page without a known change date gets no lastmod. */
export function sitemapEntries(db: Db, origin: string): SitemapEntry[] {
  const img = (ref: string | null | undefined) => (ref ? [absoluteImage(origin, ref)] : []);
  const services = contentChanged(db, 'services');
  const products = contentChanged(db, 'products');
  const site = contentChanged(db, 'site');
  const posts = listPublishedPosts(db);
  const team = listVisibleTeam(db);
  const teamChanged = day(
    (db.prepare('SELECT MAX(updated_at) AS t FROM team_members WHERE visible = 1').get() as { t: string | null }).t,
  );
  const postsChanged = day((db.prepare(`SELECT MAX(updated_at) AS t FROM posts WHERE status = 'published'`).get() as { t: string | null }).t);

  return [
    { path: '/', lastmod: latest(contentChanged(db, 'home'), services, site), images: [...img(HOME.heroImage), ...HOME.results.flatMap((r) => r.images.slice(0, 1).flatMap(img))] },
    { path: '/diensten', lastmod: services, images: [] },
    { path: '/over-ons', lastmod: latest(contentChanged(db, 'about'), teamChanged), images: img(ABOUT.image) },
    ...listedServices().map((s) => ({
      path: `/diensten/${s.id}`,
      lastmod: services,
      images: [...img(s.image), ...img(s.detailImage?.src), ...(s.options ?? []).flatMap((g) => g.options.flatMap((o) => img(o.image)))],
    })),
    ...(SHOP.enabled
      ? [
          { path: '/shop', lastmod: products, images: [] },
          ...listedProducts().map((p) => ({ path: `/shop/${p.slug}`, lastmod: products, images: productPhotos(p).flatMap(img) })),
        ]
      : []),
    { path: '/blog', lastmod: postsChanged, images: [] },
    ...posts.map((p) => ({
      path: `/blog/${p.slug}`,
      lastmod: day((db.prepare('SELECT updated_at FROM posts WHERE slug = ?').get(p.slug) as { updated_at: string } | undefined)?.updated_at) ?? p.publishedAt,
      images: img(p.cover),
    })),
    { path: '/team', lastmod: teamChanged, images: team.flatMap((m) => img(m.photo)) },
    { path: '/afspraak', lastmod: services, images: [] },
    { path: '/verzending', lastmod: contentChanged(db, 'shipping'), images: [] },
    { path: '/retourneren', images: [] },
    { path: '/voorwaarden', images: [] },
    { path: '/privacy', images: [] },
    { path: '/contact', lastmod: site, images: [] },
  ].map((e) => ({ ...e, images: [...new Set(e.images)] }));
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(entries: SitemapEntry[], origin: string) {
  const urls = entries
    .map((e) =>
      [
        '  <url>',
        `    <loc>${xml(origin + e.path)}</loc>`,
        ...(e.lastmod ? [`    <lastmod>${e.lastmod}</lastmod>`] : []),
        ...e.images.map((src) => `    <image:image><image:loc>${xml(src)}</image:loc></image:image>`),
        '  </url>',
      ].join('\n'),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
}

// --- IndexNow ---------------------------------------------------------------------------

const KEY_ROW = '_indexnow_key';

/** The site's IndexNow key, created once and kept in the content table (which ignores unknown keys). */
export function indexNowKey(db: Db): string {
  const row = db.prepare('SELECT value FROM content WHERE key = ?').get(KEY_ROW) as { value: string } | undefined;
  if (row && /^[a-f0-9]{32}$/.test(row.value)) return row.value;
  const key = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)').run(KEY_ROW, key);
  return key;
}

/**
 * Tells IndexNow-search engines (Bing, Yandex, Seznam, Naver…) about changed pages. Changes are collected for a
 * few minutes and sent together; nothing is sent for non-https sites (development) or without changes.
 */
export class IndexNow {
  private pending = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private db: Db,
    private origin: string,
    private fetchImpl: typeof fetch = fetch,
    private delayMs = 5 * 60_000,
  ) {}

  get enabled() {
    return /^https:\/\/(?!localhost|127\.)/.test(this.origin);
  }

  /** Marks pages as changed; with no paths, the whole sitemap. */
  notify(paths?: string[]) {
    if (!this.enabled) return;
    for (const p of paths ?? sitemapEntries(this.db, this.origin).map((e) => e.path)) this.pending.add(p);
    if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.delayMs);
      this.timer.unref?.();
    }
  }

  async flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.pending.size) return;
    const urlList = [...this.pending].map((p) => this.origin + p);
    this.pending.clear();
    try {
      const res = await this.fetchImpl('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: new URL(this.origin).host, key: indexNowKey(this.db), keyLocation: `${this.origin}/${indexNowKey(this.db)}.txt`, urlList }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok && res.status !== 202) console.error(`[indexnow] HTTP ${res.status}`);
    } catch (err) {
      console.error('[indexnow]', err instanceof Error ? err.message : err);
    }
  }
}
