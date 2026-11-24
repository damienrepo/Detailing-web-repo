// Building blocks of the Estadio booking page.
import { Check, Clock, MessageCircle, Phone } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDate, formatDuration, formatEuro, formatTime, type EstadioPackage, type PublicEstadioDay } from '../../shared/estadio';
import { SITE } from '../../shared/site';

// --- Brand ------------------------------------------------------------------------------

/** "Detail2Go × ESTADIO": our wordmark next to Estadio's, in their own typeface and gold. */
export function Lockup({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const sm = size === 'sm';
  return (
    <span className="inline-flex items-center gap-2.5" translate="no">
      <span className={`font-logo font-bold leading-none tracking-[-0.01em] ${sm ? 'text-[17px]' : 'text-[19px]'}`}>
        Detail<span className="text-accent">2</span>Go
      </span>
      <span aria-hidden className="text-[13px] text-paper/35">
        ×
      </span>
      <span className={`estadio-mark text-estadio-gold ${sm ? 'pt-0.5 text-[17px]' : 'pt-0.5 text-[20px]'}`}>Estadio</span>
      <span className="sr-only">Detail2Go bij Estadio</span>
    </span>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 pt-[env(safe-area-inset-top,0px)] text-paper backdrop-blur-sm">
      <div className="container-page flex h-14 items-center justify-between">
        <Link to="/" aria-label="Detail2Go bij Estadio — start">
          <Lockup />
        </Link>
        <a
          href={`tel:${SITE.phoneHref}`}
          className="-mr-2 inline-flex h-11 items-center gap-2 px-2 text-sm text-paper/75 transition-colors hover:text-paper"
          aria-label={`Bel Detail2Go: ${SITE.phone}`}
        >
          <Phone className="h-4 w-4" aria-hidden />
          <span className="max-sm:sr-only">{SITE.phone}</span>
        </a>
      </div>
    </header>
  );
}

export function Footer({ siteUrl }: { siteUrl?: string }) {
  const site = siteUrl ?? 'https://www.detail2go.nl';
  return (
    <footer className="bg-ink pb-safe text-paper">
      <div className="container-page py-12">
        <Lockup size="sm" />
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-paper/60">
          Vragen, iets bijzonders aan je auto of liever direct contact? We helpen je graag.
        </p>
        <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
          <a href={`tel:${SITE.phoneHref}`} className="inline-flex h-12 items-center gap-3 border border-white/15 px-4 text-[15px] hover:border-paper">
            <Phone className="h-4 w-4 text-accent" aria-hidden />
            Bel {SITE.phone}
          </a>
          <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-3 border border-white/15 px-4 text-[15px] hover:border-paper">
            <MessageCircle className="h-4 w-4 text-accent" aria-hidden />
            WhatsApp
          </a>
          <a href={`mailto:${SITE.email}`} className="inline-flex h-12 items-center gap-3 border border-white/15 px-4 text-[15px] hover:border-paper">
            {SITE.email}
          </a>
        </div>
        <nav aria-label="Juridisch" className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-[13px] text-paper/45">
          <span>© {new Date().getFullYear()} {SITE.legalName}</span>
          <a href={`${site}/privacy`} className="hover:text-paper">
            Privacy
          </a>
          <a href={`${site}/voorwaarden`} className="hover:text-paper">
            Algemene voorwaarden
          </a>
          <a href={site} className="hover:text-paper">
            detail2go.nl
          </a>
        </nav>
      </div>
    </footer>
  );
}

// --- Steps ------------------------------------------------------------------------------

export const STEPS = ['Pakket', 'Dag & tijd', 'Gegevens'] as const;

export function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-[13px]" aria-label={`Stap ${step} van 3`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'todo';
        return (
          <li key={label} className="flex min-w-0 items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={`tabular grid h-6 w-6 shrink-0 place-items-center text-[12px] font-semibold ${
                state === 'todo' ? 'border border-ink/20 text-stone-dark' : state === 'current' ? 'bg-ink text-paper' : 'bg-accent-fill text-ink'
              }`}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            <span className={`truncate ${state === 'current' ? 'font-medium text-ink' : 'text-stone-dark max-sm:hidden'}`}>{label}</span>
            {n < 3 && <span aria-hidden className="h-px w-4 shrink-0 bg-ink/20 sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}

// --- Packages ---------------------------------------------------------------------------

export function PackageCard({ pkg, onChoose, chosen, soldOut }: { pkg: EstadioPackage; onChoose: () => void; chosen?: boolean; soldOut?: boolean }) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className={`relative flex flex-col border bg-white transition-colors ${chosen ? 'border-ink ring-1 ring-ink' : 'border-paper-3'} ${soldOut ? 'opacity-60' : ''}`}
    >
      {pkg.badge && <span className="eyebrow absolute -top-2.5 right-4 bg-accent-fill px-2 py-1 text-[10px] text-ink">{pkg.badge}</span>}
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div className="min-w-0">
          <h3 id={titleId} className="font-display text-[22px] leading-tight">
            {pkg.name}
          </h3>
          {pkg.scope && <p className="mt-1 text-sm text-stone-dark">{pkg.scope}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular font-display text-[26px] leading-none">{formatEuro(pkg.price)}</p>
          <p className="mt-1 text-xs text-stone-dark">excl. btw</p>
        </div>
      </div>
      <p className="flex items-center gap-2 border-y border-paper-2 bg-paper/50 px-5 py-2 text-sm text-stone-dark">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        Ongeveer {formatDuration(pkg.duration)}
      </p>
      <div className="flex-1 space-y-4 p-5">
        {pkg.intro && <p className="text-[15px] leading-relaxed text-stone-dark">{pkg.intro}</p>}
        {pkg.groups.map((g) => (
          <div key={g.title}>
            {g.title && <p className="eyebrow mb-2 text-stone-dark">{g.title}</p>}
            <ul className="space-y-1.5">
              {g.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-snug">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="p-5 pt-0">
        <button
          type="button"
          onClick={onChoose}
          disabled={soldOut}
          aria-describedby={titleId}
          className={`flex h-12 w-full items-center justify-center gap-2 text-[15px] font-medium transition-colors disabled:cursor-not-allowed ${
            chosen ? 'bg-ink text-paper' : 'bg-accent-fill text-ink hover:bg-accent'
          }`}
        >
          {soldOut ? 'Vol op de geplande dagen' : chosen ? 'Gekozen' : 'Kies dit pakket'}
        </button>
      </div>
    </article>
  );
}

// --- Day and time ------------------------------------------------------------------------

export function DayPicker({ days, packageId, value, onChange }: { days: PublicEstadioDay[]; packageId: string; value?: number; onChange: (id: number) => void }) {
  const selected = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);
  return (
    <div role="radiogroup" aria-label="Kies een dag" className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {days.map((d) => {
        const free = d.slots[packageId]?.length ?? 0;
        const active = d.id === value;
        const [weekday, , month] = formatDate(d.date, { short: true }).split(' ');
        return (
          <button
            key={d.id}
            ref={active ? selected : undefined}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${formatDate(d.date)}${free ? '' : ', vol'}`}
            disabled={!free}
            onClick={() => onChange(d.id)}
            className={`flex w-[84px] shrink-0 snap-start flex-col items-center border px-2 py-3 transition-colors disabled:cursor-not-allowed ${
              active ? 'border-ink bg-ink text-paper' : free ? 'border-paper-3 bg-white hover:border-ink' : 'border-paper-3 bg-paper-2 text-stone'
            }`}
          >
            <span className="eyebrow">{weekday}</span>
            <span className="tabular font-display mt-1 text-[28px] leading-none">{Number(d.date.slice(8))}</span>
            <span className="mt-1 text-[13px]">{month}</span>
            <span className={`mt-2 text-[11px] font-medium ${active ? 'text-accent' : free ? 'text-[#2f6b4f]' : ''}`}>{free ? 'Plek vrij' : 'Vol'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TimeGrid({ times, duration, value, onChange }: { times: number[]; duration: number; value?: number; onChange: (start: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Kies een tijd" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {times.map((t) => {
        const active = t === value;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${formatTime(t)} tot ongeveer ${formatTime(t + duration)}`}
            onClick={() => onChange(t)}
            className={`flex h-14 flex-col items-center justify-center border transition-colors ${active ? 'border-ink bg-ink text-paper' : 'border-paper-3 bg-white hover:border-ink'}`}
          >
            <span className="tabular text-[17px] font-semibold leading-none">{formatTime(t)}</span>
            <span className={`tabular mt-1 text-[11px] leading-none ${active ? 'text-paper/60' : 'text-stone-dark'}`}>tot {formatTime(t + duration)}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Form fields ---------------------------------------------------------------------------

/** Number plate field that looks like a Dutch plate: yellow, with the blue EU strip. */
export const PlateInput = forwardRef<HTMLInputElement, ComponentProps<'input'> & { label: string; error?: string; hint?: string }>(function PlateInput(
  { label, error, hint, ...props },
  ref,
) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className={`flex h-14 max-w-64 overflow-hidden border-2 ${error ? 'border-danger' : 'border-ink'} bg-plate focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent`}>
        <span aria-hidden className="flex w-9 shrink-0 flex-col items-center justify-end bg-plate-eu pb-1.5 text-[11px] font-bold text-white">
          NL
        </span>
        <input
          ref={ref}
          id={id}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          placeholder="AB-123-C"
          className="tabular w-full min-w-0 bg-transparent px-3 text-center font-sans text-[24px] font-bold uppercase tracking-[0.08em] text-ink outline-none [font-stretch:112%] placeholder:text-ink/25"
          {...props}
        />
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} className={`mt-1.5 text-sm ${error ? 'text-danger' : 'text-stone-dark'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

// --- Misc ----------------------------------------------------------------------------------

export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-paper/55">{label}</dt>
      <dd className="text-right text-[15px]">{children}</dd>
    </div>
  );
}

/** Google Calendar link for an appointment (Apple and Outlook use the .ics file). */
export function googleCalendarUrl(input: { title: string; start: Date; end: Date; location: string; details: string }) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${stamp(input.start)}/${stamp(input.end)}`,
    location: input.location,
    details: input.details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
