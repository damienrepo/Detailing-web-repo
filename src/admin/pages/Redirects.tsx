import { ArrowRight, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { ErrorBox, Loading, PageHeader, Panel, useAdminData, useSave } from '../kit';
import { date } from './Orders';

type Redirect = { from: string; to: string; hits: number; lastHitAt: string | null; createdAt: string };
type NotFound = { path: string; hits: number; referrer: string | null; firstSeenAt: string; lastSeenAt: string };
type View = { redirects: Redirect[]; notFound: NotFound[]; pages: string[] };

/** SEO A3: pages that were requested but don't exist, and the 301 redirects that send them on. */
export function RedirectsPage() {
  const { data, setData, error, reload } = useAdminData<View>('/admin/redirects');
  const save = useSave();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ from: '', to: '' });

  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  async function add(from: string, to: string) {
    const view = await save.run(() => api<View>('/admin/redirects', { body: { from, to } }), 'Doorverwijzing opgeslagen');
    if (view) {
      setData(view);
      setForm({ from: '', to: '' });
      setTargets((t) => ({ ...t, [from]: '' }));
    }
  }

  async function remove(from: string) {
    if (!confirmAction(`Doorverwijzing van ${from} verwijderen?`)) return;
    const view = await save.run(() => api<View>(`/admin/redirects?from=${encodeURIComponent(from)}`, { method: 'DELETE' }), 'Doorverwijzing verwijderd');
    if (view) setData(view);
  }

  async function dismiss(path: string) {
    const view = await save.run(() => api<View>(`/admin/not-found?path=${encodeURIComponent(path)}`, { method: 'DELETE' }), 'Genegeerd');
    if (view) setData(view);
  }

  const pageList = (
    <datalist id="site-pages">
      {data.pages.map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  );

  return (
    <>
      <PageHeader
        title="Doorverwijzingen"
        description="Adressen die bezoekers of Google opvragen maar niet (meer) bestaan, zoals pagina’s van de oude website. Stuur ze door naar de juiste pagina; zo gaan er geen bezoekers en geen opgebouwde Google-posities verloren."
      />
      {pageList}
      {save.error && <ErrorBox message={save.error} />}

      <div className="space-y-6">
        <Panel title="Niet gevonden" description="Meest opgevraagd bovenaan. Doorverwijzen gebeurt permanent (301), zodat Google het nieuwe adres overneemt.">
          {data.notFound.length === 0 ? (
            <p className="text-sm text-stone-dark">Er zijn nog geen niet-bestaande pagina’s opgevraagd.</p>
          ) : (
            <ul className="divide-y divide-paper-3 border border-paper-3">
              {data.notFound.map((n) => (
                <li key={n.path} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{n.path}</p>
                    <p className="text-xs text-stone-dark">
                      {n.hits}× opgevraagd · laatst {date(n.lastSeenAt)}
                      {n.referrer && ` · via ${n.referrer}`}
                    </p>
                  </div>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (targets[n.path]) add(n.path, targets[n.path]);
                    }}
                  >
                    <ArrowRight className="h-4 w-4 shrink-0 text-stone-dark" aria-hidden />
                    <input
                      list="site-pages"
                      aria-label={`Doorverwijzen van ${n.path} naar`}
                      placeholder="/diensten/…"
                      value={targets[n.path] ?? ''}
                      onChange={(e) => setTargets((t) => ({ ...t, [n.path]: e.target.value }))}
                      className="h-10 w-56 border border-paper-3 bg-white px-3 font-mono text-sm outline-none focus:border-ink"
                    />
                    <Button type="submit" variant="dark" className="h-10 text-sm" disabled={!targets[n.path] || save.saving}>
                      Doorverwijzen
                    </Button>
                    <button type="button" onClick={() => dismiss(n.path)} className="px-2 text-sm text-stone-dark underline underline-offset-2 hover:text-ink">
                      Negeren
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Nieuwe doorverwijzing" description="Bijvoorbeeld als je een pagina een ander adres geeft, of een oud adres kent dat nog in Google staat.">
          <form
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              add(form.from, form.to);
            }}
          >
            <Input label="Oud adres" placeholder="/oude-pagina" value={form.from} error={save.errors.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            <Input label="Nieuw adres" placeholder="/diensten/ppf" list="site-pages" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <Button type="submit" variant="dark" className="h-12 text-sm" disabled={!form.from || !form.to || save.saving}>
              Opslaan
            </Button>
          </form>
        </Panel>

        <Panel title="Actieve doorverwijzingen">
          {data.redirects.length === 0 ? (
            <p className="text-sm text-stone-dark">Nog geen doorverwijzingen.</p>
          ) : (
            <ul className="divide-y divide-paper-3 border border-paper-3">
              {data.redirects.map((r) => (
                <li key={r.from} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
                      <span className="truncate">{r.from}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-dark" aria-hidden />
                      <span className="truncate">{r.to}</span>
                    </p>
                    <p className="text-xs text-stone-dark">{r.hits ? `${r.hits}× gebruikt, laatst ${date(r.lastHitAt!)}` : 'Nog niet gebruikt'}</p>
                  </div>
                  <button type="button" onClick={() => remove(r.from)} className="grid h-9 w-9 place-items-center text-stone-dark hover:text-danger" aria-label={`Doorverwijzing van ${r.from} verwijderen`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
