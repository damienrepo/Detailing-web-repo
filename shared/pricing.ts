import { getProduct, type Product } from './catalog';

// Shipping rules. Amounts in euro cents, including BTW.
export const SHIPPING = {
  NL: { label: 'Nederland', cost: 495, freeFrom: 4000 },
  BE: { label: 'België', cost: 795, freeFrom: 6000 },
} as const;

export type Country = keyof typeof SHIPPING;
export const COUNTRIES = Object.keys(SHIPPING) as Country[];

export const VAT_RATE = 0.21;
export const MAX_QUANTITY_PER_LINE = 20;

export type CartItem = { productId: string; quantity: number };

export type PricedLine = {
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Totals = {
  lines: PricedLine[];
  subtotal: number;
  shipping: number;
  total: number;
  /** BTW included in the total. */
  vat: number;
  /** Cents still needed for free shipping, 0 if already free. */
  freeShippingRemaining: number;
};

export class PricingError extends Error {}

export function isCountry(value: unknown): value is Country {
  return typeof value === 'string' && value in SHIPPING;
}

export function priceCart(items: CartItem[], country: Country = 'NL'): Totals {
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new PricingError(`Ongeldig aantal voor ${item.productId}`);
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  const lines: PricedLine[] = [];
  for (const [productId, quantity] of merged) {
    const product = getProduct(productId);
    if (!product) throw new PricingError(`Onbekend product: ${productId}`);
    if (!product.inStock) throw new PricingError(`${product.name} is uitverkocht`);
    if (quantity > MAX_QUANTITY_PER_LINE) {
      throw new PricingError(`Maximaal ${MAX_QUANTITY_PER_LINE} stuks per product`);
    }
    lines.push({ product, quantity, unitPrice: product.price, lineTotal: product.price * quantity });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const rule = SHIPPING[country];
  const freeShippingRemaining = Math.max(0, rule.freeFrom - subtotal);
  const shipping = lines.length === 0 || freeShippingRemaining === 0 ? 0 : rule.cost;
  const total = subtotal + shipping;
  const vat = total - Math.round(total / (1 + VAT_RATE));

  return { lines, subtotal, shipping, total, vat, freeShippingRemaining };
}

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

export function formatPrice(cents: number): string {
  return euro.format(cents / 100);
}

/** Mollie expects amounts as strings with two decimals, e.g. "29.95". */
export function toMollieAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
