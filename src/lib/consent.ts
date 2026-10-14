// Cookie consent, per purpose, each in its own first-party cookie (preference cookies, allowed without consent):
// - marketing (`d2g_consent`): the Meta Pixel. The server also reads it when an order is placed (server/meta.ts).
// - statistics (`d2g_stats`): the statistics cookie that recognises returning visitors (server/analytics.ts).
//   In the Netherlands it needs no consent (see statisticsCookieAllowed), so there "no choice" means allowed
//   and visitors can switch it off; elsewhere it is only set after the visitor accepts.
import { useSyncExternalStore } from 'react';
import { countryFromTimezone } from '../../shared/analytics';

export type Consent = 'granted' | 'denied';

const COOKIE = 'd2g_consent';
const STATS_COOKIE = 'd2g_stats';
const GRANTED_AGE = 365 * 24 * 3600;
/** A refusal is remembered for half a year; after that we may ask once more. */
const DENIED_AGE = 182 * 24 * 3600;

const listeners = new Set<() => void>();
let current: Consent | undefined = read(COOKIE);
let stats: Consent | undefined = read(STATS_COOKIE);
let settingsOpen = false;

function read(name: string): Consent | undefined {
  if (typeof document === 'undefined') return undefined; // server render
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=(granted|denied)`));
  return match?.[1] as Consent | undefined;
}

function write(name: string, choice: Consent) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${choice}; Max-Age=${choice === 'granted' ? GRANTED_AGE : DENIED_AGE}; Path=/; SameSite=Lax${secure}`;
}

const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The marketing (Meta) choice. */
export const getConsent = () => current;
/** The statistics choice; undefined when the visitor hasn't chosen. */
export const getStatsConsent = () => stats;

/** Dutch visitors may get the statistics cookie without being asked (they can still switch it off). */
export const statisticsExempt = () => countryFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) === 'NL';

/** The visitor's choices, and whether the settings were reopened from the footer. */
export function useConsent() {
  // The server render has no choices yet (third argument).
  const consent = useSyncExternalStore(subscribe, () => current, () => undefined);
  const statistics = useSyncExternalStore(subscribe, () => stats, () => undefined);
  const open = useSyncExternalStore(subscribe, () => settingsOpen, () => false);
  return { consent, statistics, settingsOpen: open, showBanner: open || consent === undefined };
}

/** Called on every change, with the marketing choice. */
export function onConsentChange(fn: (consent: Consent | undefined) => void) {
  return subscribe(() => fn(current));
}

/** Called only when the statistics choice changes. */
export function onStatsConsentChange(fn: (consent: Consent | undefined) => void) {
  let last = stats;
  return subscribe(() => {
    if (stats === last) return;
    last = stats;
    fn(stats);
  });
}

/** Sets the marketing choice only. */
export function setConsent(choice: Consent) {
  setChoices({ marketing: choice });
}

/** Saves one or both choices and closes the banner. */
export function setChoices(choices: { marketing?: Consent; statistics?: Consent }) {
  if (choices.marketing) {
    write(COOKIE, choices.marketing);
    current = choices.marketing;
    if (choices.marketing === 'denied') removeMarketingCookies();
  }
  if (choices.statistics) {
    write(STATS_COOKIE, choices.statistics);
    stats = choices.statistics;
  }
  settingsOpen = false;
  emit();
}

/** Shows the banner again so the choice can be changed (link in the footer). */
export function openConsentSettings() {
  settingsOpen = true;
  emit();
}

export function closeConsentSettings() {
  settingsOpen = false;
  emit();
}

/** Deletes Meta's cookies, which it sets on the main domain (e.g. .detail2go.nl) as well as on this host. */
function removeMarketingCookies() {
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; Domain=.${parts.slice(i).join('.')}`);
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
  }
}
