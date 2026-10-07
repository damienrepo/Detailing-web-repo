import { Check, ChevronRight, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { BUNDLE_ID, getProduct, getProductBySlug, PRODUCTS, type Product } from '../../shared/catalog';
import { formatPrice } from '../../shared/pricing';
import { SITE } from '../../shared/site';
import { ProductImage } from '../components/ProductArt';
import { ShopUsps } from '../components/ShopUsps';
import { Button, ButtonLink, Price, QuantityStepper } from '../components/ui';
import { useCart } from '../lib/cart';
import { usePageMeta, useStructuredData } from '../lib/meta';
import NotFound from './NotFound';

export default function ProductPage() {
  const { slug } = useParams();
  const product = slug ? getProductBySlug(slug) : undefined;
  if (!product) return <NotFound />;
  // Keyed so quantity resets when navigating between products.
  return <ProductDetail key={product.id} product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);

  usePageMeta(product.name, `${product.tagline} ${formatPrice(product.price)} incl. btw. Verzonden binnen ${SITE.dispatchDays}.`);
  useStructuredData('product', {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description.join(' '),
    sku: product.sku,
    brand: { '@type': 'Brand', name: SITE.fullName },
    offers: {
      '@type': 'Offer',
      url: location.href,
      priceCurrency: 'EUR',
      price: (product.price / 100).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  });

  const bundle = getProduct(BUNDLE_ID)!;
  const partOfBundle = bundle.includes!.some((i) => i.productId === product.id);
  const others = PRODUCTS.filter((p) => p.id !== product.id && p.id !== BUNDLE_ID);

  return (
    <div className="bg-paper pt-16 text-ink md:pt-[72px]">
      <nav aria-label="Kruimelpad" className="container-page py-5 text-sm text-stone-dark">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link to="/shop" className="hover:text-ink">
              Shop
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <section className="container-page grid gap-10 pb-20 md:grid-cols-12 md:gap-12 lg:gap-16">
        <div className="md:col-span-7">
          <div className="md:sticky md:top-24">
            <div className="relative">
              <ProductImage productId={product.id} />
              {product.badge && <span className="eyebrow absolute left-4 top-4 bg-accent px-2.5 py-1.5 text-white">{product.badge}</span>}
            </div>
          </div>
        </div>

        <div className="md:col-span-5">
          <p className="eyebrow text-stone-dark">
            {product.category} · {product.size}
          </p>
          <h1 className="font-display mt-3 text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.02]">{product.name}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-stone-dark">{product.tagline}</p>

          <div className="mt-8 flex items-baseline gap-3">
            <Price cents={product.price} compareAt={product.compareAtPrice} className="text-3xl font-semibold" />
            <span className="text-sm text-stone-dark">incl. btw</span>
          </div>
          <p className={`mt-2 flex items-center gap-2 text-sm ${product.inStock ? 'text-[#2f6b4f]' : 'text-accent-strong'}`}>
            <span className={`h-2 w-2 rounded-full ${product.inStock ? 'bg-[#2f6b4f]' : 'bg-accent-strong'}`} aria-hidden />
            {product.inStock ? `Op voorraad · verzonden binnen ${SITE.dispatchDays}` : 'Tijdelijk uitverkocht'}
          </p>

          <div className="mt-8 flex gap-3">
            <QuantityStepper label={`Aantal ${product.name}`} value={quantity} onChange={(q) => setQuantity(Math.max(1, q))} />
            <Button
              variant="dark"
              className="flex-1"
              disabled={!product.inStock}
              onClick={() => {
                add(product.id, quantity);
                setQuantity(1);
              }}
            >
              {product.inStock ? 'In winkelwagen' : 'Uitverkocht'}
            </Button>
          </div>

          {product.includes && (
            <div className="mt-10">
              <h2 className="eyebrow text-stone-dark">In deze set</h2>
              <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
                {product.includes.map((inc) => {
                  const p = getProduct(inc.productId)!;
                  return (
                    <li key={p.id}>
                      <Link to={`/shop/${p.slug}`} className="flex items-center gap-4 py-3 hover:bg-ink/[0.03]">
                        <ProductImage productId={p.id} className="w-14 shrink-0" />
                        <span className="flex-1">
                          <span className="block font-medium">
                            {inc.quantity} × {p.name}
                          </span>
                          <span className="text-sm text-stone-dark">{p.size}</span>
                        </span>
                        <span className="tabular text-sm text-stone-dark">{formatPrice(p.price)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="tabular mt-3 flex justify-between text-sm">
                <span>Los gekocht</span>
                <span>
                  <s className="text-stone-dark">{formatPrice(product.compareAtPrice!)}</s>{' '}
                  <strong className="text-accent-strong">je bespaart {formatPrice(product.compareAtPrice! - product.price)}</strong>
                </span>
              </p>
            </div>
          )}

          {partOfBundle && (
            <Link to={`/shop/${bundle.slug}`} className="group mt-10 flex items-center gap-4 border border-ink/15 bg-white p-4 transition-colors hover:border-ink">
              <ProductImage productId={bundle.id} className="w-16 shrink-0" />
              <span className="flex-1 text-sm">
                <span className="block font-medium">Voordeliger in de {bundle.name}</span>
                <span className="text-stone-dark">
                  Cleaner, borstel en doek voor {formatPrice(bundle.price)} — {bundle.badge?.toLowerCase()}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}

          <div className="mt-10 border-t border-ink/10 pt-8">
            <ShopUsps compact />
          </div>

          <div className="mt-10 border-t border-ink/15">
            <Section title="Beschrijving" defaultOpen>
              {product.description.map((p) => (
                <p key={p} className="mb-4 leading-relaxed text-stone-dark last:mb-0">
                  {p}
                </p>
              ))}
              <ul className="mt-6 grid gap-2 text-[15px] sm:grid-cols-2">
                {product.highlights.map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Gebruik">
              <ol className="space-y-3">
                {product.usage.map((step, i) => (
                  <li key={step} className="flex gap-4 leading-relaxed text-stone-dark">
                    <span className="tabular font-mono text-sm text-ink">{String(i + 1).padStart(2, '0')}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Section>
            <Section title="Specificaties">
              <dl className="divide-y divide-ink/10 text-[15px]">
                {product.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-5 gap-4 py-2.5">
                    <dt className="col-span-2 text-stone-dark">{s.label}</dt>
                    <dd className="col-span-3">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section title="Verzending & retour">
              <p className="leading-relaxed text-stone-dark">
                Op werkdagen verzonden binnen {SITE.dispatchDays} met {SITE.carrier}. Je hebt {SITE.returnDays} dagen
                bedenktijd na ontvangst.{' '}
                <Link to="/verzending" className="text-ink underline underline-offset-4">
                  Verzending & betalen
                </Link>{' '}
                ·{' '}
                <Link to="/retourneren" className="text-ink underline underline-offset-4">
                  Retourneren
                </Link>
              </p>
            </Section>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-paper-3 bg-paper-2/50 py-16 md:py-20">
          <div className="container-page">
            <div className="flex items-end justify-between gap-6">
              <h2 className="font-display text-3xl">Combineer met</h2>
              <ButtonLink to="/shop" variant="outline-dark" className="h-10 text-sm max-sm:hidden">
                Alle producten
              </ButtonLink>
            </div>
            <div className={`mt-8 grid gap-px bg-paper-3 ${others.length === 3 ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {others.map((p) => (
                <Link key={p.id} to={`/shop/${p.slug}`} className="group flex items-center gap-5 bg-paper p-4">
                  <ProductImage productId={p.id} className="w-24 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium group-hover:underline">{p.name}</p>
                    <p className="text-sm text-stone-dark">{p.tagline}</p>
                  </div>
                  <Price cents={p.price} className="font-medium" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-b border-ink/15">
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <Plus className="h-4 w-4 transition-transform duration-200 group-open:rotate-45" aria-hidden />
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}
