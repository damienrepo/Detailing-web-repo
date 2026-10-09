import { CheckCircle2, ExternalLink, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Input, Select } from '../../components/ui';
import { api } from '../../lib/api';
import { ErrorBox, Loading, PageHeader, Panel, SaveBar, StatusBadge, useAdminData, useSave, useUnsavedWarning, useToast } from '../kit';

type Field = { value?: string; hint?: string; set: boolean; fromEnv: boolean };
type Key = 'mollieApiKey' | 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'smtpUser' | 'smtpPass' | 'mailFrom' | 'notifyEmail';
export type SettingsResponse = { values: Record<Key, Field>; payments: 'live' | 'test' | 'mock' | 'off'; webhooks: boolean };

const PLAIN: Key[] = ['smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'mailFrom', 'notifyEmail'];

function EnvNote() {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-stone-dark">
      <Lock className="h-3.5 w-3.5" aria-hidden />
      Ingesteld op de server (omgevingsvariabele) en hier niet te wijzigen.
    </p>
  );
}

/** Write-only field: shows whether a secret is set, never its value. */
function SecretField({ label, field, value, onChange, placeholder, hint, error }: { label: string; field: Field; value: string | undefined; onChange: (v: string | undefined) => void; placeholder: string; hint?: string; error?: string }) {
  if (field.fromEnv) {
    return (
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <p className="mt-1 font-mono text-sm">{field.hint}</p>
        <EnvNote />
      </div>
    );
  }
  if (value === undefined && field.set) {
    return (
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 border border-paper-3 bg-paper px-3 py-2 font-mono text-sm">
            <CheckCircle2 className="h-4 w-4 text-[#2f6b4f]" aria-hidden />
            {field.hint}
          </span>
          <button type="button" className="text-sm font-medium underline underline-offset-2" onClick={() => onChange('')}>
            Vervangen
          </button>
          <button type="button" className="text-sm text-stone-dark underline underline-offset-2 hover:text-danger" onClick={() => onChange('__remove__')}>
            Verwijderen
          </button>
        </div>
        {hint && <p className="mt-1.5 text-sm text-stone-dark">{hint}</p>}
      </div>
    );
  }
  if (value === '__remove__') {
    return (
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <p className="mt-2 text-sm text-danger">
          Wordt verwijderd bij opslaan.{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => onChange(undefined)}>
            Toch bewaren
          </button>
        </p>
      </div>
    );
  }
  return (
    <Input
      label={label}
      type="password"
      autoComplete="off"
      spellCheck={false}
      value={value ?? ''}
      placeholder={placeholder}
      hint={hint}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SettingsPage() {
  const toast = useToast();
  const { data, setData, error, reload } = useAdminData<SettingsResponse>('/admin/settings');
  const [plain, setPlain] = useState<Partial<Record<Key, string>>>({});
  const [secrets, setSecrets] = useState<Partial<Record<'mollieApiKey' | 'smtpPass', string>>>({});
  const save = useSave();
  const [testing, setTesting] = useState<'mollie' | 'mail'>();
  const [testResult, setTestResult] = useState<{ kind: 'mollie' | 'mail'; ok: boolean; message: string }>();

  useEffect(() => {
    if (!data) return;
    setPlain(Object.fromEntries(PLAIN.map((k) => [k, data.values[k].value ?? (k === 'smtpSecure' ? 'false' : '')])));
    setSecrets({});
  }, [data]);

  const original = data ? Object.fromEntries(PLAIN.map((k) => [k, data.values[k].value ?? (k === 'smtpSecure' ? 'false' : '')])) : {};
  const changedPlain = PLAIN.filter((k) => !data?.values[k].fromEnv && (plain[k] ?? '') !== (original[k] ?? ''));
  const changedSecrets = (Object.keys(secrets) as ('mollieApiKey' | 'smtpPass')[]).filter((k) => secrets[k] !== undefined && secrets[k] !== '');
  const dirty = changedPlain.length + changedSecrets.length > 0;
  useUnsavedWarning(dirty);

  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;
  const v = data.values;

  async function submit() {
    const body: Record<string, string> = {};
    for (const k of changedPlain) body[k] = plain[k] ?? '';
    for (const k of changedSecrets) body[k] = secrets[k] === '__remove__' ? '' : secrets[k]!;
    const result = await save.run(() => api<SettingsResponse>('/admin/settings', { method: 'PUT', body }));
    if (result) setData(result);
  }

  async function test(kind: 'mollie' | 'mail') {
    setTesting(kind);
    setTestResult(undefined);
    try {
      if (kind === 'mollie') {
        const typed = secrets.mollieApiKey && secrets.mollieApiKey !== '__remove__' ? secrets.mollieApiKey : undefined;
        const res = await api<{ mode: string }>('/admin/settings/test-mollie', { body: { apiKey: typed } });
        setTestResult({ kind, ok: true, message: `De koppeling met Mollie werkt (${res.mode === 'live' ? 'live: echte betalingen' : 'testmodus'}).` });
      } else {
        const res = await api<{ to: string }>('/admin/settings/test-mail', { body: {} });
        setTestResult({ kind, ok: true, message: `Testmail verstuurd naar ${res.to}. Kijk ook in je spam.` });
        toast('Testmail verstuurd');
      }
    } catch (err) {
      setTestResult({ kind, ok: false, message: err instanceof Error ? err.message : 'De test is mislukt.' });
    } finally {
      setTesting(undefined);
    }
  }

  const plainInput = (k: Key, label: string, props: { placeholder?: string; hint?: string; type?: string } = {}) =>
    v[k].fromEnv ? (
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <p className="mt-1 text-sm">{v[k].value}</p>
        <EnvNote />
      </div>
    ) : (
      <Input label={label} value={plain[k] ?? ''} error={save.errors[k]} {...props} onChange={(e) => setPlain((p) => ({ ...p, [k]: e.target.value }))} />
    );

  const result = (kind: 'mollie' | 'mail') =>
    testResult?.kind === kind && <p className={`text-sm ${testResult.ok ? 'text-[#2f6b4f]' : 'text-danger'}`}>{testResult.message}</p>;

  const paymentBadge = {
    live: <StatusBadge tone="ok">Live: echte betalingen</StatusBadge>,
    test: <StatusBadge tone="accent">Testmodus</StatusBadge>,
    mock: <StatusBadge tone="muted">Niet gekoppeld: oefenbetaalpagina</StatusBadge>,
    off: <StatusBadge tone="warn">Niet gekoppeld: afrekenen staat uit</StatusBadge>,
  }[data.payments];

  return (
    <>
      <PageHeader
        title="Betalingen & e-mail"
        description="Koppel Mollie voor online betalingen en je e-mailprovider voor bevestigingsmails. Wachtwoorden en sleutels worden versleuteld opgeslagen en zijn hierna nooit meer zichtbaar."
      />

      <div className="space-y-6">
        <Panel
          title="Mollie (online betalen)"
          description={
            <>
              Je vindt je API-key in het{' '}
              <a href="https://my.mollie.com/dashboard/developers/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                Mollie-dashboard <ExternalLink className="h-3 w-3" aria-hidden />
              </a>{' '}
              onder Developers → API keys. Begin met de <strong>test_</strong> key; zet pas na een geslaagde testbestelling de <strong>live_</strong> key.
            </>
          }
        >
          <div className="flex items-center gap-2 text-sm">Status: {paymentBadge}</div>
          <SecretField
            label="API-key"
            field={v.mollieApiKey}
            value={secrets.mollieApiKey}
            onChange={(val) => setSecrets((s) => ({ ...s, mollieApiKey: val }))}
            placeholder="test_… of live_…"
            error={save.errors.mollieApiKey}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={() => test('mollie')} disabled={testing === 'mollie' || (!v.mollieApiKey.set && !secrets.mollieApiKey)}>
              {testing === 'mollie' ? 'Testen…' : 'Test de koppeling'}
            </Button>
            {result('mollie')}
          </div>
          {!data.webhooks && (
            <p className="text-sm leading-relaxed text-stone-dark">
              Let op: Mollie kan de betaalstatus pas automatisch doorgeven zodra de site op een openbaar https-adres staat (APP_URL). Tot die tijd wordt de status bijgewerkt als de klant terugkomt op de bestelpagina.
            </p>
          )}
        </Panel>

        <Panel
          title="E-mail versturen (SMTP)"
          description="Deze gegevens krijg je van je e-mailprovider (bijv. TransIP, Strato, Google Workspace of Microsoft 365). Zoek naar ‘SMTP-instellingen’. Zonder deze instellingen worden e-mails niet verstuurd."
        >
          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            {plainInput('smtpHost', 'SMTP-server', { placeholder: 'smtp.jouwprovider.nl' })}
            {plainInput('smtpPort', 'Poort', { placeholder: '587' })}
          </div>
          {v.smtpSecure.fromEnv ? (
            plainInput('smtpSecure', 'Beveiliging')
          ) : (
            <Select label="Beveiliging" value={plain.smtpSecure ?? 'false'} onChange={(e) => setPlain((p) => ({ ...p, smtpSecure: e.target.value }))} hint="Twijfel je? Kies STARTTLS met poort 587.">
              <option value="false">STARTTLS (meestal poort 587)</option>
              <option value="true">SSL/TLS (meestal poort 465)</option>
            </Select>
          )}
          {plainInput('smtpUser', 'Gebruikersnaam', { placeholder: 'Meestal je e-mailadres' })}
          <SecretField label="Wachtwoord" field={v.smtpPass} value={secrets.smtpPass} onChange={(val) => setSecrets((s) => ({ ...s, smtpPass: val }))} placeholder="Wachtwoord van het e-mailaccount" />
          {plainInput('mailFrom', 'Afzender', { placeholder: 'Detail2Go <no-reply@detail2go.nl>', hint: 'Naam en adres die klanten als afzender zien.' })}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={() => test('mail')} disabled={testing === 'mail' || dirty || !v.smtpHost.set}>
              {testing === 'mail' ? 'Versturen…' : 'Stuur een testmail naar mij'}
            </Button>
            {dirty && <span className="text-sm text-stone-dark">Sla eerst op om te testen.</span>}
            {result('mail')}
          </div>
        </Panel>

        <Panel title="Meldingen" description="Waar moeten meldingen van nieuwe bestellingen en afspraakaanvragen naartoe?">
          {plainInput('notifyEmail', 'E-mailadres voor meldingen', { placeholder: 'contact@detail2go.nl', type: 'email' })}
        </Panel>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={() => {
          setPlain(original);
          setSecrets({});
        }}
      />
    </>
  );
}
