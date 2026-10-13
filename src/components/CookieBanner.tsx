import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { setConsent, useConsent } from '../lib/consent';
import { DEMO } from '../lib/demo';
import { getSiteConfig } from '../lib/siteConfig';

/**
 * Asks for marketing cookies (Meta Pixel). Only shown when the site actually has a Pixel; refusing and
 * accepting are equally prominent, and the choice can be changed later from the footer.
 */
export function CookieBanner() {
  const { consent, showBanner } = useConsent();
  const [hasPixel, setHasPixel] = useState(false);

  useEffect(() => {
    if (!DEMO) getSiteConfig().then((c) => setHasPixel(Boolean(c.metaPixelId)));
  }, []);

  if (!hasPixel || !showBanner) return null;

  const button = 'h-11 flex-1 border border-paper/40 bg-paper px-4 text-[15px] font-medium text-ink transition-colors hover:bg-white';

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-text"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-40 border border-white/15 bg-ink p-5 text-paper shadow-2xl md:inset-x-auto md:bottom-6 md:left-6 md:w-[26rem] md:p-6"
    >
      <p id="cookie-title" className="font-display text-xl">
        Cookies
      </p>
      <p id="cookie-text" className="mt-2 text-sm leading-relaxed text-paper/70">
        Mogen we marketingcookies van Meta (Facebook en Instagram) gebruiken? Daarmee meten we welke advertenties werken. Zonder
        toestemming werkt de site precies hetzelfde. Lees meer in ons{' '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-paper">
          privacybeleid
        </Link>
        .
      </p>
      {consent && <p className="mt-2 text-sm text-paper/50">Je huidige keuze: {consent === 'granted' ? 'geaccepteerd' : 'geweigerd'}.</p>}
      <div className="mt-5 flex gap-3">
        <button type="button" className={button} onClick={() => setConsent('denied')}>
          Weigeren
        </button>
        <button type="button" className={button} onClick={() => setConsent('granted')}>
          Accepteren
        </button>
      </div>
    </div>
  );
}
