import { Check, Copy, ShieldCheck, ShieldOff, Trash2, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Input, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { ErrorBox, Loading, PageHeader, Panel, StatusBadge, useAdminData, useSave } from '../kit';
import { date } from './Orders';

type Admin = { id: number; name: string; email: string; totpEnabled: boolean; lastLoginAt: string | null; createdAt: string; isYou: boolean };

/** Everyone who can sign in to the admin, and adding or removing someone (e.g. a business partner). */
export function AdminsPage() {
  const { data, error, reload } = useAdminData<Admin[]>('/admin/admins');
  const save = useSave();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [created, setCreated] = useState<{ name: string; email: string; password: string }>();
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<number>();
  const [removePassword, setRemovePassword] = useState('');

  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  async function add(e: FormEvent) {
    e.preventDefault();
    const result = await save.run(() => api<{ user: Admin; password: string }>('/admin/admins', { body: form }), 'Beheerder toegevoegd');
    if (!result) return;
    setCreated({ name: result.user.name, email: result.user.email, password: result.password });
    setCopied(false);
    setForm({ name: '', email: '', password: '' });
    reload();
  }

  async function remove(admin: Admin) {
    const ok = await save.run(() => api(`/admin/admins/${admin.id}/remove`, { body: { password: removePassword } }), `${admin.name} verwijderd`);
    if (!ok) return;
    setRemoving(undefined);
    setRemovePassword('');
    reload();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* the password stays visible to copy by hand */
    }
  }

  return (
    <>
      <PageHeader title="Beheerders" description="Iedereen die kan inloggen in het beheer. Elke beheerder heeft een eigen account en kan alles in het beheer; acties staan per persoon in het activiteitenlog." />

      <div className="space-y-6">
        <Panel>
          <ul className="divide-y divide-paper-3 border border-paper-3">
            {data.map((a) => (
              <li key={a.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.name} {a.isYou && <span className="text-sm font-normal text-stone-dark">(jij)</span>}
                    </p>
                    <p className="truncate text-sm text-stone-dark">{a.email}</p>
                    <p className="text-xs text-stone-dark">{a.lastLoginAt ? `Laatst ingelogd ${date(a.lastLoginAt)}` : 'Nog nooit ingelogd'}</p>
                  </div>
                  {a.totpEnabled ? (
                    <StatusBadge tone="ok">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Tweestapsverificatie aan
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="warn">
                      <ShieldOff className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Tweestapsverificatie uit
                    </StatusBadge>
                  )}
                  {!a.isYou && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoving(removing === a.id ? undefined : a.id);
                        setRemovePassword('');
                      }}
                      className="grid h-9 w-9 place-items-center text-stone-dark hover:text-danger"
                      aria-label={`${a.name} verwijderen`}
                      title="Verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {removing === a.id && (
                  <form
                    className="mt-4 flex flex-wrap items-end gap-3 border-t border-paper-3 pt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      remove(a);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <Input
                        label={`Bevestig met jouw wachtwoord om ${a.name} te verwijderen`}
                        type="password"
                        autoComplete="current-password"
                        value={removePassword}
                        error={save.errors.password}
                        onChange={(e) => setRemovePassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" variant="dark" className="h-12 text-sm hover:bg-danger" disabled={!removePassword || save.saving}>
                      Verwijderen
                    </Button>
                    <button type="button" onClick={() => setRemoving(undefined)} className="h-12 px-2 text-sm underline underline-offset-2">
                      Annuleren
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        {created && (
          <Panel title={`${created.name} kan nu inloggen`}>
            <p className="text-[15px] leading-relaxed">
              Geef deze gegevens persoonlijk door (bijvoorbeeld via WhatsApp). Het wachtwoord zie je <strong>maar één keer</strong>.
            </p>
            <div className="space-y-2 border border-paper-3 bg-paper p-4 text-sm">
              <p>
                <span className="text-stone-dark">Inloggen op:</span> {location.origin}/admin
              </p>
              <p>
                <span className="text-stone-dark">E-mailadres:</span> {created.email}
              </p>
              <p className="flex flex-wrap items-center gap-3">
                <span className="text-stone-dark">Tijdelijk wachtwoord:</span>
                <code className="bg-white px-2 py-1 font-mono text-base">{created.password}</code>
                <button type="button" onClick={() => copy(created.password)} className="inline-flex items-center gap-1 underline underline-offset-2">
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? 'Gekopieerd' : 'Kopiëren'}
                </button>
              </p>
            </div>
            <Notice>
              Laat {created.name.split(' ')[0]} na de eerste keer inloggen onder <strong>Account &amp; beveiliging</strong> een eigen wachtwoord kiezen en tweestapsverificatie aanzetten.
            </Notice>
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={() => setCreated(undefined)}>
              Ik heb het doorgegeven
            </Button>
          </Panel>
        )}

        <Panel title="Beheerder toevoegen" description="Bijvoorbeeld je compagnon. Er wordt een sterk tijdelijk wachtwoord voor gemaakt, dat je daarna doorgeeft.">
          <form onSubmit={add} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Naam" autoComplete="off" value={form.name} error={save.errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="E-mailadres" type="email" autoComplete="off" value={form.email} error={save.errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <Input
              label="Bevestig met jouw wachtwoord"
              type="password"
              autoComplete="current-password"
              value={form.password}
              error={removing === undefined ? save.errors.password : undefined}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {save.error && removing === undefined && <Notice tone="error">{save.error}</Notice>}
            <Button type="submit" variant="dark" className="h-11 text-sm" disabled={!form.name || !form.email || !form.password || save.saving}>
              <UserPlus className="h-4 w-4" aria-hidden />
              {save.saving ? 'Bezig…' : 'Beheerder toevoegen'}
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
