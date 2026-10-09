import { Link } from 'react-router';
import { getBundle, listedProducts, type Product } from '../../shared/catalog';
import { ProductImage } from '../components/ProductArt';
import { ShopUsps } from '../components/ShopUsps';
import { Button, Eyebrow, Price } from '../components/ui';
import { useCart } from '../lib/cart';
import { usePageMeta } from '../lib/meta';

export default function Shop() {
  usePageMeta('Shop — interieurverzorging', 'Producten voor het onderhoud van je auto, dezelfde die wij dagelijks gebruiken. Verzonden binnen 1–2 werkdagen.');
  const kit = getBundle();
  const singles = listedProducts().filter((p) => p.id !== kit?.id);

  return (
    <div className="bg-paper pt-16 text-ink md:pt-[72px]">
      <section className="container-page pb-12 pt-14 md:pb-16 md:pt-20">
        <Eyebrow className="text-stone-dark">Shop</Eyebrow>
        <div className="mt-5 grid gap-6 md:grid-cols-12 md:items-end">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] md:col-span-7">Interieurverzorging</h1>
          <p className="text-[17px] leading-relaxed text-stone-dark md:col-span-5">
            Producten die we zelf dagelijks gebruiken.{kit && ' Los te bestellen, of voordeliger als set.'}
          </p>
        </div>
      </section>

      <section className="container-page" aria-label="Producten">
        {kit && <ProductCard product={kit} featured />}
        <div className={`grid border-l border-paper-3 sm:grid-cols-2 lg:grid-cols-3 ${kit ? '' : 'border-t'}`}>
          {singles.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <ShopUsps />
      </section>
    </div>
  );
}

function ProductCard({ product, featured = false }: { product: Product; featured?: boolean }) {
  const { add } = useCart();
  const href = `/shop/${product.slug}`;

  if (featured) {
    return (
      <article className="grid border border-paper-3 bg-paper md:grid-cols-2">
        <Link to={href} className="relative block" aria-label={product.name}>
          <ProductImage productId={product.id} />
          {product.badge && <span className="eyebrow absolute left-4 top-4 bg-accent-fill px-2.5 py-1.5 text-ink">{product.badge}</span>}
        </Link>
        <div className="flex flex-col justify-center p-6 md:p-12">
          <p className="eyebrow text-stone-dark">Set · {product.size}</p>
          <h2 className="font-display mt-3 text-3xl md:text-4xl">
            <Link to={href} className="hover:underline">
              {product.name}
            </Link>
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-stone-dark">{product.tagline}</p>
          <ul className="mt-6 space-y-2 text-[15px]">
            {product.highlights.map((h) => (
              <li key={h} className="flex gap-3">
                <span className="mt-2 h-1 w-3 shrink-0 bg-accent" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-6">
            <Price cents={product.price} compareAt={product.compareAtPrice} className="text-2xl font-semibold" />
            <Button variant="dark" onClick={() => add(product.id)} disabled={!product.inStock}>
              {product.inStock ? 'In winkelwagen' : 'Uitverkocht'}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col border-b border-r border-paper-3 bg-paper">
      <Link to={href} className="block" aria-label={product.name}>
        <ProductImage productId={product.id} />
      </Link>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <p className="eyebrow text-stone-dark">
          {product.category} · {product.size}
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          <Link to={href} className="hover:underline">
            {product.name}
          </Link>
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-dark">{product.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          <Price cents={product.price} className="text-lg font-semibold" />
          <Button variant="outline-dark" className="h-10 px-4 text-sm" onClick={() => add(product.id)} disabled={!product.inStock}>
            {product.inStock ? 'Toevoegen' : 'Uitverkocht'}
          </Button>
        </div>
      </div>
    </article>
  );
}
