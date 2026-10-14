// E-mail conversations about booking requests. When a request comes in, a reply is drafted right away (by Claude,
// or from a template); the admin edits and sends it in the house style, from the shop's own address. Replies the
// customer sends back are pasted into the conversation, after which a new reply is drafted.
import { EMAIL, type EmailSettings } from '../shared/email';
import { findService } from '../shared/services';
import { SITE } from '../shared/site';
import type { Db } from './db';
import type { Mail, Mailer } from './mail';
import { renderEmail, type EmailBlock } from './mailTemplates';
import { templateDraft, type BookingRow, type DraftResult, type ReplyDrafter, type ThreadMessage } from './replyDrafts';

export type MessageStatus = 'generating' | 'draft' | 'sent' | 'failed' | 'received';

export type ConversationMessage = {
  id: number;
  direction: 'out' | 'in';
  status: MessageStatus;
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

type Row = {
  id: number;
  booking_id: number;
  direction: 'out' | 'in';
  status: MessageStatus;
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  ai: number;
  error: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

const toMessage = (r: Row): ConversationMessage => ({
  id: r.id,
  direction: r.direction,
  status: r.status,
  subject: r.subject,
  greeting: r.greeting,
  body: r.body,
  closing: r.closing,
  ai: Boolean(r.ai),
  error: r.error,
  sentBy: r.sent_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  sentAt: r.sent_at,
});

/** A draft still "being written" after this long is considered lost and may be written again. */
const GENERATING_TTL = "datetime('now', '-3 minutes')";

export function getBooking(db: Db, id: number) {
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as BookingRow | undefined;
}

export function listMessages(db: Db, bookingId: number): ConversationMessage[] {
  return (db.prepare('SELECT * FROM booking_messages WHERE booking_id = ? ORDER BY id').all(bookingId) as Row[]).map(toMessage);
}

/** The reply that has not been sent yet, if any. */
export function currentDraft(db: Db, bookingId: number): ConversationMessage | undefined {
  const row = db
    .prepare(`SELECT * FROM booking_messages WHERE booking_id = ? AND direction = 'out' AND status IN ('generating', 'draft', 'failed') ORDER BY id DESC LIMIT 1`)
    .get(bookingId) as Row | undefined;
  return row && toMessage(row);
}

/** Per booking: the state of the draft, how many replies were sent, and whether the customer answered last. */
export function conversationSummaries(db: Db): Record<number, { draft: MessageStatus | null; sent: number; awaitingReply: boolean }> {
  const rows = db.prepare('SELECT booking_id, direction, status FROM booking_messages ORDER BY id').all() as Pick<Row, 'booking_id' | 'direction' | 'status'>[];
  const out: Record<number, { draft: MessageStatus | null; sent: number; awaitingReply: boolean }> = {};
  for (const r of rows) {
    const s = (out[r.booking_id] ??= { draft: null, sent: 0, awaitingReply: false });
    if (r.direction === 'in') s.awaitingReply = true;
    else if (r.status === 'sent') {
      s.sent++;
      s.awaitingReply = false;
      s.draft = null;
    } else s.draft = r.status;
  }
  return out;
}

function thread(db: Db, bookingId: number): ThreadMessage[] {
  return listMessages(db, bookingId)
    .filter((m) => m.status === 'sent' || m.status === 'received')
    .map((m) => ({
      direction: m.direction,
      subject: m.subject,
      body: m.direction === 'out' ? [m.greeting, m.body, m.closing].filter(Boolean).join('\n\n') : m.body,
      at: (m.sentAt ?? m.createdAt).slice(0, 16),
    }));
}

const today = () => new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });

/**
 * Writes (or rewrites) the draft reply for a booking. With Claude when a drafter is given; if Claude is not set up
 * or fails, a template is used and the reason is kept on the draft. Never throws.
 */
export async function writeDraft(db: Db, bookingId: number, drafter: ReplyDrafter | undefined, instruction?: string): Promise<ConversationMessage | undefined> {
  const booking = getBooking(db, bookingId);
  if (!booking) return undefined;
  const existing = currentDraft(db, bookingId);
  if (existing?.status === 'generating' && db.prepare(`SELECT 1 FROM booking_messages WHERE id = ? AND updated_at > ${GENERATING_TTL}`).get(existing.id)) {
    return existing; // already being written
  }
  const id =
    existing?.id ??
    Number(db.prepare(`INSERT INTO booking_messages (booking_id, direction, status) VALUES (?, 'out', 'generating')`).run(bookingId).lastInsertRowid);
  db.prepare(`UPDATE booking_messages SET status = 'generating', error = NULL, updated_at = datetime('now') WHERE id = ?`).run(id);

  const ctx = { booking, service: findService(booking.service_id), thread: thread(db, bookingId), instruction, today: today() };
  let draft: DraftResult;
  let ai = false;
  let error: string | null = null;
  if (drafter) {
    try {
      draft = await drafter(ctx);
      ai = true;
    } catch (err) {
      error = `Claude kon geen concept schrijven (${err instanceof Error ? err.message : 'onbekende fout'}); dit is het standaardconcept.`;
      console.error('[drafts]', err);
      draft = templateDraft(ctx);
    }
  } else {
    draft = templateDraft(ctx);
  }
  db.prepare(
    `UPDATE booking_messages SET status = 'draft', subject = ?, greeting = ?, body = ?, closing = ?, ai = ?, error = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(draft.subject, draft.greeting, draft.body, draft.closing, ai ? 1 : 0, error, id);
  return currentDraft(db, bookingId);
}

export type DraftInput = { subject: string; greeting: string; body: string; closing: string };

export function saveDraft(db: Db, bookingId: number, input: DraftInput): ConversationMessage {
  const existing = currentDraft(db, bookingId);
  if (existing) {
    db.prepare(
      `UPDATE booking_messages SET status = 'draft', subject = ?, greeting = ?, body = ?, closing = ?, error = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).run(input.subject, input.greeting, input.body, input.closing, existing.id);
  } else {
    db.prepare(`INSERT INTO booking_messages (booking_id, direction, status, subject, greeting, body, closing) VALUES (?, 'out', 'draft', ?, ?, ?, ?)`).run(
      bookingId,
      input.subject,
      input.greeting,
      input.body,
      input.closing,
    );
  }
  return currentDraft(db, bookingId)!;
}

/** The customer's answer, pasted in by the admin from the mailbox. */
export function addCustomerReply(db: Db, bookingId: number, body: string) {
  db.prepare(`INSERT INTO booking_messages (booking_id, direction, status, body) VALUES (?, 'in', 'received', ?)`).run(bookingId, body.trim());
}

export function deleteCustomerReply(db: Db, bookingId: number, messageId: number) {
  return db.prepare(`DELETE FROM booking_messages WHERE id = ? AND booking_id = ? AND direction = 'in'`).run(messageId, bookingId).changes > 0;
}

/**
 * The reply as an e-mail in the house style, sent from the shop's own address with a copy to that mailbox.
 * The first reply repeats the request, so the customer sees what it is about.
 */
export function personalMail(booking: BookingRow, input: DraftInput, signer: string, appUrl: string, first: boolean, settings: EmailSettings = EMAIL): Mail {
  const service = findService(booking.service_id);
  const preheader = input.body.split(/\n/)[0].slice(0, 140);
  const blocks: EmailBlock[] = first
    ? [
        {
          type: 'details',
          title: 'Je aanvraag',
          rows: [
            ['Behandeling', service?.name ?? booking.service_id],
            ['Auto', booking.vehicle],
            ...(booking.preferred_date
              ? ([['Voorkeursdatum', new Date(`${booking.preferred_date}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })]] as [string, string][])
              : []),
          ],
        },
      ]
    : [];
  const { html, text } = renderEmail(
    {
      subject: input.subject,
      preheader,
      heading: input.greeting,
      intro: input.body,
      blocks,
      signature: { closing: input.closing || 'Met vriendelijke groet,', name: `${signer}\n${SITE.fullName}` },
    },
    settings.design,
    appUrl,
  );
  const address = `${SITE.fullName} <${SITE.email}>`;
  return { to: booking.email, subject: input.subject, text, html, from: address, replyTo: SITE.email, bcc: SITE.email };
}

/** Sends the draft (with the admin's last edits) and marks it sent. Throws when sending fails; the draft stays. */
export async function sendReply(db: Db, mailer: Mailer, bookingId: number, input: DraftInput, signer: string, appUrl: string): Promise<ConversationMessage> {
  const booking = getBooking(db, bookingId);
  if (!booking) throw new Error('Deze aanvraag bestaat niet.');
  const draft = saveDraft(db, bookingId, input);
  const first = !listMessages(db, bookingId).some((m) => m.direction === 'out' && m.status === 'sent');
  try {
    await mailer.send(personalMail(booking, input, signer, appUrl, first));
  } catch (err) {
    db.prepare(`UPDATE booking_messages SET status = 'failed', error = ? WHERE id = ?`).run(err instanceof Error ? err.message.slice(0, 300) : 'Versturen mislukt', draft.id);
    throw err;
  }
  db.prepare(`UPDATE booking_messages SET status = 'sent', sent_by = ?, sent_at = datetime('now'), error = NULL, updated_at = datetime('now') WHERE id = ?`).run(signer, draft.id);
  return listMessages(db, bookingId).find((m) => m.id === draft.id)!;
}
