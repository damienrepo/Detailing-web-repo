import { Monitor, Send, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmailKind, EmailSettings, EmailTemplate, EmailText } from '../../../shared/email';
import { Button, Input, Select, Textarea } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { ErrorBox, ImageField, Loading, PageHeader, Panel, SaveBar, Toggle, useAdminData, useDraft, useSave, useToast } from '../kit';

type EmailView = {
  settings: EmailSettings;
  defaults: EmailSettings;
  edited: boolean;
  kinds: { id: EmailKind; label: string; when: string; placeholders: string[] }[];
  templates: { id: EmailTemplate; name: string; description: string }[];
};

const COLORS = [
  { name: 'Goud', value: '#d9a72a' },
  { name: 'Donkergoud', value: '#b8891a' },
  { name: 'Zwart', value: '#0e0e0f' },
  { name: 'Rood', value: '#c4431d' },
  { name: 'Blauw', value: '#1f4e8c' },
  { name: 'Groen', value: '#2f6b4f' },
];

const PLACEHOLDER_LABELS: Record<string, string> = {
  voornaam: 'Voornaam',
  naam: 'Volledige naam',
  bestelnummer: 'Bestelnummer',
  totaal: 'Totaalbedrag',
  vervoerder: 'Vervoerder',
  trackcode: 'Track-and-trace code',
  afhaaladres: 'Afhaaladres',
  dienst: 'Dienst',
  auto: 'Auto',
  voorkeursdatum: 'Voorkeursdatum',
};

const TEXT_FIELDS: { key: keyof EmailText; label: string; hint?: string; long?: boolean }[] = [
  { key: 'subject', label: 'Onderwerp', hint: 'Wat de klant in de inbox ziet.' },
  { key: 'preheader', label: 'Voorvertoning', hint: 'Grijze regel naast het onderwerp in de inbox. Optioneel.' },
  { key: 'heading', label: 'Kop' },
  { key: 'intro', label: 'Tekst', long: true, hint: 'Een lege regel begint een nieuwe alinea.' },
  { key: 'button', label: 'Tekst op de knop', hint: 'Leeg laten = geen knop.' },
  { key: 'closing', label: 'Afsluiting', long: true, hint: 'Staat onder de gegevens, boven ‘Met vriendelijke groet’.' },
];

/** Little sketches of each template, so the choice is visual. */
function TemplateSketch({ id, accent }: { id: EmailTemplate; accent: string }) {
  const bar = <div className="mt-2 h-2 w-16" style={{ background: accent }} />;
  const lines = (dark: boolean) => (
    <div className="space-y-1.5 p-3">
      <div className={`h-2.5 w-3/4 ${dark ? 'bg-paper/80' : 'bg-ink/80'}`} />
      <div className={`h-1.5 w-full ${dark ? 'bg-paper/25' : 'bg-ink/15'}`} />
      <div className={`h-1.5 w-5/6 ${dark ? 'bg-paper/25' : 'bg-ink/15'}`} />
      {bar}
    </div>
  );
  if (id === 'klassiek')
    return (
      <div className="bg-paper p-2">
        <div className="flex h-5 items-center bg-ink px-2">
          <div className="h-1.5 w-8 bg-paper/80" />
        </div>
        <div className="bg-white">{lines(false)}</div>
      </div>
    );
  if (id === 'licht')
    return (
      <div className="bg-white p-2">
        <div className="h-1" style={{ background: accent }} />
        <div className="px-3 pt-2">
          <div className="h-1.5 w-8 bg-ink/70" />
        </div>
        {lines(false)}
      </div>
    );
  return (
    <div className="bg-ink p-2">
      <div className="mx-auto mb-1.5 h-1.5 w-8 bg-paper/80" />
      <div className="h-8 bg-[linear-gradient(135deg,#3a3a3e,#6b6b70)]" />
      <div className="bg-ink-2">{lines(true)}</div>
    </div>
  );
}

export function EmailsPage() {
  const toast = useToast();
  const { data, setData, error, reload } = useAdminData<EmailView>('/admin/email');
  const { draft, setDraft, dirty, reset, markSaved } = useDraft<EmailSettings>(data?.settings);
  const save = useSave();
  const [tab, setTab] = useState<'design' | 'texts'>('design');
  const [kind, setKind] = useState<EmailKind>('orderConfirmation');
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string }>();
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string }>();
  const focused = useRef<{ key: keyof EmailText; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  // Live preview, rendered by the server with the exact same code as real mails.
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => {
      api<{ subject: string; html: string; text: string }>('/admin/email/preview', { body: { settings: draft, kind } })
        .then((p) => {
          setPreview(p);
          setPreviewErrors({});
        })
        .catch((err) => setPreviewErrors(err instanceof ApiError ? err.fields : {}));
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, kind]);

  const kindInfo = useMemo(() => data?.kinds.find((k) => k.id === kind), [data, kind]);
  if (!data || !draft) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;
  const d = draft.design;
  const t = draft.texts[kind];
  const errors = { ...previewErrors, ...save.errors };
  const setDesign = (patch: Partial<EmailSettings['design']>) => setDraft({ ...draft, design: { ...d, ...patch } });
  const setText = (patch: Partial<EmailText>) => setDraft({ ...draft, texts: { ...draft.texts, [kind]: { ...t, ...patch } } });

  function insertPlaceholder(name: string) {
    const token = `{${name}}`;
    const target = focused.current;
    if (!target) {
      setText({ intro: `${t.intro}${t.intro.endsWith(' ') ? '' : ' '}${token}` });
      return;
    }
    const { el, key } = target;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const value = t[key];
    setText({ [key]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function submit() {
    const view = await save.run(() => api<EmailView>('/admin/content/email', { method: 'PUT', body: draft }));
    if (view) {
      setData(view);
      markSaved(view.settings);
    }
  }

  async function restoreAll() {
    if (!confirmAction('Ontwerp en teksten van alle e-mails terugzetten naar de standaard?')) return;
    const view = await save.run(() => api<EmailView>('/admin/content/email', { method: 'DELETE' }), 'Teruggezet');
    if (view) {
      setData(view);
      markSaved(view.settings);
    }
  }

  async function sendTest() {
    setSending(true);
    setTestResult(undefined);
    try {
      const res = await api<{ to: string }>('/admin/email/test', { body: { settings: draft, kind } });
      setTestResult({ ok: true, message: `Testmail verstuurd naar ${res.to}. Kijk ook even in je spam.` });
      toast('Testmail verstuurd');
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Versturen is niet gelukt.' });
    } finally {
      setSending(false);
    }
  }

  const tabButton = (id: 'design' | 'texts', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`-mb-px border-b-2 px-4 py-3 text-[15px] font-medium ${tab === id ? 'border-accent text-ink' : 'border-transparent text-stone-dark hover:text-ink'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="E-mails"
        description="Kies een ontwerp en pas de teksten aan van de mails die klanten automatisch krijgen. Rechts zie je direct hoe de mail eruitziet, op de computer en op de telefoon."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-6">
          <div role="tablist" className="flex border-b border-ink/15">
            {tabButton('design', 'Ontwerp')}
            {tabButton('texts', 'Teksten')}
          </div>

          {tab === 'design' ? (
            <>
              <Panel title="Template">
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setDesign({ template: tpl.id })}
                      aria-pressed={d.template === tpl.id}
                      className={`border bg-white p-2 text-left transition-colors ${d.template === tpl.id ? 'border-ink ring-1 ring-ink' : 'border-paper-3 hover:border-ink/40'}`}
                    >
                      <TemplateSketch id={tpl.id} accent={d.accent} />
                      <p className="mt-2 px-1 font-medium">{tpl.name}</p>
                      <p className="px-1 pb-1 text-xs leading-relaxed text-stone-dark">{tpl.description}</p>
                    </button>
                  ))}
                </div>
                {d.template === 'foto' && (
                  <ImageField
                    label="Foto bovenaan"
                    hint="Een brede foto van je werk werkt het best. Let op: in de testomgeving (localhost) laden foto’s niet in echte mailprogramma’s."
                    value={d.headerImage}
                    onChange={(v) => v && setDesign({ headerImage: v })}
                    error={errors['design.headerImage']}
                  />
                )}
              </Panel>

              <Panel title="Kleur en stijl">
                <div>
                  <p className="text-[15px] font-medium">Accentkleur</p>
                  <p className="mt-0.5 text-sm text-stone-dark">Voor de knop, het logo en de lijntjes. De tekst op de knop wordt automatisch zwart of wit, wat het beste leest.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={d.accent.toLowerCase() === c.value}
                        onClick={() => setDesign({ accent: c.value })}
                        className={`h-9 w-9 rounded-full border-2 ${d.accent.toLowerCase() === c.value ? 'border-ink ring-2 ring-white ring-offset-0' : 'border-transparent'}`}
                        style={{ background: c.value }}
                      />
                    ))}
                    <label className="ml-2 flex items-center gap-2 text-sm">
                      <input type="color" value={d.accent} onChange={(e) => setDesign({ accent: e.target.value })} className="h-9 w-12 cursor-pointer border border-paper-3 bg-white" />
                      Eigen kleur
                    </label>
                    <span className="font-mono text-sm text-stone-dark">{d.accent}</span>
                  </div>
                  {errors['design.accent'] && <p className="mt-2 text-sm text-danger">{errors['design.accent']}</p>}
                </div>
                <Toggle label="Afgeronde hoeken" description="Ronde knoppen en zachte hoeken. Uit = strak en recht, zoals de website." checked={d.rounded} onChange={(v) => setDesign({ rounded: v })} />
                <Input label="Tekst onderaan" value={d.footerText} optional error={errors['design.footerText']} placeholder="Bijv. Car detailing in Enschede en omstreken" onChange={(e) => setDesign({ footerText: e.target.value })} />
                <Toggle label="Instagram en TikTok onderaan tonen" checked={d.showSocial} onChange={(v) => setDesign({ showSocial: v })} />
              </Panel>
            </>
          ) : (
            <>
              <Panel>
                <Select label="Welke e-mail wil je aanpassen?" value={kind} onChange={(e) => setKind(e.target.value as EmailKind)}>
                  {data.kinds.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </Select>
                {kindInfo && <p className="text-sm text-stone-dark">Verstuurd: {kindInfo.when.toLowerCase()}</p>}
              </Panel>

              <Panel title="Teksten" description="Bestelgegevens, adres en prijzen worden er automatisch in gezet.">
                {kindInfo && (
                  <div>
                    <p className="text-sm font-medium">Klik om in te voegen waar je cursor staat:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {kindInfo.placeholders.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertPlaceholder(p)}
                          className="border border-accent/50 bg-[#fdf6e3] px-2.5 py-1 text-sm hover:border-accent-strong"
                          title={`{${p}}`}
                        >
                          {PLACEHOLDER_LABELS[p] ?? p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {TEXT_FIELDS.map((f) => {
                  const common = {
                    label: f.label,
                    hint: f.hint,
                    value: t[f.key],
                    error: errors[`texts.${kind}.${f.key}`],
                    optional: f.key === 'preheader' || f.key === 'button' || f.key === 'closing',
                    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (focused.current = { key: f.key, el: e.target }),
                  };
                  return f.long ? (
                    <Textarea key={f.key} rows={f.key === 'intro' ? 5 : 3} {...common} onChange={(e) => setText({ [f.key]: e.target.value })} />
                  ) : (
                    <Input key={f.key} {...common} onChange={(e) => setText({ [f.key]: e.target.value })} />
                  );
                })}
                <button
                  type="button"
                  className="text-sm text-stone-dark underline underline-offset-2 hover:text-ink"
                  onClick={() => setDraft({ ...draft, texts: { ...draft.texts, [kind]: data.defaults.texts[kind] } })}
                >
                  Standaardtekst van deze mail terugzetten
                </button>
              </Panel>
            </>
          )}
        </div>

        <div className="min-w-0">
          <div className="xl:sticky xl:top-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as EmailKind)}
                aria-label="Voorbeeld van"
                className="h-10 border border-paper-3 bg-white px-3 text-sm outline-none focus:border-ink"
              >
                {data.kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    Voorbeeld: {k.label}
                  </option>
                ))}
              </select>
              <div className="flex border border-paper-3 bg-white text-sm" role="group" aria-label="Weergave">
                {(
                  [
                    ['desktop', 'Computer', Monitor],
                    ['phone', 'Telefoon', Smartphone],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button key={id} type="button" aria-pressed={device === id} onClick={() => setDevice(id)} className={`flex items-center gap-1.5 px-3 py-2 ${device === id ? 'bg-ink text-paper' : 'hover:bg-paper'}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 border border-paper-3 bg-white px-4 py-3 text-sm">
              <p className="truncate">
                <span className="text-stone-dark">Onderwerp: </span>
                <strong>{preview?.subject ?? '…'}</strong>
              </p>
              {t.preheader && <p className="truncate text-stone-dark">{t.preheader}</p>}
            </div>

            <div className={`mt-3 flex justify-center border border-paper-3 bg-paper-2 ${device === 'phone' ? 'py-6' : ''}`}>
              <div className={device === 'phone' ? 'overflow-hidden rounded-[2.2rem] border-[10px] border-ink shadow-xl' : 'w-full'}>
                {preview ? (
                  <iframe
                    title="Voorbeeld van de e-mail"
                    srcDoc={preview.html}
                    sandbox=""
                    className="block bg-white"
                    style={device === 'phone' ? { width: 375, height: 700 } : { width: '100%', height: 760 }}
                  />
                ) : (
                  <div className="h-[600px] w-full animate-pulse bg-paper-3" />
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline-dark" className="h-10 text-sm" onClick={sendTest} disabled={sending}>
                <Send className="h-4 w-4" aria-hidden />
                {sending ? 'Versturen…' : 'Stuur deze mail naar mij'}
              </Button>
              {testResult && <p className={`text-sm ${testResult.ok ? 'text-[#2f6b4f]' : 'text-danger'}`}>{testResult.message}</p>}
            </div>
            <p className="mt-2 text-xs text-stone-dark">Het voorbeeld gebruikt een verzonnen klant en bestelling. De test gebruikt je huidige (nog niet opgeslagen) wijzigingen.</p>
          </div>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.saving}
        error={save.error}
        onSave={submit}
        onReset={reset}
        extra={
          data.edited && (
            <Button type="button" variant="outline-dark" className="h-10 text-sm" onClick={restoreAll}>
              Alles standaard herstellen
            </Button>
          )
        }
      />
    </>
  );
}
