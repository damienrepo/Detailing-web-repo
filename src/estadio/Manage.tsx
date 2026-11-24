// "Mijn afspraak": the page behind the link in every mail. Shows the appointment, adds it to a calendar, and lets the
// customer move or cancel it until the deadline. The unguessable id in the link is the only key, so no account.
import { CalendarPlus, CircleCheck, CircleX, MessageCircle, Phone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { formatDate, formatDuration, formatEuro, formatTime, toUtc, type PublicEstadioBooking } from '../../shared/estadio';
import { SITE } from '../../shared/site';
import { Button, ButtonLink, Notice } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { LoadError, Loading, useEstadioInfo } from './EstadioApp';
import { DayPicker, googleCalendarUrl, SummaryRow, TimeGrid } from './parts';

export default function Manage({ onSiteUrl }: { onSiteUrl: (url: string) => void }) {
  const { publicId = '' } = useParams();
  const justBooked = Boolean((useLocation().state as { justBooked?: boolean } | null)?.justBooked);
  const [booking, setBooking] = useState<PublicEstadioBooking>();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<'view' | 'move' | 'cancel'>('view');
  const [notice, setNotice] = useState<string>();
  // Texts and free times; the booking's own time counts as free when moving it.
  const info = useEstadioInfo(publicId);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setBooking(await api<PublicEstadioBooking>(`/estadio/bookings/${encodeURIComponent(publicId)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden is niet gelukt.');
    }
  }, [publicId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (info.info) onSiteUrl(info.info.siteUrl);
  }, [info.info, onSiteUrl]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!booking || !info.info) return info.error ? <LoadError message={info.error} onRetry={info.reload} /> : <Loading />;

  const settings = info.info.settings;
  const cancelled = booking.status === 'cancelled';
  const icsUrl = `/api/estadio/bookings/${encodeURIComponent(booking.publicId)}/agenda.ics`;
  const google = googleCalendarUrl({
    title: `${SITE.name}: ${booking.packageName} (${booking.plate})`,
    start: toUtc(booking.date, booking.start),
    end: toUtc(booking.date, booking.end),
    location: `${settings.locationName}, ${settings.address}`,
    details: `Bekijken, verplaatsen of annuleren: ${location.href.split('?')[0]}`,
  });

  const done = (b: PublicEstadioBooking, message: string) => {
    setBooking(b);
    setMode('view');
    setNotice(message);
    info.reload();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="container-page max-w-2xl py-8 md:py-14">
      {justBooked && !cancelled && !notice && (
        <div className="mb-8">
          <CircleCheck className="h-9 w-9 text-[#2f6b4f]" aria-hidden />
          <h1 className="font-display mt-4 text-[clamp(2.2rem,8vw,3.5rem)] leading-[1]">Je afspraak staat vast</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-stone-dark">
            Bedankt, {booking.name.split(' ')[0]}! We hebben een bevestiging gestuurd naar <strong className="font-medium text-ink">{booking.email}</strong>.
          </p>
        </div>
      )}
      {(!justBooked || cancelled || notice) && (
        <h1 className="font-display mb-6 text-[clamp(2rem,7vw,3rem)] leading-[1.02]">{cancelled ? 'Afspraak geannuleerd' : 'Je afspraak'}</h1>
      )}
      {notice && (
        <div className="mb-6">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}

      <div className={`text-paper ${cancelled ? 'bg-stone-dark' : 'bg-ink'}`}>
        <div className="border-b border-white/10 px-5 py-5">
          <p className="eyebrow text-paper/50">{cancelled ? 'Geannuleerd' : 'Wanneer'}</p>
          <p className={`font-display mt-2 text-[26px] leading-tight first-letter:uppercase ${cancelled ? 'line-through decoration-1' : ''}`}>{formatDate(booking.date)}</p>
          <p className="tabular mt-1 text-xl text-accent">
            {formatTime(booking.start)} – {formatTime(booking.end)}
          </p>
        </div>
        <dl className="divide-y divide-white/10 px-5 py-2">
          <SummaryRow label="Pakket">{booking.packageName}</SummaryRow>
          <SummaryRow label="Kenteken">
            <span className="tabular bg-plate px-2 py-0.5 font-bold tracking-[0.06em] text-ink">{booking.plate}</span>
          </SummaryRow>
          {booking.parking && <SummaryRow label="Staat op">{booking.parking}</SummaryRow>}
          <SummaryRow label="Waar">
            {settings.locationName}
            <br />
            <span className="text-paper/60">{settings.address}</span>
          </SummaryRow>
          <SummaryRow label="Prijs">
            <span className="tabular">{formatEuro(booking.price)}</span> <span className="text-paper/55">excl. btw</span>
          </SummaryRow>
        </dl>
      </div>

      {cancelled ? (
        <div className="mt-8">
          <p className="text-[17px] leading-relaxed text-stone-dark">Je bent altijd welkom op een volgende wasdag.</p>
          <ButtonLink to="/" variant="dark" arrow className="mt-5 w-full sm:w-auto">
            Nieuwe afspraak maken
          </ButtonLink>
        </div>
      ) : (
        <>
          {mode === 'view' && (
            <>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <a href={icsUrl} className="inline-flex h-12 items-center justify-center gap-2 border border-ink/25 bg-white text-[15px] font-medium hover:border-ink">
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Apple / Outlook agenda
                </a>
                <a href={google} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 border border-ink/25 bg-white text-[15px] font-medium hover:border-ink">
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Google Agenda
                </a>
              </div>

              {settings.practical.length > 0 && (
                <div className="mt-10">
                  <h2 className="eyebrow text-stone-dark">Goed om te weten</h2>
                  <ul className="mt-4 space-y-3">
                    {settings.practical.map((line) => (
                      <li key={line} className="border-l-2 border-accent-fill pl-4 text-[15px] leading-relaxed text-ink/85">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-10 border-t border-ink/10 pt-8">
                <h2 className="eyebrow text-stone-dark">Iets veranderd?</h2>
                {booking.changeable ? (
                  <>
                    <p className="mt-3 text-[15px] leading-relaxed text-stone-dark">Verplaatsen of annuleren kan online tot {booking.changeDeadline}.</p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant="dark" onClick={() => setMode('move')}>
                        Verplaatsen
                      </Button>
                      <Button type="button" variant="outline-dark" onClick={() => setMode('cancel')}>
                        Annuleren
                      </Button>
                    </div>
                  </>
                ) : (
                  <ContactInstead deadline={booking.status === 'booked' ? booking.changeDeadline : undefined} />
                )}
              </div>
            </>
          )}
          {mode === 'cancel' && <CancelConfirm booking={booking} onDone={(b) => done(b, 'Je afspraak is geannuleerd. Je krijgt een bevestiging per e-mail.')} onBack={() => setMode('view')} />}
          {mode === 'move' && (
            <Move booking={booking} info={info} onDone={(b) => done(b, 'Je afspraak is verplaatst. Je krijgt een bevestiging per e-mail.')} onBack={() => setMode('view')} />
          )}
        </>
      )}

      <p className="mt-12 text-sm text-stone-dark">
        <Link to="/" className="underline underline-offset-4">
          Nog een auto laten wassen?
        </Link>
      </p>
    </section>
  );
}

function ContactInstead({ deadline }: { deadline?: string }) {
  return (
    <>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-dark">
        {deadline ? `Online wijzigen kon tot ${deadline}.` : 'Deze afspraak kan online niet meer worden gewijzigd.'} Bel of app ons, dan kijken we wat er kan.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a href={`tel:${SITE.phoneHref}`} className="inline-flex h-12 items-center justify-center gap-2 bg-ink text-[15px] font-medium text-paper">
          <Phone className="h-4 w-4" aria-hidden />
          Bel {SITE.phone}
        </a>
        <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 border border-ink/25 bg-white text-[15px] font-medium">
          <MessageCircle className="h-4 w-4" aria-hidden />
          WhatsApp
        </a>
      </div>
    </>
  );
}

function CancelConfirm({ booking, onDone, onBack }: { booking: PublicEstadioBooking; onDone: (b: PublicEstadioBooking) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<PublicEstadioBooking>(`/estadio/bookings/${encodeURIComponent(booking.publicId)}/cancel`, { body: {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annuleren is niet gelukt.');
      setBusy(false);
    }
  }
  return (
    <div className="mt-8 border border-danger/30 bg-white p-5" role="alertdialog" aria-labelledby="cancel-title">
      <CircleX className="h-6 w-6 text-danger" aria-hidden />
      <h2 id="cancel-title" className="mt-3 text-lg font-semibold">
        Afspraak annuleren?
      </h2>
      <p className="mt-1 text-[15px] leading-relaxed text-stone-dark">
        Je {booking.packageName} op {formatDate(booking.date)} om {formatTime(booking.start)} vervalt en de tijd komt vrij voor een ander.
      </p>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={confirm} disabled={busy} className="h-12 bg-danger text-[15px] font-medium text-white disabled:opacity-50">
          {busy ? 'Bezig…' : 'Ja, annuleren'}
        </button>
        <Button type="button" variant="outline-dark" onClick={onBack} disabled={busy}>
          Nee, terug
        </Button>
      </div>
    </div>
  );
}

function Move({
  booking,
  info,
  onDone,
  onBack,
}: {
  booking: PublicEstadioBooking;
  info: ReturnType<typeof useEstadioInfo>;
  onDone: (b: PublicEstadioBooking) => void;
  onBack: () => void;
}) {
  const { packages, days } = info.info!;
  const [packageId, setPackageId] = useState(packages.some((p) => p.id === booking.packageId) ? booking.packageId : packages[0].id);
  const pkg = packages.find((p) => p.id === packageId)!;
  const bookable = days.filter((d) => d.slots[packageId]?.length);
  const [dayId, setDayId] = useState(bookable.find((d) => d.date === booking.date)?.id ?? bookable[0]?.id);
  const day = bookable.find((d) => d.id === dayId) ?? bookable[0];
  const [start, setStart] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    if (!day || start === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      onDone(await api<PublicEstadioBooking>(`/estadio/bookings/${encodeURIComponent(booking.publicId)}/reschedule`, { body: { packageId, dayId: day.id, start } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verplaatsen is niet gelukt.');
      if (err instanceof ApiError && err.status === 409) {
        setStart(undefined);
        info.reload();
      }
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">Afspraak verplaatsen</h2>
      <p className="mt-1 text-[15px] text-stone-dark">Kies een nieuwe dag en tijd. Een ander pakket kan ook.</p>

      <fieldset className="mt-6">
        <legend className="eyebrow text-stone-dark">Pakket</legend>
        <div className="mt-3 grid gap-2">
          {packages.map((p) => (
            <label key={p.id} className={`flex cursor-pointer items-center justify-between gap-3 border px-4 py-3 ${p.id === packageId ? 'border-ink bg-white ring-1 ring-ink' : 'border-paper-3 bg-white'}`}>
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="pakket"
                  checked={p.id === packageId}
                  onChange={() => {
                    setPackageId(p.id);
                    setStart(undefined);
                  }}
                  className="h-4 w-4 accent-ink"
                />
                <span className="font-medium">{p.name}</span>
              </span>
              <span className="tabular text-sm text-stone-dark">
                {formatEuro(p.price)} · {formatDuration(p.duration)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!day ? (
        <div className="mt-6">
          <Notice>Voor dit pakket is op de geplande wasdagen geen tijd meer vrij.</Notice>
        </div>
      ) : (
        <>
          <p className="eyebrow mt-8 text-stone-dark">Dag</p>
          <div className="mt-3">
            <DayPicker
              days={days}
              packageId={packageId}
              value={day.id}
              onChange={(id) => {
                setDayId(id);
                setStart(undefined);
              }}
            />
          </div>
          <p className="eyebrow mt-8 text-stone-dark">Tijd</p>
          <div className="mt-3">
            <TimeGrid times={day.slots[packageId] ?? []} duration={pkg.duration} value={start} onChange={setStart} />
          </div>
        </>
      )}

      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="accent" onClick={save} disabled={busy || start === undefined}>
          {busy ? 'Bezig…' : start === undefined ? 'Kies een tijd' : `Verplaats naar ${formatTime(start)}`}
        </Button>
        <Button type="button" variant="outline-dark" onClick={onBack} disabled={busy}>
          Terug
        </Button>
      </div>
    </div>
  );
}
