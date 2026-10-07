import { Lock } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { COUNTRIES, formatPrice, SHIPPING, type Country } from '../../shared/pricing';
import { SITE } from '../../shared/site';
import { FreeShippingMeter } from '../components/CartDrawer';
import { ProductImage } from '../components/ProductArt';
import { Button, ButtonLink, Input, Notice, Select, Textarea } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { usePageMeta } from '../lib/meta';

type Form = {
  email: string;
  name: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  notes: string;
};

const DRAFT_KEY = 'lumen.checkout.v1';
const EMPTY: Form = { email: '', name: '', phone: '', street: '', houseNumber: '', postalCode: '', city: '', notes: '' };

function loadDraft(): Form {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') };
  } catch {
    return EMPTY;
  }
}

export default function Checkout() {
  usePageMeta('Afrekenen', undefined, { noindex: true });
  const cart = useCart();
  const { totals, country } = cart;
  const [form, setForm] = useState<Form>(loadDraft);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [paymentMode, setPaymentMode] = useState<string>();

  useEffect(() => {
    api<{ payments: string }>('/config')
      .then((c) => setPaymentMode(c.payments))
      .catch(() => setPaymentMode(undefined));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Not critical: the draft only saves retyping after a reload.
    }
  }, [form]);

  const field = (key: keyof Form) => ({
    value: form[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!acceptTerms) {
      setErrors((err) => ({ ...err, acceptTerms: 'Ga akkoord met de algemene voorwaarden om te bestellen' }));
      return;
    }
    setSubmitting(true);
    setFormError(undefined);
    try {
      const { checkoutUrl } = await api<{ checkoutUrl: string }>('/orders', {
        body: { items: cart.items, customer: { ...form, country }, acceptTerms },
      });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else {
        setFormError('Er ging iets mis. Probeer het opnieuw.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (totals.lines.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-paper px-5 pt-24 text-center text-ink">
        <h1 className="font-display text-4xl">Je winkelwagen is leeg</h1>
        <p className="text-stone-dark">Voeg eerst producten toe om af te rekenen.</p>
        <ButtonLink to="/shop" variant="dark" arrow>
          Naar de shop
        </ButtonLink>
      </div>
    );
  }

  const postalHint = country === 'NL' ? 'Bijv. 1017 GB' : 'Bijv. 2000';

  return (
    <div className="min-h-screen bg-paper pt-16 text-ink md:pt-[72px]">
      <div className="container-page py-10 md:py-16">
        <h1 className="font-display text-4xl md:text-5xl">Afrekenen</h1>

        <form onSubmit={submit} noValidate className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="space-y-10 lg:col-span-7">
            {formError && <Notice tone="error">{formError}</Notice>}
            {(paymentMode === 'mock' || paymentMode === 'test') && (
              <Notice>Testmodus: er wordt niet echt betaald. Je wordt doorgestuurd naar een testbetaalpagina.</Notice>
            )}
            {paymentMode === 'off' && (
              <Notice tone="error">
                Online betalen is op dit moment niet beschikbaar. Bestellen kan telefonisch via {SITE.phone} of per e-mail.
              </Notice>
            )}

            <fieldset className="space-y-4">
              <legend className="eyebrow mb-4 text-stone-dark">1 · Contactgegevens</legend>
              <Input label="E-mailadres" type="email" autoComplete="email" required hint="Hier sturen we de orderbevestiging naartoe" {...field('email')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Volledige naam" autoComplete="name" required {...field('name')} />
                <Input label="Telefoonnummer" type="tel" autoComplete="tel" optional hint="Alleen voor vragen over de bezorging" {...field('phone')} />
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="eyebrow mb-4 text-stone-dark">2 · Bezorgadres</legend>
              <Select
                label="Land"
                value={country}
                autoComplete="country"
                onChange={(e) => cart.setCountry(e.target.value as Country)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {SHIPPING[c].label}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <Input label="Postcode" autoComplete="postal-code" required placeholder={postalHint} {...field('postalCode')} />
                </div>
                <div className="col-span-2">
                  <Input label="Huisnummer + toevoeging" autoComplete="address-line2" required {...field('houseNumber')} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Straat" autoComplete="address-line1" required {...field('street')} />
                <Input label="Plaats" autoComplete="address-level2" required {...field('city')} />
              </div>
              <Textarea label="Opmerking bij je bestelling" optional rows={3} maxLength={500} {...field('notes')} />
            </fieldset>
          </div>

          <aside className="lg:col-span-5">
            <div className="border border-paper-3 bg-white p-6 lg:sticky lg:top-24">
              <h2 className="eyebrow text-stone-dark">3 · Overzicht</h2>
              <ul className="mt-4 divide-y divide-ink/10">
                {totals.lines.map(({ product, quantity, lineTotal }) => (
                  <li key={product.id} className="flex items-center gap-4 py-3">
                    <div className="relative w-14 shrink-0">
                      <ProductImage productId={product.id} />
                      <span className="tabular absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center bg-ink px-1 text-[11px] font-semibold text-paper">
                        {quantity}
                      </span>
                    </div>
                    <span className="flex-1 text-[15px]">{product.name}</span>
                    <span className="tabular text-[15px]">{formatPrice(lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-ink/10 pt-4">
                <FreeShippingMeter remaining={totals.freeShippingRemaining} threshold={SHIPPING[country].freeFrom} />
              </div>

              <dl className="tabular mt-5 space-y-2 border-t border-ink/10 pt-4 text-[15px]">
                <div className="flex justify-between">
                  <dt>Subtotaal</dt>
                  <dd>{formatPrice(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Verzending naar {SHIPPING[country].label}</dt>
                  <dd>{totals.shipping === 0 ? 'Gratis' : formatPrice(totals.shipping)}</dd>
                </div>
                <div className="flex justify-between border-t border-ink/10 pt-3 text-lg font-semibold">
                  <dt>Totaal</dt>
                  <dd>{formatPrice(totals.total)}</dd>
                </div>
                <div className="flex justify-between text-sm text-stone-dark">
                  <dt>Waarvan btw (21%)</dt>
                  <dd>{formatPrice(totals.vat)}</dd>
                </div>
              </dl>

              <label className="mt-6 flex cursor-pointer gap-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked);
                    setErrors(({ acceptTerms: _, ...rest }) => rest);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
                  aria-invalid={errors.acceptTerms ? true : undefined}
                />
                <span>
                  Ik ga akkoord met de{' '}
                  <Link to="/voorwaarden" target="_blank" className="underline underline-offset-2">
                    algemene voorwaarden
                  </Link>{' '}
                  en heb het{' '}
                  <Link to="/privacy" target="_blank" className="underline underline-offset-2">
                    privacybeleid
                  </Link>{' '}
                  gelezen.
                </span>
              </label>
              {errors.acceptTerms && <p className="mt-2 text-sm text-accent-strong">{errors.acceptTerms}</p>}

              <Button type="submit" variant="accent" className="mt-6 w-full" disabled={submitting || paymentMode === 'off'}>
                <Lock className="h-4 w-4" aria-hidden />
                {submitting ? 'Even geduld…' : `Bestellen en betalen · ${formatPrice(totals.total)}`}
              </Button>
              <p className="mt-3 text-center text-xs text-stone-dark">
                Je betaalt veilig via Mollie met iDEAL, Bancontact of creditcard.
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
