import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { SITE } from '../../shared/site';
import { ButtonLink, Eyebrow } from './ui';

export function SectionHeading({
  index,
  eyebrow,
  title,
  intro,
  tone = 'dark',
}: {
  index?: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  tone?: 'dark' | 'light';
}) {
  return (
    <div className="grid gap-6 md:grid-cols-12 md:items-end">
      <div className="md:col-span-7">
        <Eyebrow index={index} tone={tone} className={tone === 'dark' ? 'text-paper/60' : 'text-stone-dark'}>
          {eyebrow}
        </Eyebrow>
        <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02]">{title}</h2>
      </div>
      {intro && (
        <p className={`text-[17px] leading-relaxed md:col-span-5 ${tone === 'dark' ? 'text-paper/65' : 'text-stone-dark'}`}>{intro}</p>
      )}
    </div>
  );
}

/** Accordion of questions on a light background. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="border-t border-ink/15">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-ink/15">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="max-w-2xl pb-6 leading-relaxed text-stone-dark">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Contact line under FAQ headings. */
export function AskUs() {
  return (
    <p className="mt-6 text-stone-dark">
      Staat je vraag er niet bij? Bel of app{' '}
      <a href={`tel:${SITE.phoneHref}`} className="text-ink underline underline-offset-4">
        {SITE.phone}
      </a>{' '}
      of mail{' '}
      <a href={`mailto:${SITE.email}`} className="text-ink underline underline-offset-4">
        {SITE.email}
      </a>
      .
    </p>
  );
}

export function ClosingCta({
  title = 'Klaar om je auto te laten stralen?',
  text = 'Vraag een afspraak aan en je hoort binnen één werkdag van ons.',
  to = '/afspraak',
}: {
  title?: string;
  text?: string;
  to?: string;
}) {
  return (
    <section className="bg-accent-fill text-ink">
      <div className="container-page flex flex-col gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <div>
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.02]">{title}</h2>
          <p className="mt-3 max-w-lg text-ink/80">{text}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 whitespace-nowrap sm:flex-row">
          <ButtonLink to={to} variant="dark" arrow>
            Afspraak aanvragen
          </ButtonLink>
          <a
            href={`tel:${SITE.phoneHref}`}
            className="inline-flex h-12 items-center justify-center border border-ink/50 px-6 text-[15px] font-medium hover:border-ink hover:bg-ink/10"
          >
            Bel {SITE.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
