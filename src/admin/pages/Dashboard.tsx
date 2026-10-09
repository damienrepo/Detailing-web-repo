import { ArrowRight, CalendarCheck, CheckCircle2, Circle, FileText, Package, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';
import type { Order } from '../../../server/orders';
import { formatPrice } from '../../../shared/pricing';
import { SITE } from '../../../shared/site';
import type { AdminUser } from '../AdminApp';
import { Loading, PageHeader, Panel, useAdminData } from '../kit';
import { ShopSwitch } from '../ShopSwitch';
import type { Booking } from './Orders';
import type { SettingsResponse } from './Settings';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
}

export function Dashboard({ user }: { user: AdminUser }) {
  const orders = useAdminData<Order[]>('/admin/orders');
  const bookings = useAdminData<Booking[]>('/admin/bookings');
  const settings = useAdminData<SettingsResponse>('/admin/settings');

  if (!orders.data || !bookings.data || !settings.data) return <Loading />;

  const toShip = orders.data.filter((o) => o.status === 'paid' || o.status === 'ready');
  const newBookings = bookings.data.filter((b) => b.status === 'new');
  const monthStart = new Date();
  monthStart.setDate(1);
  const thisMonth = orders.data.filter((o) => ['paid', 'shipped', 'ready', 'collected'].includes(o.status) && new Date(o.created_at.replace(' ', 'T') + 'Z') >= monthStart);
  const revenue = thisMonth.reduce((sum, o) => sum + o.total, 0);

  const s = settings.data;
  const checklist = [
    { done: s.payments === 'live', label: s.payments === 'test' ? 'Mollie staat in testmodus: zet een live_ key voor echte betalingen' : 'Mollie koppelen voor online betalingen', to: '/admin/instellingen' },
    { done: s.values.smtpHost.set, label: 'E-mail instellen, zodat klanten bevestigingen krijgen', to: '/admin/instellingen' },
    { done: s.values.notifyEmail.set, label: 'Kies waar meldingen van nieuwe bestellingen naartoe gaan', to: '/admin/instellingen' },
    { done: user.totpEnabled, label: 'Tweestapsverificatie aanzetten voor extra beveiliging', to: '/admin/account' },
    { done: SITE.kvk !== '00000000', label: 'KvK- en btw-nummer invullen (verplicht voor een webshop)', to: '/admin/bedrijf' },
  ];
  const open = checklist.filter((c) => !c.done);

  const stat = (to: string, icon: typeof ShoppingBag, value: number | string, label: string, highlight = false) => {
    const Icon = icon;
    return (
      <Link to={to} className={`group flex items-center gap-4 border bg-white p-5 transition-colors hover:border-ink ${highlight ? 'border-accent/60' : 'border-paper-3'}`}>
        <Icon className="h-6 w-6 shrink-0 text-stone-dark" strokeWidth={1.5} aria-hidden />
        <div className="flex-1">
          <p className="tabular text-2xl font-semibold">{value}</p>
          <p className="text-sm text-stone-dark">{label}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-stone-dark transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    );
  };

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name.split(' ')[0]}`} description="Hier zie je in één oogopslag wat er te doen is." />

      <div className="grid gap-4 sm:grid-cols-3">
        {stat('/admin/bestellingen', ShoppingBag, toShip.length, toShip.length === 1 ? 'bestelling af te handelen' : 'bestellingen af te handelen', toShip.length > 0)}
        {stat('/admin/afspraken', CalendarCheck, newBookings.length, newBookings.length === 1 ? 'nieuwe afspraakaanvraag' : 'nieuwe afspraakaanvragen', newBookings.length > 0)}
        {stat('/admin/bestellingen', Package, formatPrice(revenue), `omzet webshop deze maand (${thisMonth.length} bestellingen)`)}
      </div>

      <div className="mt-8">
        <ShopSwitch />
      </div>

      {open.length > 0 && (
        <Panel title="Nog te doen" description="Rond deze stappen af voordat je de webshop live zet." className="mt-8">
          <ul className="divide-y divide-paper-3">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link to={c.to} className="flex items-center gap-3 py-3 text-[15px] hover:underline">
                  {c.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2f6b4f]" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-stone" aria-hidden />}
                  <span className={c.done ? 'text-stone-dark line-through' : ''}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Snel naar" className="mt-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { to: '/admin/blog/nieuw', label: 'Nieuw blogbericht', icon: FileText },
            { to: '/admin/producten/nieuw', label: 'Product toevoegen', icon: Package },
            { to: '/admin/afbeeldingen', label: 'Foto’s uploaden', icon: ArrowRight },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 border border-paper-3 px-4 py-3 text-[15px] font-medium hover:border-ink">
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
