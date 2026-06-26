import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BUDGET_API = 'http://10.10.20.123/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';

interface YearTrendsData {
  fiscal_years: string[];
  yearly_totals: Array<{
    fiscal_year: string;
    approved: number;
    adjusted: number;
    actual: number;
    utilization_pct: number;
    over_budget_count: number;
  }>;
}

export default function BudgetTrends() {
  const [data, setData] = useState<YearTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BUDGET_API}/year-trends/`, {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
    } finally {
      setLoading(false);
    }
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
        <div className="text-gray-500">Loading trend data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={fetchTrends}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.yearly_totals.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No trend data available</div>
      </div>
    );
  }

  const latest = data.yearly_totals[data.yearly_totals.length - 1];
  const prev = data.yearly_totals.length > 1 ? data.yearly_totals[data.yearly_totals.length - 2] : null;
  
  const budgetGrowth = prev && prev.adjusted 
    ? ((latest.adjusted - prev.adjusted) / prev.adjusted * 100).toFixed(1)
    : null;
  
  const expGrowth = prev && prev.actual
    ? ((latest.actual - prev.actual) / prev.actual * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Year-over-Year Budget Trends</h1>
        <p className="text-sm text-gray-500 mt-1">
          Multi-year budget performance overview across {data.fiscal_years.length} fiscal year(s)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Latest Budget ({latest.fiscal_year})</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">ETB {fmtShort(latest.adjusted)}</p>
          {budgetGrowth && (
            <p className={`text-xs mt-2 ${parseFloat(budgetGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {budgetGrowth}% vs prev year
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Latest Expenditure ({latest.fiscal_year})</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">ETB {fmtShort(latest.actual)}</p>
          {expGrowth && (
            <p className={`text-xs mt-2 ${parseFloat(expGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {expGrowth}% vs prev year
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Latest Utilization</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{latest.utilization_pct}%</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Over-Budget Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{latest.over_budget_count}</p>
        </div>
      </div>

      {/* Budget vs Expenditure Trend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Expenditure Trend</h2>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data.yearly_totals}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="fiscal_year" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={(value) => fmtShort(value)}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number) => `ETB ${fmtShort(value)}`}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
            />
            <Line 
              type="monotone" 
              dataKey="adjusted" 
              stroke="#6366f1" 
              strokeWidth={2}
              name="Adjusted Budget"
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Actual Expenditure"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Yearly Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yearly Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Fiscal Year</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Approved</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Adjusted</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actual</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Utilization</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Over Budget</th>
              </tr>
            </thead>
            <tbody>
              {data.yearly_totals.map((year) => (
                <tr key={year.fiscal_year} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{year.fiscal_year}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmtShort(year.approved)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmtShort(year.adjusted)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmtShort(year.actual)}</td>
                  <td className="py-3 px-4 text-sm text-emerald-600 text-right font-medium">{year.utilization_pct}%</td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right">{year.over_budget_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
