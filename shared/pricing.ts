import { getProduct, type Product } from './catalog';
import { formatAddress, SITE } from './site';

// Shipping and pickup rules. Editable in the admin (Verzending & afhalen); these are the defaults.
// Amounts in euro cents, including BTW.

export type ShippingMethod = 'delivery' | 'pickup';
export const SHIPPING_METHODS: ShippingMethod[] = ['delivery', 'pickup'];

export type CountryRate = {
  label: string;
  enabled: boolean;
  cost: number;
  /** Free from this order amount; null means never free. */
  freeFrom: number | null;
};

export const SHIPPING: { NL: CountryRate; BE: CountryRate } = {
  NL: { label: 'Nederland', enabled: true, cost: 495, freeFrom: 4000 },
  BE: { label: 'België', enabled: true, cost: 795, freeFrom: 6000 },
};

export type Country = keyof typeof SHIPPING;
export const COUNTRIES = Object.keys(SHIPPING) as Country[];

/** Delivery by post as a whole; the countries can also be switched off one by one. */
export const DELIVERY = { enabled: true };

export type PickupOption = {
  enabled: boolean;
  cost: number;
  /** Where to collect; empty means the business address. */
  location: string;
  /** E.g. "Meestal binnen 1 werkdag". */
  readyTime: string;
  instructions: string;
};

export const PICKUP: PickupOption = {
  enabled: true,
  cost: 0,
  location: '',
  readyTime: 'Meestal binnen 1 werkdag',
  instructions: 'Je krijgt een e-mail zodra je bestelling klaarligt. Laat even weten wanneer je langskomt, dan zorgen we dat er iemand is.',
};

export function pickupLocation(): string {
  return PICKUP.location.trim() || formatAddress() || SITE.address.city;
}

/** Countries that can be chosen for delivery right now. */
export function deliveryCountries(): Country[] {
  return DELIVERY.enabled ? COUNTRIES.filter((c) => SHIPPING[c].enabled) : [];
}

export function availableMethods(): ShippingMethod[] {
  return SHIPPING_METHODS.filter((m) => (m === 'pickup' ? PICKUP.enabled : deliveryCountries().length > 0));
}

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
  /** Cents still needed for free shipping, 0 if already free (or never free). */
  freeShippingRemaining: number;
};

export class PricingError extends Error {}

export function isCountry(value: unknown): value is Country {
  return typeof value === 'string' && value in SHIPPING;
}

/** Throws when the chosen way of delivery is switched off in the admin. */
export function assertShippingAvailable(method: ShippingMethod, country: Country) {
  if (method === 'pickup') {
    if (!PICKUP.enabled) throw new PricingError('Afhalen is op dit moment niet mogelijk. Kies voor bezorgen.');
    return;
  }
  if (!DELIVERY.enabled) throw new PricingError('Bezorgen is op dit moment niet mogelijk. Kies voor afhalen.');
  if (!SHIPPING[country].enabled) throw new PricingError(`We bezorgen op dit moment niet in ${SHIPPING[country].label}.`);
}

export function priceCart(items: CartItem[], country: Country = 'NL', method: ShippingMethod = 'delivery'): Totals {
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
  let shipping = 0;
  let freeShippingRemaining = 0;
  if (lines.length > 0) {
    if (method === 'pickup') {
      shipping = PICKUP.cost;
    } else {
      const rule = SHIPPING[country];
      freeShippingRemaining = rule.freeFrom === null ? 0 : Math.max(0, rule.freeFrom - subtotal);
      shipping = rule.freeFrom !== null && freeShippingRemaining === 0 ? 0 : rule.cost;
    }
  }
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
