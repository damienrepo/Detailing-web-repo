// Meta Pixel: loaded only after the visitor accepts marketing cookies, and only when the server has a Pixel ID.
// Every event goes through trackMeta(). The Purchase is also sent server-side (server/meta.ts) with the same
// event ID, so Meta counts it once.
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { DEMO } from './demo';
import { getConsent, onConsentChange } from './consent';
import { getSiteConfig } from './siteConfig';

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[] };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export type MetaParams = Record<string, unknown>;

let pixelId: string | null | undefined; // undefined: not known yet; null: no Pixel configured
let loaded = false;
let lastPath: string | undefined;
/** Events fired before the Pixel ID was known (the config request is still running). */
let waiting: [string, MetaParams, string | undefined][] = [];

// An ad click's fbclid, kept only in memory until the visitor consents (no storage before that).
const landing = { fbclid: typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('fbclid'), at: Date.now() };

/** The official base code (without the <noscript> image, which would fire without consent). */
function loadPixel(id: string) {
  // Meta's snippet, unchanged apart from (function(){})() instead of !function(){}() and the type annotations.
  // prettier-ignore
  (function(f: any,b: any,e: any,v: any,n?: any,t?: any,s?: any){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  const fbq = window.fbq!;
  fbq('consent', 'grant');
  // No automatic events (button clicks etc.): only what we send ourselves.
  fbq('set', 'autoConfig', false, id);
  fbq('init', id);
  fbq('track', 'PageView');
  lastPath = location.pathname;
  loaded = true;
}

/** Writes _fbc from a remembered ad click, if the Pixel has not done so (the fbclid may have left the URL). */
function storeClickId() {
  if (!landing.fbclid || /(?:^|;\s*)_fbc=/.test(document.cookie)) return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `_fbc=fb.1.${landing.at}.${encodeURIComponent(landing.fbclid)}; Max-Age=${90 * 24 * 3600}; Path=/; SameSite=Lax${secure}`;
}

function activate() {
  if (getConsent() !== 'granted' || !pixelId) return;
  storeClickId();
  if (!loaded) loadPixel(pixelId);
  else window.fbq?.('consent', 'grant');
  const queued = waiting;
  waiting = [];
  queued.forEach(([name, params, eventId]) => trackMeta(name, params, eventId));
}

/** Called once at startup. */
export async function initMetaPixel() {
  if (DEMO) return;
  onConsentChange((consent) => {
    if (consent === 'granted') activate();
    else if (loaded) window.fbq?.('consent', 'revoke');
  });
  pixelId = (await getSiteConfig()).metaPixelId ?? null;
  if (!pixelId) waiting = [];
  activate();
}

/**
 * Sends a standard event. Does nothing without consent or without a Pixel; returns whether it was sent
 * (or queued until the Pixel has loaded).
 */
export function trackMeta(name: string, params: MetaParams, eventId?: string): boolean {
  if (getConsent() !== 'granted' || pixelId === null || DEMO) return false;
  if (pixelId === undefined || !loaded || !window.fbq) {
    waiting.push([name, params, eventId]);
    return true;
  }
  if (eventId) window.fbq('track', name, params, { eventID: eventId });
  else window.fbq('track', name, params);
  return true;
}

/** PageView on client-side route changes. The first page's PageView comes from the base code, so never twice. */
export function useMetaPageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!loaded || getConsent() !== 'granted' || pathname === lastPath) return;
    lastPath = pathname;
    window.fbq?.('track', 'PageView');
  }, [pathname]);
}
