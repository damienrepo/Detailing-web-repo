import { Bold, ChevronRight, ExternalLink, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Plus, Quote, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { readingMinutes, slugify, type AdminPost } from '../../../shared/blog';
import { Button, ButtonLink, Input, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { imageUrl } from '../../lib/images';
import { Markdown } from '../../lib/markdown';
import { ErrorBox, ImageField, Loading, PageHeader, Panel, SaveBar, StatusBadge, Toggle, useAdminData, useDraft, useSave } from '../kit';
import { MediaPicker } from '../media';
import { date } from './Orders';

const today = () => new Date().toISOString().slice(0, 10);

function postStatus(p: Pick<AdminPost, 'status' | 'publishedAt'>) {
  if (p.status === 'draft') return <StatusBadge tone="muted">Concept</StatusBadge>;
  if (p.publishedAt && p.publishedAt > today()) return <StatusBadge tone="accent">Gepland: {new Date(p.publishedAt).toLocaleDateString('nl-NL')}</StatusBadge>;
  return <StatusBadge tone="ok">Gepubliceerd</StatusBadge>;
}

export function PostsPage() {
  const { data, error, reload } = useAdminData<AdminPost[]>('/admin/posts');
  return (
    <>
      <PageHeader
        title="Blog"
        description="Schrijf over je werk, geef onderhoudstips of laat een project zien. Goed voor klanten én voor je vindbaarheid in Google."
        actions={
          <ButtonLink to="/admin/blog/nieuw" variant="dark" className="h-10 text-sm">
            <Plus className="h-4 w-4" aria-hidden />
            Nieuw bericht
          </ButtonLink>
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data ? (
        !error && <Loading />
      ) : data.length === 0 ? (
        <Panel>
          <p className="text-[15px]">Je hebt nog geen blogberichten.</p>
          <p className="text-sm text-stone-dark">Ideeën: ‘5 tips om je auto de winter door te helpen’, ‘Wat is het verschil tussen wax en een coating?’, of een voor-en-na van een mooie klus.</p>
          <ButtonLink to="/admin/blog/nieuw" variant="dark" className="h-10 text-sm">
            Schrijf je eerste bericht
          </ButtonLink>
        </Panel>
      ) : (
        <ul className="divide-y divide-paper-3 border border-paper-3 bg-white">
          {data.map((p) => (
            <li key={p.id}>
              <Link to={`/admin/blog/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-paper/60">
                <div className="h-14 w-20 shrink-0 overflow-hidden bg-paper-2">{p.cover && <img src={imageUrl(p.cover, 'sm')} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-sm text-stone-dark">Laatst bewerkt {date(p.updatedAt)}</p>
                </div>
                {postStatus(p)}
                <ChevronRight className="h-4 w-4 text-stone-dark" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type Draft = Omit<AdminPost, 'id' | 'createdAt' | 'updatedAt'>;
const EMPTY: Draft = { title: '', slug: '', excerpt: '', body: '', cover: null, status: 'draft', publishedAt: null };

/** Toolbar that inserts Markdown around the selection, so nobody has to learn the syntax. */
function Editor({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [picking, setPicking] = useState(false);

  function wrap(before: string, after = before, placeholder = 'tekst') {
    const el = ref.current!;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function linePrefix(prefix: string) {
    const el = ref.current!;
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const end = value.indexOf('\n', el.selectionEnd);
    const block = value.slice(start, end === -1 ? undefined : end);
    const lines = block.split('\n').map((l, i) => (prefix === '1. ' ? `${i + 1}. ` : prefix) + l.replace(/^(#{2,3}\s|[-*]\s|\d+\.\s|>\s?)/, ''));
    onChange(value.slice(0, start) + lines.join('\n') + (end === -1 ? '' : value.slice(end)));
    requestAnimationFrame(() => el.focus());
  }

  function insertBlock(text: string) {
    const el = ref.current!;
    const pos = el.selectionEnd;
    const before = value.slice(0, pos);
    const sep = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    onChange(before + sep + text + '\n\n' + value.slice(pos));
  }

  const tools = [
    { icon: Heading2, label: 'Kop', run: () => linePrefix('## ') },
    { icon: Heading3, label: 'Subkop', run: () => linePrefix('### ') },
    { icon: Bold, label: 'Vet', run: () => wrap('**') },
    { icon: Italic, label: 'Cursief', run: () => wrap('*') },
    { icon: List, label: 'Opsomming', run: () => linePrefix('- ') },
    { icon: ListOrdered, label: 'Genummerde lijst', run: () => linePrefix('1. ') },
    { icon: Quote, label: 'Citaat', run: () => linePrefix('> ') },
    {
      icon: Link2,
      label: 'Link',
      run: () => {
        const url = window.prompt('Naar welke pagina moet de link gaan? Bijv. https://… of /diensten/coatings');
        if (url) wrap('[', `](${url.trim()})`, 'linktekst');
      },
    },
    { icon: ImagePlus, label: 'Afbeelding', run: () => setPicking(true) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border border-b-0 border-paper-3 bg-paper px-2 py-1.5">
        <div className="flex flex-wrap" role="toolbar" aria-label="Opmaak">
          {tools.map(({ icon: Icon, label, run }) => (
            <button key={label} type="button" onClick={run} disabled={tab === 'preview'} title={label} aria-label={label} className="grid h-9 w-9 place-items-center text-stone-dark hover:bg-white hover:text-ink disabled:opacity-30">
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="flex text-sm">
          {(['write', 'preview'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 ${tab === t ? 'bg-ink text-paper' : 'hover:bg-white'}`}>
              {t === 'write' ? 'Schrijven' : 'Voorbeeld'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Tekst van het bericht"
          placeholder="Begin hier met schrijven. Een lege regel begint een nieuwe alinea. Gebruik de knoppen hierboven voor koppen, vet, lijstjes, links en foto’s."
          className="block min-h-[28rem] w-full border border-paper-3 bg-white p-4 font-mono text-[15px] leading-relaxed outline-none focus:border-ink"
        />
      ) : (
        <div className="min-h-[28rem] border border-paper-3 bg-white p-6 text-[17px] leading-[1.75]">{value.trim() ? <Markdown source={value} /> : <p className="text-stone-dark">Nog niets om te tonen.</p>}</div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-2 text-sm text-stone-dark">
        {value.split(/\s+/).filter(Boolean).length} woorden · ± {readingMinutes(value)} min lezen
      </p>
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onSelect={(ref) => {
            insertBlock(`![Omschrijving van de foto](${ref})`);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

export function PostEditor() {
  const { id = '' } = useParams();
  const isNew = id === 'nieuw';
  const navigate = useNavigate();
  const loaded = useAdminData<AdminPost>(isNew ? null : `/admin/posts/${id}`);
  const initial = useMemo<Draft | undefined>(() => {
    if (isNew) return EMPTY;
    if (!loaded.data) return undefined;
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = loaded.data;
    return rest;
  }, [isNew, loaded.data]);
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<Draft>(initial);
  const save = useSave();
  const [slugTouched, setSlugTouched] = useState(!isNew);

  if (!isNew && loaded.error) return <ErrorBox message={loaded.error} />;
  if (!draft) return <Loading />;
  const e = save.errors;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });
  const scheduled = draft.status === 'published' && draft.publishedAt && draft.publishedAt > today();

  async function submit(status = draft!.status) {
    const body = { ...draft!, status, slug: draft!.slug || slugify(draft!.title) };
    const post = await save.run(
      () => (isNew ? api<AdminPost>('/admin/posts', { body }) : api<AdminPost>(`/admin/posts/${id}`, { method: 'PUT', body })),
      status === 'published' && draft!.status === 'draft' ? 'Gepubliceerd!' : 'Opgeslagen',
    );
    if (!post) return;
    const { id: newId, createdAt: _c, updatedAt: _u, ...rest } = post;
    markSaved(rest);
    if (isNew) navigate(`/admin/blog/${newId}`, { replace: true });
  }

  async function remove() {
    if (!confirmAction(`"${draft!.title || 'Dit bericht'}" definitief verwijderen?`)) return;
    if (await save.run(() => api(`/admin/posts/${id}`, { method: 'DELETE' }), 'Bericht verwijderd')) {
      markSaved(draft!);
      navigate('/admin/blog');
    }
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'Nieuw bericht' : draft.title || 'Bericht'}
        back={{ to: '/admin/blog', label: 'Alle berichten' }}
        actions={
          !isNew && (
            <div className="flex items-center gap-3">
              {postStatus(draft)}
              {draft.status === 'published' && !scheduled && (
                <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-medium hover:border-ink">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Bekijk op de site
                </a>
              )}
            </div>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <Input
              label="Titel"
              value={draft.title}
              error={e.title}
              className="text-xl font-semibold"
              onChange={(ev) => setDraft({ ...draft, title: ev.target.value, ...(slugTouched ? {} : { slug: slugify(ev.target.value) }) })}
            />
            <Textarea label="Inleiding" rows={2} value={draft.excerpt} error={e.excerpt} hint="1–2 zinnen. Staat op de blogkaart en vaak in Google." onChange={(ev) => set('excerpt', ev.target.value)} />
          </Panel>
          <Editor value={draft.body} onChange={(v) => set('body', v)} error={e.body} />
        </div>

        <div className="space-y-6">
          <Panel title="Publiceren">
            <Toggle label="Gepubliceerd" description={draft.status === 'published' ? 'Zichtbaar op de site.' : 'Concept: alleen jij ziet dit.'} checked={draft.status === 'published'} onChange={(v) => setDraft({ ...draft, status: v ? 'published' : 'draft', publishedAt: v ? (draft.publishedAt ?? today()) : draft.publishedAt })} />
            <Input
              label="Publicatiedatum"
              type="date"
              value={draft.publishedAt ?? ''}
              error={e.publishedAt}
              hint={scheduled ? 'Datum in de toekomst: het bericht verschijnt dan automatisch.' : 'Kies een datum in de toekomst om in te plannen.'}
              onChange={(ev) => set('publishedAt', ev.target.value || null)}
            />
            {draft.status === 'draft' && (
              <Button type="button" variant="accent" className="h-10 w-full text-sm" disabled={save.saving || !draft.title} onClick={() => submit('published')}>
                Opslaan en publiceren
              </Button>
            )}
          </Panel>
          <Panel title="Omslagfoto">
            <ImageField label="Foto" value={draft.cover} optional onChange={(v) => set('cover', v)} error={e.cover} />
          </Panel>
          <Panel title="Webadres">
            <Input
              label="Adres"
              value={draft.slug}
              error={e.slug}
              hint={`detail2go.nl/blog/${draft.slug || '…'}`}
              onChange={(ev) => {
                setSlugTouched(true);
                set('slug', slugify(ev.target.value));
              }}
            />
          </Panel>
          {!isNew && (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-sm text-stone-dark hover:text-danger">
              <Trash2 className="h-4 w-4" aria-hidden />
              Bericht verwijderen
            </button>
          )}
        </div>
      </div>

      <SaveBar dirty={dirty || (isNew && Boolean(draft.title))} saving={save.saving} error={save.error} onSave={() => submit()} onReset={reset} />
    </>
  );
}
