// Renders a public page to HTML on the server (see server/ssr.ts). The browser then renders the same page again
// with createRoot, so the server HTML is only there for search engines, AI crawlers, link previews and the very
// first paint; nothing in the browser depends on it matching exactly.
import { prerenderToNodeStream } from 'react-dom/static';
import { StaticRouter } from 'react-router';
import { applyContent, type ContentDoc } from '../shared/content';
import App from './App';
import { SsrContext, type SsrData } from './lib/ssr';

export type RenderInput = { url: string; origin: string; data: SsrData; content: ContentDoc; contentKey: string };
export type RenderOutput = { html: string; structuredData: Record<string, object> };

// This bundle has its own copy of the shared content objects, so it applies the admin's content itself.
let appliedContent: string | undefined;

export async function render({ url, origin, data, content, contentKey }: RenderInput): Promise<RenderOutput> {
  if (appliedContent !== contentKey) {
    applyContent(content);
    appliedContent = contentKey;
  }
  const ctx = { origin, data, structuredData: {} as Record<string, object> };
  // prerender waits for lazy-loaded pages, unlike renderToString.
  const { prelude } = await prerenderToNodeStream(
    <SsrContext.Provider value={ctx}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </SsrContext.Provider>,
  );
  let html = '';
  for await (const chunk of prelude) html += chunk;
  return { html, structuredData: ctx.structuredData };
}
