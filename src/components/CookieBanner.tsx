import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { closeConsentSettings, setChoices, statisticsExempt, useConsent, type Consent } from '../lib/consent';
import { DEMO } from '../lib/demo';
import { getSiteConfig } from '../lib/siteConfig';

/**
 * Asks for cookies: statistics (recognising returning visitors) and, when the site has a Pixel, marketing (Meta).
 * Refusing and accepting are equally prominent; the settings let visitors choose per purpose, and the choice can
 * be changed later from the footer. Dutch visitors are only asked when there is a Pixel: their statistics cookie
 * needs no consent, so it is on unless they switch it off.
 */
export function CookieBanner() {
  const { consent, statistics, settingsOpen } = useConsent();
  const [hasPixel, setHasPixel] = useState<boolean>();
  const [details, setDetails] = useState(false);
  const exempt = statisticsExempt();

  useEffect(() => {
    if (!DEMO) getSiteConfig().then((c) => setHasPixel(Boolean(c.metaPixelId)));
  }, []);

  if (DEMO || hasPixel === undefined) return null;
  const mustAsk = (hasPixel && consent === undefined) || (!exempt && statistics === undefined);
  if (!settingsOpen && !mustAsk) return null;

  const statsOn = statistics === 'granted' || (statistics === undefined && exempt);
  // Accepting is the gold button; refusing is a button of the same size right below it, so it is just as easy.
  const accept = 'h-12 w-full bg-accent-fill px-4 text-base font-semibold text-ink transition-colors hover:bg-accent';
  const decline = 'h-12 w-full border border-paper/50 px-4 text-base font-medium text-paper transition-colors hover:border-paper hover:bg-white/5';
  const acceptAll = () => setChoices({ statistics: 'granted', ...(hasPixel ? { marketing: 'granted' } : {}) });
  // Refusing turns off everything that needs consent. On first ask, a Dutch visitor's statistics stay on (no consent
  // needed; the banner says so). Someone who reopens the settings to refuse gets everything switched off.
  const keepStats = exempt && !settingsOpen;
  const refuse = () => setChoices({ ...(keepStats ? {} : { statistics: 'denied' }), ...(hasPixel ? { marketing: 'denied' } : {}) });
  const close = settingsOpen && !mustAsk ? closeConsentSettings : undefined;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-text"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-40 max-h-[calc(100vh-24px)] overflow-y-auto border border-white/15 bg-ink p-5 text-paper shadow-2xl md:inset-x-auto md:bottom-6 md:left-6 md:w-[27rem] md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <p id="cookie-title" className="font-display text-xl">
          {details ? 'Cookie-instellingen' : 'Cookies'}
        </p>
        {close && (
          <button type="button" onClick={close} className="-mr-2 -mt-1 grid h-9 w-9 place-items-center text-paper/60 hover:text-paper" aria-label="Sluiten">
            ×
          </button>
        )}
      </div>

      {details ? (
        <Settings hasPixel={hasPixel} statsOn={statsOn} marketing={consent} onSave={(c) => setChoices(c)} onAcceptAll={acceptAll} accept={accept} decline={decline} />
      ) : (
        <>
          <p id="cookie-text" className="mt-2 text-sm leading-relaxed text-paper/70">
            {hasPixel
              ? 'Mogen we cookies gebruiken? Dan onthouden we of je eerder langskwam en zien we welke advertenties op Facebook en Instagram echt helpen. Zo maken we de site en onze acties beter, en zie je minder advertenties die niet bij je passen.'
              : 'Mogen we een cookie gebruiken om te onthouden of je eerder langskwam? Dat helpt ons de website beter te maken. De gegevens blijven bij ons en worden met niemand gedeeld.'}{' '}
            Zonder toestemming werkt alles precies hetzelfde.
            {hasPixel && keepStats && ' Anonieme bezoekersstatistieken die alleen wij zien staan aan; die kun je uitzetten bij instellingen.'}
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button type="button" className={accept} onClick={acceptAll}>
              Accepteren
            </button>
            <button type="button" className={decline} onClick={refuse}>
              Weigeren
            </button>
          </div>
          <div className="mt-3 flex justify-between gap-4 text-sm text-paper/60">
            <button type="button" onClick={() => setDetails(true)} className="underline underline-offset-2 hover:text-paper">
              Instellingen
            </button>
            <Link to="/privacy" className="underline underline-offset-2 hover:text-paper">
              Privacybeleid
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Settings({
  hasPixel,
  statsOn,
  marketing,
  onSave,
  onAcceptAll,
  accept,
  decline,
}: {
  hasPixel: boolean;
  statsOn: boolean;
  marketing: Consent | undefined;
  onSave: (choices: { statistics: Consent; marketing?: Consent }) => void;
  onAcceptAll: () => void;
  accept: string;
  decline: string;
}) {
  const [stats, setStats] = useState(statsOn);
  const [ads, setAds] = useState(marketing === 'granted');
  return (
    <>
      <p id="cookie-text" className="mt-2 text-sm leading-relaxed text-paper/70">
        Kies zelf welke cookies je toestaat. Noodzakelijke cookies (zoals je winkelwagen en deze keuze) staan altijd aan.
      </p>
      <div className="mt-4 space-y-4">
        <Switch label="Statistieken" text="Onthoudt of je eerder langskwam, zodat we zien hoe bezoekers de site gebruiken. Blijft bij ons en wordt niet gedeeld." checked={stats} onChange={setStats} />
        {hasPixel && <Switch label="Marketing" text="Meta (Facebook en Instagram) meet welke advertenties werken en kan je passende advertenties tonen." checked={ads} onChange={setAds} />}
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        <button type="button" className={accept} onClick={onAcceptAll}>
          Alles accepteren
        </button>
        <button type="button" className={decline} onClick={() => onSave({ statistics: stats ? 'granted' : 'denied', ...(hasPixel ? { marketing: ads ? 'granted' : 'denied' } : {}) })}>
          Keuze opslaan
        </button>
      </div>
    </>
  );
}

function Switch({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-paper/60">{text}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-paper/25 transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

