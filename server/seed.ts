// Moves the site's content (texts, blog, team, photos) from one installation to a fresh one, e.g.
// from a laptop to the production server. Accounts, settings, orders and bookings never move.
//   npm run seed:export        writes seed/ from the local database
// On start, the server imports seed/ once, but only into a database without any content.
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db';
import { MEDIA_ID } from './media';

const TABLES = ['content', 'posts', 'media', 'team_members'] as const;
/** Content row that records the import, so it never runs twice. ContentStore ignores unknown keys. */
const MARKER = '_seed_imported';

type Seed = Record<(typeof TABLES)[number], Record<string, unknown>[]>;

export function exportSeed(db: Db, uploadsDir: string, outDir: string) {
  const seed = Object.fromEntries(
    TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t}${t === 'content' ? ` WHERE key != '${MARKER}'` : ''}`).all()]),
  ) as Seed;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'uploads'), { recursive: true });
  for (const { id } of seed.media as { id: string }[]) {
    for (const file of [`${id}.jpg`, `${id}-sm.jpg`]) {
      fs.copyFileSync(path.join(uploadsDir, file), path.join(outDir, 'uploads', file));
    }
  }
  fs.writeFileSync(path.join(outDir, 'seed.json'), JSON.stringify(seed, null, 1));
  return Object.fromEntries(TABLES.map((t) => [t, seed[t].length]));
}

/** Imports seed/ into an empty database; returns false when there was nothing to do. */
export function importSeed(db: Db, uploadsDir: string, seedDir: string) {
  const file = path.join(seedDir, 'seed.json');
  if (!fs.existsSync(file)) return false;
  const empty = TABLES.every((t) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n === 0);
  if (!empty) return false;

  const seed = JSON.parse(fs.readFileSync(file, 'utf8')) as Seed;
  fs.mkdirSync(uploadsDir, { recursive: true });
  for (const { id } of seed.media as { id: string }[]) {
    if (!MEDIA_ID.test(id)) throw new Error(`Ongeldige afbeelding in seed: ${id}`);
    for (const name of [`${id}.jpg`, `${id}-sm.jpg`]) fs.copyFileSync(path.join(seedDir, 'uploads', name), path.join(uploadsDir, name));
  }
  db.transaction(() => {
    for (const table of TABLES) {
      for (const row of seed[table]) {
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
      }
    }
    db.prepare('INSERT INTO content (key, value) VALUES (?, ?)').run(MARKER, new Date().toISOString());
  })();
  return true;
}
