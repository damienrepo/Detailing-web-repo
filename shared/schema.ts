// Structured data (schema.org JSON-LD) for search engines, built from the same content as the pages. Pure
// functions of the content and the site's origin, so the server render, the browser and the tests share them.
import type { PostSummary } from './blog';
import { productPhotos, type Product } from './catalog';
import type { Service } from './services';
import { SITE } from './site';

type Json = Record<string, unknown>;

/** Absolute URL of an image reference (uploaded "m_…", built-in name, "/path" or full URL). */
export function absoluteImage(origin: string, ref: string): string {
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith('/')) return origin + ref;
  if (/^m_[a-z0-9]{16}$/.test(ref)) return `${origin}/media/${ref}.jpg`;
  return `${origin}/services/${ref}.jpg`;
}

const DAYS: Record<string, string> = {
  maandag: 'Monday', ma: 'Monday',
  dinsdag: 'Tuesday', di: 'Tuesday',
  woensdag: 'Wednesday', wo: 'Wednesday',
  donderdag: 'Thursday', do: 'Thursday',
  vrijdag: 'Friday', vr: 'Friday',
  zaterdag: 'Saturday', za: 'Saturday',
  zondag: 'Sunday', zo: 'Sunday',
};
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Opening hours as typed in the admin ("Maandag – vrijdag" / "08:30 – 18:00") → OpeningHoursSpecification.
 * Rows without a time ("Gesloten", "Op afspraak") are left out; unreadable rows too, rather than guessed.
 */
export function openingHours(hours: { days: string; time: string }[]): Json[] {
  const out: Json[] = [];
  for (const row of hours) {
    const time = row.time.match(/(\d{1,2})[:.](\d{2})\s*(?:[–—-]|tot)\s*(\d{1,2})[:.](\d{2})/);
    if (!time) continue;
    const pad = (h: string) => h.padStart(2, '0');
    const days = new Set<string>();
    for (const part of row.days.toLowerCase().split(/,|\ben\b|&/)) {
      const names = part.match(/[a-z]+/g)?.filter((w) => DAYS[w]) ?? [];
      if (names.length === 1) days.add(DAYS[names[0]]);
      if (names.length >= 2 && /[–—-]|t\/m|tot/.test(part)) {
        const from = WEEK.indexOf(DAYS[names[0]]);
        const to = WEEK.indexOf(DAYS[names[names.length - 1]]);
        for (let i = from; i <= (to >= from ? to : to + 7); i++) days.add(WEEK[i % 7]);
      } else if (names.length >= 2) names.forEach((n) => days.add(DAYS[n]));
    }
    if (!days.size) continue;
    out.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: WEEK.filter((d) => days.has(d)),
      opens: `${pad(time[1])}:${time[2]}`,
      closes: `${pad(time[3])}:${time[4]}`,
    });
  }
  return out;
}

const businessId = (origin: string) => `${origin}/#business`;

/** The business itself: name, address, opening hours, area served and social profiles. */
export function businessSchema(origin: string): Json {
  const { address } = SITE;
  const fullAddress = [address.street, `${address.postalCode} ${address.city}`.trim()].filter((s) => s.trim()).join(', ');
  const hours = openingHours(SITE.hours);
  const social = [SITE.social.instagram, SITE.social.tiktok].filter((url) => /^https:\/\//.test(url));
  return {
    '@context': 'https://schema.org',
    '@type': 'AutomotiveBusiness',
    '@id': businessId(origin),
    name: SITE.fullName,
    description: SITE.description,
    url: `${origin}/`,
    image: `${origin}/og-image.png`,
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      ...(address.street ? { streetAddress: address.street } : {}),
      ...(address.postalCode ? { postalCode: address.postalCode } : {}),
      addressLocality: address.city,
      addressCountry: 'NL',
    },
    ...(fullAddress ? { hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${SITE.fullName}, ${fullAddress}`)}` } : {}),
    areaServed: [
      { '@type': 'City', name: address.city || 'Enschede' },
      { '@type': 'AdministrativeArea', name: 'Twente' },
    ],
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(social.length ? { sameAs: social } : {}),
  };
}

/** The site's name in search results. */
export function websiteSchema(origin: string): Json {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.fullName, url: `${origin}/`, inLanguage: 'nl-NL', publisher: { '@id': businessId(origin) } };
}

/** Home › … › current page. */
export function breadcrumbSchema(origin: string, trail: { name: string; path: string }[]): Json {
  const items = [{ name: 'Home', path: '/' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: origin + item.path })),
  };
}

export function faqSchema(faq: { q: string; a: string }[]): Json | undefined {
  const items = faq.filter((f) => f.q.trim() && f.a.trim());
  if (!items.length) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function serviceSchema(origin: string, service: Service): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: service.name,
    description: service.summary,
    url: `${origin}/diensten/${service.id}`,
    image: absoluteImage(origin, service.image),
    provider: { '@id': businessId(origin) },
    areaServed: [
      { '@type': 'City', name: SITE.address.city || 'Enschede' },
      { '@type': 'AdministrativeArea', name: 'Twente' },
    ],
    ...(service.fromPrice !== null && {
      offers: { '@type': 'Offer', priceCurrency: 'EUR', price: (service.fromPrice / 100).toFixed(2), url: `${origin}/diensten/${service.id}` },
    }),
  };
}

export function servicesListSchema(origin: string, services: Service[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${origin}/diensten/${s.id}`, name: s.name })),
  };
}

export function productSchema(origin: string, product: Product): Json {
  const url = `${origin}/shop/${product.slug}`;
  const photos = productPhotos(product);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description.join(' '),
    sku: product.sku,
    url,
    ...(photos.length ? { image: photos.map((ref) => absoluteImage(origin, ref)) } : {}),
    brand: { '@type': 'Brand', name: SITE.fullName },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      price: (product.price / 100).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': businessId(origin) },
    },
  };
}

export function postSchema(origin: string, post: PostSummary): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    url: `${origin}/blog/${post.slug}`,
    mainEntityOfPage: `${origin}/blog/${post.slug}`,
    inLanguage: 'nl-NL',
    ...(post.cover ? { image: absoluteImage(origin, post.cover) } : {}),
    author: { '@type': 'Organization', name: SITE.fullName, url: `${origin}/` },
    publisher: { '@id': businessId(origin) },
  };
}
