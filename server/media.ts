// Uploaded images. The browser resizes photos and re-encodes them as JPEG (which also strips
// location and camera data); the server only accepts files that really are JPEGs of sane size.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db';

export type MediaItem = { id: string; name: string; alt: string; width: number; height: number; bytes: number; createdAt: string };

export const MEDIA_LIMITS = { largeBytes: 4 * 1024 * 1024, smallBytes: 1024 * 1024, maxSide: 2600 };

export const MEDIA_ID = /^m_[a-z0-9]{16}$/;

/** Width and height from the JPEG frame header, or null when the data is not a JPEG. */
export function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = buf.readUInt16BE(i + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  return null;
}

type Row = { id: string; name: string; alt: string; width: number; height: number; bytes: number; created_at: string };
const toItem = (r: Row): MediaItem => ({ id: r.id, name: r.name, alt: r.alt, width: r.width, height: r.height, bytes: r.bytes, createdAt: r.created_at });

export class MediaStore {
  constructor(
    private db: Db,
    readonly dir: string,
  ) {
    fs.mkdirSync(dir, { recursive: true });
  }

  list(): MediaItem[] {
    return (this.db.prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC').all() as Row[]).map(toItem);
  }

  get(id: string): MediaItem | undefined {
    const row = this.db.prepare('SELECT * FROM media WHERE id = ?').get(id) as Row | undefined;
    return row && toItem(row);
  }

  /** Throws an Error with a Dutch message when the upload is not acceptable. */
  add(input: { name: string; alt: string; large: Buffer; small: Buffer }): MediaItem {
    const size = jpegSize(input.large);
    const smallSize = jpegSize(input.small);
    if (!size || !smallSize) throw new Error('Dit bestand is geen geldige afbeelding.');
    if (input.large.length > MEDIA_LIMITS.largeBytes || input.small.length > MEDIA_LIMITS.smallBytes) throw new Error('Deze afbeelding is te groot.');
    if (Math.max(size.width, size.height) > MEDIA_LIMITS.maxSide || size.width < 16 || size.height < 16) throw new Error('Deze afbeelding heeft een ongebruikelijk formaat.');

    const id = `m_${Array.from(crypto.randomBytes(16), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
    fs.writeFileSync(path.join(this.dir, `${id}.jpg`), input.large, { flag: 'wx' });
    fs.writeFileSync(path.join(this.dir, `${id}-sm.jpg`), input.small, { flag: 'wx' });
    this.db
      .prepare('INSERT INTO media (id, name, alt, width, height, bytes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.name, input.alt, size.width, size.height, input.large.length + input.small.length);
    return this.get(id)!;
  }

  update(id: string, input: { name: string; alt: string }) {
    this.db.prepare('UPDATE media SET name = ?, alt = ? WHERE id = ?').run(input.name, input.alt, id);
    return this.get(id);
  }

  remove(id: string) {
    if (!MEDIA_ID.test(id)) return false;
    for (const file of [`${id}.jpg`, `${id}-sm.jpg`]) fs.rmSync(path.join(this.dir, file), { force: true });
    return this.db.prepare('DELETE FROM media WHERE id = ?').run(id).changes > 0;
  }

  /** Where an image is used, so it is not deleted by accident. */
  usage(id: string): string[] {
    const where: string[] = [];
    const content = this.db.prepare('SELECT key, value FROM content').all() as { key: string; value: string }[];
    const labels: Record<string, string> = { site: 'Bedrijfsgegevens', home: 'Homepage', services: 'Diensten', products: 'Producten' };
    for (const row of content) if (row.value.includes(id)) where.push(labels[row.key] ?? row.key);
    const posts = this.db.prepare(`SELECT title FROM posts WHERE cover = ? OR body LIKE ?`).all(id, `%${id}%`) as { title: string }[];
    for (const post of posts) where.push(`Blog: ${post.title}`);
    const members = this.db.prepare('SELECT name FROM team_members WHERE photo = ?').all(id) as { name: string }[];
    for (const member of members) where.push(`Team: ${member.name}`);
    return where;
  }
}
