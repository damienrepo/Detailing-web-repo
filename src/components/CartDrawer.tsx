import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { BUNDLE_ID, getProduct, type ProductId } from '../../shared/catalog';
import { formatPrice, SHIPPING } from '../../shared/pricing';
import { useCart } from '../lib/cart';
import { ProductImage } from './ProductArt';
import { Button, ButtonLink, QuantityStepper } from './ui';

export function FreeShippingMeter({ remaining, threshold }: { remaining: number; threshold: number }) {
  const progress = Math.min(1, (threshold - remaining) / threshold);
  return (
    <div>
      <p className="text-sm">
        {remaining > 0 ? (
          <>
            Nog <strong className="tabular">{formatPrice(remaining)}</strong> tot gratis verzending
          </>
        ) : (
          <strong>Je bestelling wordt gratis verzonden</strong>
        )}
      </p>
      <div className="mt-2 h-1 bg-ink/10" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const { isOpen, close, totals } = cart;
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const bundle = getProduct(BUNDLE_ID)!;

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Winkelwagen"
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper text-ink shadow-2xl outline-none"
          >
            <div className="flex h-16 items-center justify-between border-b border-ink/10 px-5 md:h-[72px]">
              <h2 className="font-display text-xl">
                Winkelwagen <span className="tabular text-stone">({cart.count})</span>
              </h2>
              <button type="button" onClick={close} className="grid h-10 w-10 place-items-center hover:bg-ink/5" aria-label="Sluiten">
                <X className="h-5 w-5" />
              </button>
            </div>

            {totals.lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
                <p className="text-stone-dark">Je winkelwagen is leeg.</p>
                <ButtonLink to="/shop" variant="dark" arrow onClick={close}>
                  Naar de shop
                </ButtonLink>
              </div>
            ) : (
              <>
                <div className="border-b border-ink/10 px-5 py-4">
                  <FreeShippingMeter remaining={totals.freeShippingRemaining} threshold={SHIPPING[cart.country].freeFrom} />
                </div>

                <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto px-5">
                  {totals.lines.map(({ product, quantity, lineTotal }) => (
                    <li key={product.id} className="flex gap-4 py-5">
                      <Link to={`/shop/${product.slug}`} onClick={close} className="w-20 shrink-0">
                        <ProductImage productId={product.id} />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex justify-between gap-3">
                          <div>
                            <Link to={`/shop/${product.slug}`} onClick={close} className="font-medium hover:underline">
                              {product.name}
                            </Link>
                            <p className="text-sm text-stone-dark">{product.size}</p>
                          </div>
                          <p className="tabular text-right font-medium">{formatPrice(lineTotal)}</p>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-3">
                          <QuantityStepper
                            size="sm"
                            label={`Aantal ${product.name}`}
                            value={quantity}
                            onChange={(q) => cart.setQuantity(product.id, q)}
                          />
                          <button type="button" onClick={() => cart.remove(product.id)} className="text-sm text-stone-dark underline-offset-4 hover:underline">
                            Verwijderen
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {cart.bundleSwapAvailable && (
                  <div className="mx-5 mb-4 flex items-center justify-between gap-4 border border-accent/40 bg-white px-4 py-3">
                    <p className="text-sm">
                      Je hebt alle losse onderdelen van de <strong>{bundle.name}</strong>. Bespaar{' '}
                      {formatPrice(bundle.compareAtPrice! - bundle.price)} met de set.
                    </p>
                    <button type="button" onClick={cart.swapForBundle} className="shrink-0 text-sm font-semibold text-accent-strong underline underline-offset-4">
                      Omwisselen
                    </button>
                  </div>
                )}

                {!cart.items.some((i) => i.productId === BUNDLE_ID) && !cart.bundleSwapAvailable && (
                  <UpsellBundle onNavigate={close} />
                )}

                <div className="border-t border-ink/10 bg-paper-2/60 px-5 pb-5 pt-4">
                  <dl className="tabular space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt>Subtotaal</dt>
                      <dd>{formatPrice(totals.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-stone-dark">
                      <dt>Verzending ({SHIPPING[cart.country].label})</dt>
                      <dd>{totals.shipping === 0 ? 'Gratis' : formatPrice(totals.shipping)}</dd>
                    </div>
                    <div className="flex justify-between pt-2 text-base font-semibold">
                      <dt>Totaal</dt>
                      <dd>{formatPrice(totals.total)}</dd>
                    </div>
                  </dl>
                  <p className="mt-1 text-xs text-stone-dark">Inclusief {formatPrice(totals.vat)} btw</p>
                  <Button
                    variant="accent"
                    arrow
                    className="mt-4 w-full"
                    onClick={() => {
                      close();
                      navigate('/afrekenen');
                    }}
                  >
                    Afrekenen
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function UpsellBundle({ onNavigate }: { onNavigate: () => void }) {
  const { add } = useCart();
  const bundle = getProduct(BUNDLE_ID)!;
  return (
    <div className="mx-5 mb-4 flex items-center gap-4 border border-ink/10 bg-white p-3">
      <Link to={`/shop/${bundle.slug}`} onClick={onNavigate} className="w-14 shrink-0">
        <ProductImage productId={bundle.id as ProductId} />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{bundle.name}</p>
        <p className="text-stone-dark">
          {formatPrice(bundle.price)} · {bundle.badge}
        </p>
      </div>
      <button type="button" onClick={() => add(bundle.id)} className="h-9 shrink-0 border border-ink/20 px-3 text-sm font-medium hover:border-ink">
        Toevoegen
      </button>
    </div>
  );
}
