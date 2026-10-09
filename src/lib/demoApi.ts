// In-browser stand-in for the Express API, used only by the demo build.
// Mirrors the server's routes closely enough to click through every flow; data lives in
// this browser's localStorage. Nothing is ordered, paid or e-mailed.
import { assertShippingAvailable, priceCart, PricingError } from '../../shared/pricing';
import { bookingSchema, bookingStatusSchema, checkoutSchema, fieldErrors, shipSchema } from '../../shared/validation';
import type { Order, OrderStatus, PublicOrder } from '../../server/orders';
import { PRODUCTS } from '../../shared/catalog';
import { ABOUT, SHOP, BUILTIN_IMAGES, HOME, serviceEdit, shippingEdit, siteEdit } from '../../shared/content';
import { SERVICES } from '../../shared/services';
import { SITE } from '../../shared/site';
import { ApiError } from './api';

type Booking = { id: number; status: string; created_at: string; [key: string]: unknown };
type State = { orders: (Order & { payment: 'open' | 'paid' | 'failed' })[]; bookings: Booking[] };

const KEY = 'detail2go.demo.v1';
let memory: State = { orders: [], bookings: [] };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {
    // Storage unavailable: keep the in-memory copy.
  }
  return memory;
}

function save(state: State) {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the demo still works until the page is reloaded.
  }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function toPublic(o: Order): PublicOrder {
  return {
    number: o.number,
    status: o.status,
    shippingMethod: o.shipping_method,
    name: o.name,
    email: o.email,
    address: { street: o.street, houseNumber: o.house_number, postalCode: o.postal_code, city: o.city, country: o.country },
    items: o.items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, lineTotal: i.line_total })),
    subtotal: o.subtotal,
    shipping: o.shipping,
    vat: o.vat,
    total: o.total,
    trackingCode: o.tracking_code,
    createdAt: o.created_at,
  };
}

function findOrder(state: State, publicId: string) {
  const order = state.orders.find((o) => o.public_id === publicId);
  if (!order) throw new ApiError('Bestelling niet gevonden', 404);
  return order;
}

function setStatus(order: State['orders'][number], status: OrderStatus) {
  order.status = status;
  if (status === 'paid') {
    order.paid_at = now();
    order.payment_method = 'ideal';
  }
}

export async function demoApi<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  // A short delay so loading states behave like they do against the real server.
  await new Promise((r) => setTimeout(r, 250));
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const state = load();
  let m: RegExpMatchArray | null;

  if (path === '/config') return { payments: 'mock' } as T;

  if (path === '/orders' && method === 'POST') {
    const parsed = checkoutSchema.safeParse(options.body);
    if (!parsed.success) throw new ApiError('Controleer de ingevulde gegevens.', 400, fieldErrors(parsed.error));
    let totals;
    try {
      assertShippingAvailable(parsed.data.shippingMethod, parsed.data.customer.country);
      totals = priceCart(parsed.data.items, parsed.data.customer.country, parsed.data.shippingMethod);
    } catch (err) {
      throw new ApiError(err instanceof PricingError ? err.message : 'Er ging iets mis.', 400);
    }
    const c = parsed.data.customer;
    const id = (state.orders.at(-1)?.id ?? 0) + 1;
    const publicId = crypto.randomUUID().replace(/-/g, '');
    state.orders.push({
      id,
      public_id: publicId,
      number: `D2G-${1000 + id}`,
      status: 'open',
      shipping_method: parsed.data.shippingMethod,
      payment: 'open',
      email: c.email,
      name: c.name,
      phone: c.phone ?? null,
      street: c.street,
      house_number: c.houseNumber,
      postal_code: c.postalCode.toUpperCase(),
      city: c.city,
      country: c.country,
      notes: c.notes ?? null,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      vat: totals.vat,
      total: totals.total,
      payment_id: `tr_demo_${id}`,
      payment_method: null,
      tracking_code: null,
      created_at: now(),
      paid_at: null,
      shipped_at: null,
      ready_at: null,
      collected_at: null,
      items: totals.lines.map((l) => ({
        product_id: l.product.id,
        sku: l.product.sku,
        name: l.product.name,
        unit_price: l.unitPrice,
        quantity: l.quantity,
        line_total: l.lineTotal,
      })),
    });
    save(state);
    return { checkoutUrl: `/demo-betaling/${publicId}`, orderId: publicId } as T;
  }

  if ((m = path.match(/^\/orders\/([\w-]+)$/)) && method === 'GET') {
    return toPublic(findOrder(state, decodeURIComponent(m[1]))) as T;
  }

  if ((m = path.match(/^\/orders\/([\w-]+)\/pay$/))) {
    const order = findOrder(state, decodeURIComponent(m[1]));
    if (order.status !== 'open' && order.status !== 'failed') throw new ApiError('Deze bestelling is al betaald', 409);
    setStatus(order, 'open');
    save(state);
    return { checkoutUrl: `/demo-betaling/${order.public_id}` } as T;
  }

  // Used by the demo payment page in place of Mollie.
  if ((m = path.match(/^\/demo\/pay\/([\w-]+)$/))) {
    const order = findOrder(state, decodeURIComponent(m[1]));
    const paid = (options.body as { status?: string })?.status === 'paid';
    if (order.status === 'open') setStatus(order, paid ? 'paid' : 'failed');
    save(state);
    return { ok: true } as T;
  }

  if (path === '/bookings' && method === 'POST') {
    const parsed = bookingSchema.safeParse(options.body);
    if (!parsed.success) throw new ApiError('Controleer de ingevulde gegevens.', 400, fieldErrors(parsed.error));
    const { website: _honeypot, ...b } = parsed.data;
    state.bookings.unshift({
      id: (state.bookings[0]?.id ?? 0) + 1,
      status: 'new',
      service_id: b.serviceId,
      vehicle: b.vehicle,
      preferred_date: b.preferredDate ?? null,
      name: b.name,
      email: b.email,
      phone: b.phone,
      postal_code: b.postalCode ?? null,
      message: b.message ?? null,
      created_at: now(),
    });
    save(state);
    return { ok: true } as T;
  }

  if (path === '/admin/orders') return [...state.orders].reverse() as T;
  if (path === '/admin/bookings') return state.bookings as T;

  if ((m = path.match(/^\/admin\/orders\/(\d+)\/(ship|cancel|ready|collected)$/))) {
    const order = state.orders.find((o) => o.id === Number(m![1]));
    if (!order) throw new ApiError('Niet gevonden', 404);
    if (m[2] === 'ready' || m[2] === 'collected') {
      if (order.shipping_method !== 'pickup' || !['paid', 'ready'].includes(order.status)) throw new ApiError('Dat kan niet bij deze bestelling', 409);
      order.status = m[2];
      if (m[2] === 'ready') order.ready_at = now();
      else order.collected_at = now();
    } else if (m[2] === 'ship') {
      if (order.status !== 'paid') throw new ApiError('Alleen betaalde bestellingen kunnen als verzonden worden gemarkeerd', 409);
      order.status = 'shipped';
      order.shipped_at = now();
      order.tracking_code = shipSchema.parse(options.body ?? {}).trackingCode ?? null;
    } else {
      if (order.status !== 'open' && order.status !== 'failed') throw new ApiError('Alleen onbetaalde bestellingen kunnen worden geannuleerd', 409);
      order.status = 'cancelled';
    }
    save(state);
    return order as T;
  }

  if ((m = path.match(/^\/admin\/bookings\/(\d+)\/status$/))) {
    const booking = state.bookings.find((b) => b.id === Number(m![1]));
    const parsed = bookingStatusSchema.safeParse(options.body);
    if (!booking || !parsed.success) throw new ApiError('Ongeldige status', 400);
    booking.status = parsed.data.status;
    save(state);
    return booking as T;
  }

  // --- Admin in the demo: browse everything, save nothing. -------------------------------
  if (path === '/posts' || path.startsWith('/posts?') || path === '/team') return [] as T;
  if (path === '/admin/session') return (demoSignedIn ? { state: 'ok', user: DEMO_USER } : { state: 'login' }) as T;
  if (path === '/admin/login') {
    demoSignedIn = true;
    return { state: 'ok', user: DEMO_USER } as T;
  }
  if (path === '/admin/logout') {
    demoSignedIn = false;
    return { ok: true } as T;
  }
  if (path === '/admin/account') return { user: DEMO_USER, sessions: [{ current: true, createdAt: now(), lastSeenAt: now(), ip: null, device: 'Deze browser' }], audit: [] } as T;
  if (path === '/admin/settings') {
    const field = { set: false, fromEnv: false };
    const keys = ['mollieApiKey', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass', 'mailFrom', 'notifyEmail'];
    return { values: Object.fromEntries(keys.map((k) => [k, field])), payments: 'mock', webhooks: false } as T;
  }
  if (path === '/admin/content' && method === 'GET') {
    return {
      site: siteEdit(SITE),
      shipping: shippingEdit(),
      home: HOME,
      about: ABOUT,
      shop: SHOP,
      services: SERVICES.map((sv) => ({ id: sv.id, category: sv.category, ...serviceEdit(sv) })),
      products: PRODUCTS,
      edited: { site: false, shipping: false, home: false, about: false, services: [], products: false },
      builtinImages: BUILTIN_IMAGES,
      embed: '{}',
    } as T;
  }
  if (path === '/admin/posts' || path === '/admin/media' || path === '/admin/team') return [] as T;
  if (path === '/admin/email') {
    const { EMAIL, EMAIL_KINDS, KIND_INFO, TEMPLATE_INFO } = await import('../../shared/email');
    return {
      settings: EMAIL,
      defaults: EMAIL,
      edited: false,
      kinds: EMAIL_KINDS.map((id) => ({ id, ...KIND_INFO[id] })),
      templates: Object.entries(TEMPLATE_INFO).map(([id, info]) => ({ id, ...info })),
    } as T;
  }
  if (path === '/admin/email/preview') {
    const { sampleMail } = await import('../../server/emails');
    const body = options.body as { settings: import('../../shared/email').EmailSettings; kind: import('../../shared/email').EmailKind };
    const mail = sampleMail(body.kind, body.settings, location.origin, 'demo@detail2go.nl');
    return { subject: mail.subject, html: mail.html, text: mail.text } as T;
  }
  if (path.startsWith('/admin/')) throw new ApiError('Dit is een demo: wijzigingen worden niet opgeslagen.', 400);

  throw new ApiError('Niet gevonden', 404);
}

let demoSignedIn = false;
const DEMO_USER = { id: 1, email: 'demo@detail2go.nl', name: 'Demo', totpEnabled: false };
