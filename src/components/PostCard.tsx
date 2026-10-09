import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import type { PostSummary } from '../../shared/blog';
import { imageSrcSet, imageUrl } from '../lib/images';

export function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group flex h-full flex-col bg-ink-2 transition-colors hover:bg-ink-3">
      <div className="aspect-[16/10] overflow-hidden bg-ink-3">
        {post.cover ? (
          <img
            src={imageUrl(post.cover, 'sm')}
            srcSet={imageSrcSet(post.cover)}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out-quart group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <span className="font-logo text-2xl font-bold text-paper/15">
              Detail<span className="text-accent/40">2</span>Go
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow text-paper/45">{formatDate(post.publishedAt)}</p>
        <h3 className="font-display mt-3 text-2xl leading-tight">{post.title}</h3>
        {post.excerpt && <p className="mb-6 mt-3 text-[15px] leading-relaxed text-paper/65">{post.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-accent">
          Lees verder
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
