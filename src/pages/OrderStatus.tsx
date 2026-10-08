import { CircleCheck, CircleX, Clock, Truck } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatPrice, SHIPPING } from '../../shared/pricing';
import { SITE } from '../../shared/site';
import type { PublicOrder } from '../../server/orders';
import { Button, ButtonLink, Notice } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { goToPayment } from '../lib/demo';
import { usePageMeta } from '../lib/meta';

const POLL_MS = 3000;
const POLL_LIMIT = 40;

export default function OrderStatus() {
  usePageMeta('Je bestelling', undefined, { noindex: true });
  const { publicId = '' } = useParams();
  const cart = useCart();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PublicOrder>();
  const [error, setError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const polls = useRef(0);
  const clearCart = useRef(cart.clear);
  clearCart.current = cart.clear;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    async function load() {
      try {
        const data = await api<PublicOrder>(`/orders/${encodeURIComponent(publicId)}`);
        if (cancelled) return;
        setOrder(data);
        if (data.status === 'paid' || data.status === 'shipped') clearCart.current();
        // A payment can stay "open" for a moment after returning from the bank.
        if (data.status === 'open' && polls.current++ < POLL_LIMIT) timer = setTimeout(load, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Bestelling kon niet worden geladen');
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [publicId]);

  async function retry() {
    setRetrying(true);
    try {
      const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/orders/${encodeURIComponent(publicId)}/pay`, { method: 'POST' });
      goToPayment(checkoutUrl, navigate);
    } catch (err) {
      setRetrying(false);
      setError(err instanceof ApiError ? err.message : 'Opnieuw betalen lukte niet');
    }
  }

  return (
    <div className="min-h-screen bg-paper pt-16 text-ink md:pt-[72px]">
      <div className="container-page max-w-3xl py-12 md:py-20">
        {error && <Notice tone="error">{error}</Notice>}
        {!order && !error && <p className="text-stone-dark">Bestelling laden…</p>}
        {order && (
          <>
            <StatusHeader order={order} onRetry={retry} retrying={retrying} />

            <div className="mt-12 grid gap-px border border-paper-3 bg-paper-3 sm:grid-cols-2">
              <div className="bg-white p-6">
                <h2 className="eyebrow text-stone-dark">Bezorgadres</h2>
                <address className="mt-3 not-italic leading-relaxed">
                  {order.name}
                  <br />
                  {order.address.street} {order.address.houseNumber}
                  <br />
                  {order.address.postalCode} {order.address.city}
                  <br />
                  {SHIPPING[order.address.country].label}
                </address>
              </div>
              <div className="bg-white p-6">
                <h2 className="eyebrow text-stone-dark">Bestelling</h2>
                <p className="mt-3 leading-relaxed">
                  {order.number}
                  <br />
                  {new Date(order.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  <br />
                  <span className="text-stone-dark">Bevestiging naar {order.email}</span>
                </p>
              </div>
            </div>

            <div className="border-x border-b border-paper-3 bg-white p-6">
              <ul className="divide-y divide-ink/10">
                {order.items.map((item) => (
                  <li key={item.productId} className="tabular flex justify-between gap-4 py-2.5">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span>{formatPrice(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="tabular mt-3 space-y-1.5 border-t border-ink/10 pt-3 text-[15px]">
                <div className="flex justify-between text-stone-dark">
                  <dt>Verzending</dt>
                  <dd>{order.shipping === 0 ? 'Gratis' : formatPrice(order.shipping)}</dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt>Totaal</dt>
                  <dd>{formatPrice(order.total)}</dd>
                </div>
                <div className="flex justify-between text-sm text-stone-dark">
                  <dt>Waarvan btw</dt>
                  <dd>{formatPrice(order.vat)}</dd>
                </div>
              </dl>
            </div>

            <p className="mt-8 text-sm text-stone-dark">
              Vragen over je bestelling? Mail naar{' '}
              <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Bestelling ${order.number}`)}`} className="text-ink underline underline-offset-4">
                {SITE.email}
              </a>{' '}
              en vermeld je bestelnummer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusHeader({ order, onRetry, retrying }: { order: PublicOrder; onRetry: () => void; retrying: boolean }) {
  const firstName = order.name.split(' ')[0];
  switch (order.status) {
    case 'paid':
      return (
        <Header icon={<CircleCheck className="h-8 w-8 text-[#2f6b4f]" />} title={`Bedankt, ${firstName}!`}>
          We hebben je betaling ontvangen. Je bestelling wordt binnen {SITE.dispatchDays} verzonden met {SITE.carrier}; je
          ontvangt een track-and-trace code per e-mail.
        </Header>
      );
    case 'shipped':
      return (
        <Header icon={<Truck className="h-8 w-8 text-[#2f6b4f]" />} title="Je bestelling is onderweg">
          {order.trackingCode ? (
            <>
              Track-and-trace:{' '}
              <a
                href={`https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(order.trackingCode)}-${order.address.country}-${order.address.postalCode.replace(/\s/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink underline underline-offset-4"
              >
                {order.trackingCode}
              </a>
            </>
          ) : (
            'Je pakket is aan de vervoerder overgedragen.'
          )}
        </Header>
      );
    case 'open':
      return (
        <Header icon={<Clock className="h-8 w-8 text-stone-dark" />} title="We wachten op je betaling">
          Dit duurt meestal enkele seconden. Deze pagina wordt vanzelf bijgewerkt.
          <div className="mt-6">
            <Button variant="outline-dark" onClick={onRetry} disabled={retrying}>
              {retrying ? 'Even geduld…' : 'Betaling opnieuw starten'}
            </Button>
          </div>
        </Header>
      );
    case 'failed':
      return (
        <Header icon={<CircleX className="h-8 w-8 text-accent-strong" />} title="De betaling is niet gelukt">
          De betaling is geannuleerd of verlopen. Je bestelling staat nog klaar; probeer het opnieuw of kies een andere
          betaalmethode.
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="accent" arrow onClick={onRetry} disabled={retrying}>
              {retrying ? 'Even geduld…' : 'Opnieuw betalen'}
            </Button>
            <ButtonLink to="/shop" variant="outline-dark">
              Terug naar de shop
            </ButtonLink>
          </div>
        </Header>
      );
    case 'cancelled':
      return (
        <Header icon={<CircleX className="h-8 w-8 text-stone-dark" />} title="Deze bestelling is geannuleerd">
          Neem contact met ons op als je vragen hebt.
        </Header>
      );
  }
}

function Header({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      {icon}
      <h1 className="font-display mt-6 text-4xl md:text-5xl">{title}</h1>
      <div className="mt-4 max-w-xl text-[17px] leading-relaxed text-stone-dark">{children}</div>
    </div>
  );
}
