import { LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatPrice, SHIPPING } from '../../shared/pricing';
import { getService } from '../../shared/services';
import type { Order, OrderStatus } from '../../server/orders';
import { Logo } from '../components/Logo';
import { Button, Input, Notice } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { usePageMeta } from '../lib/meta';

const TOKEN_KEY = 'lumen.admin';

type Booking = {
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

const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  open: { label: 'Wacht op betaling', className: 'bg-paper-2 text-stone-dark' },
  paid: { label: 'Te verzenden', className: 'bg-accent text-white' },
  shipped: { label: 'Verzonden', className: 'bg-[#e6f0ea] text-[#24533d]' },
  failed: { label: 'Betaling mislukt', className: 'bg-paper-2 text-stone-dark' },
  cancelled: { label: 'Geannuleerd', className: 'bg-paper-2 text-stone' },
};

const BOOKING_STATUS: Record<Booking['status'], string> = {
  new: 'Nieuw',
  confirmed: 'Ingepland',
  done: 'Afgerond',
  cancelled: 'Geannuleerd',
};

function date(value: string) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
}

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function Admin() {
  usePageMeta('Beheer', undefined, { noindex: true });
  const [token, setToken] = useState(readToken);
  const [tab, setTab] = useState<'orders' | 'bookings'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken('');
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(undefined);
    try {
      const [o, b] = await Promise.all([api<Order[]>('/admin/orders', { token }), api<Booking[]>('/admin/bookings', { token })]);
      setOrders(o);
      setBookings(b);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err instanceof Error ? err.message : 'Laden mislukt');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token) return <Login onLogin={setToken} error={error} />;

  const toShip = orders.filter((o) => o.status === 'paid').length;
  const newBookings = bookings.filter((b) => b.status === 'new').length;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-ink text-paper">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="eyebrow text-paper/50">Beheer</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} className="grid h-10 w-10 place-items-center hover:bg-white/10" aria-label="Vernieuwen">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={logout} className="grid h-10 w-10 place-items-center hover:bg-white/10" aria-label="Uitloggen">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="container-page py-8">
        {error && <Notice tone="error">{error}</Notice>}
        <div role="tablist" className="flex gap-1 border-b border-ink/15">
          {(
            [
              ['orders', `Bestellingen${toShip ? ` (${toShip} te verzenden)` : ''}`],
              ['bookings', `Afspraakaanvragen${newBookings ? ` (${newBookings} nieuw)` : ''}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-4 py-3 text-[15px] font-medium ${tab === id ? 'border-accent' : 'border-transparent text-stone-dark hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'orders' ? (
          <OrderList orders={orders} token={token} onChange={load} onError={setError} />
        ) : (
          <BookingList bookings={bookings} token={token} onChange={load} onError={setError} />
        )}
      </div>
    </div>
  );
}

function Login({ onLogin, error: initialError }: { onLogin: (token: string) => void; error?: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/admin/orders', { token: password });
      try {
        sessionStorage.setItem(TOKEN_KEY, password);
      } catch {
        // Session only lasts until reload without storage.
      }
      onLogin(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-5">
      <form onSubmit={submit} className="w-full max-w-sm bg-paper p-8 text-ink">
        <h1 className="font-display text-2xl">Beheer</h1>
        <p className="mt-2 text-sm text-stone-dark">Log in om bestellingen en afspraakaanvragen te bekijken.</p>
        <div className="mt-6 space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Input label="Wachtwoord" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="dark" className="w-full" disabled={busy || !password}>
            Inloggen
          </Button>
        </div>
      </form>
    </div>
  );
}

type ListProps = { token: string; onChange: () => void; onError: (message: string) => void };

function OrderList({ orders, token, onChange, onError }: ListProps & { orders: Order[] }) {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2 text-sm">
        {(['all', 'paid', 'shipped', 'open', 'failed', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 ${filter === f ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink'}`}
          >
            {f === 'all' ? 'Alle' : ORDER_STATUS[f].label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="py-16 text-center text-stone-dark">Geen bestellingen.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} token={token} onChange={onChange} onError={onError} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, token, onChange, onError }: ListProps & { order: Order }) {
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  const status = ORDER_STATUS[order.status];

  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    try {
      await api(`/admin/orders/${order.id}/${path}`, { body, token });
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Actie mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-paper-3 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{order.number}</span>
          <span className={`px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
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
              <span>Verzending</span>
              <span>{formatPrice(order.shipping)}</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-paper-3 pt-1 font-semibold">
              <span>Totaal</span>
              <span>{formatPrice(order.total)}</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-2 text-stone-dark">Verzendadres</p>
          <address className="not-italic leading-relaxed">
            {order.name}
            <br />
            {order.street} {order.house_number}
            <br />
            {order.postal_code} {order.city}
            <br />
            {SHIPPING[order.country].label}
          </address>
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
          {order.status === 'paid' && (
            <div className="space-y-2">
              <input
                className="block w-full border border-paper-3 px-3 py-2"
                placeholder="Track-and-trace code (optioneel)"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                aria-label="Track-and-trace code"
              />
              <Button variant="dark" className="h-10 w-full text-sm" disabled={busy} onClick={() => action('ship', { trackingCode: tracking })}>
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
              onClick={() => window.confirm(`Bestelling ${order.number} annuleren?`) && action('cancel')}
            >
              Annuleren
            </Button>
          )}
          {order.paid_at && <p className="mt-3 text-xs text-stone-dark">Betaald {date(order.paid_at)} {order.payment_method && `via ${order.payment_method}`}</p>}
        </div>
      </div>
    </li>
  );
}

function BookingList({ bookings, token, onChange, onError }: ListProps & { bookings: Booking[] }) {
  async function setStatus(id: number, status: Booking['status']) {
    try {
      await api(`/admin/bookings/${id}/status`, { body: { status }, token });
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Opslaan mislukt');
    }
  }

  if (bookings.length === 0) return <p className="py-16 text-center text-stone-dark">Nog geen aanvragen.</p>;

  return (
    <ul className="mt-6 space-y-4">
      {bookings.map((b) => (
        <li key={b.id} className={`border bg-white ${b.status === 'new' ? 'border-accent/50' : 'border-paper-3'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-3 px-5 py-3">
            <span className="font-semibold">
              {getService(b.service_id)?.name ?? b.service_id} — {b.vehicle}
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
              <p>{b.preferred_date ? new Date(b.preferred_date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Geen voorkeur'}</p>
              <p className="mt-2 text-stone-dark">Aangevraagd {date(b.created_at)}</p>
            </div>
            <div>{b.message ? <p className="bg-paper-2 p-2">“{b.message}”</p> : <p className="text-stone-dark">Geen toelichting</p>}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
