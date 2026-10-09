import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { readingMinutes, type PostSummary, type PublicPost } from '../../shared/blog';
import { SITE } from '../../shared/site';
import { formatDate, PostCard } from '../components/PostCard';
import { ClosingCta } from '../components/Section';
import { Eyebrow } from '../components/ui';
import { api } from '../lib/api';
import { imageSrcSet, imageUrl } from '../lib/images';
import { Markdown } from '../lib/markdown';
import { usePageMeta, useStructuredData } from '../lib/meta';
import NotFound from './NotFound';

export default function Blog() {
  usePageMeta('Blog', `Tips, behandelingen en projecten van ${SITE.fullName}.`);
  const [posts, setPosts] = useState<PostSummary[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    api<PostSummary[]>('/posts')
      .then(setPosts)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <section className="bg-ink pb-20 pt-16 text-paper md:pb-28 md:pt-[72px]">
        <div className="container-page pt-16 md:pt-24">
          <Eyebrow className="text-paper/60">Blog</Eyebrow>
          <h1 className="font-display mt-6 max-w-3xl text-[clamp(2.75rem,7vw,5rem)] leading-[0.95]">Uit de werkplaats.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/70">
            Onderhoudstips, uitleg over behandelingen en projecten waar we trots op zijn.
          </p>

          <div className="mt-16">
            {error && <p className="text-paper/70">De berichten konden niet worden geladen. Probeer het later opnieuw.</p>}
            {!posts && !error && <div className="h-64 animate-pulse bg-ink-2" aria-label="Laden" />}
            {posts?.length === 0 && <p className="text-paper/70">Binnenkort verschijnen hier de eerste berichten.</p>}
            {posts && posts.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <ClosingCta />
    </>
  );
}

export function BlogPost() {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<PublicPost | null>();

  useEffect(() => {
    setPost(undefined);
    api<PublicPost>(`/posts/${encodeURIComponent(slug)}`)
      .then(setPost)
      .catch(() => setPost(null));
  }, [slug]);

  usePageMeta(post?.title, post?.excerpt || undefined);
  useStructuredData(
    'post',
    post && {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      datePublished: post.publishedAt,
      ...(post.cover ? { image: location.origin + imageUrl(post.cover) } : {}),
      author: { '@type': 'Organization', name: SITE.fullName },
    },
  );

  if (post === null) return <NotFound />;

  return (
    <>
      <article className="bg-paper pb-20 pt-16 text-ink md:pb-28 md:pt-[72px]">
        <div className="container-page max-w-3xl">
          <nav aria-label="Kruimelpad" className="py-5 text-sm text-stone-dark">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link to="/blog" className="hover:text-ink">
                  Blog
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <li aria-current="page" className="truncate text-ink">
                {post?.title ?? '…'}
              </li>
            </ol>
          </nav>
          {!post ? (
            <div className="mt-10 space-y-4" aria-label="Laden">
              <div className="h-14 w-3/4 animate-pulse bg-paper-3" />
              <div className="h-80 animate-pulse bg-paper-3" />
            </div>
          ) : (
            <>
              <p className="eyebrow mt-8 text-stone-dark">
                {formatDate(post.publishedAt)} · {readingMinutes(post.body)} min lezen
              </p>
              <h1 className="font-display mt-4 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02]">{post.title}</h1>
              {post.excerpt && <p className="mt-6 text-xl leading-relaxed text-stone-dark">{post.excerpt}</p>}
              {post.cover && (
                <figure className="mt-10 aspect-[16/9] overflow-hidden bg-paper-3">
                  <img src={imageUrl(post.cover)} srcSet={imageSrcSet(post.cover)} sizes="(min-width: 768px) 768px, 100vw" alt="" className="h-full w-full object-cover" />
                </figure>
              )}
              <div className="mt-4 text-[18px] leading-[1.75] text-ink/85">
                <Markdown source={post.body} />
              </div>
              <div className="mt-16 border-t border-ink/15 pt-8">
                <Link to="/blog" className="text-sm font-medium underline underline-offset-4">
                  ← Alle berichten
                </Link>
              </div>
            </>
          )}
        </div>
      </article>
      <ClosingCta />
    </>
  );
}
