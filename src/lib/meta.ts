import { useContext, useEffect } from 'react';
import { SITE } from '../../shared/site';
import { SsrContext } from './ssr';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Sets the document title, description and canonical URL for the current page. */
export function usePageMeta(title: string | undefined, description: string = SITE.description, options: { noindex?: boolean } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE.fullName}` : `${SITE.fullName} — ${SITE.tagline}`;
    document.title = fullTitle;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', location.origin + location.pathname);
    setMeta('meta[name="robots"]', 'name', 'robots', options.noindex ? 'noindex' : 'index,follow');

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = location.origin + location.pathname;
  }, [title, description, options.noindex]);
}

/**
 * Adds a JSON-LD block for the lifetime of the component. During the server render it is collected and written
 * into <head>; in the browser it replaces that server copy, so there is never a duplicate.
 */
export function useStructuredData(id: string, data: object | undefined) {
  const ssr = useContext(SsrContext);
  if (ssr && data) ssr.structuredData[id] = data;
  const json = data ? JSON.stringify(data) : undefined;
  useEffect(() => {
    if (!json) return;
    document.getElementById(`ld-${id}`)?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = `ld-${id}`;
    script.textContent = json;
    document.head.appendChild(script);
    return () => script.remove();
  }, [id, json]);
}
