import { describe, expect, it } from 'vitest';
import { PRODUCTS, getProduct } from './catalog';
import { formatPrice, priceCart, PricingError, SHIPPING, toMollieAmount } from './pricing';

describe('priceCart', () => {
  it('charges shipping below the free shipping threshold', () => {
    const totals = priceCart([{ productId: 'microfiber-towel', quantity: 1 }], 'NL');
    expect(totals.subtotal).toBe(795);
    expect(totals.shipping).toBe(SHIPPING.NL.cost);
    expect(totals.total).toBe(795 + SHIPPING.NL.cost);
    expect(totals.freeShippingRemaining).toBe(SHIPPING.NL.freeFrom - 795);
  });

  it('ships for free from the threshold', () => {
    const totals = priceCart([{ productId: 'interior-kit', quantity: 2 }], 'NL');
    expect(totals.subtotal).toBe(5990);
    expect(totals.shipping).toBe(0);
    expect(totals.freeShippingRemaining).toBe(0);
  });

  it('uses the shipping rules of the destination country', () => {
    const totals = priceCart([{ productId: 'interior-kit', quantity: 2 }], 'BE');
    expect(totals.shipping).toBe(SHIPPING.BE.cost);
  });

  it('merges duplicate lines and computes included VAT', () => {
    const totals = priceCart(
      [
        { productId: 'interior-cleaner', quantity: 1 },
        { productId: 'interior-cleaner', quantity: 2 },
      ],
      'NL',
    );
    expect(totals.lines).toHaveLength(1);
    expect(totals.lines[0].quantity).toBe(3);
    expect(totals.total).toBe(5085);
    expect(totals.vat).toBe(5085 - Math.round(5085 / 1.21));
  });

  it('rejects unknown products and invalid quantities', () => {
    expect(() => priceCart([{ productId: 'nope', quantity: 1 }])).toThrow(PricingError);
    expect(() => priceCart([{ productId: 'interior-cleaner', quantity: 0 }])).toThrow(PricingError);
    expect(() => priceCart([{ productId: 'interior-cleaner', quantity: 1.5 }])).toThrow(PricingError);
    expect(() => priceCart([{ productId: 'interior-cleaner', quantity: 21 }])).toThrow(PricingError);
  });

  it('has no shipping cost for an empty cart', () => {
    expect(priceCart([]).total).toBe(0);
  });
});

describe('catalog', () => {
  it('prices the bundle below its separate items', () => {
    const kit = getProduct('interior-kit')!;
    const separate = kit.includes!.reduce((sum, i) => sum + getProduct(i.productId)!.price * i.quantity, 0);
    expect(kit.compareAtPrice).toBe(separate);
    expect(kit.price).toBeLessThan(separate);
    expect(kit.badge).toContain(formatPrice(separate - kit.price).replace('€', '').trim());
  });

  it('has unique ids, slugs and SKUs', () => {
    for (const key of ['id', 'slug', 'sku'] as const) {
      expect(new Set(PRODUCTS.map((p) => p[key])).size).toBe(PRODUCTS.length);
    }
  });
});

describe('formatting', () => {
  it('formats euro amounts', () => {
    expect(formatPrice(2995)).toMatch(/€\s?29,95/);
    expect(toMollieAmount(2995)).toBe('29.95');
    expect(toMollieAmount(500)).toBe('5.00');
  });
});
