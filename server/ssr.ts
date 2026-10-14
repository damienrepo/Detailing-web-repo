// Server rendering of public pages (A1 in docs/SEO-PLAN.md): the HTML that search engines, AI crawlers and link
// previews receive contains the page's text and its JSON-LD, instead of an empty <div id="root">. If rendering
// fails for any reason, the page is served as before (rendered in the browser only), so the site never breaks.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ViteDevServer } from 'vite';
import type { ContentDoc } from '../shared/content';
import type { RenderInput, RenderOutput } from '../src/entry-server';
import type { SsrData } from '../src/lib/ssr';
import { getPublishedPost, listPublishedPosts } from './blog';
import type { Db } from './db';
import { listVisibleTeam } from './team';

type RenderFn = (input: RenderInput) => Promise<RenderOutput>;

/** Pages that are personal or private: rendered in the browser only. */
export function shouldServerRender(pathname: string) {
  return !/^\/(admin|afrekenen|bestelling|demo-betaling)(\/|$)/.test(pathname);
}

/** The data a page would fetch after loading, so the server HTML already contains it. */
export function ssrDataFor(db: Db, pathname: string): SsrData {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (path === '/') return { latestPosts: listPublishedPosts(db, 3) };
  if (path === '/blog') return { posts: listPublishedPosts(db) };
  if (path.startsWith('/blog/')) {
    const slug = decodeURIComponent(path.slice(6));
    return { post: { slug, data: getPublishedPost(db, slug) ?? null } };
  }
  if (path === '/team' || path === '/over-ons') return { team: listVisibleTeam(db) };
  return {};
}

/** JSON that is safe inside a <script> element. */
export function scriptJson(value: unknown) {
  const backslash = String.fromCharCode(92);
  return JSON.stringify(value)
    .replace(/</g, `${backslash}u003c`)
    .split(String.fromCharCode(0x2028))
    .join(`${backslash}u2028`)
    .split(String.fromCharCode(0x2029))
    .join(`${backslash}u2029`);
}

/** Puts the rendered page, its JSON-LD and its data into the HTML shell. */
export function injectRender(shell: string, out: RenderOutput, data: SsrData) {
  const ld = Object.entries(out.structuredData)
    .map(([id, json]) => `<script type="application/ld+json" id="ld-${id}">${scriptJson(json)}</script>`)
    .join('\n    ');
  let html = shell.replace('<div id="root"></div>', `<div id="root">${out.html}</div>`);
  if (ld) html = html.replace('</head>', `    ${ld}\n  </head>`);
  if (Object.keys(data).length) html = html.replace('</body>', `  <script type="application/json" id="ssr-data">${scriptJson(data)}</script>\n  </body>`);
  return html;
}

/** Loads the render function: the built bundle (dist-server/, never served publicly) in production, through Vite in development. */
export function createRenderer(options: { root: string; vite?: ViteDevServer }): () => Promise<RenderFn> {
  let built: Promise<RenderFn> | undefined;
  return async () => {
    if (options.vite) return ((await options.vite.ssrLoadModule('/src/entry-server.tsx')) as { render: RenderFn }).render;
    built ??= import(pathToFileURL(path.join(options.root, 'dist-server', 'entry-server.js')).href).then((m: { render: RenderFn }) => m.render);
    return built;
  };
}

/** Renders a page into the HTML shell; on any error returns the shell unchanged. */
export async function serverRender(
  shell: string,
  input: { url: string; pathname: string; origin: string; db: Db; content: ContentDoc; contentKey: string; load: () => Promise<RenderFn> },
): Promise<string> {
  if (!shouldServerRender(input.pathname)) return shell;
  try {
    const render = await input.load();
    const data = ssrDataFor(input.db, input.pathname);
    const out = await render({ url: input.url, origin: input.origin, data, content: input.content, contentKey: input.contentKey });
    return injectRender(shell, out, data);
  } catch (err) {
    console.error(`[ssr] ${input.pathname}:`, err instanceof Error ? err.message : err);
    return shell;
  }
}
