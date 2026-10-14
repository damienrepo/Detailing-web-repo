// Language switch for the public site. The pages are written in Dutch; in English every visible text is
// replaced by its stored machine translation (see server/translate.ts). React keeps rendering Dutch: we
// translate the DOM after each change and put the Dutch back when switching back.
import { useSyncExternalStore } from 'react';
import { getSiteConfig } from './siteConfig';

export type Lang = 'nl' | 'en';

const STORE_KEY = 'd2g-lang';
const DICT_KEY = 'd2g-dict-en';
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg']);
/** Per request: well under the server's 12,000 characters. */
const BATCH_CHARS = 8000;
const BATCH_TEXTS = 100;

// --- Language ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let lang: Lang = readStored();
let available = false;

function readStored(): Lang {
  try {
    return localStorage.getItem(STORE_KEY) === 'en' ? 'en' : 'nl';
  } catch {
    return 'nl';
  }
}

const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useLanguage() {
  // The server always renders Dutch (third argument).
  const current = useSyncExternalStore(subscribe, () => lang, () => 'nl' as Lang);
  const canTranslate = useSyncExternalStore(subscribe, () => available, () => false);
  return { lang: current, available: canTranslate, setLanguage };
}

export function setLanguage(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORE_KEY, next);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  if (next === 'en') startTranslation();
  else stopTranslation();
  emit();
}

/** Called once at startup: English only when the server can translate (an API key is set). */
export async function initLanguage() {
  if (lang === 'en') startTranslation();
  available = Boolean((await getSiteConfig()).translate);
  if (!available && lang === 'en') {
    lang = 'nl';
    stopTranslation();
  }
  emit();
}

// --- Dictionary -------------------------------------------------------------------------

const dict = new Map<string, string>();
const failed = new Set<string>();
const queued = new Set<string>();
let dictLoaded = false;

function loadLocalDict() {
  try {
    const raw = localStorage.getItem(DICT_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) dict.set(k, v);
  } catch {
    /* ignore a broken or missing cache */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function saveLocalDict() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DICT_KEY, JSON.stringify(Object.fromEntries(dict)));
    } catch {
      /* full or blocked storage: the server copy still works */
    }
  }, 500);
}

async function loadServerDict() {
  try {
    const res = await fetch('/api/translations/en');
    if (!res.ok) return;
    for (const [k, v] of Object.entries((await res.json()) as Record<string, string>)) dict.set(k, v);
    saveLocalDict();
  } catch {
    /* offline: keep what we have */
  }
}

// --- DOM translation --------------------------------------------------------------------

type Rec = { source: string; applied: string };
const textRecs = new WeakMap<Text, Rec>();
const attrRecs = new WeakMap<Element, Map<string, Rec>>();
const touched = new Set<Text | Element>();
let observer: MutationObserver | undefined;
let running = false;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const worthTranslating = (s: string) => s.length >= 2 && s.length <= 2000 && /\p{L}{2}/u.test(s) && !/^(https?:\/\/|www\.)\S+$/i.test(s) && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s);

/** Elements whose text stays as it is: code, forms people type in, and anything marked translate="no". */
function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.getAttribute('translate') === 'no' || (e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

/** The English version of a text, keeping its surrounding whitespace; undefined while unknown. */
function lookup(source: string): string | undefined {
  const key = norm(source);
  if (!worthTranslating(key)) return source;
  const hit = dict.get(key);
  if (hit === undefined) {
    if (!failed.has(key)) queue(key);
    return undefined;
  }
  return (source.match(/^\s*/)?.[0] ?? '') + hit + (source.match(/\s*$/)?.[0] ?? '');
}

function translateText(node: Text) {
  const value = node.nodeValue ?? '';
  let rec = textRecs.get(node);
  // Our own write, already translated: nothing to do. Otherwise React (or the first pass) set new Dutch text.
  if (rec && value === rec.applied && rec.applied !== rec.source) return;
  if (!rec || value !== rec.applied) {
    if (!value.trim() || skipped(node.parentElement)) return;
    rec = { source: value, applied: value };
    textRecs.set(node, rec);
    touched.add(node);
  }
  const out = lookup(rec.source);
  if (out !== undefined && out !== value) {
    rec.applied = out;
    node.nodeValue = out;
  }
}

function translateAttr(el: Element, name: string) {
  const value = el.getAttribute(name);
  let recs = attrRecs.get(el);
  let rec = recs?.get(name);
  if (value === null) return;
  if (rec && value === rec.applied && rec.applied !== rec.source) return;
  if (!rec || value !== rec.applied) {
    if (skipped(el)) return;
    rec = { source: value, applied: value };
    if (!recs) attrRecs.set(el, (recs = new Map()));
    recs.set(name, rec);
    touched.add(el);
  }
  const out = lookup(rec.source);
  if (out !== undefined && out !== value) {
    rec.applied = out;
    el.setAttribute(name, out);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    if (skipped(el)) return;
    ATTRIBUTES.forEach((a) => el.hasAttribute(a) && translateAttr(el, a));
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeType === Node.ELEMENT_NODE && (SKIP.has((n as Element).tagName) || (n as Element).getAttribute('translate') === 'no')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else ATTRIBUTES.forEach((a) => (n as Element).hasAttribute(a) && translateAttr(n as Element, a));
  }
}

function translatePage() {
  // Forget elements React has removed, so the list doesn't grow while browsing.
  for (const n of touched) if (!n.isConnected) touched.delete(n);
  translateTree(document.body);
  const title = document.querySelector('title');
  if (title) translateTree(title);
}

// --- Fetching new translations ----------------------------------------------------------

let flushTimer: ReturnType<typeof setTimeout> | undefined;
function queue(text: string) {
  if (queued.has(text) || !dictLoaded) return;
  queued.add(text);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 40);
}

async function flush() {
  const texts = [...queued].filter((t) => !dict.has(t) && !failed.has(t));
  queued.clear();
  const batches: string[][] = [];
  let batch: string[] = [];
  let size = 0;
  for (const t of texts) {
    if (batch.length && (batch.length >= BATCH_TEXTS || size + t.length > BATCH_CHARS)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(t);
    size += t.length;
  }
  if (batch.length) batches.push(batch);

  await Promise.all(
    batches.map(async (b) => {
      try {
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: 'en', texts: b }) });
        const got = res.ok ? ((await res.json()) as { translations: Record<string, string> }).translations : {};
        b.forEach((t) => (t in got ? dict.set(t, got[t]) : failed.add(t)));
      } catch {
        b.forEach((t) => failed.add(t));
      }
    }),
  );
  saveLocalDict();
  if (running) translatePage();
}

// --- Start / stop -----------------------------------------------------------------------

/** Translates the page now and keeps translating whatever React renders next. Safe to call twice. */
export function startTranslation() {
  if (running || window.location.pathname.startsWith('/admin')) return;
  running = true;
  document.documentElement.lang = 'en';
  if (!dict.size) loadLocalDict();
  const firstVisit = !dict.size;
  // Without a cached dictionary, hide the page briefly so visitors don't see Dutch flash by.
  if (firstVisit) document.documentElement.classList.add('i18n-loading');
  const reveal = setTimeout(() => document.documentElement.classList.remove('i18n-loading'), 1500);

  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') translateText(m.target as Text);
      else if (m.type === 'attributes') translateAttr(m.target as Element, m.attributeName!);
      else m.addedNodes.forEach((n) => translateTree(n));
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
  if (dict.size) {
    dictLoaded = true;
    translatePage();
  }
  loadServerDict().then(() => {
    dictLoaded = true;
    if (!running) return;
    translatePage();
    clearTimeout(reveal);
    document.documentElement.classList.remove('i18n-loading');
  });
}

/** Puts the Dutch texts back and stops watching the page. */
export function stopTranslation() {
  if (!running) return;
  running = false;
  observer?.disconnect();
  observer = undefined;
  document.documentElement.lang = 'nl';
  document.documentElement.classList.remove('i18n-loading');
  for (const node of touched) {
    if (node.nodeType === Node.TEXT_NODE) {
      const rec = textRecs.get(node as Text);
      if (rec && node.nodeValue === rec.applied) node.nodeValue = rec.source;
      textRecs.delete(node as Text);
    } else {
      const el = node as Element;
      attrRecs.get(el)?.forEach((rec, name) => el.getAttribute(name) === rec.applied && el.setAttribute(name, rec.source));
      attrRecs.delete(el);
    }
  }
  touched.clear();
}
