import type { SiteEdit } from '../../../shared/content';
import { Button, Input, Textarea } from '../../components/ui';
import { confirmAction } from '../../lib/demo';
import { useContent } from '../content';
import { ErrorBox, errorFor, Loading, PageHeader, Panel, RecordList, SaveBar, useDraft, useSave } from '../kit';

export function BusinessPage() {
  const content = useContent();
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<SiteEdit>(content.data?.site);
  const save = useSave();

  if (!draft || !content.data) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;
  const e = save.errors;
  const set = <K extends keyof SiteEdit>(key: K, value: SiteEdit[K]) => setDraft({ ...draft, [key]: value });

  async function submit() {
    const view = await save.run(() => content.save('/admin/content/site', draft));
    if (view) markSaved(view.site);
  }

  async function restore() {
    if (!confirmAction('Alle bedrijfsgegevens terugzetten naar de oorspronkelijke waarden?')) return;
    const view = await save.run(() => content.remove('/admin/content/site'), 'Teruggezet');
    if (view) markSaved(view.site);
  }

  return (
    <>
      <PageHeader
        title="Bedrijfsgegevens"
        description="Deze gegevens staan in de footer, op de contactpagina, in e-mails en in de algemene voorwaarden. KvK- en btw-nummer zijn verplicht voor een webshop."
      />
      <div className="space-y-6">
        <Panel title="Contact">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Telefoonnummer" value={draft.phone} error={e.phone} hint="Wordt ook gebruikt voor WhatsApp." onChange={(ev) => set('phone', ev.target.value)} />
            <Input label="E-mailadres" type="email" value={draft.email} error={e.email} onChange={(ev) => set('email', ev.target.value)} />
          </div>
          <Input label="Werkgebied" value={draft.region} error={e.region} hint="Bijv. ‘Enschede en omstreken’. Staat op de homepage en bij de diensten." onChange={(ev) => set('region', ev.target.value)} />
        </Panel>

        <Panel title="Adres van de werkplaats" description="Laat de straat leeg als je het adres niet op de site wilt tonen.">
          <Input label="Straat en huisnummer" value={draft.address.street} error={e['address.street']} optional onChange={(ev) => set('address', { ...draft.address, street: ev.target.value })} />
          <div className="grid gap-5 sm:grid-cols-[10rem_1fr_1fr]">
            <Input label="Postcode" value={draft.address.postalCode} error={e['address.postalCode']} optional onChange={(ev) => set('address', { ...draft.address, postalCode: ev.target.value })} />
            <Input label="Plaats" value={draft.address.city} error={e['address.city']} onChange={(ev) => set('address', { ...draft.address, city: ev.target.value })} />
            <Input label="Land" value={draft.address.country} error={e['address.country']} onChange={(ev) => set('address', { ...draft.address, country: ev.target.value })} />
          </div>
        </Panel>

        <Panel title="Openingstijden">
          <RecordList
            label="Tijden"
            items={draft.hours}
            onChange={(hours) => set('hours', hours)}
            fields={[
              { key: 'days', label: 'Dag(en)', placeholder: 'Maandag – vrijdag' },
              { key: 'time', label: 'Tijd', placeholder: '08:30 – 18:00 of Gesloten' },
            ]}
            empty={{ days: '', time: '' }}
            addLabel="Regel toevoegen"
            error={errorFor(e, 'hours')}
            max={10}
          />
        </Panel>

        <Panel title="Bedrijf" description="Zoals ingeschreven bij de Kamer van Koophandel.">
          <Input label="Officiële bedrijfsnaam" value={draft.legalName} error={e.legalName} onChange={(ev) => set('legalName', ev.target.value)} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="KvK-nummer" value={draft.kvk} error={e.kvk} inputMode="numeric" onChange={(ev) => set('kvk', ev.target.value)} />
            <Input label="Btw-nummer" value={draft.vatNumber} error={e.vatNumber} placeholder="NL123456789B01" onChange={(ev) => set('vatNumber', ev.target.value)} />
          </div>
        </Panel>

        <Panel title="Social media">
          <Input label="Instagram" value={draft.social.instagram} error={e['social.instagram']} placeholder="https://www.instagram.com/…" optional onChange={(ev) => set('social', { ...draft.social, instagram: ev.target.value })} />
          <Input label="TikTok" value={draft.social.tiktok} error={e['social.tiktok']} placeholder="https://www.tiktok.com/@…" optional onChange={(ev) => set('social', { ...draft.social, tiktok: ev.target.value })} />
        </Panel>

        <Panel title="Vindbaarheid in Google" description="De slogan staat in de tabtitel van de homepage; de omschrijving verschijnt vaak als tekst onder je site in Google.">
          <Input label="Slogan" value={draft.tagline} error={e.tagline} onChange={(ev) => set('tagline', ev.target.value)} />
          <Textarea label="Omschrijving" rows={3} value={draft.description} error={e.description} hint={`${draft.description.length}/300 tekens, ideaal is 120–160.`} onChange={(ev) => set('description', ev.target.value)} />
        </Panel>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={reset}
        extra={
          content.data.edited.site && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={restore}>
              Standaard herstellen
            </Button>
          )
        }
      />
    </>
  );
}
