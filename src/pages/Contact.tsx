import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router';
import { SHOP } from '../../shared/content';
import { SITE } from '../../shared/site';
import { ButtonLink, Eyebrow } from '../components/ui';
import { usePageMeta } from '../lib/meta';

export default function Contact() {
  usePageMeta('Contact', `Bel of app ${SITE.phone} of mail ${SITE.email}. Op locatie in ${SITE.region} of in onze werkplaats.`);
  const hasAddress = Boolean(SITE.address.street);
  const mapsQuery = encodeURIComponent(`${SITE.address.street}, ${SITE.address.postalCode} ${SITE.address.city}`);

  return (
    <div className="bg-paper pt-16 text-ink md:pt-[72px]">
      <div className="container-page py-14 md:py-20">
        <Eyebrow className="text-stone-dark">Contact</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98]">Bellen, appen of mailen.</h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-stone-dark">
          We werken op afspraak: bij jou op locatie in {SITE.region} of in onze werkplaats in {SITE.address.city}.
          {SHOP.enabled && ' Voor bestellingen uit de shop kun je ons het snelst per e-mail bereiken.'}
        </p>

        <div className="mt-14 grid gap-px border border-paper-3 bg-paper-3 md:grid-cols-3">
          <div className="bg-white p-6 md:p-8">
            <MapPin className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            <h2 className="eyebrow mt-6 text-stone-dark">Werkplaats</h2>
            {hasAddress ? (
              <>
                <address className="mt-2 text-lg not-italic leading-relaxed">
                  {SITE.address.street}
                  <br />
                  {SITE.address.postalCode} {SITE.address.city}
                </address>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm underline underline-offset-4"
                >
                  Route plannen
                </a>
              </>
            ) : (
              <p className="mt-2 text-lg leading-relaxed">
                {SITE.address.city}
                <br />
                <span className="text-[15px] text-stone-dark">Op afspraak, of wij komen naar je toe in {SITE.region}.</span>
              </p>
            )}
          </div>
          <div className="bg-white p-6 md:p-8">
            <Phone className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            <h2 className="eyebrow mt-6 text-stone-dark">Telefoon & WhatsApp</h2>
            <a href={`tel:${SITE.phoneHref}`} className="mt-2 block text-lg hover:underline">
              {SITE.phone}
            </a>
            <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm underline underline-offset-4">
              Stuur een WhatsApp-bericht
            </a>
            <dl className="tabular mt-4 space-y-1 text-sm text-stone-dark">
              {SITE.hours.map((h) => (
                <div key={h.days} className="flex justify-between gap-4">
                  <dt>{h.days}</dt>
                  <dd className="text-ink">{h.time}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-white p-6 md:p-8">
            <Mail className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            <h2 className="eyebrow mt-6 text-stone-dark">E-mail</h2>
            <a href={`mailto:${SITE.email}`} className="mt-2 block text-lg hover:underline">
              {SITE.email}
            </a>
            <p className="mt-4 text-sm leading-relaxed text-stone-dark">We reageren op werkdagen binnen 24 uur.</p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-ink/15 pt-10 md:flex-row md:items-center md:justify-between">
          <p className="text-[17px]">
            Een behandeling plannen?{' '}
            <Link to="/diensten" className="underline underline-offset-4">
              Bekijk onze diensten
            </Link>{' '}
            of vraag direct een afspraak aan.
          </p>
          <ButtonLink to="/afspraak" variant="accent" arrow>
            Afspraak aanvragen
          </ButtonLink>
        </div>

        <dl className="mt-14 grid gap-4 text-sm text-stone-dark sm:grid-cols-3">
          <div>
            <dt className="eyebrow">Bedrijfsnaam</dt>
            <dd className="mt-1 text-ink">{SITE.legalName}</dd>
          </div>
          <div>
            <dt className="eyebrow">KvK-nummer</dt>
            <dd className="mt-1 text-ink">{SITE.kvk}</dd>
          </div>
          <div>
            <dt className="eyebrow">Btw-nummer</dt>
            <dd className="mt-1 text-ink">{SITE.vatNumber}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
