import crypto from 'node:crypto';
import type { Db } from './db';
import type { Country, Totals } from '../shared/pricing';
import type { PaymentStatus } from './payments';

export type OrderStatus = 'open' | 'paid' | 'failed' | 'shipped' | 'cancelled';

export type Customer = {
  email: string;
  name: string;
  phone?: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: Country;
  notes?: string;
};

export type OrderRow = {
  id: number;
  public_id: string;
  number: string;
  status: OrderStatus;
  email: string;
  name: string;
  phone: string | null;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: Country;
  notes: string | null;
  subtotal: number;
  shipping: number;
  vat: number;
  total: number;
  payment_id: string | null;
  payment_method: string | null;
  tracking_code: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
};

export type OrderItemRow = {
  product_id: string;
  sku: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type Order = OrderRow & { items: OrderItemRow[] };

export function createOrder(db: Db, customer: Customer, totals: Totals): Order {
  const publicId = crypto.randomBytes(16).toString('base64url');
  const insert = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (public_id, email, name, phone, street, house_number, postal_code, city, country, notes,
          subtotal, shipping, vat, total)
         VALUES (@publicId, @email, @name, @phone, @street, @houseNumber, @postalCode, @city, @country, @notes,
          @subtotal, @shipping, @vat, @total)`,
      )
      .run({
        publicId,
        ...customer,
        phone: customer.phone || null,
        notes: customer.notes || null,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        vat: totals.vat,
        total: totals.total,
      });
    const id = Number(lastInsertRowid);
    db.prepare('UPDATE orders SET number = ? WHERE id = ?').run(orderNumber(id), id);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, sku, name, unit_price, quantity, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of totals.lines) {
      insertItem.run(id, line.product.id, line.product.sku, line.product.name, line.unitPrice, line.quantity, line.lineTotal);
    }
    return id;
  });
  return getOrderById(db, insert())!;
}

export function orderNumber(id: number) {
  return `LU-${String(1000 + id)}`;
}

function withItems(db: Db, row: OrderRow | undefined): Order | undefined {
  if (!row) return undefined;
  const items = db
    .prepare('SELECT product_id, sku, name, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id')
    .all(row.id) as OrderItemRow[];
  return { ...row, items };
}

export function getOrderById(db: Db, id: number) {
  return withItems(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined);
}

export function getOrderByPublicId(db: Db, publicId: string) {
  return withItems(db, db.prepare('SELECT * FROM orders WHERE public_id = ?').get(publicId) as OrderRow | undefined);
}

export function getOrderByPaymentId(db: Db, paymentId: string) {
  return withItems(db, db.prepare('SELECT * FROM orders WHERE payment_id = ?').get(paymentId) as OrderRow | undefined);
}

export function setPaymentId(db: Db, orderId: number, paymentId: string) {
  db.prepare('UPDATE orders SET payment_id = ? WHERE id = ?').run(paymentId, orderId);
}

/**
 * Applies a payment status to an order. Returns true when the order became
 * paid by this call, so callers send the confirmation mail exactly once.
 * A payment that arrives after an admin cancelled the order still marks it
 * paid: the money was received, so the order must show up for handling.
 */
export function applyPaymentStatus(db: Db, orderId: number, status: PaymentStatus, method?: string): boolean {
  if (status === 'paid') {
    const result = db
      .prepare(
        `UPDATE orders SET status = 'paid', paid_at = datetime('now'), payment_method = ?
         WHERE id = ? AND status IN ('open', 'failed', 'cancelled')`,
      )
      .run(method ?? null, orderId);
    return result.changes === 1;
  }
  if (status === 'failed') {
    db.prepare(`UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'open'`).run(orderId);
  }
  return false;
}

export function listOrders(db: Db, limit = 200): Order[] {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT ?').all(limit) as OrderRow[];
  return rows.map((row) => withItems(db, row)!);
}

export function markShipped(db: Db, id: number, trackingCode: string | null) {
  return (
    db
      .prepare(
        `UPDATE orders SET status = 'shipped', shipped_at = datetime('now'), tracking_code = ?
         WHERE id = ? AND status = 'paid'`,
      )
      .run(trackingCode, id).changes === 1
  );
}

export function cancelOrder(db: Db, id: number) {
  return db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ? AND status IN ('open', 'failed')`).run(id).changes === 1;
}

/** What the customer-facing order page is allowed to see. */
export function publicOrder(order: Order) {
  return {
    number: order.number,
    status: order.status,
    name: order.name,
    email: order.email,
    address: {
      street: order.street,
      houseNumber: order.house_number,
      postalCode: order.postal_code,
      city: order.city,
      country: order.country,
    },
    items: order.items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, lineTotal: i.line_total })),
    subtotal: order.subtotal,
    shipping: order.shipping,
    vat: order.vat,
    total: order.total,
    trackingCode: order.tracking_code,
    createdAt: order.created_at,
  };
}

export type PublicOrder = ReturnType<typeof publicOrder>;
