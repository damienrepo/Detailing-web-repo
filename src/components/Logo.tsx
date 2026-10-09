import { Link } from 'react-router';
import { SITE } from '../../shared/site';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`} aria-label={`${SITE.fullName} — home`}>
      <span className="font-logo text-[22px] font-bold leading-none tracking-[-0.01em]" aria-hidden>
        Detail<span className="text-accent">2</span>Go
      </span>
    </Link>
  );
}
