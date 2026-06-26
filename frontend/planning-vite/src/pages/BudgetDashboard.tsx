import { useEffect, useState } from 'react';

const BUDGET_API = 'https://budget.moa.gov.et/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';

interface DashboardData {
  fiscal_years: string[];
  selected_year: string;
  summary: {
    total_approved: number;
    total_adjusted: number;
    total_actual: number;
    utilization_pct: number;
  };
  by_fund_source: Array<{
    fund_source: string;
    approved: number;
    adjusted: number;
    actual: number;
  }>;
  by_budget_type: Array<{
    budget_type: string;
    approved: number;
    adjusted: number;
    actual: number;
  }>;
}

export default function BudgetDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    fetchDashboard();
  }, [selectedYear]);

  const fetchDashboard = async () => {
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
      if (!selectedYear && result.selected_year) {
        setSelectedYear(result.selected_year);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const fmtShort = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading budget data...</div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budget Dashboard</h1>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        >
          {data.fiscal_years.map((year) => (
            <option key={year} value={year}>
              FY {year}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Approved</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ETB {fmtShort(data.summary.total_approved)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Adjusted</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ETB {fmtShort(data.summary.total_adjusted)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Actual</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ETB {fmtShort(data.summary.total_actual)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Utilization</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {data.summary.utilization_pct}%
          </p>
        </div>
      </div>

      {/* By Fund Source */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">By Fund Source</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Fund Source</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Approved</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Adjusted</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actual</th>
              </tr>
            </thead>
            <tbody>
              {data.by_fund_source.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{item.fund_source}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.approved)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.adjusted)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Budget Type */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">By Budget Type</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Budget Type</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Approved</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Adjusted</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actual</th>
              </tr>
            </thead>
            <tbody>
              {data.by_budget_type.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">{item.budget_type}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.approved)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.adjusted)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
