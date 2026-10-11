// Cookieless website statistics: pageviews, active time and scroll depth per page, and a few actions
// (calls, bookings, orders). Nothing is stored in the browser; the server explains how visits are counted.
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { normalizePath, type Device, type EventName } from '../../shared/analytics';
import { DEMO } from './demo';

type Page = {
  id: string;
  path: string;
  title: string;
  /** Visible time so far (ms) and when the current visible stretch started. */
  active: number;
  since: number | null;
  scroll: number;
  load?: number;
  /** Events that only make sense once per page, e.g. a 404. */
  once: Set<EventName>;
};

let page: Page | null = null;
let firstView = true;
let listening = false;
let errors = 0;

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

function send(body: object) {
  const data = JSON.stringify(body);
  try {
    // A beacon survives the page being closed or navigating away to the payment page.
    if (navigator.sendBeacon?.('/api/collect', new Blob([data], { type: 'text/plain' }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch('/api/collect', { method: 'POST', body: data, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}

function device(): Device {
  const short = Math.min(screen.width, screen.height);
  const touch = matchMedia('(pointer: coarse)').matches;
  if (short < 500 || (touch && short < 600)) return 'mobile';
  if (touch && short < 1100) return 'tablet';
  return 'desktop';
}

function scrollDepth() {
  const height = document.documentElement.scrollHeight;
  if (!height) return 0;
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100));
}

function pause(p: Page) {
  if (p.since !== null) {
    p.active += performance.now() - p.since;
    p.since = null;
  }
}

function flush(p: Page) {
  send({ t: 'engage', id: p.id, d: Math.round(p.active + (p.since !== null ? performance.now() - p.since : 0)), s: p.scroll, title: p.title || undefined, load: p.load });
}

function measureLoad(p: Page) {
  const done = () =>
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const ms = nav ? Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd) : 0;
      if (ms > 0) p.load = ms;
    }, 0);
  if (document.readyState === 'complete') done();
  else window.addEventListener('load', done, { once: true });
}

function start(pathname: string) {
  const path = normalizePath(pathname);
  // React's development mode runs effects twice; a real navigation always changes the path.
  if (page?.path === path) return;
  if (page) {
    pause(page);
    flush(page);
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    page = null;
    return;
  }
  const p: Page = { id: randomId(), path, title: '', active: 0, since: document.visibilityState === 'visible' ? performance.now() : null, scroll: 0, once: new Set() };
  page = p;
  const message: Record<string, unknown> = {
    t: 'pageview',
    id: p.id,
    path,
    device: device(),
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (firstView) {
    firstView = false;
    const params = new URLSearchParams(location.search);
    message.ref = document.referrer || undefined;
    message.utm = { source: params.get('utm_source'), medium: params.get('utm_medium'), campaign: params.get('utm_campaign') };
    // Click ids that only ad networks add (fbclid is also on ordinary Facebook links, so it's not one of them).
    message.paid = ['gclid', 'gbraid', 'wbraid', 'msclkid'].some((k) => params.has(k));
    measureLoad(p);
  }
  send(message);
  // The page sets its title after rendering, sometimes only once its data has loaded.
  const capture = () => {
    if (page !== p) return;
    p.title = document.title;
    p.scroll = Math.max(p.scroll, scrollDepth());
  };
  setTimeout(capture, 0);
  setTimeout(capture, 1500);
}

function reportError(message: string) {
  if (!message || /^Script error\.?$/.test(message) || /ResizeObserver loop/.test(message) || errors >= 3) return;
  errors++;
  track('js_error', message.slice(0, 200));
}

function listen() {
  if (listening) return;
  listening = true;
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (page) page.scroll = Math.max(page.scroll, scrollDepth());
      });
    },
    { passive: true },
  );
  document.addEventListener('visibilitychange', () => {
    if (!page) return;
    if (document.visibilityState === 'hidden') {
      pause(page);
      page.title = document.title || page.title;
      flush(page);
    } else page.since = performance.now();
  });
  window.addEventListener('pagehide', () => {
    if (!page) return;
    pause(page);
    flush(page);
  });
  // The leave beacon can get lost (a phone killing the tab), so report the time so far now and then.
  setInterval(() => {
    if (page && document.visibilityState === 'visible') {
      page.title = document.title || page.title;
      flush(page);
    }
  }, 20_000);
  // Calls, e-mails, WhatsApp and links to other sites, without touching every component.
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      if (href.startsWith('tel:')) return track('call', href.slice(4));
      if (href.startsWith('mailto:')) return track('email', href.slice(7).split('?')[0]);
      let url: URL;
      try {
        url = new URL(link.href, location.href);
      } catch {
        return;
      }
      if (/^(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)$/.test(url.hostname)) track('whatsapp');
      else if (/^https?:$/.test(url.protocol) && url.host !== location.host) track('outbound', url.hostname.replace(/^www\./, ''));
    },
    true,
  );
  window.addEventListener('error', (e) => reportError(e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason instanceof Error ? e.reason.message : String(e.reason ?? '')));
}

/** Records an action on the current page. */
export function track(name: EventName, label?: string | null, value?: number | null) {
  if (DEMO) return;
  const current = () => (page && page.path === normalizePath(location.pathname) ? page : null);
  const fire = (p: Page) => {
    if (name === 'not_found') {
      if (p.once.has(name)) return;
      p.once.add(name);
    }
    send({ t: 'event', id: p.id, name, label: label ?? undefined, value: value ?? undefined });
  };
  const p = current();
  if (p) fire(p);
  // Fired while the route is changing: wait until the new page has been counted.
  else
    setTimeout(() => {
      const later = current();
      if (later) fire(later);
    }, 0);
}

/** Counts a pageview on every route change. Admin pages are never counted. */
export function useAnalytics() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (DEMO) return;
    listen();
    start(pathname);
  }, [pathname]);
}
