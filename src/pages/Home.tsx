import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { PostSummary } from '../../shared/blog';
import { getBundle, getProduct, listedProducts } from '../../shared/catalog';
import { ABOUT, HOME, SHOP } from '../../shared/content';
import { deliveryCountries, formatPrice, PICKUP, SHIPPING } from '../../shared/pricing';
import { listedServices } from '../../shared/services';
import { SITE } from '../../shared/site';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { PostCard } from '../components/PostCard';
import { ProductImage } from '../components/ProductArt';
import { Reveal } from '../components/Reveal';
import { AskUs, ClosingCta, FaqList, SectionHeading } from '../components/Section';
import { ServiceCard } from '../components/ServiceCard';
import { Button, ButtonLink, Eyebrow, Price, TextLink } from '../components/ui';
import { api } from '../lib/api';
import { useCart } from '../lib/cart';
import { imageSrcSet, imageUrl } from '../lib/images';
import { usePageMeta, useStructuredData } from '../lib/meta';

/** Shop questions use the shipping rules, so they are not edited in the admin. */
function shopFaq() {
  return [
    {
      q: 'Hoe snel wordt mijn bestelling verzonden?',
      a: `Bestellingen worden binnen ${SITE.dispatchDays} verzonden met ${SITE.carrier}. Je ontvangt een track-and-trace code per e-mail.`,
    },
    {
      q: 'Wat zijn de verzendkosten?',
      a:
        [
          ...deliveryCountries().map(
            (c) =>
              `Naar ${SHIPPING[c].label} ${formatPrice(SHIPPING[c].cost)}${SHIPPING[c].freeFrom !== null ? `, gratis vanaf ${formatPrice(SHIPPING[c].freeFrom!)}` : ''}.`,
          ),
          PICKUP.enabled ? `Afhalen in ${SITE.address.city} is ${PICKUP.cost === 0 ? 'gratis' : formatPrice(PICKUP.cost)}.` : '',
        ]
          .filter(Boolean)
          .join(' ') || 'Neem contact met ons op voor de mogelijkheden.',
    },
    { q: 'Hoe kan ik betalen?', a: 'Je betaalt veilig via Mollie met iDEAL, Bancontact of creditcard.' },
    {
      q: 'Kan ik mijn bestelling retourneren?',
      a: `Ja, je hebt ${SITE.returnDays} dagen bedenktijd na ontvangst. Meld je retour binnen die termijn en stuur het product binnen ${SITE.returnDays} dagen daarna terug.`,
    },
  ];
}

export default function Home() {
  usePageMeta(undefined);
  // Section numbers follow the sections that are actually shown.
  let n = 0;
  const idx = () => String(++n).padStart(2, '0');
  useStructuredData('business', {
    '@context': 'https://schema.org',
    '@type': 'AutomotiveBusiness',
    name: SITE.fullName,
    description: SITE.description,
    telephone: SITE.phone,
    email: SITE.email,
    url: location.origin,
    areaServed: SITE.region,
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
      <AboutTeaser index={idx()} />
      <Services index={idx()} />
      {SHOP.enabled && <ShopTeaser index={idx()} />}
      <Process index={idx()} />
      {HOME.results.length > 0 && <Results index={idx()} />}
      <LatestPosts index={idx()} />
      <Faq index={idx()} />
      <ClosingCta title={HOME.ctaTitle} text={HOME.ctaText} />
    </>
  );
}

function Hero() {
  const [first, ...rest] = HOME.heroTitle.split('\n');
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-paper">
      <img
        src={imageUrl(HOME.heroImage)}
        srcSet={imageSrcSet(HOME.heroImage)}
        sizes="100vw"
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-70"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(14,14,15,0.92)_0%,rgba(14,14,15,0.7)_45%,rgba(14,14,15,0.25)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(14,14,15,1)_0%,rgba(14,14,15,0)_35%)]" />

      <div className="container-page flex flex-1 flex-col justify-center pb-12 pt-32 md:pt-40">
        <Eyebrow className="text-paper/70">Car detailing · {SITE.region}</Eyebrow>
        <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.95]">
          {first}
          {rest.map((line) => (
            <span key={line}>
              <br />
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/75">{HOME.heroText}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/afspraak" variant="accent" arrow>
            Afspraak aanvragen
          </ButtonLink>
          <ButtonLink to="/diensten" variant="outline-light">
            Bekijk alle diensten
          </ButtonLink>
        </div>
      </div>

      <div className="flex justify-center pb-8 md:pb-10">
        <a
          href="#over-ons"
          aria-label="Scroll naar meer informatie"
          className="group flex flex-col items-center gap-3 text-paper/55 transition-colors duration-300 hover:text-paper"
        >
          <span className="eyebrow">Ontdek</span>
          <span aria-hidden className="relative block h-11 w-[26px] rounded-full border border-current transition-colors">
            <span className="scroll-dot absolute left-1/2 top-2 block h-2 w-[3px] rounded-full bg-accent" />
          </span>
        </a>
      </div>
    </section>
  );
}

function Services({ index }: { index: string }) {
  return (
    <section id="diensten" className="scroll-mt-16 bg-ink py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading index={index} eyebrow="Diensten" title={HOME.servicesTitle} intro={HOME.servicesIntro} />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listedServices().map((s, i) => (
            <Reveal key={s.id} delay={(i % 3) * 0.06} className="h-full">
              <ServiceCard service={s} />
            </Reveal>
          ))}
        </div>

        <div className="mt-12">
          <TextLink to="/diensten" className="text-paper">
            Alle diensten op een rij
          </TextLink>
        </div>
      </div>
    </section>
  );
}

function AboutTeaser({ index }: { index: string }) {
  return (
    <section id="over-ons" className="scroll-mt-16 overflow-hidden bg-ink-2 py-24 text-paper md:py-32">
      <div className="container-page grid gap-14 md:grid-cols-12 md:items-center lg:gap-20">
        <Reveal className="md:col-span-6">
          <figure className="relative">
            <div aria-hidden className="absolute -bottom-4 -left-4 h-full w-full border border-accent/40" />
            <div className="relative aspect-[4/3] overflow-hidden bg-ink-3">
              <img
                src={imageUrl(ABOUT.image, 'sm')}
                srcSet={imageSrcSet(ABOUT.image)}
                sizes="(min-width: 768px) 50vw, 100vw"
                alt={`Het team van ${SITE.name}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            {ABOUT.quote && (
              <figcaption className="relative -mt-10 ml-6 max-w-sm bg-accent-fill px-5 py-4 text-ink shadow-xl md:-mt-14 md:ml-10">
                <p className="font-display text-lg leading-snug">“{ABOUT.quote}”</p>
              </figcaption>
            )}
          </figure>
        </Reveal>

        <div className="md:col-span-6">
          <Eyebrow index={index} className="text-paper/60">
            Over ons
          </Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02]">{ABOUT.homeTitle}</h2>
          <p className="mt-6 text-[17px] leading-relaxed text-paper/70">{ABOUT.homeText}</p>

          {/* Hidden on phones: four cards take too much room there; the about page has them all. */}
          {ABOUT.values.length > 0 && (
            <ul className="mt-10 hidden gap-x-8 gap-y-6 sm:grid sm:grid-cols-2">
              {ABOUT.values.slice(0, 4).map((v) => (
                <li key={v.title} className="border-t border-white/15 pt-4">
                  <span aria-hidden className="block h-1 w-6 bg-accent" />
                  <h3 className="mt-3 font-medium">{v.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-paper/60">{v.text}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
            <ButtonLink to="/over-ons" variant="outline-light" arrow>
              Lees ons verhaal
            </ButtonLink>
            <TextLink to="/team" className="text-paper">
              Ontmoet het team
            </TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShopTeaser({ index }: { index: string }) {
  const { add } = useCart();
  const kit = getBundle();
  const singles = listedProducts()
    .filter((p) => p.id !== kit?.id)
    .slice(0, 3);
  if (!kit && singles.length === 0) return null;

  return (
    <section id="shop" className="bg-paper py-24 text-ink md:py-32">
      <div className="container-page">
        <SectionHeading tone="light" index={index} eyebrow="Shop" title={HOME.shopTitle} intro={HOME.shopIntro} />

        {kit && (
          <div className="mt-16 grid gap-px bg-paper-3 md:grid-cols-12">
            <Reveal className="bg-paper md:col-span-7">
              <Link to={`/shop/${kit.slug}`} className="group block">
                <ProductImage productId={kit.id} className="transition-[filter] duration-500 group-hover:brightness-[1.03]" />
              </Link>
            </Reveal>
            <div className="flex flex-col justify-center bg-paper p-8 md:col-span-5 md:p-12">
              {kit.badge && <p className="eyebrow text-accent-strong">{kit.badge}</p>}
              <h3 className="font-display mt-4 text-4xl">{kit.name}</h3>
              <p className="mt-4 text-[17px] leading-relaxed text-stone-dark">{kit.tagline}</p>
              <ul className="mt-8 space-y-3 border-t border-ink/10 pt-6 text-[15px]">
                {kit.includes!.map((inc) => {
                  const p = getProduct(inc.productId);
                  if (!p) return null;
                  return (
                    <li key={p.id} className="flex items-baseline justify-between gap-4">
                      <span className="flex items-center gap-3">
                        <Plus className="h-3.5 w-3.5 text-stone" aria-hidden />
                        {inc.quantity > 1 ? `${inc.quantity} × ` : ''}
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
                <Button variant="dark" onClick={() => add(kit.id)} disabled={!kit.inStock} className="sm:flex-1">
                  {kit.inStock ? 'In winkelwagen' : 'Uitverkocht'}
                </Button>
                <ButtonLink to={`/shop/${kit.slug}`} variant="outline-dark" className="sm:flex-1">
                  Meer informatie
                </ButtonLink>
              </div>
            </div>
          </div>
        )}

        {singles.length > 0 && (
          <div className={`grid border-l border-paper-3 sm:grid-cols-3 ${kit ? '' : 'mt-16 border-t'}`}>
            {singles.map((p) => (
              <Link
                key={p.id}
                to={`/shop/${p.slug}`}
                className="group flex items-center border-b border-r border-paper-3 bg-paper sm:flex-col sm:items-stretch"
              >
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
        )}

        <div className="mt-10 flex flex-col justify-between gap-6 text-sm text-stone-dark sm:flex-row sm:items-center">
          <p>
            {[
              deliveryCountries().length ? `Verzonden binnen ${SITE.dispatchDays}` : '',
              SHIPPING.NL.enabled && SHIPPING.NL.freeFrom !== null && deliveryCountries().includes('NL') ? `Gratis verzending vanaf ${formatPrice(SHIPPING.NL.freeFrom)}` : '',
              PICKUP.enabled ? `${PICKUP.cost === 0 ? 'Gratis afhalen' : 'Afhalen'} in ${SITE.address.city}` : '',
              `${SITE.returnDays} dagen bedenktijd`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <TextLink to="/shop" className="text-ink">
            Naar de shop
          </TextLink>
        </div>
      </div>
    </section>
  );
}

function Process({ index }: { index: string }) {
  return (
    <section id="werkwijze" className="scroll-mt-16 bg-ink-2 py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading index={index} eyebrow="Werkwijze" title={HOME.stepsTitle} />
        <ol className={`mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${HOME.steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {HOME.steps.map((step, i) => (
            <li key={`${step.title}-${i}`} className="border-t border-white/15 pt-6">
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

function Results({ index }: { index: string }) {
  return (
    <section id="resultaten" className="bg-ink py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading index={index} eyebrow="Resultaten" title={HOME.resultsTitle} intro={HOME.resultsIntro} />
        <div className="mt-16 grid gap-10 md:grid-cols-2 md:gap-6">
          {HOME.results.map((r, i) => (
            <Reveal key={`${r.title}-${i}`} delay={(i % 2) * 0.08}>
              <figure>
                <PhotoCarousel images={r.images} alt={`${r.title} na behandeling`} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3]" />
                <figcaption className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-right text-sm text-paper/60">{r.text}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        {SITE.social.instagram && (
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
        )}
      </div>
    </section>
  );
}

function LatestPosts({ index }: { index: string }) {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  useEffect(() => {
    api<PostSummary[]>('/posts?limit=3')
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);
  if (posts.length === 0) return null;
  return (
    <section className="bg-ink-2 py-24 text-paper md:py-32">
      <div className="container-page">
        <SectionHeading index={index} eyebrow="Blog" title="Tips en verhalen uit de werkplaats." />
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
        <div className="mt-12">
          <TextLink to="/blog" className="text-paper">
            Alle berichten
          </TextLink>
        </div>
      </div>
    </section>
  );
}

function Faq({ index }: { index: string }) {
  const groups = [
    { group: 'Diensten', items: HOME.faq },
    { group: 'Shop', items: SHOP.enabled ? shopFaq() : [] },
  ].filter((g) => g.items.length > 0);
  return (
    <section id="faq" className="scroll-mt-16 bg-paper py-24 text-ink md:py-32">
      <div className="container-page grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <Eyebrow index={index} tone="light" className="text-stone-dark">
            Vragen
          </Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02]">{HOME.faqTitle}</h2>
          <AskUs />
        </div>
        <div className="space-y-12 md:col-span-8">
          {groups.map((group) => (
            <div key={group.group}>
              <h3 className="eyebrow mb-2 text-stone-dark">{group.group}</h3>
              <FaqList items={group.items} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
