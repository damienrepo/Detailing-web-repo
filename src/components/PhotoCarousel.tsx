import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { imageSrcSet, imageUrl } from '../lib/images';

/**
 * Swipeable photo series: native scroll-snap on touch screens, arrow buttons and dots on desktop.
 * With a single photo it is just that photo.
 */
export function PhotoCarousel({ images, alt, sizes, className = '' }: { images: string[]; alt: string; sizes: string; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = images.length;

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

  if (count < 2) {
    return <div className={`overflow-hidden bg-ink-3 ${className}`}>{images[0] && img(images[0], 0)}</div>;
  }

  const arrow = 'absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center bg-ink/70 text-paper backdrop-blur-sm transition-opacity hover:bg-ink focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100';

  return (
    <div
      className={`group relative bg-ink-3 ${className}`}
      role="region"
      aria-roledescription="carrousel"
      aria-label={alt}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(active + 1);
        if (e.key === 'ArrowLeft') go(active - 1);
      }}
    >
      <div ref={track} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {images.map((ref, i) => (
          <div key={`${ref}-${i}`} className="h-full w-full shrink-0 snap-start snap-always" aria-hidden={i !== active}>
            {img(ref, i)}
          </div>
        ))}
      </div>

      <button type="button" onClick={() => go(active - 1)} className={`${arrow} left-3`} aria-label="Vorige foto">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => go(active + 1)} className={`${arrow} right-3`} aria-label="Volgende foto">
        <ChevronRight className="h-5 w-5" />
      </button>

      <span className="tabular absolute right-3 top-3 bg-ink/70 px-2 py-1 font-mono text-xs text-paper backdrop-blur-sm" aria-live="polite">
        {active + 1} / {count}
      </span>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Foto ${i + 1}`}
            aria-current={i === active}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-6 bg-accent' : 'w-1.5 bg-paper/60 hover:bg-paper'}`}
          />
        ))}
      </div>
    </div>
  );
}
