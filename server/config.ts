import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

export type Config = {
  port: number;
  production: boolean;
  appUrl: string;
  databasePath: string;
  /** Folder for uploaded images; defaults to "uploads" next to the database. */
  uploadsDir: string;
  /** 32-byte key (hex) that encrypts stored secrets. Without it a key file next to the database is used. */
  secretKey?: string;
  // Values below come from the environment and, when set, override what is entered in the admin.
  mollieApiKey?: string;
  smtp?: { host: string; port: number; user?: string; pass?: string; secure: boolean };
  mailFrom?: string;
  notifyEmail?: string;
};

export const DEFAULT_MAIL_FROM = 'Detail2Go <no-reply@detail2go.nl>';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT) || 3000;
  const smtpHost = env.SMTP_HOST?.trim();
  const databasePath = env.DATABASE_PATH?.trim() || 'data/shop.db';
  return {
    port,
    production: env.NODE_ENV === 'production',
    appUrl: (env.APP_URL?.trim() || `http://localhost:${port}`).replace(/\/$/, ''),
    databasePath,
    uploadsDir: env.UPLOADS_DIR?.trim() || (databasePath === ':memory:' ? path.join(os.tmpdir(), 'detail2go-test-uploads') : path.join(path.dirname(databasePath), 'uploads')),
    secretKey: env.SECRET_KEY?.trim() || undefined,
    mollieApiKey: env.MOLLIE_API_KEY?.trim() || undefined,
    smtp: smtpHost
      ? {
          host: smtpHost,
          port: Number(env.SMTP_PORT) || 587,
          user: env.SMTP_USER?.trim() || undefined,
          pass: env.SMTP_PASS || undefined,
          secure: env.SMTP_SECURE === 'true',
        }
      : undefined,
    mailFrom: env.MAIL_FROM?.trim() || undefined,
    notifyEmail: env.NOTIFY_EMAIL?.trim() || undefined,
  };
}
