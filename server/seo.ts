import type { PostSummary } from '../shared/blog';
import { getProductBySlug } from '../shared/catalog';
import { SHOP } from '../shared/content';
import { formatPrice } from '../shared/pricing';
import { getService, serviceMetaDescription } from '../shared/services';
import { SITE } from '../shared/site';

type PageMeta = { title: string; description: string; status: number; noindex?: boolean; image?: string; type?: 'article' };

export type RenderOptions = {
  /** Edited content (already escaped for embedding), applied in the browser before the first render. */
  contentJson?: string;
  findPost?: (slug: string) => Pick<PostSummary, 'title' | 'excerpt' | 'cover'> | undefined;
};

// A function, so edited business details show up without a restart.
const staticPages = (): Record<string, { title?: string; description?: string; noindex?: boolean }> => ({
  '/': {},
  '/diensten': {
    title: 'Diensten',
    description: `Luxe handwas, handwas abonnement, interieurreiniging, technische ruimte, polijsten, glascoating, PPF en schadeherstel in ${SITE.region}.`,
  },
  '/shop': {
    title: 'Shop — interieurverzorging',
    description: 'Producten voor het onderhoud van je auto, dezelfde die wij dagelijks gebruiken.',
  },
  '/over-ons': { title: 'Over ons', description: `Het verhaal achter ${SITE.fullName}: wie we zijn, waarom we het doen en waar we voor staan.` },
  '/blog': { title: 'Blog', description: `Tips, behandelingen en projecten van ${SITE.fullName}.` },
  '/team': { title: 'Ons team', description: `Maak kennis met de mensen achter ${SITE.fullName}.` },
  '/afspraak': {
    title: 'Afspraak aanvragen',
    description: 'Vraag een afspraak of offerte aan voor handwas, interieurreiniging, polijsten, glascoating, PPF of schadeherstel.',
  },
  '/contact': { title: 'Contact', description: `Bel of app ${SITE.phone} of mail ${SITE.email}. Op locatie in ${SITE.region} of in onze werkplaats.` },
  '/voorwaarden': { title: 'Algemene voorwaarden' },
  '/privacy': { title: 'Privacybeleid' },
  '/retourneren': { title: 'Retourneren & herroepingsrecht' },
  '/verzending': { title: 'Verzending & betalen' },
  '/afrekenen': { title: 'Afrekenen', noindex: true },
});

/** Public URL of an image reference (uploaded, built-in or absolute). */
export function imagePath(ref: string) {
  if (/^https?:\/\//.test(ref) || ref.startsWith('/')) return ref;
  if (/^m_[a-z0-9]{16}$/.test(ref)) return `/media/${ref}.jpg`;
  return `/services/${ref}.jpg`;
}

/** Title, description and HTTP status for a client-side route, so crawlers and link previews get real values. */
export function metaForPath(pathname: string, options: RenderOptions = {}): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (path === '/admin' || path.startsWith('/admin/')) return { title: 'Beheer', description: SITE.description, status: 200, noindex: true };
  // A closed webshop is kept out of search results entirely.
  if (!SHOP.enabled && (path === '/shop' || path.startsWith('/shop/') || path === '/afrekenen')) {
    return { title: 'Webshop gesloten', description: SITE.description, status: 404, noindex: true };
  }
  const fixed = staticPages()[path];
  if (fixed) {
    return { title: fixed.title ?? '', description: fixed.description ?? SITE.description, status: 200, noindex: fixed.noindex };
  }
  const product = path.startsWith('/shop/') ? getProductBySlug(path.slice(6)) : undefined;
  if (product) {
    return {
      title: product.name,
      description: `${product.tagline} ${formatPrice(product.price)} incl. btw.`,
      status: 200,
      image: product.image ? imagePath(product.image) : undefined,
    };
  }
  const service = path.startsWith('/diensten/') ? getService(path.slice(10)) : undefined;
  if (service) return { title: service.name, description: serviceMetaDescription(service), status: 200, image: imagePath(service.image) };
  const post = path.startsWith('/blog/') ? options.findPost?.(path.slice(6)) : undefined;
  if (post) {
    return {
      title: post.title,
      description: post.excerpt || SITE.description,
      status: 200,
      type: 'article',
      image: post.cover ? imagePath(post.cover) : undefined,
    };
  }
  if (/^\/bestelling\/[\w-]+$/.test(path)) return { title: 'Je bestelling', description: SITE.description, status: 200, noindex: true };
  return { title: 'Pagina niet gevonden', description: SITE.description, status: 404, noindex: true };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderIndex(html: string, pathname: string, appUrl: string, options: RenderOptions = {}): { html: string; status: number } {
  const meta = metaForPath(pathname, options);
  const title = escape(meta.title ? `${meta.title} | ${SITE.fullName}` : `${SITE.fullName} — ${SITE.tagline}`);
  const description = escape(meta.description);
  const url = escape(appUrl + (pathname === '/' ? '/' : pathname.replace(/\/$/, '')));
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : '',
    options.contentJson ? `<script type="application/json" id="site-content">${options.contentJson}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`);
  out = meta.image
    ? out.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${escape(meta.image.startsWith('/') ? appUrl + meta.image : meta.image)}$2`)
    : out.replace(/(<meta\s+property="og:image"\s+content=")\//, `$1${escape(appUrl)}/`);
  if (meta.type) out = out.replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/, `$1${meta.type}$2`);
  out = out.replace('</head>', `    ${head}\n  </head>`);
  return { html: out, status: meta.status };
}
