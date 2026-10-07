import { Instagram, Facebook } from 'lucide-react';
import { Link } from 'react-router';
import { SITE } from '../../shared/site';
import { Logo } from './Logo';

const COLUMNS = [
  {
    title: 'Studio',
    links: [
      { to: '/#diensten', label: 'Diensten' },
      { to: '/#werkwijze', label: 'Werkwijze' },
      { to: '/afspraak', label: 'Afspraak aanvragen' },
      { to: '/contact', label: 'Contact & route' },
    ],
  },
  {
    title: 'Shop',
    links: [
      { to: '/shop', label: 'Alle producten' },
      { to: '/verzending', label: 'Verzending & betalen' },
      { to: '/retourneren', label: 'Retourneren' },
      { to: '/#faq', label: 'Veelgestelde vragen' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-paper">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          <Logo />
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-paper/60">{SITE.description}</p>
          <div className="mt-6 flex gap-2">
            <a href={SITE.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid h-10 w-10 place-items-center border border-white/15 text-paper/70 transition-colors hover:border-paper hover:text-paper">
              <Instagram className="h-4 w-4" />
            </a>
            <a href={SITE.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="grid h-10 w-10 place-items-center border border-white/15 text-paper/70 transition-colors hover:border-paper hover:text-paper">
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="md:col-span-2">
            <h2 className="eyebrow mb-5 text-paper/45">{col.title}</h2>
            <ul className="space-y-3 text-[15px]">
              {col.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-paper/75 transition-colors hover:text-paper">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="md:col-span-4">
          <h2 className="eyebrow mb-5 text-paper/45">Contact</h2>
          <address className="space-y-1 text-[15px] not-italic leading-relaxed text-paper/75">
            <p>{SITE.address.street}</p>
            <p>
              {SITE.address.postalCode} {SITE.address.city}
            </p>
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
