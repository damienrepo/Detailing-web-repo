import { MessageCircle, Phone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { SITE } from '../../shared/site';

/** Pages where the button would only distract. */
const HIDDEN_ON = ['/afrekenen'];

/**
 * Floating contact button, bottom right: opens a small panel to call or WhatsApp straight away.
 * Clicks are counted by the statistics, which track tel: and wa.me links on their own.
 */
export function ContactWidget() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (HIDDEN_ON.includes(pathname)) return null;

  const whatsapp = `${SITE.whatsapp}?text=${encodeURIComponent(`Hoi ${SITE.name}, ik heb een vraag over `)}`;
  const option = 'group flex items-center gap-4 p-3 transition-colors hover:bg-white/5';

  return (
    <div ref={root} className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] right-4 z-30 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      <div
        id="contact-panel"
        role="dialog"
        aria-label="Direct contact"
        inert={!open}
        className={`w-[min(20rem,calc(100vw-2rem))] origin-bottom-right border border-white/10 bg-ink text-paper shadow-2xl transition duration-200 ease-out-quart ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
        }`}
      >
        <div className="border-b border-white/10 p-5">
          <p className="eyebrow text-accent">Direct contact</p>
          <p className="font-display mt-2 text-xl leading-tight">Vraag over je auto?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-paper/60">Bel of app ons direct, zonder formulier.</p>
        </div>
        <div className="p-2">
          <a href={whatsapp} target="_blank" rel="noreferrer" className={option}>
            <span className="grid h-11 w-11 shrink-0 place-items-center bg-[#25d366] text-ink">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">WhatsApp</span>
              <span className="block text-sm text-paper/60">Stuur ons een berichtje</span>
            </span>
          </a>
          <a href={`tel:${SITE.phoneHref}`} className={option}>
            <span className="grid h-11 w-11 shrink-0 place-items-center bg-accent-fill text-ink">
              <Phone className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">Bellen</span>
              <span className="tabular block text-sm text-paper/60">{SITE.phone}</span>
            </span>
          </a>
        </div>
      </div>

      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="contact-panel"
        aria-label={open ? 'Contact sluiten' : 'Bel of app ons'}
        className="flex h-14 items-center gap-2.5 bg-accent-fill px-4 text-[15px] font-medium text-ink shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out-quart hover:-translate-y-0.5 md:px-5"
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <MessageCircle className="h-5 w-5" aria-hidden />}
        <span className="max-md:hidden">{open ? 'Sluiten' : 'Bel of app ons'}</span>
      </button>
    </div>
  );
}
