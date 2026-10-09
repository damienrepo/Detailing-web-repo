// Writes the local content (texts, blog, team, photos) to seed/, for a fresh installation to start from.
//   npm run seed:export
import path from 'node:path';
import { loadConfig } from '../config';
import { openDb } from '../db';
import { exportSeed } from '../seed';

const config = loadConfig();
const out = path.resolve(import.meta.dirname, '../../seed');
const counts = exportSeed(openDb(config.databasePath), config.uploadsDir, out);
console.log(`Geëxporteerd naar ${out}:`, counts);
