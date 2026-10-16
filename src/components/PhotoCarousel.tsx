import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { imageSrcSet, imageUrl } from '../lib/images';

/**
 * Swipeable photo series: native scroll-snap on touch screens, arrow buttons and dots on desktop.
 * With a single photo it is just that photo. With `href` the photos link there, while the arrows
 * and dots only browse. In a small frame (a thumbnail) only the dots are shown.
 */
export function PhotoCarousel({
  images,
  alt,
  sizes,
  href,
  tone = 'dark',
  className = '',
  children,
}: {
  images: string[];
  alt: string;
  sizes: string;
  href?: string;
  /** 'light' for photos on a light background, such as product packshots. */
  tone?: 'dark' | 'light';
  className?: string;
  /** Overlays such as a badge. */
  children?: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = images.length;
  const bg = tone === 'light' ? 'bg-paper-2' : 'bg-ink-3';

  useEffect(() => {
    const el = track.current;
    if (!el || count < 2) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(Math.round(el.scrollLeft / el.clientWidth)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [count]);

  function go(index: number) {
    const el = track.current;
    if (!el) return;
    const target = (index + count) % count;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }

  const img = (ref: string, i: number) => (
    <img
      src={imageUrl(ref, 'sm')}
      srcSet={imageSrcSet(ref)}
      sizes={sizes}
      alt={count > 1 ? `${alt} (foto ${i + 1} van ${count})` : alt}
      loading="lazy"
      draggable={false}
      className="h-full w-full object-cover"
    />
  );

  const slide = (ref: string, i: number) =>
    href ? (
      <Link to={href} className="block h-full w-full" tabIndex={i === active ? undefined : -1}>
        {img(ref, i)}
      </Link>
    ) : (
      img(ref, i)
    );

  if (count < 2) {
    return (
      <div className={`relative overflow-hidden ${bg} ${className}`}>
        {images[0] && slide(images[0], 0)}
        {children}
      </div>
    );
  }

  const arrow =
    'absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center bg-ink/70 text-paper backdrop-blur-sm transition-opacity hover:bg-ink focus-visible:opacity-100 md:opacity-0 md:group-hover/carousel:opacity-100 @max-[11rem]:hidden';
  const dot = tone === 'light' ? 'bg-ink/25 hover:bg-ink/50' : 'bg-paper/60 hover:bg-paper';

  return (
    <div
      className={`group/carousel @container relative ${bg} ${className}`}
      role="region"
      aria-roledescription="carrousel"
      aria-label={alt}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        go(active + (e.key === 'ArrowRight' ? 1 : -1));
      }}
    >
      <div ref={track} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {images.map((ref, i) => (
          <div key={`${ref}-${i}`} className="h-full w-full shrink-0 snap-start snap-always" aria-hidden={i !== active}>
            {slide(ref, i)}
          </div>
        ))}
      </div>

      {children}

      <button type="button" onClick={() => go(active - 1)} className={`${arrow} left-3`} aria-label="Vorige foto">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => go(active + 1)} className={`${arrow} right-3`} aria-label="Volgende foto">
        <ChevronRight className="h-5 w-5" />
      </button>

      <span
        className="tabular absolute right-3 top-3 bg-ink/70 px-2 py-1 font-mono text-xs text-paper backdrop-blur-sm @max-[11rem]:hidden"
        aria-live="polite"
      >
        {active + 1} / {count}
      </span>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 @max-[11rem]:bottom-2 @max-[11rem]:gap-1">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Foto ${i + 1}`}
            aria-current={i === active}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-accent @max-[11rem]:w-3' : `w-1.5 ${dot}`}`}
          />
        ))}
      </div>
    </div>
  );
}
