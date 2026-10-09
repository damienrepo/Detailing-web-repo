// Blog posts: written in the admin, shown on /blog. The body uses a small, safe Markdown subset.

export type PostStatus = 'draft' | 'published';

export type PostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  cover: string | null;
  publishedAt: string;
};

export type PublicPost = PostSummary & { body: string };

export type AdminPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover: string | null;
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** "Mijn eerste blog!" → "mijn-eerste-blog" */
export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Estimated reading time in minutes. */
export function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
}
