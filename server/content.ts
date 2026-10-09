// Stores the admin's content changes and keeps the shared content objects in sync with them.
import { z } from 'zod';
import { applyContent, type ContentDoc } from '../shared/content';
import { aboutSchema, emailSchema, shopSchema, homeSchema, productSchema, serviceSchema, shippingSchema, siteSchema } from '../shared/schemas';
import type { Db } from './db';

export type ContentKey = keyof ContentDoc;

const SCHEMAS: Record<ContentKey, z.ZodTypeAny> = {
  site: siteSchema,
  shipping: shippingSchema,
  email: emailSchema,
  home: homeSchema,
  about: aboutSchema,
  shop: shopSchema,
  services: z.record(z.string(), serviceSchema),
  products: z.array(productSchema),
};

export class ContentStore {
  private doc: ContentDoc = {};
  private embedded = '{}';

  constructor(private db: Db) {
    this.reload();
  }

  reload() {
    const rows = this.db.prepare('SELECT key, value FROM content').all() as { key: string; value: string }[];
    const doc: ContentDoc = {};
    for (const row of rows) {
      const schema = SCHEMAS[row.key as ContentKey];
      if (!schema) continue;
      try {
        const parsed = schema.safeParse(JSON.parse(row.value));
        if (parsed.success) (doc as Record<string, unknown>)[row.key] = parsed.data;
        else console.error(`[content] ${row.key} wordt genegeerd: ongeldige inhoud`);
      } catch {
        console.error(`[content] ${row.key} wordt genegeerd: geen geldige JSON`);
      }
    }
    applyContent(doc);
    this.doc = doc;
    // Safe inside <script type="application/json">: no "</script>" or line separators can break out.
    const backslash = String.fromCharCode(92);
    // E-mail settings are only needed on the server.
    const { email: _email, ...publicDoc } = doc;
    this.embedded = JSON.stringify(publicDoc)
      .replace(/</g, `${backslash}u003c`)
      .split(String.fromCharCode(0x2028))
      .join(`${backslash}u2028`)
      .split(String.fromCharCode(0x2029))
      .join(`${backslash}u2029`);
  }

  current(): ContentDoc {
    return structuredClone(this.doc);
  }

  save<K extends ContentKey>(key: K, value: NonNullable<ContentDoc[K]>) {
    this.db
      .prepare(
        `INSERT INTO content (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value));
    this.reload();
  }

  reset(key: ContentKey) {
    this.db.prepare('DELETE FROM content WHERE key = ?').run(key);
    this.reload();
  }

  /** JSON for the page, so the browser renders the edited content straight away. */
  embed() {
    return this.embedded;
  }
}
