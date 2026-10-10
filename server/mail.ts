import nodemailer from 'nodemailer';
import type { EffectiveSettings } from './settings';

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

type MailSettings = Pick<EffectiveSettings, 'smtp' | 'mailFrom'>;
type Smtp = NonNullable<MailSettings['smtp']>;

/**
 * Resend's SMTP password is its API key, so for Resend we send over HTTPS instead: hosts like
 * Railway block outgoing SMTP ports, while HTTPS always works.
 */
const resendKey = (smtp: Smtp) => (/(^|\.)resend\.com$/i.test(smtp.host) && smtp.pass ? smtp.pass : undefined);

class ResendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function sendViaResend(apiKey: string, from: string | undefined, mail: Mail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html, reply_to: mail.replyTo }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ResendError(res.status, body.message ?? `HTTP ${res.status}`);
  }
}

function transportFor(smtp: Smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    // Never fall back to an unencrypted connection when the server offers STARTTLS.
    requireTLS: !smtp.secure && smtp.port !== 25,
    connectionTimeout: 15_000,
  });
}

/**
 * Sends through SMTP when configured, otherwise logs the mail to the console.
 * Reads the settings on every send, so changes in the admin apply immediately.
 */
export function createMailer(getSettings: () => MailSettings): Mailer {
  let cached: { key: string; transport: ReturnType<typeof transportFor> } | undefined;
  return {
    async send(mail) {
      const { smtp, mailFrom } = getSettings();
      if (!smtp) {
        console.log(`[mail] (SMTP niet ingesteld) aan ${mail.to}: ${mail.subject}`);
        return;
      }
      const apiKey = resendKey(smtp);
      if (apiKey) return sendViaResend(apiKey, mailFrom, mail);
      const key = JSON.stringify(smtp);
      if (cached?.key !== key) cached = { key, transport: transportFor(smtp) };
      await cached.transport.sendMail({ from: mailFrom, ...mail });
    },
  };
}

/** Connects and sends a test message; resolves with a Dutch error message on failure. */
export async function sendTestMail(settings: MailSettings, to: string): Promise<string | undefined> {
  if (!settings.smtp) return 'Vul eerst de SMTP-server in.';
  const testMail = { to, subject: 'Testmail van je Detail2Go-webshop', text: 'Gelukt! Je webshop kan e-mails versturen. Deze mail is verstuurd vanuit het beheer.' };
  const apiKey = resendKey(settings.smtp);
  if (apiKey) {
    try {
      await sendViaResend(apiKey, settings.mailFrom, testMail);
      return undefined;
    } catch (err) {
      if (!(err instanceof ResendError)) return 'Kan geen verbinding maken met Resend. Probeer het zo opnieuw.';
      if (err.status === 401 || /api key/i.test(err.message)) return 'Resend weigert de API-sleutel. Plak bij Wachtwoord een geldige sleutel (begint met re_).';
      return `Resend weigert de mail: ${err.message}`;
    }
  }
  const transport = transportFor(settings.smtp);
  try {
    await transport.verify();
    await transport.sendMail({ from: settings.mailFrom, ...testMail });
    return undefined;
  } catch (err) {
    const code = (err as { code?: string; responseCode?: number }).code;
    if (code === 'EAUTH') return 'De mailserver weigert de gebruikersnaam of het wachtwoord.';
    if (code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'EDNS') {
      return 'Kan geen verbinding maken met de mailserver. Controleer de server, de poort en de beveiligingsinstelling.';
    }
    return 'Versturen is niet gelukt. Controleer de instellingen bij je e-mailprovider.';
  } finally {
    transport.close();
  }
}

/** Mail failures must never break a checkout or booking, so they are only logged. */
export async function sendSafely(mailer: Mailer, mail: Mail) {
  try {
    await mailer.send(mail);
  } catch (err) {
    console.error(`[mail] versturen naar ${mail.to} mislukt:`, err);
  }
}
