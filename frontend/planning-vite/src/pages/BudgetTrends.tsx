import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const BUDGET_API = 'https://budget.moa.gov.et/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';

const COLORS = {
  adjusted: '#6366f1',
  actual: '#10b981',
  approved: '#8b5cf6',
  balance: '#f59e0b',
  treasury: '#3b82f6',
  assistant: '#10b981',
  loan: '#f59e0b',
  internal_revenue: '#ef4444',
  recurrent: '#6366f1',
  capital: '#f97316',
  all: '#0bdef5',
};
const PROGRAM_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

interface YearlyTotal {
  fiscal_year: string;
  approved?: number;
  adjusted: number;
  actual: number;
  balance?: number;
  utilization_pct: number;
  over_budget_count: number;
}

interface YearTrendsData {
  fiscal_years: string[];
  yearly_totals: YearlyTotal[];
  fund_source_data?: Array<{ fiscal_year: string; treasury?: number; assistant?: number; loan?: number; all?: number; internal_revenue?: number }>;
  budget_type_data?: Array<{ fiscal_year: string; recurrent?: number; capital?: number }>;
  yoy_growth?: Array<{ fiscal_year: string; budget_growth: number; expenditure_growth: number }>;
  program_trends?: Array<Record<string, number | string>>;
  top_program_names?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number | undefined | null) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtShort(v: number | undefined | null) {
  const n = Math.abs(Number(v || 0));
  if (n >= 1_000_000_000) return `${(Number(v) / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(Number(v) / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(Number(v) / 1_000).toFixed(0)}K`;
  return Number(v || 0).toFixed(0);
}

function round(num: number, decimals: number) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ title, value, change, changeLabel, positive }: { title: string; value: string | number; change?: number | null; changeLabel?: string; positive?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {change !== undefined && change !== null && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{Math.abs(change)}% {changeLabel}</span>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-0.5">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading" role="status">
      <Skeleton className="h-8 w-80" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-5 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400">
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm">Not enough data for trend analysis. Import reports for multiple fiscal years.</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900">ETB {fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BudgetTrends() {
  const [data, setData] = useState<YearTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BUDGET_API}/year-trends/`, {
        headers: {
          'Authorization': `Token ${BUDGET_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const summary = useMemo(() => {
    if (!data?.yearly_totals?.length) return null;
    const latest = data.yearly_totals[data.yearly_totals.length - 1];
    const prev = data.yearly_totals.length > 1 ? data.yearly_totals[data.yearly_totals.length - 2] : null;
    const budgetGrowth = prev?.adjusted ? round((latest.adjusted - prev.adjusted) / prev.adjusted * 100, 1) : null;
    const expGrowth = prev?.actual ? round((latest.actual - prev.actual) / prev.actual * 100, 1) : null;
    return { latest, budgetGrowth, expGrowth };
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={fetchTrends} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
        Retry
      </button>
    </div>
  );

  const hasData = (data?.fiscal_years?.length ?? 0) >= 1;
  const hasMultiYear = (data?.fiscal_years?.length ?? 0) >= 2;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Year Trend Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Multi-year budget performance overview across {data?.fiscal_years?.length || 0} fiscal year(s)
        </p>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={`Latest Budget (${summary.latest.fiscal_year})`}
                value={`ETB ${fmtShort(summary.latest.adjusted)}`}
                change={summary.budgetGrowth}
                changeLabel="vs prev year"
                positive={(summary.budgetGrowth ?? 0) >= 0}
              />
              <StatCard
                title={`Latest Expenditure (${summary.latest.fiscal_year})`}
                value={`ETB ${fmtShort(summary.latest.actual)}`}
                change={summary.expGrowth}
                changeLabel="vs prev year"
                positive={(summary.expGrowth ?? 0) >= 0}
              />
              <StatCard
                title="Latest Utilization"
                value={`${summary.latest.utilization_pct}%`}
              />
              <StatCard
                title="Over-Budget Items"
                value={summary.latest.over_budget_count}
              />
            </div>
          )}

          {/* Chart 1: Budget vs Expenditure Trend */}
          <ChartCard
            title="Budget vs Expenditure Trend"
            subtitle="Total adjusted budget and actual expenditure across fiscal years"
          >
            {hasMultiYear ? (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={data!.yearly_totals} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAdjusted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.adjusted} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.adjusted} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.actual} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.actual} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fiscal_year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="adjusted" name="Adjusted Budget" stroke={COLORS.adjusted} fill="url(#gradAdjusted)" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Area type="monotone" dataKey="actual" name="Actual Expenditure" stroke={COLORS.actual} fill="url(#gradActual)" strokeWidth={2.5} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={data!.yearly_totals} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fiscal_year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="adjusted" name="Adjusted Budget" fill={COLORS.adjusted} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual Expenditure" fill={COLORS.actual} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 2: Utilization Rate Trend */}
          <ChartCard
            title="Budget Utilization Rate Trend"
            subtitle="Percentage of adjusted budget spent each fiscal year"
          >
            {hasMultiYear ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data!.yearly_totals} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fiscal_year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} width={50} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Utilization']} />
                  <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '100% Limit', position: 'right', fontSize: 10, fill: '#ef4444' }} />
                  <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '85% Warning', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                  <Line type="monotone" dataKey="utilization_pct" name="Utilization %" stroke={COLORS.actual} strokeWidth={2.5} dot={{ r: 5, fill: COLORS.actual }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-900">{data!.yearly_totals[0]?.utilization_pct}%</p>
                  <p className="text-sm text-gray-500 mt-2">Utilization for {data!.yearly_totals[0]?.fiscal_year}</p>
                </div>
              </div>
            )}
          </ChartCard>

          {/* Charts 3 & 4: Fund Source + Budget Type */}
          {(data?.fund_source_data?.length || data?.budget_type_data?.length) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data?.fund_source_data?.length ? (
                <ChartCard title="Budget by Fund Source" subtitle="How the ministry budget is funded each year">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.fund_source_data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="fiscal_year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={60} />
                      <Tooltip formatter={(v: any, name: string) => [`ETB ${fmt(v)}`, name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(val) => val.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} />
                      <Bar dataKey="treasury" name="treasury" stackId="a" fill={COLORS.treasury} />
                      <Bar dataKey="assistant" name="assistant" stackId="a" fill={COLORS.assistant} />
                      <Bar dataKey="loan" name="loan" stackId="a" fill={COLORS.loan} />
                      <Bar dataKey="all" name="all" stackId="a" fill={COLORS.all} />
                      <Bar dataKey="internal_revenue" name="internal_revenue" stackId="a" fill={COLORS.internal_revenue} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              ) : null}

              {data?.budget_type_data?.length ? (
                <ChartCard title="Recurrent vs Capital Budget" subtitle="Budget allocation by type over years">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.budget_type_data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="fiscal_year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={60} />
                      <Tooltip formatter={(v: any, name: string) => [`ETB ${fmt(v)}`, name.replace(/\b\w/g, (c) => c.toUpperCase())]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(val) => val.replace(/\b\w/g, (c: string) => c.toUpperCase())} />
                      <Bar dataKey="recurrent" name="recurrent" fill={COLORS.recurrent} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="capital" name="capital" fill={COLORS.capital} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              ) : null}
            </div>
          ) : null}

          {/* Chart 5: Year-over-Year Growth */}
          {(data?.yoy_growth?.length ?? 0) > 0 && (
            <ChartCard
              title="Year-over-Year Growth"
              subtitle="Percentage change in budget and expenditure from one year to the next"
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data!.yoy_growth} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fiscal_year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" width={50} />
                  <Tooltip formatter={(v: any) => [`${v}%`]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#6b7280" />
                  <Bar dataKey="budget_growth" name="Budget Growth" fill={COLORS.adjusted} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenditure_growth" name="Expenditure Growth" fill={COLORS.actual} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Chart 6: Top Programs Trend */}
          {(data?.program_trends?.length ?? 0) > 0 && (data?.top_program_names?.length ?? 0) > 0 && (
            <ChartCard
              title="Top Programs — Budget Trend"
              subtitle="Budget allocation for the top 5 programs across fiscal years"
            >
              {hasMultiYear ? (
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={data!.program_trends} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fiscal_year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={65} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data!.top_program_names!.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        name={name.length > 30 ? name.slice(0, 30) + '…' : name}
                        stroke={PROGRAM_COLORS[i % PROGRAM_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data!.top_program_names!.map((name, i) => ({
                      name: name.length > 25 ? name.slice(0, 25) + '…' : name,
                      value: (data!.program_trends![0] as any)?.[name] || 0,
                      fill: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
                    }))}
                    layout="vertical"
                    margin={{ top: 10, right: 40, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmtShort} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
                    <Tooltip formatter={(v: any) => [`ETB ${fmt(v)}`]} />
                    <Bar dataKey="value" name="Adjusted Budget" radius={[0, 4, 4, 0]}>
                      {data!.top_program_names!.map((_, i) => (
                        <Cell key={i} fill={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          )}

          {/* Summary Table */}
          <ChartCard title="Yearly Summary Table" subtitle="Complete fiscal year comparison at a glance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Fiscal Year</th>
                    <th className="px-4 py-3 text-right">Adjusted Budget</th>
                    <th className="px-4 py-3 text-right">Actual Expenditure</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Utilization</th>
                    {/* <th className="px-4 py-3 text-right">Over-Budget</th> */}
                  </tr>
                </thead>
                <tbody>
                  {data!.yearly_totals.map((row) => (
                    <tr key={row.fiscal_year} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{row.fiscal_year}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmt(row.adjusted)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmt(row.actual)}</td>
                      <td className={`px-4 py-3 text-right font-mono text-xs ${(row.balance ?? 0) < 0 ? 'text-red-600 font-semibold' : 'text-green-700'}`}>
                        {(row.balance ?? 0) < 0 ? `(${fmt(Math.abs(row.balance ?? 0))})` : fmt(row.balance ?? (row.adjusted - row.actual))}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold text-xs ${row.utilization_pct > 100 ? 'text-red-600' : row.utilization_pct >= 85 ? 'text-amber-600' : 'text-green-700'}`}>
                        {row.utilization_pct}%
                      </td>
                      {/* <td className="px-4 py-3 text-right">
                        {row.over_budget_count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {row.over_budget_count}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}