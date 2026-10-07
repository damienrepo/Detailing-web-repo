import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db';
import { createMailer } from './mail';
import { MockProvider, MollieProvider, type PaymentProvider } from './payments';

const config = loadConfig();
const db = openDb(config.databasePath);

let payments: PaymentProvider | undefined;
if (config.mollieApiKey) payments = new MollieProvider(config.mollieApiKey);
else if (!config.production) payments = new MockProvider(config.appUrl);
else console.warn('[shop] MOLLIE_API_KEY ontbreekt: afrekenen is uitgeschakeld.');

const app = createApp({ config, db, payments, mailer: createMailer(config) });
const root = path.resolve(import.meta.dirname, '..');

if (config.production) {
  const dist = path.join(root, 'dist');
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.set('Cache-Control', 'no-cache').type('html').send(indexHtml);
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(config.port, () => {
  console.log(`[shop] ${config.appUrl} (betalingen: ${payments?.mode ?? 'uit'})`);
});
