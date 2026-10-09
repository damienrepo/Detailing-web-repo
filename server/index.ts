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
import { importSeed } from './seed';
import { renderIndex } from './seo';
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

const page = (html: string, pathname: string) =>
  renderIndex(html, pathname, config.appUrl, { contentJson: content.embed(), findPost: (slug) => getPublishedPost(db, slug) });

if (config.production) {
  const dist = path.join(root, 'dist');
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const out = page(indexHtml, req.path);
    res.status(out.status).set('Cache-Control', 'no-cache').type('html').send(out.html);
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
  app.use(vite.middlewares);
  // Same HTML treatment as production, so edited content and page titles also show in development.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET') return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
      const out = page(html, req.path);
      res.status(out.status).type('html').send(out.html);
    } catch (err) {
      next(err);
    }
  });
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
