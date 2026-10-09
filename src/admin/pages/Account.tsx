import { Monitor, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Input, Notice } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type { AdminUser } from '../AdminApp';
import { ErrorBox, Loading, PageHeader, Panel, StatusBadge, useAdminData, useToast } from '../kit';
import { date } from './Orders';

type AccountResponse = {
  user: AdminUser;
  sessions: { current: boolean; createdAt: string; lastSeenAt: string; ip: string | null; device: string }[];
  audit: { action: string; detail: string | null; ip: string | null; created_at: string; user: string | null }[];
};

const ACTIONS: Record<string, string> = {
  login: 'Ingelogd',
  logout: 'Uitgelogd',
  login_failed: 'Mislukte inlogpoging',
  login_blocked: 'Inloggen tijdelijk geblokkeerd (te veel pogingen)',
  '2fa_failed': 'Onjuiste tweestapscode',
  '2fa_enabled': 'Tweestapsverificatie aangezet',
  '2fa_disabled': 'Tweestapsverificatie uitgezet',
  password_changed: 'Wachtwoord gewijzigd',
  password_reset: 'Wachtwoord gereset',
  sessions_revoked: 'Overal uitgelogd',
  account_created: 'Account aangemaakt',
  setup_failed: 'Onjuiste setupcode gebruikt',
  settings_changed: 'Instellingen gewijzigd',
  content_changed: 'Inhoud aangepast',
  content_reset: 'Inhoud teruggezet naar standaard',
  product_created: 'Product toegevoegd',
  product_changed: 'Product aangepast',
  product_deleted: 'Product verwijderd',
  post_created: 'Blogbericht aangemaakt',
  post_changed: 'Blogbericht aangepast',
  post_deleted: 'Blogbericht verwijderd',
  team_member_created: 'Teamlid toegevoegd',
  team_member_changed: 'Teamlid aangepast',
  team_member_deleted: 'Teamlid verwijderd',
  media_uploaded: 'Afbeelding geüpload',
  media_deleted: 'Afbeelding verwijderd',
};

const SETTING_LABELS: Record<string, string> = {
  mollieApiKey: 'Mollie API-key',
  smtpHost: 'SMTP-server',
  smtpPort: 'poort',
  smtpSecure: 'beveiliging',
  smtpUser: 'gebruikersnaam',
  smtpPass: 'mailwachtwoord',
  mailFrom: 'afzender',
  notifyEmail: 'meldingsadres',
};

const isWarning = (action: string) => /failed|blocked/.test(action);

function detailText(action: string, detail: string | null) {
  if (!detail) return '';
  if (action === 'settings_changed') return detail.split(', ').map((k) => SETTING_LABELS[k] ?? k).join(', ');
  return detail;
}

export function AccountPage({ user, onUserChange }: { user: AdminUser; onUserChange: (u: AdminUser) => void }) {
  const { data, error, reload } = useAdminData<AccountResponse>('/admin/account');
  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  return (
    <>
      <PageHeader title="Account & beveiliging" description={`Ingelogd als ${user.name} (${user.email}).`} />
      <div className="space-y-6">
        <TwoFactorPanel user={user} onChange={(enabled) => onUserChange({ ...user, totpEnabled: enabled })} />
        <PasswordPanel onDone={reload} />
        <SessionsPanel sessions={data.sessions} onChange={reload} />
        <Panel title="Activiteit" description="De laatste acties in het beheer. Een mislukte inlogpoging die jij niet was? Wijzig dan je wachtwoord en zet tweestapsverificatie aan.">
          <ul className="divide-y divide-paper-3 text-sm">
            {data.audit.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
                <span className={isWarning(a.action) ? 'text-danger' : ''}>
                  {ACTIONS[a.action] ?? a.action}
                  {a.detail && <span className="text-stone-dark"> · {detailText(a.action, a.detail)}</span>}
                </span>
                <span className="text-stone-dark">
                  {a.user ?? 'Onbekend'} · {date(a.created_at)}
                  {a.ip && ` · ${a.ip}`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function PasswordPanel({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', repeat: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.next !== form.repeat) return setErrors({ repeat: 'De twee nieuwe wachtwoorden zijn niet hetzelfde.' });
    setBusy(true);
    setErrors({});
    try {
      await api('/admin/account/password', { body: { current: form.current, next: form.next } });
      setForm({ current: '', next: '', repeat: '' });
      toast('Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.');
      onDone();
    } catch (err) {
      setErrors(err instanceof ApiError ? { ...err.fields, ...(Object.keys(err.fields).length ? {} : { next: err.message }) } : { next: 'Wijzigen is niet gelukt.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Wachtwoord wijzigen" description="Minimaal 12 tekens. Na het wijzigen word je op alle andere apparaten uitgelogd.">
      <form onSubmit={submit} className="max-w-md space-y-4">
        <Input label="Huidig wachtwoord" type="password" autoComplete="current-password" value={form.current} error={errors.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />
        <Input label="Nieuw wachtwoord" type="password" autoComplete="new-password" value={form.next} error={errors.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
        <Input label="Herhaal nieuw wachtwoord" type="password" autoComplete="new-password" value={form.repeat} error={errors.repeat} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))} />
        <Button type="submit" variant="dark" className="h-10 text-sm" disabled={busy || !form.current || form.next.length < 12}>
          {busy ? 'Bezig…' : 'Wachtwoord wijzigen'}
        </Button>
      </form>
    </Panel>
  );
}

function TwoFactorPanel({ user, onChange }: { user: AdminUser; onChange: (enabled: boolean) => void }) {
  const toast = useToast();
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'disable'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qr: string }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function call<T>(path: string, body: unknown) {
    setBusy(true);
    setError(undefined);
    try {
      return await api<T>(path, { body });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dat is niet gelukt.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setStep('idle');
    setPassword('');
    setCode('');
    setSetup(undefined);
    setError(undefined);
  };

  return (
    <Panel
      title="Tweestapsverificatie"
      description="Naast je wachtwoord vul je bij het inloggen een code in uit een app op je telefoon. Zelfs als iemand je wachtwoord weet, kan diegene dan niet inloggen."
    >
      <div className="flex items-center gap-3">
        {user.totpEnabled ? <ShieldCheck className="h-6 w-6 text-[#2f6b4f]" aria-hidden /> : <ShieldAlert className="h-6 w-6 text-accent-strong" aria-hidden />}
        {user.totpEnabled ? <StatusBadge tone="ok">Aan</StatusBadge> : <StatusBadge tone="warn">Uit: aanbevolen om aan te zetten</StatusBadge>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      {step === 'idle' &&
        (user.totpEnabled ? (
          <Button variant="outline-dark" className="h-10 text-sm" onClick={() => setStep('disable')}>
            Uitzetten
          </Button>
        ) : (
          <Button variant="dark" className="h-10 text-sm" onClick={() => setStep('password')}>
            Aanzetten
          </Button>
        ))}

      {step === 'password' && (
        <form
          className="max-w-md space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await call<{ secret: string; qr: string }>('/admin/account/2fa/start', { password });
            if (res) {
              setSetup(res);
              setStep('scan');
            }
          }}
        >
          <Input label="Bevestig met je wachtwoord" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" variant="dark" className="h-10 text-sm" disabled={busy || !password}>
              Verder
            </Button>
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={reset}>
              Annuleren
            </Button>
          </div>
        </form>
      )}

      {step === 'scan' && setup && (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call('/admin/account/2fa/confirm', { code })) {
              toast('Tweestapsverificatie staat aan');
              onChange(true);
              reset();
            }
          }}
        >
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
            <li>Installeer een authenticator-app, bijvoorbeeld Google Authenticator, Microsoft Authenticator of 1Password.</li>
            <li>Scan deze QR-code met de app.</li>
            <li>Vul de code van 6 cijfers in die de app nu toont.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-6">
            <img src={setup.qr} alt="QR-code voor je authenticator-app" className="h-48 w-48 border border-paper-3 bg-white p-2" />
            <div className="text-sm text-stone-dark">
              Lukt scannen niet? Vul deze sleutel handmatig in:
              <p className="mt-2 select-all font-mono text-base tracking-wider text-ink">{setup.secret}</p>
            </div>
          </div>
          <div className="max-w-xs">
            <Input
              label="Code uit de app"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="font-mono text-lg tracking-[0.3em]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="dark" className="h-10 text-sm" disabled={busy || code.length !== 6}>
              Aanzetten
            </Button>
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={reset}>
              Annuleren
            </Button>
          </div>
        </form>
      )}

      {step === 'disable' && (
        <form
          className="max-w-md space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await call('/admin/account/2fa/disable', { password, code })) {
              toast('Tweestapsverificatie staat uit');
              onChange(false);
              reset();
            }
          }}
        >
          <Input label="Je wachtwoord" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label="Code uit je authenticator-app" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
          <div className="flex gap-2">
            <Button type="submit" variant="dark" className="h-10 text-sm" disabled={busy || !password || code.length !== 6}>
              Uitzetten
            </Button>
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={reset}>
              Annuleren
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function SessionsPanel({ sessions, onChange }: { sessions: AccountResponse['sessions']; onChange: () => void }) {
  const toast = useToast();
  const others = sessions.filter((s) => !s.current).length;
  return (
    <Panel title="Ingelogde apparaten" description="Je wordt automatisch uitgelogd na 2 uur zonder activiteit, en altijd na 12 uur.">
      <ul className="divide-y divide-paper-3">
        {sessions.map((s, i) => (
          <li key={i} className="flex items-center gap-3 py-3 text-sm">
            <Monitor className="h-5 w-5 shrink-0 text-stone-dark" strokeWidth={1.5} aria-hidden />
            <div className="flex-1">
              <p className="font-medium">
                {s.device} {s.current && <StatusBadge tone="ok">Dit apparaat</StatusBadge>}
              </p>
              <p className="text-stone-dark">
                Laatst actief {date(s.lastSeenAt)}
                {s.ip && ` · ${s.ip}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {others > 0 && (
        <Button
          variant="outline-dark"
          className="h-10 text-sm"
          onClick={async () => {
            await api('/admin/account/sessions/revoke-others', { body: {} });
            toast('Andere apparaten zijn uitgelogd');
            onChange();
          }}
        >
          Log uit op alle andere apparaten ({others})
        </Button>
      )}
    </Panel>
  );
}
