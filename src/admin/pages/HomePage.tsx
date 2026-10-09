import { ExternalLink } from 'lucide-react';
import type { HomeContent } from '../../../shared/content';
import { Button, Input, Textarea } from '../../components/ui';
import { confirmAction } from '../../lib/demo';
import { useContent } from '../content';
import { ErrorBox, errorFor, ImageField, ImageListField, Loading, move, PageHeader, Panel, RecordList, RowControls, SaveBar, useDraft, useSave } from '../kit';

export function HomePageEditor() {
  const content = useContent();
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<HomeContent>(content.data?.home);
  const save = useSave();

  if (!draft || !content.data) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;
  const e = save.errors;
  const set = <K extends keyof HomeContent>(key: K, value: HomeContent[K]) => setDraft({ ...draft, [key]: value });
  const text = (key: keyof HomeContent, label: string, opts: { long?: boolean; hint?: string } = {}) =>
    opts.long ? (
      <Textarea label={label} rows={3} value={draft[key] as string} error={e[key]} hint={opts.hint} onChange={(ev) => set(key, ev.target.value as never)} />
    ) : (
      <Input label={label} value={draft[key] as string} error={e[key]} hint={opts.hint} onChange={(ev) => set(key, ev.target.value as never)} />
    );

  async function submit() {
    const view = await save.run(() => content.save('/admin/content/home', draft));
    if (view) markSaved(view.home);
  }

  async function restore() {
    if (!confirmAction('Alle teksten van de homepage terugzetten naar de oorspronkelijke versie?')) return;
    const view = await save.run(() => content.remove('/admin/content/home'), 'Teruggezet');
    if (view) markSaved(view.home);
  }

  return (
    <>
      <PageHeader
        title="Homepage"
        description="Pas de teksten en foto’s van de homepage aan. De diensten en producten zelf beheer je onder Diensten en Producten."
        actions={
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-medium hover:border-ink">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Bekijk de homepage
          </a>
        }
      />
      <div className="space-y-6">
        <Panel title="Bovenaan (hero)" description="Het eerste wat bezoekers zien.">
          <Textarea
            label="Grote titel"
            rows={2}
            value={draft.heroTitle}
            error={e.heroTitle}
            hint="Druk op Enter voor een nieuwe regel. Kort en krachtig werkt het best."
            onChange={(ev) => set('heroTitle', ev.target.value)}
          />
          {text('heroText', 'Tekst onder de titel', { long: true })}
          <ImageField label="Achtergrondfoto" hint="Een brede, donkere foto werkt het best; de tekst staat eroverheen." value={draft.heroImage} onChange={(v) => v && set('heroImage', v)} error={e.heroImage} />
        </Panel>

        <Panel title="Kopjes van de secties">
          <div className="grid gap-5 md:grid-cols-2">
            {text('servicesTitle', 'Diensten: titel')}
            {text('shopTitle', 'Shop: titel')}
            {text('servicesIntro', 'Diensten: introductie', { long: true })}
            {text('shopIntro', 'Shop: introductie', { long: true })}
          </div>
        </Panel>

        <Panel title="Werkwijze">
          {text('stepsTitle', 'Titel')}
          <RecordList
            label="Stappen"
            items={draft.steps}
            onChange={(steps) => set('steps', steps)}
            fields={[
              { key: 'title', label: 'Stap' },
              { key: 'text', label: 'Uitleg', long: true },
            ]}
            empty={{ title: '', text: '' }}
            addLabel="Stap toevoegen"
            error={errorFor(e, 'steps')}
            max={6}
          />
        </Panel>

        <Panel title="Resultaten" description="Laat je mooiste werk zien: per auto een serie foto’s waar bezoekers doorheen kunnen swipen. Met de pijltjes bepaal je de volgorde op de homepage; #1 staat linksboven.">
          {text('resultsTitle', 'Titel')}
          {text('resultsIntro', 'Introductie', { long: true })}
          <ul className="space-y-3">
            {draft.results.map((r, i) => (
              <li key={i} className="space-y-4 border border-paper-3 bg-paper/60 p-4">
                <div className="flex items-center justify-between gap-3 border-b border-paper-3 pb-3">
                  <p className="min-w-0 truncate font-medium">
                    <span className="tabular mr-2 font-mono text-sm text-accent-strong">#{i + 1}</span>
                    {r.title || 'Nieuwe auto'}
                  </p>
                  <RowControls
                    index={i}
                    count={draft.results.length}
                    label={r.title || `Auto ${i + 1}`}
                    onMove={(to) => set('results', move(draft.results, i, to))}
                    onRemove={() => confirmAction(`${r.title || 'Deze auto'} met ${r.images.length} foto${r.images.length === 1 ? '' : '’s'} verwijderen van de homepage?`) && set('results', draft.results.filter((_, j) => j !== i))}
                  />
                </div>
                <ImageListField
                  label="Foto’s"
                  hint="Bezoekers kunnen erdoorheen swipen."
                  value={r.images}
                  onChange={(images) => set('results', draft.results.map((x, k) => (k === i ? { ...x, images } : x)))}
                  error={errorFor(e, `results.${i}.images`)}
                />
                <div className="space-y-3">
                  <Input label="Auto" value={r.title} placeholder="Bijv. Porsche Cayman" onChange={(ev) => set('results', draft.results.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
                  <Input label="Behandeling" value={r.text} placeholder="Bijv. Lakcorrectie en glascoating" onChange={(ev) => set('results', draft.results.map((x, j) => (j === i ? { ...x, text: ev.target.value } : x)))} />
                </div>
              </li>
            ))}
          </ul>
          {errorFor(e, 'results') && <p className="text-sm text-danger">{errorFor(e, 'results')}</p>}
          {draft.results.length < 8 && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={() => set('results', [...draft.results, { images: ['coatings'], title: '', text: '' }])}>
              Resultaat toevoegen
            </Button>
          )}
        </Panel>

        <Panel title="Veelgestelde vragen" description="Vragen over je diensten. De vragen over verzending en betalen worden automatisch toegevoegd.">
          {text('faqTitle', 'Titel')}
          <RecordList
            label="Vragen"
            items={draft.faq}
            onChange={(faq) => set('faq', faq)}
            fields={[
              { key: 'q', label: 'Vraag' },
              { key: 'a', label: 'Antwoord', long: true },
            ]}
            empty={{ q: '', a: '' }}
            addLabel="Vraag toevoegen"
            error={errorFor(e, 'faq')}
          />
        </Panel>

        <Panel title="Afsluiter (gouden balk onderaan)">
          {text('ctaTitle', 'Titel')}
          {text('ctaText', 'Tekst')}
        </Panel>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={reset}
        extra={
          content.data.edited.home && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={restore}>
              Standaard herstellen
            </Button>
          )
        }
      />
    </>
  );
}
