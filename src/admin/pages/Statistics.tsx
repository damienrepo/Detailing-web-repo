import {
  Bug,
  CalendarCheck,
  CreditCard,
  ExternalLink,
  FileQuestion,
  Gauge,
  Lightbulb,
  Mail,
  MessageCircle,
  Monitor,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Table2,
  Tablet,
  TrendingUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import {
  CHANNEL_HINTS,
  CHANNEL_LABELS,
  DEVICE_LABELS,
  EVENT_INFO,
  FILTER_KEYS,
  FILTER_LABELS,
  type Channel,
  type Device,
  type DimRow,
  type EventName,
  type FilterKey,
  type Filters,
  type Insight,
  type Loyalty,
  type Metrics,
  type PageDetail,
  type PageRow,
  type Report,
  type SeriesMetric,
  type SessionDetail,
  type SessionSummary,
} from '../../../shared/analytics';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { confirmAction } from '../../lib/demo';
import { ErrorBox, Loading, PageHeader, useToast } from '../kit';
import { BarList, Delta, FunnelChart, Heatmap, Tabs, TrendChart, TrendLegend, type Column } from '../stats/charts';
import {
  bucketLabel,
  countryName,
  daysAgo,
  eventDetail,
  eventLabel,
  fmtDateTime,
  fmtDuration,
  fmtMoney,
  fmtNumber,
  fmtPercent,
  fmtSeconds,
  fmtTime,
  languageName,
  ordinal,
  pageName,
  valueLabel,
} from '../stats/format';

type ReportResponse = Report & { hasData: boolean };
type Live = { visitors: number; pages: { path: string; count: number }[] };

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';
const DAY = 86_400_000;

// --- Period ---------------------------------------------------------------------------------

const PERIODS = [
  { id: 'today', label: 'Vandaag' },
  { id: 'yesterday', label: 'Gisteren' },
  { id: '7d', label: '7 dagen' },
  { id: '30d', label: '30 dagen' },
  { id: '90d', label: '90 dagen' },
  { id: '12m', label: '12 maanden' },
  { id: 'custom', label: 'Aangepast' },
] as const;
type PeriodId = (typeof PERIODS)[number]['id'];

function midnight(days = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function parseDay(value: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

const isoDay = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function rangeFor(period: PeriodId, van: string | null, tot: string | null, now: number) {
  switch (period) {
    case 'today':
      return { from: midnight(0), to: now };
    case 'yesterday':
      return { from: midnight(-1), to: midnight(0) };
    case '7d':
      return { from: midnight(-6), to: now };
    case '90d':
      return { from: midnight(-89), to: now };
    case '12m':
      return { from: midnight(-364), to: now };
    case 'custom': {
      const from = parseDay(van) ?? midnight(-29);
      const end = new Date(parseDay(tot) ?? midnight(0));
      end.setDate(end.getDate() + 1);
      const to = Math.max(from + 3_600_000, Math.min(end.getTime(), now));
      return { from: Math.max(from, to - 400 * DAY), to };
    }
    default:
      return { from: midnight(-29), to: now };
  }
}

// --- Data -------------------------------------------------------------------------------------

/** Like useAdminData, but keeps showing the previous result while the next one loads. */
function useStats<T>(path: string) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    api<T>(path).then(
      (data) => !cancelled && setState({ data, loading: false }),
      (err) => !cancelled && setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Laden is niet gelukt.' })),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);
  return state;
}

function readFilters(params: URLSearchParams): Filters {
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

// --- Page --------------------------------------------------------------------------------------

const TILES: { id: SeriesMetric; label: string; hint: string; value: (m: Metrics) => number; format: (n: number) => string; inverse?: boolean; sub?: (m: Metrics) => string }[] = [
  {
    id: 'visitors',
    label: 'Bezoekers',
    hint: 'Unieke bezoekers. Met de statistiekcookie herkennen we iemand ook op een andere dag; zonder telt iemand die op twee dagen komt twee keer.',
    value: (m) => m.visitors,
    format: fmtNumber,
  },
  { id: 'sessions', label: 'Bezoeken', hint: 'Een bezoek eindigt na 30 minuten zonder activiteit.', value: (m) => m.sessions, format: fmtNumber },
  {
    id: 'pageviews',
    label: 'Paginaweergaven',
    hint: 'Elke geopende pagina telt één keer.',
    value: (m) => m.pageviews,
    format: fmtNumber,
    sub: (m) => `${m.pagesPerSession.toFixed(1).replace('.', ',')} per bezoek`,
  },
  { id: 'avgDuration', label: 'Gem. bezoekduur', hint: 'Hoe lang de website gemiddeld echt in beeld was per bezoek.', value: (m) => m.avgDuration, format: fmtDuration },
  {
    id: 'bounceRate',
    label: 'Bouncepercentage',
    hint: 'Bezoeken van één pagina, korter dan 10 seconden en zonder actie. Lager is beter.',
    value: (m) => m.bounceRate,
    format: (n) => fmtPercent(n),
    inverse: true,
  },
  {
    id: 'conversions',
    label: 'Conversies',
    hint: 'Bezoeken met een afspraakaanvraag of een betaalde bestelling.',
    value: (m) => m.conversions,
    format: fmtNumber,
    sub: (m) => `${fmtPercent(m.conversionRate, 1)} van de bezoeken`,
  },
];

export function StatisticsPage() {
  const [params, setParams] = useSearchParams();
  const [tick, setTick] = useState(0);
  const [metric, setMetric] = useState<SeriesMetric>('visitors');
  const [compare, setCompare] = useState(true);
  const [table, setTable] = useState(false);

  const period = (PERIODS.some((p) => p.id === params.get('periode')) ? params.get('periode') : '30d') as PeriodId;
  const van = params.get('van');
  const tot = params.get('tot');
  const filters = useMemo(() => readFilters(params), [params]);
  const filterKey = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const range = useMemo(() => rangeFor(period, van, tot, Date.now()), [period, van, tot, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const query = useMemo(() => new URLSearchParams({ from: String(range.from), to: String(range.to), tz: TZ, ...filters }).toString(), [range, filterKey]);
  const report = useStats<ReportResponse>(`/admin/analytics?${query}`);
  const data = report.data;
  const titles = useMemo(() => new Map(data?.pages.map((p) => [p.path, p.title]) ?? []), [data]);

  const update = (change: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next);
  };
  const setFilter = (key: FilterKey, value: string) => {
    update((p) => p.set(key, value));
    if (key === 'page') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const removeFilter = (key: FilterKey) => update((p) => p.delete(key));
  const setPeriod = (id: PeriodId) =>
    update((p) => {
      p.set('periode', id);
      if (id === 'custom') {
        p.set('van', isoDay(range.from));
        p.set('tot', isoDay(range.to - 1));
      } else {
        p.delete('van');
        p.delete('tot');
      }
    });

  const header = (
    <PageHeader
      title="Statistieken"
      description="Hoe bezoekers je website vinden en wat ze er doen. Klik op een regel om alles daarop te filteren."
      actions={
        <div className="flex items-center gap-2">
          <LiveBadge />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="grid h-10 w-10 place-items-center border border-paper-3 bg-white text-stone-dark hover:border-ink hover:text-ink"
            aria-label="Vernieuwen"
            title="Vernieuwen"
          >
            <RefreshCw className={`h-4 w-4 ${report.loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      }
    />
  );

  if (!data && report.error)
    return (
      <>
        {header}
        <ErrorBox message={report.error} onRetry={() => setTick((t) => t + 1)} />
      </>
    );
  if (!data) return <Loading />;
  if (!data.hasData)
    return (
      <>
        {header}
        <EmptyState />
      </>
    );

  const tile = TILES.find((t) => t.id === metric)!;
  const activeFilters = (Object.entries(filters) as [FilterKey, string][]).filter(([, v]) => v);
  const periodLabel = PERIODS.find((p) => p.id === period)!.label.toLowerCase();

  return (
    <>
      {header}

      {/* Period and filters scope everything below. */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-paper-3 bg-paper/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 lg:top-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="no-scrollbar flex max-w-full overflow-x-auto border border-paper-3 bg-white" role="group" aria-label="Periode">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`shrink-0 px-3 py-2 text-sm transition-colors ${period === p.id ? 'bg-ink text-paper' : 'text-stone-dark hover:bg-paper-2 hover:text-ink'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" aria-label="Van" value={van ?? isoDay(range.from)} max={tot ?? isoDay(Date.now())} onChange={(e) => e.target.value && update((p) => p.set('van', e.target.value))} className="h-9 border border-paper-3 bg-white px-2" />
              <span className="text-stone-dark">t/m</span>
              <input type="date" aria-label="Tot en met" value={tot ?? isoDay(range.to - 1)} min={van ?? undefined} max={isoDay(Date.now())} onChange={(e) => e.target.value && update((p) => p.set('tot', e.target.value))} className="h-9 border border-paper-3 bg-white px-2" />
            </div>
          )}
          {activeFilters.map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1.5 border border-ink bg-white py-1 pl-3 pr-1 text-sm">
              <span className="text-stone-dark">{FILTER_LABELS[key]}:</span>
              <span className="max-w-56 truncate font-medium">{valueLabel(key, value, titles)}</span>
              <button type="button" onClick={() => removeFilter(key)} className="grid h-6 w-6 place-items-center text-stone-dark hover:bg-paper-2 hover:text-ink" aria-label={`Filter ${FILTER_LABELS[key]} weghalen`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {activeFilters.length > 1 && (
            <button type="button" onClick={() => update((p) => FILTER_KEYS.forEach((k) => p.delete(k)))} className="text-sm text-stone-dark underline underline-offset-2 hover:text-ink">
              Alle filters weghalen
            </button>
          )}
        </div>
        {report.error && <p className="mt-2 text-sm text-danger">{report.error}</p>}
      </div>

      <div className={`space-y-6 transition-opacity ${report.loading ? 'opacity-60' : ''}`} aria-busy={report.loading}>
        {data.insights.length > 0 && <Insights insights={data.insights} onFilter={setFilter} />}

        {data.pageDetail && <PageDetailPanel detail={data.pageDetail} titles={titles} onClose={() => removeFilter('page')} onFilter={setFilter} />}

        <Card>
          <div className="grid grid-cols-2 border-b border-paper-3 md:grid-cols-3 xl:grid-cols-6">
            {TILES.map((t) => {
              const selected = t.id === metric;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMetric(t.id)}
                  aria-pressed={selected}
                  title={t.hint}
                  className={`relative -mb-px -mr-px flex flex-col items-start justify-start border-b border-r border-paper-3 p-4 text-left transition-colors md:p-5 ${selected ? 'bg-white' : 'bg-paper/50 hover:bg-white'}`}
                >
                  {selected && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-ink" />}
                  <span className="block text-sm text-stone-dark">{t.label}</span>
                  <span className="mt-1 block text-2xl font-semibold">{t.format(t.value(data.totals))}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Delta now={t.value(data.totals)} before={t.value(data.previous)} inverse={t.inverse} title={`Vorige periode: ${t.format(t.value(data.previous))}`} />
                    {t.sub && <span className="text-xs text-stone-dark">{t.sub(data.totals)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{tile.label}</h2>
                <p className="text-sm text-stone-dark">{tile.hint}</p>
              </div>
              <div className="flex items-center gap-4">
                <TrendLegend compare={compare} />
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-stone-dark">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-ink" />
                  Vergelijken
                </label>
                <button type="button" onClick={() => setTable((v) => !v)} aria-pressed={table} className={`inline-flex items-center gap-1.5 text-sm ${table ? 'text-ink' : 'text-stone-dark hover:text-ink'}`}>
                  <Table2 className="h-4 w-4" aria-hidden />
                  Tabel
                </button>
              </div>
            </div>
            {table ? (
              <SeriesTable report={data} metric={metric} format={tile.format} compare={compare} />
            ) : (
              <TrendChart points={data.series} metric={metric} bucket={data.range.bucket} format={tile.format} compare={compare} label={tile.label} partialEnd={data.range.to} />
            )}
          </div>
        </Card>

        <PagesCard report={data} onFilter={setFilter} />

        <div className="grid gap-6 xl:grid-cols-2">
          <SourcesCard report={data} onFilter={setFilter} />
          <ActionsCard report={data} onFilter={setFilter} />
        </div>

        <LoyaltyCard loyalty={data.loyalty} sessions={data.totals.sessions} onFilter={setFilter} />

        <div className="grid gap-6 xl:grid-cols-2">
          <FunnelsCard report={data} />
          <Card title="Wanneer komen bezoekers" description={`Bezoeken per dag en uur, ${periodLabel}.`}>
            <Heatmap data={data.heatmap} />
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DevicesCard report={data} onFilter={setFilter} />
          <LocationCard report={data} onFilter={setFilter} />
        </div>

        <ProblemsCard report={data} onFilter={setFilter} />

        <SessionsCard query={query} titles={titles} />

        <MeasuringCard onCleared={() => setTick((t) => t + 1)} />
      </div>
    </>
  );
}

// --- Layout pieces ---------------------------------------------------------------------------

function Card({ title, description, tabs, children, className = '' }: { title?: string; description?: ReactNode; tabs?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-paper-3 bg-white ${className}`}>
      {(title || tabs) && (
        <header className="border-b border-paper-3 px-4 pt-4 md:px-6 md:pt-5">
          {title && <h2 className="font-semibold">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-stone-dark">{description}</p>}
          <div className={tabs ? 'mt-3' : 'pb-4'}>{tabs}</div>
        </header>
      )}
      {title || tabs ? <div className="p-4 md:p-6">{children}</div> : children}
    </section>
  );
}

function LiveBadge() {
  const [live, setLive] = useState<Live>();
  useEffect(() => {
    let stopped = false;
    const load = () => api<Live>('/admin/analytics/live').then((l) => !stopped && setLive(l), () => {});
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  if (!live) return null;
  const on = live.visitors > 0;
  return (
    <details className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 border border-paper-3 bg-white px-3 text-sm hover:border-ink [&::-webkit-details-marker]:hidden">
        <span className="relative flex h-2.5 w-2.5">
          {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2f6b4f] opacity-60" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${on ? 'bg-[#2f6b4f]' : 'bg-stone'}`} />
        </span>
        <span className="tabular font-medium">{live.visitors}</span>
        <span className="text-stone-dark">{live.visitors === 1 ? 'bezoeker' : 'bezoekers'} nu</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 border border-paper-3 bg-white p-4 text-sm shadow-lg">
        <p className="font-medium">Actief in de laatste 5 minuten</p>
        {live.pages.length ? (
          <ul className="mt-2 space-y-1">
            {live.pages.map((p) => (
              <li key={p.path} className="flex justify-between gap-3">
                <span className="truncate text-stone-dark">{p.path}</span>
                <span className="tabular">{p.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-stone-dark">Er is nu niemand op de website.</p>
        )}
        <p className="mt-3 text-xs text-stone-dark">Wordt elke 30 seconden bijgewerkt.</p>
      </div>
    </details>
  );
}

function EmptyState() {
  return (
    <section className="border border-paper-3 bg-white p-6 md:p-10">
      <div className="max-w-2xl">
        <span className="grid h-12 w-12 place-items-center bg-accent-fill/20">
          <TrendingUp className="h-6 w-6 text-accent-strong" aria-hidden />
        </span>
        <h2 className="font-display mt-5 text-2xl">De metingen zijn gestart</h2>
        <p className="mt-3 leading-relaxed text-stone-dark">
          Zodra er bezoekers op de website komen, zie je hier hoeveel het er zijn, hoe ze je vinden, welke pagina’s ze lezen, hoe lang ze blijven en
          wat ze doen: bellen, een afspraak aanvragen of iets bestellen.
        </p>
        <ul className="mt-6 space-y-3 text-[15px]">
          <li className="flex gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" aria-hidden />
            <span>
              <strong className="font-medium">Je eigen bezoeken tellen niet mee</strong> zolang je in het beheer bent ingelogd. Wil je het testen? Open de
              website in een privévenster of op je telefoon.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" aria-hidden />
            <span>Zonder cookies en zonder IP-adressen op te slaan, dus je hebt geen cookiebanner nodig.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

// --- Insights ----------------------------------------------------------------------------------

const TONE: Record<Insight['tone'], { icon: LucideIcon; className: string }> = {
  warn: { icon: TriangleAlert, className: 'text-danger' },
  good: { icon: TrendingUp, className: 'text-[#2f6b4f]' },
  info: { icon: Lightbulb, className: 'text-accent-strong' },
};

function Insights({ insights, onFilter }: { insights: Insight[]; onFilter: (key: FilterKey, value: string) => void }) {
  // On a phone the first three are enough to start with; the numbers shouldn't disappear below the fold.
  const [more, setMore] = useState(false);
  return (
    <section aria-labelledby="insights-title">
      <h2 id="insights-title" className="eyebrow mb-3 text-stone-dark">
        Wat valt op
      </h2>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight, i) => {
          const { icon: Icon, className } = TONE[insight.tone];
          return (
            <li key={insight.title} className={`gap-3 border border-paper-3 bg-white p-4 ${i >= 3 && !more ? 'hidden md:flex' : 'flex'}`}>
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${className}`} aria-hidden />
              <div className="min-w-0">
                <p className="font-medium leading-snug">{insight.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-dark">{insight.text}</p>
                {insight.filter && (
                  <button type="button" onClick={() => onFilter(insight.filter!.key, insight.filter!.value)} className="mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline">
                    Bekijken
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {insights.length > 3 && !more && (
        <button type="button" onClick={() => setMore(true)} className="mt-3 text-sm font-medium underline underline-offset-2 md:hidden">
          Nog {insights.length - 3} tonen
        </button>
      )}
    </section>
  );
}

// --- Chart as a table --------------------------------------------------------------------------

function SeriesTable({ report, metric, format, compare }: { report: Report; metric: SeriesMetric; format: (n: number) => string; compare: boolean }) {
  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-xs text-stone-dark">
          <tr className="border-b border-paper-3">
            <th className="py-2 font-medium">{report.range.bucket === 'hour' ? 'Uur' : report.range.bucket === 'week' ? 'Week' : 'Dag'}</th>
            <th className="py-2 text-right font-medium">Deze periode</th>
            {compare && <th className="py-2 text-right font-medium">Vorige periode</th>}
          </tr>
        </thead>
        <tbody className="tabular">
          {[...report.series].reverse().map((p) => (
            <tr key={p.start} className="border-b border-paper-2">
              <td className="py-1.5">{bucketLabel(p.start, report.range.bucket, true)}</td>
              <td className="py-1.5 text-right font-medium">{format(p[metric])}</td>
              {compare && <td className="py-1.5 text-right text-stone-dark">{p.prev ? format(p.prev[metric]) : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Pages --------------------------------------------------------------------------------------

function PageLabel({ path, title }: { path: string; title?: string | null }) {
  const name = pageName(path, title);
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate">{name}</span>
      {name !== path && <span className="hidden truncate text-xs text-stone-dark sm:inline">{path}</span>}
    </span>
  );
}

function PagesCard({ report, onFilter }: { report: Report; onFilter: (key: FilterKey, value: string) => void }) {
  const [tab, setTab] = useState<'top' | 'entry' | 'exit'>('top');
  const titles = new Map(report.pages.map((p) => [p.path, p.title]));
  const pageColumns: Column<PageRow>[] = [
    { header: 'Weergaven', render: (p) => fmtNumber(p.views) },
    { header: 'Bezoekers', render: (p) => fmtNumber(p.visitors), className: 'hidden sm:block' },
    { header: 'Gem. tijd', render: (p) => (p.avgTime ? fmtDuration(p.avgTime) : '—'), className: 'hidden md:block w-20' },
    { header: 'Gescrold', render: (p) => (p.scroll === null ? '—' : `${Math.round(p.scroll)}%`), className: 'hidden md:block' },
    { header: 'Uitstap', render: (p) => fmtPercent(p.exitRate), className: 'hidden lg:block' },
  ];
  const dimColumns = (kind: 'entry' | 'exit'): Column<DimRow>[] => [
    { header: 'Bezoeken', render: (r) => fmtNumber(r.sessions) },
    kind === 'entry'
      ? { header: 'Bounce', render: (r) => fmtPercent(r.bounceRate), className: 'hidden sm:block' }
      : { header: 'Gem. duur', render: (r) => fmtDuration(r.avgDuration), className: 'hidden sm:block w-20' },
    { header: 'Conversie', render: (r) => fmtPercent(r.sessions ? r.conversions / r.sessions : 0, 1), className: 'hidden md:block' },
  ];
  const descriptions = {
    top: 'Klik op een pagina voor details: waar bezoekers vandaan kwamen, hoe ver ze lazen en waar ze daarna heen gingen.',
    entry: 'De eerste pagina van een bezoek. Een hoge bounce betekent dat mensen hier binnenkomen en meteen weer weggaan.',
    exit: 'De laatste pagina voordat bezoekers de website verlieten.',
  };
  return (
    <Card
      title="Pagina’s"
      description={descriptions[tab]}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'top', label: 'Meest bekeken' },
            { id: 'entry', label: 'Binnenkomst' },
            { id: 'exit', label: 'Vertrek' },
          ]}
        />
      }
    >
      {tab === 'top' && (
        <BarList rows={report.pages} value={(p) => p.views} header="Pagina" label={(p) => <PageLabel path={p.path} title={p.title} />} columns={pageColumns} onSelect={(p) => onFilter('page', p.path)} selectLabel={(p) => `Details van ${p.path}`} limit={10} />
      )}
      {tab !== 'top' && (
        <BarList
          rows={tab === 'entry' ? report.entryPages : report.exitPages}
          value={(r) => r.sessions}
          header="Pagina"
          label={(r) => <PageLabel path={r.key} title={titles.get(r.key)} />}
          columns={dimColumns(tab)}
          onSelect={(r) => onFilter(tab, r.key)}
          limit={10}
        />
      )}
    </Card>
  );
}

function PageDetailPanel({ detail, titles, onClose, onFilter }: { detail: PageDetail; titles: Map<string, string | null>; onClose: () => void; onFilter: (key: FilterKey, value: string) => void }) {
  const total = detail.scrollBands.reduce((a, b) => a + b, 0);
  const figures = [
    { label: 'Weergaven', value: fmtNumber(detail.views) },
    { label: 'Bezoekers', value: fmtNumber(detail.visitors) },
    { label: 'Gem. tijd op pagina', value: detail.avgTime ? fmtDuration(detail.avgTime) : '—' },
    { label: 'Gem. gescrold', value: detail.scroll === null ? '—' : `${Math.round(detail.scroll)}%` },
    { label: 'Verlaat hier de site', value: fmtPercent(detail.exitRate) },
  ];
  return (
    <section className="border border-ink bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-paper-3 px-4 py-4 md:px-6">
        <div className="min-w-0">
          <p className="eyebrow text-stone-dark">Pagina in detail</p>
          <h2 className="font-display mt-1 truncate text-2xl">{pageName(detail.path, detail.title)}</h2>
          <a href={detail.path} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-stone-dark hover:text-ink">
            {detail.path}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center text-stone-dark hover:bg-paper-2 hover:text-ink" aria-label="Paginadetails sluiten">
          <X className="h-5 w-5" />
        </button>
      </header>
      <dl className="grid grid-cols-2 border-b border-paper-3 sm:grid-cols-3 lg:grid-cols-5">
        {figures.map((f) => (
          <div key={f.label} className="-mb-px -mr-px border-b border-r border-paper-3 px-4 py-3 md:px-6">
            <dt className="text-xs text-stone-dark">{f.label}</dt>
            <dd className="mt-0.5 text-xl font-semibold">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-8 p-4 md:p-6 lg:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold">Kwamen van</h3>
          <BarList
            rows={detail.previous}
            value={(r) => r.count}
            header="Vorige stap"
            label={(r) => (r.kind === 'channel' ? <span>Binnengekomen via {CHANNEL_LABELS[r.key as Channel] ?? r.key}</span> : <span>{pageName(r.key, titles.get(r.key))}</span>)}
            columns={[{ header: 'Aantal', render: (r) => fmtNumber(r.count) }]}
            onSelect={(r) => (r.kind === 'channel' ? onFilter('channel', r.key) : onFilter('page', r.key))}
            limit={6}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Gingen daarna naar</h3>
          <BarList
            rows={detail.next}
            value={(r) => r.count}
            header="Volgende stap"
            label={(r) => (r.kind === 'exit' ? <span className="text-stone-dark">Website verlaten</span> : <span>{pageName(r.key, titles.get(r.key))}</span>)}
            columns={[{ header: 'Aantal', render: (r) => fmtNumber(r.count) }]}
            onSelect={(r) => r.kind === 'page' && onFilter('page', r.key)}
            limit={6}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Hoe ver bezoekers lazen</h3>
          {total ? (
            <ul className="mt-3 space-y-2.5">
              {['Minder dan een kwart', 'Tot de helft', 'Tot driekwart', 'Tot (bijna) het einde'].map((label, i) => (
                <li key={label}>
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="tabular text-stone-dark">{fmtPercent(detail.scrollBands[i] / total)}</span>
                  </div>
                  <div className="mt-1 h-2 bg-paper-2">
                    <div className="h-full rounded-r-[4px] bg-accent-fill" style={{ width: `${(detail.scrollBands[i] / total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-dark">Nog niet gemeten.</p>
          )}
          {detail.events.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold">Acties op deze pagina</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {detail.events.map((e) => (
                  <li key={e.name} className="flex justify-between gap-3">
                    <span>{eventLabel(e.name)}</span>
                    <span className="tabular">{fmtNumber(e.count)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Sources, devices, location ------------------------------------------------------------

const visitColumns: Column<DimRow>[] = [
  { header: 'Bezoeken', render: (r) => fmtNumber(r.sessions) },
  { header: 'Bounce', render: (r) => fmtPercent(r.bounceRate), className: 'hidden sm:block' },
  { header: 'Conversie', render: (r) => fmtPercent(r.sessions ? r.conversions / r.sessions : 0, 1) },
];

function SourcesCard({ report, onFilter }: { report: Report; onFilter: (key: FilterKey, value: string) => void }) {
  const [tab, setTab] = useState<'channel' | 'referrer' | 'campaign'>('channel');
  return (
    <Card
      title="Hoe bezoekers je vinden"
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'channel', label: 'Kanalen' },
            { id: 'referrer', label: 'Websites' },
            { id: 'campaign', label: 'Campagnes' },
          ]}
        />
      }
    >
      {tab === 'channel' && (
        <BarList
          rows={report.channels}
          value={(r) => r.sessions}
          header="Kanaal"
          label={(r) => CHANNEL_LABELS[r.key as Channel] ?? r.key}
          selectLabel={(r) => CHANNEL_HINTS[r.key as Channel] ?? ''}
          columns={visitColumns}
          onSelect={(r) => onFilter('channel', r.key)}
        />
      )}
      {tab === 'referrer' && (
        <BarList rows={report.referrers} value={(r) => r.sessions} header="Website of bron" label={(r) => r.key} columns={visitColumns} onSelect={(r) => onFilter('referrer', r.key)} empty="Nog geen bezoekers via andere websites in deze periode." />
      )}
      {tab === 'campaign' && (
        <BarList
          rows={report.campaigns}
          value={(r) => r.sessions}
          header="Campagne"
          label={(r) => r.key}
          columns={visitColumns}
          onSelect={(r) => onFilter('campaign', r.key)}
          empty="Nog geen campagnes. Voeg ?utm_campaign=naam toe aan een link in je posts of advertenties, dan zie je hier wat die oplevert."
        />
      )}
    </Card>
  );
}

const DEVICE_ICONS: Record<Device, LucideIcon> = { mobile: Smartphone, tablet: Tablet, desktop: Monitor };

function DevicesCard({ report, onFilter }: { report: Report; onFilter: (key: FilterKey, value: string) => void }) {
  const [tab, setTab] = useState<'device' | 'browser' | 'os'>('device');
  const rows = tab === 'device' ? report.devices : tab === 'browser' ? report.browsers : report.os;
  const total = report.totals.sessions || 1;
  return (
    <Card
      title="Apparaten"
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'device', label: 'Soort' },
            { id: 'browser', label: 'Browser' },
            { id: 'os', label: 'Systeem' },
          ]}
        />
      }
    >
      <BarList
        rows={rows}
        value={(r) => r.sessions}
        header={tab === 'device' ? 'Apparaat' : tab === 'browser' ? 'Browser' : 'Besturingssysteem'}
        label={(r) => {
          if (tab !== 'device') return r.key;
          const Icon = DEVICE_ICONS[r.key as Device] ?? Monitor;
          return (
            <span className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 text-stone-dark" aria-hidden />
              {DEVICE_LABELS[r.key as Device] ?? r.key}
            </span>
          );
        }}
        columns={[{ header: 'Aandeel', render: (r) => fmtPercent(r.sessions / total) }, ...visitColumns]}
        onSelect={(r) => onFilter(tab, r.key)}
      />
    </Card>
  );
}

function LocationCard({ report, onFilter }: { report: Report; onFilter: (key: FilterKey, value: string) => void }) {
  const [tab, setTab] = useState<'country' | 'language'>('country');
  const total = report.totals.sessions || 1;
  return (
    <Card
      title="Waar bezoekers vandaan komen"
      description={tab === 'country' ? 'Geschat op basis van de tijdzone van het apparaat; we bekijken geen IP-adressen.' : 'De taal waarin de browser van de bezoeker is ingesteld.'}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'country', label: 'Land' },
            { id: 'language', label: 'Taal' },
          ]}
        />
      }
    >
      <BarList
        rows={tab === 'country' ? report.countries : report.languages}
        value={(r) => r.sessions}
        header={tab === 'country' ? 'Land' : 'Taal'}
        label={(r) => (tab === 'country' ? countryName(r.key) : languageName(r.key))}
        columns={[{ header: 'Aandeel', render: (r) => fmtPercent(r.sessions / total) }, ...visitColumns]}
        onSelect={(r) => onFilter(tab, r.key)}
      />
    </Card>
  );
}

// --- Actions & funnels -------------------------------------------------------------------------

const EVENT_ICONS: Record<EventName, LucideIcon> = {
  booking: CalendarCheck,
  purchase: CreditCard,
  checkout: Package,
  add_to_cart: ShoppingCart,
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  outbound: ExternalLink,
  not_found: FileQuestion,
  js_error: Bug,
};

function ActionsCard({ report, onFilter }: { report: Report; onFilter: (key: FilterKey, value: string) => void }) {
  const [open, setOpen] = useState<EventName | null>(null);
  const events = report.events.filter((e) => e.name !== 'not_found' && e.name !== 'js_error');
  const contact = events.filter((e) => e.name === 'call' || e.name === 'whatsapp' || e.name === 'email').reduce((n, e) => n + e.count, 0);
  const figures = [
    { label: 'Afspraakaanvragen', value: fmtNumber(report.totals.bookings) },
    { label: 'Betaalde bestellingen', value: fmtNumber(report.totals.orders), sub: report.totals.revenue ? `${fmtMoney(report.totals.revenue)} omzet` : undefined },
    { label: 'Contact via telefoon, WhatsApp of e-mail', value: fmtNumber(contact) },
  ];
  return (
    <Card title="Wat bezoekers doen" description="Acties die ertoe doen. Klik op een actie om te zien wie die bezoekers zijn.">
      <dl className="grid grid-cols-3 gap-3">
        {figures.map((f) => (
          <div key={f.label} className="bg-paper/70 p-3">
            <dd className="text-2xl font-semibold">{f.value}</dd>
            <dt className="mt-0.5 text-xs leading-snug text-stone-dark">{f.label}</dt>
            {f.sub && <dd className="mt-1 text-xs font-medium">{f.sub}</dd>}
          </div>
        ))}
      </dl>
      {events.length ? (
        <ul className="mt-5 divide-y divide-paper-2">
          {events.map((e) => {
            const Icon = EVENT_ICONS[e.name];
            const expanded = open === e.name;
            return (
              <li key={e.name} className="py-2">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-stone-dark" aria-hidden />
                  <button type="button" onClick={() => onFilter('event', e.name)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline" title={EVENT_INFO[e.name].description}>
                    {eventLabel(e.name)}
                  </button>
                  <span className="tabular text-sm font-semibold">{fmtNumber(e.count)}</span>
                  <span className="tabular hidden w-28 text-right text-xs text-stone-dark sm:block">{fmtPercent(report.totals.sessions ? e.sessions / report.totals.sessions : 0, 1)} van bezoeken</span>
                  {e.top.length > 0 ? (
                    <button type="button" onClick={() => setOpen(expanded ? null : e.name)} aria-expanded={expanded} className="w-16 text-right text-xs text-stone-dark underline underline-offset-2 hover:text-ink">
                      {expanded ? 'Sluiten' : 'Details'}
                    </button>
                  ) : (
                    <span className="w-16" />
                  )}
                </div>
                {expanded && (
                  <ul className="mb-1 ml-7 mt-2 space-y-1 border-l border-paper-3 pl-3 text-sm">
                    {e.top.map((t) => (
                      <li key={t.label} className="flex justify-between gap-3">
                        <span className="truncate text-stone-dark">{eventDetail(e.name, t.label)}</span>
                        <span className="tabular">{fmtNumber(t.count)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-stone-dark">Nog geen acties in deze periode.</p>
      )}
    </Card>
  );
}

function FunnelsCard({ report }: { report: Report }) {
  const [tab, setTab] = useState(report.funnels[0]?.id ?? 'booking');
  const funnel = report.funnels.find((f) => f.id === tab) ?? report.funnels[0];
  if (!funnel) return null;
  return (
    <Card
      title="Trechters"
      description="Hoeveel bezoekers elke stap halen, en waar ze afhaken."
      tabs={report.funnels.length > 1 ? <Tabs value={tab} onChange={setTab} tabs={report.funnels.map((f) => ({ id: f.id, label: f.title }))} /> : undefined}
    >
      <FunnelChart steps={funnel.steps} />
    </Card>
  );
}

// --- Returning visitors -------------------------------------------------------------------------

function Bands({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  if (!total) return <p className="mt-3 text-sm text-stone-dark">Nog geen klanten in deze periode.</p>;
  return (
    <ul className="mt-3 space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <span className="tabular text-stone-dark">
              <strong className="font-semibold text-ink">{fmtNumber(r.count)}</strong> · {fmtPercent(r.count / total)}
            </span>
          </div>
          <div className="mt-1 h-2 bg-paper-2">
            <div className="h-full rounded-r-[4px] bg-accent-fill" style={{ width: `${(r.count / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function LoyaltyCard({ loyalty, sessions, onFilter }: { loyalty: Loyalty; sessions: number; onFilter: (key: FilterKey, value: string) => void }) {
  if (!loyalty.recognized)
    return (
      <Card title="Nieuwe en terugkerende bezoekers" description="Nog geen herkende bezoekers in deze periode.">
        <p className="max-w-2xl text-sm leading-relaxed text-stone-dark">
          Bezoekers met de statistiekcookie herkennen we ook bij een volgend bezoek. Zodra die er zijn, zie je hier hoeveel mensen terugkomen, na hoeveel
          bezoeken ze boeken of bestellen, en via welk kanaal klanten je de eerste keer vonden.
        </p>
      </Card>
    );
  const figures = [
    { label: 'Komt terug', value: fmtPercent(loyalty.returningRate), sub: `${fmtNumber(loyalty.returningSessions)} van ${fmtNumber(loyalty.recognized)} herkende bezoeken` },
    { label: 'Conversie nieuw → terugkerend', value: `${fmtPercent(loyalty.conversionNew, 1)} → ${fmtPercent(loyalty.conversionReturning, 1)}`, sub: 'Afspraak of bestelling per bezoek' },
    {
      label: 'Klant bij bezoek',
      value: loyalty.avgVisitsToConvert === null ? '—' : loyalty.avgVisitsToConvert.toFixed(1).replace('.', ','),
      sub: loyalty.customers ? `Gemiddeld, over ${fmtNumber(loyalty.customers)} klanten` : 'Nog geen klanten',
    },
    {
      label: 'Dagen tot klant',
      value: loyalty.avgDaysToConvert === null ? '—' : loyalty.avgDaysToConvert.toFixed(1).replace('.', ','),
      sub: 'Gemiddeld, vanaf het eerste bezoek',
    },
  ];
  const kinds: (DimRow & { label: string })[] = [
    { key: 'new', label: 'Nieuw', sessions: loyalty.newSessions, conversions: Math.round(loyalty.conversionNew * loyalty.newSessions), visitors: 0, bounceRate: 0, avgDuration: 0 },
    { key: 'returning', label: 'Terugkerend', sessions: loyalty.returningSessions, conversions: Math.round(loyalty.conversionReturning * loyalty.returningSessions), visitors: 0, bounceRate: 0, avgDuration: 0 },
    { key: 'unknown', label: 'Niet herkend', sessions: Math.max(0, sessions - loyalty.recognized), conversions: 0, visitors: 0, bounceRate: 0, avgDuration: 0 },
  ];
  const maxCredit = Math.max(1, ...loyalty.attribution.map((a) => Math.max(a.first, a.last)));
  return (
    <Card
      title="Nieuwe en terugkerende bezoekers"
      description={`Gebaseerd op ${fmtPercent(loyalty.coverage)} van de bezoeken: bezoekers die we met de statistiekcookie herkennen.`}
    >
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="bg-paper/70 p-3">
            <dt className="text-xs text-stone-dark">{f.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{f.value}</dd>
            <dd className="mt-0.5 text-xs text-stone-dark">{f.sub}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold">Nieuw of terugkerend</h3>
          <div className="mt-3">
            <BarList
              rows={kinds}
              value={(r) => r.sessions}
              header="Bezoeker"
              label={(r) => r.label}
              columns={[
                { header: 'Bezoeken', render: (r) => fmtNumber(r.sessions) },
                { header: 'Conversie', render: (r) => (r.key === 'unknown' ? '—' : fmtPercent(r.sessions ? r.conversions / r.sessions : 0, 1)) },
              ]}
              onSelect={(r) => onFilter('returning', r.key)}
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Bij welk bezoek klanten boeken of bestellen</h3>
          <Bands rows={loyalty.visitsToConvert} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Tijd tussen eerste bezoek en boeking</h3>
          <Bands rows={loyalty.daysToConvert} />
        </div>
      </div>
      <div className="mt-8">
        <h3 className="text-sm font-semibold">Wat klanten de eerste keer binnenbracht</h3>
        <p className="mt-0.5 max-w-3xl text-sm text-stone-dark">
          Veel mensen ontdekken je via Instagram of Google en boeken later, vaak door je adres in te typen. Hier krijgt het kanaal van het eerste bezoek de eer,
          naast het kanaal van het bezoek waarin geboekt werd. Klik op een kanaal om die klanten te bekijken.
        </p>
        {loyalty.attribution.length ? (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-stone-dark">
              <tr className="border-b border-paper-3">
                <th className="py-2 font-medium">Kanaal</th>
                <th className="w-2/5 py-2 font-medium">
                  <span className="mr-4 inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-3 bg-accent-fill" />
                    Eerste bezoek
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-3 bg-stone" />
                    Bezoek met boeking
                  </span>
                </th>
                <th className="py-2 text-right font-medium">Eerste</th>
                <th className="py-2 text-right font-medium">Bij boeking</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">Verschil</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {loyalty.attribution.map((a) => (
                <tr key={a.key} className="cursor-pointer border-b border-paper-2 hover:bg-paper/60" onClick={() => onFilter('firstChannel', a.key)}>
                  <td className="py-2 pr-3">
                    <button type="button" className="text-left hover:underline" onClick={() => onFilter('firstChannel', a.key)}>
                      {CHANNEL_LABELS[a.key] ?? a.key}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="space-y-[2px]">
                      <div className="h-2 rounded-r-[3px] bg-accent-fill" style={{ width: `${(a.first / maxCredit) * 100}%` }} />
                      <div className="h-2 rounded-r-[3px] bg-stone" style={{ width: `${(a.last / maxCredit) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-right font-semibold">{fmtNumber(a.first)}</td>
                  <td className="py-2 text-right">{fmtNumber(a.last)}</td>
                  <td className={`hidden py-2 text-right sm:table-cell ${a.first > a.last ? 'text-[#24533d]' : a.first < a.last ? 'text-stone-dark' : 'text-stone'}`}>
                    {a.first === a.last ? '±0' : `${a.first > a.last ? '+' : '−'}${Math.abs(a.first - a.last)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-stone-dark">Nog geen klanten met de statistiekcookie in deze periode.</p>
        )}
      </div>
    </Card>
  );
}

// --- Problems ------------------------------------------------------------------------------------

function ProblemsCard({ report, onFilter }: { report: Report; onFilter: (key: FilterKey, value: string) => void }) {
  const { notFound, errors, slowPages } = report.issues;
  const none = <p className="mt-2 text-sm text-stone-dark">Niets gevonden in deze periode.</p>;
  return (
    <Card title="Problemen" description="Dingen die bezoekers tegenhouden. Los deze eerst op.">
      <div className="grid gap-8 lg:grid-cols-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileQuestion className="h-4 w-4 text-stone-dark" aria-hidden />
            Pagina niet gevonden
          </h3>
          {notFound.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {notFound.map((n) => (
                <li key={n.path} className="flex justify-between gap-3">
                  <button type="button" className="truncate text-left hover:underline" onClick={() => onFilter('page', n.path)}>
                    {n.path}
                  </button>
                  <span className="tabular">{fmtNumber(n.count)}×</span>
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Bug className="h-4 w-4 text-stone-dark" aria-hidden />
            Foutmeldingen
          </h3>
          {errors.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {errors.map((e) => (
                <li key={e.message}>
                  <div className="flex justify-between gap-3">
                    <span className="break-words font-mono text-xs">{e.message}</span>
                    <span className="tabular shrink-0">{fmtNumber(e.count)}×</span>
                  </div>
                  <span className="text-xs text-stone-dark">o.a. op {e.path}</span>
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-stone-dark" aria-hidden />
            Laadtijd per pagina
          </h3>
          {slowPages.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {slowPages.map((p) => (
                <li key={p.path} className="flex justify-between gap-3">
                  <span className="truncate">{p.path}</span>
                  <span className={`tabular ${p.loadMs >= 3000 ? 'font-semibold text-danger' : ''}`}>{fmtSeconds(p.loadMs)}</span>
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
          <p className="mt-3 text-xs text-stone-dark">Gemeten bij het openen van de website. Onder 2,5 s is goed.</p>
        </div>
      </div>
    </Card>
  );
}

// --- Visits -------------------------------------------------------------------------------------

function SourceText({ s }: { s: Pick<SessionSummary, 'channel' | 'referrer'> }) {
  return (
    <>
      {CHANNEL_LABELS[s.channel] ?? s.channel}
      {s.referrer && <span className="text-stone-dark"> · {s.referrer}</span>}
    </>
  );
}

function SessionsCard({ query, titles }: { query: string; titles: Map<string, string | null> }) {
  const [items, setItems] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef(0);
  const { search } = useLocation();

  async function load(offset: number) {
    const id = ++request.current;
    setLoading(true);
    setError(undefined);
    try {
      const page = await api<{ total: number; sessions: SessionSummary[] }>(`/admin/analytics/sessions?${query}&offset=${offset}`);
      if (id !== request.current) return;
      setTotal(page.total);
      setItems((current) => (offset === 0 ? page.sessions : [...current, ...page.sessions]));
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : 'Laden is niet gelukt.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <Card title="Bezoeken" description={`Elk bezoek apart, nieuwste eerst${total ? ` (${fmtNumber(total)})` : ''}. Klik op een bezoek om stap voor stap te zien wat iemand deed.`}>
      {error && <ErrorBox message={error} onRetry={() => load(0)} />}
      {!items.length && !loading && !error && <p className="text-sm text-stone-dark">Geen bezoeken in deze periode.</p>}
      <ul className="-mx-4 divide-y divide-paper-2 md:-mx-6">
        {items.map((s) => {
          const Icon = DEVICE_ICONS[s.device] ?? Monitor;
          const shown = s.paths.slice(0, 4);
          return (
            <li key={s.id}>
              <Link to={`/admin/statistieken/bezoek/${s.id}`} state={{ back: search }} className="grid gap-2 px-4 py-3 text-sm hover:bg-paper/60 md:grid-cols-[9rem_11rem_1fr_auto] md:items-center md:gap-4 md:px-6">
                <span className="tabular text-stone-dark">{fmtDateTime(s.startedAt)}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-stone-dark" aria-label={DEVICE_LABELS[s.device]} />
                  <span className="truncate">
                    <SourceText s={s} />
                  </span>
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {shown.map((path, i) => (
                    <span key={i} className="inline-flex min-w-0 items-center gap-1">
                      {i > 0 && <span className="text-stone">→</span>}
                      <span className="max-w-44 truncate bg-paper-2 px-1.5 py-0.5 text-xs">{pageName(path, titles.get(path))}</span>
                    </span>
                  ))}
                  {s.paths.length > shown.length && <span className="text-xs text-stone-dark">+{s.paths.length - shown.length}</span>}
                </span>
                <span className="flex items-center gap-2 md:justify-end">
                  {s.visitNo !== null && s.visitNo > 1 && (
                    <span className="whitespace-nowrap bg-paper-2 px-1.5 py-0.5 text-xs" title="Herkend aan de statistiekcookie">
                      {ordinal(s.visitNo)} bezoek
                    </span>
                  )}
                  {s.goals.map((g) => {
                    const GoalIcon = EVENT_ICONS[g];
                    return (
                      <span key={g} title={eventLabel(g)} className="inline-flex items-center gap-1 bg-[#e6f0ea] px-1.5 py-0.5 text-xs font-medium text-[#24533d]">
                        <GoalIcon className="h-3 w-3" aria-hidden />
                        {g === 'booking' ? 'Afspraak' : 'Besteld'}
                      </span>
                    );
                  })}
                  <span className="tabular whitespace-nowrap text-stone-dark">{fmtDuration(s.duration)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length < total && (
        <Button type="button" variant="outline-dark" className="mt-4 h-10 text-sm" onClick={() => load(items.length)} disabled={loading}>
          {loading ? 'Laden…' : 'Meer bezoeken laden'}
        </Button>
      )}
    </Card>
  );
}

function MeasuringCard({ onCleared }: { onCleared: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string>();
  async function clear() {
    if (!confirmAction('Alle statistieken definitief wissen? Dit kan niet ongedaan worden gemaakt.')) return;
    setError(undefined);
    try {
      await api('/admin/analytics', { method: 'DELETE' });
      toast('Statistieken gewist');
      onCleared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wissen is niet gelukt.');
    }
  }
  return (
    <Card title="Zo meten we">
      <div className="grid gap-6 text-sm leading-relaxed text-stone-dark md:grid-cols-2">
        <ul className="space-y-2">
          <li>Elk bezoek wordt geteld, ook zonder cookies: dan herkennen we een bezoeker één dag aan een anonieme code die elke nacht wordt vervangen.</li>
          <li>
            Met de statistiekcookie herkennen we iemand ook op een andere dag. Bezoekers uit Nederland krijgen die standaard (dat mag zonder toestemming,
            omdat de gegevens alleen bij ons blijven); anderen alleen als ze cookies accepteren. Iedereen kan hem uitzetten via Cookie-instellingen.
          </li>
          <li>IP-adressen worden niet bewaard en niets wordt gedeeld, ook niet met Meta.</li>
        </ul>
        <ul className="space-y-2">
          <li>Je eigen bezoeken tellen niet mee zolang je in het beheer bent ingelogd.</li>
          <li>Robots en zoekmachines worden zoveel mogelijk weggefilterd.</li>
          <li>Gegevens ouder dan 25 maanden worden automatisch verwijderd.</li>
        </ul>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-paper-3 pt-4">
        <button type="button" onClick={clear} className="text-sm text-stone-dark underline underline-offset-2 hover:text-danger">
          Alle statistieken wissen
        </button>
        <span className="text-xs text-stone-dark">Handig nadat je de website zelf hebt getest, vlak voor de lancering.</span>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </Card>
  );
}

// --- One visit ------------------------------------------------------------------------------------

export function SessionPage() {
  const { id } = useParams();
  const { state } = useLocation() as { state?: { back?: string } };
  const [detail, setDetail] = useState<SessionDetail>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api<SessionDetail>(`/admin/analytics/sessions/${encodeURIComponent(id ?? '')}`).then(setDetail, (err) => setError(err instanceof Error ? err.message : 'Laden is niet gelukt.'));
  }, [id]);
  const back = { to: `/admin/statistieken${state?.back ?? ''}`, label: 'Terug naar statistieken' };

  if (error)
    return (
      <>
        <PageHeader title="Bezoek" back={back} />
        <ErrorBox message={error} />
      </>
    );
  if (!detail) return <Loading />;

  const Icon = DEVICE_ICONS[detail.device] ?? Monitor;
  const facts = [
    { label: 'Bron', value: <SourceText s={detail} /> },
    { label: 'Campagne', value: detail.campaign ?? '—' },
    {
      label: 'Apparaat',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-stone-dark" aria-hidden />
          {DEVICE_LABELS[detail.device]} · {detail.browser} · {detail.os}
        </span>
      ),
    },
    { label: 'Land en taal', value: `${countryName(detail.country)} · ${languageName(detail.language)}` },
    { label: 'Duur', value: fmtDuration(detail.duration) },
    { label: 'Pagina’s', value: fmtNumber(detail.pageviews) },
  ];
  if (detail.visitNo !== null)
    facts.push({
      label: 'Bezoeker',
      value:
        detail.visitNo > 1 && detail.firstSeenAt !== null
          ? `${ordinal(detail.visitNo)} bezoek · eerste keer ${daysAgo(detail.firstSeenAt, detail.startedAt).replace('vandaag', 'dezelfde dag')} via ${CHANNEL_LABELS[detail.firstChannel ?? detail.channel]}${detail.firstReferrer ? ` (${detail.firstReferrer})` : ''}`
          : 'Eerste bezoek',
    });

  return (
    <>
      <PageHeader title={`Bezoek van ${fmtDateTime(detail.startedAt)}`} description="Stap voor stap wat deze bezoeker deed. Bezoekers zijn anoniem: je ziet nooit wie het was." back={back} />
      <dl className="grid grid-cols-2 border-l border-t border-paper-3 bg-white md:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="border-b border-r border-paper-3 px-4 py-3">
            <dt className="text-xs text-stone-dark">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 border border-paper-3 bg-white p-4 md:p-6">
        <h2 className="font-semibold">Verloop</h2>
        <ol className="mt-5">
          {detail.timeline.map((item, i) => {
            const offset = item.at - detail.startedAt;
            return (
              <li key={i} className="relative flex gap-4 pb-6">
                <span aria-hidden className="absolute bottom-0 left-[1.0625rem] top-9 w-px bg-paper-3" />
                <span className={`grid h-9 w-9 shrink-0 place-items-center ${item.type === 'page' ? 'bg-paper-2 text-ink' : 'bg-accent-fill/25 text-accent-strong'}`}>
                  {item.type === 'page' ? <span className="tabular text-xs font-semibold">{detail.timeline.slice(0, i + 1).filter((t) => t.type === 'page').length}</span> : (() => {
                    const EventIcon = EVENT_ICONS[item.name] ?? Lightbulb;
                    return <EventIcon className="h-4 w-4" aria-hidden />;
                  })()}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="tabular text-xs text-stone-dark">
                    {fmtTime(item.at)} · +{fmtDuration(offset)}
                  </p>
                  {item.type === 'page' ? (
                    <>
                      <p className="mt-0.5 font-medium">{pageName(item.path, item.title)}</p>
                      <p className="text-sm text-stone-dark">
                        {item.path}
                        {item.duration > 0 && ` · ${fmtDuration(item.duration)} bekeken`}
                        {item.scroll !== null && ` · ${item.scroll}% gescrold`}
                        {item.loadMs ? ` · geladen in ${fmtSeconds(item.loadMs)}` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-0.5 font-medium">{eventLabel(item.name)}</p>
                      {(item.label || item.value) && (
                        <p className="text-sm text-stone-dark">
                          {[
                            eventDetail(item.name, item.label),
                            item.value && (item.name === 'purchase' || item.name === 'checkout') ? fmtMoney(item.value) : item.value && item.name === 'add_to_cart' ? `${item.value}×` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
          <li className="flex gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-dashed border-paper-3 text-stone-dark">
              <X className="h-4 w-4" aria-hidden />
            </span>
            <p className="pt-2 text-sm text-stone-dark">Website verlaten</p>
          </li>
        </ol>
      </section>

      {detail.history.length > 0 && (
        <section className="mt-8 border border-paper-3 bg-white p-4 md:p-6">
          <h2 className="font-semibold">Andere bezoeken van deze bezoeker</h2>
          <p className="mt-0.5 text-sm text-stone-dark">Herkend aan de statistiekcookie. Nieuwste eerst.</p>
          <ul className="-mx-4 mt-3 divide-y divide-paper-2 md:-mx-6">
            {detail.history.map((h) => (
              <li key={h.id}>
                <Link to={`/admin/statistieken/bezoek/${h.id}`} state={state} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-paper/60 md:px-6">
                  <span className="tabular w-36 text-stone-dark">{fmtDateTime(h.startedAt)}</span>
                  <span className="w-24">{h.visitNo !== null ? `${ordinal(h.visitNo)} bezoek` : ''}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <SourceText s={h} />
                  </span>
                  <span className="text-stone-dark">
                    {fmtNumber(h.pageviews)} {h.pageviews === 1 ? 'pagina' : 'pagina’s'} · {fmtDuration(h.duration)}
                  </span>
                  {h.goals.map((g) => (
                    <span key={g} className="bg-[#e6f0ea] px-1.5 py-0.5 text-xs font-medium text-[#24533d]">
                      {g === 'booking' ? 'Afspraak' : 'Besteld'}
                    </span>
                  ))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
