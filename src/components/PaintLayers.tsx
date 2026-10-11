import { useId } from 'react';

/** The four layers of car paint, top to bottom; also used for the legend. */
export const PAINT_LAYERS = [
  { name: 'Blanke lak', note: 'Hier zitten swirls en krassen', color: '#d9dde0' },
  { name: 'Kleurlak', note: 'De kleur van je auto', color: '#3a3a40' },
  { name: 'Primer', note: 'Hechtlaag', color: '#8d8a84' },
  { name: 'Plaatwerk', note: 'Staal of aluminium', color: '#b9b6ae' },
];

// Clear-coat surface before polishing: flat with V-shaped scratches. After: one level line a little lower.
const SCRATCHED =
  'M20 70 L96 70 L104 92 L112 70 L196 70 L202 84 L208 70 L292 70 L302 98 L312 70 L398 70 L404 82 L410 70 L500 70';
const POLISHED_Y = 80;

/** Cross-section of car paint, before or after machine polishing, with light rays in gold. */
export function PaintLayers({ state, className = '' }: { state: 'before' | 'after'; className?: string }) {
  const id = useId().replace(/:/g, '');
  const after = state === 'after';
  const top = after ? `M20 ${POLISHED_Y} L500 ${POLISHED_Y}` : SCRATCHED;
  const clearShape = `${top} L500 130 L20 130 Z`;

  // Incoming rays hit the surface; reflections scatter on scratches, run parallel on a polished surface.
  const hits = after ? [110, 260, 410] : [104, 302, 404];
  const reflections = after
    ? hits.map((x) => ({ x, dx: 46, dy: -46 }))
    : [
        { x: 104, dx: -58, dy: -8 },
        { x: 302, dx: 8, dy: -56 },
        { x: 404, dx: 56, dy: -18 },
      ];
  const surfaceY = (x: number) => (after ? POLISHED_Y : x === 104 ? 92 : x === 302 ? 98 : 82);

  return (
    <svg viewBox="0 0 520 220" className={className} role="img" aria-label={after ? 'Lak na polijsten: glad oppervlak, licht weerkaatst gelijkmatig' : 'Lak voor polijsten: krassen in de blanke lak breken het licht'}>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" x2="1">
          <stop offset="0" stopColor="#a7a39b" />
          <stop offset="0.5" stopColor="#cfccc4" />
          <stop offset="1" stopColor="#a7a39b" />
        </linearGradient>
        <linearGradient id={`${id}-clear`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f3f1ec" stopOpacity="0.55" />
          <stop offset="1" stopColor="#d9dde0" stopOpacity="0.28" />
        </linearGradient>
        <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#e8b931" />
        </marker>
      </defs>

      {/* layers, bottom up */}
      <rect x="20" y="178" width="480" height="30" fill={`url(#${id}-metal)`} />
      <rect x="20" y="160" width="480" height="18" fill="#8d8a84" />
      <rect x="20" y="130" width="480" height="30" fill="#3a3a40" />
      <path d={clearShape} fill={`url(#${id}-clear)`} />
      <path d={top} fill="none" stroke="#f3f1ec" strokeWidth="1.6" strokeLinejoin="round" />

      {/* what polishing removed */}
      {after && (
        <>
          <line x1="20" x2="500" y1="70" y2="70" stroke="#f3f1ec" strokeOpacity="0.45" strokeDasharray="5 4" />
          <rect x="20" y="70" width="480" height="10" fill="#e8b931" fillOpacity="0.12" />
        </>
      )}

      {/* light */}
      <g stroke="#e8b931" strokeWidth="2" fill="none" strokeLinecap="round">
        {hits.map((x) => (
          <line key={`in-${x}`} x1={x - 46} y1={surfaceY(x) - 46} x2={x - 3} y2={surfaceY(x) - 3} markerEnd={`url(#${id}-arrow)`} opacity="0.95" />
        ))}
        {reflections.map((r) => (
          <line key={`out-${r.x}`} x1={r.x + 2} y1={surfaceY(r.x) - 2} x2={r.x + r.dx} y2={surfaceY(r.x) + r.dy} markerEnd={`url(#${id}-arrow)`} opacity={after ? 0.95 : 0.6} strokeDasharray={after ? undefined : '4 3'} />
        ))}
      </g>
    </svg>
  );
}
