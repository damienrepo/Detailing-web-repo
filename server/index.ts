import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { Auth } from './auth';
import { getPublishedPost } from './blog';
import { loadConfig } from './config';
import { ContentStore } from './content';
import { openDb } from './db';
import { createPaymentResolver } from './payments';
import { createCipher, loadEncryptionKey } from './security';
import { retryMetaPurchases } from './meta';
import { importSeed } from './seed';
import { renderIndex } from './seo';
import { createRenderer, serverRender } from './ssr';
import { overridesFromConfig, SettingsStore } from './settings';

const config = loadConfig();
const db = openDb(config.databasePath);
// A fresh installation starts with the content exported from another one (see server/seed.ts).
if (importSeed(db, config.uploadsDir, path.resolve(import.meta.dirname, '..', 'seed'))) console.log('[shop] Inhoud uit seed/ ingeladen.');
const cipher = createCipher(loadEncryptionKey(config.secretKey, config.databasePath, config.production));
const settings = new SettingsStore(db, cipher, overridesFromConfig(config));
const auth = new Auth(db, cipher, config.production && config.appUrl.startsWith('https://'));
const content = new ContentStore(db);
const payments = createPaymentResolver(() => settings.get('mollieApiKey'), config);

if (config.production && !config.appUrl.startsWith('https://')) {
  console.warn('[shop] APP_URL is geen https-adres: inlogcookies worden niet als "Secure" gemarkeerd.');
}

const app = createApp({ config, db, cipher, settings, auth, content, payments });
const root = path.resolve(import.meta.dirname, '..');

/** The HTML for a page: its title and meta tags, and (for public pages) the server-rendered content. */
async function page(html: string, req: express.Request, load: ReturnType<typeof createRenderer>) {
  const out = renderIndex(html, req.path, config.appUrl, { contentJson: content.embed(), findPost: (slug) => getPublishedPost(db, slug) });
  const rendered = await serverRender(out.html, {
    url: req.originalUrl,
    pathname: req.path,
    origin: config.appUrl,
    db,
    content: content.current(),
    contentKey: content.embed(),
    load,
  });
  return { status: out.status, html: rendered };
}

if (config.production) {
  const dist = path.join(root, 'dist');
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  const load = createRenderer({ root });
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    try {
      const out = await page(indexHtml, req, load);
      res.status(out.status).set('Cache-Control', 'no-cache').type('html').send(out.html);
    } catch (err) {
      next(err);
    }
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
  app.use(vite.middlewares);
  const load = createRenderer({ root, vite });
  // Same HTML treatment as production, so edited content and page titles also show in development.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET') return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
      const out = await page(html, req, load);
      res.status(out.status).type('html').send(out.html);
    } catch (err) {
      next(err);
    }
  });
}

// Purchases that did not reach Meta's Conversions API right away are retried in the background.
if (config.meta.pixelId && config.meta.accessToken) {
  setInterval(() => void retryMetaPurchases(db, config.meta).catch((err) => console.error('[meta]', err)), 10 * 60_000).unref();
} else if (process.env.META_PIXEL_ID || process.env.META_CAPI_ACCESS_TOKEN) {
  console.warn('[meta] Zet zowel een geldige META_PIXEL_ID als META_CAPI_ACCESS_TOKEN; zonder beide gaan aankopen niet naar de Conversions API.');
}

app.listen(config.port, () => {
  console.log(`[shop] ${config.appUrl} (betalingen: ${payments()?.mode ?? 'uit'})`);
  if (auth.setupCode) {
    console.log(
      [
        '',
        '  ┌─────────────────────────────────────────────────────┐',
        '  │  Nog geen beheerder. Maak je account aan via:        │',
        `  │  ${`${config.appUrl}/admin`.padEnd(51)}│`,
        `  │  Setupcode: ${auth.setupCode.padEnd(40)}│`,
        '  └─────────────────────────────────────────────────────┘',
        '',
      ].join('\n'),
    );
  }
});
