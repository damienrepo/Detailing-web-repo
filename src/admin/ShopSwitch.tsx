import { Store } from 'lucide-react';
import { useState } from 'react';
import { confirmAction } from '../lib/demo';
import { useContent } from './content';
import { StatusBadge, Toggle, useToast } from './kit';

/** Switches the whole webshop on or off on the live site. */
export function ShopSwitch() {
  const content = useContent();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const enabled = content.data?.shop.enabled;
  if (enabled === undefined) return null;

  async function change(next: boolean) {
    const question = next
      ? 'Webshop aanzetten? De shop, de winkelwagen en het afrekenen worden direct zichtbaar op de site.'
      : 'Webshop uitzetten? De shop, de winkelwagen en het afrekenen verdwijnen direct van de site. Producten en bestellingen blijven bewaard.';
    if (!confirmAction(question)) return;
    setBusy(true);
    setError(undefined);
    try {
      await content.save('/admin/content/shop', { enabled: next });
      toast(next ? 'De webshop staat aan' : 'De webshop staat uit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan is niet gelukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`border bg-white p-5 md:p-6 ${enabled ? 'border-paper-3' : 'border-accent-fill'}`}>
      <div className="flex items-start gap-4">
        <Store className="mt-0.5 h-6 w-6 shrink-0 text-stone-dark" strokeWidth={1.5} aria-hidden />
        <div className="flex-1">
          <div className={busy ? 'pointer-events-none opacity-60' : ''}>
            <Toggle
              label="Webshop zichtbaar op de site"
              description={
                enabled
                  ? 'Bezoekers zien de shop, kunnen producten in de winkelwagen leggen en afrekenen.'
                  : 'De shop, de winkelwagen en het afrekenen zijn verborgen. Je kunt producten en bestellingen hier gewoon voorbereiden.'
              }
              checked={enabled}
              onChange={change}
            />
          </div>
          <div className="mt-3">{enabled ? <StatusBadge tone="ok">Aan · zichtbaar</StatusBadge> : <StatusBadge tone="accent">Uit · verborgen voor bezoekers</StatusBadge>}</div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </section>
  );
}
