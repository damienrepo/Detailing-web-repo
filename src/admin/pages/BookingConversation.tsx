import { Eye, Loader2, Mail, RefreshCw, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { findService } from '../../../shared/services';
import { Button, Input, Notice, Textarea } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { ErrorBox, Loading, PageHeader, Panel, StatusBadge, useAdminData, useSave, useUnsavedWarning } from '../kit';
import { BOOKING_STATUS, date, type Booking } from './Orders';

type Message = {
  id: number;
  direction: 'out' | 'in';
  status: 'generating' | 'draft' | 'sent' | 'failed' | 'received';
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  ai: boolean;
  error: string | null;
  sentBy: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};
type View = { booking: Booking; messages: Message[]; draft: Message | null; ai: boolean; from: string };
type Fields = { subject: string; greeting: string; body: string; closing: string };

const fieldsOf = (m: Message | null): Fields => ({ subject: m?.subject ?? '', greeting: m?.greeting ?? '', body: m?.body ?? '', closing: m?.closing ?? 'Met vriendelijke groet,' });

/** One booking request: what was asked, the e-mails so far, and the reply that is ready to send. */
export function BookingConversationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, setData, error, reload } = useAdminData<View>(`/admin/bookings/${id}`);
  const save = useSave();
  const [fields, setFields] = useState<Fields>(fieldsOf(null));
  const [savedFields, setSavedFields] = useState<string>('');
  const [instruction, setInstruction] = useState('');
  const [reply, setReply] = useState('');
  const [preview, setPreview] = useState<{ html: string; from: string; to: string; subject: string }>();
  const [busy, setBusy] = useState<'draft' | 'reply' | 'send' | 'preview'>();

  // Load the draft into the form when it is (re)written on the server.
  const draftKey = data?.draft ? `${data.draft.id}:${data.draft.updatedAt}:${data.draft.status}` : 'none';
  useEffect(() => {
    if (!data) return;
    const f = fieldsOf(data.draft);
    setFields(f);
    setSavedFields(JSON.stringify(f));
  }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // While Claude is writing (right after a request comes in), check back every few seconds.
  const generating = data?.draft?.status === 'generating';
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [generating, reload]);

  const dirty = Boolean(data?.draft) && JSON.stringify(fields) !== savedFields;
  useUnsavedWarning(dirty);

  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;
  const { booking } = data;
  const service = findService(booking.service_id);
  const history = data.messages.filter((m) => m.status === 'sent' || m.status === 'received');
  const set = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<View>, success?: string) {
    setBusy(kind);
    const view = await save.run(fn, success);
    setBusy(undefined);
    if (view) setData(view);
    return view;
  }

  const rewrite = () => {
    if (dirty && !confirmAction('Je aanpassingen aan het concept gaan verloren. Opnieuw laten schrijven?')) return;
    run('draft', () => api<View>(`/admin/bookings/${id}/draft`, { body: { instruction } }), 'Nieuw concept geschreven').then((v) => v && setInstruction(''));
  };
  const store = () => run('draft', () => api<View>(`/admin/bookings/${id}/draft`, { method: 'PUT', body: fields }), 'Concept opgeslagen');
  const send = () => {
    if (!confirmAction(`Deze e-mail versturen naar ${booking.email}?`)) return;
    run('send', () => api<View>(`/admin/bookings/${id}/send`, { body: fields }), 'E-mail verstuurd');
  };
  const addReply = () => run('reply', () => api<View>(`/admin/bookings/${id}/replies`, { body: { body: reply } }), 'Antwoord toegevoegd, nieuw concept staat klaar').then((v) => v && setReply(''));
  async function removeBooking() {
    if (!confirmAction(`De aanvraag van ${data!.booking.name} verwijderen? Ook dit gesprek en het concept worden verwijderd. Dit kan niet ongedaan worden gemaakt.`)) return;
    const ok = await save.run(() => api(`/admin/bookings/${id}`, { method: 'DELETE' }), 'Aanvraag verwijderd');
    if (ok) navigate('/admin/afspraken');
  }

  const removeReply = (messageId: number) => {
    if (!confirmAction('Dit antwoord van de klant verwijderen?')) return;
    run('reply', () => api<View>(`/admin/bookings/${id}/replies/${messageId}`, { method: 'DELETE' }));
  };
  async function showPreview() {
    setBusy('preview');
    const result = await save.run(() => api<{ html: string; from: string; to: string; subject: string }>(`/admin/bookings/${id}/preview`, { body: fields }), '');
    setBusy(undefined);
    if (result) setPreview(result);
  }

  return (
    <>
      <PageHeader
        title={`${booking.name} — ${service?.name ?? booking.service_id}`}
        back={{ to: '/admin/afspraken', label: 'Alle aanvragen' }}
        description="Een concept-antwoord staat al klaar. Lees het na, pas aan waar nodig en verstuur het in jullie huisstijl. Reageert de klant, plak het antwoord dan hieronder voor een nieuw concept."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {history.length > 0 && (
            <Panel title="Gesprek">
              <ol className="space-y-4">
                {history.map((m) =>
                  m.direction === 'out' ? (
                    <li key={m.id} className="border border-paper-3 bg-paper/60 p-4">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-stone-dark">
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                        Verstuurd {m.sentAt ? date(m.sentAt) : ''} {m.sentBy && `door ${m.sentBy}`}
                      </p>
                      <p className="mt-1 font-medium">{m.subject}</p>
                      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{[m.greeting, m.body, m.closing].filter(Boolean).join('\n\n')}</p>
                    </li>
                  ) : (
                    <li key={m.id} className="border border-accent/50 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs text-stone-dark">Antwoord van {booking.name.split(' ')[0]} · toegevoegd {date(m.createdAt)}</p>
                        <button type="button" onClick={() => removeReply(m.id)} className="text-stone-dark hover:text-danger" aria-label="Antwoord verwijderen">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{m.body}</p>
                    </li>
                  ),
                )}
              </ol>
            </Panel>
          )}

          <Panel
            title={history.some((m) => m.direction === 'out') ? 'Volgend antwoord' : 'Concept-antwoord'}
            description={`Wordt verstuurd vanaf ${data.from}, met een kopie naar die mailbox. Reacties van de klant komen daar binnen.`}
          >
            {generating ? (
              <p className="flex items-center gap-2 py-6 text-stone-dark">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Claude schrijft een concept op basis van de aanvraag…
              </p>
            ) : !data.draft ? (
              <div className="space-y-3">
                <p className="text-sm text-stone-dark">Er staat geen concept klaar.</p>
                <Button type="button" variant="dark" className="h-10 text-sm" onClick={rewrite} disabled={busy === 'draft'}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {busy === 'draft' ? 'Bezig…' : 'Concept laten schrijven'}
                </Button>
              </div>
            ) : (
              <>
                {data.draft.error && <Notice tone="error">{data.draft.error}</Notice>}
                {data.draft.ai && !data.draft.error && (
                  <p className="flex items-center gap-1.5 text-sm text-stone-dark">
                    <Sparkles className="h-3.5 w-3.5 text-accent-strong" aria-hidden />
                    Geschreven door Claude. Lees het goed na voordat je het verstuurt.
                  </p>
                )}
                <Input label="Onderwerp" value={fields.subject} error={save.errors.subject} onChange={(e) => set('subject')(e.target.value)} />
                <Input label="Aanhef" value={fields.greeting} error={save.errors.greeting} onChange={(e) => set('greeting')(e.target.value)} />
                <Textarea label="Bericht" rows={14} value={fields.body} error={save.errors.body} onChange={(e) => set('body')(e.target.value)} hint="Een witregel begint een nieuwe alinea." />
                <Input
                  label="Afsluiting"
                  value={fields.closing}
                  error={save.errors.closing}
                  hint="Daaronder komen automatisch je naam en Detail2Go."
                  onChange={(e) => set('closing')(e.target.value)}
                />
                {save.error && <Notice tone="error">{save.error}</Notice>}
                <div className="flex flex-wrap items-center gap-2 border-t border-paper-3 pt-5">
                  <Button type="button" variant="accent" className="h-11 text-sm" onClick={send} disabled={!!busy || !fields.subject || !fields.body}>
                    <Send className="h-4 w-4" aria-hidden />
                    {busy === 'send' ? 'Versturen…' : `Versturen naar ${booking.email}`}
                  </Button>
                  <Button type="button" variant="outline-dark" className="h-11 text-sm" onClick={showPreview} disabled={!!busy || !fields.subject || !fields.body}>
                    <Eye className="h-4 w-4" aria-hidden />
                    Voorbeeld
                  </Button>
                  <Button type="button" variant="outline-dark" className="h-11 text-sm" onClick={store} disabled={!!busy || !dirty}>
                    Opslaan
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      label={data.ai ? 'Opnieuw laten schrijven' : 'Standaardconcept opnieuw invullen'}
                      optional
                      placeholder={data.ai ? 'Bijv. "we zitten volgende week vol, stel de week erna voor"' : ''}
                      value={instruction}
                      disabled={!data.ai}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline-dark" className="h-12 text-sm" onClick={rewrite} disabled={!!busy}>
                    <RefreshCw className={`h-4 w-4 ${busy === 'draft' ? 'animate-spin' : ''}`} aria-hidden />
                    {busy === 'draft' ? 'Schrijven…' : 'Opnieuw'}
                  </Button>
                </div>
                {!data.ai && (
                  <p className="text-sm text-stone-dark">
                    Tip: met een Anthropic API-key (Betalingen &amp; e-mail → Claude) schrijft Claude een persoonlijk concept per aanvraag.
                  </p>
                )}
              </>
            )}
          </Panel>

          {history.some((m) => m.direction === 'out') && (
            <Panel title="Antwoord van de klant" description="Plak hier de reactie die de klant op je mail stuurde. Daarna staat er meteen een nieuw concept-antwoord klaar.">
              <Textarea label="Reactie van de klant" rows={6} value={reply} error={save.errors.body} onChange={(e) => setReply(e.target.value)} />
              <Button type="button" variant="dark" className="h-10 text-sm" onClick={addReply} disabled={!!busy || !reply.trim()}>
                {busy === 'reply' ? 'Bezig met een nieuw concept…' : 'Toevoegen en antwoord laten opstellen'}
              </Button>
            </Panel>
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="Aanvraag">
            <dl className="space-y-3 text-sm">
              <Row label="Status">
                <StatusBadge tone={booking.status === 'new' ? 'accent' : booking.status === 'cancelled' ? 'muted' : 'ok'}>{BOOKING_STATUS[booking.status]}</StatusBadge>
              </Row>
              <Row label="Behandeling">{service?.name ?? booking.service_id}</Row>
              <Row label="Auto">{booking.vehicle}</Row>
              <Row label="Voorkeursdatum">
                {booking.preferred_date ? new Date(`${booking.preferred_date}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Geen voorkeur'}
              </Row>
              <Row label="Naam">{booking.name}</Row>
              <Row label="E-mail">
                <a href={`mailto:${booking.email}`} className="underline underline-offset-2">
                  {booking.email}
                </a>
              </Row>
              <Row label="Telefoon">
                <a href={`tel:${booking.phone}`} className="underline underline-offset-2">
                  {booking.phone}
                </a>
              </Row>
              {booking.postal_code && <Row label="Postcode">{booking.postal_code}</Row>}
              <Row label="Aangevraagd">{date(booking.created_at)}</Row>
            </dl>
            {booking.message && <p className="whitespace-pre-line bg-paper-2 p-3 text-sm">“{booking.message}”</p>}
          </Panel>
          <button type="button" onClick={removeBooking} className="inline-flex items-center gap-1.5 text-sm text-stone-dark hover:text-danger">
            <Trash2 className="h-4 w-4" aria-hidden />
            Aanvraag verwijderen
          </button>
        </aside>
      </div>

      {preview &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={() => setPreview(undefined)}>
            <div role="dialog" aria-modal="true" aria-label="Voorbeeld van de e-mail" className="flex max-h-[92vh] w-full max-w-3xl flex-col bg-paper" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-paper-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-stone-dark">Van:</span> {preview.from}
                  </p>
                  <p className="truncate">
                    <span className="text-stone-dark">Aan:</span> {preview.to}
                  </p>
                  <p className="truncate font-medium">{preview.subject}</p>
                </div>
                <button type="button" onClick={() => setPreview(undefined)} className="grid h-9 w-9 shrink-0 place-items-center hover:bg-paper-2" aria-label="Sluiten">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <iframe title="Voorbeeld" srcDoc={preview.html} sandbox="" className="h-[75vh] w-full bg-white" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-stone-dark">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
