// Marketing-cookie consent. Stored in a first-party cookie (a necessary cookie, allowed without consent),
// so the server can also see it when an order is placed (server/meta.ts reads `d2g_consent`).
import { useSyncExternalStore } from 'react';

export type Consent = 'granted' | 'denied';

const COOKIE = 'd2g_consent';
const MAX_AGE = 365 * 24 * 3600;

const listeners = new Set<() => void>();
let current: Consent | undefined = read();
let settingsOpen = false;

function read(): Consent | undefined {
  const match = document.cookie.match(/(?:^|;\s*)d2g_consent=(granted|denied)/);
  return match?.[1] as Consent | undefined;
}

const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getConsent = () => current;

/** The visitor's choice, and whether the banner should show (no choice yet, or reopened from the footer). */
export function useConsent() {
  const consent = useSyncExternalStore(subscribe, () => current);
  const open = useSyncExternalStore(subscribe, () => settingsOpen);
  return { consent, showBanner: open || consent === undefined };
}

export function onConsentChange(fn: (consent: Consent | undefined) => void) {
  return subscribe(() => fn(current));
}

export function setConsent(choice: Consent) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${choice}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  current = choice;
  settingsOpen = false;
  if (choice === 'denied') removeMarketingCookies();
  emit();
}

/** Shows the banner again so the choice can be changed (link in the footer). */
export function openConsentSettings() {
  settingsOpen = true;
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
