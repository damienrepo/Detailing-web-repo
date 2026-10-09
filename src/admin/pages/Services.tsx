import { ChevronRight, ExternalLink, EyeOff } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import type { ServiceEdit } from '../../../shared/content';
import { formatPrice } from '../../../shared/pricing';
import { CATEGORIES } from '../../../shared/services';
import { Button, Input, Textarea } from '../../components/ui';
import { confirmAction } from '../../lib/demo';
import { imageUrl } from '../../lib/images';
import { useContent } from '../content';
import { ErrorBox, errorFor, ImageField, LineList, Loading, MoneyInput, PageHeader, Panel, RecordList, SaveBar, StatusBadge, Toggle, useDraft, useSave } from '../kit';

export function ServicesPage() {
  const { data, error, reload } = useContent();
  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  return (
    <>
      <PageHeader title="Diensten" description="Pas teksten, prijzen en foto’s van je diensten aan, of verberg een dienst die je (tijdelijk) niet aanbiedt." />
      <div className="space-y-8">
        {CATEGORIES.map((c) => (
          <section key={c.id}>
            <h2 className="eyebrow mb-3 text-stone-dark">{c.name}</h2>
            <ul className="divide-y divide-paper-3 border border-paper-3 bg-white">
              {data.services
                .filter((s) => s.category === c.id)
                .map((s) => (
                  <li key={s.id}>
                    <Link to={`/admin/diensten/${s.id}`} className="flex items-center gap-4 p-3 hover:bg-paper/60">
                      <img src={imageUrl(s.image, 'sm')} alt="" className={`h-14 w-20 shrink-0 object-cover ${s.hidden ? 'opacity-40' : ''}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-stone-dark">
                          {s.fromPrice === null ? 'Prijs op aanvraag' : `Vanaf ${formatPrice(s.fromPrice)}`}
                        </p>
                      </div>
                      {s.hidden && (
                        <StatusBadge tone="muted">
                          <EyeOff className="mr-1 h-3 w-3" aria-hidden />
                          Verborgen
                        </StatusBadge>
                      )}
                      {data.edited.services.includes(s.id) && !s.hidden && <StatusBadge tone="muted">Aangepast</StatusBadge>}
                      <ChevronRight className="h-4 w-4 text-stone-dark" aria-hidden />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export function ServiceEditor() {
  const { id = '' } = useParams();
  const content = useContent();
  const current = content.data?.services.find((s) => s.id === id);
  const initial = useMemo(() => (current ? (({ id: _id, category: _c, ...rest }) => rest)(current) : undefined), [current]);
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<ServiceEdit>(initial);
  const save = useSave();

  if (content.data && !current) return <ErrorBox message="Deze dienst bestaat niet." />;
  if (!draft || !content.data) return content.error ? <ErrorBox message={content.error} onRetry={content.reload} /> : <Loading />;
  const e = save.errors;
  const set = <K extends keyof ServiceEdit>(key: K, value: ServiceEdit[K]) => setDraft({ ...draft, [key]: value });
  const pick = (view: NonNullable<typeof content.data>) => {
    const s = view.services.find((x) => x.id === id)!;
    const { id: _id, category: _c, ...rest } = s;
    return rest;
  };

  async function submit() {
    const view = await save.run(() => content.save(`/admin/content/services/${id}`, draft));
    if (view) markSaved(pick(view));
  }

  async function restore() {
    if (!confirmAction('Deze dienst terugzetten naar de oorspronkelijke teksten en prijs?')) return;
    const view = await save.run(() => content.remove(`/admin/content/services/${id}`), 'Teruggezet');
    if (view) markSaved(pick(view));
  }

  return (
    <>
      <PageHeader
        title={draft.name || 'Dienst'}
        back={{ to: '/admin/diensten', label: 'Alle diensten' }}
        actions={
          !draft.hidden && (
            <a href={`/diensten/${id}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-medium hover:border-ink">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Bekijk op de site
            </a>
          )
        }
      />
      <div className="space-y-6">
        <Panel>
          <Toggle label="Tonen op de website" description="Uit = de dienst staat niet meer op de site en is niet te boeken." checked={!draft.hidden} onChange={(v) => set('hidden', !v)} />
        </Panel>

        <Panel title="Basis">
          <Input label="Naam" value={draft.name} error={e.name} onChange={(ev) => set('name', ev.target.value)} />
          <Input label="Slogan" value={draft.tagline} error={e.tagline} hint="Eén zin, staat op de kaart en bovenaan de pagina." onChange={(ev) => set('tagline', ev.target.value)} />
          <Textarea label="Korte samenvatting" rows={2} value={draft.summary} error={e.summary} hint="Voor het afspraakformulier en Google." onChange={(ev) => set('summary', ev.target.value)} />
          <div className="space-y-3">
            <Toggle label="Prijs op aanvraag" description="Geen vaste vanaf-prijs tonen." checked={draft.fromPrice === null} onChange={(v) => set('fromPrice', v ? null : 0)} />
            {draft.fromPrice !== null && <MoneyInput label="Vanaf-prijs" cents={draft.fromPrice} error={e.fromPrice} onChange={(v) => set('fromPrice', v ?? 0)} />}
          </div>
          <Toggle label="Ook op locatie mogelijk" description="Toont het label ‘Ook op locatie’ en ‘Op locatie of in de werkplaats’." checked={draft.onLocation} onChange={(v) => set('onLocation', v)} />
        </Panel>

        <Panel title="Foto">
          <ImageField label="Hoofdfoto" value={draft.image} onChange={(v) => v && set('image', v)} error={e.image} />
          <Input label="Omschrijving van de foto" value={draft.imageAlt} error={e.imageAlt} optional hint="Voor slechtzienden en Google, bijv. ‘Glascoating wordt uitgepoetst op een rode Ferrari’." onChange={(ev) => set('imageAlt', ev.target.value)} />
        </Panel>

        <Panel title="Uitleg">
          <LineList label="Alinea’s bij ‘Wat houdt het in?’" items={draft.intro} onChange={(v) => set('intro', v)} long addLabel="Alinea toevoegen" error={errorFor(e, 'intro')} max={6} />
          <LineList label="Wat is inbegrepen" items={draft.includes} onChange={(v) => set('includes', v)} placeholder="Bijv. Velgen en wielkasten reinigen" error={errorFor(e, 'includes')} max={12} />
        </Panel>

        <Panel title="Voordelen">
          <RecordList label="Voordelen" items={draft.benefits} onChange={(v) => set('benefits', v)} fields={[{ key: 'title', label: 'Titel' }, { key: 'text', label: 'Uitleg', long: true }]} empty={{ title: '', text: '' }} addLabel="Voordeel toevoegen" error={errorFor(e, 'benefits')} max={6} />
        </Panel>

        <Panel title="Werkwijze">
          <RecordList label="Stappen" items={draft.steps} onChange={(v) => set('steps', v)} fields={[{ key: 'title', label: 'Stap' }, { key: 'text', label: 'Uitleg', long: true }]} empty={{ title: '', text: '' }} addLabel="Stap toevoegen" error={errorFor(e, 'steps')} max={8} />
        </Panel>

        <Panel title="Veelgestelde vragen">
          <RecordList label="Vragen" items={draft.faq} onChange={(v) => set('faq', v)} fields={[{ key: 'q', label: 'Vraag' }, { key: 'a', label: 'Antwoord', long: true }]} empty={{ q: '', a: '' }} addLabel="Vraag toevoegen" error={errorFor(e, 'faq')} max={12} />
        </Panel>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={reset}
        extra={
          content.data.edited.services.includes(id) && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={restore}>
              Standaard herstellen
            </Button>
          )
        }
      />
    </>
  );
}
