import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import YearFilter from '../components/YearFilter';
import { getCurrentEthiopianDate, toGregorianYearFromEthiopian } from '../lib/ethiopian';

// ─── Constants ────────────────────────────────────────────────────────────────
const BUDGET_API = 'https://budget.moa.gov.et/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';

// ─── Types ────────────────────────────────────────────────────────────────────
type YearDataPoint = {
  year: string;          // EC year label e.g. "2017"
  performance: number;   // ministry_performance %
  utilization: number;   // kpi.utilization_pct %
  hasPerformance: boolean;
  hasUtilization: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPct = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return `${Number(val).toFixed(1)}%`;
};

const getColor = (pct: number) => {
  if (pct >= 95) return '#047857';
  if (pct >= 85) return '#22c55e';
  if (pct >= 65) return '#eab308';
  if (pct >= 50) return '#f97316';
  return '#ef4444';
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-xl px-5 py-4 min-w-[200px]">
      <p className="text-sm font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">
        {label} E.C.
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-1.5">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: p.fill }}
            />
            <span className="text-xs text-gray-600">{p.name}</span>
          </div>
          <span className="text-xs font-bold" style={{ color: p.fill }}>
            {p.value != null ? `${Number(p.value).toFixed(1)}%` : 'N/A'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Summary Card ─────────────────────────────────────────────────────────
function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium opacity-75 leading-tight">{label}</p>
        <div className="opacity-80">{icon}</div>
      </div>
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs mt-2 opacity-60">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DetailAnalysis() {
  const ethDate = getCurrentEthiopianDate();
  const currentYear =
    Array.isArray(ethDate) && typeof ethDate[0] === 'number'
      ? ethDate[0]
      : new Date().getFullYear() - 7;

  const [year, setYear] = useState<number>(currentYear);
  const [chartData, setChartData] = useState<YearDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const years = [year - 3, year - 2, year - 1, year];

      try {
        // Fire all 8 calls in parallel (4 years × 2 APIs)
        const results = await Promise.all(
          years.map(async (y) => {
            const [perfRes, budgetRes] = await Promise.all([
              // Performance API
              api
                .get('/api/indicator-performance/', {
                  params: { year: toGregorianYearFromEthiopian(y) },
                })
                .catch(() => null),

              // Budget API
              fetch(`${BUDGET_API}/dashboard/?fiscal_year=${y}`, {
                headers: {
                  Authorization: `Token ${BUDGET_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              })
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
            ]);

            const performance = perfRes?.data?.ministry_performance ?? null;
            const utilization = budgetRes?.kpi?.utilization_pct ?? null;

            return {
              year: String(y),
              performance: performance !== null ? Math.round(performance * 10) / 10 : 0,
              utilization: utilization !== null ? Math.round(utilization * 10) / 10 : 0,
              hasPerformance: performance !== null,
              hasUtilization: utilization !== null,
            } as YearDataPoint;
          })
        );

        setChartData(results);
      } catch (err: any) {
        setError('Failed to load analysis data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [year]);

  // Compute summary for the most recent year with data
  const latestWithPerf = [...chartData].reverse().find((d) => d.hasPerformance);
  const latestWithUtil = [...chartData].reverse().find((d) => d.hasUtilization);

  const avgPerf =
    chartData.filter((d) => d.hasPerformance).length > 0
      ? chartData
          .filter((d) => d.hasPerformance)
          .reduce((sum, d) => sum + d.performance, 0) /
        chartData.filter((d) => d.hasPerformance).length
      : null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Detail Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Budget utilization vs. ministry performance — 4-year comparison
          </p>
        </div>
        <div className="flex items-center gap-3">
          <YearFilter value={year} onChange={setYear} variant="compact" className="w-40" />
          {!loading && (
            <button
              onClick={() => setYear(year)} // re-trigger
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      {!loading && chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Latest Ministry Performance"
            value={latestWithPerf ? formatPct(latestWithPerf.performance) : 'N/A'}
            sub={latestWithPerf ? `Year ${latestWithPerf.year} E.C.` : 'No data available'}
            color={
              latestWithPerf
                ? latestWithPerf.performance >= 85
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : latestWithPerf.performance >= 65
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
            }
          />
          <SummaryCard
            icon={<Wallet className="w-5 h-5" />}
            label="Latest Budget Utilization"
            value={latestWithUtil ? formatPct(latestWithUtil.utilization) : 'N/A'}
            sub={latestWithUtil ? `Year ${latestWithUtil.year} E.C.` : 'No data available'}
            color={
              latestWithUtil
                ? latestWithUtil.utilization > 100
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : latestWithUtil.utilization >= 85
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
            }
          />
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="4-Year Avg Performance"
            value={avgPerf !== null ? formatPct(avgPerf) : 'N/A'}
            sub={`Years ${year - 3}–${year} E.C.`}
            color={
              avgPerf !== null
                ? avgPerf >= 85
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : avgPerf >= 65
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
            }
          />
        </div>
      )}

      {/* ── Chart ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-800">
            Budget Utilization vs Ministry Performance
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Side-by-side comparison across {year - 3}–{year} E.C. &nbsp;·&nbsp; Missing years shown as 0
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading data for {year - 3}–{year} E.C…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              onClick={() => setYear(year)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Chart */}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              barCategoryGap="30%"
              barGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 13, fill: '#374151', fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(v) => `${v} E.C.`}
              />
              <YAxis
                domain={[0, 110]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Legend
                wrapperStyle={{ fontSize: 13, paddingTop: 16 }}
                iconType="circle"
                iconSize={10}
              />
              {/* 100% reference line */}
              <ReferenceLine
                y={100}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: '100%',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: '#ef4444',
                }}
              />
              <Bar
                dataKey="utilization"
                name="Budget Utilization"
                fill="#6366f1"
                radius={[6, 6, 0, 0]}
                maxBarSize={60}
              />
              <Bar
                dataKey="performance"
                name="Ministry Performance"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend note */}
        {!loading && !error && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] inline-block" />
              Budget Utilization from{' '}
              <code className="bg-gray-100 px-1 rounded text-gray-500">budget.moa.gov.et/api</code>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block" />
              Ministry Performance from{' '}
              <code className="bg-gray-100 px-1 rounded text-gray-500">/api/indicator-performance/</code>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block"
                style={{
                  width: 18,
                  height: 2,
                  background: 'repeating-linear-gradient(90deg,#ef4444 0,#ef4444 4px,transparent 4px,transparent 8px)',
                }}
              />
              100% threshold
            </span>
          </div>
        )}
      </div>

      {/* ── Year-by-year breakdown table ── */}
      {!loading && !error && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Year-by-Year Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">Exact values per Ethiopian calendar year</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Year (E.C.)</th>
                  <th className="px-5 py-3 text-right">Budget Utilization</th>
                  <th className="px-5 py-3 text-right">Ministry Performance</th>
                  <th className="px-5 py-3 text-right">Gap</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, idx) => {
                  const gap = row.hasUtilization && row.hasPerformance
                    ? row.utilization - row.performance
                    : null;
                  return (
                    <tr key={row.year} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">
                        {row.year}
                        {Number(row.year) === year && (
                          <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                            Selected
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {row.hasUtilization ? (
                          <span
                            className="font-semibold"
                            style={{ color: row.utilization > 100 ? '#ef4444' : '#6366f1' }}
                          >
                            {formatPct(row.utilization)}
                            {row.utilization > 100 && (
                              <span className="ml-1 text-xs text-red-400">(Over)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic">No data</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {row.hasPerformance ? (
                          <span
                            className="font-semibold"
                            style={{ color: getColor(row.performance) }}
                          >
                            {formatPct(row.performance)}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic">No data</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {gap !== null ? (
                          <span
                            className={`font-semibold ${gap > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}
                          >
                            {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
