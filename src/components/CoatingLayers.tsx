import { useId } from 'react';

/** Legend colours for the coating illustration (on top of the paint layers in PaintLayers). */
export const COATING_COLORS = { base: '#e8b931', top: '#f6dc8f' };

const SURFACE = 84;

/**
 * Cross-section of polished paint with 0, 1 or 2 coating layers in gold. Without coating, water
 * spreads out flat; with coating it beads up into round drops (the "lotus effect").
 */
export function CoatingLayers({ layers, className = '' }: { layers: 0 | 1 | 2; className?: string }) {
  const id = useId().replace(/:/g, '');
  const coatingTop = SURFACE - layers * 14;
  const drops = [
    { x: 92, r: 13 },
    { x: 168, r: 8 },
    { x: 238, r: 16 },
    { x: 318, r: 10 },
    { x: 392, r: 14 },
    { x: 452, r: 7 },
  ];

  return (
    <svg
      viewBox="0 0 520 220"
      className={className}
      role="img"
      aria-label={layers === 0 ? 'Lak zonder coating: water blijft plat liggen' : `Lak met ${layers === 1 ? 'één laag' : 'twee lagen'} coating: water parelt eraf`}
    >
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
        <radialGradient id={`${id}-drop`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#cfe3ee" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8fb6c9" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      {/* paint layers */}
      <rect x="20" y="178" width="480" height="30" fill={`url(#${id}-metal)`} />
      <rect x="20" y="160" width="480" height="18" fill="#8d8a84" />
      <rect x="20" y="130" width="480" height="30" fill="#3a3a40" />
      <rect x="20" y={SURFACE} width="480" height={130 - SURFACE} fill={`url(#${id}-clear)`} />

      {/* coating */}
      {layers >= 1 && <rect x="20" y={SURFACE - 14} width="480" height="14" fill={COATING_COLORS.base} fillOpacity="0.6" />}
      {layers === 2 && <rect x="20" y={SURFACE - 28} width="480" height="14" fill={COATING_COLORS.top} fillOpacity="0.75" />}
      <line x1="20" x2="500" y1={coatingTop} y2={coatingTop} stroke={layers ? '#f6dc8f' : '#f3f1ec'} strokeWidth="1.6" />

      {/* water */}
      {drops.map(({ x, r }) =>
        layers === 0 ? (
          // flat puddle: a low, wide cap
          <path
            key={x}
            d={`M${x - r * 2.4} ${coatingTop} Q${x} ${coatingTop - r * 1.1} ${x + r * 2.4} ${coatingTop} Z`}
            fill={`url(#${id}-drop)`}
            stroke="#cfe3ee"
            strokeOpacity="0.8"
          />
        ) : (
          // bead: almost a full sphere sitting on the coating
          <g key={x}>
            <ellipse cx={x} cy={coatingTop + 1.5} rx={r * 0.55} ry="1.5" fill="#000" opacity="0.25" />
            <circle cx={x} cy={coatingTop - r * 0.9} r={r} fill={`url(#${id}-drop)`} stroke="#cfe3ee" strokeOpacity="0.6" />
            <circle cx={x - r * 0.35} cy={coatingTop - r * 1.25} r={r * 0.22} fill="#fff" opacity="0.9" />
          </g>
        ),
      )}
    </svg>
  );
}
