// Integration settings (Mollie, e-mail) edited in the admin. Every value is encrypted at rest and
// secrets are never sent back to the browser. Environment variables, when set, take precedence.
import { z } from 'zod';
import { DEFAULT_MAIL_FROM, type Config } from './config';
import type { Db } from './db';
import type { Cipher } from './security';

export type SettingKey = keyof typeof FIELDS;

const FIELDS = {
  mollieApiKey: { secret: true },
  smtpHost: { secret: false },
  smtpPort: { secret: false },
  smtpSecure: { secret: false },
  smtpUser: { secret: false },
  smtpPass: { secret: true },
  mailFrom: { secret: false },
  notifyEmail: { secret: false },
} as const;

export const SETTING_KEYS = Object.keys(FIELDS) as SettingKey[];

const optional = <T extends z.ZodTypeAny>(schema: T) => schema.or(z.literal(''));

/** Values as typed in the admin. Empty string means "remove"; a missing key means "leave unchanged". */
export const settingsInputSchema = z
  .object({
    mollieApiKey: optional(z.string().trim().regex(/^(test|live)_[A-Za-z0-9]{20,}$/, 'Een Mollie API-key begint met test_ of live_')),
    smtpHost: optional(z.string().trim().max(200).regex(/^[a-z0-9.-]+$/i, 'Vul alleen de servernaam in, bijv. smtp.example.com')),
    smtpPort: optional(z.string().trim().regex(/^\d{2,5}$/, 'Vul een poortnummer in, meestal 587 of 465')),
    smtpSecure: optional(z.enum(['true', 'false'])),
    smtpUser: optional(z.string().trim().max(200)),
    smtpPass: optional(z.string().max(500)),
    mailFrom: optional(z.string().trim().max(200).regex(/^[^<>\r\n]*<[^@\s<>]+@[^@\s<>]+>$|^[^@\s<>]+@[^@\s<>]+$/, 'Bijv. Detail2Go <no-reply@detail2go.nl>')),
    notifyEmail: optional(z.email('Vul een geldig e-mailadres in').max(200)),
  })
  .partial()
  .strict();

export type SettingsInput = z.infer<typeof settingsInputSchema>;

/** What the admin may see: secrets only as a hint like "test_…AbCd". */
export type SettingsView = Record<SettingKey, { value?: string; hint?: string; set: boolean; fromEnv: boolean }>;

export type EffectiveSettings = {
  mollieApiKey?: string;
  smtp?: { host: string; port: number; user?: string; pass?: string; secure: boolean };
  mailFrom: string;
  notifyEmail?: string;
};

function hintFor(key: SettingKey, value: string) {
  if (key === 'mollieApiKey') return `${value.slice(0, 5)}…${value.slice(-4)}`;
  return '••••••••';
}

/** Settings fixed through environment variables; these are shown read-only in the admin. */
export function overridesFromConfig(config: Config): Partial<Record<SettingKey, string>> {
  return {
    mollieApiKey: config.mollieApiKey,
    smtpHost: config.smtp?.host,
    smtpPort: config.smtp ? String(config.smtp.port) : undefined,
    smtpSecure: config.smtp ? String(config.smtp.secure) : undefined,
    smtpUser: config.smtp?.user,
    smtpPass: config.smtp?.pass,
    mailFrom: config.mailFrom,
    notifyEmail: config.notifyEmail,
  };
}

export class SettingsStore {
  private cache?: Partial<Record<SettingKey, string>>;
  private listeners: (() => void)[] = [];

  constructor(
    private db: Db,
    private cipher: Cipher,
    private overrides: Partial<Record<SettingKey, string>> = {},
  ) {}

  private stored(): Partial<Record<SettingKey, string>> {
    if (this.cache) return this.cache;
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Partial<Record<SettingKey, string>> = {};
    for (const row of rows) {
      if (!(row.key in FIELDS)) continue;
      try {
        out[row.key as SettingKey] = this.cipher.decrypt(row.value, `setting:${row.key}`);
      } catch {
        console.error(`[settings] ${row.key} kon niet worden ontsleuteld (andere SECRET_KEY?)`);
      }
    }
    this.cache = out;
    return out;
  }

  private fromEnv(key: SettingKey) {
    return this.overrides[key] || undefined;
  }

  get(key: SettingKey): string | undefined {
    return this.fromEnv(key) ?? (this.stored()[key] || undefined);
  }

  effective(): EffectiveSettings {
    const host = this.get('smtpHost');
    return {
      mollieApiKey: this.get('mollieApiKey'),
      smtp: host
        ? {
            host,
            port: Number(this.get('smtpPort')) || 587,
            user: this.get('smtpUser'),
            pass: this.get('smtpPass'),
            secure: this.get('smtpSecure') === 'true',
          }
        : undefined,
      mailFrom: this.get('mailFrom') ?? DEFAULT_MAIL_FROM,
      notifyEmail: this.get('notifyEmail'),
    };
  }

  view(): SettingsView {
    const view = {} as SettingsView;
    for (const key of SETTING_KEYS) {
      const value = this.get(key);
      const secret = FIELDS[key].secret;
      view[key] = {
        set: Boolean(value),
        fromEnv: Boolean(this.fromEnv(key)),
        ...(value && (secret ? { hint: hintFor(key, value) } : { value })),
      };
    }
    return view;
  }

  /** Returns the keys that changed. Keys set through the environment cannot be changed here. */
  update(input: SettingsInput): SettingKey[] {
    const changed: SettingKey[] = [];
    const upsert = this.db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    );
    const remove = this.db.prepare('DELETE FROM settings WHERE key = ?');
    this.db.transaction(() => {
      for (const key of SETTING_KEYS) {
        const value = input[key];
        if (value === undefined || this.fromEnv(key)) continue;
        if ((this.stored()[key] ?? '') === value) continue;
        if (value === '') remove.run(key);
        else upsert.run(key, this.cipher.encrypt(value, `setting:${key}`));
        changed.push(key);
      }
    })();
    this.cache = undefined;
    if (changed.length) this.listeners.forEach((fn) => fn());
    return changed;
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }
}
