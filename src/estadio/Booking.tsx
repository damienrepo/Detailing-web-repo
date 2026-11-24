// The booking flow: package → day and time → details. The step lives in the URL (?pakket=…&dag=…&tijd=…), so the
// phone's back button goes back one step and a link to one package can be shared (e.g. ?pakket=premium).
import { ArrowLeft, CalendarDays, Car, CircleCheck, Clock, LoaderCircle, MapPin, ParkingSquare, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatDate, formatDuration, formatEuro, formatTime, type EstadioPackage, type EstadioPublicInfo, type PublicEstadioBooking, type PublicEstadioDay } from '../../shared/estadio';
import { SITE } from '../../shared/site';
import { Button, Input, Notice, Textarea } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { LoadError, Loading, useEstadioInfo } from './EstadioApp';
import { DayPicker, PackageCard, PlateInput, StepBar, SummaryRow, TimeGrid } from './parts';

export default function Booking({ onSiteUrl }: { onSiteUrl: (url: string) => void }) {
  const { info, error, reload } = useEstadioInfo();
  useEffect(() => {
    if (info) onSiteUrl(info.siteUrl);
  }, [info, onSiteUrl]);
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!info) return <Loading />;
  return <Flow info={info} reload={reload} />;
}

function Flow({ info, reload }: { info: EstadioPublicInfo; reload: () => Promise<void> }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [conflict, setConflict] = useState<string>();

  const pkg = info.packages.find((p) => p.id === params.get('pakket'));
  const bookable = (d: PublicEstadioDay) => Boolean(pkg && d.slots[pkg.id]?.length);
  const day = info.days.find((d) => String(d.id) === params.get('dag') && bookable(d)) ?? info.days.find(bookable);
  const time = Number(params.get('tijd'));
  const timeOk = Boolean(pkg && day && params.get('tijd') && day.slots[pkg.id]?.includes(time));
  const step = !pkg ? 1 : !timeOk ? 2 : 3;

  const go = (next: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v !== undefined) search.set(k, String(v));
    navigate({ search: search.toString() ? `?${search}` : '' });
  };

  if (step === 1) return <ChoosePackage info={info} onChoose={(p) => go({ pakket: p.id })} />;
  if (step === 2)
    return (
      <ChooseTime
        info={info}
        pkg={pkg!}
        day={day}
        conflict={conflict}
        onBack={() => go({})}
        onDay={(d) => go({ pakket: pkg!.id, dag: d })}
        onTime={(t) => {
          setConflict(undefined);
          go({ pakket: pkg!.id, dag: day!.id, tijd: t });
        }}
      />
    );
  return (
    <Details
      info={info}
      pkg={pkg!}
      day={day!}
      start={time}
      onChangeTime={() => go({ pakket: pkg!.id, dag: day!.id })}
      onConflict={async (message) => {
        setConflict(message);
        await reload();
        go({ pakket: pkg!.id, dag: day!.id });
      }}
    />
  );
}

// --- Step 1 -------------------------------------------------------------------------------

function ChoosePackage({ info, onChoose }: { info: EstadioPublicInfo; onChoose: (p: EstadioPackage) => void }) {
  const { settings, packages, days } = info;
  const next = days.find((d) => Object.values(d.slots).some((s) => s.length));
  const soldOut = (p: EstadioPackage) => days.length > 0 && !days.some((d) => d.slots[p.id]?.length);

  return (
    <>
      <section className="bg-ink text-paper">
        <div className="container-page pb-10 pt-8 md:pb-16 md:pt-14">
          <p className="eyebrow flex items-center gap-3 text-paper/60">
            <span className="text-accent">Wasdag op locatie</span>
            <span aria-hidden className="h-px w-6 bg-current opacity-40" />
            <span>{settings.locationName}</span>
          </p>
          <h1 className="font-display mt-5 max-w-2xl text-[clamp(2.4rem,9vw,4.5rem)] leading-[0.98]">{settings.headline}</h1>
          {settings.intro && <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-paper/70">{settings.intro}</p>}

          {settings.enabled && (
            <div className="mt-8 border border-white/15 bg-white/[0.03] p-5 md:inline-flex md:min-w-96 md:flex-col">
              <p className="eyebrow text-paper/50">{next ? 'Eerstvolgende wasdag' : 'Wasdag'}</p>
              {next ? (
                <>
                  <p className="font-display mt-2 text-2xl first-letter:uppercase">{formatDate(next.date)}</p>
                  <p className="tabular mt-1 flex items-center gap-2 text-[15px] text-paper/70">
                    <Clock className="h-4 w-4" aria-hidden />
                    {formatTime(next.start)} – {formatTime(next.end)}
                    <span aria-hidden className="text-paper/30">·</span>
                    <span className="text-accent">nog plek vrij</span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed text-paper/70">
                  {days.length ? 'De geplande wasdagen zitten vol.' : 'De volgende wasdag wordt binnenkort ingepland.'} Kijk later nog eens of{' '}
                  <a href={SITE.whatsapp} className="text-paper underline underline-offset-4">
                    app ons
                  </a>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="bg-estadio-sand text-ink">
        <div className="container-page flex flex-col gap-2 py-4 text-sm sm:flex-row sm:items-center sm:gap-6">
          <p className="flex items-center gap-2 font-medium">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {settings.locationName} · {settings.address}
          </p>
          <p className="flex items-center gap-2 text-ink/70">
            <ParkingSquare className="h-4 w-4 shrink-0" aria-hidden />
            Je auto blijft gewoon op het terrein staan
          </p>
        </div>
      </div>

      <section className="container-page py-10 md:py-14" aria-labelledby="pakketten">
        {!settings.enabled && (
          <div className="mb-8">
            <Notice>
              Online boeken is op dit moment niet mogelijk. Bel of app ons op{' '}
              <a href={`tel:${SITE.phoneHref}`} className="underline underline-offset-2">
                {SITE.phone}
              </a>
              .
            </Notice>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <StepBar step={1} />
            <h2 id="pakketten" className="font-display mt-5 text-[clamp(1.9rem,6vw,2.75rem)] leading-[1.02]">
              Kies je pakket
            </h2>
          </div>
          {settings.paymentNote && <p className="text-sm text-stone-dark">{settings.paymentNote}</p>}
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <PackageCard key={p.id} pkg={p} soldOut={!settings.enabled || soldOut(p)} onChoose={() => onChoose(p)} />
          ))}
        </div>
      </section>

      <HowItWorks practical={settings.practical} />
    </>
  );
}

function HowItWorks({ practical }: { practical: string[] }) {
  const steps = [
    { icon: CalendarDays, title: 'Kies pakket en tijd', text: 'In een minuut geregeld, je krijgt direct een bevestiging.' },
    { icon: Car, title: 'Parkeer zoals altijd', text: 'Je auto blijft gewoon op het terrein van Estadio staan.' },
    { icon: Sparkles, title: 'Wij wassen, jij werkt', text: 'Na je werkdag stap je in een schone auto.' },
  ];
  return (
    <section className="border-t border-paper-3 bg-paper-2/60" aria-labelledby="zo-werkt-het">
      <div className="container-page py-12 md:py-16">
        <h2 id="zo-werkt-het" className="font-display text-[clamp(1.6rem,5vw,2.25rem)] leading-tight">
          Zo werkt het
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-4">
              <span className="tabular grid h-10 w-10 shrink-0 place-items-center bg-ink text-paper">
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="sr-only">Stap {i + 1}</span>
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-stone-dark">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        {practical.length > 0 && (
          <div className="mt-10 border-t border-ink/10 pt-8">
            <p className="eyebrow text-stone-dark">Goed om te weten</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {practical.map((line) => (
                <li key={line} className="border-l-2 border-accent-fill pl-4 text-[15px] leading-relaxed text-ink/85">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// --- Step 2 -------------------------------------------------------------------------------

function ChosenPackage({ pkg, onChange }: { pkg: EstadioPackage; onChange: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4 border border-paper-3 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{pkg.name}</p>
        <p className="tabular text-sm text-stone-dark">
          {formatEuro(pkg.price)} excl. btw · ± {formatDuration(pkg.duration)}
        </p>
      </div>
      <button type="button" onClick={onChange} className="shrink-0 text-sm font-medium underline underline-offset-4">
        Wijzig
      </button>
    </div>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 mb-6 inline-flex h-10 items-center gap-1.5 px-1 text-sm text-stone-dark hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

function ChooseTime({
  info,
  pkg,
  day,
  conflict,
  onBack,
  onDay,
  onTime,
}: {
  info: EstadioPublicInfo;
  pkg: EstadioPackage;
  day?: PublicEstadioDay;
  conflict?: string;
  onBack: () => void;
  onDay: (id: number) => void;
  onTime: (start: number) => void;
}) {
  return (
    <section className="container-page max-w-3xl py-6 md:py-12">
      <BackLink onClick={onBack}>Ander pakket</BackLink>
      <StepBar step={2} />
      <h1 className="font-display mt-5 text-[clamp(1.9rem,6vw,2.75rem)] leading-[1.02]">Kies een dag en tijd</h1>
      <ChosenPackage pkg={pkg} onChange={onBack} />

      {conflict && (
        <div className="mt-6">
          <Notice tone="error">{conflict}</Notice>
        </div>
      )}

      {!day ? (
        <div className="mt-8">
          <Notice>
            {info.days.length
              ? `Voor het ${pkg.name} is op de geplande wasdagen geen tijd meer vrij. Kies een ander pakket of kijk later nog eens.`
              : 'Er staat nog geen nieuwe wasdag gepland. Kijk later nog eens.'}{' '}
            Vragen? App ons op{' '}
            <a href={SITE.whatsapp} className="underline underline-offset-2">
              {SITE.phone}
            </a>
            .
          </Notice>
        </div>
      ) : (
        <>
          <h2 className="eyebrow mt-10 text-stone-dark">Dag</h2>
          <div className="mt-3">
            <DayPicker days={info.days} packageId={pkg.id} value={day.id} onChange={onDay} />
          </div>
          {day.note && <p className="mt-4 border-l-2 border-accent-fill pl-3 text-[15px] text-ink/85">{day.note}</p>}

          <h2 className="eyebrow mt-10 text-stone-dark">
            Tijd <span className="sr-only">op {formatDate(day.date)}</span>
          </h2>
          <div className="mt-3">
            <TimeGrid times={day.slots[pkg.id] ?? []} duration={pkg.duration} onChange={onTime} />
          </div>
          <p className="mt-4 text-sm text-stone-dark">De tijden zijn een indicatie en kunnen iets uitlopen.</p>
        </>
      )}
    </section>
  );
}

// --- Step 3 -------------------------------------------------------------------------------

const REMEMBER_KEY = 'd2g_estadio_gegevens';
const FIELDS = ['name', 'email', 'phone', 'company', 'plate', 'vehicle', 'notes'] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string>;
const REMEMBERED: Field[] = ['name', 'email', 'phone', 'company', 'plate', 'vehicle'];

type Vehicle = { found: false } | { found: true; description: string; year: string };
type Lookup = { state: 'idle' | 'loading' | 'error' } | { state: 'done'; vehicle: Vehicle };

/** Looks a Dutch plate (6 letters and digits) up at the RDW, through our server, shortly after typing stops. */
function useVehicleLookup(plate: string): Lookup {
  const key = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  useEffect(() => {
    if (key.length !== 6) {
      setLookup({ state: 'idle' });
      return;
    }
    let current = true;
    setLookup({ state: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const vehicle = await api<Vehicle>(`/estadio/voertuig/${key}`);
        if (current) setLookup({ state: 'done', vehicle });
      } catch {
        if (current) setLookup({ state: 'error' });
      }
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key]);
  return lookup;
}

function VehicleStatus({ lookup }: { lookup: Lookup }) {
  const line = 'mt-2 flex items-start gap-2 text-sm';
  return (
    <div aria-live="polite" className="min-h-5">
      {lookup.state === 'loading' && (
        <p className={`${line} text-stone-dark`}>
          <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Kenteken opzoeken bij de RDW…
        </p>
      )}
      {lookup.state === 'done' && lookup.vehicle.found && (
        <p className={`${line} font-medium text-[#24533d]`}>
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {lookup.vehicle.description}
            {lookup.vehicle.year && <span className="font-normal text-stone-dark"> · {lookup.vehicle.year}</span>}
          </span>
        </p>
      )}
      {lookup.state === 'done' && !lookup.vehicle.found && (
        <p className={`${line} text-stone-dark`}>Niet gevonden bij de RDW. Een buitenlands kenteken? Vul merk en model hieronder zelf in.</p>
      )}
      {lookup.state === 'error' && <p className={`${line} text-stone-dark`}>Opzoeken lukt nu even niet. Vul merk en model hieronder zelf in.</p>}
    </div>
  );
}

function loadRemembered(): Partial<Form> | undefined {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw ? (JSON.parse(raw) as Partial<Form>) : undefined;
  } catch {
    return undefined;
  }
}

function Details({
  info,
  pkg,
  day,
  start,
  onChangeTime,
  onConflict,
}: {
  info: EstadioPublicInfo;
  pkg: EstadioPackage;
  day: PublicEstadioDay;
  start: number;
  onChangeTime: () => void;
  onConflict: (message: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const remembered = useMemo(loadRemembered, []);
  const [form, setForm] = useState<Form>(() => ({ ...Object.fromEntries(FIELDS.map((f) => [f, ''])), ...remembered }) as Form);
  const [remember, setRemember] = useState(Boolean(remembered));
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Brand, model and colour from the RDW. Only overwrites what the visitor typed themselves when they change the
  // plate (a different car); an earlier automatic value is always replaced.
  const lookup = useVehicleLookup(form.plate);
  const autoFilled = useRef<string>(undefined);
  const plateEdited = useRef(false);
  useEffect(() => {
    if (lookup.state !== 'done') return;
    const found = lookup.vehicle.found ? lookup.vehicle.description : '';
    const ours = form.vehicle === autoFilled.current;
    if (found ? !form.vehicle || ours || plateEdited.current : ours) {
      autoFilled.current = found || undefined;
      plateEdited.current = false;
      setForm((f) => ({ ...f, vehicle: found }));
    }
    // Runs once per lookup result, with the form as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup]);

  const field = (key: Field) => ({
    value: form[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(undefined);
    try {
      const booking = await api<PublicEstadioBooking>('/estadio/bookings', { body: { packageId: pkg.id, dayId: day.id, start, ...form, website } });
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify(Object.fromEntries(REMEMBERED.map((k) => [k, k === 'plate' ? booking.plate : form[k]]))));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // Private mode: nothing to remember.
      }
      navigate(`/boeking/${booking.publicId}`, { state: { justBooked: true } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !err.fields.plate) return void (await onConflict(err.message));
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Versturen is niet gelukt. Probeer het opnieuw of bel ons.');
      // Show the message, which sits above the fields.
      document.getElementById('details-top')?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container-page max-w-3xl py-6 md:py-12">
      <BackLink onClick={onChangeTime}>Andere tijd</BackLink>
      <StepBar step={3} />
      <h1 id="details-top" className="font-display mt-5 text-[clamp(1.9rem,6vw,2.75rem)] leading-[1.02]">
        Je gegevens
      </h1>

      <dl className="mt-6 divide-y divide-white/10 bg-ink px-5 py-2 text-paper">
        <SummaryRow label="Pakket">{pkg.name}</SummaryRow>
        <SummaryRow label="Wanneer">
          <span className="first-letter:uppercase">{formatDate(day.date)}</span>
          <br />
          <span className="tabular text-accent">
            {formatTime(start)} – {formatTime(start + pkg.duration)}
          </span>
        </SummaryRow>
        <SummaryRow label="Waar">{info.settings.locationName}</SummaryRow>
        <SummaryRow label="Prijs">
          <span className="tabular">{formatEuro(pkg.price)}</span> <span className="text-paper/55">excl. btw</span>
        </SummaryRow>
      </dl>

      <form onSubmit={submit} noValidate className="mt-8 space-y-8">
        {formError && <Notice tone="error">{formError}</Notice>}

        <fieldset className="space-y-4">
          <legend className="eyebrow mb-4 text-stone-dark">Over jou</legend>
          <Input label="Naam" autoComplete="name" enterKeyHint="next" required {...field('name')} />
          <Input label="E-mailadres" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" required hint="Hier sturen we de bevestiging naartoe." {...field('email')} />
          <Input label="Telefoonnummer" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" required hint="Voor als we je op de dag zelf nodig hebben." {...field('phone')} />
          <Input label="Bedrijf" autoComplete="organization" optional hint="Bij welk bedrijf in Estadio werk je?" {...field('company')} />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="eyebrow mb-4 text-stone-dark">Over je auto</legend>
          <div>
            <PlateInput
              label="Kenteken"
              required
              enterKeyHint="next"
              {...field('plate')}
              onChange={(e) => {
                plateEdited.current = true;
                field('plate').onChange(e);
              }}
            />
            <VehicleStatus lookup={lookup} />
          </div>
          <Input
            label="Merk, model en kleur"
            optional
            placeholder="Bijv. Volkswagen Golf, zwart"
            hint={form.vehicle && form.vehicle === autoFilled.current ? 'Ingevuld via de RDW. Klopt het niet? Pas het gerust aan.' : 'Wordt ingevuld zodra je je kenteken typt.'}
            {...field('vehicle')}
          />
          <Textarea label="Opmerking" optional rows={3} maxLength={600} placeholder="Bijv. hondenharen op de achterbank of een vlek waar we extra op letten" {...field('notes')} />
        </fieldset>

        {/* Honeypot for spam bots, hidden from people and screen readers. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
          <span>
            Onthoud mijn gegevens op dit apparaat
            <span className="block text-sm text-stone-dark">Handig voor de volgende wasdag. Alleen op deze telefoon of computer bewaard.</span>
          </span>
        </label>

        <div className="border-t border-ink/10 pt-6">
          <Button type="submit" variant="accent" arrow disabled={busy} className="h-14 w-full text-base">
            {busy ? 'Bezig met boeken…' : 'Afspraak bevestigen'}
          </Button>
          <p className="mt-3 text-center text-sm text-stone-dark">
            Je krijgt direct een bevestiging per e-mail. We gebruiken je gegevens alleen voor deze afspraak (
            <a href={`${info.siteUrl}/privacy`} className="underline underline-offset-2">
              privacy
            </a>
            ).
          </p>
        </div>
      </form>
    </section>
  );
}
