// Admin for the Estadio booking page (estadio.detail2go.nl): wash days, the plan of one day, packages and texts.
import { Building2, CalendarCheck2, CalendarPlus, Copy, FileJson, RefreshCw, Download, ExternalLink, Mail, MapPin, MoveRight, Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router';
import {
  BOOKING_STATUS_LABEL,
  formatDate,
  formatDuration,
  formatEuro,
  formatTime,
  freeStarts,
  parseTime,
  type EstadioBooking,
  type EstadioBookingStatus,
  type EstadioDay,
  type EstadioPackage,
  type EstadioSettings,
} from '../../../shared/estadio';
import type { GoogleStatus } from '../../../server/estadio';
import { Button, Input, Notice, Select, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { ErrorBox, LineList, Loading, move, MoneyInput, PageHeader, Panel, RowControls, SaveBar, StatusBadge, Toggle, useAdminData, useDraft, useSave, useToast } from '../kit';

type Overview = {
  settings: EstadioSettings;
  packages: EstadioPackage[];
  estadioUrl: string;
  today: string;
  days: (EstadioDay & { booked: number; revenue: number; free: number })[];
};

type DayView = {
  day: EstadioDay;
  bookings: EstadioBooking[];
  packages: EstadioPackage[];
  free: Record<string, number[]>;
  estadioUrl: string;
};

type DayInput = Omit<EstadioDay, 'id' | 'date'>;
const DEFAULT_DAY: DayInput = { start: 9 * 60, end: 17 * 60, capacity: 1, interval: 30, breakStart: null, breakEnd: null, open: true, note: '' };

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function EstadioPage() {
  return (
    <Routes>
      <Route index element={<Section tab="dagen" />} />
      <Route path="pakketten" element={<Section tab="pakketten" />} />
      <Route path="instellingen" element={<Section tab="instellingen" />} />
      <Route path="google-agenda" element={<Section tab="google" />} />
      <Route path="dag/:id" element={<DayPage />} />
    </Routes>
  );
}

function Section({ tab }: { tab: 'dagen' | 'pakketten' | 'instellingen' | 'google' }) {
  const overview = useAdminData<Overview>('/admin/estadio');
  const tabs = [
    { to: '/admin/estadio', label: 'Wasdagen', end: true },
    { to: '/admin/estadio/pakketten', label: 'Pakketten' },
    { to: '/admin/estadio/instellingen', label: 'Teksten & regels' },
    { to: '/admin/estadio/google-agenda', label: 'Google Agenda' },
  ];
  return (
    <>
      <PageHeader
        title="Estadio"
        description="De boekingspagina voor de wasdagen bij Estadio Parkweg. Plan hier de dagen in; medewerkers van Estadio boeken zelf een tijd."
        actions={
          overview.data && (
            <a href={overview.data.estadioUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 bg-white px-4 text-sm font-medium hover:border-ink">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Boekingspagina
            </a>
          )
        }
      />
      <nav aria-label="Estadio" className="no-scrollbar -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-paper-3 px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[15px] ${isActive ? 'border-ink font-medium' : 'border-transparent text-stone-dark hover:text-ink'}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      {overview.error && <ErrorBox message={overview.error} onRetry={overview.reload} />}
      {!overview.data ? (
        !overview.error && <Loading />
      ) : tab === 'dagen' ? (
        <DaysTab overview={overview.data} reload={overview.reload} />
      ) : tab === 'google' ? (
        <GoogleTab />
      ) : tab === 'pakketten' ? (
        <PackagesTab packages={overview.data.packages} onSaved={overview.reload} />
      ) : (
        <SettingsTab settings={overview.data.settings} estadioUrl={overview.data.estadioUrl} onSaved={overview.reload} />
      )}
    </>
  );
}

/** On the dashboard: the next wash day at Estadio and how full it is. */
export function EstadioNext() {
  const { data } = useAdminData<Overview>('/admin/estadio');
  const next = data?.days.find((d) => d.date >= data.today && d.open);
  if (!data || !next) return null;
  return (
    <Link to={`/admin/estadio/dag/${next.id}`} className="group mt-4 flex items-center gap-4 border border-paper-3 bg-white p-5 transition-colors hover:border-ink">
      <Building2 className="h-6 w-6 shrink-0 text-stone-dark" strokeWidth={1.5} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{next.date === data.today ? 'Vandaag wasdag bij Estadio' : 'Volgende wasdag bij Estadio'}</span>
        <span className="tabular block text-sm text-stone-dark first-letter:uppercase">
          {formatDate(next.date)} · {next.booked} {next.booked === 1 ? 'afspraak' : 'afspraken'}
          {next.revenue > 0 && ` · ${formatEuro(next.revenue)} excl. btw`}
          {next.free === 0 && ' · vol'}
        </span>
      </span>
      <MoveRight className="h-4 w-4 text-stone-dark transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

// --- Wash days ------------------------------------------------------------------------------

function DaysTab({ overview, reload }: { overview: Overview; reload: () => void }) {
  const upcoming = overview.days.filter((d) => d.date >= overview.today);
  const past = overview.days.filter((d) => d.date < overview.today).reverse();
  const [adding, setAdding] = useState(upcoming.length === 0);

  return (
    <div className="space-y-8">
      {!overview.settings.enabled && (
        <Notice>
          Online boeken staat uit. Zet het aan onder <Link to="/admin/estadio/instellingen" className="underline">Teksten & regels</Link>.
        </Notice>
      )}

      {adding ? (
        <NewDays
          today={overview.today}
          onCancel={upcoming.length ? () => setAdding(false) : undefined}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : (
        <Button type="button" variant="dark" onClick={() => setAdding(true)} className="w-full sm:w-auto">
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Wasdag toevoegen
        </Button>
      )}

      <section>
        <h2 className="eyebrow mb-3 text-stone-dark">Komende wasdagen</h2>
        {upcoming.length === 0 ? (
          <p className="border border-dashed border-paper-3 bg-white px-5 py-10 text-center text-stone-dark">Nog geen wasdag gepland. Medewerkers zien dan “wordt binnenkort ingepland”.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((d) => (
              <DayCard key={d.id} day={d} today={overview.today} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className="group">
          <summary className="eyebrow cursor-pointer list-none text-stone-dark hover:text-ink [&::-webkit-details-marker]:hidden">
            Afgelopen wasdagen ({past.length}) <span className="group-open:hidden">+</span>
          </summary>
          <ul className="mt-3 space-y-3">
            {past.map((d) => (
              <DayCard key={d.id} day={d} today={overview.today} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DayCard({ day, today }: { day: Overview['days'][number]; today: string }) {
  const status = !day.open ? <StatusBadge tone="muted">Gesloten</StatusBadge> : day.date === today ? <StatusBadge tone="accent">Vandaag</StatusBadge> : day.free === 0 ? <StatusBadge tone="warn">Vol</StatusBadge> : <StatusBadge tone="ok">Open</StatusBadge>;
  return (
    <li>
      <Link to={`/admin/estadio/dag/${day.id}`} className="flex items-center gap-4 border border-paper-3 bg-white p-4 transition-colors hover:border-ink md:p-5">
        <div className="grid w-14 shrink-0 place-items-center border-r border-paper-3 pr-4 text-center">
          <span className="eyebrow text-stone-dark">{formatDate(day.date, { short: true }).split(' ')[0]}</span>
          <span className="tabular font-display text-2xl leading-none">{Number(day.date.slice(8))}</span>
          <span className="text-xs text-stone-dark">{formatDate(day.date, { short: true }).split(' ')[2]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="first-letter:uppercase">{formatDate(day.date, { year: true })}</span>
            {status}
          </p>
          <p className="tabular mt-1 text-sm text-stone-dark">
            {formatTime(day.start)} – {formatTime(day.end)} · {day.capacity === 1 ? '1 auto tegelijk' : `${day.capacity} auto’s tegelijk`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-xl font-semibold">{day.booked}</p>
          <p className="text-xs text-stone-dark">{day.booked === 1 ? 'afspraak' : 'afspraken'}</p>
          {day.revenue > 0 && <p className="tabular text-xs text-stone-dark">{formatEuro(day.revenue)} ex.</p>}
        </div>
      </Link>
    </li>
  );
}

/** Hours, break, capacity: used for new days and for editing one. */
function DayFields({ value, onChange, errors }: { value: DayInput; onChange: (v: DayInput) => void; errors: Record<string, string> }) {
  const time = (key: 'start' | 'end' | 'breakStart' | 'breakEnd', label: string, optional = false) => (
    <Input
      label={label}
      type="time"
      step={300}
      optional={optional}
      value={value[key] == null ? '' : formatTime(value[key]!)}
      error={errors[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value ? parseTime(e.target.value) : null })}
    />
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {time('start', 'Begintijd')}
        {time('end', 'Eindtijd')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Auto’s tegelijk" value={value.capacity} error={errors.capacity} hint="Hoeveel auto’s jullie tegelijk doen." onChange={(e) => onChange({ ...value, capacity: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select label="Starttijden om de" value={value.interval} error={errors.interval} hint="Bijv. 09:00, 09:30, 10:00…" onChange={(e) => onChange({ ...value, interval: Number(e.target.value) })}>
          {[15, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} minuten
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {time('breakStart', 'Pauze van', true)}
        {time('breakEnd', 'Pauze tot', true)}
      </div>
      <Textarea label="Notitie voor medewerkers" optional rows={2} maxLength={300} placeholder="Bijv. we staan deze keer bij de achteringang" value={value.note} error={errors.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
    </div>
  );
}

function NewDays({ today, onSaved, onCancel }: { today: string; onSaved: () => void; onCancel?: () => void }) {
  const [dates, setDates] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [day, setDay] = useState<DayInput>(DEFAULT_DAY);
  const save = useSave();

  const add = (date: string) => {
    if (date && !dates.includes(date)) setDates([...dates, date].sort());
    setPick('');
  };

  async function submit() {
    const all = pick ? [...new Set([...dates, pick])] : dates;
    const ok = await save.run(() => api('/admin/estadio/days', { body: { dates: all, day } }), all.length === 1 ? 'Wasdag toegevoegd' : `${all.length} wasdagen toegevoegd`);
    if (ok) onSaved();
  }

  return (
    <Panel title="Wasdag toevoegen" description="Kies één of meer datums met dezelfde tijden, bijvoorbeeld de wasdagen van de komende maanden.">
      {save.error && <Notice tone="error">{save.error}</Notice>}
      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Datum" type="date" min={today} value={pick} onChange={(e) => setPick(e.target.value)} />
          </div>
          <Button type="button" variant="outline-dark" onClick={() => add(pick)} disabled={!pick} aria-label="Nog een datum toevoegen">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="max-sm:sr-only">Nog een datum</span>
          </Button>
        </div>
        {dates.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {dates.map((d) => (
              <li key={d} className="inline-flex items-center gap-1 bg-paper-2 py-1 pl-3 pr-1 text-sm">
                <span className="first-letter:uppercase">{formatDate(d, { short: true })}</span>
                <button type="button" onClick={() => setDates(dates.filter((x) => x !== d))} className="grid h-7 w-7 place-items-center hover:text-danger" aria-label={`${formatDate(d)} weghalen`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DayFields value={day} onChange={setDay} errors={save.errors} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="dark" onClick={submit} disabled={save.saving || (!pick && dates.length === 0)}>
          {save.saving ? 'Bezig…' : 'Inplannen'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline-dark" onClick={onCancel}>
            Annuleren
          </Button>
        )}
      </div>
    </Panel>
  );
}

// --- One day ----------------------------------------------------------------------------------

function DayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, setData, error, reload } = useAdminData<DayView>(`/admin/estadio/days/${id}`);
  const [panel, setPanel] = useState<'none' | 'edit' | 'add' | 'cancel'>('none');
  const [actionError, setActionError] = useState<string>();
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { day, bookings } = data;
  const active = bookings.filter((b) => b.status !== 'cancelled');
  const shown = filter === 'all' ? bookings : active;
  const revenue = active.filter((b) => b.status !== 'no_show').reduce((s, b) => s + b.price, 0);

  async function run(fn: () => Promise<DayView>, message: string) {
    setActionError(undefined);
    try {
      setData(await fn());
      toast(message);
      return true;
    } catch (err) {
      setActionError(errorText(err, 'Opslaan is niet gelukt.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
  }

  async function remove() {
    if (!confirmAction(`De wasdag van ${formatDate(day.date)} verwijderen?`)) return;
    try {
      await api(`/admin/estadio/days/${day.id}`, { method: 'DELETE' });
      toast('Wasdag verwijderd');
      navigate('/admin/estadio');
    } catch (err) {
      setActionError(errorText(err, 'Verwijderen is niet gelukt.'));
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/admin/estadio', label: 'Alle wasdagen' }}
        title={formatDate(day.date, { year: true }).replace(/^./, (c) => c.toUpperCase())}
        description={
          <span className="tabular">
            {formatTime(day.start)} – {formatTime(day.end)}
            {day.breakStart != null && day.breakEnd != null && ` · pauze ${formatTime(day.breakStart)}–${formatTime(day.breakEnd)}`} · {day.capacity === 1 ? '1 auto tegelijk' : `${day.capacity} auto’s tegelijk`}
            {!day.open && ' · gesloten voor boekingen'}
          </span>
        }
      />
      {actionError && (
        <div className="mb-6">
          <ErrorBox message={actionError} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Figure value={String(active.length)} label={active.length === 1 ? 'afspraak' : 'afspraken'} />
        <Figure value={String(active.filter((b) => b.status === 'done').length)} label="klaar" />
        <Figure value={formatEuro(revenue)} label="excl. btw" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="dark" className="h-10 text-sm" onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}>
          <Plus className="h-4 w-4" aria-hidden />
          Afspraak toevoegen
        </Button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}>
          <Pencil className="h-4 w-4" aria-hidden />
          Tijden wijzigen
        </Button>
        <a href={`/api/admin/estadio/days/${day.id}/export.csv`} className="inline-flex h-10 items-center gap-2 border border-ink/25 bg-white px-4 text-sm font-medium hover:border-ink">
          <Download className="h-4 w-4" aria-hidden />
          Excel
        </a>
      </div>

      {panel === 'edit' && <EditDay view={data} onSaved={(v) => run(async () => v, 'Wasdag opgeslagen').then(() => setPanel('none'))} onClose={() => setPanel('none')} />}
      {panel === 'add' && <AddBooking view={data} onSaved={(v) => run(async () => v, 'Afspraak toegevoegd').then(() => setPanel('none'))} onClose={() => setPanel('none')} />}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="eyebrow text-stone-dark">Planning</h2>
          {bookings.length !== active.length && (
            <button type="button" onClick={() => setFilter(filter === 'all' ? 'active' : 'all')} className="text-sm underline underline-offset-2">
              {filter === 'all' ? 'Verberg geannuleerde' : `Toon geannuleerde (${bookings.length - active.length})`}
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <p className="border border-dashed border-paper-3 bg-white px-5 py-10 text-center text-stone-dark">Nog geen afspraken op deze dag.</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((b) => (
              <BookingCard key={b.id} booking={b} view={data} run={run} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 border-t border-paper-3 pt-8">
        <h2 className="eyebrow text-stone-dark">Dag beheren</h2>
        <div className="mt-4 space-y-4">
          <div className="border border-paper-3 bg-white p-5">
            <Toggle
              label="Open voor boekingen"
              description={day.open ? 'Medewerkers kunnen een tijd kiezen.' : 'Deze dag staat niet op de boekingspagina; bestaande afspraken blijven staan.'}
              checked={day.open}
              onChange={(open) => run(() => api<DayView>(`/admin/estadio/days/${day.id}`, { method: 'PUT', body: { ...dayInput(day), open } }), open ? 'Dag geopend' : 'Dag gesloten')}
            />
          </div>
          {panel === 'cancel' ? (
            <CancelDay view={data} onDone={(v) => run(async () => v, 'Dag geannuleerd, klanten gemaild').then(() => setPanel('none'))} onClose={() => setPanel('none')} />
          ) : active.some((b) => b.status === 'booked') ? (
            <Button type="button" variant="outline-dark" className="h-10 text-sm text-danger" onClick={() => setPanel('cancel')}>
              Hele dag annuleren…
            </Button>
          ) : (
            <Button type="button" variant="outline-dark" className="h-10 text-sm text-danger" onClick={remove}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Wasdag verwijderen
            </Button>
          )}
        </div>
      </section>
    </>
  );
}

const dayInput = (d: EstadioDay): DayInput => ({ start: d.start, end: d.end, capacity: d.capacity, interval: d.interval, breakStart: d.breakStart, breakEnd: d.breakEnd, open: d.open, note: d.note });

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-paper-3 bg-white px-4 py-3">
      <p className="tabular text-xl font-semibold md:text-2xl">{value}</p>
      <p className="text-xs text-stone-dark md:text-sm">{label}</p>
    </div>
  );
}

function EditDay({ view, onSaved, onClose }: { view: DayView; onSaved: (v: DayView) => void; onClose: () => void }) {
  const [day, setDay] = useState(dayInput(view.day));
  const save = useSave();
  async function submit() {
    const v = await save.run(() => api<DayView>(`/admin/estadio/days/${view.day.id}`, { method: 'PUT', body: day }), 'Opgeslagen');
    if (v) onSaved(v);
  }
  return (
    <Panel title="Tijden wijzigen" className="mt-4">
      {save.error && <Notice tone="error">{save.error}</Notice>}
      <DayFields value={day} onChange={setDay} errors={save.errors} />
      <div className="flex gap-2">
        <Button type="button" variant="dark" className="h-10 text-sm" onClick={submit} disabled={save.saving}>
          Opslaan
        </Button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Panel>
  );
}

function CancelDay({ view, onDone, onClose }: { view: DayView; onDone: (v: DayView) => void; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const count = view.bookings.filter((b) => b.status === 'booked').length;
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<DayView>(`/admin/estadio/days/${view.day.id}/cancel`, { body: { message } }));
    } catch (err) {
      setError(errorText(err, 'Annuleren is niet gelukt.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Hele dag annuleren" description={`Alle ${count} geplande afspraken worden geannuleerd en de dag gaat dicht. Iedereen met een e-mailadres krijgt een mail met een link om een nieuwe tijd te kiezen.`}>
      {error && <Notice tone="error">{error}</Notice>}
      <Textarea label="Reden in de mail" optional rows={3} maxLength={1000} placeholder="Bijv. door ziekte kunnen we helaas niet komen." value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={submit} disabled={busy} className="h-10 bg-danger px-5 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Bezig…' : `${count} afspraken annuleren`}
        </button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onClose}>
          Toch niet
        </Button>
      </div>
    </Panel>
  );
}

const STATUS_TONE: Record<EstadioBookingStatus, 'ok' | 'warn' | 'muted' | 'accent'> = { booked: 'accent', done: 'ok', no_show: 'warn', cancelled: 'muted' };

function BookingCard({ booking: b, view, run }: { booking: EstadioBooking; view: DayView; run: (fn: () => Promise<DayView>, message: string) => Promise<boolean> }) {
  const [open, setOpen] = useState<'none' | 'edit' | 'move' | 'cancel'>('none');
  const toast = useToast();
  const cancelled = b.status === 'cancelled';
  const setStatus = (status: EstadioBookingStatus) => run(() => api<DayView>(`/admin/estadio/bookings/${b.id}/status`, { body: { status } }), BOOKING_STATUS_LABEL[status]);
  const link = `${view.estadioUrl}/boeking/${b.publicId}`;

  return (
    <li className={`border bg-white ${b.status === 'booked' ? 'border-paper-3' : 'border-paper-3/70'} ${cancelled ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-4 p-4">
        <div className="w-16 shrink-0">
          <p className="tabular text-lg font-semibold leading-tight">{formatTime(b.start)}</p>
          <p className="tabular text-xs text-stone-dark">tot {formatTime(b.end)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular bg-[#f6c800] px-2 py-0.5 text-[15px] font-bold tracking-[0.06em] text-ink">{b.plate}</span>
            {cancelled && <StatusBadge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</StatusBadge>}
            {b.source === 'admin' && <StatusBadge tone="muted">Door ons ingepland</StatusBadge>}
          </div>
          <p className="mt-2 font-medium">
            {b.name}
            {b.company && <span className="font-normal text-stone-dark"> · {b.company}</span>}
          </p>
          <p className="text-sm text-stone-dark">
            {b.packageName} · <span className="whitespace-nowrap">{formatEuro(b.price)}</span>
          </p>
          {(b.vehicle || b.parking) && (
            <p className="mt-2 flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-dark" aria-hidden />
              {[b.vehicle, b.parking].filter(Boolean).join(' · ')}
            </p>
          )}
          {b.notes && <p className="mt-2 border-l-2 border-accent-fill pl-3 text-sm">{b.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {b.phone && (
              <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 underline underline-offset-2">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {b.phone}
              </a>
            )}
            {b.email && (
              <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1.5 underline underline-offset-2">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {b.email}
              </a>
            )}
          </div>
        </div>
      </div>

      {!cancelled && (
        <div className="grid grid-cols-3 border-t border-paper-3 text-sm" role="group" aria-label={`Status van ${b.plate}`}>
          {(['booked', 'done', 'no_show'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => b.status !== s && setStatus(s)}
              aria-pressed={b.status === s}
              className={`h-11 border-r border-paper-3 last:border-r-0 ${b.status === s ? 'bg-ink font-medium text-paper' : 'hover:bg-paper-2'}`}
            >
              {BOOKING_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-paper-3 px-4 py-2 text-sm">
        {cancelled ? (
          <button type="button" className="h-9 underline underline-offset-2" onClick={() => setStatus('booked')}>
            Terugzetten
          </button>
        ) : (
          <>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 hover:underline" onClick={() => setOpen(open === 'move' ? 'none' : 'move')}>
              <MoveRight className="h-3.5 w-3.5" aria-hidden />
              Verplaatsen
            </button>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 hover:underline" onClick={() => setOpen(open === 'edit' ? 'none' : 'edit')}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Gegevens
            </button>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 text-danger hover:underline" onClick={() => setOpen(open === 'cancel' ? 'none' : 'cancel')}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Annuleren
            </button>
          </>
        )}
        <button
          type="button"
          className="ml-auto inline-flex h-9 items-center gap-1.5 text-stone-dark hover:text-ink"
          onClick={() => navigator.clipboard.writeText(link).then(() => toast('Link naar de afspraak gekopieerd'))}
          title="De link waarmee de klant de afspraak kan bekijken en wijzigen"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Klantlink
        </button>
      </div>

      {open === 'edit' && <EditBooking booking={b} onSave={(body) => run(() => api<DayView>(`/admin/estadio/bookings/${b.id}`, { method: 'PUT', body }), 'Gegevens opgeslagen')} onClose={() => setOpen('none')} />}
      {open === 'move' && <MoveBooking booking={b} view={view} run={run} onClose={() => setOpen('none')} />}
      {open === 'cancel' && <CancelBooking booking={b} run={run} onClose={() => setOpen('none')} />}
    </li>
  );
}

function Inline({ children }: { children: ReactNode }) {
  return <div className="space-y-4 border-t border-paper-3 bg-paper/60 p-4">{children}</div>;
}

type Details = Pick<EstadioBooking, 'name' | 'email' | 'phone' | 'company' | 'plate' | 'vehicle' | 'parking' | 'notes'>;
const detailsOf = (b: Details): Details => ({ name: b.name, email: b.email, phone: b.phone, company: b.company, plate: b.plate, vehicle: b.vehicle, parking: b.parking, notes: b.notes });

function DetailFields({ value, onChange, errors, requireContact }: { value: Details; onChange: (v: Details) => void; errors: Record<string, string>; requireContact?: boolean }) {
  const f = (key: keyof Details) => ({ value: value[key], error: errors[key], onChange: (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value }) });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Naam" {...f('name')} />
      <Input label="Kenteken" autoCapitalize="characters" {...f('plate')} />
      <Input label="Telefoon" type="tel" optional={!requireContact} {...f('phone')} />
      <Input label="E-mail" type="email" optional hint={requireContact ? undefined : 'Met e-mail krijgt de klant een bevestiging.'} {...f('email')} />
      <Input label="Bedrijf" optional {...f('company')} />
      <Input label="Auto" optional {...f('vehicle')} />
      <Input label="Opmerking" optional {...f('notes')} />
    </div>
  );
}

function EditBooking({ booking, onSave, onClose }: { booking: EstadioBooking; onSave: (d: Details) => Promise<boolean>; onClose: () => void }) {
  const [value, setValue] = useState(detailsOf(booking));
  const [busy, setBusy] = useState(false);
  return (
    <Inline>
      <DetailFields value={value} onChange={setValue} errors={{}} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="dark"
          className="h-10 text-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await onSave(value)) onClose();
            setBusy(false);
          }}
        >
          Opslaan
        </Button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Inline>
  );
}

function CancelBooking({ booking, run, onClose }: { booking: EstadioBooking; run: (fn: () => Promise<DayView>, m: string) => Promise<boolean>; onClose: () => void }) {
  const [notify, setNotify] = useState(Boolean(booking.email));
  const [message, setMessage] = useState('');
  return (
    <Inline>
      {booking.email ? (
        <Toggle label="Klant mailen" description={`Stuur ${booking.email} een annulering met een link om opnieuw te boeken.`} checked={notify} onChange={setNotify} />
      ) : (
        <p className="text-sm text-stone-dark">Geen e-mailadres bekend; laat het de klant zelf weten.</p>
      )}
      {notify && <Textarea label="Reden in de mail" optional rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />}
      <div className="flex gap-2">
        <button
          type="button"
          className="h-10 bg-danger px-5 text-sm font-medium text-white"
          onClick={() => run(() => api<DayView>(`/admin/estadio/bookings/${booking.id}/status`, { body: { status: 'cancelled', notify, message } }), 'Afspraak geannuleerd')}
        >
          Afspraak annuleren
        </button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onClose}>
          Toch niet
        </Button>
      </div>
    </Inline>
  );
}

function MoveBooking({ booking, view, run, onClose }: { booking: EstadioBooking; view: DayView; run: (fn: () => Promise<DayView>, m: string) => Promise<boolean>; onClose: () => void }) {
  const overview = useAdminData<Overview>('/admin/estadio');
  const [dayId, setDayId] = useState(booking.dayId);
  const target = useAdminData<DayView>(dayId === view.day.id ? null : `/admin/estadio/days/${dayId}`);
  const targetView = dayId === view.day.id ? view : target.data;
  const [packageId, setPackageId] = useState(booking.packageId);
  const [start, setStart] = useState<number>();
  const [notify, setNotify] = useState(Boolean(booking.email));
  const [force, setForce] = useState(false);
  const pkg = view.packages.find((p) => p.id === packageId);

  // Free times on the chosen day; the booking's own current time counts as free.
  const times = useMemo(() => {
    if (!targetView || !pkg) return [];
    if (force) {
      const out: number[] = [];
      for (let t = targetView.day.start; t + pkg.duration <= targetView.day.end; t += targetView.day.interval) out.push(t);
      return out;
    }
    const others = targetView.bookings.filter((b) => b.id !== booking.id && b.status !== 'cancelled');
    return freeStarts(targetView.day, others, pkg.duration);
  }, [targetView, pkg, packageId, force, booking]);

  useEffect(() => setStart(undefined), [dayId, packageId, force]);

  const days = (overview.data?.days ?? []).filter((d) => d.date >= (overview.data?.today ?? ''));

  return (
    <Inline>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Dag" value={dayId} onChange={(e) => setDayId(Number(e.target.value))}>
          {(days.some((d) => d.id === view.day.id) ? days : [{ ...view.day, booked: 0, revenue: 0, free: 0 }, ...days]).map((d) => (
            <option key={d.id} value={d.id}>
              {formatDate(d.date, { short: true })}
              {!d.open ? ' (gesloten)' : ''}
            </option>
          ))}
        </Select>
        <Select label="Pakket" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
          {view.packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatDuration(p.duration)}
            </option>
          ))}
        </Select>
      </div>
      {!targetView ? (
        <Loading />
      ) : times.length === 0 ? (
        <p className="text-sm text-stone-dark">Geen vrije tijd op deze dag voor dit pakket.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {times.map((t) => (
            <button key={t} type="button" onClick={() => setStart(t)} aria-pressed={start === t} className={`tabular h-10 border text-sm ${start === t ? 'border-ink bg-ink text-paper' : 'border-paper-3 bg-white hover:border-ink'}`}>
              {formatTime(t)}
            </button>
          ))}
        </div>
      )}
      <Toggle label="Ook als het vol is" description="Alle tijden tonen, bijvoorbeeld om er een auto tussen te schuiven." checked={force} onChange={setForce} />
      {booking.email && <Toggle label="Klant mailen" description="Stuur de nieuwe tijd naar de klant." checked={notify} onChange={setNotify} />}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="dark"
          className="h-10 text-sm"
          disabled={start === undefined}
          onClick={() => run(() => api<DayView>(`/admin/estadio/bookings/${booking.id}/move`, { body: { dayId, start, packageId, notify, force } }), 'Afspraak verplaatst')}
        >
          {start === undefined ? 'Kies een tijd' : `Verplaats naar ${formatTime(start)}`}
        </Button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Inline>
  );
}

function AddBooking({ view, onSaved, onClose }: { view: DayView; onSaved: (v: DayView) => void; onClose: () => void }) {
  const packages = view.packages;
  const [packageId, setPackageId] = useState(packages.find((p) => p.visible)?.id ?? packages[0].id);
  const [start, setStart] = useState<number>();
  const [force, setForce] = useState(false);
  const [details, setDetails] = useState<Details>({ name: '', email: '', phone: '', company: '', plate: '', vehicle: '', parking: '', notes: '' });
  const save = useSave();
  const pkg = packages.find((p) => p.id === packageId)!;
  const times = useMemo(() => {
    if (!force) return view.free[packageId] ?? [];
    const out: number[] = [];
    for (let t = view.day.start; t + pkg.duration <= view.day.end; t += view.day.interval) out.push(t);
    return out;
  }, [force, view, packageId, pkg]);

  async function submit() {
    const v = await save.run(() => api<DayView>(`/admin/estadio/days/${view.day.id}/bookings`, { body: { packageId, start, force, ...details } }), 'Afspraak toegevoegd');
    if (v) onSaved(v);
  }

  return (
    <Panel title="Afspraak toevoegen" description="Bijvoorbeeld na een telefoontje. Met een e-mailadres krijgt de klant dezelfde bevestiging als bij online boeken." className="mt-4">
      {save.error && <Notice tone="error">{save.error}</Notice>}
      <Select label="Pakket" value={packageId} onChange={(e) => (setPackageId(e.target.value), setStart(undefined))}>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {formatEuro(p.price)}, {formatDuration(p.duration)}
          </option>
        ))}
      </Select>
      <div>
        <p className="mb-1.5 text-sm font-medium">Tijd</p>
        {times.length === 0 ? (
          <p className="text-sm text-stone-dark">Geen vrije tijd meer voor dit pakket. Zet ‘Ook als het vol is’ aan om er een tussen te schuiven.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {times.map((t) => (
              <button key={t} type="button" onClick={() => setStart(t)} aria-pressed={start === t} className={`tabular h-10 border text-sm ${start === t ? 'border-ink bg-ink text-paper' : 'border-paper-3 bg-white hover:border-ink'}`}>
                {formatTime(t)}
              </button>
            ))}
          </div>
        )}
        {save.errors.start && <p className="mt-1.5 text-sm text-danger">{save.errors.start}</p>}
      </div>
      <Toggle label="Ook als het vol is" description="Alle tijden tonen, om een extra auto in te plannen." checked={force} onChange={(v) => (setForce(v), setStart(undefined))} />
      <DetailFields value={details} onChange={setDetails} errors={save.errors} />
      <div className="flex gap-2">
        <Button type="button" variant="dark" className="h-10 text-sm" onClick={submit} disabled={save.saving || start === undefined}>
          {save.saving ? 'Bezig…' : 'Toevoegen'}
        </Button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Panel>
  );
}

// --- Packages ---------------------------------------------------------------------------------

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/pakket/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'pakket';

function PackagesTab({ packages, onSaved }: { packages: EstadioPackage[]; onSaved: () => void }) {
  const { draft, setDraft, dirty, reset, markSaved } = useDraft(packages);
  const save = useSave();
  if (!draft) return <Loading />;
  const update = (i: number, p: Partial<EstadioPackage>) => setDraft(draft.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function submit() {
    // Empty lines are left out rather than refused.
    const clean = draft!.map((p) => ({ ...p, groups: p.groups.map((g) => ({ ...g, items: g.items.map((i) => i.trim()).filter(Boolean) })).filter((g) => g.title.trim() || g.items.length) }));
    const saved = await save.run(() => api<EstadioPackage[]>('/admin/estadio/packages', { method: 'PUT', body: clean }));
    if (saved) {
      markSaved(saved);
      onSaved();
    }
  }

  function add() {
    let id = 'nieuw';
    for (let n = 2; draft!.some((p) => p.id === id); n++) id = `nieuw-${n}`;
    setDraft([...draft!, { id, name: 'Nieuw pakket', scope: '', price: 0, duration: 60, intro: '', groups: [{ title: '', items: [] }], badge: '', visible: false }]);
  }

  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-stone-dark">
        Prijzen zijn <strong className="font-medium text-ink">exclusief btw</strong>, zoals op de boekingspagina. De duur bepaalt hoe lang een auto in de planning staat. Wijzigingen gelden voor nieuwe boekingen; bestaande afspraken houden hun pakket en prijs.
      </p>
      {draft.map((p, i) => (
        <Panel key={i}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-stone-dark">Pakket {i + 1}</p>
              <p className="mt-1 text-lg font-semibold">{p.name || 'Naamloos'}</p>
            </div>
            <RowControls
              index={i}
              count={draft.length}
              label="Pakket"
              onMove={(to) => setDraft(move(draft, i, to))}
              onRemove={() => confirmAction(`${p.name} verwijderen? Bestaande afspraken blijven staan.`) && setDraft(draft.filter((_, j) => j !== i))}
            />
          </div>
          <Toggle label="Zichtbaar op de boekingspagina" checked={p.visible} onChange={(visible) => update(i, { visible })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Naam" value={p.name} onChange={(e) => update(i, { name: e.target.value, ...(p.id.startsWith('nieuw') ? { id: slug(e.target.value) } : {}) })} />
            <Input label="Omvang" placeholder="Bijv. Interieur & exterieur" optional value={p.scope} onChange={(e) => update(i, { scope: e.target.value })} />
            <MoneyInput label="Prijs" cents={p.price} hint="Bedrag in euro, exclusief btw." onChange={(price) => update(i, { price: price ?? 0 })} />
            <Select label="Duur in de planning" value={p.duration} onChange={(e) => update(i, { duration: Number(e.target.value) })}>
              {[30, 45, 60, 75, 90, 105, 120, 150, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Korte omschrijving" optional rows={2} value={p.intro} onChange={(e) => update(i, { intro: e.target.value })} />
          {p.groups.map((g, gi) => (
            <div key={gi} className="space-y-3 border-l-2 border-paper-3 pl-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label="Kopje" optional placeholder="Bijv. Interieur" value={g.title} onChange={(e) => update(i, { groups: p.groups.map((x, j) => (j === gi ? { ...x, title: e.target.value } : x)) })} />
                </div>
                <button type="button" className="grid h-12 w-10 place-items-center text-stone-dark hover:text-danger" aria-label="Kopje verwijderen" onClick={() => update(i, { groups: p.groups.filter((_, j) => j !== gi) })}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <LineList label="Wat is inbegrepen" items={g.items} addLabel="Punt toevoegen" max={12} onChange={(items) => update(i, { groups: p.groups.map((x, j) => (j === gi ? { ...x, items } : x)) })} />
            </div>
          ))}
          {p.groups.length < 6 && (
            <button type="button" onClick={() => update(i, { groups: [...p.groups, { title: '', items: [] }] })} className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
              <Plus className="h-4 w-4" aria-hidden />
              Kopje toevoegen
            </button>
          )}
          <Input label="Label" optional placeholder="Bijv. Meest compleet" hint="Klein label bovenaan de kaart." value={p.badge} onChange={(e) => update(i, { badge: e.target.value })} className="sm:max-w-64" />
        </Panel>
      ))}
      {draft.length < 8 && (
        <Button type="button" variant="outline-dark" onClick={add}>
          <Plus className="h-4 w-4" aria-hidden />
          Pakket toevoegen
        </Button>
      )}
      <SaveBar dirty={dirty} saving={save.saving} onSave={submit} onReset={reset} error={save.error} />
    </div>
  );
}

// --- Texts and rules --------------------------------------------------------------------------

function SettingsTab({ settings, estadioUrl, onSaved }: { settings: EstadioSettings; estadioUrl: string; onSaved: () => void }) {
  const { draft, setDraft, dirty, reset, markSaved } = useDraft(settings);
  const save = useSave();
  if (!draft) return <Loading />;
  const set = <K extends keyof EstadioSettings>(key: K, value: EstadioSettings[K]) => setDraft({ ...draft, [key]: value });
  const num = (key: 'cancelHours' | 'closeHours') => (e: { target: { value: string } }) => set(key, Math.max(0, Math.round(Number(e.target.value) || 0)));

  async function submit() {
    const saved = await save.run(() => api<EstadioSettings>('/admin/estadio/settings', { method: 'PUT', body: { ...draft, practical: draft!.practical.map((l) => l.trim()).filter(Boolean) } }));
    if (saved) {
      markSaved(saved);
      onSaved();
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <Toggle
          label="Online boeken staat aan"
          description={draft.enabled ? `Medewerkers kunnen boeken op ${estadioUrl.replace(/^https?:\/\//, '')}.` : 'De pagina toont de pakketten, maar boeken kan niet. Bestaande afspraken blijven staan.'}
          checked={draft.enabled}
          onChange={(v) => set('enabled', v)}
        />
      </Panel>
      <Panel title="Teksten">
        <Input label="Kop" value={draft.headline} error={save.errors.headline} onChange={(e) => set('headline', e.target.value)} />
        <Textarea label="Introductie" rows={3} value={draft.intro} error={save.errors.intro} onChange={(e) => set('intro', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Locatie" value={draft.locationName} error={save.errors.locationName} onChange={(e) => set('locationName', e.target.value)} />
          <Input label="Adres" value={draft.address} error={save.errors.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <Input label="Regel onder de prijzen" optional value={draft.paymentNote} hint="Bijv. hoe en wanneer er betaald wordt." onChange={(e) => set('paymentNote', e.target.value)} />
        <LineList label="Goed om te weten" hint="Staat op de pagina, in de bevestiging en in de herinnering." items={draft.practical} long max={8} addLabel="Punt toevoegen" error={save.errors.practical} onChange={(v) => set('practical', v)} />
      </Panel>
      <Panel title="Regels">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Zelf wijzigen of annuleren tot" type="number" min={0} inputMode="numeric" value={draft.cancelHours} onChange={num('cancelHours')} hint="Uur voor de afspraak. Daarna moeten ze bellen of appen." />
          <Input label="Boeken kan tot" type="number" min={0} inputMode="numeric" value={draft.closeHours} onChange={num('closeHours')} hint="Uur voor de starttijd." />
        </div>
        <Toggle label="Herinnering de dag ervoor" description="Een mail vanaf 10:00 de dag voor de afspraak, met de link om te wijzigen." checked={draft.reminders} onChange={(v) => set('reminders', v)} />
      </Panel>
      <SaveBar dirty={dirty} saving={save.saving} onSave={submit} onReset={reset} error={save.error} />
    </div>
  );
}

// --- Google Calendar ---------------------------------------------------------------------------

function GoogleTab() {
  const { data, setData, error, reload } = useAdminData<GoogleStatus>('/admin/estadio/google');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const toast = useToast();

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  async function act(fn: () => Promise<GoogleStatus>, message: string) {
    setBusy(true);
    setActionError(undefined);
    try {
      setData(await fn());
      toast(message);
    } catch (err) {
      setActionError(errorText(err, 'Dat is niet gelukt.'));
    } finally {
      setBusy(false);
    }
  }

  if (!data.connected || editing) {
    return (
      <GoogleSetup
        current={data}
        onSaved={(status) => {
          setData(status);
          setEditing(false);
          toast('Google Agenda gekoppeld');
        }}
        onCancel={data.connected ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex items-start gap-4">
          <CalendarCheck2 className={`mt-0.5 h-6 w-6 shrink-0 ${data.enabled ? 'text-[#2f6b4f]' : 'text-stone-dark'}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{data.enabled ? `Gekoppeld met ${data.calendarName}` : 'Koppeling gepauzeerd'}</p>
            <p className="mt-1 break-all text-sm text-stone-dark">
              {data.calendarId} · via {data.serviceEmail}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Figure value={String(data.synced)} label="in de agenda" />
          <Figure value={String(data.waiting)} label="wachten" />
          <Figure value={String(data.failed)} label="mislukt" />
        </div>
        <p className="text-sm text-stone-dark">
          Elke boeking komt als afspraak in de agenda, met kenteken, naam, pakket en telefoonnummer. Verplaatst of geannuleerd? Dan verandert of verdwijnt de afspraak vanzelf. Kleuren: Opfris groen, Interieur blauw, Premium geel.
        </p>
      </Panel>

      {(actionError || (data.failed > 0 && data.lastError)) && <ErrorBox message={actionError ?? `Laatste fout: ${data.lastError}`} />}

      <Panel>
        <Toggle
          label="Boekingen in de agenda zetten"
          description={data.enabled ? 'Nieuwe en gewijzigde boekingen gaan direct naar de agenda.' : 'Gepauzeerd: er wordt niets naar de agenda gestuurd. Zet je het weer aan, dan wordt alles bijgewerkt.'}
          checked={data.enabled}
          onChange={(enabled) => act(() => api<GoogleStatus>('/admin/estadio/google', { method: 'PUT', body: { calendarId: data.calendarId, enabled } }), enabled ? 'Koppeling staat aan' : 'Koppeling gepauzeerd')}
        />
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="dark" className="h-10 text-sm" disabled={busy || !data.enabled} onClick={() => act(() => api<GoogleStatus>('/admin/estadio/google/sync', { body: {} }), 'Agenda bijgewerkt')}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
          Nu bijwerken
        </Button>
        <Button type="button" variant="outline-dark" className="h-10 text-sm" disabled={busy} onClick={() => setEditing(true)}>
          Andere agenda of sleutel
        </Button>
        <Button
          type="button"
          variant="outline-dark"
          className="h-10 text-sm text-danger"
          disabled={busy}
          onClick={() =>
            confirmAction('De Google Agenda ontkoppelen? Afspraken die al in de agenda staan blijven staan; nieuwe boekingen komen er niet meer in.') &&
            act(() => api<GoogleStatus>('/admin/estadio/google', { method: 'DELETE' }), 'Ontkoppeld')
          }
        >
          Ontkoppelen
        </Button>
      </div>
    </div>
  );
}

function GoogleSetup({ current, onSaved, onCancel }: { current: GoogleStatus; onSaved: (s: GoogleStatus) => void; onCancel?: () => void }) {
  const [json, setJson] = useState('');
  const [fileName, setFileName] = useState<string>();
  const [calendarId, setCalendarId] = useState(current.calendarId ?? '');
  const save = useSave();
  const toast = useToast();

  // The service account's address, read from the key in the browser, so it can be copied for step 5.
  const serviceEmail = useMemo(() => {
    try {
      return (JSON.parse(json) as { client_email?: string }).client_email;
    } catch {
      return undefined;
    }
  }, [json]) ?? current.serviceEmail;

  async function submit() {
    const status = await save.run(
      () => api<GoogleStatus>('/admin/estadio/google', { method: 'PUT', body: { calendarId, enabled: true, ...(json.trim() ? { serviceAccount: json } : {}) } }),
      'Verbinding werkt',
    );
    if (status) onSaved(status);
  }

  const link = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {text}
    </a>
  );
  const steps: ReactNode[] = [
    <>Ga naar {link('https://console.cloud.google.com/projectcreate', 'Google Cloud')} en maak een project aan, bijvoorbeeld ‘Detail2Go website’. Dit is gratis.</>,
    <>Zet de {link('https://console.cloud.google.com/apis/library/calendar-json.googleapis.com', 'Google Calendar API')} aan voor dat project (knop ‘Inschakelen’).</>,
    <>Maak bij {link('https://console.cloud.google.com/iam-admin/serviceaccounts', 'Service-accounts')} een service-account, bijvoorbeeld ‘estadio-agenda’. Rollen of rechten zijn niet nodig.</>,
    <>Open het service-account → <strong className="font-medium">Sleutels</strong> → <strong className="font-medium">Sleutel toevoegen</strong> → <strong className="font-medium">JSON</strong>. Er wordt een bestand gedownload; kies dat hieronder.</>,
    <>
      Open in Google Agenda (op de computer) de <strong className="font-medium">instellingen van jullie gedeelde agenda</strong> → ‘Delen met bepaalde personen’ → voeg {serviceEmail ? <strong className="break-all font-medium">{serviceEmail}</strong> : 'het e-mailadres van het service-account'} toe met{' '}
      <strong className="font-medium">Wijzigingen aanbrengen in afspraken</strong>.
    </>,
    <>Kopieer op dezelfde pagina bij ‘Agenda integreren’ de <strong className="font-medium">Agenda-ID</strong> en plak die hieronder.</>,
  ];

  return (
    <div className="space-y-6">
      <Panel title="Google Agenda koppelen" description="Dan komt elke boeking automatisch in jullie gedeelde agenda, en verandert of verdwijnt hij vanzelf bij verplaatsen of annuleren. Eenmalig instellen, ongeveer 10 minuten.">
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="tabular grid h-6 w-6 shrink-0 place-items-center bg-ink text-xs font-semibold text-paper">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-stone-dark">Lukt stap 4 niet door een melding over organisatiebeleid? Dan blokkeert jullie Google Workspace het maken van sleutels; een Workspace-beheerder kan dat voor dit project toestaan.</p>
      </Panel>

      <Panel>
        {save.error && <Notice tone="error">{save.error}</Notice>}
        <div>
          <p className="mb-1.5 text-sm font-medium">Sleutelbestand (JSON)</p>
          <label className="flex cursor-pointer items-center gap-3 border border-dashed border-paper-3 bg-white px-4 py-4 text-[15px] hover:border-ink">
            <FileJson className="h-5 w-5 shrink-0 text-stone-dark" aria-hidden />
            <span className="min-w-0 truncate">{fileName ?? (current.connected ? 'Huidige sleutel blijft; kies een bestand om hem te vervangen' : 'Kies het gedownloade JSON-bestand')}</span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                setJson(await file.text());
              }}
            />
          </label>
          {save.errors.serviceAccount && <p className="mt-1.5 text-sm text-danger">{save.errors.serviceAccount}</p>}
          {serviceEmail && (
            <button type="button" onClick={() => navigator.clipboard.writeText(serviceEmail).then(() => toast('E-mailadres gekopieerd'))} className="mt-2 inline-flex items-center gap-1.5 text-sm text-stone-dark hover:text-ink">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Kopieer {serviceEmail} (voor stap 5)
            </button>
          )}
        </div>
        <Input
          label="Agenda-ID"
          placeholder="…@group.calendar.google.com"
          hint="Staat bij de instellingen van de agenda onder ‘Agenda integreren’."
          value={calendarId}
          error={save.errors.calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="dark" onClick={submit} disabled={save.saving || !calendarId.trim() || (!json && !current.connected)}>
            {save.saving ? 'Verbinding testen…' : 'Koppelen en testen'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline-dark" onClick={onCancel}>
              Annuleren
            </Button>
          )}
        </div>
        <p className="text-sm text-stone-dark">We zetten één testafspraak in de agenda en halen die meteen weer weg, zodat we zeker weten dat het werkt. De sleutel wordt versleuteld opgeslagen.</p>
      </Panel>
    </div>
  );
}
