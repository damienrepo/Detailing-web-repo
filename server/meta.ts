// Meta Conversions API: the Purchase event, sent from the server once an order is paid, for customers who
// accepted marketing cookies. The thank-you page sends the same Purchase from the browser with the same
// event_id (the order number), so Meta counts it once.
import crypto from 'node:crypto';
import type { Request } from 'express';
import type { Db } from './db';
import { getOrderById, type Order, type OrderTracking } from './orders';

/** Graph API version, see https://developers.facebook.com/docs/graph-api/changelog/versions/ */
export const META_GRAPH_VERSION = 'v26.0';
export const CONSENT_COOKIE = 'd2g_consent';
const MAX_ATTEMPTS = 5;
/** Meta rejects events older than 7 days. */
const MAX_AGE_MS = 7 * 24 * 3600_000;
/** A send that has not finished after this long is considered lost and may be retried. */
const CLAIM_TTL_S = 120;
const PAID_STATUSES = ['paid', 'shipped', 'ready', 'collected'];
const CALLING_CODES: Record<string, string> = { NL: '31', BE: '32' };

export type MetaConfig = { pixelId?: string; accessToken?: string; testEventCode?: string };

export const sha256 = (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

export function readCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* skip a malformed cookie */
    }
  }
  return out;
}

/** What to store with a new order: cookies and connection details, only with marketing consent. */
export function trackingFromRequest(req: Request, appUrl: string): OrderTracking {
  const cookies = readCookies(req.get('cookie'));
  if (cookies[CONSENT_COOKIE] !== 'granted') return { consent: false };
  const valid = (v: string | undefined, pattern: RegExp) => (v && v.length <= 500 && pattern.test(v) ? v : undefined);
  return {
    consent: true,
    fbp: valid(cookies._fbp, /^fb\.\d\.\d+\.\d+$/),
    fbc: valid(cookies._fbc, /^fb\.\d\.\d+\.[\w-]+$/),
    // `trust proxy` is set, so this is the visitor's address from X-Forwarded-For, not the proxy's.
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 500),
    url: `${appUrl}/afrekenen`,
  };
}

/** Digits only, with country code: "06 12 34 56 78" in NL → "31612345678". */
export function normalizePhone(phone: string, country: string): string {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  const code = CALLING_CODES[country.toUpperCase()];
  if (!code) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.startsWith(code) && digits.length > 9 ? digits : code + digits;
}

const paidAtMs = (order: Order) => (order.paid_at ? Date.parse(`${order.paid_at.replace(' ', 'T')}Z`) : Date.now());

/** The Conversions API request body for a paid order. Empty values are left out, never hashed. */
export function purchasePayload(order: Order, testEventCode?: string) {
  const hashed = (value: string | null | undefined) => (value ? [sha256(value)] : undefined);
  const [first, ...rest] = order.name.trim().toLowerCase().split(/\s+/);
  const phone = order.phone ? normalizePhone(order.phone, order.country) : '';
  const userData = {
    em: hashed(order.email.trim().toLowerCase()),
    ph: hashed(phone),
    fn: hashed(first),
    ln: hashed(rest.join(' ')),
    ct: hashed(order.city.toLowerCase().replace(/\s+/g, '')),
    zp: hashed(order.postal_code.toLowerCase().replace(/\s+/g, '')),
    country: hashed(order.country.toLowerCase()),
    external_id: hashed(order.number),
    client_ip_address: order.client_ip || undefined,
    client_user_agent: order.client_user_agent || undefined,
    fbp: order.fbp || undefined,
    fbc: order.fbc || undefined,
  };
  return {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(paidAtMs(order) / 1000),
        event_id: order.number,
        action_source: 'website',
        ...(order.event_source_url ? { event_source_url: order.event_source_url } : {}),
        user_data: Object.fromEntries(Object.entries(userData).filter(([, v]) => v !== undefined)),
        custom_data: {
          currency: 'EUR',
          // Products incl. VAT, without shipping.
          value: order.subtotal / 100,
          content_type: 'product',
          content_ids: [...new Set(order.items.map((i) => i.product_id))],
          contents: order.items.map((i) => ({ id: i.product_id, quantity: i.quantity, item_price: i.unit_price / 100 })),
          num_items: order.items.reduce((n, i) => n + i.quantity, 0),
          order_id: order.number,
        },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

/**
 * Sends the Purchase for a paid order, once. Never throws: a problem with Meta must not affect the
 * payment flow. A database claim makes concurrent calls (two webhooks, webhook + thank-you page) send once.
 */
export async function sendMetaPurchase(db: Db, orderId: number, cfg: MetaConfig, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!cfg.pixelId || !cfg.accessToken) return;
  const order = getOrderById(db, orderId);
  if (!order || !order.marketing_consent || order.meta_purchase_sent_at || !PAID_STATUSES.includes(order.status)) return;
  if (order.meta_attempts >= MAX_ATTEMPTS || Date.now() - paidAtMs(order) > MAX_AGE_MS) return;

  const now = Math.floor(Date.now() / 1000);
  const claimed = db
    .prepare(
      `UPDATE orders SET meta_claimed_at = ?, meta_attempts = meta_attempts + 1
       WHERE id = ? AND meta_purchase_sent_at IS NULL AND (meta_claimed_at IS NULL OR meta_claimed_at < ?)`,
    )
    .run(now, orderId, now - CLAIM_TTL_S).changes;
  if (!claimed) return;

  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.accessToken)}`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchasePayload(order, cfg.testEventCode)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    db.prepare(`UPDATE orders SET meta_purchase_sent_at = datetime('now'), meta_claimed_at = NULL, meta_last_error = NULL WHERE id = ?`).run(orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[meta] Purchase voor ${order.number} niet verstuurd:`, message);
    db.prepare('UPDATE orders SET meta_claimed_at = NULL, meta_last_error = ? WHERE id = ?').run(message.slice(0, 500), orderId);
  }
}

/** Retries paid orders whose Purchase has not reached Meta yet (run every few minutes). */
export async function retryMetaPurchases(db: Db, cfg: MetaConfig, fetchImpl: typeof fetch = fetch) {
  if (!cfg.pixelId || !cfg.accessToken) return;
  const ids = db
    .prepare(
      `SELECT id FROM orders WHERE marketing_consent = 1 AND meta_purchase_sent_at IS NULL AND meta_attempts < ?
       AND status IN ('paid', 'shipped', 'ready', 'collected') AND paid_at > datetime('now', '-7 days')`,
    )
    .all(MAX_ATTEMPTS) as { id: number }[];
  for (const { id } of ids) await sendMetaPurchase(db, id, cfg, fetchImpl);
}
