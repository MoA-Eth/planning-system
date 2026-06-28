import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { Search } from 'lucide-react';

const BUDGET_API = 'https://budget.moa.gov.et/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';

interface COAItem {
  id: number;
  code: string;
  name: string;
}

interface COATrend {
  fiscal_year: string;
  adjusted: number;
  actual: number;
  over_under: number;
  utilization_pct: number;
}

async function budgetFetch(path: string) {
  const response = await fetch(`${BUDGET_API}${path}`, {
    headers: {
      'Authorization': `Token ${BUDGET_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

function fmt(v: number | undefined | null) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtShort(v: number | undefined | null) {
  const n = Math.abs(Number(v || 0));
  if (n >= 1_000_000) return `${(Number(v) / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(Number(v) / 1_000).toFixed(0)}K`;
  return Number(v || 0).toFixed(0);
}

function pctColor(pct: number) {
  if (pct > 100) return 'text-red-600 font-bold';
  if (pct >= 85) return 'text-amber-600 font-semibold';
  return 'text-green-700';
}

function pctBg(pct: number) {
  if (pct > 100) return 'bg-red-500';
  if (pct >= 85) return 'bg-amber-400';
  return 'bg-green-500';
}

function ProgressBar({ pct }: { pct: number }) {
  const w = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${pctBg(pct)}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`text-xs w-12 text-right tabular-nums ${pctColor(pct)}`}>{pct}%</span>
    </div>
  );
}

export default function BudgetCOA() {
  const [coaList, setCoaList] = useState<COAItem[]>([]);
  const [allFiscalYears, setAllFiscalYears] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCoa, setSelectedCoa] = useState<COAItem | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [trends, setTrends] = useState<COATrend[]>([]);
  const [coaLoading, setCoaLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(() => {
    setCoaLoading(true);
    setError(null);
    budgetFetch('/chart-of-accounts/')
      .then((data) => setCoaList(data.results ?? data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load COA list'))
      .finally(() => setCoaLoading(false));
    budgetFetch('/dashboard/')
      .then((data) => setAllFiscalYears(data.fiscal_years ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (!selectedCoa) return;
    setLoading(true);
    setTrends([]);
    setSelectedYear('');
    budgetFetch(`/chart-of-accounts/${selectedCoa.id}/analytics/`)
      .then((data) => setTrends(data.trends ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [selectedCoa]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return coaList.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [coaList, search]);

  const fiscalYears = allFiscalYears.length > 0
    ? allFiscalYears
    : [...new Set(trends.map((t) => t.fiscal_year))];

  const tableRows = useMemo(
    () => (!selectedYear ? trends : trends.filter((t) => t.fiscal_year === selectedYear)),
    [trends, selectedYear]
  );

  const chartData = trends.map((t) => ({
    year: t.fiscal_year,
    'Adjusted Budget': t.adjusted,
    'Actual Expenditure': t.actual,
  }));

  function selectCoa(coa: COAItem) {
    setSelectedCoa(coa);
    setSearch(`${coa.code} — ${coa.name}`);
    setDropdownOpen(false);
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={loadInitial}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">COA Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a Chart of Account to view its budget and expenditure breakdown by fiscal year.
        </p>
      </div>

      {/* Selector card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Select Chart of Account</h2>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Searchable dropdown */}
          <div className="relative w-full sm:max-w-md">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); setSelectedCoa(null); setTrends([]); }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={coaLoading ? 'Loading…' : 'Search by code or name…'}
                disabled={coaLoading}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {dropdownOpen && filtered.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCoa(c)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <span className="font-mono text-indigo-700 font-semibold">{c.code}</span>
                      <span className="text-gray-600 ml-2">— {c.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {dropdownOpen && search && !coaLoading && filtered.length === 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
                No matching COA found.
              </div>
            )}
          </div>

          {/* Fiscal year filter — only shown after COA selected */}
          {selectedCoa && fiscalYears.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm text-gray-500 whitespace-nowrap">Fiscal Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Years</option>
                {fiscalYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>

        {selectedCoa && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
              {selectedCoa.code}
            </span>
            <span className="text-gray-700 font-medium">{selectedCoa.name}</span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
          <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading analytics…
        </div>
      )}

      {/* Empty state */}
      {!selectedCoa && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300 gap-3">
          <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">Search and select a COA to view its analytics</p>
        </div>
      )}

      {/* Results */}
      {selectedCoa && !loading && (
        <>
          {/* Summary table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {selectedCoa.code} — {selectedCoa.name}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedYear ? `Fiscal Year: ${selectedYear}` : 'All Fiscal Years'}
                </p>
              </div>
              {tableRows.length > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                  <span>
                    Total Adjusted:{' '}
                    <span className="font-semibold text-gray-800">
                      ETB {fmt(tableRows.reduce((s, r) => s + r.adjusted, 0))}
                    </span>
                  </span>
                  <span>
                    Total Actual:{' '}
                    <span className="font-semibold text-gray-800">
                      ETB {fmt(tableRows.reduce((s, r) => s + r.actual, 0))}
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Fiscal Year</th>
                    <th className="px-4 py-2.5 text-right">Adjusted Budget</th>
                    <th className="px-4 py-2.5 text-right">Actual Expenditure</th>
                    <th className="px-4 py-2.5 text-right">Over / Under</th>
                    <th className="px-4 py-2.5 text-left min-w-[180px]">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                        No budget report data found for this COA{selectedYear ? ` in ${selectedYear}` : ''}.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => {
                      const isNeg = row.over_under < 0;
                      return (
                        <tr key={row.fiscal_year} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{row.fiscal_year}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                            {fmt(row.adjusted)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                            {fmt(row.actual)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${isNeg ? 'text-red-500' : 'text-green-700'}`}>
                            {isNeg ? `(${fmt(Math.abs(row.over_under))})` : fmt(row.over_under)}
                          </td>
                          <td className="px-4 py-3 pr-6">
                            <ProgressBar pct={row.utilization_pct} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Yearly trend chart */}
          {trends.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Yearly Expenditure Trend</h2>
              <p className="text-xs text-gray-400 mb-4">
                Adjusted Budget vs. Actual Expenditure across all fiscal years
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} width={64} />
                  <Tooltip formatter={(v: any) => `ETB ${fmt(v)}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Adjusted Budget" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual Expenditure" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
