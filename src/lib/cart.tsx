import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BUNDLE_ID, getProduct, type ProductId } from '../../shared/catalog';
import { MAX_QUANTITY_PER_LINE, priceCart, type CartItem, type Country, type Totals } from '../../shared/pricing';

const STORAGE_KEY = 'lumen.cart.v1';

type CartContextValue = {
  items: CartItem[];
  count: number;
  totals: Totals;
  country: Country;
  setCountry: (country: Country) => void;
  add: (productId: ProductId, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Replaces one each of the separate kit items with the kit itself. */
  swapForBundle: () => void;
  bundleSwapAvailable: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function load(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (i): i is CartItem =>
        typeof i?.productId === 'string' &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        getProduct(i.productId)?.inStock === true,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);
  const [country, setCountry] = useState<Country>('NL');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage can be unavailable (private mode); the cart then lives in memory only.
    }
  }, [items]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((i) => i.productId !== productId)
        : current.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.min(quantity, MAX_QUANTITY_PER_LINE) } : i,
          ),
    );
  }, []);

  const add = useCallback((productId: ProductId, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.productId === productId);
      if (existing) {
        return current.map((i) =>
          i.productId === productId ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_QUANTITY_PER_LINE) } : i,
        );
      }
      return [...current, { productId, quantity }];
    });
    setIsOpen(true);
  }, []);

  const bundle = getProduct(BUNDLE_ID)!;
  const bundleSwapAvailable = bundle.includes!.every((inc) =>
    items.some((i) => i.productId === inc.productId && i.quantity >= inc.quantity),
  );

  const swapForBundle = useCallback(() => {
    setItems((current) => {
      let next = current
        .map((i) => {
          const inc = bundle.includes!.find((b) => b.productId === i.productId);
          return inc ? { ...i, quantity: i.quantity - inc.quantity } : i;
        })
        .filter((i) => i.quantity > 0);
      const existing = next.find((i) => i.productId === BUNDLE_ID);
      next = existing
        ? next.map((i) => (i.productId === BUNDLE_ID ? { ...i, quantity: i.quantity + 1 } : i))
        : [{ productId: BUNDLE_ID, quantity: 1 }, ...next];
      return next;
    });
  }, [bundle]);

  const value = useMemo<CartContextValue>(() => {
    let totals: Totals;
    try {
      totals = priceCart(items, country);
    } catch {
      totals = priceCart([], country);
    }
    return {
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      totals,
      country,
      setCountry,
      add,
      setQuantity,
      remove: (productId) => setQuantity(productId, 0),
      clear: () => setItems([]),
      swapForBundle,
      bundleSwapAvailable,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    };
  }, [items, country, add, setQuantity, swapForBundle, bundleSwapAvailable, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
