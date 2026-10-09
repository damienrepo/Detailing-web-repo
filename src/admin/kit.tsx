// Building blocks for the admin screens: data loading, form fields, list editors, the save bar and toasts.
import { ArrowDown, ArrowLeft, ArrowUp, Check, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Input, Textarea } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { imageUrl } from '../lib/images';
import { MediaPicker } from './media';

// --- Data -----------------------------------------------------------------------------

/** Loads admin data; pass null to skip loading. */
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const reload = useCallback(async () => {
    if (!path) return;
    setError(undefined);
    try {
      setData(await api<T>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden is niet gelukt.');
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, error, reload };
}

/** Form state with a saved snapshot, so we know when there are unsaved changes. */
export function useDraft<T>(initial: T | undefined) {
  const [draft, setDraft] = useState<T | undefined>(initial);
  const [saved, setSaved] = useState<string>(JSON.stringify(initial ?? null));
  useEffect(() => {
    if (initial !== undefined) {
      setDraft(initial);
      setSaved(JSON.stringify(initial));
    }
  }, [initial]);
  const dirty = draft !== undefined && JSON.stringify(draft) !== saved;
  useUnsavedWarning(dirty);
  const reset = () => setDraft(JSON.parse(saved));
  const markSaved = (value: T) => {
    setDraft(value);
    setSaved(JSON.stringify(value));
  };
  return { draft, setDraft, dirty, reset, markSaved };
}

let unsaved = false;
/** True while a screen has unsaved changes; the menu asks before leaving. */
export const hasUnsavedChanges = () => unsaved;

export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    unsaved = dirty;
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      unsaved = false;
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty]);
}

/** Runs a save; returns field errors from the server so forms can show them next to the field. */
export function useSave() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  async function run<T>(fn: () => Promise<T>, success = 'Opgeslagen'): Promise<T | undefined> {
    setSaving(true);
    setErrors({});
    setError(undefined);
    try {
      const result = await fn();
      toast(success);
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.message);
      } else setError('Opslaan is niet gelukt. Probeer het opnieuw.');
      return undefined;
    } finally {
      setSaving(false);
    }
  }
  return { run, saving, errors, error, setErrors };
}

// --- Toasts ---------------------------------------------------------------------------

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(undefined), 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {message && (
          <div className="pointer-events-auto flex items-center gap-2 bg-ink px-4 py-3 text-sm text-paper shadow-lg">
            <Check className="h-4 w-4 text-accent" aria-hidden />
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

// --- Layout ---------------------------------------------------------------------------

export function PageHeader({ title, description, back, actions }: { title: string; description?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="mb-8">
      {back && (
        <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-dark hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
          {description && <p className="mt-2 leading-relaxed text-stone-dark">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, description, children, className = '' }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-paper-3 bg-white p-5 md:p-7 ${className}`}>
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {description && <p className="mt-1 text-sm leading-relaxed text-stone-dark">{description}</p>}
      <div className={title || description ? 'mt-5 space-y-5' : 'space-y-5'}>{children}</div>
    </section>
  );
}

export function Loading() {
  return (
    <div className="space-y-4" aria-label="Laden">
      <div className="h-10 w-1/3 animate-pulse bg-paper-3" />
      <div className="h-48 animate-pulse bg-paper-3" />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-danger/30 bg-[#fbe9e3] p-4 text-sm text-danger" role="alert">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-3 font-semibold underline underline-offset-2">
          Opnieuw proberen
        </button>
      )}
    </div>
  );
}

export function SaveBar({ dirty, saving, onSave, onReset, error, extra }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; error?: string; extra?: ReactNode }) {
  return (
    <div className={`sticky bottom-0 z-20 -mx-4 mt-8 border-t px-4 py-3 transition-colors md:-mx-8 md:px-8 ${dirty || error ? 'border-accent/50 bg-[#fdf6e3]' : 'border-paper-3 bg-paper'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${error ? 'text-danger' : 'text-stone-dark'}`} role={error ? 'alert' : undefined}>
          {error ?? (dirty ? 'Je hebt wijzigingen die nog niet zijn opgeslagen.' : 'Alles is opgeslagen.')}
        </p>
        <div className="flex flex-wrap gap-2">
          {extra}
          {dirty && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={onReset} disabled={saving}>
              Ongedaan maken
            </Button>
          )}
          <Button type="button" variant="dark" className="h-10 text-sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Opslaan…' : 'Opslaan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: 'ok' | 'warn' | 'muted' | 'accent'; children: ReactNode }) {
  const tones = {
    ok: 'bg-[#e6f0ea] text-[#24533d]',
    warn: 'bg-[#fbe9e3] text-danger',
    muted: 'bg-paper-2 text-stone-dark',
    accent: 'bg-accent-fill text-ink',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

// --- Fields ---------------------------------------------------------------------------

export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-stone-dark">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-paper-3 transition-colors peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const toEuro = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

function parseEuro(text: string): number | null {
  const clean = text.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Euro amount typed as "29,95"; stores cents. */
export function MoneyInput({ label, cents, onChange, hint, error, optional }: { label: string; cents: number | null | undefined; onChange: (v: number | null) => void; hint?: string; error?: string; optional?: boolean }) {
  const [text, setText] = useState(toEuro(cents));
  useEffect(() => {
    if (parseEuro(text) !== (cents ?? null)) setText(toEuro(cents));
    // Only resync when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  const parsed = parseEuro(text);
  return (
    <Input
      label={label}
      inputMode="decimal"
      value={text}
      placeholder="0,00"
      hint={hint ?? 'Bedrag in euro, inclusief btw.'}
      optional={optional}
      error={error ?? (Number.isNaN(parsed) ? 'Vul een bedrag in, bijv. 29,95' : undefined)}
      onChange={(e) => {
        setText(e.target.value);
        const value = parseEuro(e.target.value);
        if (!Number.isNaN(value)) onChange(value);
      }}
      onBlur={() => !Number.isNaN(parsed) && setText(toEuro(parsed))}
      className="sm:max-w-48"
    />
  );
}

export function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RowControls({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void; label: string }) {
  const btn = 'grid h-9 w-9 place-items-center text-stone-dark hover:bg-paper-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className={btn} onClick={() => onMove(index - 1)} disabled={index === 0} aria-label={`${label} omhoog`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={() => onMove(index + 1)} disabled={index === count - 1} aria-label={`${label} omlaag`}>
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" className={`${btn} hover:text-danger`} onClick={onRemove} aria-label={`${label} verwijderen`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/** A list of short lines (e.g. "Wat is inbegrepen"), each editable, movable and removable. */
export function LineList({ label, hint, items, onChange, addLabel = 'Regel toevoegen', placeholder, long, error, max = 20 }: { label: string; hint?: string; items: string[]; onChange: (items: string[]) => void; addLabel?: string; placeholder?: string; long?: boolean; error?: string; max?: number }) {
  return (
    <fieldset>
      <legend className="text-[15px] font-medium">{label}</legend>
      {hint && <p className="mt-0.5 text-sm text-stone-dark">{hint}</p>}
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            {long ? (
              <textarea
                className="min-h-24 w-full border border-paper-3 bg-white px-3 py-2 text-[15px] outline-none focus:border-ink"
                value={item}
                placeholder={placeholder}
                aria-label={`${label} ${i + 1}`}
                onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
              />
            ) : (
              <input
                className="h-11 w-full border border-paper-3 bg-white px-3 text-[15px] outline-none focus:border-ink"
                value={item}
                placeholder={placeholder}
                aria-label={`${label} ${i + 1}`}
                onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
              />
            )}
            <RowControls index={i} count={items.length} label="Regel" onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ''])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </button>
      )}
    </fieldset>
  );
}

type FieldDef<T> = { key: keyof T & string; label: string; long?: boolean; placeholder?: string };

/** A list of small records (e.g. FAQ: vraag + antwoord), shown as cards. */
export function RecordList<T extends Record<string, string>>({ label, hint, items, onChange, fields, empty, addLabel, error, max = 20 }: { label: string; hint?: string; items: T[]; onChange: (items: T[]) => void; fields: FieldDef<T>[]; empty: T; addLabel: string; error?: string; max?: number }) {
  return (
    <fieldset>
      <legend className="text-[15px] font-medium">{label}</legend>
      {hint && <p className="mt-0.5 text-sm text-stone-dark">{hint}</p>}
      <ul className="mt-3 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="border border-paper-3 bg-paper/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="eyebrow text-stone-dark">#{i + 1}</span>
              <RowControls index={i} count={items.length} label="Onderdeel" onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
            </div>
            <div className="space-y-3">
              {fields.map((f) =>
                f.long ? (
                  <Textarea key={f.key} label={f.label} rows={3} value={item[f.key]} placeholder={f.placeholder} onChange={(e) => onChange(items.map((v, j) => (j === i ? { ...v, [f.key]: e.target.value } : v)))} />
                ) : (
                  <Input key={f.key} label={f.label} value={item[f.key]} placeholder={f.placeholder} onChange={(e) => onChange(items.map((v, j) => (j === i ? { ...v, [f.key]: e.target.value } : v)))} />
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, { ...empty }])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </button>
      )}
    </fieldset>
  );
}

/** Shows the chosen image and opens the media library to pick or upload another. */
export function ImageField({ label, hint, value, onChange, optional, error }: { label: string; hint?: string; value: string | null | undefined; onChange: (v: string | null) => void; optional?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="text-[15px] font-medium">
        {label}
        {optional && <span className="ml-2 text-sm font-normal text-stone-dark">Optioneel</span>}
      </p>
      {hint && <p className="mt-0.5 text-sm text-stone-dark">{hint}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setOpen(true)} className="group relative block h-28 w-40 overflow-hidden border border-paper-3 bg-paper-2" aria-label={`${label} kiezen`}>
          {value ? (
            <img src={imageUrl(value, 'sm')} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-stone-dark">
              <ImagePlus className="h-6 w-6" aria-hidden />
            </span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-ink/50 text-sm font-medium text-paper opacity-0 transition-opacity group-hover:opacity-100">Wijzigen</span>
        </button>
        <div className="flex flex-col items-start gap-2">
          <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={() => setOpen(true)}>
            {value ? 'Andere afbeelding' : 'Afbeelding kiezen'}
          </Button>
          {value && optional && (
            <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-sm text-stone-dark hover:text-danger">
              <X className="h-3.5 w-3.5" aria-hidden />
              Verwijderen
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {open && (
        <MediaPicker
          onClose={() => setOpen(false)}
          onSelect={(ref) => {
            onChange(ref);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Field errors from the server use dotted paths, e.g. "faq.2.q". */
export function errorFor(errors: Record<string, string>, prefix: string) {
  return errors[prefix] ?? Object.entries(errors).find(([k]) => k.startsWith(`${prefix}.`))?.[1];
}

/** Several photos in order, e.g. a project gallery. The first one is shown first. */
export function ImageListField({ label, hint, value, onChange, max = 12, error }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; max?: number; error?: string }) {
  const [open, setOpen] = useState(false);
  const btn = 'grid h-7 w-7 place-items-center bg-ink/75 text-paper hover:bg-ink disabled:opacity-30';
  return (
    <div>
      <p className="text-[15px] font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-sm text-stone-dark">{hint}</p>}
      <ul className="mt-3 flex flex-wrap gap-3">
        {value.map((ref, i) => (
          <li key={`${ref}-${i}`} className="relative h-24 w-32 overflow-hidden border border-paper-3 bg-paper-2">
            <img src={imageUrl(ref, 'sm')} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="eyebrow absolute left-1.5 top-1.5 bg-accent-fill px-1.5 py-0.5 text-[10px] text-ink">Eerste</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 p-1">
              <span className="flex gap-1">
                <button type="button" className={btn} onClick={() => onChange(move(value, i, i - 1))} disabled={i === 0} aria-label={`Foto ${i + 1} naar voren`}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} onClick={() => onChange(move(value, i, i + 1))} disabled={i === value.length - 1} aria-label={`Foto ${i + 1} naar achteren`}>
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                </button>
              </span>
              <button type="button" className={`${btn} hover:bg-danger`} onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length === 1} aria-label={`Foto ${i + 1} verwijderen`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
        {value.length < max && (
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-24 w-32 flex-col items-center justify-center gap-1 border-2 border-dashed border-paper-3 bg-white text-sm text-stone-dark hover:border-ink hover:text-ink"
            >
              <ImagePlus className="h-5 w-5" aria-hidden />
              Foto toevoegen
            </button>
          </li>
        )}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {open && (
        <MediaPicker
          onClose={() => setOpen(false)}
          onSelect={(ref) => {
            onChange([...value, ref]);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
