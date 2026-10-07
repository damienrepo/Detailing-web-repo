import { ArrowRight, Minus, Plus } from 'lucide-react';
import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { formatPrice } from '../../shared/pricing';

type Variant = 'accent' | 'light' | 'dark' | 'outline-light' | 'outline-dark';

const variants: Record<Variant, string> = {
  accent: 'bg-accent text-white hover:bg-accent-strong',
  light: 'bg-paper text-ink hover:bg-white',
  dark: 'bg-ink text-paper hover:bg-ink-3',
  'outline-light': 'border border-paper/30 text-paper hover:border-paper hover:bg-paper/5',
  'outline-dark': 'border border-ink/25 text-ink hover:border-ink hover:bg-ink/5',
};

export function buttonClass(variant: Variant = 'accent', extra = '') {
  return `group inline-flex h-12 items-center justify-center gap-2.5 px-6 text-[15px] font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${extra}`;
}

function Arrow() {
  return <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />;
}

export function Button({
  variant,
  arrow,
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; arrow?: boolean }) {
  return (
    <button className={buttonClass(variant, className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export function ButtonLink({
  variant,
  arrow,
  className = '',
  children,
  ...props
}: LinkProps & { variant?: Variant; arrow?: boolean }) {
  return (
    <Link className={buttonClass(variant, className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

export function TextLink({ className = '', children, ...props }: LinkProps) {
  return (
    <Link
      className={`group inline-flex items-center gap-2 border-b border-current pb-0.5 text-[15px] font-medium transition-opacity hover:opacity-70 ${className}`}
      {...props}
    >
      {children}
      <Arrow />
    </Link>
  );
}

export function Eyebrow({ index, children, className = '' }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <p className={`eyebrow flex items-center gap-3 ${className}`}>
      {index && <span className="text-accent">{index}</span>}
      {index && <span aria-hidden className="h-px w-6 bg-current opacity-40" />}
      <span>{children}</span>
    </p>
  );
}

export function Price({ cents, compareAt, className = '' }: { cents: number; compareAt?: number; className?: string }) {
  return (
    <span className={`tabular inline-flex items-baseline gap-2 ${className}`}>
      <span>{formatPrice(cents)}</span>
      {compareAt && compareAt > cents && (
        <span className="text-[0.8em] font-normal text-stone line-through">
          <span className="sr-only">Losse prijs </span>
          {formatPrice(compareAt)}
        </span>
      )}
    </span>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max = 20,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
}) {
  const h = size === 'sm' ? 'h-8 w-8' : 'h-12 w-11';
  return (
    <div className="inline-flex items-center border border-current/20" role="group" aria-label={label}>
      <button type="button" className={`${h} grid place-items-center hover:bg-current/5`} onClick={() => onChange(value - 1)} aria-label="Eén minder">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className={`tabular min-w-8 text-center text-sm font-medium`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${h} grid place-items-center hover:bg-current/5 disabled:opacity-30`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Eén meer"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const fieldBase =
  'block w-full border bg-white px-3.5 py-3 text-[15px] text-ink placeholder:text-stone transition-colors focus:border-ink focus:outline-none';

type FieldProps = { label: string; error?: string; hint?: string; optional?: boolean };

function FieldShell({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex justify-between text-sm font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="font-normal text-stone">Optioneel</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-accent-strong">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-stone-dark">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'> & FieldProps>(function Input(
  { label, error, hint, optional, className = '', ...props },
  ref,
) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldBase} ${error ? 'border-accent-strong' : 'border-paper-3'} ${className}`}
        {...props}
      />
    </FieldShell>
  );
});

export function Select({ label, error, hint, optional, className = '', children, ...props }: ComponentProps<'select'> & FieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${fieldBase} appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='12'%20height='8'%20viewBox='0%200%2012%208'%3E%3Cpath%20d='M1%201l5%205%205-5'%20stroke='%230e0e0f'%20stroke-width='1.5'%20fill='none'/%3E%3C/svg%3E")] bg-[position:right_14px_center] bg-no-repeat pr-10 ${error ? 'border-accent-strong' : 'border-paper-3'} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function Textarea({ label, error, hint, optional, className = '', ...props }: ComponentProps<'textarea'> & FieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${fieldBase} min-h-28 ${error ? 'border-accent-strong' : 'border-paper-3'} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'border-ink/15 bg-paper-2 text-ink',
    error: 'border-accent-strong/40 bg-[#fbe9e3] text-accent-strong',
    success: 'border-[#2f6b4f]/30 bg-[#e6f0ea] text-[#24533d]',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}
