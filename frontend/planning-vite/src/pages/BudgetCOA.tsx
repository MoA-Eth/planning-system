import { useEffect, useState } from 'react';

const BUDGET_API = 'https://budget.moa.gov.et/api';
const BUDGET_TOKEN = '70068850259899ffd56e7cb9d74299f70d43e426';

interface COAItem {
  id: number;
  code: string;
  name: string;
  approved_budget: number;
  adjusted_budget: number;
  actual_expenditure: number;
  balance: number;
}

export default function BudgetCOA() {
  const [data, setData] = useState<COAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCOA();
  }, []);

  const fetchCOA = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BUDGET_API}/chart-of-accounts/`, {
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
      setError(err instanceof Error ? err.message : 'Failed to load COA data');
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

  const filteredData = data.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
      item.code.toLowerCase().includes(search) ||
      item.name.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading Chart of Accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={fetchCOA}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">{data.length} accounts</p>
        </div>
        <input
          type="text"
          placeholder="Search by code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 w-64"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Accounts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Approved</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ETB {fmt(data.reduce((sum, item) => sum + item.approved_budget, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Actual</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ETB {fmt(data.reduce((sum, item) => sum + item.actual_expenditure, 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Balance</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            ETB {fmt(data.reduce((sum, item) => sum + item.balance, 0))}
          </p>
        </div>
      </div>

      {/* COA Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Code</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Account Name</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Approved</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Adjusted</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actual</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Balance</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No accounts found matching "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const utilization = item.adjusted_budget > 0
                    ? ((item.actual_expenditure / item.adjusted_budget) * 100).toFixed(1)
                    : '0.0';
                  
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono text-gray-900">{item.code}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{item.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.approved_budget)}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.adjusted_budget)}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{fmt(item.actual_expenditure)}</td>
                      <td className={`py-3 px-4 text-sm text-right font-medium ${
                        item.balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {fmt(item.balance)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{utilization}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
