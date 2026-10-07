import { ButtonLink } from '../components/ui';
import { usePageMeta } from '../lib/meta';

export default function NotFound() {
  usePageMeta('Pagina niet gevonden', undefined, { noindex: true });
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center bg-paper px-5 pt-24 text-center text-ink">
      <p className="eyebrow text-accent-strong">404</p>
      <h1 className="font-display mt-4 text-4xl md:text-5xl">Deze pagina bestaat niet</h1>
      <p className="mt-4 max-w-md text-stone-dark">De link is misschien verouderd of er zit een typefout in het adres.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/" variant="dark">
          Naar home
        </ButtonLink>
        <ButtonLink to="/shop" variant="outline-dark">
          Naar de shop
        </ButtonLink>
      </div>
    </div>
  );
}
