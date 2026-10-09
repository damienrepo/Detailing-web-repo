import { Menu, ShoppingBag, X } from 'lucide-react';
import { SHOP } from '../../shared/content';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCart } from '../lib/cart';
import { Logo } from './Logo';
import { ButtonLink } from './ui';

const NAV = [
  { to: '/diensten', label: 'Diensten' },
  { to: '/over-ons', label: 'Over ons' },
  { to: '/shop', label: 'Shop' },
  { to: '/team', label: 'Team' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Contact' },
];

/** Pages that start with a dark hero; elsewhere the header is solid. */
const transparentOn = (pathname: string) => ['/', '/diensten', '/blog', '/team', '/over-ons'].includes(pathname) || pathname.startsWith('/diensten/');

export function Header() {
  const nav = NAV.filter((item) => SHOP.enabled || item.to !== '/shop');
  const { count, open } = useCart();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const solid = scrolled || menuOpen || !transparentOn(pathname);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top,0px)] text-paper transition-colors duration-300 ${
        solid ? 'border-b border-white/10 bg-ink/95 backdrop-blur-sm' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
      >
        Naar inhoud
      </a>
      <div className="container-page flex h-16 items-center justify-between md:h-[72px]">
        <Logo />

        <nav aria-label="Hoofdmenu" className="hidden items-center gap-6 text-[15px] text-paper/75 md:flex lg:gap-9">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `transition-colors hover:text-paper ${isActive && !item.to.includes('#') ? 'text-paper' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          {SHOP.enabled && (
            <button
              type="button"
              onClick={open}
              className="relative grid h-11 w-11 place-items-center transition-colors hover:bg-white/5"
              aria-label={`Winkelwagen, ${count} ${count === 1 ? 'artikel' : 'artikelen'}`}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
              {count > 0 && (
                <span className="tabular absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center bg-accent-fill px-1 text-[11px] font-semibold text-ink">
                  {count}
                </span>
              )}
            </button>
          )}
          <ButtonLink to="/afspraak" variant="light" className="h-10 px-5 text-sm max-md:hidden">
            Afspraak aanvragen
          </ButtonLink>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Menu sluiten' : 'Menu openen'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav
        id="mobile-menu"
        aria-label="Mobiel menu"
        inert={!menuOpen}
        className={`grid bg-ink transition-[grid-template-rows] duration-300 ease-out-quart md:hidden ${menuOpen ? 'grid-rows-[1fr] border-t border-white/10' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="container-page flex flex-col py-4">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="border-b border-white/10 py-4 text-lg"
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink to="/afspraak" variant="accent" arrow className="mt-6 w-full">
              Afspraak aanvragen
            </ButtonLink>
          </div>
        </div>
      </nav>
    </header>
  );
}
