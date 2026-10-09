import type { AdminPost, PostSummary, PublicPost } from '../shared/blog';
import type { PostInput } from '../shared/schemas';
import type { Db } from './db';

type Row = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const toAdmin = (r: Row): AdminPost => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt,
  body: r.body,
  cover: r.cover,
  status: r.status,
  publishedAt: r.published_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toSummary = (r: Row): PostSummary => ({ slug: r.slug, title: r.title, excerpt: r.excerpt, cover: r.cover, publishedAt: r.published_at! });

/** Published and not scheduled for later. */
const LIVE = `status = 'published' AND published_at <= ?`;

export function listPublishedPosts(db: Db, limit = 50): PostSummary[] {
  return (db.prepare(`SELECT * FROM posts WHERE ${LIVE} ORDER BY published_at DESC, id DESC LIMIT ?`).all(today(), limit) as Row[]).map(toSummary);
}

export function getPublishedPost(db: Db, slug: string): PublicPost | undefined {
  const row = db.prepare(`SELECT * FROM posts WHERE slug = ? AND ${LIVE}`).get(slug, today()) as Row | undefined;
  return row && { ...toSummary(row), body: row.body };
}

export function listAllPosts(db: Db): AdminPost[] {
  return (db.prepare('SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC, id DESC').all() as Row[]).map(toAdmin);
}

export function getPost(db: Db, id: number): AdminPost | undefined {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Row | undefined;
  return row && toAdmin(row);
}

export function slugTaken(db: Db, slug: string, exceptId?: number) {
  return Boolean(db.prepare('SELECT 1 FROM posts WHERE slug = ? AND id != ?').get(slug, exceptId ?? -1));
}

function values(input: PostInput) {
  return {
    ...input,
    // Publishing without a date means "today".
    publishedAt: input.status === 'published' ? (input.publishedAt ?? today()) : input.publishedAt,
  };
}

export function createPost(db: Db, input: PostInput): AdminPost {
  const v = values(input);
  const info = db
    .prepare('INSERT INTO posts (slug, title, excerpt, body, cover, status, published_at) VALUES (@slug, @title, @excerpt, @body, @cover, @status, @publishedAt)')
    .run(v);
  return getPost(db, Number(info.lastInsertRowid))!;
}

export function updatePost(db: Db, id: number, input: PostInput): AdminPost | undefined {
  const v = values(input);
  db.prepare(
    `UPDATE posts SET slug = @slug, title = @title, excerpt = @excerpt, body = @body, cover = @cover, status = @status,
     published_at = @publishedAt, updated_at = datetime('now') WHERE id = @id`,
  ).run({ ...v, id });
  return getPost(db, id);
}

export function deletePost(db: Db, id: number) {
  return db.prepare('DELETE FROM posts WHERE id = ?').run(id).changes > 0;
}
