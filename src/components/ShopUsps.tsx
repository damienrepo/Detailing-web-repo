import { CreditCard, PackageCheck, RotateCcw, Store, Truck } from 'lucide-react';
import { deliveryCountries, formatPrice, PICKUP, SHIPPING } from '../../shared/pricing';
import { SITE } from '../../shared/site';

/** Built from the current shipping settings, so it matches what the admin has switched on. */
function shopUsps() {
  const delivery = deliveryCountries();
  const home = delivery.includes('NL') ? SHIPPING.NL : delivery[0] ? SHIPPING[delivery[0]] : undefined;
  const pickupText = PICKUP.enabled ? `${PICKUP.cost === 0 ? 'gratis' : formatPrice(PICKUP.cost)} afhalen in ${SITE.address.city}` : '';
  const usps = [];
  if (home) {
    usps.push({ icon: Truck, title: `Verzonden binnen ${SITE.dispatchDays}`, text: `Met ${SITE.carrier}, inclusief track & trace` });
    usps.push(
      home.freeFrom !== null
        ? {
            icon: PackageCheck,
            title: `Gratis vanaf ${formatPrice(home.freeFrom)}`,
            text: `Daaronder ${formatPrice(home.cost)} in ${home.label}${pickupText ? `, of ${pickupText}` : ''}`,
          }
        : { icon: PackageCheck, title: `Verzendkosten ${formatPrice(home.cost)}`, text: pickupText ? `Of ${pickupText}` : `Binnen ${home.label}` },
    );
  } else if (PICKUP.enabled) {
    usps.push({ icon: Store, title: `Afhalen in ${SITE.address.city}`, text: PICKUP.readyTime });
  }
  usps.push({ icon: RotateCcw, title: `${SITE.returnDays} dagen bedenktijd`, text: 'Eenvoudig retourneren' });
  usps.push({ icon: CreditCard, title: 'Veilig betalen', text: 'iDEAL, Bancontact of creditcard' });
  return usps;
}

export function ShopUsps({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <ul className="space-y-3 text-sm">
        {shopUsps().map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-stone-dark" strokeWidth={1.6} aria-hidden />
            <span>
              <span className="font-medium">{title}</span> <span className="text-stone-dark">— {text}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-px bg-paper-3 sm:grid-cols-2 lg:grid-cols-4">
      {shopUsps().map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-4 bg-paper px-1 py-6 sm:px-6">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <div>
            <p className="font-medium">{title}</p>
            <p className="mt-0.5 text-sm text-stone-dark">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
