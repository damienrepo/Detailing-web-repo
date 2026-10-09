import { Download, RefreshCw, Search, Store, Truck } from 'lucide-react';
import { useState } from 'react';
import { formatPrice, SHIPPING } from '../../../shared/pricing';
import { findService } from '../../../shared/services';
import type { Order, OrderStatus } from '../../../server/orders';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction, DEMO } from '../../lib/demo';
import { ErrorBox, Loading, PageHeader, StatusBadge, useAdminData, useToast } from '../kit';

export type Booking = {
  id: number;
  status: 'new' | 'confirmed' | 'done' | 'cancelled';
  service_id: string;
  vehicle: string;
  preferred_date: string | null;
  name: string;
  email: string;
  phone: string;
  postal_code: string | null;
  message: string | null;
  created_at: string;
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'ok' | 'warn' | 'muted' | 'accent' }> = {
  open: { label: 'Wacht op betaling', tone: 'muted' },
  paid: { label: 'Af te handelen', tone: 'accent' },
  shipped: { label: 'Verzonden', tone: 'ok' },
  ready: { label: 'Klaar om af te halen', tone: 'accent' },
  collected: { label: 'Opgehaald', tone: 'ok' },
  failed: { label: 'Betaling mislukt', tone: 'muted' },
  cancelled: { label: 'Geannuleerd', tone: 'muted' },
};

const BOOKING_STATUS: Record<Booking['status'], string> = {
  new: 'Nieuw',
  confirmed: 'Ingepland',
  done: 'Afgerond',
  cancelled: 'Geannuleerd',
};

export function date(value: string) {
  return new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z')).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
}

async function exportCsv() {
  const res = await fetch('/api/admin/orders.csv', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Exporteren is niet gelukt.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `bestellingen-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function matches(text: string, query: string) {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

export function OrdersPage() {
  const { data: orders, error, reload } = useAdminData<Order[]>('/admin/orders');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string>();

  const visible = (orders ?? []).filter(
    (o) => (filter === 'all' || o.status === filter) && (!query || matches(`${o.number} ${o.name} ${o.email} ${o.city}`, query)),
  );
  const count = (s: OrderStatus) => (orders ?? []).filter((o) => o.status === s).length;

  return (
    <>
      <PageHeader
        title="Bestellingen"
        description="Betaalde bestellingen staan op ‘Af te handelen’. Verstuur het pakket, of zet een afhaalbestelling klaar. De klant krijgt bij elke stap automatisch een e-mail."
        actions={
          <>
            {!DEMO && (
              <Button variant="outline-dark" className="h-10 text-sm" onClick={() => exportCsv().catch((e) => setActionError(e.message))}>
                <Download className="h-4 w-4" aria-hidden />
                Exporteer naar Excel
              </Button>
            )}
            <Button variant="outline-dark" className="h-10 text-sm" onClick={reload} aria-label="Vernieuwen">
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
          </>
        }
      />
      {(error || actionError) && <ErrorBox message={error ?? actionError!} onRetry={reload} />}
      {!orders ? (
        !error && <Loading />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              {(['all', 'paid', 'ready', 'shipped', 'collected', 'open', 'failed', 'cancelled'] as const)
                .filter((f) => f === 'all' || f === 'paid' || count(f) > 0)
                .map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`border px-3 py-1.5 ${filter === f ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-white hover:border-ink'}`}
                >
                  {f === 'all' ? `Alle (${orders.length})` : `${ORDER_STATUS[f].label} (${count(f)})`}
                </button>
              ))}
            </div>
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-dark" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op naam, nummer, plaats…"
                aria-label="Zoeken"
                className="h-10 w-64 border border-paper-3 bg-white pl-9 pr-3 text-sm outline-none focus:border-ink"
              />
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="py-16 text-center text-stone-dark">{orders.length === 0 ? 'Nog geen bestellingen. Ze verschijnen hier zodra iemand iets koopt.' : 'Geen bestellingen gevonden.'}</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {visible.map((order) => (
                <OrderCard key={order.id} order={order} onChange={reload} onError={setActionError} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function OrderCard({ order, onChange, onError }: { order: Order; onChange: () => void; onError: (m: string) => void }) {
  const toast = useToast();
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  const status = ORDER_STATUS[order.status];
  const pickup = order.shipping_method === 'pickup';

  async function action(path: string, body: unknown, done: string) {
    setBusy(true);
    try {
      await api(`/admin/orders/${order.id}/${path}`, { body });
      toast(done);
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Dat is niet gelukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`border bg-white ${order.status === 'paid' || order.status === 'ready' ? 'border-accent/60' : 'border-paper-3'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">{order.number}</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-dark">
            {pickup ? <Store className="h-3.5 w-3.5" aria-hidden /> : <Truck className="h-3.5 w-3.5" aria-hidden />}
            {pickup ? 'Afhalen' : 'Bezorgen'}
          </span>
        </div>
        <span className="text-sm text-stone-dark">{date(order.created_at)}</span>
      </div>
      <div className="grid gap-6 px-5 py-4 text-sm md:grid-cols-3">
        <div>
          <p className="eyebrow mb-2 text-stone-dark">Producten</p>
          <ul className="tabular space-y-1">
            {order.items.map((i) => (
              <li key={i.product_id} className="flex justify-between gap-3">
                <span>
                  {i.quantity} × {i.name}
                </span>
                <span>{formatPrice(i.line_total)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 text-stone-dark">
              <span>{pickup ? 'Afhalen' : 'Verzending'}</span>
              <span>{formatPrice(order.shipping)}</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-paper-3 pt-1 font-semibold">
              <span>Totaal</span>
              <span>{formatPrice(order.total)}</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-2 text-stone-dark">{pickup ? 'Klant (komt afhalen)' : 'Verzendadres'}</p>
          {pickup ? (
            <p className="leading-relaxed">{order.name}</p>
          ) : (
            <address className="not-italic leading-relaxed">
              {order.name}
              <br />
              {order.street} {order.house_number}
              <br />
              {order.postal_code} {order.city}
              <br />
              {SHIPPING[order.country].label}
            </address>
          )}
          <p className="mt-2">
            <a href={`mailto:${order.email}`} className="underline underline-offset-2">
              {order.email}
            </a>
            {order.phone && <> · {order.phone}</>}
          </p>
          {order.notes && <p className="mt-2 bg-paper-2 p-2">“{order.notes}”</p>}
        </div>
        <div>
          <p className="eyebrow mb-2 text-stone-dark">Afhandeling</p>
          {pickup && order.status === 'paid' && (
            <div className="space-y-2">
              <Button variant="dark" className="h-10 w-full text-sm" disabled={busy} onClick={() => action('ready', {}, 'Klaargezet: de klant krijgt een e-mail')}>
                Klaar om af te halen
              </Button>
              <p className="text-xs text-stone-dark">De klant krijgt een e-mail met het afhaaladres.</p>
              <button type="button" className="text-xs text-stone-dark underline underline-offset-2 hover:text-ink" disabled={busy} onClick={() => action('collected', {}, 'Gemarkeerd als opgehaald')}>
                Direct als opgehaald markeren
              </button>
            </div>
          )}
          {pickup && order.status === 'ready' && (
            <div className="space-y-2">
              <p>Klaargezet {order.ready_at && date(order.ready_at)}</p>
              <Button variant="dark" className="h-10 w-full text-sm" disabled={busy} onClick={() => action('collected', {}, 'Gemarkeerd als opgehaald')}>
                Markeer als opgehaald
              </Button>
            </div>
          )}
          {order.status === 'collected' && <p>Opgehaald {order.collected_at && date(order.collected_at)}</p>}
          {!pickup && order.status === 'paid' && (
            <div className="space-y-2">
              <input
                className="block w-full border border-paper-3 px-3 py-2"
                placeholder="Track-and-trace code (optioneel)"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                aria-label="Track-and-trace code"
              />
              <Button variant="dark" className="h-10 w-full text-sm" disabled={busy} onClick={() => action('ship', { trackingCode: tracking }, 'Gemarkeerd als verzonden')}>
                Markeer als verzonden
              </Button>
              <p className="text-xs text-stone-dark">De klant krijgt hiervan een e-mail.</p>
            </div>
          )}
          {order.status === 'shipped' && (
            <p>
              Verzonden {order.shipped_at && date(order.shipped_at)}
              {order.tracking_code && (
                <>
                  <br />
                  Code: {order.tracking_code}
                </>
              )}
            </p>
          )}
          {(order.status === 'open' || order.status === 'failed') && (
            <Button
              variant="outline-dark"
              className="h-10 text-sm"
              disabled={busy}
              onClick={() => confirmAction(`Bestelling ${order.number} annuleren?`) && action('cancel', {}, 'Bestelling geannuleerd')}
            >
              Annuleren
            </Button>
          )}
          {order.paid_at && (
            <p className="mt-3 text-xs text-stone-dark">
              Betaald {date(order.paid_at)} {order.payment_method && `via ${order.payment_method}`}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function BookingsPage() {
  const toast = useToast();
  const { data: bookings, error, reload } = useAdminData<Booking[]>('/admin/bookings');
  const [filter, setFilter] = useState<Booking['status'] | 'all'>('all');
  const [actionError, setActionError] = useState<string>();

  async function setStatus(id: number, status: Booking['status']) {
    try {
      await api(`/admin/bookings/${id}/status`, { body: { status } });
      toast(`Status: ${BOOKING_STATUS[status]}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Opslaan is niet gelukt.');
    }
  }

  const visible = (bookings ?? []).filter((b) => filter === 'all' || b.status === filter);

  return (
    <>
      <PageHeader title="Afspraken" description="Aanvragen via het afspraakformulier. Neem contact op met de klant en zet de status op ‘Ingepland’ zodra de afspraak vaststaat." />
      {(error || actionError) && <ErrorBox message={error ?? actionError!} onRetry={reload} />}
      {!bookings ? (
        !error && <Loading />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {(['all', 'new', 'confirmed', 'done', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`border px-3 py-1.5 ${filter === f ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-white hover:border-ink'}`}
              >
                {f === 'all' ? 'Alle' : BOOKING_STATUS[f]} ({f === 'all' ? bookings.length : bookings.filter((b) => b.status === f).length})
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="py-16 text-center text-stone-dark">{bookings.length === 0 ? 'Nog geen aanvragen.' : 'Geen aanvragen met deze status.'}</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {visible.map((b) => (
                <li key={b.id} className={`border bg-white ${b.status === 'new' ? 'border-accent/60' : 'border-paper-3'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-3 px-5 py-3">
                    <span className="font-semibold">
                      {findService(b.service_id)?.name ?? b.service_id} — {b.vehicle}
                    </span>
                    <select
                      value={b.status}
                      onChange={(e) => setStatus(b.id, e.target.value as Booking['status'])}
                      className="border border-paper-3 bg-white px-2 py-1 text-sm"
                      aria-label="Status"
                    >
                      {Object.entries(BOOKING_STATUS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 px-5 py-4 text-sm md:grid-cols-3">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p>
                        <a href={`mailto:${b.email}`} className="underline underline-offset-2">
                          {b.email}
                        </a>
                      </p>
                      <p>
                        <a href={`tel:${b.phone}`} className="underline underline-offset-2">
                          {b.phone}
                        </a>
                      </p>
                      {b.postal_code && <p className="text-stone-dark">{b.postal_code}</p>}
                    </div>
                    <div>
                      <p className="text-stone-dark">Voorkeursdatum</p>
                      <p>
                        {b.preferred_date
                          ? new Date(b.preferred_date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
                          : 'Geen voorkeur'}
                      </p>
                      <p className="mt-2 text-stone-dark">Aangevraagd {date(b.created_at)}</p>
                    </div>
                    <div>{b.message ? <p className="bg-paper-2 p-2">“{b.message}”</p> : <p className="text-stone-dark">Geen toelichting</p>}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
