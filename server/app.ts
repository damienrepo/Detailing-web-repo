import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { PRODUCTS } from '../shared/catalog';
import { priceCart, PricingError } from '../shared/pricing';
import { bookingSchema, bookingStatusSchema, checkoutSchema, fieldErrors, shipSchema } from '../shared/validation';
import type { Config } from './config';
import type { Db } from './db';
import {
  bookingNotificationMail,
  bookingReceivedMail,
  orderConfirmationMail,
  orderNotificationMail,
  orderShippedMail,
} from './emails';
import { sendSafely, type Mailer } from './mail';
import {
  applyPaymentStatus,
  cancelOrder,
  createOrder,
  getOrderById,
  getOrderByPaymentId,
  getOrderByPublicId,
  listOrders,
  markShipped,
  publicOrder,
  setPaymentId,
  type Order,
} from './orders';
import { MockProvider, type PaymentProvider } from './payments';

export type AppDeps = {
  config: Config;
  db: Db;
  payments?: PaymentProvider;
  mailer: Mailer;
};

/** Small fixed-window rate limiter; enough to stop scripted form spam on a single instance. */
function rateLimit(limit: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return next();
    }
    if (++entry.count > limit) {
      res.status(429).json({ error: 'Te veel verzoeken. Probeer het over een paar minuten opnieuw.' });
      return;
    }
    next();
  };
}

const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function createApp({ config, db, payments, mailer }: AppDeps) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    });
    // Vite's dev server injects inline scripts, so the CSP is production-only.
    if (config.production) {
      res.set(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: https://images.unsplash.com; style-src 'self' 'unsafe-inline'; " +
          "script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      res.set('Strict-Transport-Security', 'max-age=31536000');
    }
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '20kb' }));
  api.use(express.urlencoded({ extended: false, limit: '5kb' }));

  const orderUrl = (order: Order) => `${config.appUrl}/bestelling/${order.public_id}`;
  // Mollie cannot reach localhost, so only send a webhook URL for public hosts.
  const webhookUrl = /^https:\/\/(?!localhost|127\.)/.test(config.appUrl)
    ? `${config.appUrl}/api/webhooks/mollie`
    : undefined;

  async function onPaid(order: Order) {
    await sendSafely(mailer, orderConfirmationMail(order, orderUrl(order)));
    if (config.notifyEmail) await sendSafely(mailer, orderNotificationMail(order, config.notifyEmail));
  }

  /** Pulls the latest status from the payment provider and updates the order. */
  async function syncPayment(order: Order): Promise<Order> {
    if (!payments || !order.payment_id || order.status !== 'open') return order;
    let payment;
    try {
      payment = await payments.get(order.payment_id);
    } catch (err) {
      // Show the last known status rather than failing the order page; the webhook will catch up.
      console.error(err);
      return order;
    }
    if (applyPaymentStatus(db, order.id, payment.status, payment.method)) {
      const paid = getOrderById(db, order.id)!;
      await onPaid(paid);
      return paid;
    }
    return getOrderById(db, order.id)!;
  }

  async function startPayment(order: Order) {
    if (!payments) throw new HttpError(503, 'Online betalen is tijdelijk niet beschikbaar. Neem contact met ons op.');
    const payment = await payments.create({
      amount: order.total,
      description: `Bestelling ${order.number}`,
      redirectUrl: orderUrl(order),
      webhookUrl,
      orderPublicId: order.public_id,
    });
    setPaymentId(db, order.id, payment.id);
    if (!payment.checkoutUrl) throw new Error(`Payment ${payment.id} has no checkout URL`);
    return payment.checkoutUrl;
  }

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  api.get('/config', (_req, res) => {
    res.json({ payments: payments?.mode ?? 'off' });
  });

  api.post(
    '/orders',
    rateLimit(20, 10 * 60_000),
    asyncRoute(async (req, res) => {
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Controleer de ingevulde gegevens.', fields: fieldErrors(parsed.error) });
        return;
      }
      if (!payments) throw new HttpError(503, 'Online betalen is tijdelijk niet beschikbaar. Neem contact met ons op.');
      const { items, customer } = parsed.data;
      const totals = priceCart(items, customer.country);
      const order = createOrder(db, { ...customer, postalCode: customer.postalCode.toUpperCase() }, totals);
      const checkoutUrl = await startPayment(order);
      res.status(201).json({ checkoutUrl, orderId: order.public_id });
    }),
  );

  api.get(
    '/orders/:publicId',
    asyncRoute(async (req, res) => {
      const order = getOrderByPublicId(db, String(req.params.publicId));
      if (!order) throw new HttpError(404, 'Bestelling niet gevonden');
      res.json(publicOrder(await syncPayment(order)));
    }),
  );

  // Lets a customer retry after a cancelled or failed payment.
  api.post(
    '/orders/:publicId/pay',
    rateLimit(20, 10 * 60_000),
    asyncRoute(async (req, res) => {
      const order = getOrderByPublicId(db, String(req.params.publicId));
      if (!order) throw new HttpError(404, 'Bestelling niet gevonden');
      if (order.status !== 'open' && order.status !== 'failed') throw new HttpError(409, 'Deze bestelling is al betaald');
      // Reuse a payment that is still open, so a customer cannot accidentally pay twice.
      if (payments && order.payment_id) {
        const current = await payments.get(order.payment_id);
        if (current.status === 'paid') {
          if (applyPaymentStatus(db, order.id, 'paid', current.method)) await onPaid(getOrderById(db, order.id)!);
          throw new HttpError(409, 'Deze bestelling is al betaald');
        }
        if (current.status === 'open' && current.checkoutUrl) {
          res.json({ checkoutUrl: current.checkoutUrl });
          return;
        }
      }
      db.prepare(`UPDATE orders SET status = 'open' WHERE id = ?`).run(order.id);
      res.json({ checkoutUrl: await startPayment(order) });
    }),
  );

  api.post(
    '/webhooks/mollie',
    asyncRoute(async (req, res) => {
      const id = typeof req.body?.id === 'string' ? req.body.id : '';
      if (!payments || !/^tr_\w+$/.test(id)) {
        res.sendStatus(200);
        return;
      }
      const payment = await payments.get(id);
      const order =
        (payment.orderPublicId && getOrderByPublicId(db, payment.orderPublicId)) || getOrderByPaymentId(db, id);
      if (order && applyPaymentStatus(db, order.id, payment.status, payment.method)) {
        await onPaid(getOrderById(db, order.id)!);
      }
      res.sendStatus(200);
    }),
  );

  api.post(
    '/bookings',
    rateLimit(10, 10 * 60_000),
    asyncRoute(async (req, res) => {
      const parsed = bookingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Controleer de ingevulde gegevens.', fields: fieldErrors(parsed.error) });
        return;
      }
      const { website: _honeypot, ...booking } = parsed.data;
      db.prepare(
        `INSERT INTO bookings (service_id, vehicle, preferred_date, name, email, phone, postal_code, message)
         VALUES (@serviceId, @vehicle, @preferredDate, @name, @email, @phone, @postalCode, @message)`,
      ).run({
        ...booking,
        preferredDate: booking.preferredDate ?? null,
        postalCode: booking.postalCode ?? null,
        message: booking.message ?? null,
      });
      await sendSafely(mailer, bookingReceivedMail(booking));
      if (config.notifyEmail) await sendSafely(mailer, bookingNotificationMail(booking, config.notifyEmail));
      res.status(201).json({ ok: true });
    }),
  );

  // --- Admin -------------------------------------------------------------

  const admin = express.Router();
  admin.use(rateLimit(300, 10 * 60_000));
  admin.use((req, res, next) => {
    if (!config.adminPassword) {
      res.status(503).json({ error: 'Beheer is uitgeschakeld: stel ADMIN_PASSWORD in.' });
      return;
    }
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !safeEqual(token, config.adminPassword)) {
      res.status(401).json({ error: 'Onjuist wachtwoord' });
      return;
    }
    next();
  });

  admin.get('/orders', (_req, res) => {
    res.json(listOrders(db));
  });

  // Semicolon-separated with comma decimals and a BOM, so Dutch Excel opens it directly.
  admin.get('/orders.csv', (_req, res) => {
    const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
    const cell = (v: string | number | null) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'Bestelnummer', 'Besteld op', 'Status', 'Betaald op', 'Naam', 'E-mail', 'Telefoon', 'Adres', 'Postcode', 'Plaats',
      'Land', 'Producten', 'Subtotaal', 'Verzending', 'Btw', 'Totaal', 'Betaalmethode', 'Track & trace',
    ];
    const rows = listOrders(db, 10_000).map((o) => [
      o.number, o.created_at, o.status, o.paid_at, o.name, o.email, o.phone, `${o.street} ${o.house_number}`, o.postal_code,
      o.city, o.country, o.items.map((i) => `${i.quantity}x ${i.name}`).join(', '), money(o.subtotal), money(o.shipping),
      money(o.vat), money(o.total), o.payment_method, o.tracking_code,
    ]);
    const csv = [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="bestellingen-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send('﻿' + csv);
  });

  admin.post(
    '/orders/:id/ship',
    asyncRoute(async (req, res) => {
      const parsed = shipSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new HttpError(400, 'Ongeldige track-and-trace code');
      const id = Number(req.params.id);
      if (!markShipped(db, id, parsed.data.trackingCode ?? null)) {
        throw new HttpError(409, 'Alleen betaalde bestellingen kunnen als verzonden worden gemarkeerd');
      }
      const order = getOrderById(db, id)!;
      await sendSafely(mailer, orderShippedMail(order, orderUrl(order)));
      res.json(order);
    }),
  );

  admin.post('/orders/:id/cancel', (req, res) => {
    if (!cancelOrder(db, Number(req.params.id))) {
      throw new HttpError(409, 'Alleen onbetaalde bestellingen kunnen worden geannuleerd');
    }
    res.json(getOrderById(db, Number(req.params.id)));
  });

  admin.get('/bookings', (_req, res) => {
    res.json(db.prepare('SELECT * FROM bookings ORDER BY id DESC LIMIT 200').all());
  });

  admin.post('/bookings/:id/status', (req, res) => {
    const parsed = bookingStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Ongeldige status');
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(parsed.data.status, Number(req.params.id));
    res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(req.params.id)));
  });

  api.use('/admin', admin);

  // --- Development payment page -----------------------------------------

  if (payments instanceof MockProvider) {
    api.get('/dev/mock-checkout/:id', (req, res) => {
      const id = String(req.params.id);
      if (!payments.payments.has(id)) {
        res.status(404).send('Onbekende betaling');
        return;
      }
      res.type('html').send(mockCheckoutPage(id));
    });
    api.post('/dev/mock-checkout/:id', (req, res) => {
      const status = req.body?.status === 'paid' ? 'paid' : 'failed';
      const payment = payments.settle(String(req.params.id), status);
      if (!payment) {
        res.status(404).send('Onbekende betaling');
        return;
      }
      res.redirect(303, payment.redirectUrl);
    });
  }

  api.use((_req, res) => {
    res.status(404).json({ error: 'Niet gevonden' });
  });

  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof PricingError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Ongeldig verzoek' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.' });
  });

  app.use('/api', api);

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nDisallow: /admin\nDisallow: /bestelling/\nDisallow: /afrekenen\n\nSitemap: ${config.appUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    const paths = [
      '/',
      '/shop',
      ...PRODUCTS.map((p) => `/shop/${p.slug}`),
      '/afspraak',
      '/verzending',
      '/retourneren',
      '/voorwaarden',
      '/privacy',
      '/contact',
    ];
    const urls = paths.map((p) => `  <url><loc>${config.appUrl}${p === '/' ? '/' : p}</loc></url>`).join('\n');
    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  return app;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}


function mockCheckoutPage(id: string) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Testbetaling</title><style>body{font:16px system-ui;background:#f3f1ec;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;padding:32px;max-width:360px;border:1px solid #ddd}button{display:block;width:100%;padding:12px;margin-top:12px;font:inherit;cursor:pointer}</style></head>
<body><main><h1 style="font-size:20px;margin:0 0 8px">Testbetaling</h1><p>Er is geen MOLLIE_API_KEY ingesteld, dus dit is een nagebootste betaalpagina voor ontwikkeling.</p>
<form method="post" action="/api/dev/mock-checkout/${id}"><button name="status" value="paid">Betaling geslaagd</button><button name="status" value="failed">Betaling mislukt</button></form></main></body></html>`;
}
