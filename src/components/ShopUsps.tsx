import { CreditCard, PackageCheck, RotateCcw, Truck } from 'lucide-react';
import { formatPrice, SHIPPING } from '../../shared/pricing';
import { SITE } from '../../shared/site';

export const USPS = [
  { icon: Truck, title: `Verzonden binnen ${SITE.dispatchDays}`, text: `Met ${SITE.carrier}, inclusief track & trace` },
  { icon: PackageCheck, title: `Gratis vanaf ${formatPrice(SHIPPING.NL.freeFrom)}`, text: `Daaronder ${formatPrice(SHIPPING.NL.cost)} binnen Nederland` },
  { icon: RotateCcw, title: `${SITE.returnDays} dagen bedenktijd`, text: 'Niet tevreden? Stuur het terug' },
  { icon: CreditCard, title: 'Veilig betalen', text: 'iDEAL, Bancontact of creditcard' },
];

export function ShopUsps({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <ul className="space-y-3 text-sm">
        {USPS.map(({ icon: Icon, title, text }) => (
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
      {USPS.map(({ icon: Icon, title, text }) => (
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
