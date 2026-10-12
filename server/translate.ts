// Automatic Dutch → English translation of the public site. Every Dutch text is translated once by
// Claude and stored, so visitors get the stored translation and nothing is entered twice in the admin.
// New (not yet stored) text is capped per visitor and per day, so the public endpoint cannot run up the bill.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Db } from './db';

export const LANGS = ['en'] as const;
export type Lang = (typeof LANGS)[number];

/** Translates Dutch texts; returns one translation per text, in the same order. */
export type TranslateEngine = (texts: string[]) => Promise<string[]>;

export const TRANSLATE_LIMITS = {
  /** Longest single text the site will translate (a long paragraph). */
  maxTextLength: 2000,
  /** New characters sent to Claude per visitor per hour, and for the whole site per day. */
  perClientHourly: 30_000,
  daily: 300_000,
  /** Texts per Claude request. */
  batchTexts: 60,
  batchChars: 10_000,
};

const SYSTEM = `You translate the Dutch website of Detail2Go into English. Detail2Go is a car detailing company in Enschede (Twente, the Netherlands): hand washes, interior cleaning, polishing, ceramic coatings, paint protection film (PPF) and paint repair, plus a small webshop with car care products.

You receive a JSON list of texts from the web pages. Each text is one fragment: a heading, button, menu item, form label, sentence, paragraph or part of a sentence. Return exactly one English translation per text, in the same order.

- Write natural, friendly English for customers, addressing the reader as "you" like the informal Dutch "je".
- Keep the fragment's form: a button stays short, a heading stays a heading, keep the capitalisation style, punctuation and any leading or trailing words that continue a sentence.
- Keep unchanged: the brand name Detail2Go, product and brand names, phone numbers, e-mail addresses, web addresses, prices and amounts exactly as written (including € and the decimal comma), postcodes, street names and Dutch place names.
- Keep Markdown markup and line breaks exactly where they are.
- If a text is already English, a name, a code or a number, return it unchanged.`;

const Output = z.object({ translations: z.array(z.string()) });

/** Claude as the translation engine. */
export function claudeEngine(apiKey: string): TranslateEngine {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return async (texts) => {
    const message = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Translation is a simple task; low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: betaZodOutputFormat(Output) },
      // A declined request is retried server-side on the model Anthropic recommends for that case.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify({ texts }) }],
    });
    if (message.stop_reason === 'refusal') throw new Error('Claude declined the translation request');
    if (message.stop_reason === 'max_tokens') throw new Error('Translation output was cut off');
    const out = message.parsed_output?.translations;
    if (!out || out.length !== texts.length) throw new Error(`Expected ${texts.length} translations, got ${out?.length ?? 'none'}`);
    return out;
  };
}

/** A text worth sending: has letters, is not an address or link, and is not too long. */
export function translatable(text: string) {
  return (
    text.length >= 2 &&
    text.length <= TRANSLATE_LIMITS.maxTextLength &&
    /\p{L}{2}/u.test(text) &&
    !/^(https?:\/\/|www\.)\S+$/i.test(text) &&
    !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text)
  );
}

type Budget = { chars: number; reset: number };

export class Translator {
  private inFlight = new Map<string, Promise<void>>();
  private clients = new Map<string, Budget>();
  private day: Budget = { chars: 0, reset: 0 };

  constructor(
    private db: Db,
    /** Returns the engine, or undefined while no API key is set. */
    private engine: () => TranslateEngine | undefined,
  ) {}

  get enabled() {
    return Boolean(this.engine());
  }

  /** Every stored translation for a language, for the browser to cache. */
  dictionary(lang: Lang): Record<string, string> {
    const rows = this.db.prepare('SELECT source, text FROM translations WHERE lang = ?').all(lang) as { source: string; text: string }[];
    return Object.fromEntries(rows.map((r) => [r.source, r.text]));
  }

  count(lang: Lang) {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM translations WHERE lang = ?').get(lang) as { n: number }).n;
  }

  clear() {
    return this.db.prepare('DELETE FROM translations').run().changes;
  }

  private stored(lang: Lang, texts: string[]) {
    const get = this.db.prepare('SELECT text FROM translations WHERE lang = ? AND source = ?');
    const found: Record<string, string> = {};
    for (const t of texts) {
      const row = get.get(lang, t) as { text: string } | undefined;
      if (row) found[t] = row.text;
    }
    return found;
  }

  /** Charges new characters to the visitor and to the day; false when either is used up. */
  private spend(client: string, chars: number) {
    const now = Date.now();
    if (this.day.reset < now) this.day = { chars: 0, reset: now + 24 * 3600_000 };
    let budget = this.clients.get(client);
    if (!budget || budget.reset < now) {
      budget = { chars: 0, reset: now + 3600_000 };
      this.clients.set(client, budget);
      if (this.clients.size > 10_000) for (const [k, v] of this.clients) if (v.reset < now) this.clients.delete(k);
    }
    if (budget.chars + chars > TRANSLATE_LIMITS.perClientHourly || this.day.chars + chars > TRANSLATE_LIMITS.daily) return false;
    budget.chars += chars;
    this.day.chars += chars;
    return true;
  }

  /**
   * Returns translations for the given texts: stored ones right away, new ones from Claude within the
   * budgets. Texts that could not be translated are left out; the page then keeps the Dutch text.
   */
  async translate(lang: Lang, texts: string[], client: string): Promise<Record<string, string>> {
    const unique = [...new Set(texts)].filter(translatable);
    const engine = this.engine();
    let found = this.stored(lang, unique);
    const missing = unique.filter((t) => !(t in found));
    if (!engine || !missing.length) return found;

    // Texts another request is already translating are awaited, not sent twice.
    const own = missing.filter((t) => !this.inFlight.has(`${lang}|${t}`));
    const waits = missing.filter((t) => this.inFlight.has(`${lang}|${t}`)).map((t) => this.inFlight.get(`${lang}|${t}`)!);

    const batches: string[][] = [];
    let batch: string[] = [];
    let size = 0;
    for (const t of own) {
      if (batch.length && (batch.length >= TRANSLATE_LIMITS.batchTexts || size + t.length > TRANSLATE_LIMITS.batchChars)) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(t);
      size += t.length;
    }
    if (batch.length) batches.push(batch);

    const insert = this.db.prepare('INSERT OR REPLACE INTO translations (lang, source, text) VALUES (?, ?, ?)');
    for (const b of batches) {
      if (!this.spend(client, b.reduce((n, t) => n + t.length, 0))) break;
      const job = engine(b)
        .then((out) => {
          this.db.transaction(() => b.forEach((t, i) => insert.run(lang, t, out[i])))();
        })
        .catch((err) => console.error('[translate]', err instanceof Error ? err.message : err))
        .finally(() => b.forEach((t) => this.inFlight.delete(`${lang}|${t}`)));
      b.forEach((t) => this.inFlight.set(`${lang}|${t}`, job));
      waits.push(job);
    }
    await Promise.all(waits);
    found = this.stored(lang, unique);
    return found;
  }
}
