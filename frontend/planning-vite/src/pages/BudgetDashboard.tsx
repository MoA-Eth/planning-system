import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const BUDGET_API = 'https://budget.moa.gov.et/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';
const CHART_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16'];
const LEVEL_STYLE = [
  'bg-[#1a3a5c] text-white',
  'bg-blue-700 text-white',
  'bg-indigo-50 text-indigo-900',
  'bg-gray-50 text-gray-800',
  'bg-slate-50 text-slate-500',
];

interface COAItem {
  id: number;
  code: string;
  name: string;
  adjusted_budget: number;
  actual_expenditure: number;
  balance: number;
}

interface DashboardData {
  fiscal_years: string[];
  kpi: {
    total_adjusted: number;
    total_actual: number;
    balance: number;
    over_budget_count: number;
    utilization_pct: number;
  };
  smo_rows: Array<{
    id: number;
    name: string;
    adjusted: number;
    actual: number;
    over_under: number;
    pct: number;
  }>;
  program_rows: Array<{
    id: number;
    code: string;
    name: string;
    smo_id: number;
    adjusted: number;
    actual: number;
    over_under: number;
    pct: number;
  }>;
  activity_rows?: Array<{
    id: number;
    code: string;
    name: string;
    program_id: number;
    adjusted: number;
    actual: number;
    over_under: number;
    pct: number;
  }>;
  top_over_budget?: Array<any>;
}

function KpiCard({ title, value, sub, cls, icon }: any) {
  return (
    <div className={`rounded-xl border p-5 ${cls}`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium opacity-70 leading-tight">{title}</p>
        <span className="text-2xl ml-2" role="img" aria-hidden="true">{icon}</span>
      </div>
      <p className="text-2xl font-bold mt-2 leading-none">{value}</p>
      {sub && <p className="text-xs mt-2 opacity-60">{sub}</p>}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const w = Math.min(Math.max(pct, 0), 100);
  const bgColor = pct > 100 ? 'bg-red-500' : pct >= 85 ? 'bg-amber-400' : 'bg-green-500';
  const textColor = pct > 100 ? 'text-red-600 font-bold' : pct >= 85 ? 'text-amber-600 font-semibold' : 'text-green-700';
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${bgColor}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`text-xs w-10 text-right tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}

function DrillRow({ row, isExpanded, onToggle }: any) {
  const { level, label, adjusted, actual, over_under, pct, hasChildren, isPlaceholder } = row;
  const style = LEVEL_STYLE[Math.min(level, LEVEL_STYLE.length - 1)];
  const indent = level * 20;

  if (isPlaceholder) {
    return (
      <tr className={`border-b border-gray-100 ${style}`}>
        <td className="px-3 py-2" style={{ paddingLeft: indent + 28 }} colSpan={5}>
          <span className="text-xs italic opacity-40">{label}</span>
        </td>
      </tr>
    );
  }
  const fontCls = level === 0 ? 'font-bold text-sm' : level <= 1 ? 'font-semibold text-sm' : 'text-sm';
  const isNeg = over_under < 0;
  
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  return (
    <tr
      className={`border-b border-gray-100 ${style} ${hasChildren ? 'cursor-pointer hover:brightness-95' : ''}`}
      onClick={() => hasChildren && onToggle(row.key)}
    >
      <td className="px-3 py-2.5" style={{ paddingLeft: indent + 12 }}>
        <div className="flex items-center gap-1.5">
          <span className="w-4 text-center text-xs select-none opacity-70">
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </span>
          <span className={fontCls}>{label}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right text-xs font-mono whitespace-nowrap">{fmt(adjusted)}</td>
      <td className="px-3 py-2.5 text-right text-xs font-mono whitespace-nowrap">{fmt(actual)}</td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${
          isNeg ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {isNeg ? `(${fmt(Math.abs(over_under))})` : fmt(over_under)}
        </span>
      </td>
      <td className="px-3 py-2.5"><ProgressBar pct={pct} /></td>
    </tr>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-5 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BudgetDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [expanded, setExpanded] = useState(new Set(['ministry']));
  const [coaCache, setCoaCache] = useState<Record<number, COAItem[]>>({});
  const fetchedActIds = useRef<Set<number>>(new Set());

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedYear 
        ? `${BUDGET_API}/dashboard/?fiscal_year=${selectedYear}`
        : `${BUDGET_API}/dashboard/`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${BUDGET_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
      if (!selectedYear && result.fiscal_years?.length > 0) {
        setSelectedYear(result.fiscal_years[result.fiscal_years.length - 1]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    const toFetch: number[] = [];
    for (const key of expanded) {
      if (key.startsWith('act-')) {
        const actId = parseInt(key.replace('act-', ''), 10);
        if (!fetchedActIds.current.has(actId)) {
          toFetch.push(actId);
          fetchedActIds.current.add(actId);
        }
      }
    }
    if (toFetch.length === 0) return;
    Promise.all(
      toFetch.map(async (actId) => {
        try {
          const res = await fetch(`${BUDGET_API}/chart-of-accounts/?activity_id=${actId}`, {
            headers: { 'Authorization': `Token ${BUDGET_TOKEN}`, 'Content-Type': 'application/json' }
          });
          const items = res.ok ? await res.json() : [];
          return { actId, items: Array.isArray(items) ? items : [] };
        } catch {
          return { actId, items: [] };
        }
      })
    ).then((results) => {
      setCoaCache((prev) => {
        const next = { ...prev };
        for (const { actId, items } of results) next[actId] = items;
        return next;
      });
    });
  }, [expanded]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const fmt = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const fmtShort = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const drillRows = useMemo(() => {
    if (!data) return [];
    const rows: any[] = [];
    const { kpi, smo_rows, program_rows, activity_rows = [] } = data;

    rows.push({
      key: 'ministry', level: 0,
      label: 'Ministry of Agriculture — Total',
      adjusted: kpi.total_adjusted, actual: kpi.total_actual,
      over_under: kpi.balance,
      pct: kpi.total_adjusted ? Math.round(kpi.total_actual / kpi.total_adjusted * 1000) / 10 : 0,
      hasChildren: smo_rows.length > 0,
    });

    if (!expanded.has('ministry')) return rows;

    for (const smo of smo_rows) {
      const smoKey = `smo-${smo.id}`;
      const smo_progs = program_rows.filter((p) => p.smo_id === smo.id);
      rows.push({ key: smoKey, level: 1, label: smo.name, ...smo, hasChildren: smo_progs.length > 0 });

      if (!expanded.has(smoKey)) continue;

      for (const prog of smo_progs) {
        const progKey = `prog-${prog.id}`;
        const acts = activity_rows.filter((a) => a.program_id === prog.id);
        rows.push({
          key: progKey, level: 2,
          label: `${prog.code} — ${prog.name}`,
          ...prog, hasChildren: acts.length > 0,
        });

        if (!expanded.has(progKey)) continue;
        for (const act of acts) {
          const actKey = `act-${act.id}`;
          const actCoa = coaCache[act.id];
          rows.push({
            key: actKey, level: 3,
            label: `${act.code} — ${act.name}`,
            ...act, hasChildren: true,
          });
          if (!expanded.has(actKey)) continue;
          if (actCoa === undefined) {
            rows.push({ key: `coa-loading-${act.id}`, level: 4, label: 'Loading COA data…', adjusted: 0, actual: 0, over_under: 0, pct: 0, hasChildren: false, isPlaceholder: true });
          } else if (actCoa.length === 0) {
            rows.push({ key: `coa-empty-${act.id}`, level: 4, label: 'No COA items linked to this activity', adjusted: 0, actual: 0, over_under: 0, pct: 0, hasChildren: false, isPlaceholder: true });
          } else {
            for (const coa of actCoa) {
              const coaPct = coa.adjusted_budget > 0 ? Math.round(coa.actual_expenditure / coa.adjusted_budget * 1000) / 10 : 0;
              rows.push({
                key: `coa-${coa.id}`, level: 4,
                label: `${coa.code} — ${coa.name}`,
                adjusted: coa.adjusted_budget,
                actual: coa.actual_expenditure,
                over_under: coa.balance,
                pct: coaPct,
                hasChildren: false,
              });
            }
          }
        }
      }
    }

    return rows;
  }, [data, expanded, coaCache]);

  const { pieData, barSmoData } = useMemo(() => {
    const smo_rows = data?.smo_rows || [];
    return {
      pieData: smo_rows.map((s) => ({ name: s.name, value: s.adjusted })),
      barSmoData: smo_rows.map((s) => ({
        name: s.name.length > 18 ? s.name.slice(0, 18) + '…' : s.name,
        Adjusted: s.adjusted,
        Actual: s.actual,
      })),
    };
  }, [data]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const kpi = data.kpi || {};
  const topOver = data.top_over_budget || [];
  const utilPct = kpi.utilization_pct ?? 0;
  const utilCls = utilPct > 100
    ? 'bg-red-50 text-red-900 border border-red-200'
    : utilPct >= 85
    ? 'bg-amber-50 text-amber-900 border border-amber-200'
    : 'bg-emerald-50 text-emerald-900 border border-emerald-200';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Ministry of Agriculture — Budget Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <label htmlFor="fiscal-year" className="text-sm font-medium text-gray-600 whitespace-nowrap">
            Fiscal Year:
          </label>
          <select
            id="fiscal-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {data.fiscal_years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon="📊" title="Total Adjusted Budget"
          value={`ETB ${fmtShort(kpi.total_adjusted || 0)}`}
          sub="Across all state minister offices"
          cls="bg-indigo-50 text-indigo-900 border border-indigo-200" />
        <KpiCard icon="💸" title="Total Actual Expenditure"
          value={`ETB ${fmtShort(kpi.total_actual || 0)}`}
          sub="Spent to date"
          cls="bg-blue-50 text-blue-900 border border-blue-200" />
        <KpiCard icon="🏦" title="Remaining Balance"
          value={`ETB ${fmtShort(kpi.balance || 0)}`}
          sub="Adjusted minus actual"
          cls="bg-green-50 text-green-900 border border-green-200" />
        <KpiCard icon="📈" title="Budget Utilization"
          value={`${utilPct}%`}
          sub={utilPct > 100 ? 'Over budget!' : utilPct >= 85 ? 'Near limit' : 'On track'}
          cls={utilCls} />
        <KpiCard icon="⚠️" title="Over-Budget Items"
          value={kpi.over_budget_count ?? 0}
          sub="Programs / projects exceeding allocation"
          cls={kpi.over_budget_count > 0
            ? 'bg-red-50 text-red-900 border border-red-200'
            : 'bg-gray-50 text-gray-700 border border-gray-200'} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Budget Drill-Down</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click any row to expand the hierarchy</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-500 inline-block" /> On track</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-400 inline-block" /> &gt;85%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500 inline-block" /> Over budget</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">Entity</th>
                <th className="px-3 py-2.5 text-right">Adjusted Budget</th>
                <th className="px-3 py-2.5 text-right">Actual Expenditure</th>
                <th className="px-3 py-2.5 text-right">Over / Under</th>
                <th className="px-3 py-2.5 text-left">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {drillRows.map((row) => (
                <DrillRow key={row.key} row={row} isExpanded={expanded.has(row.key)} onToggle={toggle} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Budget Share by Office</h2>
        <p className="text-xs text-gray-400 mb-3">Proportional distribution of adjusted budget</p>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="45%"
                outerRadius={140} dataKey="value" nameKey="name"
                label={({ name, percent }) => `${(name ?? '').split(' ')[0]}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine
              >
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => [`ETB ${fmt(v)}`, 'Adjusted']} />
              <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <div className="h-64 flex items-center justify-center text-gray-400">No data</div>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Budget vs. Expenditure by Office</h2>
        <p className="text-xs text-gray-400 mb-3">Adjusted budget alongside actual expenditure per State Minister Office</p>
        {barSmoData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barSmoData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={60} />
              <Tooltip formatter={(v: any) => `ETB ${fmt(v)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Adjusted" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Actual" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-64 flex items-center justify-center text-gray-400">No data</div>}
      </div>
    </div>
  );
}
