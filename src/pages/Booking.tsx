import { CircleCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { formatPrice } from '../../shared/pricing';
import { getService, SERVICES } from '../../shared/services';
import { SITE } from '../../shared/site';
import { Button, ButtonLink, Eyebrow, Input, Notice, Select, Textarea } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { usePageMeta } from '../lib/meta';

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Booking() {
  usePageMeta('Afspraak aanvragen', 'Vraag een afspraak aan voor lakcorrectie, keramische coating of interieur detailing. Je hoort binnen één werkdag van ons.');
  const [params] = useSearchParams();
  const initialService = getService(params.get('dienst') ?? '')?.id ?? SERVICES[0].id;
  const [form, setForm] = useState({
    serviceId: initialService,
    vehicle: '',
    preferredDate: '',
    name: '',
    email: '',
    phone: '',
    postalCode: '',
    message: '',
    website: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => ({
    value: form[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(undefined);
    try {
      await api('/bookings', { body: form });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Versturen is niet gelukt. Probeer het opnieuw of bel ons.');
    } finally {
      setSubmitting(false);
    }
  }

  const service = getService(form.serviceId)!;

  if (done) {
    return (
      <div className="min-h-[80vh] bg-paper pt-16 text-ink md:pt-[72px]">
        <div className="container-page max-w-2xl py-20">
          <CircleCheck className="h-8 w-8 text-[#2f6b4f]" />
          <h1 className="font-display mt-6 text-4xl md:text-5xl">Aanvraag ontvangen</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-stone-dark">
            Bedankt, {form.name.split(' ')[0]}. We nemen binnen één werkdag contact met je op om een datum en de prijs voor
            {' '}
            {service.name.toLowerCase()} te bevestigen. Je ontvangt ook een bevestiging per e-mail.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/" variant="dark">
              Terug naar home
            </ButtonLink>
            <ButtonLink to="/shop" variant="outline-dark">
              Bekijk de shop
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper pt-16 text-ink md:pt-[72px]">
      <div className="container-page grid gap-12 py-14 md:py-20 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <Eyebrow className="text-stone-dark">Afspraak</Eyebrow>
          <h1 className="font-display mt-5 text-[clamp(2.5rem,5vw,4rem)] leading-[0.98]">Afspraak aanvragen</h1>
          <p className="mt-6 text-[17px] leading-relaxed text-stone-dark">
            Laat weten wat je wilt laten doen. We nemen binnen één werkdag contact op met een voorstel voor datum en prijs.
            Pas na onze bevestiging staat de afspraak vast.
          </p>

          <div className="mt-10 border-t border-ink/15 pt-8">
            <p className="eyebrow text-stone-dark">Gekozen behandeling</p>
            <p className="font-display mt-3 text-2xl">{service.name}</p>
            <p className="mt-2 leading-relaxed text-stone-dark">{service.summary}</p>
            <dl className="tabular mt-6 flex gap-10">
              <div>
                <dt className="eyebrow text-stone-dark">Vanaf</dt>
                <dd className="mt-1 text-lg font-medium">{formatPrice(service.fromPrice)}</dd>
              </div>
              <div>
                <dt className="eyebrow text-stone-dark">Duur</dt>
                <dd className="mt-1 text-lg font-medium">{service.duration}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-10 border-t border-ink/15 pt-8 text-[15px] leading-relaxed text-stone-dark">
            Liever direct contact? Bel{' '}
            <a href={`tel:${SITE.phoneHref}`} className="text-ink underline underline-offset-4">
              {SITE.phone}
            </a>{' '}
            of mail{' '}
            <a href={`mailto:${SITE.email}`} className="text-ink underline underline-offset-4">
              {SITE.email}
            </a>
            .
          </div>
        </div>

        <form onSubmit={submit} noValidate className="space-y-8 border border-paper-3 bg-white p-6 md:p-10 lg:col-span-7">
          {formError && <Notice tone="error">{formError}</Notice>}

          <fieldset className="space-y-4">
            <legend className="eyebrow mb-4 text-stone-dark">Behandeling & auto</legend>
            <Select label="Behandeling" {...set('serviceId')}>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — vanaf {formatPrice(s.fromPrice)}
                </option>
              ))}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Merk, model en bouwjaar" placeholder="Bijv. BMW 3-serie, 2021" required {...set('vehicle')} />
              <Input label="Voorkeursdatum" type="date" min={tomorrow()} optional {...set('preferredDate')} />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="eyebrow mb-4 text-stone-dark">Je gegevens</legend>
            <Input label="Naam" autoComplete="name" required {...set('name')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="E-mailadres" type="email" autoComplete="email" required {...set('email')} />
              <Input label="Telefoonnummer" type="tel" autoComplete="tel" required {...set('phone')} />
            </div>
            <Input label="Postcode" autoComplete="postal-code" optional className="sm:max-w-48" {...set('postalCode')} />
            <Textarea
              label="Toelichting"
              optional
              rows={4}
              maxLength={1000}
              placeholder="Bijv. de staat van de lak, specifieke vlekken of wensen"
              {...set('message')}
            />
            {/* Honeypot for spam bots, hidden from people and screen readers. */}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </label>
            </div>
          </fieldset>

          <div className="flex flex-col gap-4 border-t border-ink/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-dark">Een aanvraag is vrijblijvend.</p>
            <Button type="submit" variant="accent" arrow disabled={submitting}>
              {submitting ? 'Versturen…' : 'Aanvraag versturen'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
