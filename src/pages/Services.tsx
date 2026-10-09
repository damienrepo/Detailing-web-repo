import { Clock, MapPin, MessagesSquare, Sparkles } from 'lucide-react';
import { CATEGORIES, listedServices, servicesIn } from '../../shared/services';
import { SITE } from '../../shared/site';
import { Reveal } from '../components/Reveal';
import { ClosingCta, SectionHeading } from '../components/Section';
import { ServiceCard, serviceImage, serviceSrcSet } from '../components/ServiceCard';
import { ButtonLink, Eyebrow } from '../components/ui';
import { usePageMeta, useStructuredData } from '../lib/meta';

const usps = () => [
  { icon: Sparkles, title: 'Zorgvuldig', text: 'Gedaan door autoliefhebbers die zien wat anderen missen.' },
  { icon: MapPin, title: 'Wij komen naar je toe', text: `Op locatie in ${SITE.region}, of in onze werkplaats.` },
  { icon: Clock, title: 'Geen tijdverlies', text: 'Wij werken aan je auto, jij gaat door met je dag.' },
  { icon: MessagesSquare, title: 'Eén aanspreekpunt', text: 'Je regelt alles direct met ons, van wasbeurt tot compleet project.' },
];

export default function Services() {
  usePageMeta(
    'Diensten',
    `Luxe handwas, handwas abonnement, interieurreiniging, technische ruimte, polijsten, glascoating, PPF en schadeherstel in ${SITE.region}.`,
  );
  useStructuredData('services', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: listedServices().map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${location.origin}/diensten/${s.id}`,
      name: s.name,
    })),
  });

  return (
    <>
      <section className="bg-ink pt-16 text-paper md:pt-[72px]">
        <div className="container-page pb-16 pt-16 md:pb-20 md:pt-24">
          <Eyebrow className="text-paper/60">Diensten · {SITE.region}</Eyebrow>
          <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">
            Alles voor een auto
            <br />
            die straalt.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">
            Van een luxe handwas tot glascoating, PPF en schadeherstel. We komen naar je toe of je brengt de auto naar onze
            werkplaats. Altijd met een vrijblijvende prijsopgave vooraf.
          </p>
          <ul className="mt-14 grid gap-x-8 gap-y-8 border-t border-white/15 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {usps().map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon className="h-5 w-5 text-accent" strokeWidth={1.6} aria-hidden />
                <h2 className="mt-4 font-medium">{title}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-paper/60">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {CATEGORIES.filter((c) => servicesIn(c.id).length > 0).map((category, ci) => (
        <section key={category.id} id={category.id} className={`scroll-mt-16 py-16 text-paper md:py-24 ${ci % 2 ? 'bg-ink' : 'bg-ink-2'}`}>
          <div className="container-page">
            <SectionHeading index={String(ci + 1).padStart(2, '0')} eyebrow={category.name} title={category.title} intro={category.intro} />
            {servicesIn(category.id).length === 1 ? (
              <Reveal className="mt-12">
                <ServiceCard service={servicesIn(category.id)[0]} wide />
              </Reveal>
            ) : (
              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {servicesIn(category.id).map((s, i) => (
                  <Reveal key={s.id} delay={i * 0.06} className="h-full">
                    <ServiceCard service={s} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      <section className="bg-paper py-20 text-ink md:py-28">
        <div className="container-page grid gap-12 md:grid-cols-12 md:items-center lg:gap-16">
          <Reveal className="md:col-span-7">
            <figure className="aspect-[16/9] overflow-hidden bg-paper-3">
              <img
                src={serviceImage('team', 'sm')}
                srcSet={serviceSrcSet('team')}
                sizes="(min-width: 768px) 55vw, 100vw"
                alt="Damiën van der Veen en Stein Veldman van Detail2Go bij een Porsche Boxster Spyder"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </figure>
          </Reveal>
          <div className="md:col-span-5">
            <Eyebrow index={String(CATEGORIES.length + 1).padStart(2, '0')} tone="light" className="text-stone-dark">
              Wie we zijn
            </Eyebrow>
            <h2 className="font-display mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">Gedreven door passie voor auto’s.</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-stone-dark">
              Detail2Go is opgericht door twee jonge autoliefhebbers, Damiën van der Veen en Stein Veldman. Wat begon als
              een gedeelde passie, is uitgegroeid tot een detailingbedrijf dat draait om precisie, vakmanschap en een
              ervaring die je verwachtingen overtreft.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-stone-dark">
              We behandelen iedere auto alsof het onze eigen is — of het nu gaat om een wekelijkse wasbeurt of een
              complete lakcorrectie met coating.
            </p>
            <ButtonLink to="/contact" variant="outline-dark" arrow className="mt-8">
              Neem contact op
            </ButtonLink>
          </div>
        </div>
      </section>

      <ClosingCta title="Twijfel je welke behandeling past?" text="Vertel ons wat je wilt bereiken. We adviseren je vrijblijvend en sturen een voorstel op maat." />
    </>
  );
}
