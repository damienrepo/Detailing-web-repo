import 'dotenv/config';

export type Config = {
  port: number;
  production: boolean;
  appUrl: string;
  databasePath: string;
  mollieApiKey?: string;
  adminPassword?: string;
  smtp?: { host: string; port: number; user?: string; pass?: string; secure: boolean };
  mailFrom: string;
  notifyEmail?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT) || 3000;
  const smtpHost = env.SMTP_HOST?.trim();
  return {
    port,
    production: env.NODE_ENV === 'production',
    appUrl: (env.APP_URL?.trim() || `http://localhost:${port}`).replace(/\/$/, ''),
    databasePath: env.DATABASE_PATH?.trim() || 'data/shop.db',
    mollieApiKey: env.MOLLIE_API_KEY?.trim() || undefined,
    adminPassword: env.ADMIN_PASSWORD?.trim() || undefined,
    smtp: smtpHost
      ? {
          host: smtpHost,
          port: Number(env.SMTP_PORT) || 587,
          user: env.SMTP_USER?.trim() || undefined,
          pass: env.SMTP_PASS || undefined,
          secure: env.SMTP_SECURE === 'true',
        }
      : undefined,
    mailFrom: env.MAIL_FROM?.trim() || 'Lumen Detailing <no-reply@lumendetailing.nl>',
    notifyEmail: env.NOTIFY_EMAIL?.trim() || undefined,
  };
}
