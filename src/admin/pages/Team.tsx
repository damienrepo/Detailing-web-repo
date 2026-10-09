import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Plus, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { AdminTeamMember } from '../../../shared/team';
import { ButtonLink, Input, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { imageUrl } from '../../lib/images';
import { ErrorBox, errorFor, ImageField, Loading, PageHeader, Panel, RecordList, SaveBar, StatusBadge, Toggle, useAdminData, useDraft, useSave, useToast } from '../kit';

export function TeamPage() {
  const { data, setData, error, reload } = useAdminData<AdminTeamMember[]>('/admin/team');
  const toast = useToast();
  const [orderError, setOrderError] = useState<string>();

  async function reorder(from: number, to: number) {
    const ids = data!.map((m) => m.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setOrderError(undefined);
    try {
      setData(await api<AdminTeamMember[]>('/admin/team-order', { method: 'PUT', body: { ids } }));
      toast('Volgorde opgeslagen');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Opslaan is niet gelukt.');
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Stel jezelf en je collega’s voor op de teampagina. Met een foto, je rol en een persoonlijk verhaal weten klanten wie er aan hun auto werkt."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="/team" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 border border-ink/25 px-4 text-sm font-medium hover:border-ink">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Bekijk op de site
            </a>
            <ButtonLink to="/admin/team/nieuw" variant="dark" className="h-10 text-sm">
              <Plus className="h-4 w-4" aria-hidden />
              Teamlid toevoegen
            </ButtonLink>
          </div>
        }
      />
      {(error || orderError) && <ErrorBox message={(error || orderError)!} onRetry={error ? reload : undefined} />}
      {!data ? (
        !error && <Loading />
      ) : data.length === 0 ? (
        <Panel>
          <p className="text-[15px]">Er staan nog geen teamleden op de site.</p>
          <p className="text-sm text-stone-dark">Begin met jezelf: een mooie foto, je rol binnen Detail2Go en hoe je ooit begonnen bent met auto’s.</p>
          <ButtonLink to="/admin/team/nieuw" variant="dark" className="h-10 text-sm">
            Voeg het eerste teamlid toe
          </ButtonLink>
        </Panel>
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-dark">De volgorde hier is de volgorde op de site.</p>
          <ul className="divide-y divide-paper-3 border border-paper-3 bg-white">
            {data.map((m, i) => (
              <li key={m.id} className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <button type="button" className="grid h-7 w-7 place-items-center text-stone-dark hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => reorder(i, i - 1)} aria-label={`${m.name} omhoog`}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className="grid h-7 w-7 place-items-center text-stone-dark hover:text-ink disabled:opacity-30" disabled={i === data.length - 1} onClick={() => reorder(i, i + 1)} aria-label={`${m.name} omlaag`}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <Link to={`/admin/team/${m.id}`} className="flex flex-1 items-center gap-4 p-1 hover:bg-paper/60">
                  <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden bg-paper-2 ${m.visible ? '' : 'opacity-40'}`}>
                    {m.photo ? <img src={imageUrl(m.photo, 'sm')} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-stone" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-sm text-stone-dark">{m.role}</p>
                  </div>
                  {m.visible ? <StatusBadge tone="ok">Zichtbaar</StatusBadge> : <StatusBadge tone="muted">Verborgen</StatusBadge>}
                  <ChevronRight className="h-4 w-4 text-stone-dark" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

type Draft = Pick<AdminTeamMember, 'name' | 'role' | 'bio' | 'quote' | 'photo' | 'facts' | 'visible'>;
const EMPTY: Draft = { name: '', role: '', bio: '', quote: '', photo: null, facts: [], visible: true };

const toDraft = ({ name, role, bio, quote, photo, facts, visible }: AdminTeamMember): Draft => ({ name, role, bio, quote, photo, facts, visible });

export function TeamMemberEditor() {
  const { id = '' } = useParams();
  const isNew = id === 'nieuw';
  const navigate = useNavigate();
  const loaded = useAdminData<AdminTeamMember>(isNew ? null : `/admin/team/${id}`);
  const initial = useMemo<Draft | undefined>(() => (isNew ? EMPTY : loaded.data && toDraft(loaded.data)), [isNew, loaded.data]);
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<Draft>(initial);
  const save = useSave();

  if (!isNew && loaded.error) return <ErrorBox message={loaded.error} />;
  if (!draft) return <Loading />;
  const e = save.errors;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  async function submit() {
    const member = await save.run(() => (isNew ? api<AdminTeamMember>('/admin/team', { body: draft }) : api<AdminTeamMember>(`/admin/team/${id}`, { method: 'PUT', body: draft })));
    if (!member) return;
    markSaved(toDraft(member));
    if (isNew) navigate(`/admin/team/${member.id}`, { replace: true });
  }

  async function remove() {
    if (!confirmAction(`"${draft!.name || 'Dit teamlid'}" van de teampagina verwijderen?`)) return;
    if (await save.run(() => api(`/admin/team/${id}`, { method: 'DELETE' }), 'Teamlid verwijderd')) {
      markSaved(draft!);
      navigate('/admin/team');
    }
  }

  return (
    <>
      <PageHeader title={isNew ? 'Nieuw teamlid' : draft.name || 'Teamlid'} back={{ to: '/admin/team', label: 'Hele team' }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <Input label="Naam" value={draft.name} error={e.name} className="text-xl font-semibold" placeholder="Bijv. Damiën van der Veen" onChange={(ev) => set('name', ev.target.value)} />
            <Input label="Rol binnen Detail2Go" value={draft.role} error={e.role} placeholder="Bijv. Medeoprichter & coatingspecialist" onChange={(ev) => set('role', ev.target.value)} />
            <Textarea
              label="Persoonlijke quote"
              optional
              rows={2}
              value={draft.quote}
              error={e.quote}
              placeholder="Bijv. “Een auto is pas klaar als ik hem zelf zou willen hebben.”"
              hint="Eén zin die bij je past. Staat groot op de pagina."
              onChange={(ev) => set('quote', ev.target.value)}
            />
          </Panel>
          <Panel title="Verhaal" description="Vertel wie je bent: hoe je met auto’s begon, wat je het mooiste werk vindt en wat je buiten de werkplaats doet. Een lege regel begint een nieuwe alinea.">
            <Textarea label="Verhaal" rows={10} value={draft.bio} error={e.bio} onChange={(ev) => set('bio', ev.target.value)} />
          </Panel>
          <Panel title="Leuke weetjes" description="Kleine feitjes die op de kaart staan. Maximaal 4.">
            <RecordList
              label="Weetjes"
              items={draft.facts}
              onChange={(v) => set('facts', v)}
              fields={[
                { key: 'label', label: 'Onderwerp', placeholder: 'Bijv. Droomauto' },
                { key: 'value', label: 'Antwoord', placeholder: 'Bijv. Porsche 911 GT3 RS' },
              ]}
              empty={{ label: '', value: '' }}
              addLabel="Weetje toevoegen"
              error={errorFor(e, 'facts')}
              max={4}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Zichtbaarheid">
            <Toggle label="Op de teampagina" description={draft.visible ? 'Zichtbaar voor bezoekers.' : 'Verborgen: alleen jij ziet dit.'} checked={draft.visible} onChange={(v) => set('visible', v)} />
          </Panel>
          <Panel title="Foto">
            <ImageField label="Portretfoto" hint="Staand werkt het mooist, bijv. in de werkplaats of naast een auto." value={draft.photo} optional onChange={(v) => set('photo', v)} error={e.photo} />
          </Panel>
          {!isNew && (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-sm text-stone-dark hover:text-danger">
              <Trash2 className="h-4 w-4" aria-hidden />
              Teamlid verwijderen
            </button>
          )}
        </div>
      </div>

      <SaveBar dirty={dirty || (isNew && Boolean(draft.name))} saving={save.saving} error={save.error} onSave={submit} onReset={reset} />
    </>
  );
}
