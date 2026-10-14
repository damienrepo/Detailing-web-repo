import { Check, ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { CATEGORIES, getService, serviceMetaDescription, servicePriceLabel, type Comparison, type OptionGroup, type Service } from '../../shared/services';
import { PaintLayers, PAINT_LAYERS } from '../components/PaintLayers';
import { CoatingLayers, COATING_COLORS } from '../components/CoatingLayers';
import { SITE } from '../../shared/site';
import { Reveal } from '../components/Reveal';
import { AskUs, ClosingCta, FaqList, SectionHeading } from '../components/Section';
import { ServiceCard, serviceImage, serviceSrcSet } from '../components/ServiceCard';
import { ButtonLink, Eyebrow, TextLink } from '../components/ui';
import { breadcrumbSchema, faqSchema, serviceSchema } from '../../shared/schema';
import { usePageMeta, useStructuredData } from '../lib/meta';
import { useOrigin } from '../lib/ssr';
import NotFound from './NotFound';

/** Desktop column count per number of items (full class names so Tailwind picks them up). */
const COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

export default function ServicePage() {
  const { slug } = useParams();
  const service = slug ? getService(slug) : undefined;
  if (!service) return <NotFound />;
  return <ServiceDetail key={service.id} service={service} />;
}

function ServiceDetail({ service }: { service: Service }) {
  const bookingUrl = `/afspraak?dienst=${service.id}`;
  const category = CATEGORIES.find((c) => c.id === service.category)!;
  const related = service.related.map((id) => getService(id)).filter((s) => s !== undefined);

  usePageMeta(service.name, serviceMetaDescription(service));
  const origin = useOrigin();
  useStructuredData('service', serviceSchema(origin, service));
  useStructuredData('breadcrumbs', breadcrumbSchema(origin, [{ name: 'Diensten', path: '/diensten' }, { name: service.name, path: `/diensten/${service.id}` }]));
  useStructuredData('faq', faqSchema(service.faq));

  // Section numbers follow the sections that are actually shown.
  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  return (
    <>
      <Hero service={service} categoryName={category.name} bookingUrl={bookingUrl} />

      <section className="bg-paper py-20 text-ink md:py-28">
        <div className="container-page grid gap-12 md:grid-cols-12 lg:gap-16">
          <div className="md:col-span-7">
            <Eyebrow index={next()} tone="light" className="text-stone-dark">
              De behandeling
            </Eyebrow>
            <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">Wat houdt het in?</h2>
            <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-stone-dark">
              {service.intro.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
            {service.detailImage && (
              <Reveal className="mt-12">
                <figure className="aspect-[16/10] overflow-hidden bg-paper-3">
                  <img
                    src={serviceImage(service.detailImage.src, 'sm')}
                    srcSet={serviceSrcSet(service.detailImage.src)}
                    sizes="(min-width: 768px) 55vw, 100vw"
                    alt={service.detailImage.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </figure>
              </Reveal>
            )}
          </div>

          <aside className="md:col-span-5">
            <div className="border border-paper-3 bg-white p-6 md:sticky md:top-24 md:p-8">
              <h3 className="eyebrow text-stone-dark">Inbegrepen</h3>
              <ul className="mt-5 space-y-3 text-[15px]">
                {service.includes.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-baseline justify-between gap-4 border-t border-ink/10 pt-6">
                <span className="tabular text-xl font-semibold">{servicePriceLabel(service)}</span>
                {service.fromPrice !== null && <span className="text-sm text-stone-dark">incl. btw</span>}
              </div>
              <ButtonLink to={bookingUrl} variant="accent" arrow className="mt-6 w-full">
                {service.fromPrice === null ? 'Offerte aanvragen' : 'Afspraak aanvragen'}
              </ButtonLink>
              <p className="mt-4 text-center text-sm text-stone-dark">Vrijblijvend · Reactie binnen één werkdag</p>
            </div>
          </aside>
        </div>
      </section>

      {service.explainer && <Explainer explainer={service.explainer} index={next()} />}

      <section className="bg-ink py-20 text-paper md:py-28">
        <div className="container-page">
          <SectionHeading index={next()} eyebrow="Waarom" title="Wat het je oplevert." />
          <ul className={`mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${COLS[service.benefits.length] ?? 'lg:grid-cols-3'}`}>
            {service.benefits.map((b, i) => (
              <li key={b.title} className="border-t border-white/15 pt-6">
                <Reveal delay={i * 0.06}>
                  <span aria-hidden className="block h-1 w-6 bg-accent" />
                  <h3 className="font-display mt-6 text-2xl">{b.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-paper/65">{b.text}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {service.options && (
        <section className="bg-paper py-20 text-ink md:py-28">
          <div className="container-page space-y-24">
            {service.options.map((group) => (
              <Options key={group.title} group={group} index={next()} />
            ))}
          </div>
        </section>
      )}

      {service.comparison && <ComparisonTable comparison={service.comparison} index={next()} />}

      <section className="bg-ink-2 py-20 text-paper md:py-28">
        <div className="container-page">
          <SectionHeading index={next()} eyebrow="Werkwijze" title="Zo pakken we het aan." />
          <ol className={`mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${COLS[service.steps.length] ?? 'lg:grid-cols-4'}`}>
            {service.steps.map((step, i) => (
              <li key={step.title} className="border-t border-white/15 pt-6">
                <Reveal delay={i * 0.06}>
                  <p className="tabular font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="font-display mt-6 text-2xl">{step.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-paper/65">{step.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-paper py-20 text-ink md:py-28">
        <div className="container-page grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Eyebrow index={next()} tone="light" className="text-stone-dark">
              Vragen
            </Eyebrow>
            <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">Goed om te weten.</h2>
            <AskUs />
          </div>
          <div className="md:col-span-8">
            <FaqList items={service.faq} />
          </div>
        </div>
      </section>

      <section className="bg-ink py-20 text-paper md:py-28">
        <div className="container-page">
          <SectionHeading index={next()} eyebrow="Combineer met" title="Past hier goed bij." />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.06} className="h-full">
                <ServiceCard service={s} />
              </Reveal>
            ))}
          </div>
          <div className="mt-12">
            <TextLink to="/diensten" className="text-paper">
              Bekijk alle diensten
            </TextLink>
          </div>
        </div>
      </section>

      <ClosingCta
        title={service.fromPrice === null ? 'Benieuwd wat het kost?' : 'Klaar om je auto te laten stralen?'}
        text={
          service.fromPrice === null
            ? 'Vraag een vrijblijvende offerte aan. Stuur gerust een paar foto’s mee, dan kunnen we snel een inschatting maken.'
            : 'Vraag een afspraak aan en je hoort binnen één werkdag van ons.'
        }
        to={bookingUrl}
      />
    </>
  );
}

function Hero({ service, categoryName, bookingUrl }: { service: Service; categoryName: string; bookingUrl: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper">
      <img
        src={serviceImage(service.image)}
        srcSet={serviceSrcSet(service.image)}
        sizes="100vw"
        alt={service.imageAlt}
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-60"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(14,14,15,0.94)_0%,rgba(14,14,15,0.72)_50%,rgba(14,14,15,0.3)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(14,14,15,1)_0%,rgba(14,14,15,0)_40%)]" />

      <div className="container-page flex min-h-[78svh] flex-col justify-end pb-14 pt-28 md:pb-20 md:pt-36">
        <nav aria-label="Kruimelpad" className="text-sm text-paper/60">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link to="/diensten" className="hover:text-paper">
                Diensten
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li aria-current="page" className="text-paper">
              {service.name}
            </li>
          </ol>
        </nav>
        <Eyebrow className="mt-10 text-paper/70">{categoryName}</Eyebrow>
        <h1 className="font-display mt-5 max-w-4xl text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">{service.name}</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/75">{service.tagline}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to={bookingUrl} variant="accent" arrow>
            {service.fromPrice === null ? 'Offerte aanvragen' : 'Afspraak aanvragen'}
          </ButtonLink>
          <a
            href={SITE.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center border border-paper/30 px-6 text-[15px] font-medium text-paper transition-colors hover:border-paper hover:bg-paper/5"
          >
            Stel een vraag via WhatsApp
          </a>
        </div>
        <dl className="tabular mt-14 grid max-w-2xl gap-6 border-t border-white/15 pt-6 sm:grid-cols-2">
          <div>
            <dt className="eyebrow text-paper/45">Prijs</dt>
            <dd className="mt-1.5 text-lg font-medium first-letter:uppercase">{servicePriceLabel(service)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-paper/45">Waar</dt>
            <dd className="mt-1.5 text-lg font-medium">{service.onLocation ? 'Op locatie of in de werkplaats' : 'In onze werkplaats'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Options({ group, index }: { group: OptionGroup; index: string }) {
  return (
    <div>
      <SectionHeading tone="light" index={index} eyebrow={group.eyebrow ?? 'Opties'} title={group.title} intro={group.intro} />
      {group.style === 'coverage' ? (
        <CoverageCards group={group} />
      ) : group.style === 'layers' ? (
        <LayerCards group={group} />
      ) : group.style === 'cards' ? (
        <div className={`mt-14 grid gap-6 ${group.options.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {group.options.map((o, i) => (
            <Reveal key={o.name} delay={i * 0.06} className="h-full">
              <article className={`relative flex h-full flex-col border bg-white ${o.popular ? 'border-accent-fill shadow-[0_0_0_1px_var(--color-accent-fill)]' : 'border-paper-3'}`}>
                {o.popular && <span className="eyebrow absolute right-4 top-4 z-10 bg-accent-fill px-2.5 py-1 text-ink">Meest gekozen</span>}
                {o.image && (
                  <div className="aspect-[4/3] overflow-hidden bg-paper-3">
                    <img
                      src={serviceImage(o.image, 'sm')}
                      srcSet={serviceSrcSet(o.image)}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6 md:p-8">
                  {o.label && <p className="eyebrow text-accent-strong">{o.label}</p>}
                  <h3 className="font-display mt-3 text-2xl md:text-3xl">{o.name}</h3>
                  <p className="mt-3 leading-relaxed text-stone-dark">{o.text}</p>
                  {o.items && (
                    <ul className="mt-6 space-y-2.5 border-t border-ink/10 pt-6 text-[15px]">
                      {o.items.map((item) => (
                        <li key={item} className="flex gap-3">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      ) : (
        <ul className={`mt-14 grid gap-4 sm:grid-cols-2 ${COLS[group.options.length] ?? 'lg:grid-cols-3'}`}>
          {group.options.map((o) => (
            <li key={o.name} className="border border-paper-3 bg-white p-6 md:p-8">
              {o.label ? <p className="eyebrow text-accent-strong">{o.label}</p> : <span aria-hidden className="block h-1 w-6 bg-accent-fill" />}
              <h3 className="font-display mt-4 text-xl md:text-2xl">{o.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-dark">{o.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** PPF packages: the same car three times, with the protected panels in gold. */
function CoverageCards({ group }: { group: OptionGroup }) {
  return (
    <>
      <div className={`mt-14 grid gap-6 ${COLS[group.options.length] ?? 'lg:grid-cols-3'} sm:grid-cols-2`}>
        {group.options.map((o, i) => (
          <Reveal key={o.name} delay={i * 0.08} className="h-full">
            <article className={`relative flex h-full flex-col border bg-white ${o.popular ? 'border-accent-fill shadow-[0_0_0_1px_var(--color-accent-fill)]' : 'border-paper-3'}`}>
              {o.popular && (
                <span className="eyebrow absolute right-4 top-4 z-10 bg-accent-fill px-2.5 py-1 text-ink">{o.label}</span>
              )}
              {o.coverage && (
                <div className="bg-white px-4 pb-2 pt-10">
                  <img
                    src={`${import.meta.env.BASE_URL}ppf/ppf-${o.coverage}.webp`}
                    alt={`Porsche 911 met ${o.name.toLowerCase()} lakbeschermingsfolie, in turquoise aangegeven`}
                    width={1021}
                    height={531}
                    loading="lazy"
                    className="h-auto w-full"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col border-t border-paper-3 p-6 md:p-8">
                {!o.popular && o.label && <p className="eyebrow text-accent-strong">{o.label}</p>}
                {o.popular && <p className="eyebrow text-accent-strong">Aanbevolen</p>}
                <h3 className="font-display mt-3 text-2xl md:text-3xl">{o.name}</h3>
                <p className="mt-3 leading-relaxed text-stone-dark">{o.text}</p>
                {o.items && (
                  <ul className="mt-6 space-y-2.5 border-t border-ink/10 pt-6 text-[15px]">
                    {o.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-3 text-sm text-stone-dark">
        <span aria-hidden className="inline-block h-4 w-8 bg-[#2a9a9e]" />
        Turquoise = beschermd met lakbeschermingsfolie. Ramen worden niet beplakt.
      </p>
    </>
  );
}

/** Coating choices: a cross-section per option showing how many coating layers go on the paint. */
function LayerCards({ group }: { group: OptionGroup }) {
  return (
    <>
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {group.options.map((o, i) => (
          <Reveal key={o.name} delay={i * 0.08} className="h-full">
            <article className={`relative flex h-full flex-col border bg-white ${o.popular ? 'border-accent-fill shadow-[0_0_0_1px_var(--color-accent-fill)]' : 'border-paper-3'}`}>
              {o.popular && <span className="eyebrow absolute right-4 top-4 z-10 bg-accent-fill px-2.5 py-1 text-ink">Meest gekozen</span>}
              <div className="bg-ink px-6 pb-4 pt-12">{o.layers && <CoatingLayers layers={o.layers} className="w-full" />}</div>
              <div className="flex flex-1 flex-col p-6 md:p-8">
                {o.label && <p className="eyebrow text-accent-strong">{o.label}</p>}
                <h3 className="font-display mt-3 text-2xl md:text-3xl">{o.name}</h3>
                <p className="mt-3 leading-relaxed text-stone-dark">{o.text}</p>
                {o.items && (
                  <ul className="mt-6 space-y-2.5 border-t border-ink/10 pt-6 text-[15px]">
                    {o.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-dark">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="h-3 w-6" style={{ background: COATING_COLORS.base, opacity: 0.8 }} />
          Basislaag
        </span>
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="h-3 w-6 border border-ink/10" style={{ background: COATING_COLORS.top }} />
          Toplaag
        </span>
        De levensduur is een indicatie bij goed onderhoud.
      </p>
    </>
  );
}

function ComparisonTable({ comparison: c, index }: { comparison: Comparison; index: string }) {
  return (
    <section className="bg-ink py-20 text-paper md:py-28">
      <div className="container-page">
        <SectionHeading index={index} eyebrow="Vergelijken" title={c.title} intro={c.intro} />
        <div className="mt-14 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
            <thead>
              <tr>
                <th className="w-[34%] py-4 pr-4 font-normal text-paper/45">
                  <span className="sr-only">Eigenschap</span>
                </th>
                {c.columns.map((col, i) => (
                  <th
                    key={col}
                    scope="col"
                    className={`px-4 py-4 font-display text-xl ${i === c.highlight ? 'bg-accent-fill text-ink' : 'text-paper'}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.label} className="border-t border-white/10">
                  <th scope="row" className="py-4 pr-4 font-normal text-paper/65">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-4 py-4 ${i === c.highlight ? 'bg-white/[0.06] font-medium text-paper' : 'text-paper/80'}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {c.note && <p className="mt-6 text-sm text-paper/50">{c.note}</p>}
      </div>
    </section>
  );
}

/** An illustrated explanation, e.g. how polishing levels the clear coat. */
function Explainer({ explainer: x, index }: { explainer: NonNullable<Service['explainer']>; index: string }) {
  return (
    <section className="bg-ink-2 py-20 text-paper md:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Eyebrow index={index} className="text-paper/60">
            Zo werkt het
          </Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">{x.title}</h2>
          {x.intro && <p className="mt-6 text-[17px] leading-relaxed text-paper/65">{x.intro}</p>}
          <ol className="mt-10 space-y-6">
            {x.points.map((pt, i) => (
              <li key={pt.title} className="flex gap-5">
                <span className="tabular font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-medium">{pt.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-paper/60">{pt.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {x.visual === 'paint-layers' && (
          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {(['before', 'after'] as const).map((state) => (
                <Reveal key={state} delay={state === 'after' ? 0.1 : 0}>
                  <figure className="border border-white/10 bg-ink p-5">
                    <figcaption className="flex items-center justify-between gap-3">
                      <span className="eyebrow text-paper/60">{state === 'before' ? 'Voor het polijsten' : 'Na het polijsten'}</span>
                      <span className={`text-sm ${state === 'after' ? 'text-accent' : 'text-paper/45'}`}>{state === 'before' ? 'Dof, licht breekt' : 'Glad, diepe glans'}</span>
                    </figcaption>
                    <PaintLayers state={state} className="mt-4 w-full" />
                  </figure>
                </Reveal>
              ))}
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {PAINT_LAYERS.map((layer) => (
                <li key={layer.name} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1 h-3 w-3 shrink-0 border border-white/20" style={{ background: layer.color }} />
                  <span>
                    <span className="block text-paper">{layer.name}</span>
                    <span className="block text-paper/45">{layer.note}</span>
                  </span>
                </li>
              ))}
              <li className="col-span-2 flex items-center gap-2.5 text-paper/60 sm:col-span-4">
                <span aria-hidden className="h-0.5 w-6 shrink-0 bg-accent" />
                Licht dat op de lak valt en weerkaatst
              </li>
            </ul>
          </div>
        )}

        {x.visual === 'coating' && (
          <div className="lg:col-span-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {([0, 2] as const).map((layers) => (
                <Reveal key={layers} delay={layers ? 0.1 : 0}>
                  <figure className="border border-white/10 bg-ink p-5">
                    <figcaption className="flex items-center justify-between gap-3">
                      <span className="eyebrow text-paper/60">{layers ? 'Met coating' : 'Zonder coating'}</span>
                      <span className={`text-sm ${layers ? 'text-accent' : 'text-paper/45'}`}>{layers ? 'Water parelt eraf' : 'Water blijft liggen'}</span>
                    </figcaption>
                    <CoatingLayers layers={layers} className="mt-4 w-full" />
                  </figure>
                </Reveal>
              ))}
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                { name: 'Toplaag', note: 'Glans en waterafstoting', color: COATING_COLORS.top },
                { name: 'Basislaag', note: 'Hecht zich aan de lak', color: COATING_COLORS.base },
                ...PAINT_LAYERS.map((layer, i) => (i === 0 ? { ...layer, note: 'Gepolijst en ontvet' } : layer)),
              ].map((layer) => (
                <li key={layer.name} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1 h-3 w-3 shrink-0 border border-white/20" style={{ background: layer.color }} />
                  <span>
                    <span className="block text-paper">{layer.name}</span>
                    <span className="block text-paper/45">{layer.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
