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
  variance_description?: string;
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
  
  // Batch selection state
  const [selectedBreakdownIds, setSelectedBreakdownIds] = useState<Set<number>>(new Set());
  const [selectedPerfIds, setSelectedPerfIds] = useState<Set<number>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);

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
      
      // Reset selections when data loads
      setSelectedBreakdownIds(new Set());
      setSelectedPerfIds(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [year]);

  useEffect(() => {
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

  // ========== BATCH ACTION FUNCTIONS ==========
  
  const batchApproveBreakdowns = async () => {
    const ids = Array.from(selectedBreakdownIds);
    if (ids.length === 0) {
      alert('Please select at least one breakdown to approve');
      return;
    }
    
    if (!confirm(`Final approve ${ids.length} quarterly breakdown(s)? This will approve all selected items at once.`)) return;
    
    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      try {
        await api.post(`/api/breakdowns/${id}/final_approve/`);
        successCount++;
      } catch (e: any) {
        console.error(`Failed to approve breakdown ${id}:`, e);
        failCount++;
      }
    }
    
    await loadData();
    setSelectedBreakdownIds(new Set());
    setBatchSubmitting(false);
    alert(`Approved ${successCount} breakdowns. Failed: ${failCount}`);
  };

  const batchRejectBreakdowns = async () => {
    const ids = Array.from(selectedBreakdownIds);
    if (ids.length === 0) {
      alert('Please select at least one breakdown to reject');
      return;
    }
    
    const comment = prompt(`Please provide a reason for rejecting ${ids.length} breakdown(s) (required):`, '') || '';
    if (comment === null) return;
    
    if (!comment.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject ${ids.length} quarterly breakdown(s)?\nReason: ${comment}`)) return;
    
    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      try {
        await api.post(`/api/breakdowns/${id}/reject/`, { comment });
        successCount++;
      } catch (e: any) {
        console.error(`Failed to reject breakdown ${id}:`, e);
        failCount++;
      }
    }
    
    await loadData();
    setSelectedBreakdownIds(new Set());
    setBatchSubmitting(false);
    alert(`Rejected ${successCount} breakdowns. Failed: ${failCount}`);
  };

  const batchApprovePerformances = async () => {
    const ids = Array.from(selectedPerfIds);
    if (ids.length === 0) {
      alert('Please select at least one performance to approve');
      return;
    }
    
    if (!confirm(`Final approve ${ids.length} performance report(s)? This will approve all selected items at once.`)) return;
    
    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      try {
        await api.post(`/api/performances/${id}/final_approve/`);
        successCount++;
      } catch (e: any) {
        console.error(`Failed to approve performance ${id}:`, e);
        failCount++;
      }
    }
    
    await loadData();
    setSelectedPerfIds(new Set());
    setBatchSubmitting(false);
    alert(`Approved ${successCount} performances. Failed: ${failCount}`);
  };

  const batchRejectPerformances = async () => {
    const ids = Array.from(selectedPerfIds);
    if (ids.length === 0) {
      alert('Please select at least one performance to reject');
      return;
    }
    
    const comment = prompt(`Please provide a reason for rejecting ${ids.length} performance report(s) (required):`, '') || '';
    if (comment === null) return;
    
    if (!comment.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject ${ids.length} performance report(s)?\nReason: ${comment}`)) return;
    
    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      try {
        await api.post(`/api/performances/${id}/reject/`, { comment });
        successCount++;
      } catch (e: any) {
        console.error(`Failed to reject performance ${id}:`, e);
        failCount++;
      }
    }
    
    await loadData();
    setSelectedPerfIds(new Set());
    setBatchSubmitting(false);
    alert(`Rejected ${successCount} performances. Failed: ${failCount}`);
  };

  const approveAllBreakdowns = async () => {
    const allIds = validatedBreakdowns.map(b => b.id);
    if (allIds.length === 0) {
      alert('No breakdowns to approve');
      return;
    }
    
    if (!confirm(`Final approve ALL ${allIds.length} breakdowns? This cannot be undone.`)) return;
    
    setSelectedBreakdownIds(new Set(allIds));
    setTimeout(() => batchApproveBreakdowns(), 100);
  };

  const rejectAllBreakdowns = async () => {
    const allIds = validatedBreakdowns.map(b => b.id);
    if (allIds.length === 0) {
      alert('No breakdowns to reject');
      return;
    }
    
    const comment = prompt(`Please provide a reason for rejecting ALL ${allIds.length} breakdowns (required):`, '') || '';
    if (comment === null) return;
    
    if (!comment.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject ALL ${allIds.length} breakdowns?\nReason: ${comment}`)) return;
    
    setSelectedBreakdownIds(new Set(allIds));
    setTimeout(() => batchRejectBreakdowns(), 100);
  };

  const approveAllPerformances = async () => {
    const allIds = validatedPerfs.map(p => p.id);
    if (allIds.length === 0) {
      alert('No performances to approve');
      return;
    }
    
    if (!confirm(`Final approve ALL ${allIds.length} performances? This cannot be undone.`)) return;
    
    setSelectedPerfIds(new Set(allIds));
    setTimeout(() => batchApprovePerformances(), 100);
  };

  const rejectAllPerformances = async () => {
    const allIds = validatedPerfs.map(p => p.id);
    if (allIds.length === 0) {
      alert('No performances to reject');
      return;
    }
    
    const comment = prompt(`Please provide a reason for rejecting ALL ${allIds.length} performances (required):`, '') || '';
    if (comment === null) return;
    
    if (!comment.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject ALL ${allIds.length} performances?\nReason: ${comment}`)) return;
    
    setSelectedPerfIds(new Set(allIds));
    setTimeout(() => batchRejectPerformances(), 100);
  };

  const toggleSelectAllBreakdowns = () => {
    if (selectedBreakdownIds.size === validatedBreakdowns.length && validatedBreakdowns.length > 0) {
      setSelectedBreakdownIds(new Set());
    } else {
      setSelectedBreakdownIds(new Set(validatedBreakdowns.map(b => b.id)));
    }
  };

  const toggleSelectAllPerformances = () => {
    if (selectedPerfIds.size === validatedPerfs.length && validatedPerfs.length > 0) {
      setSelectedPerfIds(new Set());
    } else {
      setSelectedPerfIds(new Set(validatedPerfs.map(p => p.id)));
    }
  };

  // ========== END BATCH ACTION FUNCTIONS ==========

  const handleAction = async (
    type: 'breakdown' | 'performance',
    id: number,
    action: 'approve' | 'reject'
  ) => {
    try {
      setActionLoading({ type, id, action });
      
      if (action === 'reject') {
        const comment = window.prompt('Please provide a reason for rejection:', '');
        if (comment === null) return;
        
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
    total: validatedBreakdowns.length + validatedPerfs.length,
    selectedBreakdowns: selectedBreakdownIds.size,
    selectedPerformances: selectedPerfIds.size
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
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
                  <p className="text-sm font-medium text-gray-600">Selected Breakdowns</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.selectedBreakdowns}</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Selected Performances</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.selectedPerformances}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Eye className="w-6 h-6 text-purple-600" />
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
        {(loading || batchSubmitting) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-lg font-medium">
                  {batchSubmitting ? 'Processing batch action...' : 'Loading approvals...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6">
          {/* Breakdowns Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Quarterly Breakdowns</h2>
                    <p className="text-gray-600 text-sm">Review and approve quarterly target allocations</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {validatedBreakdowns.length} pending
                  </span>
                </div>
              </div>
              
              {/* Batch Action Buttons for Breakdowns */}
              {isExecutive && validatedBreakdowns.length > 0 && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-blue-200 flex-wrap">
                  {selectedBreakdownIds.size > 0 && (
                    <>
                      <button
                        onClick={batchApproveBreakdowns}
                        disabled={batchSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve Selected ({selectedBreakdownIds.size})
                      </button>
                      <button
                        onClick={batchRejectBreakdowns}
                        disabled={batchSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject Selected ({selectedBreakdownIds.size})
                      </button>
                    </>
                  )}
                  <button
                    onClick={approveAllBreakdowns}
                    disabled={batchSubmitting || validatedBreakdowns.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve All ({validatedBreakdowns.length})
                  </button>
                  <button
                    onClick={rejectAllBreakdowns}
                    disabled={batchSubmitting || validatedBreakdowns.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject All ({validatedBreakdowns.length})
                  </button>
                </div>
              )}
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
                <>
                  {/* Select All Checkbox */}
                  <div className="mb-4 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="selectAllBreakdowns"
                      checked={selectedBreakdownIds.size === validatedBreakdowns.length && validatedBreakdowns.length > 0}
                      onChange={toggleSelectAllBreakdowns}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="selectAllBreakdowns" className="text-sm font-medium text-gray-700">
                      Select All Breakdowns ({validatedBreakdowns.length})
                    </label>
                  </div>
                  
                  <div className="space-y-4">
                    {validatedBreakdowns.map((b) => {
                      const p = planById[b.plan];
                      const isExpanded = expandedBreakdown === b.id;
                      
                      return (
                        <div key={b.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
                          <div className="p-4 bg-white">
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={selectedBreakdownIds.has(b.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedBreakdownIds);
                                  if (e.target.checked) {
                                    newSet.add(b.id);
                                  } else {
                                    newSet.delete(b.id);
                                  }
                                  setSelectedBreakdownIds(newSet);
                                }}
                                className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => setExpandedBreakdown(isExpanded ? null : b.id)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-2 mt-4 pt-4 border-t">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction('breakdown', b.id, 'approve');
                                }}
                                disabled={!isExecutive || actionLoading?.id === b.id || batchSubmitting}
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
                                disabled={!isExecutive || actionLoading?.id === b.id || batchSubmitting}
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
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Performances Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Eye className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Quarterly Performances</h2>
                    <p className="text-gray-600 text-sm">Review and approve quarterly performance results</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full">
                    {validatedPerfs.length} pending
                  </span>
                </div>
              </div>
              
              {/* Batch Action Buttons for Performances */}
              {isExecutive && validatedPerfs.length > 0 && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-emerald-200 flex-wrap">
                  {selectedPerfIds.size > 0 && (
                    <>
                      <button
                        onClick={batchApprovePerformances}
                        disabled={batchSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve Selected ({selectedPerfIds.size})
                      </button>
                      <button
                        onClick={batchRejectPerformances}
                        disabled={batchSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject Selected ({selectedPerfIds.size})
                      </button>
                    </>
                  )}
                  <button
                    onClick={approveAllPerformances}
                    disabled={batchSubmitting || validatedPerfs.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve All ({validatedPerfs.length})
                  </button>
                  <button
                    onClick={rejectAllPerformances}
                    disabled={batchSubmitting || validatedPerfs.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject All ({validatedPerfs.length})
                  </button>
                </div>
              )}
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
                <>
                  {/* Select All Checkbox */}
                  <div className="mb-4 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="selectAllPerformances"
                      checked={selectedPerfIds.size === validatedPerfs.length && validatedPerfs.length > 0}
                      onChange={toggleSelectAllPerformances}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="selectAllPerformances" className="text-sm font-medium text-gray-700">
                      Select All Performances ({validatedPerfs.length})
                    </label>
                  </div>
                  
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
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={selectedPerfIds.has(pr.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedPerfIds);
                                if (e.target.checked) {
                                  newSet.add(pr.id);
                                } else {
                                  newSet.delete(pr.id);
                                }
                                setSelectedPerfIds(newSet);
                              }}
                              className="mt-1 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                              disabled={!isExecutive || actionLoading?.id === pr.id || batchSubmitting}
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
                              disabled={!isExecutive || actionLoading?.id === pr.id || batchSubmitting}
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
                </>
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