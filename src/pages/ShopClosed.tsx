import { Store } from 'lucide-react';
import { SITE } from '../../shared/site';
import { ButtonLink } from '../components/ui';
import { usePageMeta } from '../lib/meta';

/** Shown on /shop, product pages and checkout while the webshop is switched off in the admin. */
export default function ShopClosed() {
  usePageMeta('Webshop gesloten', undefined, { noindex: true });
  return (
    <div className="flex min-h-[80vh] items-center bg-paper pt-16 text-ink md:pt-[72px]">
      <div className="container-page max-w-2xl py-20 text-center">
        <Store className="mx-auto h-10 w-10 text-accent-strong" strokeWidth={1.4} aria-hidden />
        <h1 className="font-display mt-8 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02]">De webshop is even gesloten</h1>
        <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-stone-dark">
          We zijn de shop aan het voorbereiden. Binnenkort kun je hier onze producten bestellen. Wil je nu al iets? Bel of app{' '}
          <a href={`tel:${SITE.phoneHref}`} className="text-ink underline underline-offset-4">
            {SITE.phone}
          </a>{' '}
          of mail{' '}
          <a href={`mailto:${SITE.email}`} className="text-ink underline underline-offset-4">
            {SITE.email}
          </a>
          .
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink to="/diensten" variant="dark" arrow>
            Bekijk onze diensten
          </ButtonLink>
          <ButtonLink to="/afspraak" variant="outline-dark">
            Afspraak aanvragen
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
