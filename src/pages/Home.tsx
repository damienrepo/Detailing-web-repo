import { Check, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { BUNDLE_ID, getProduct, PRODUCTS } from '../../shared/catalog';
import { formatPrice, SHIPPING } from '../../shared/pricing';
import { SERVICES } from '../../shared/services';
import { SITE } from '../../shared/site';
import { ProductImage } from '../components/ProductArt';
import { Reveal } from '../components/Reveal';
import { Button, ButtonLink, Eyebrow, Price, TextLink } from '../components/ui';
import { useCart } from '../lib/cart';
import { usePageMeta, useStructuredData } from '../lib/meta';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?q=80&w=2000&auto=format&fit=crop';

const STEPS = [
  { title: 'Aanvraag', text: 'Vraag online een afspraak aan. Je hoort binnen één werkdag van ons met een voorstel voor datum en prijs.' },
  { title: 'Inspectie', text: 'Bij aankomst bekijken we de auto samen onder studiolicht en meten we de laklaagdikte waar nodig.' },
  { title: 'Behandeling', text: 'We werken in een afgesloten studio, met één auto tegelijk en de tijd die de behandeling nodig heeft.' },
  { title: 'Oplevering', text: 'Je krijgt de auto terug met uitleg over het resultaat en advies voor het onderhoud thuis.' },
];

const RESULTS = [
  {
    image: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?q=80&w=1600&auto=format&fit=crop',
    title: 'Porsche 911 GT3',
    text: 'Tweestaps lakcorrectie en keramische coating',
  },
  {
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=1600&auto=format&fit=crop',
    title: 'Audi RS6',
    text: 'Volledige behandeling met lakbescherming',
  },
];

const FAQ = [
  {
    group: 'Studio',
    items: [
      {
        q: 'Hoe vraag ik een afspraak aan?',
        a: 'Via het aanvraagformulier op deze site, telefonisch of per e-mail. We nemen binnen één werkdag contact op om de datum en de prijs te bevestigen. Pas daarna staat de afspraak vast.',
      },
      {
        q: 'Waarom staan er vanaf-prijzen?',
        a: 'De prijs hangt af van het formaat en de staat van de auto. Je krijgt altijd vooraf een prijsopgave; stuur gerust een paar foto’s mee met je aanvraag voor een nauwkeurige inschatting.',
      },
      {
        q: 'Hoe lang ben ik mijn auto kwijt?',
        a: 'Een interieurbehandeling is meestal binnen een dag klaar. Lakcorrectie en coatings duren één tot drie dagen, omdat een coating ook moet uitharden voordat de auto de weg op gaat.',
      },
    ],
  },
  {
    group: 'Shop',
    items: [
      {
        q: 'Hoe snel wordt mijn bestelling verzonden?',
        a: `Bestellingen worden binnen ${SITE.dispatchDays} verzonden met ${SITE.carrier}. Je ontvangt een track-and-trace code per e-mail.`,
      },
      {
        q: 'Wat zijn de verzendkosten?',
        a: `Naar Nederland ${formatPrice(SHIPPING.NL.cost)}, gratis vanaf ${formatPrice(SHIPPING.NL.freeFrom)}. Naar België ${formatPrice(SHIPPING.BE.cost)}, gratis vanaf ${formatPrice(SHIPPING.BE.freeFrom)}.`,
      },
      {
        q: 'Hoe kan ik betalen?',
        a: 'Je betaalt veilig via Mollie met iDEAL, Bancontact of creditcard.',
      },
      {
        q: 'Kan ik mijn bestelling retourneren?',
        a: `Ja, je hebt ${SITE.returnDays} dagen bedenktijd na ontvangst. Meld je retour binnen die termijn en stuur het product binnen ${SITE.returnDays} dagen daarna terug.`,
      },
    ],
  },
];

export default function Home() {
  usePageMeta(undefined);
  useStructuredData('business', {
    '@context': 'https://schema.org',
    '@type': 'AutomotiveBusiness',
    name: SITE.fullName,
    description: SITE.description,
    telephone: SITE.phone,
    email: SITE.email,
    url: location.origin,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.address.street,
      postalCode: SITE.address.postalCode,
      addressLocality: SITE.address.city,
      addressCountry: 'NL',
    },
  });

  return (
    <>
      <Hero />
      <Services />
      <ShopTeaser />
      <Process />
      <Results />
      <Faq />
      <ClosingCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-paper">
      <img src={HERO_IMAGE} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-70" fetchPriority="high" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(14,14,15,0.92)_0%,rgba(14,14,15,0.7)_45%,rgba(14,14,15,0.25)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(14,14,15,1)_0%,rgba(14,14,15,0)_35%)]" />

      <div className="container-page flex flex-1 flex-col justify-center pb-12 pt-32 md:pt-40">
        <Eyebrow className="text-paper/70">
          Detailing studio · {SITE.address.city}
        </Eyebrow>
        <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.95]">
          Tot in het
          <br />
          kleinste detail.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/75">
          Lakcorrectie, keramische coatings en interieurreiniging in onze studio. Op afspraak, met een heldere prijsopgave
          vooraf.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/afspraak" variant="accent" arrow>
            Afspraak aanvragen
          </ButtonLink>
          <ButtonLink to="/shop" variant="outline-light">
            Shop interieurproducten
          </ButtonLink>
        </div>
      </div>

      <div className="container-page">
        <ul className="grid border-t border-white/15 sm:grid-cols-3">
          {SERVICES.map((s, i) => (
            <li key={s.id} className={`border-white/15 ${i > 0 ? 'border-t sm:border-l sm:border-t-0' : ''}`}>
              <Link to={`/afspraak?dienst=${s.id}`} className={`group flex items-baseline justify-between gap-4 py-5 ${i > 0 ? 'sm:pl-6' : ''} ${i < SERVICES.length - 1 ? 'sm:pr-6' : ''}`}>
                <span>
                  <span className="eyebrow mr-3 text-paper/45">0{i + 1}</span>
                  {s.name}
                </span>
                <span className="tabular text-sm text-paper/60 transition-colors group-hover:text-paper">
                  vanaf {formatPrice(s.fromPrice).replace(',00', ',-')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionHeading({ index, eyebrow, title, intro, tone = 'dark' }: { index: string; eyebrow: string; title: string; intro?: string; tone?: 'dark' | 'light' }) {
  return (
    <div className="grid gap-6 md:grid-cols-12 md:items-end">
      <div className="md:col-span-7">
        <Eyebrow index={index} className={tone === 'dark' ? 'text-paper/60' : 'text-stone-dark'}>
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

function Services() {
  return (
    <section id="diensten" className="scroll-mt-16 bg-ink py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading
          index="01"
          eyebrow="Diensten"
          title="Drie behandelingen, één standaard."
          intro="Iedere behandeling begint met een grondige inspectie. We vertellen vooraf wat haalbaar is, wat het kost en hoe lang het duurt."
        />

        <div className="mt-16 divide-y divide-white/10 border-y border-white/10">
          {SERVICES.map((s, i) => (
            <Reveal key={s.id}>
              <article className="grid gap-8 py-10 md:grid-cols-12 md:gap-10 md:py-12">
                <div className="aspect-[4/3] overflow-hidden bg-ink-3 md:col-span-5">
                  <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col md:col-span-7">
                  <div className="flex items-baseline justify-between gap-6">
                    <h3 className="font-display text-3xl md:text-4xl">
                      <span className="eyebrow mr-4 align-middle text-accent">0{i + 1}</span>
                      {s.name}
                    </h3>
                  </div>
                  <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-paper/70">{s.summary}</p>
                  <ul className="mt-8 grid gap-x-8 gap-y-3 text-[15px] text-paper/85 sm:grid-cols-2">
                    {s.includes.map((item) => (
                      <li key={item} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-6 pt-10">
                    <dl className="tabular flex gap-10 text-sm">
                      <div>
                        <dt className="eyebrow text-paper/45">Vanaf</dt>
                        <dd className="mt-1 text-xl font-medium">{formatPrice(s.fromPrice)}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-paper/45">Duur</dt>
                        <dd className="mt-1 text-xl font-medium">{s.duration}</dd>
                      </div>
                    </dl>
                    <ButtonLink to={`/afspraak?dienst=${s.id}`} variant="outline-light" arrow>
                      Aanvragen
                    </ButtonLink>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShopTeaser() {
  const { add } = useCart();
  const kit = getProduct(BUNDLE_ID)!;
  const singles = PRODUCTS.filter((p) => p.id !== BUNDLE_ID);

  return (
    <section id="shop" className="bg-paper py-24 text-ink md:py-32">
      <div className="container-page">
        <SectionHeading
          tone="light"
          index="02"
          eyebrow="Shop"
          title="Het interieur van de studio, nu voor thuis."
          intro="Dezelfde producten die wij dagelijks gebruiken. Voor het onderhoud tussen twee behandelingen in, of als je zelf aan de slag wilt."
        />

        <div className="mt-16 grid gap-px bg-paper-3 md:grid-cols-12">
          <Reveal className="bg-paper md:col-span-7">
            <Link to={`/shop/${kit.slug}`} className="group block">
              <ProductImage productId={kit.id} className="transition-[filter] duration-500 group-hover:brightness-[1.03]" />
            </Link>
          </Reveal>
          <div className="flex flex-col justify-center bg-paper p-8 md:col-span-5 md:p-12">
            <p className="eyebrow text-accent-strong">{kit.badge}</p>
            <h3 className="font-display mt-4 text-4xl">{kit.name}</h3>
            <p className="mt-4 text-[17px] leading-relaxed text-stone-dark">{kit.tagline}</p>
            <ul className="mt-8 space-y-3 border-t border-ink/10 pt-6 text-[15px]">
              {kit.includes!.map((inc) => {
                const p = getProduct(inc.productId)!;
                return (
                  <li key={p.id} className="flex items-baseline justify-between gap-4">
                    <span className="flex items-center gap-3">
                      <Plus className="h-3.5 w-3.5 text-stone" aria-hidden />
                      {p.name}
                    </span>
                    <span className="tabular text-sm text-stone-dark">{formatPrice(p.price)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex items-center justify-between gap-4 border-t border-ink/10 pt-6">
              <Price cents={kit.price} compareAt={kit.compareAtPrice} className="text-2xl font-semibold" />
              <span className="text-sm text-stone-dark">incl. btw</span>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="dark" onClick={() => add(kit.id)} className="sm:flex-1">
                In winkelwagen
              </Button>
              <ButtonLink to={`/shop/${kit.slug}`} variant="outline-dark" className="sm:flex-1">
                Meer informatie
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="mt-px grid gap-px bg-paper-3 sm:grid-cols-3">
          {singles.map((p) => (
            <Link key={p.id} to={`/shop/${p.slug}`} className="group flex items-center bg-paper sm:flex-col sm:items-stretch">
              <ProductImage productId={p.id} className="w-28 shrink-0 sm:w-auto" />
              <div className="flex flex-1 items-baseline justify-between gap-4 p-5">
                <div>
                  <h3 className="font-medium group-hover:underline">{p.name}</h3>
                  <p className="text-sm text-stone-dark">{p.size}</p>
                </div>
                <Price cents={p.price} className="font-medium" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col justify-between gap-6 text-sm text-stone-dark sm:flex-row sm:items-center">
          <p>
            Verzonden binnen {SITE.dispatchDays} · Gratis verzending vanaf {formatPrice(SHIPPING.NL.freeFrom)} · {SITE.returnDays}{' '}
            dagen bedenktijd
          </p>
          <TextLink to="/shop" className="text-ink">
            Naar de shop
          </TextLink>
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="werkwijze" className="scroll-mt-16 bg-ink-2 py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading index="03" eyebrow="Werkwijze" title="Van aanvraag tot oplevering." />
        <ol className="mt-16 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="bg-ink-2 py-8 sm:p-8 sm:pl-0 lg:px-8 lg:first:pl-0">
              <Reveal delay={i * 0.06}>
                <p className="tabular font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-display mt-8 text-2xl">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-paper/65">{step.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Results() {
  return (
    <section id="resultaten" className="bg-ink py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading
          index="04"
          eyebrow="Resultaten"
          title="Recent opgeleverd."
          intro="Een greep uit het werk van de afgelopen maanden. Meer projecten zie je op Instagram."
        />
        <div className="mt-16 grid gap-10 md:grid-cols-2 md:gap-6">
          {RESULTS.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.08}>
              <figure>
                <div className="aspect-[4/3] overflow-hidden bg-ink-3">
                  <img src={r.image} alt={`${r.title} na behandeling`} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <figcaption className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-right text-sm text-paper/60">{r.text}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <div className="mt-12">
          <a
            href={SITE.social.instagram}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 border-b border-current pb-0.5 text-[15px] font-medium hover:opacity-70"
          >
            Volg ons op Instagram
          </a>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 bg-paper py-24 text-ink md:py-32">
      <div className="container-page grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <Eyebrow index="05" className="text-stone-dark">
            Vragen
          </Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02]">Goed om te weten.</h2>
          <p className="mt-6 text-stone-dark">
            Staat je vraag er niet bij? Bel{' '}
            <a href={`tel:${SITE.phoneHref}`} className="text-ink underline underline-offset-4">
              {SITE.phone}
            </a>{' '}
            of mail{' '}
            <a href={`mailto:${SITE.email}`} className="text-ink underline underline-offset-4">
              {SITE.email}
            </a>
            .
          </p>
        </div>
        <div className="space-y-12 md:col-span-8">
          {FAQ.map((group) => (
            <div key={group.group}>
              <h3 className="eyebrow mb-2 text-stone-dark">{group.group}</h3>
              <div className="border-t border-ink/15">
                {group.items.map((item) => (
                  <details key={item.q} className="group border-b border-ink/15">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-45" aria-hidden />
                    </summary>
                    <p className="max-w-2xl pb-6 leading-relaxed text-stone-dark">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="bg-accent-fill text-white">
      <div className="container-page flex flex-col gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <div>
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.02]">Klaar voor de studio?</h2>
          <p className="mt-3 max-w-lg text-white/85">Vraag een afspraak aan en je hoort binnen één werkdag van ons.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/afspraak" variant="dark" arrow>
            Afspraak aanvragen
          </ButtonLink>
          <a href={`tel:${SITE.phoneHref}`} className="inline-flex h-12 items-center justify-center border border-white/50 px-6 text-[15px] font-medium hover:border-white hover:bg-white/10">
            Bel {SITE.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
