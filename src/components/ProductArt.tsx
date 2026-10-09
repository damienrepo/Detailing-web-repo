import { useId } from 'react';
import { getProduct, type ProductId } from '../../shared/catalog';
import { imageSrcSet, imageUrl } from '../lib/images';

/** Products that have a drawn illustration; others show their photo or a plain placeholder. */
const ILLUSTRATED = ['interior-cleaner', 'interior-brush', 'microfiber-towel', 'interior-kit'];

// Vector packshots used until real product photography is available.
// To switch to photos, render an <img> in ProductImage instead of these.

const GOLD = '#e8b931';
const GOLD_DEEP = '#b8891a';

function Bottle({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" x2="1">
          <stop offset="0" stopColor="#0b0b0c" />
          <stop offset="0.22" stopColor="#2b2b2e" />
          <stop offset="0.5" stopColor="#151517" />
          <stop offset="1" stopColor="#070708" />
        </linearGradient>
        <linearGradient id={`${uid}-head`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2e2e31" />
          <stop offset="1" stopColor="#141416" />
        </linearGradient>
        <linearGradient id={`${uid}-label`} x1="0" x2="1">
          <stop offset="0" stopColor="#dedad2" />
          <stop offset="0.3" stopColor="#f6f4ef" />
          <stop offset="1" stopColor="#d4cfc5" />
        </linearGradient>
      </defs>
      {/* trigger head */}
      <path d="M170 110 V86 Q170 72 184 72 H262 Q271 72 271 81 V88 Q271 97 262 97 H238 V110 Z" fill={`url(#${uid}-head)`} />
      <rect x="264" y="76" width="13" height="17" rx="2" fill={GOLD} />
      <path d="M233 97 H247 Q253 122 247 150 Q245 157 239 153 Q241 126 233 97 Z" fill="#1c1c1f" />
      <rect x="176" y="108" width="48" height="16" rx="3" fill="#242427" />
      <rect x="176" y="112" width="48" height="2" fill="#0d0d0e" opacity="0.6" />
      <rect x="176" y="117" width="48" height="2" fill="#0d0d0e" opacity="0.6" />
      {/* body */}
      <path
        d="M150 176 Q150 152 174 146 L181 141 V124 H219 V141 L226 146 Q250 152 250 176 V342 Q250 357 235 357 H165 Q150 357 150 342 Z"
        fill={`url(#${uid}-body)`}
      />
      <rect x="160" y="168" width="7" height="176" rx="3.5" fill="#fff" opacity="0.07" />
      {/* label */}
      <rect x="157" y="198" width="86" height="124" fill={`url(#${uid}-label)`} />
      <rect x="157" y="198" width="86" height="4" fill={GOLD} />
      <text x="200" y="228" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontSize="12.5" fontWeight="700" fill="#0e0e0f">
        Detail<tspan fill={GOLD_DEEP}>2</tspan>Go
      </text>
      <line x1="171" x2="229" y1="238" y2="238" stroke="#0e0e0f" strokeOpacity="0.25" />
      <text x="200" y="260" textAnchor="middle" fontFamily="Archivo Variable, sans-serif" fontSize="10" fontWeight="600" letterSpacing="1.2" fill="#0e0e0f">
        INTERIOR
      </text>
      <text x="200" y="273" textAnchor="middle" fontFamily="Archivo Variable, sans-serif" fontSize="10" fontWeight="600" letterSpacing="1.2" fill="#0e0e0f">
        CLEANER
      </text>
      <text x="200" y="309" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="7" letterSpacing="1" fill="#5f5c57">
        500 ML · MAT
      </text>
    </g>
  );
}

function Brush({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-handle`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2d2d30" />
          <stop offset="0.35" stopColor="#18181a" />
          <stop offset="1" stopColor="#060607" />
        </linearGradient>
        <linearGradient id={`${uid}-ferrule`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f2f2f0" />
          <stop offset="0.45" stopColor="#a9a9a6" />
          <stop offset="0.6" stopColor="#d8d8d5" />
          <stop offset="1" stopColor="#77777a" />
        </linearGradient>
        <linearGradient id={`${uid}-hair`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ebe4d6" />
          <stop offset="0.5" stopColor="#d4cab6" />
          <stop offset="1" stopColor="#ab9f88" />
        </linearGradient>
      </defs>
      {/* handle */}
      <path d="M62 186 Q52 200 62 214 L250 218 V182 Z" fill={`url(#${uid}-handle)`} />
      <circle cx="78" cy="200" r="5" fill="#e8e5de" />
      <rect x="232" y="182" width="5" height="36" fill={GOLD} />
      <text x="150" y="203.5" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontSize="10" fontWeight="700" letterSpacing="0.5" fill="#8d8a84">
        Detail<tspan fill={GOLD}>2</tspan>Go
      </text>
      {/* ferrule */}
      <rect x="250" y="179" width="40" height="42" rx="2" fill={`url(#${uid}-ferrule)`} />
      <rect x="262" y="179" width="1.5" height="42" fill="#5f5f61" opacity="0.5" />
      <rect x="276" y="179" width="1.5" height="42" fill="#5f5f61" opacity="0.5" />
      {/* bristles */}
      <path d="M290 181 L338 175 Q366 200 338 225 L290 219 Z" fill={`url(#${uid}-hair)`} />
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1="292"
          x2={336 + (i % 3) * 3}
          y1={184 + i * 4}
          y2={180 + i * 5}
          stroke="#8f826b"
          strokeOpacity="0.35"
          strokeWidth="0.8"
        />
      ))}
    </g>
  );
}

function Towel({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <pattern id={`${uid}-weave`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="#fff" opacity="0.07" />
          <circle cx="4.5" cy="4.5" r="1" fill="#000" opacity="0.08" />
        </pattern>
        <linearGradient id={`${uid}-towel`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#5d646c" />
          <stop offset="1" stopColor="#3f454c" />
        </linearGradient>
      </defs>
      <rect x="92" y="108" width="216" height="200" rx="16" fill="#30353b" />
      <rect x="92" y="100" width="216" height="196" rx="16" fill="#353a41" />
      <rect x="92" y="92" width="216" height="196" rx="16" fill={`url(#${uid}-towel)`} />
      <rect x="92" y="92" width="216" height="196" rx="16" fill={`url(#${uid}-weave)`} />
      <path d="M100 190 Q200 182 300 190" stroke="#2b3036" strokeWidth="1.5" fill="none" opacity="0.5" />
      <rect x="240" y="262" width="54" height="15" fill={GOLD} />
      <text x="267" y="272.5" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontSize="8" fontWeight="700" fill="#0e0e0f">
        Detail2Go
      </text>
    </g>
  );
}

function Shadow({ cx, cy, rx, ry, uid }: { cx: number; cy: number; rx: number; ry: number; uid: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity="0.22" filter={`url(#${uid}-blur)`} />;
}

export function ProductArt({ productId, className = '' }: { productId: ProductId; className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-hidden>
      <defs>
        <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      {productId === 'interior-cleaner' && (
        <>
          <Shadow uid={uid} cx={200} cy={358} rx={66} ry={9} />
          <Bottle uid={`${uid}b`} />
        </>
      )}
      {productId === 'interior-brush' && (
        <>
          <Shadow uid={uid} cx={205} cy={300} rx={130} ry={10} />
          <g transform="rotate(-24 200 200)">
            <Brush uid={`${uid}r`} />
          </g>
        </>
      )}
      {productId === 'microfiber-towel' && (
        <>
          <Shadow uid={uid} cx={200} cy={316} rx={120} ry={12} />
          <g transform="rotate(-5 200 200)">
            <Towel uid={`${uid}t`} />
          </g>
        </>
      )}
      {productId === 'interior-kit' && (
        <>
          <Shadow uid={uid} cx={200} cy={352} rx={150} ry={12} />
          <g transform="translate(-46 52) scale(0.76) rotate(-6 200 200)">
            <Towel uid={`${uid}t`} />
          </g>
          <g transform="translate(112 22) scale(0.84)">
            <Bottle uid={`${uid}b`} />
          </g>
          <g transform="translate(22 168) scale(0.78) rotate(-7 200 200)">
            <Brush uid={`${uid}r`} />
          </g>
        </>
      )}
    </svg>
  );
}

export function ProductImage({ productId, className = '' }: { productId: ProductId; className?: string }) {
  const product = getProduct(productId);
  if (product?.image) {
    return (
      <div className={`relative aspect-square overflow-hidden bg-paper-2 ${className}`}>
        <img
          src={imageUrl(product.image, 'sm')}
          srcSet={imageSrcSet(product.image)}
          sizes="(min-width: 768px) 50vw, 100vw"
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  if (!ILLUSTRATED.includes(productId)) {
    return (
      <div className={`relative grid aspect-square place-items-center overflow-hidden bg-paper-2 p-6 text-center ${className}`}>
        <span className="font-logo text-lg font-bold text-ink/25">{product?.name ?? 'Detail2Go'}</span>
      </div>
    );
  }
  return (
    <div
      className={`relative aspect-square overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#f8f7f3_0%,#e7e3db_55%,#d6d1c7_100%)] ${className}`}
    >
      <ProductArt productId={productId} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
