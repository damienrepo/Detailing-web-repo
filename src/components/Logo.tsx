import { Link } from 'react-router';
import { SITE } from '../../shared/site';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label={`${SITE.fullName} — home`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <rect x="1" y="1" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M6 18 L18 6" stroke="#e4572e" strokeWidth="2.5" />
      </svg>
      <span className="font-wide text-[17px] font-bold tracking-[0.18em]">{SITE.name.toUpperCase()}</span>
    </Link>
  );
}
