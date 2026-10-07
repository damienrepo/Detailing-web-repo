import { getProductBySlug } from '../shared/catalog';
import { formatPrice } from '../shared/pricing';
import { SITE } from '../shared/site';

type PageMeta = { title: string; description: string; status: number; noindex?: boolean };

const STATIC: Record<string, { title?: string; description?: string; noindex?: boolean }> = {
  '/': {},
  '/shop': {
    title: 'Shop — interieurverzorging',
    description: 'Interior Cleaner, Interior Detailing Brush, microvezel doek en de voordelige Interior Care Kit.',
  },
  '/afspraak': {
    title: 'Afspraak aanvragen',
    description: 'Vraag een afspraak aan voor lakcorrectie, keramische coating of interieur detailing.',
  },
  '/contact': { title: 'Contact', description: `Bezoek de studio in ${SITE.address.city}, bel ${SITE.phone} of mail ${SITE.email}.` },
  '/voorwaarden': { title: 'Algemene voorwaarden' },
  '/privacy': { title: 'Privacybeleid' },
  '/retourneren': { title: 'Retourneren & herroepingsrecht' },
  '/verzending': { title: 'Verzending & betalen' },
  '/afrekenen': { title: 'Afrekenen', noindex: true },
  '/admin': { title: 'Beheer', noindex: true },
};

/** Title, description and HTTP status for a client-side route, so crawlers and link previews get real values. */
export function metaForPath(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const fixed = STATIC[path];
  if (fixed) {
    return { title: fixed.title ?? '', description: fixed.description ?? SITE.description, status: 200, noindex: fixed.noindex };
  }
  const product = path.startsWith('/shop/') ? getProductBySlug(path.slice(6)) : undefined;
  if (product) {
    return {
      title: product.name,
      description: `${product.tagline} ${formatPrice(product.price)} incl. btw.`,
      status: 200,
    };
  }
  if (/^\/bestelling\/[\w-]+$/.test(path)) return { title: 'Je bestelling', description: SITE.description, status: 200, noindex: true };
  return { title: 'Pagina niet gevonden', description: SITE.description, status: 404, noindex: true };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderIndex(html: string, pathname: string, appUrl: string): { html: string; status: number } {
  const meta = metaForPath(pathname);
  const title = escape(meta.title ? `${meta.title} | ${SITE.fullName}` : `${SITE.fullName} — ${SITE.tagline}`);
  const description = escape(meta.description);
  const url = escape(appUrl + (pathname === '/' ? '/' : pathname.replace(/\/$/, '')));
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : '',
  ].join('\n    ');
  const out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")\//, `$1${escape(appUrl)}/`)
    .replace('</head>', `    ${head}\n  </head>`);
  return { html: out, status: meta.status };
}
