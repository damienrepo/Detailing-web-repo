// Server rendering (see src/entry-server.tsx and server/ssr.ts): the server renders each public page to HTML so
// search engines and AI crawlers read the content without running JavaScript. This module carries what the
// render needs: the site's origin, the data a page would otherwise fetch, and the JSON-LD it declares.
import { createContext, useContext } from 'react';
import type { PostSummary, PublicPost } from '../../shared/blog';
import type { PublicTeamMember } from '../../shared/team';

/** Data a page normally fetches after loading; the server preloads it and embeds it in the HTML. */
export type SsrData = {
  posts?: PostSummary[];
  latestPosts?: PostSummary[];
  post?: { slug: string; data: PublicPost | null };
  team?: PublicTeamMember[];
};

export type SsrContextValue = {
  origin: string;
  data: SsrData;
  /** Filled during the render by useStructuredData; the server writes it into <head>. */
  structuredData: Record<string, object>;
};

export const SsrContext = createContext<SsrContextValue | null>(null);

export const isServer = typeof window === 'undefined';

let embedded: SsrData | undefined;
function embeddedData(): SsrData {
  if (isServer) return {};
  if (!embedded) {
    try {
      embedded = JSON.parse(document.getElementById('ssr-data')?.textContent || '{}') as SsrData;
    } catch {
      embedded = {};
    }
  }
  return embedded;
}

/** Data the server rendered this page with: from the render on the server, from the HTML in the browser. */
export function useSsrData<K extends keyof SsrData>(key: K): SsrData[K] | undefined {
  const ctx = useContext(SsrContext);
  return ctx ? ctx.data[key] : embeddedData()[key];
}

/** "https://www.detail2go.nl", also during the server render (where there is no `location`). */
export function useOrigin(): string {
  const ctx = useContext(SsrContext);
  return ctx ? ctx.origin : location.origin;
}
