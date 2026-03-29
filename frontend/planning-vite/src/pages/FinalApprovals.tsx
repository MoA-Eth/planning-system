import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getCurrentEthiopianDate } from '../lib/ethiopian';
import YearFilter from '../components/YearFilter';
import { 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  ChevronDown, 
  AlertCircle,
  Loader2,
  Download,
  Eye
} from 'lucide-react';

type AnnualPlan = {
  id: number;
  year: number;
  indicator: number;
  indicator_name: string;
  indicator_name_with_group?: string;
  indicator_unit?: string;
  department_id?: number;
  department_name?: string;
  sector_id?: number;
  sector_name?: string;
  target: string;
};

type Breakdown = {
  id: number;
  plan: number;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  q4: string | null;
  status: string;
};

type Performance = {
  id: number;
  plan: number;
  quarter: number;
  value: string;
  status: string;
  variance_description?: string; // Add variance_description property
};

export default function FinalApprovals() {
  const { user } = useAuth();
  const thisYear = getCurrentEthiopianDate()[0];
  const [year, setYear] = useState<number>(thisYear);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [perfs, setPerfs] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoading, setActionLoading] = useState<{type: 'breakdown' | 'performance', id: number, action: 'approve' | 'reject'} | null>(null);

  const toNumber = (val: unknown) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const toGregorianYearFromEthiopian = (etYear: number) => etYear + 7;
      const gregYear = toGregorianYearFromEthiopian(year);
      const [plansRes, bRes, pRes] = await Promise.all([
        api.get('/api/annual-plans/', { params: { year: gregYear } }),
        api.get('/api/breakdowns/'),
        api.get('/api/performances/'),
      ]);
      setPlans(plansRes.data || []);
      setBreakdowns((bRes.data || []) as Breakdown[]);
      setPerfs((pRes.data || []) as Performance[]);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [year]);

  useEffect(() => {
    // Reset department when sector changes
    setSelectedDepartmentId(null);
  }, [selectedSectorId]);

  const planById = useMemo(() => {
    const map: Record<number, AnnualPlan> = {};
    for (const p of plans) map[p.id] = p;
    return map;
  }, [plans]);

  const sectorOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of plans) {
      if (typeof p.sector_id === 'number' && p.sector_name) {
        map.set(p.sector_id, p.sector_name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plans]);

  const departmentOptions = useMemo(() => {
    const map = new Map<number, { name: string; sector_id?: number }>();
    for (const p of plans) {
      if (typeof p.department_id === 'number' && p.department_name) {
        if (!map.has(p.department_id)) map.set(p.department_id, { name: p.department_name, sector_id: p.sector_id });
      }
    }
    let arr = Array.from(map, ([id, v]) => ({ id, name: v.name, sector_id: v.sector_id }));
    if (selectedSectorId) arr = arr.filter((d) => d.sector_id === selectedSectorId);
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  }, [plans, selectedSectorId]);

  const validatedBreakdowns = useMemo(() => {
    const list = breakdowns.filter(b => planById[b.plan]);
    let arr = list.filter(b => (b.status || '').toUpperCase() === 'VALIDATED');
    if (selectedSectorId) {
      arr = arr.filter(b => planById[b.plan]?.sector_id === selectedSectorId);
    }
    if (selectedDepartmentId) {
      arr = arr.filter(b => planById[b.plan]?.department_id === selectedDepartmentId);
    }
    if (!query.trim()) return arr;
    const q = query.toLowerCase();
    return arr.filter(b => {
      const p = planById[b.plan];
      const txt = [p.indicator_name_with_group || p.indicator_name, p.department_name, p.sector_name, p.indicator_unit].join(' ').toLowerCase();
      return txt.includes(q);
    });
  }, [breakdowns, planById, query, selectedSectorId, selectedDepartmentId]);

  const validatedPerfs = useMemo(() => {
    const list = perfs.filter(pr => planById[pr.plan]);
    let arr = list.filter(pr => (pr.status || '').toUpperCase() === 'VALIDATED');
    if (selectedSectorId) {
      arr = arr.filter(pr => planById[pr.plan]?.sector_id === selectedSectorId);
    }
    if (selectedDepartmentId) {
      arr = arr.filter(pr => planById[pr.plan]?.department_id === selectedDepartmentId);
    }
    if (!query.trim()) return arr;
    const q = query.toLowerCase();
    return arr.filter(pr => {
      const p = planById[pr.plan];
      const txt = [p.indicator_name_with_group || p.indicator_name, p.department_name, p.sector_name, p.indicator_unit].join(' ').toLowerCase();
      return txt.includes(q);
    });
  }, [perfs, planById, query, selectedSectorId, selectedDepartmentId]);

  const handleAction = async (
    type: 'breakdown' | 'performance',
    id: number,
    action: 'approve' | 'reject'
  ) => {
    try {
      setActionLoading({ type, id, action });
      
      if (action === 'reject') {
        const comment = window.prompt('Please provide a reason for rejection:', '');
        if (comment === null) return; // User cancelled
        
        if (type === 'breakdown') {
          await api.post(`/api/breakdowns/${id}/reject/`, { comment });
        } else {
          await api.post(`/api/performances/${id}/reject/`, { comment });
        }
      } else {
        if (type === 'breakdown') {
          await api.post(`/api/breakdowns/${id}/final_approve/`);
        } else {
          await api.post(`/api/performances/${id}/final_approve/`);
        }
      }
      
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.detail || `${action === 'approve' ? 'Approval' : 'Rejection'} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  const exportToCSV = (type: 'breakdowns' | 'performances') => {
    const data = type === 'breakdowns' ? validatedBreakdowns : validatedPerfs;
    const headers = type === 'breakdowns' 
      ? ['Indicator', 'Department', 'Sector', 'Target', 'Q1', 'Q2', 'Q3', 'Q4']
      : ['Indicator', 'Department', 'Sector', 'Quarter', 'Value'];
    
    const csvContent = [
      headers.join(','),
      ...data.map(item => {
        const plan = planById[item.plan];
        if (type === 'breakdowns') {
          const b = item as Breakdown;
          return [
            `"${plan?.indicator_name_with_group || plan?.indicator_name}"`,
            `"${plan?.department_name || ''}"`,
            `"${plan?.sector_name || ''}"`,
            plan?.target || '0',
            b.q1 || '',
            b.q2 || '',
            b.q3 || '',
            b.q4 || ''
          ].join(',');
        } else {
          const p = item as Performance;
          return [
            `"${plan?.indicator_name_with_group || plan?.indicator_name}"`,
            `"${plan?.department_name || ''}"`,
            `"${plan?.sector_name || ''}"`,
            `Q${p.quarter}`,
            p.value
          ].join(',');
        }
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${year}.csv`;
    a.click();
  };

  const isExecutive = (user?.role || '').toUpperCase() === 'EXECUTIVE';

  const stats = {
    breakdowns: validatedBreakdowns.length,
    performances: validatedPerfs.length,
    total: validatedBreakdowns.length + validatedPerfs.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Final Approvals Dashboard</h1>
              <p className="text-gray-600 mt-1">Executive oversight for validated quarterly plans and performances</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportToCSV('breakdowns')}
                disabled={stats.breakdowns === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Breakdowns
              </button>
              <button
                onClick={() => exportToCSV('performances')}
                disabled={stats.performances === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Performances
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Breakdowns</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.breakdowns}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Performances</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.performances}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <Eye className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Pending</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => setShowFilters(!showFilters)}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Filters & Search</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </div>
            
            {showFilters && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <YearFilter value={year} onChange={setYear} />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                    <select
                      value={selectedSectorId ?? ''}
                      onChange={(e) => setSelectedSectorId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All sectors</option>
                      {sectorOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={selectedDepartmentId ?? ''}
                      onChange={(e) => setSelectedDepartmentId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!selectedSectorId}
                    >
                      <option value="">All departments</option>
                      {departmentOptions.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search indicators..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setQuery('');
                      setSelectedSectorId(null);
                      setSelectedDepartmentId(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-lg font-medium">Loading approvals...</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 ">
          {/* Breakdowns Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Quarterly Breakdowns</h2>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {validatedBreakdowns.length} pending
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-1">Review and approve quarterly target allocations</p>
            </div>
            
            <div className="p-4">
              {validatedBreakdowns.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                  <p className="text-gray-600">No validated breakdowns require approval.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {validatedBreakdowns.map((b) => {
                    const p = planById[b.plan];
                    const isExpanded = expandedBreakdown === b.id;
                    
                    return (
                      <div key={b.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
                        <div 
                          className="p-4 bg-white cursor-pointer"
                          onClick={() => setExpandedBreakdown(isExpanded ? null : b.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium text-gray-900">{p?.indicator_name_with_group || p?.indicator_name}</h4>
                              {p?.indicator_unit && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  {p.indicator_unit}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>{p?.department_name}</span>
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              <span>{p?.sector_name}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-4">
                              <div className="text-sm">
                                <span className="text-gray-500">Annual Target: </span>
                                <span className="font-medium">{p?.target || '0'}</span>
                              </div>
                            </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="grid grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((q) => (
                                  <div key={q} className="text-center">
                                    <div className="text-xs text-gray-500 mb-1">Q{q}</div>
                                    <div className="font-medium bg-gray-50 py-2 rounded">
                                      {b[`q${q}` as keyof Breakdown] || '-'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 mt-4 pt-4 border-t">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction('breakdown', b.id, 'approve');
                                  }}
                                  disabled={!isExecutive || actionLoading?.id === b.id}
                                  className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium ${
                                    isExecutive 
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {actionLoading?.id === b.id && actionLoading.action === 'approve' ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Final Approve
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction('breakdown', b.id, 'reject');
                                  }}
                                  disabled={!isExecutive || actionLoading?.id === b.id}
                                  className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium ${
                                    isExecutive 
                                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {actionLoading?.id === b.id && actionLoading.action === 'reject' ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Reject
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Performances Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Quarterly Performances</h2>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full">
                  {validatedPerfs.length} pending
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-1">Review and approve quarterly performance results</p>
            </div>
            
            <div className="p-4">
              {validatedPerfs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <Eye className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                  <p className="text-gray-600">No validated performances require approval.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {validatedPerfs.map((pr) => {
                    const p = planById[pr.plan];
                    const quarterColors: Record<number, string> = {
                      1: 'bg-blue-100 text-blue-800',
                      2: 'bg-green-100 text-green-800',
                      3: 'bg-yellow-100 text-yellow-800',
                      4: 'bg-red-100 text-red-800'
                    };
                    
                    return (
                      <div key={pr.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900">{p?.indicator_name_with_group || p?.indicator_name}</h4>
                              {p?.indicator_unit && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  {p.indicator_unit}
                                </span>
                              )}
                              <span className={`px-2 py-1 text-xs font-medium rounded ${quarterColors[pr.quarter] || 'bg-gray-100 text-gray-800'}`}>
                                Q{pr.quarter}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                              <span>{p?.department_name}</span>
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              <span>{p?.sector_name}</span>
                            </div>
                            <div className="flex items-center gap-6">
                              <div>
                                <div className="text-xs text-gray-500">Performance Value</div>
                                <div className="text-lg font-bold text-gray-900">{pr.value}</div>
                              </div>
                              {p?.target && (
                                <div>
                                  <div className="text-xs text-gray-500">Quarterly Target</div>
                                  <div className="text-lg font-medium text-gray-900">
                                    {(() => {
                                      const b = breakdowns.find(b => b.plan === pr.plan);
                                      const qTarget = b ? b[`q${pr.quarter}` as keyof Breakdown] : null;
                                      return qTarget || 'N/A';
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                            {pr.variance_description && pr.variance_description.trim() && (
                              <div className="mt-3 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3 whitespace-pre-line">
                                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                                  Variance Explanation
                                </div>
                                {pr.variance_description}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-4 pt-4 border-t">
                          <button
                            onClick={() => handleAction('performance', pr.id, 'approve')}
                            disabled={!isExecutive || actionLoading?.id === pr.id}
                            className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium ${
                              isExecutive 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {actionLoading?.id === pr.id && actionLoading.action === 'approve' ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Final Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleAction('performance', pr.id, 'reject')}
                            disabled={!isExecutive || actionLoading?.id === pr.id}
                            className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium ${
                              isExecutive 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {actionLoading?.id === pr.id && actionLoading.action === 'reject' ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        {!isExecutive && (
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Note:</span>
              <span>You need executive privileges to approve or reject items.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}