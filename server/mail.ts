import nodemailer from 'nodemailer';
import type { Config } from './config';

export type Mail = { to: string; subject: string; text: string; replyTo?: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Sends through SMTP when configured, otherwise logs the mail to the console. */
export function createMailer(config: Config): Mailer {
  if (!config.smtp) {
    return {
      async send(mail) {
        console.log(`[mail] (SMTP niet ingesteld) aan ${mail.to}: ${mail.subject}`);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return {
    async send(mail) {
      await transport.sendMail({ from: config.mailFrom, ...mail });
    },
  };
}

/** Mail failures must never break a checkout or booking, so they are only logged. */
export async function sendSafely(mailer: Mailer, mail: Mail) {
  try {
    await mailer.send(mail);
  } catch (err) {
    console.error(`[mail] versturen naar ${mail.to} mislukt:`, err);
  }
}
