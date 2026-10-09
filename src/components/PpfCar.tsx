import { useId } from 'react';

export type PpfCoverage = 'partial' | 'front' | 'full';

// A Porsche 911 seen from above (front at the top), drawn so the protected panels can be shown in gold.
// One flowing side line: narrow nose, gradually wider past the doors, widest at the rear hips.
const BODY =
  'M100 4 C126 4 146 8 156 20 C163 30 165 44 165 58 C166 90 167 140 168 180 C169 220 170 250 173 270 ' +
  'C178 290 181 310 181 330 C181 356 178 372 172 386 C162 404 138 412 100 412 ' +
  'C62 412 38 404 28 386 C22 372 19 356 19 330 C19 310 22 290 27 270 C30 250 31 220 32 180 ' +
  'C33 140 34 90 35 58 C35 44 37 30 44 20 C54 8 74 4 100 4 Z';
const HOOD = 'M64 28 C82 22 118 22 136 28 L145 142 C128 151 72 151 55 142 Z';
// The cabin is narrower than the body, so the doors show beside it.
const WINDSHIELD = 'M60 150 C76 143 124 143 140 150 L142 192 C124 186 76 186 58 192 Z';
const ROOF = 'M58 192 C76 186 124 186 142 192 L140 262 C124 257 76 257 60 262 Z';
const REAR_WINDOW = 'M60 262 C76 257 124 257 140 262 L135 296 C120 291 80 291 65 296 Z';
const ENGINE_LID = 'M60 296 C76 291 124 291 140 296 L148 380 C126 388 74 388 52 380 Z';
const SIDE_WINDOWS = ['M57 156 C52 190 52 232 58 266 L60 262 L58 192 L60 150 Z', 'M143 156 C148 190 148 232 142 266 L140 262 L142 192 L140 150 Z'];
/** Door panels between the front and rear seams. */
const DOORS = ['M33 160 L57 156 C52 192 52 230 58 262 L30 258 C31 225 32 190 33 160 Z', 'M167 160 L143 156 C148 192 148 230 142 262 L170 258 C169 225 168 190 167 160 Z'];
const MIRRORS = ['M34 150 C26 146 14 148 12 155 C11 162 22 165 34 163 Z', 'M166 150 C174 146 186 148 188 155 C189 162 178 165 166 163 Z'];

/** Covered area per package, as a clip region (front of the car is y = 0). */
const COVER_TO: Record<PpfCoverage, number> = { partial: 80, front: 150, full: 420 };

export function PpfCar({ coverage, className = '' }: { coverage: PpfCoverage; className?: string }) {
  const id = useId().replace(/:/g, '');
  const edge = COVER_TO[coverage];
  return (
    <svg viewBox="-6 -4 212 432" className={className} role="img" aria-label={`Bovenaanzicht van een auto; het goud toont waar de folie komt`}>
      <defs>
        <linearGradient id={`${id}-paint`} x1="0" x2="1">
          <stop offset="0" stopColor="#232326" />
          <stop offset="0.35" stopColor="#3a3a3f" />
          <stop offset="0.5" stopColor="#2c2c30" />
          <stop offset="0.65" stopColor="#3a3a3f" />
          <stop offset="1" stopColor="#1d1d20" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3b4249" />
          <stop offset="1" stopColor="#101215" />
        </linearGradient>
        {/* Transparent film: a light gold tint with fine diagonal lines. */}
        <pattern id={`${id}-film`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="#f1cf6e" fillOpacity="0.16" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#f6dc8f" strokeOpacity="0.6" strokeWidth="1.3" />
        </pattern>
        <clipPath id={`${id}-covered`}>
          <rect x="-10" y="-10" width="240" height={edge + 10} />
          {MIRRORS.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
        <clipPath id={`${id}-body`}>
          <path d={BODY} />
          {MIRRORS.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
        <filter id={`${id}-shadow`} x="-30%" y="-10%" width="160%" height="120%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* shadow and wheels */}
      <ellipse cx="100" cy="212" rx="88" ry="205" fill="#000" opacity="0.18" filter={`url(#${id}-shadow)`} />
      {[
        [159, 72],
        [27, 72],
        [175, 296],
        [11, 296],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="14" height="56" rx="6" fill="#0b0b0c" />
      ))}

      {/* body */}
      {MIRRORS.map((d) => (
        <path key={d} d={d} fill={`url(#${id}-paint)`} stroke="#0d0d0f" strokeWidth="1" />
      ))}
      <path d={BODY} fill={`url(#${id}-paint)`} stroke="#0d0d0f" strokeWidth="1.2" />
      <path d={HOOD} fill="none" stroke="#0d0d0f" strokeWidth="1" />
      <path d={HOOD} fill="none" stroke="#fff" strokeOpacity="0.05" strokeWidth="1" transform="translate(0 1)" />
      <path d={ROOF} fill="#2f2f33" stroke="#0d0d0f" strokeWidth="1" />
      <path d={ENGINE_LID} fill="none" stroke="#0d0d0f" strokeWidth="1" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1="74" x2="126" y1={318 + i * 7} y2={318 + i * 7} stroke="#0d0d0f" strokeWidth="1.6" />
      ))}
      {/* doors: panel, seams and handle */}
      {DOORS.map((d) => (
        <path key={d} d={d} fill="#fff" fillOpacity="0.06" stroke="#0d0d0f" strokeWidth="1.2" />
      ))}
      <rect x="36" y="236" width="9" height="3.5" rx="1.5" fill="#0d0d0f" />
      <rect x="155" y="236" width="9" height="3.5" rx="1.5" fill="#0d0d0f" />
      {/* frog-eye headlights */}
      <ellipse cx="48" cy="48" rx="10" ry="14" transform="rotate(-14 48 48)" fill="#cfd3d6" stroke="#0d0d0f" />
      <ellipse cx="152" cy="48" rx="10" ry="14" transform="rotate(14 152 48)" fill="#cfd3d6" stroke="#0d0d0f" />
      {/* rear light bar */}
      <path d="M36 386 C70 400 130 400 164 386" fill="none" stroke="#8a2020" strokeWidth="3" strokeLinecap="round" />

      {/* the film */}
      <g clipPath={`url(#${id}-body)`}>
        <rect x="-10" y="-10" width="220" height={edge + 10} fill={`url(#${id}-film)`} />
        {/* Mirror caps are part of every package. */}
        {MIRRORS.map((d) => (
          <path key={d} d={d} fill={`url(#${id}-film)`} />
        ))}
        {coverage !== 'full' && <line x1="0" x2="200" y1={edge} y2={edge} stroke="#e8b931" strokeWidth="1.5" strokeDasharray="4 3" />}
      </g>
      {/* gold edge along the protected panels */}
      <g clipPath={`url(#${id}-covered)`} fill="none" stroke="#e8b931" strokeWidth="2.2">
        <path d={BODY} />
        {MIRRORS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* glass stays clear */}
      <path d={WINDSHIELD} fill={`url(#${id}-glass)`} stroke="#0d0d0f" strokeWidth="1" />
      <path d={REAR_WINDOW} fill={`url(#${id}-glass)`} stroke="#0d0d0f" strokeWidth="1" />
      {SIDE_WINDOWS.map((d) => (
        <path key={d} d={d} fill={`url(#${id}-glass)`} stroke="#0d0d0f" strokeWidth="0.8" />
      ))}
      <path d="M60 156 C80 151 104 151 120 153" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
