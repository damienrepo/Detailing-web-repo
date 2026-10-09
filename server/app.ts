import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { listedProducts, PRODUCTS, type Product } from '../shared/catalog';
import { ABOUT, SHOP, BUILTIN_IMAGES, defaultContent, HOME, serviceEdit, shippingEdit, siteEdit, type ServiceEdit, type ShippingContent } from '../shared/content';
import { aboutSchema, emailSchema, shopSchema, homeSchema, postSchema, productSchema, serviceSchema, shippingSchema, siteSchema, teamMemberSchema } from '../shared/schemas';
import { EMAIL, EMAIL_KINDS, KIND_INFO, TEMPLATE_INFO, type EmailSettings } from '../shared/email';
import { assertShippingAvailable, priceCart, PricingError } from '../shared/pricing';
import { getService, listedServices, SERVICES } from '../shared/services';
import { SITE } from '../shared/site';
import { bookingSchema, bookingStatusSchema, checkoutSchema, fieldErrors, shipSchema } from '../shared/validation';
import { Auth, createAuthRouter, sameOriginOnly } from './auth';
import { createPost, deletePost, getPost, listAllPosts, listPublishedPosts, getPublishedPost, slugTaken, updatePost } from './blog';
import type { Config } from './config';
import { ContentStore } from './content';
import type { Db } from './db';
import {
  bookingNotificationMail,
  bookingReceivedMail,
  orderConfirmationMail,
  orderNotificationMail,
  orderReadyMail,
  orderShippedMail,
  sampleMail,
} from './emails';
import { createMailer, sendSafely, sendTestMail, type Mailer } from './mail';
import { MEDIA_ID, MediaStore } from './media';
import { createTeamMember, deleteTeamMember, getTeamMember, listTeam, listVisibleTeam, reorderTeam, updateTeamMember } from './team';
import {
  applyPaymentStatus,
  cancelOrder,
  createOrder,
  getOrderById,
  getOrderByPaymentId,
  getOrderByPublicId,
  listOrders,
  markCollected,
  markReady,
  markShipped,
  publicOrder,
  setPaymentId,
  type Order,
} from './orders';
import { createPaymentResolver, MockProvider, verifyMollieKey, type PaymentProvider } from './payments';
import { createCipher, loadEncryptionKey, type Cipher } from './security';
import { overridesFromConfig, settingsInputSchema, SettingsStore } from './settings';

export type AppDeps = {
  config: Config;
  db: Db;
  /** A fixed provider (tests) or a function returning the current one. Defaults to the admin settings. */
  payments?: PaymentProvider | (() => PaymentProvider | undefined);
  mailer?: Mailer;
  cipher?: Cipher;
  settings?: SettingsStore;
  auth?: Auth;
  content?: ContentStore;
};

/** Thrown by `parse`; the error handler turns it into a 400 with per-field messages. */
class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? 'Controleer de ingevulde gegevens.');
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ValidationError(fieldErrors(parsed.error));
  return parsed.data;
}

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

export function createApp(deps: AppDeps) {
  const { config, db } = deps;
  const cipher = deps.cipher ?? createCipher(loadEncryptionKey(config.secretKey, config.databasePath, config.production));
  const settings = deps.settings ?? new SettingsStore(db, cipher, overridesFromConfig(config));
  const auth = deps.auth ?? new Auth(db, cipher, config.production && config.appUrl.startsWith('https://'));
  const content = deps.content ?? new ContentStore(db);
  const media = new MediaStore(db, config.uploadsDir);
  const fixedPayments = deps.payments;
  const getPayments =
    typeof fixedPayments === 'function'
      ? fixedPayments
      : fixedPayments
        ? () => fixedPayments
        : createPaymentResolver(() => settings.get('mollieApiKey'), config);
  const mailer = deps.mailer ?? createMailer(() => settings.effective());
  const notifyEmail = () => settings.effective().notifyEmail;

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
  // Larger bodies (blog posts, image uploads) are only parsed for signed-in admins.
  const signedIn = (req: Request) => Boolean(auth.resolve(auth.readCookie(req)));
  api.use('/admin/media', (req, res, next) => (signedIn(req) ? express.json({ limit: '8mb' })(req, res, next) : next()));
  api.use('/admin', (req, res, next) => (signedIn(req) ? express.json({ limit: '300kb' })(req, res, next) : next()));
  api.use(express.json({ limit: '20kb' }));
  api.use(express.urlencoded({ extended: false, limit: '5kb' }));

  const orderUrl = (order: Order) => `${config.appUrl}/bestelling/${order.public_id}`;
  // Mollie cannot reach localhost, so only send a webhook URL for public hosts.
  const webhookUrl = /^https:\/\/(?!localhost|127\.)/.test(config.appUrl)
    ? `${config.appUrl}/api/webhooks/mollie`
    : undefined;

  async function onPaid(order: Order) {
    await sendSafely(mailer, orderConfirmationMail(order, orderUrl(order)));
    const notify = notifyEmail();
    if (notify) await sendSafely(mailer, orderNotificationMail(order, notify, config.appUrl));
  }

  /** Pulls the latest status from the payment provider and updates the order. */
  async function syncPayment(order: Order): Promise<Order> {
    const payments = getPayments();
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
    const payments = getPayments();
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
    res.json({ payments: getPayments()?.mode ?? 'off' });
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
      if (!SHOP.enabled) throw new HttpError(503, 'De webshop is op dit moment gesloten. Neem gerust contact met ons op.');
      if (!getPayments()) throw new HttpError(503, 'Online betalen is tijdelijk niet beschikbaar. Neem contact met ons op.');
      const { items, customer, shippingMethod } = parsed.data;
      assertShippingAvailable(shippingMethod, customer.country);
      const totals = priceCart(items, customer.country, shippingMethod);
      // A pickup order has no delivery address; don't keep what the browser may still have filled in.
      const address =
        shippingMethod === 'pickup'
          ? { street: '', houseNumber: '', postalCode: '', city: '' }
          : { street: customer.street, houseNumber: customer.houseNumber, postalCode: customer.postalCode.toUpperCase(), city: customer.city };
      const order = createOrder(db, { ...customer, ...address }, totals, shippingMethod);
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
      const payments = getPayments();
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
      const payments = getPayments();
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
      if (!getService(booking.serviceId)) {
        res.status(400).json({ error: 'Kies een behandeling', fields: { serviceId: 'Kies een behandeling' } });
        return;
      }
      db.prepare(
        `INSERT INTO bookings (service_id, vehicle, preferred_date, name, email, phone, postal_code, message)
         VALUES (@serviceId, @vehicle, @preferredDate, @name, @email, @phone, @postalCode, @message)`,
      ).run({
        ...booking,
        preferredDate: booking.preferredDate ?? null,
        postalCode: booking.postalCode ?? null,
        message: booking.message ?? null,
      });
      await sendSafely(mailer, bookingReceivedMail(booking, config.appUrl));
      const notify = notifyEmail();
      if (notify) await sendSafely(mailer, bookingNotificationMail(booking, notify, config.appUrl));
      res.status(201).json({ ok: true });
    }),
  );

  // --- Blog (public) -----------------------------------------------------

  api.get('/posts', (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
    res.json(listPublishedPosts(db, limit));
  });

  api.get('/posts/:slug', (req, res) => {
    const post = getPublishedPost(db, String(req.params.slug));
    if (!post) throw new HttpError(404, 'Dit bericht bestaat niet (meer).');
    res.json(post);
  });

  // --- Team (public) -----------------------------------------------------

  api.get('/team', (_req, res) => {
    res.json(listVisibleTeam(db));
  });

  // --- Admin -------------------------------------------------------------

  const admin = express.Router();
  admin.use((_req, res, next) => {
    // Admin data must never be cached by the browser or a proxy.
    res.set('Cache-Control', 'no-store');
    next();
  });
  admin.use(sameOriginOnly);
  admin.use(rateLimit(600, 10 * 60_000));
  // Extra per-IP brakes on top of the per-account lockout in Auth.
  admin.use('/setup', rateLimit(10, 15 * 60_000));
  admin.use('/login', rateLimit(30, 15 * 60_000));
  const authRoutes = createAuthRouter(auth);
  admin.use(authRoutes.router);
  admin.use(authRoutes.requireAdmin);
  admin.use(authRoutes.account);

  const audit = (req: Request, action: string, detail?: string) => auth.audit(req.admin?.id ?? null, action, req, detail);

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
      'Bestelnummer', 'Besteld op', 'Status', 'Levering', 'Betaald op', 'Naam', 'E-mail', 'Telefoon', 'Adres', 'Postcode', 'Plaats',
      'Land', 'Producten', 'Subtotaal', 'Verzending', 'Btw', 'Totaal', 'Betaalmethode', 'Track & trace',
    ];
    const rows = listOrders(db, 10_000).map((o) => [
      o.number, o.created_at, o.status, o.shipping_method === 'pickup' ? 'Afhalen' : 'Bezorgen', o.paid_at, o.name, o.email, o.phone, `${o.street} ${o.house_number}`, o.postal_code,
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
        throw new HttpError(409, 'Alleen betaalde bezorgbestellingen kunnen als verzonden worden gemarkeerd');
      }
      const order = getOrderById(db, id)!;
      await sendSafely(mailer, orderShippedMail(order, orderUrl(order)));
      res.json(order);
    }),
  );

  admin.post(
    '/orders/:id/ready',
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      if (!markReady(db, id)) throw new HttpError(409, 'Alleen betaalde afhaalbestellingen kunnen klaargezet worden');
      const order = getOrderById(db, id)!;
      await sendSafely(mailer, orderReadyMail(order, orderUrl(order)));
      res.json(order);
    }),
  );

  admin.post('/orders/:id/collected', (req, res) => {
    const id = Number(req.params.id);
    if (!markCollected(db, id)) throw new HttpError(409, 'Alleen betaalde afhaalbestellingen kunnen als opgehaald worden gemarkeerd');
    res.json(getOrderById(db, id));
  });

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

  // Integrations: Mollie and e-mail.

  const settingsView = () => ({
    values: settings.view(),
    payments: getPayments()?.mode ?? 'off',
    webhooks: /^https:\/\/(?!localhost|127\.)/.test(config.appUrl),
  });

  admin.get('/settings', (_req, res) => {
    res.json(settingsView());
  });

  admin.put('/settings', (req, res) => {
    const changed = settings.update(parse(settingsInputSchema, req.body));
    if (changed.length) audit(req, 'settings_changed', changed.join(', '));
    res.json(settingsView());
  });

  admin.post(
    '/settings/test-mollie',
    rateLimit(20, 10 * 60_000),
    asyncRoute(async (req, res) => {
      const typed =
        typeof req.body?.apiKey === 'string' && req.body.apiKey
          ? parse(settingsInputSchema, { mollieApiKey: req.body.apiKey }).mollieApiKey
          : undefined;
      const key = typed || settings.get('mollieApiKey');
      if (!key) throw new HttpError(400, 'Vul eerst een Mollie API-key in.');
      const problem = await verifyMollieKey(key);
      if (problem) throw new HttpError(400, problem);
      res.json({ ok: true, mode: key.startsWith('live_') ? 'live' : 'test' });
    }),
  );

  admin.post(
    '/settings/test-mail',
    rateLimit(10, 10 * 60_000),
    asyncRoute(async (req, res) => {
      const problem = await sendTestMail(settings.effective(), req.admin!.email);
      if (problem) throw new HttpError(400, problem);
      res.json({ ok: true, to: req.admin!.email });
    }),
  );

  // Content: business details, homepage and services.

  const contentView = () => {
    const doc = content.current();
    return {
      site: siteEdit(SITE),
      shipping: shippingEdit(),
      home: HOME,
      about: ABOUT,
      shop: SHOP,
      services: SERVICES.map((s) => ({ id: s.id, category: s.category, ...serviceEdit(s) })),
      products: PRODUCTS,
      edited: {
        site: Boolean(doc.site),
        shipping: Boolean(doc.shipping),
        home: Boolean(doc.home),
        about: Boolean(doc.about),
        services: Object.keys(doc.services ?? {}),
        products: Boolean(doc.products),
      },
      builtinImages: BUILTIN_IMAGES,
      embed: content.embed(),
    };
  };

  admin.get('/content', (_req, res) => {
    res.json(contentView());
  });

  admin.put('/content/site', (req, res) => {
    content.save('site', parse(siteSchema, req.body));
    audit(req, 'content_changed', 'Bedrijfsgegevens');
    res.json(contentView());
  });

  admin.put('/content/shipping', (req, res) => {
    content.save('shipping', parse(shippingSchema, req.body) as ShippingContent);
    audit(req, 'content_changed', 'Verzending & afhalen');
    res.json(contentView());
  });

  admin.put('/content/shop', (req, res) => {
    const shop = parse(shopSchema, req.body);
    content.save('shop', shop);
    audit(req, 'content_changed', shop.enabled ? 'Webshop aangezet' : 'Webshop uitgezet');
    res.json(contentView());
  });

  admin.put('/content/about', (req, res) => {
    content.save('about', parse(aboutSchema, req.body));
    audit(req, 'content_changed', 'Over ons');
    res.json(contentView());
  });

  admin.put('/content/home', (req, res) => {
    content.save('home', parse(homeSchema, req.body));
    audit(req, 'content_changed', 'Homepage');
    res.json(contentView());
  });

  admin.put('/content/services/:id', (req, res) => {
    const service = SERVICES.find((s) => s.id === req.params.id);
    if (!service) throw new HttpError(404, 'Deze dienst bestaat niet.');
    const services = { ...content.current().services, [service.id]: parse(serviceSchema, req.body) as ServiceEdit };
    content.save('services', services);
    audit(req, 'content_changed', `Dienst: ${services[service.id].name}`);
    res.json(contentView());
  });

  admin.delete('/content/services/:id', (req, res) => {
    const { [String(req.params.id)]: _removed, ...rest } = content.current().services ?? {};
    if (Object.keys(rest).length) content.save('services', rest);
    else content.reset('services');
    audit(req, 'content_reset', `Dienst: ${req.params.id}`);
    res.json(contentView());
  });

  admin.delete('/content/:key', (req, res) => {
    const key = String(req.params.key);
    if (!['site', 'home', 'about', 'products', 'shipping', 'email'].includes(key)) throw new HttpError(404, 'Niet gevonden');
    content.reset(key as 'site');
    audit(req, 'content_reset', key);
    res.json(contentView());
  });

  // E-mail designer.

  const emailView = () => ({
    settings: EMAIL,
    defaults: defaultContent().email,
    edited: Boolean(content.current().email),
    kinds: EMAIL_KINDS.map((id) => ({ id, ...KIND_INFO[id] })),
    templates: Object.entries(TEMPLATE_INFO).map(([id, info]) => ({ id, ...info })),
  });
  const emailRequest = z.object({ settings: z.unknown(), kind: z.enum(EMAIL_KINDS) });

  admin.get('/email', (_req, res) => {
    res.json(emailView());
  });

  admin.post('/email/preview', (req, res) => {
    const { settings: draft, kind } = parse(emailRequest, req.body);
    const mail = sampleMail(kind, parse(emailSchema, draft) as EmailSettings, config.appUrl, req.admin!.email);
    res.json({ subject: mail.subject, html: mail.html, text: mail.text });
  });

  admin.post(
    '/email/test',
    rateLimit(20, 10 * 60_000),
    asyncRoute(async (req, res) => {
      const { settings: draft, kind } = parse(emailRequest, req.body);
      if (!settings.effective().smtp) throw new HttpError(400, 'Stel eerst de e-mail in onder Betalingen & e-mail, dan kunnen we een testmail sturen.');
      const mail = sampleMail(kind, parse(emailSchema, draft) as EmailSettings, config.appUrl, req.admin!.email);
      try {
        await mailer.send({ ...mail, subject: `[Test] ${mail.subject}` });
      } catch {
        throw new HttpError(400, 'Versturen is niet gelukt. Controleer de instellingen onder Betalingen & e-mail.');
      }
      res.json({ ok: true, to: req.admin!.email });
    }),
  );

  admin.delete('/content/email', (req, res) => {
    content.reset('email');
    audit(req, 'content_reset', 'E-mails');
    res.json(emailView());
  });

  admin.put('/content/email', (req, res) => {
    content.save('email', parse(emailSchema, req.body) as EmailSettings);
    audit(req, 'content_changed', 'E-mails');
    res.json(emailView());
  });

  // Products.

  const currentProducts = (): Product[] => content.current().products ?? defaultContent().products;

  function checkProduct(product: Product, all: Product[]) {
    const others = all.filter((p) => p.id !== product.id);
    const fields: Record<string, string> = {};
    if (others.some((p) => p.slug === product.slug)) fields.slug = 'Dit webadres wordt al gebruikt door een ander product.';
    if (others.some((p) => p.sku.toLowerCase() === product.sku.toLowerCase())) fields.sku = 'Dit artikelnummer wordt al gebruikt.';
    for (const inc of product.includes ?? []) {
      const included = others.find((p) => p.id === inc.productId);
      if (!included) fields.includes = 'Een set kan alleen bestaande producten bevatten.';
      else if (included.includes?.length) fields.includes = 'Een set kan geen andere set bevatten.';
    }
    if (Object.keys(fields).length) throw new ValidationError(fields);
  }

  const cleanProduct = (p: z.infer<typeof productSchema>): Product => ({
    ...p,
    includes: p.includes?.length ? p.includes : undefined,
    badge: p.badge || undefined,
    compareAtPrice: p.compareAtPrice || undefined,
    image: p.image || undefined,
  });

  admin.post('/products', (req, res) => {
    const product = cleanProduct(parse(productSchema, req.body));
    const all = currentProducts();
    if (all.some((p) => p.id === product.id)) {
      throw new ValidationError({ slug: 'Dit webadres wordt al gebruikt door een ander product.' });
    }
    checkProduct(product, all);
    content.save('products', [...all, product]);
    audit(req, 'product_created', product.name);
    res.status(201).json(contentView());
  });

  admin.put('/products/:id', (req, res) => {
    const all = currentProducts();
    const index = all.findIndex((p) => p.id === req.params.id);
    if (index === -1) throw new HttpError(404, 'Dit product bestaat niet.');
    const product = cleanProduct(parse(productSchema, { ...req.body, id: all[index].id }));
    checkProduct(product, all);
    content.save('products', all.map((p, i) => (i === index ? product : p)));
    audit(req, 'product_changed', product.name);
    res.json(contentView());
  });

  admin.delete('/products/:id', (req, res) => {
    const all = currentProducts();
    const product = all.find((p) => p.id === req.params.id);
    if (!product) throw new HttpError(404, 'Dit product bestaat niet.');
    const inSet = all.find((p) => p.includes?.some((i) => i.productId === product.id));
    if (inSet) throw new HttpError(409, `Dit product zit in "${inSet.name}". Haal het daar eerst uit, of verberg het product.`);
    content.save('products', all.filter((p) => p.id !== product.id));
    audit(req, 'product_deleted', product.name);
    res.json(contentView());
  });

  admin.put('/products-order', (req, res) => {
    const ids = parse(z.object({ ids: z.array(z.string().max(80)).max(200) }), req.body).ids;
    const all = currentProducts();
    if (ids.length !== all.length || !all.every((p) => ids.includes(p.id))) {
      throw new HttpError(400, 'De volgorde klopt niet. Vernieuw de pagina.');
    }
    content.save('products', ids.map((id) => all.find((p) => p.id === id)!));
    res.json(contentView());
  });

  // Blog.

  admin.get('/posts', (_req, res) => {
    res.json(listAllPosts(db));
  });

  admin.get('/posts/:id', (req, res) => {
    const post = getPost(db, Number(req.params.id));
    if (!post) throw new HttpError(404, 'Dit bericht bestaat niet.');
    res.json(post);
  });

  admin.post('/posts', (req, res) => {
    const input = parse(postSchema, req.body);
    if (slugTaken(db, input.slug)) throw new ValidationError({ slug: 'Dit webadres wordt al gebruikt door een ander bericht.' });
    const post = createPost(db, input);
    audit(req, 'post_created', post.title);
    res.status(201).json(post);
  });

  admin.put('/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!getPost(db, id)) throw new HttpError(404, 'Dit bericht bestaat niet.');
    const input = parse(postSchema, req.body);
    if (slugTaken(db, input.slug, id)) throw new ValidationError({ slug: 'Dit webadres wordt al gebruikt door een ander bericht.' });
    const post = updatePost(db, id, input)!;
    audit(req, 'post_changed', post.title);
    res.json(post);
  });

  admin.delete('/posts/:id', (req, res) => {
    const post = getPost(db, Number(req.params.id));
    if (!post || !deletePost(db, post.id)) throw new HttpError(404, 'Dit bericht bestaat niet.');
    audit(req, 'post_deleted', post.title);
    res.json({ ok: true });
  });

  // Team.

  admin.get('/team', (_req, res) => {
    res.json(listTeam(db));
  });

  admin.get('/team/:id', (req, res) => {
    const member = getTeamMember(db, Number(req.params.id));
    if (!member) throw new HttpError(404, 'Dit teamlid bestaat niet.');
    res.json(member);
  });

  admin.post('/team', (req, res) => {
    const member = createTeamMember(db, parse(teamMemberSchema, req.body));
    audit(req, 'team_member_created', member.name);
    res.status(201).json(member);
  });

  admin.put('/team-order', (req, res) => {
    const ids = parse(z.object({ ids: z.array(z.number().int()).max(100) }), req.body).ids;
    if (!reorderTeam(db, ids)) throw new HttpError(400, 'De volgorde klopt niet. Vernieuw de pagina.');
    res.json(listTeam(db));
  });

  admin.put('/team/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!getTeamMember(db, id)) throw new HttpError(404, 'Dit teamlid bestaat niet.');
    const member = updateTeamMember(db, id, parse(teamMemberSchema, req.body))!;
    audit(req, 'team_member_changed', member.name);
    res.json(member);
  });

  admin.delete('/team/:id', (req, res) => {
    const member = getTeamMember(db, Number(req.params.id));
    if (!member || !deleteTeamMember(db, member.id)) throw new HttpError(404, 'Dit teamlid bestaat niet.');
    audit(req, 'team_member_deleted', member.name);
    res.json({ ok: true });
  });

  // Media library.

  const mediaInput = z.object({
    name: z.string().trim().min(1).max(120),
    alt: z.string().trim().max(200),
    large: z.string().max(6_000_000),
    small: z.string().max(1_500_000),
  });
  const mediaMeta = z.object({
    name: z.string().trim().min(1, 'Geef de afbeelding een naam').max(120),
    alt: z.string().trim().max(200),
  });

  admin.get('/media', (_req, res) => {
    res.json(media.list());
  });

  admin.post('/media', rateLimit(120, 10 * 60_000), (req, res) => {
    const input = parse(mediaInput, req.body);
    const decode = (b64: string) => Buffer.from(b64.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    let item;
    try {
      item = media.add({ name: input.name, alt: input.alt, large: decode(input.large), small: decode(input.small) });
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Uploaden is niet gelukt.');
    }
    audit(req, 'media_uploaded', item.name);
    res.status(201).json(item);
  });

  admin.patch('/media/:id', (req, res) => {
    const item = media.update(String(req.params.id), parse(mediaMeta, req.body));
    if (!item) throw new HttpError(404, 'Deze afbeelding bestaat niet.');
    res.json(item);
  });

  admin.delete('/media/:id', (req, res) => {
    const id = String(req.params.id);
    const item = media.get(id);
    if (!item) throw new HttpError(404, 'Deze afbeelding bestaat niet.');
    const usage = media.usage(id);
    if (usage.length && req.query.force !== '1') {
      res.status(409).json({ error: `Deze afbeelding wordt nog gebruikt: ${usage.join(', ')}.`, usage });
      return;
    }
    media.remove(id);
    audit(req, 'media_deleted', item.name);
    res.json({ ok: true });
  });

  api.use('/admin', admin);

  // --- Development payment page -----------------------------------------

  if (!config.production) {
    const mock = () => {
      const payments = getPayments();
      return payments instanceof MockProvider ? payments : undefined;
    };
    api.get('/dev/mock-checkout/:id', (req, res) => {
      const id = String(req.params.id);
      if (!mock()?.payments.has(id)) {
        res.status(404).send('Onbekende betaling');
        return;
      }
      res.type('html').send(mockCheckoutPage(id));
    });
    api.post('/dev/mock-checkout/:id', (req, res) => {
      const status = req.body?.status === 'paid' ? 'paid' : 'failed';
      const payment = mock()?.settle(String(req.params.id), status);
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
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message, fields: err.fields });
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

  // Uploaded images: fixed names, served as JPEG only, cacheable forever (ids never change).
  app.get('/media/:file', (req, res) => {
    const match = /^(m_[a-z0-9]{16})(-sm)?\.jpg$/.exec(String(req.params.file));
    const file = match && MEDIA_ID.test(match[1]) ? path.join(media.dir, match[0]) : undefined;
    if (!file || !fs.existsSync(file)) {
      res.status(404).type('text/plain').send('Niet gevonden');
      return;
    }
    res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'" });
    res.type('image/jpeg').sendFile(path.resolve(file), (err) => {
      if (err && !res.headersSent) {
        console.error('[media]', err.message);
        res.status(404).type('text/plain').send('Niet gevonden');
      }
    });
  });

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nDisallow: /admin\nDisallow: /bestelling/\nDisallow: /afrekenen\n\nSitemap: ${config.appUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    const paths = [
      '/',
      '/diensten',
      '/over-ons',
      ...listedServices().map((s) => `/diensten/${s.id}`),
      ...(SHOP.enabled ? ['/shop', ...listedProducts().map((p) => `/shop/${p.slug}`)] : []),
      '/blog',
      ...listPublishedPosts(db).map((p) => `/blog/${p.slug}`),
      '/team',
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
