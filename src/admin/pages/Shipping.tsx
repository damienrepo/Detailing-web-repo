import { Store, Truck } from 'lucide-react';
import type { ShippingContent } from '../../../shared/content';
import { COUNTRIES, formatPrice, SHIPPING } from '../../../shared/pricing';
import { formatAddress, SITE } from '../../../shared/site';
import { Button, Input, Textarea } from '../../components/ui';
import { confirmAction } from '../../lib/demo';
import { useContent } from '../content';
import { ErrorBox, Loading, MoneyInput, PageHeader, Panel, SaveBar, Toggle, useDraft, useSave } from '../kit';

export function ShippingPage() {
  const content = useContent();
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<ShippingContent>(content.data?.shipping);
  const save = useSave();

  if (!draft || !content.data) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;
  const e = save.errors;
  const set = <K extends keyof ShippingContent>(key: K, value: ShippingContent[K]) => setDraft({ ...draft, [key]: value });
  const setPickup = (patch: Partial<ShippingContent['pickup']>) => set('pickup', { ...draft.pickup, ...patch });
  const nothingOn = !draft.pickup.enabled && !(draft.deliveryEnabled && COUNTRIES.some((c) => draft.countries[c].enabled));

  async function submit() {
    const view = await save.run(() => content.save('/admin/content/shipping', draft));
    if (view) markSaved(view.shipping);
  }

  async function restore() {
    if (!confirmAction('Verzendinstellingen terugzetten naar de standaard?')) return;
    const view = await save.run(() => content.remove('/admin/content/shipping'), 'Teruggezet');
    if (view) markSaved(view.shipping);
  }

  const businessAddress = formatAddress();

  return (
    <>
      <PageHeader
        title="Verzending & afhalen"
        description="Kies hoe klanten hun bestelling kunnen ontvangen. Wat je hier aanzet, kan de klant kiezen bij het afrekenen. De server rekent de kosten altijd zelf na."
      />
      <div className="space-y-6">
        {nothingOn && <ErrorBox message="Zet minstens één manier aan, anders kan niemand meer bestellen." />}

        <Panel>
          <div className="flex items-start gap-3">
            <Truck className="mt-1 h-5 w-5 shrink-0 text-stone-dark" strokeWidth={1.5} aria-hidden />
            <div className="flex-1">
              <Toggle
                label="Bezorgen"
                description="Bestellingen versturen met een pakketdienst."
                checked={draft.deliveryEnabled}
                onChange={(v) => set('deliveryEnabled', v)}
              />
            </div>
          </div>
          {draft.deliveryEnabled && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Vervoerder" value={draft.carrier} error={e.carrier} placeholder="Bijv. PostNL" onChange={(ev) => set('carrier', ev.target.value)} />
                <Input
                  label="Verzendtijd"
                  value={draft.dispatchDays}
                  error={e.dispatchDays}
                  placeholder="Bijv. 1–2 werkdagen"
                  hint="‘Verzonden binnen …’ op de site."
                  onChange={(ev) => set('dispatchDays', ev.target.value)}
                />
              </div>
              <div className="space-y-4">
                {COUNTRIES.map((c) => {
                  const rate = draft.countries[c];
                  const setRate = (patch: Partial<typeof rate>) => set('countries', { ...draft.countries, [c]: { ...rate, ...patch } });
                  return (
                    <div key={c} className="border border-paper-3 bg-paper/60 p-4">
                      <Toggle label={SHIPPING[c].label} description={rate.enabled ? 'We bezorgen hier.' : 'Niet beschikbaar bij het afrekenen.'} checked={rate.enabled} onChange={(v) => setRate({ enabled: v })} />
                      {rate.enabled && (
                        <div className="mt-4 grid gap-5 sm:grid-cols-2">
                          <MoneyInput label="Verzendkosten" cents={rate.cost} error={e[`countries.${c}.cost`]} onChange={(v) => setRate({ cost: v ?? 0 })} />
                          <div className="space-y-3">
                            <Toggle label="Gratis verzending vanaf een bedrag" checked={rate.freeFrom !== null} onChange={(v) => setRate({ freeFrom: v ? 4000 : null })} />
                            {rate.freeFrom !== null && (
                              <MoneyInput
                                label="Gratis vanaf"
                                cents={rate.freeFrom}
                                error={e[`countries.${c}.freeFrom`]}
                                hint="Bestelbedrag inclusief btw."
                                onChange={(v) => setRate({ freeFrom: v ?? 0 })}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <div className="flex items-start gap-3">
            <Store className="mt-1 h-5 w-5 shrink-0 text-stone-dark" strokeWidth={1.5} aria-hidden />
            <div className="flex-1">
              <Toggle
                label="Afhalen"
                description="Klanten halen hun bestelling zelf bij jullie op."
                checked={draft.pickup.enabled}
                onChange={(v) => setPickup({ enabled: v })}
              />
            </div>
          </div>
          {draft.pickup.enabled && (
            <>
              <Textarea
                label="Afhaaladres"
                rows={2}
                value={draft.pickup.location}
                error={e['pickup.location']}
                optional
                placeholder={businessAddress || `Bijv. Straat 1, 7511 AB ${SITE.address.city}`}
                hint={
                  businessAddress
                    ? `Leeg laten = het adres uit Bedrijfsgegevens (${businessAddress}).`
                    : 'Leeg laten = het adres uit Bedrijfsgegevens. Daar staat nog geen straat, dus vul het hier of daar in.'
                }
                onChange={(ev) => setPickup({ location: ev.target.value })}
              />
              <Input
                label="Wanneer ligt het klaar?"
                value={draft.pickup.readyTime}
                error={e['pickup.readyTime']}
                placeholder="Bijv. Meestal binnen 1 werkdag"
                onChange={(ev) => setPickup({ readyTime: ev.target.value })}
              />
              <Textarea
                label="Instructies voor de klant"
                rows={3}
                value={draft.pickup.instructions}
                error={e['pickup.instructions']}
                optional
                hint="Staat bij het afrekenen, op de bestelpagina en in de e-mails. Bijv. openingstijden of ‘bel even aan bij de werkplaats’."
                onChange={(ev) => setPickup({ instructions: ev.target.value })}
              />
              <MoneyInput label="Kosten voor afhalen" cents={draft.pickup.cost} error={e['pickup.cost']} hint="Meestal gratis (0,00)." onChange={(v) => setPickup({ cost: v ?? 0 })} />
            </>
          )}
        </Panel>

        <Panel title="Zo ziet de klant het">
          <ul className="space-y-2 text-[15px]">
            {draft.deliveryEnabled &&
              COUNTRIES.filter((c) => draft.countries[c].enabled).map((c) => {
                const r = draft.countries[c];
                return (
                  <li key={c} className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-stone-dark" aria-hidden />
                    Bezorgen in {SHIPPING[c].label}: {r.cost === 0 ? 'gratis' : formatPrice(r.cost)}
                    {r.freeFrom !== null && r.cost > 0 && `, gratis vanaf ${formatPrice(r.freeFrom)}`}
                  </li>
                );
              })}
            {draft.pickup.enabled && (
              <li className="flex items-center gap-2">
                <Store className="h-4 w-4 text-stone-dark" aria-hidden />
                Afhalen in {SITE.address.city}: {draft.pickup.cost === 0 ? 'gratis' : formatPrice(draft.pickup.cost)}
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={reset}
        extra={
          content.data.edited.shipping && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={restore}>
              Standaard herstellen
            </Button>
          )
        }
      />
    </>
  );
}
