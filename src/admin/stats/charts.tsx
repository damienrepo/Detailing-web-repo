// Small, dependency-free SVG/HTML charts for the statistics screens: a trend line with comparison,
// bar lists, a funnel and a weekday × hour heatmap. Thin marks, hairline grid, one hue per job.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Bucket, SeriesMetric, SeriesPoint } from '../../../shared/analytics';
import { bucketLabel, fmtNumber, fmtPercent } from './format';

const INK = '#0e0e0f';
const PREV = '#8d8a84';
const GRID = '#ebe8e1';
const WASH = '#d9a72a';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A round step so four gridlines land on clean values (0, 5, 10, 15, 20). */
function niceStep(raw: number, integer: boolean) {
  if (raw <= 0) return integer ? 1 : 0.25;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  return integer ? Math.max(1, Math.ceil(step)) : step;
}

// --- Trend -------------------------------------------------------------------------------

export function TrendChart({
  points,
  metric,
  bucket,
  format,
  compare,
  label,
  partialEnd,
}: {
  points: SeriesPoint[];
  metric: SeriesMetric;
  bucket: Bucket;
  format: (n: number) => string;
  compare: boolean;
  label: string;
  /** End of the period; the last bucket is still filling up when it ends before the bucket does. */
  partialEnd?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 30, left: 56 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const n = points.length;
  const integer = metric === 'visitors' || metric === 'sessions' || metric === 'pageviews' || metric === 'conversions';

  const values = points.map((p) => p[metric]);
  const prevValues = compare ? points.map((p) => p.prev?.[metric] ?? 0) : [];
  const peak = Math.max(0, ...values, ...prevValues);
  const step = niceStep(peak / 4, integer);
  const max = metric === 'bounceRate' ? Math.min(1, step * 4) || 1 : step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => pad.top + innerH - (Math.min(v, max) / max) * innerH;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const baseline = pad.top + innerH;

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 76))));

  const pick = (clientX: number, rect: DOMRect) => {
    if (n === 0) return;
    const px = clientX - rect.left - pad.left;
    setHover(Math.max(0, Math.min(n - 1, n <= 1 ? 0 : Math.round((px / innerW) * (n - 1)))));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const h = hover !== null ? points[hover] : null;
  const tipLeft = hover !== null ? x(hover) : 0;
  const flip = tipLeft > width - 200;

  return (
    <div ref={ref} className="relative select-none">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label} per ${bucket === 'hour' ? 'uur' : bucket === 'week' ? 'week' : 'dag'}. Gebruik de pijltjestoetsen om de waarden te lezen.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="block outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-stone-dark text-[11px]">
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <text key={p.start} x={x(i)} y={height - 8} textAnchor={n > 1 && i === 0 ? 'start' : 'middle'} className="fill-stone-dark text-[11px]">
                {bucketLabel(p.start, bucket)}
              </text>
            ) : null,
          )}
          {n > 1 && <path d={`${line(values)} L${x(n - 1)},${baseline} L${x(0)},${baseline} Z`} fill={WASH} fillOpacity={0.12} />}
          {compare && n > 1 && <path d={line(prevValues)} fill="none" stroke={PREV} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
          {n > 1 && <path d={line(values)} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {n === 1 && <circle cx={x(0)} cy={y(values[0])} r={4} fill={INK} stroke="#fff" strokeWidth={2} />}
          {h && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={baseline} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
              {compare && <circle cx={x(hover)} cy={y(prevValues[hover])} r={4} fill={PREV} stroke="#fff" strokeWidth={2} />}
              <circle cx={x(hover)} cy={y(values[hover])} r={4.5} fill={INK} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          <rect
            x={pad.left - 8}
            y={pad.top}
            width={innerW + 16}
            height={innerH}
            fill="transparent"
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 border border-paper-3 bg-white px-3 py-2 text-sm shadow-lg"
          style={flip ? { right: Math.max(0, width - tipLeft + 12) } : { left: tipLeft + 12 }}
          role="status"
        >
          <p className="text-xs text-stone-dark">
            {bucketLabel(h.start, bucket, true)}
            {partialEnd && hover === n - 1 && partialEnd < h.start + (bucket === 'hour' ? 3_600_000 : bucket === 'week' ? 7 * 86_400_000 : 86_400_000) - 60_000 && ' (tot nu)'}
          </p>
          <p className="mt-1 flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 bg-ink" />
            <strong className="tabular font-semibold">{format(h[metric])}</strong>
          </p>
          {compare && h.prev && (
            <p className="mt-1 flex items-center gap-2 text-stone-dark">
              <span aria-hidden className="h-0.5 w-3 bg-stone" />
              <span className="tabular">{format(h.prev[metric])}</span>
              <span className="text-xs">{bucketLabel(h.prevStart, bucket, true)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TrendLegend({ compare }: { compare: boolean }) {
  return (
    <div className="flex items-center gap-4 whitespace-nowrap text-xs text-stone-dark">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-0.5 w-4 bg-ink" />
        Deze periode
      </span>
      {compare && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-stone" />
          Vorige periode
        </span>
      )}
    </div>
  );
}

// --- Bar list ------------------------------------------------------------------------------

export type Column<T> = { header: string; render: (row: T) => ReactNode; className?: string };

/** Rows with a light bar behind them sized to `value`; clicking a row narrows the dashboard to it. */
export function BarList<T>({
  rows,
  value,
  label,
  header,
  columns,
  onSelect,
  selectLabel,
  empty = 'Nog geen gegevens in deze periode.',
  limit = 8,
}: {
  rows: T[];
  value: (row: T) => number;
  label: (row: T) => ReactNode;
  header: string;
  columns: Column<T>[];
  onSelect?: (row: T) => void;
  selectLabel?: (row: T) => string;
  empty?: string;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="py-6 text-sm text-stone-dark">{empty}</p>;
  const max = Math.max(1, ...rows.map(value));
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-paper-3 pb-2 text-xs font-medium text-stone-dark">
        <span className="min-w-0 flex-1">{header}</span>
        {columns.map((c) => (
          <span key={c.header} className={`w-16 shrink-0 text-right ${c.className ?? ''}`}>
            {c.header}
          </span>
        ))}
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {shown.map((row, i) => {
          const content = (
            <>
              <span aria-hidden className="absolute inset-y-0 left-0 bg-accent-fill/20 transition-colors group-hover:bg-accent-fill/35" style={{ width: `${(value(row) / max) * 100}%` }} />
              <span className="relative min-w-0 flex-1 truncate text-left">{label(row)}</span>
              {columns.map((c) => (
                <span key={c.header} className={`tabular relative w-16 shrink-0 text-right ${c.className ?? ''}`}>
                  {c.render(row)}
                </span>
              ))}
            </>
          );
          const cls = 'group relative flex w-full items-center gap-3 px-2 py-1.5 text-sm';
          return (
            <li key={i}>
              {onSelect ? (
                <button type="button" className={`${cls} hover:outline hover:outline-1 hover:outline-ink/20`} onClick={() => onSelect(row)} title={selectLabel?.(row)}>
                  {content}
                </button>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-sm font-medium underline-offset-2 hover:underline">
          {all ? 'Minder tonen' : `Alle ${rows.length} tonen`}
        </button>
      )}
    </div>
  );
}

// --- Funnel ------------------------------------------------------------------------------

export function FunnelChart({ steps }: { steps: { label: string; sessions: number }[] }) {
  const first = steps[0]?.sessions || 0;
  if (!first) return <p className="py-6 text-sm text-stone-dark">Nog geen bezoeken in deze periode.</p>;
  return (
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].sessions : 0;
        const drop = i > 0 && prev > 0 ? 1 - step.sessions / prev : 0;
        return (
          <li key={step.label}>
            {i > 0 && (
              <p className={`py-1 pl-1 text-xs ${drop >= 0.6 ? 'text-danger' : 'text-stone-dark'}`}>
                ↓ {prev > 0 ? `${fmtPercent(drop)} haakt hier af` : '—'}
              </p>
            )}
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{step.label}</span>
              <span className="tabular text-stone-dark">
                <strong className="font-semibold text-ink">{fmtNumber(step.sessions)}</strong> · {fmtPercent(step.sessions / first)}
              </span>
            </div>
            <div className="mt-1 h-3 bg-paper-2">
              <div className="h-full rounded-r-[4px] bg-accent-fill" style={{ width: `${Math.max(step.sessions ? 0.6 : 0, (step.sessions / first) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// --- Heatmap -----------------------------------------------------------------------------

const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const DAYS_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
/** One hue, light to dark; empty cells stay neutral. */
const RAMP = ['#efede8', '#f6e8c0', '#ecd07f', '#d9a72a', '#a47b12', '#6b4f08'];

export function Heatmap({ data }: { data: number[][] }) {
  const [tip, setTip] = useState<{ d: number; h: number; left: number; top: number } | null>(null);
  const max = Math.max(0, ...data.flat());
  const level = (n: number) => (n === 0 || max === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  return (
    <div className="relative" onPointerLeave={() => setTip(null)}>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: '2rem repeat(24, minmax(0, 1fr))' }}>
        {data.map((row, d) => (
          <div key={d} className="contents">
            <span className="pr-1 text-xs leading-5 text-stone-dark">{DAYS[d]}</span>
            {row.map((n, h) => (
              <span
                key={h}
                role="img"
                tabIndex={-1}
                aria-label={`${DAYS_LONG[d]} ${h}:00: ${n} bezoeken`}
                className="h-5 rounded-[2px] transition-[outline] hover:outline hover:outline-2 hover:outline-ink"
                style={{ background: RAMP[level(n)] }}
                onPointerEnter={(e) => {
                  const el = e.currentTarget;
                  setTip({ d, h, left: el.offsetLeft + el.offsetWidth / 2, top: el.offsetTop });
                }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="pt-1 text-center text-[10px] text-stone-dark">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
      </div>
      {tip && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-paper-3 bg-white px-2.5 py-1.5 text-xs shadow-lg" style={{ left: tip.left, top: tip.top - 6 }}>
          <strong className="tabular text-sm font-semibold">{fmtNumber(data[tip.d][tip.h])}</strong> <span className="text-stone-dark">bezoeken</span>
          <span className="block text-stone-dark">
            {DAYS_LONG[tip.d]} {tip.h}:00–{tip.h + 1}:00
          </span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-stone-dark">
        Minder
        {RAMP.map((c) => (
          <span key={c} aria-hidden className="h-3 w-3 rounded-[2px]" style={{ background: c }} />
        ))}
        Meer
      </div>
    </div>
  );
}

// --- Small pieces ----------------------------------------------------------------------------

/** Change against the previous period; colour follows whether the change is good, with an arrow and sign. */
export function Delta({ now, before, inverse = false, title }: { now: number; before: number; inverse?: boolean; title?: string }) {
  if (before === 0 && now === 0) return <span className="text-xs text-stone">—</span>;
  if (before === 0) return <span className="text-xs text-stone-dark" title={title}>nieuw</span>;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className="text-xs text-stone-dark" title={title}>± 0%</span>;
  const good = inverse ? change < 0 : change > 0;
  return (
    <span className={`tabular inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-[#24533d]' : 'text-danger'}`} title={title}>
      {change > 0 ? '▲' : '▼'} {fmtPercent(Math.abs(change))}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: NoInfer<T>) => void; tabs: { id: NoInfer<T>; label: string }[] }) {
  return (
    <div role="tablist" className="no-scrollbar -mb-px flex gap-4 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 border-b-2 pb-2 text-sm transition-colors ${value === t.id ? 'border-ink font-medium text-ink' : 'border-transparent text-stone-dark hover:text-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
