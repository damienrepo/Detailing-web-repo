import { Instagram, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { listedServices } from '../../shared/services';
import { SHOP } from '../../shared/content';
import { SITE } from '../../shared/site';
import { Logo } from './Logo';

/** Hidden while the webshop is switched off. */
const SHOP_LINKS = ['/shop', '/verzending', '/retourneren'];

const INFO_LINKS = [
  { to: '/afspraak', label: 'Afspraak aanvragen' },
  { to: '/over-ons', label: 'Over ons' },
  { to: '/#werkwijze', label: 'Werkwijze' },
  { to: '/team', label: 'Ons team' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Contact' },
  { to: '/shop', label: 'Shop' },
  { to: '/verzending', label: 'Verzending & betalen' },
  { to: '/retourneren', label: 'Retourneren' },
  { to: '/#faq', label: 'Veelgestelde vragen' },
];

function TikTok({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.4-2.47V9.68a5.73 5.73 0 0 0-.8-.06 5.7 5.7 0 0 0-5.7 5.7 5.7 5.7 0 0 0 5.7 5.68 5.7 5.7 0 0 0 5.69-5.68V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />
    </svg>
  );
}

const socialClass =
  'grid h-10 w-10 place-items-center border border-white/15 text-paper/70 transition-colors hover:border-paper hover:text-paper';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-paper">
      <div className="container-page grid gap-12 py-16 sm:grid-cols-2 md:py-20 lg:grid-cols-12">
        <div className="sm:col-span-2 lg:col-span-3">
          <Logo />
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-paper/60">{SITE.description}</p>
          <div className="mt-6 flex gap-2">
            {SITE.social.instagram && (
              <a href={SITE.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className={socialClass}>
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {SITE.social.tiktok && (
              <a href={SITE.social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className={socialClass}>
                <TikTok className="h-4 w-4" />
              </a>
            )}
            <a href={SITE.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={socialClass}>
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-4">
          <h2 className="eyebrow mb-5 text-paper/45">
            <Link to="/diensten" className="hover:text-paper">
              Diensten
            </Link>
          </h2>
          <ul className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
            {listedServices().map((s) => (
              <li key={s.id}>
                <Link to={`/diensten/${s.id}`} className="text-paper/75 transition-colors hover:text-paper">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h2 className="eyebrow mb-5 text-paper/45">Informatie</h2>
          <ul className="space-y-3 text-[15px]">
            {INFO_LINKS.filter((link) => SHOP.enabled || !SHOP_LINKS.includes(link.to)).map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-paper/75 transition-colors hover:text-paper">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className="eyebrow mb-5 text-paper/45">Contact</h2>
          <address className="space-y-1 text-[15px] not-italic leading-relaxed text-paper/75">
            {SITE.address.street && <p>{SITE.address.street}</p>}
            <p>{SITE.address.street ? `${SITE.address.postalCode} ${SITE.address.city}` : SITE.region}</p>
            <p className="pt-3">
              <a href={`tel:${SITE.phoneHref}`} className="hover:text-paper">
                {SITE.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${SITE.email}`} className="hover:text-paper">
                {SITE.email}
              </a>
            </p>
          </address>
          <dl className="tabular mt-6 space-y-1.5 text-sm text-paper/60">
            {SITE.hours.map((h) => (
              <div key={h.days} className="flex max-w-xs justify-between gap-4">
                <dt>{h.days}</dt>
                <dd className="text-paper/85">{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-[13px] text-paper/45 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName} · KvK {SITE.kvk} · btw {SITE.vatNumber}
          </p>
          <nav aria-label="Juridisch" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/voorwaarden" className="hover:text-paper">
              Algemene voorwaarden
            </Link>
            <Link to="/privacy" className="hover:text-paper">
              Privacy
            </Link>
            <Link to="/retourneren" className="hover:text-paper">
              Herroepingsrecht
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
