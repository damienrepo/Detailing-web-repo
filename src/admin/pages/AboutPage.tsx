import { ExternalLink } from 'lucide-react';
import type { AboutContent } from '../../../shared/content';
import { Button, Input, Textarea } from '../../components/ui';
import { confirmAction } from '../../lib/demo';
import { useContent } from '../content';
import { ErrorBox, errorFor, ImageField, LineList, Loading, PageHeader, Panel, RecordList, SaveBar, useDraft, useSave } from '../kit';

export function AboutEditor() {
  const content = useContent();
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<AboutContent>(content.data?.about);
  const save = useSave();

  if (!draft || !content.data) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;
  const e = save.errors;
  const set = <K extends keyof AboutContent>(key: K, value: AboutContent[K]) => setDraft({ ...draft, [key]: value });

  async function submit() {
    const view = await save.run(() => content.save('/admin/content/about', draft));
    if (view) markSaved(view.about);
  }

  async function restore() {
    if (!confirmAction('Alle teksten van ‘Over ons’ terugzetten naar de oorspronkelijke versie?')) return;
    const view = await save.run(() => content.remove('/admin/content/about'), 'Teruggezet');
    if (view) markSaved(view.about);
  }

  const link = (to: string, label: string) => (
    <a href={to} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-medium hover:border-ink">
      <ExternalLink className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );

  return (
    <>
      <PageHeader
        title="Over ons"
        description="Vertel je verhaal: wie jullie zijn, waarom jullie dit doen en waar jullie voor staan. Het staat op de homepage (kort) en op de pagina Over ons (uitgebreid). De teamleden zelf beheer je onder Team."
        actions={
          <>
            {link('/#over-ons', 'Op de homepage')}
            {link('/over-ons', 'De pagina')}
          </>
        }
      />
      <div className="space-y-6">
        <Panel title="Foto" description="Staat naast het verhaal op de homepage en groot bovenaan de pagina. Een teamfoto werkt het best.">
          <ImageField label="Foto" value={draft.image} onChange={(v) => v && set('image', v)} error={e.image} />
        </Panel>

        <Panel title="Op de homepage" description="Een korte versie, direct onder de grote foto bovenaan, boven de diensten.">
          <Input label="Titel" value={draft.homeTitle} error={e.homeTitle} onChange={(ev) => set('homeTitle', ev.target.value)} />
          <Textarea label="Tekst" rows={4} value={draft.homeText} error={e.homeText} hint="Twee à drie zinnen. De eerste vier waarden (hieronder) staan er ook bij." onChange={(ev) => set('homeText', ev.target.value)} />
          <Input label="Citaat" value={draft.quote} error={e.quote} optional hint="Staat in een gouden blok over de foto, en groot in het verhaal op de pagina." onChange={(ev) => set('quote', ev.target.value)} />
        </Panel>

        <Panel title="Bovenaan de pagina">
          <Textarea
            label="Grote titel"
            rows={2}
            value={draft.heroTitle}
            error={e.heroTitle}
            hint="Druk op Enter voor een nieuwe regel; de tweede regel wordt goud."
            onChange={(ev) => set('heroTitle', ev.target.value)}
          />
          <Textarea label="Tekst eronder" rows={2} value={draft.heroText} error={e.heroText} onChange={(ev) => set('heroText', ev.target.value)} />
          <RecordList
            label="Feiten"
            hint="Korte, opvallende feiten onder de foto, bijv. ‘2’ + ‘oprichters’. Maximaal 4."
            items={draft.facts}
            onChange={(v) => set('facts', v)}
            fields={[
              { key: 'value', label: 'Getal of woord', placeholder: 'Bijv. 2' },
              { key: 'label', label: 'Uitleg', placeholder: 'Bijv. oprichters met passie voor auto’s' },
            ]}
            empty={{ value: '', label: '' }}
            addLabel="Feit toevoegen"
            error={errorFor(e, 'facts')}
            max={4}
          />
        </Panel>

        <Panel title="Het verhaal">
          <Input label="Titel" value={draft.storyTitle} error={e.storyTitle} onChange={(ev) => set('storyTitle', ev.target.value)} />
          <LineList
            label="Alinea’s"
            hint="De eerste alinea wordt iets groter getoond, als opening."
            items={draft.story}
            onChange={(v) => set('story', v)}
            long
            addLabel="Alinea toevoegen"
            error={errorFor(e, 'story')}
            max={8}
          />
        </Panel>

        <Panel title="Waarom jullie het doen" description="Staat groot en centraal op de pagina. Schrijf het zoals je het tegen een klant zou zeggen.">
          <Input label="Titel" value={draft.whyTitle} error={e.whyTitle} onChange={(ev) => set('whyTitle', ev.target.value)} />
          <Textarea label="Tekst" rows={4} value={draft.whyText} error={e.whyText} onChange={(ev) => set('whyText', ev.target.value)} />
        </Panel>

        <Panel title="Waar jullie voor staan">
          <RecordList
            label="Waarden"
            items={draft.values}
            onChange={(v) => set('values', v)}
            fields={[
              { key: 'title', label: 'Titel', placeholder: 'Bijv. Eerlijk advies' },
              { key: 'text', label: 'Uitleg', long: true },
            ]}
            empty={{ title: '', text: '' }}
            addLabel="Waarde toevoegen"
            error={errorFor(e, 'values')}
            max={6}
          />
        </Panel>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={reset}
        extra={
          content.data.edited.about && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={restore}>
              Standaard herstellen
            </Button>
          )
        }
      />
    </>
  );
}
