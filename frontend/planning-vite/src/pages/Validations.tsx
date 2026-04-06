import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { currentEthiopianYear, toGregorianYearFromEthiopian } from '../lib/ethiopian';
import {
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Calendar,
  Building,
  Target,
  TrendingUp,
  BarChart3,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  RefreshCw,
  FileText,
  Shield,
  Award,
  Eye,
  Layers,
  FileCheck,
  CheckSquare
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

export default function Validations() {
  const { user } = useAuth();
  const currentYear = currentEthiopianYear();
  const [etYear, setEtYear] = useState<number | null>(currentYear);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [perfs, setPerfs] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<number | 'ALL'>('ALL');
  const [deptFilter, setDeptFilter] = useState<number | 'ALL'>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedView, setExpandedView] = useState<'breakdowns' | 'performance' | 'plans' | null>(null);
  
  // Batch validation state variables
  const [selectedBreakdownIds, setSelectedBreakdownIds] = useState<Set<number>>(new Set());
  const [selectedPerfIds, setSelectedPerfIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const isStrategic = (user?.role || '').toUpperCase() === 'STRATEGIC_STAFF';

  const loadData = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params: any = {};
      if (typeof etYear === 'number') {
        params.year = toGregorianYearFromEthiopian(etYear);
      }
      const [plansRes, bRes, pRes] = await Promise.all([
        api.get('/api/annual-plans/', { params }),
        api.get('/api/breakdowns/'),
        api.get('/api/performances/', { params }),
      ]);
      setPlans(plansRes.data || []);
      setBreakdowns(bRes.data || []);
      setPerfs(pRes.data || []);
      
      // Reset selections when data loads
      setSelectedBreakdownIds(new Set());
      setSelectedPerfIds(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [etYear]);

  const planById = useMemo(() => {
    const map: Record<number, AnnualPlan> = {};
    for (const p of plans) map[p.id] = p;
    return map;
  }, [plans]);

  const sectors = useMemo(() => {
    const seen: Record<number, string> = {};
    for (const p of plans) {
      if (p.sector_id) seen[p.sector_id] = p.sector_name || `Sector ${p.sector_id}`;
    }
    return Object.entries(seen)
      .map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plans]);

  const departments = useMemo(() => {
    const seen: Record<number, string> = {};
    for (const p of plans) {
      if (p.department_id) seen[p.department_id] = p.department_name || `Dept ${p.department_id}`;
    }
    return Object.entries(seen)
      .map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plans]);

  const approvedBreakdowns = useMemo(() => {
    const list = breakdowns.filter(b => planById[b.plan]);
    const onlyApproved = list.filter(b => (b.status || '').toUpperCase() === 'APPROVED');

    const bySector = onlyApproved.filter(b => {
      if (sectorFilter === 'ALL') return true;
      const p = planById[b.plan];
      return p?.sector_id === sectorFilter;
    });

    const byDept = bySector.filter(b => {
      if (deptFilter === 'ALL') return true;
      const p = planById[b.plan];
      return p?.department_id === deptFilter;
    });

    if (!query.trim()) return byDept;
    const q = query.toLowerCase();

    return byDept.filter(b => {
      const p = planById[b.plan];
      const txt = [p.indicator_name_with_group || p.indicator_name, p.department_name, p.sector_name, p.indicator_unit]
        .join(' ')
        .toLowerCase();
      return txt.includes(q);
    });
  }, [breakdowns, planById, query, sectorFilter, deptFilter]);

  const approvedPerfs = useMemo(() => {
    const list = perfs.filter(pr => planById[pr.plan]);
    const onlyApproved = list.filter(pr => (pr.status || '').toUpperCase() === 'APPROVED');

    const bySector = onlyApproved.filter(pr => {
      if (sectorFilter === 'ALL') return true;
      const p = planById[pr.plan];
      return p?.sector_id === sectorFilter;
    });

    const byDept = bySector.filter(pr => {
      if (deptFilter === 'ALL') return true;
      const p = planById[pr.plan];
      return p?.department_id === deptFilter;
    });

    if (!query.trim()) return byDept;
    const q = query.toLowerCase();

    return byDept.filter(pr => {
      const p = planById[pr.plan];
      const txt = [p.indicator_name_with_group || p.indicator_name, p.department_name, p.sector_name, p.indicator_unit]
        .join(' ')
        .toLowerCase();
      return txt.includes(q);
    });
  }, [perfs, planById, query, sectorFilter, deptFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalBreakdowns = breakdowns.length;
    const totalPerfs = perfs.length;
    const approvedBreakdownCount = breakdowns.filter(b => b.status.toUpperCase() === 'APPROVED').length;
    const approvedPerfCount = perfs.filter(p => p.status.toUpperCase() === 'APPROVED').length;
    
    return {
      totalBreakdowns,
      totalPerfs,
      approvedBreakdownCount,
      approvedPerfCount,
      breakdownApprovalRate: totalBreakdowns > 0 ? Math.round((approvedBreakdownCount / totalBreakdowns) * 100) : 0,
      perfApprovalRate: totalPerfs > 0 ? Math.round((approvedPerfCount / totalPerfs) * 100) : 0
    };
  }, [breakdowns, perfs]);

  // Batch validation functions
  const batchValidateBreakdowns = async () => {
    const ids = Array.from(selectedBreakdownIds);
    if (ids.length === 0) {
      alert('Please select at least one breakdown to validate');
      return;
    }
    
    if (!confirm(`Validate ${ids.length} quarterly breakdown(s) as compliant? This will validate all selected items at once.`)) return;
    
    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      try {
        await api.post(`/api/breakdowns/${id}/validate/`);
        successCount++;
      } catch (e: any) {
        console.error(`Failed to validate breakdown ${id}:`, e);
        failCount++;
      }
    }
    
    await loadData(true);
    setSelectedBreakdownIds(new Set());
    setSubmitting(false);
    alert(`Validated ${successCount} breakdowns. Failed: ${failCount}`);
  };

  const batchValidatePerformances = async () => {
    const ids = Array.from(selectedPerfIds);
    if (ids.length === 0) {
      alert('Please select at least one performance report to validate');
      return;
    }
    
    if (!confirm(`Validate ${ids.length} performance report(s) as compliant? This will validate all selected items at once.`)) return;
    
    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
      try {
        await api.post(`/api/performances/${id}/validate/`);
        successCount++;
      } catch (e: any) {
        console.error(`Failed to validate performance ${id}:`, e);
        failCount++;
      }
    }
    
    await loadData(true);
    setSelectedPerfIds(new Set());
    setSubmitting(false);
    alert(`Validated ${successCount} performance reports. Failed: ${failCount}`);
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
    
    setSubmitting(true);
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
    
    await loadData(true);
    setSelectedBreakdownIds(new Set());
    setSubmitting(false);
    alert(`Rejected ${successCount} breakdowns. Failed: ${failCount}`);
  };

  const batchRejectPerformances = async () => {
    const ids = Array.from(selectedPerfIds);
    if (ids.length === 0) {
      alert('Please select at least one performance report to reject');
      return;
    }
    
    const comment = prompt(`Please provide a reason for rejecting ${ids.length} performance report(s) (required):`, '') || '';
    if (comment === null) return;
    
    if (!comment.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject ${ids.length} performance report(s)?\nReason: ${comment}`)) return;
    
    setSubmitting(true);
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
    
    await loadData(true);
    setSelectedPerfIds(new Set());
    setSubmitting(false);
    alert(`Rejected ${successCount} performance reports. Failed: ${failCount}`);
  };

  const validateAllPendingBreakdowns = async () => {
    const allPendingIds = approvedBreakdowns.map(b => b.id);
    if (allPendingIds.length === 0) {
      alert('No approved breakdowns to validate');
      return;
    }
    
    if (!confirm(`Validate ALL ${allPendingIds.length} approved breakdowns? This cannot be undone.`)) return;
    
    setSelectedBreakdownIds(new Set(allPendingIds));
    setTimeout(() => batchValidateBreakdowns(), 100);
  };

  const validateAllPendingPerformances = async () => {
    const allPendingIds = approvedPerfs.map(p => p.id);
    if (allPendingIds.length === 0) {
      alert('No approved performance reports to validate');
      return;
    }
    
    if (!confirm(`Validate ALL ${allPendingIds.length} approved performance reports? This cannot be undone.`)) return;
    
    setSelectedPerfIds(new Set(allPendingIds));
    setTimeout(() => batchValidatePerformances(), 100);
  };

  const toggleSelectAllBreakdowns = () => {
    if (selectedBreakdownIds.size === approvedBreakdowns.length && approvedBreakdowns.length > 0) {
      setSelectedBreakdownIds(new Set());
    } else {
      setSelectedBreakdownIds(new Set(approvedBreakdowns.map(b => b.id)));
    }
  };

  const toggleSelectAllPerformances = () => {
    if (selectedPerfIds.size === approvedPerfs.length && approvedPerfs.length > 0) {
      setSelectedPerfIds(new Set());
    } else {
      setSelectedPerfIds(new Set(approvedPerfs.map(p => p.id)));
    }
  };

  const validateBreakdown = async (b: Breakdown) => {
    if (!confirm(`Validate this quarterly breakdown as compliant?`)) return;
    try {
      await api.post(`/api/breakdowns/${b.id}/validate/`);
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Validation failed');
    }
  };

  const rejectBreakdown = async (b: Breakdown) => {
    const comment = prompt('Please provide a reason for rejecting this breakdown (required):', '') || '';
    if (comment === null) return;
    
    if (!comment) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject this quarterly breakdown?\nReason: ${comment}`)) return;
    
    try {
      await api.post(`/api/breakdowns/${b.id}/reject/`, { comment });
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Rejection failed');
    }
  };

  const validatePerf = async (pr: Performance) => {
    if (!confirm(`Validate Q${pr.quarter} performance as compliant?`)) return;
    try {
      await api.post(`/api/performances/${pr.id}/validate/`);
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Validation failed');
    }
  };

  const rejectPerf = async (pr: Performance) => {
    const comment = prompt('Please provide a reason for rejecting this performance (required):', '') || '';
    if (comment === null) return;
    
    if (!comment) {
      alert('Please provide a rejection reason.');
      return;
    }
    
    if (!confirm(`Reject Q${pr.quarter} performance?\nReason: ${comment}`)) return;
    
    try {
      await api.post(`/api/performances/${pr.id}/reject/`, { comment });
      await loadData(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Rejection failed');
    }
  };

  const resetFilters = () => {
    setEtYear(currentYear);
    setQuery('');
    setSectorFilter('ALL');
    setDeptFilter('ALL');
  };

  const hasActiveFilters = etYear !== currentYear || query || sectorFilter !== 'ALL' || deptFilter !== 'ALL';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Strategic Affairs Validations</h1>
              <p className="text-gray-600 mt-2">
                Validate approved quarterly breakdowns and performance reports for strategic compliance
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <button className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm">
                <Download className="w-5 h-5" />
                Export
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved Breakdowns</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.approvedBreakdownCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.breakdownApprovalRate}% of total
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FileCheck className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved Performance</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.approvedPerfCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.perfApprovalRate}% of total
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Validation</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {approvedBreakdowns.length + approvedPerfs.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Awaiting strategic review
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Shield className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Plans</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {plans.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {etYear ? `Year ${etYear}` : 'All years'}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Controls */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by indicator, department, or sector..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-blue-600 rounded-full">
                      {[etYear !== currentYear, query, sectorFilter !== 'ALL', deptFilter !== 'ALL'].filter(Boolean).length}
                    </span>
                  )}
                </button>
                
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors duration-200"
                  >
                    Reset All
                  </button>
                )}
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Filter Validations</h3>
                  <p className="text-sm text-gray-600">Refine your view by selecting specific criteria</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Year Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="inline w-4 h-4 mr-1" />
                      Ethiopian Year
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={2000}
                        max={3000}
                        value={etYear ?? ''}
                        onChange={(e) => setEtYear(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter year (optional)"
                      />
                    </div>
                    {etYear !== currentYear && etYear !== null && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          Year: {etYear} ዓ.ም
                        </span>
                        <button
                          onClick={() => setEtYear(currentYear)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Sector Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Building className="inline w-4 h-4 mr-1" />
                      Sector
                    </label>
                    <div className="relative">
                      <select
                        value={sectorFilter === 'ALL' ? 'ALL' : String(sectorFilter)}
                        onChange={(e) => setSectorFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      >
                        <option value="ALL">All Sectors</option>
                        {sectors.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                      </div>
                    </div>
                    {sectorFilter !== 'ALL' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          {sectors.find(s => s.id === sectorFilter)?.name}
                        </span>
                        <button
                          onClick={() => setSectorFilter('ALL')}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Department Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Layers className="inline w-4 h-4 mr-1" />
                      Department
                    </label>
                    <div className="relative">
                      <select
                        value={deptFilter === 'ALL' ? 'ALL' : String(deptFilter)}
                        onChange={(e) => setDeptFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      >
                        <option value="ALL">All Departments</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                      </div>
                    </div>
                    {deptFilter !== 'ALL' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          {departments.find(d => d.id === deptFilter)?.name}
                        </span>
                        <button
                          onClick={() => setDeptFilter('ALL')}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Year Filters */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Year Select
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setEtYear(currentYear)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          etYear === currentYear
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Current ({currentYear})
                      </button>
                      <button
                        onClick={() => setEtYear(currentYear - 1)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          etYear === currentYear - 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Last Year ({currentYear - 1})
                      </button>
                      <button
                        onClick={() => setEtYear(null)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          etYear === null
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All Years
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700">Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1">
          {/* Quarterly Breakdowns Card - WITH BATCH VALIDATION */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Quarterly Breakdowns</h3>
                    <p className="text-sm text-blue-600">
                      {approvedBreakdowns.length} awaiting validation • {stats.approvedBreakdownCount} total approved
                    </p>
                  </div>
                </div>
                
                {/* Batch Action Buttons for Breakdowns */}
                {isStrategic && approvedBreakdowns.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedBreakdownIds.size > 0 && (
                      <>
                        <button
                          onClick={batchValidateBreakdowns}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          <CheckSquare className="w-4 h-4" />
                          Validate Selected ({selectedBreakdownIds.size})
                        </button>
                        <button
                          onClick={batchRejectBreakdowns}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject Selected ({selectedBreakdownIds.size})
                        </button>
                      </>
                    )}
                    <button
                      onClick={validateAllPendingBreakdowns}
                      disabled={submitting || approvedBreakdowns.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Shield className="w-4 h-4" />
                      Validate All ({approvedBreakdowns.length})
                    </button>
                  </div>
                )}
                
                <button
                  onClick={() => setExpandedView(expandedView === 'breakdowns' ? null : 'breakdowns')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  {expandedView === 'breakdowns' ? 'Collapse' : 'Expand'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedView === 'breakdowns' ? 'rotate-90' : ''}`} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-600">Loading approved breakdowns...</p>
              </div>
            ) : approvedBreakdowns.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileCheck className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No approved breakdowns to validate</p>
                <p className="text-gray-500 text-sm mt-1">
                  All approved breakdowns have been validated or none are approved yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {/* Checkbox column header */}
                      {isStrategic && (
                        <th className="px-4 py-3 text-center w-12">
                          <input
                            type="checkbox"
                            checked={selectedBreakdownIds.size === approvedBreakdowns.length && approvedBreakdowns.length > 0}
                            onChange={toggleSelectAllBreakdowns}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indicator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Annual Target</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quarterly Allocation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {approvedBreakdowns.map((b) => {
                      const p = planById[b.plan];
                      const quarters = [
                        { label: 'Q1', value: b.q1 },
                        { label: 'Q2', value: b.q2 },
                        { label: 'Q3', value: b.q3 },
                        { label: 'Q4', value: b.q4 },
                      ];
                      
                      return (
                        <tr key={b.id} className="hover:bg-gray-50 transition-colors duration-150">
                          {/* Checkbox column */}
                          {isStrategic && (
                            <td className="px-4 py-4 text-center">
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
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{p?.indicator_name_with_group || p?.indicator_name}</div>
                                <div className="text-sm text-gray-500 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    {p?.sector_name}
                                  </span>
                                  <span className="flex items-center gap-1 mt-1">
                                    <Layers className="w-3 h-3" />
                                    {p?.department_name}
                                  </span>
                                  {p?.indicator_unit && (
                                    <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                      Unit: {p.indicator_unit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-lg font-bold text-gray-900">{p?.target || '0'}</div>
                            <div className="text-xs text-gray-500 mt-1">Annual target</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {quarters.map((q, idx) => (
                                <div key={idx} className="text-center">
                                  <div className="text-xs text-gray-500">{q.label}</div>
                                  <div className={`text-sm font-semibold ${q.value ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {q.value || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => validateBreakdown(b)}
                                disabled={!isStrategic}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                                  isStrategic
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <CheckSquare className="w-4 h-4" />
                                Validate
                              </button>
                              <button
                                onClick={() => rejectBreakdown(b)}
                                disabled={!isStrategic}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                                  isStrategic
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quarterly Performance Card - WITH BATCH VALIDATION */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Quarterly Performance</h3>
                    <p className="text-sm text-emerald-600">
                      {approvedPerfs.length} awaiting validation • {stats.approvedPerfCount} total approved
                    </p>
                  </div>
                </div>
                
                {/* Batch Action Buttons for Performances */}
                {isStrategic && approvedPerfs.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedPerfIds.size > 0 && (
                      <>
                        <button
                          onClick={batchValidatePerformances}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          <CheckSquare className="w-4 h-4" />
                          Validate Selected ({selectedPerfIds.size})
                        </button>
                        <button
                          onClick={batchRejectPerformances}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject Selected ({selectedPerfIds.size})
                        </button>
                      </>
                    )}
                    <button
                      onClick={validateAllPendingPerformances}
                      disabled={submitting || approvedPerfs.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Shield className="w-4 h-4" />
                      Validate All ({approvedPerfs.length})
                    </button>
                  </div>
                )}
                
                <button
                  onClick={() => setExpandedView(expandedView === 'performance' ? null : 'performance')}
                  className="text-sm text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
                >
                  {expandedView === 'performance' ? 'Collapse' : 'Expand'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedView === 'performance' ? 'rotate-90' : ''}`} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-600">Loading approved performance reports...</p>
              </div>
            ) : approvedPerfs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No approved performance reports to validate</p>
                <p className="text-gray-500 text-sm mt-1">
                  All approved reports have been validated or none are approved yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {/* Checkbox column header */}
                      {isStrategic && (
                        <th className="px-4 py-3 text-center w-12">
                          <input
                            type="checkbox"
                            checked={selectedPerfIds.size === approvedPerfs.length && approvedPerfs.length > 0}
                            onChange={toggleSelectAllPerformances}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indicator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quarter</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance Explanation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {approvedPerfs.map((pr) => {
                      const p = planById[pr.plan];
                      const targetValue = parseFloat(p?.target || '0');
                      const reportedValue = parseFloat(pr.value || '0');
                      const achievementRate = targetValue > 0 ? (reportedValue / targetValue) * 100 : 0;
                      
                      return (
                        <tr key={pr.id} className="hover:bg-gray-50 transition-colors duration-150">
                          {/* Checkbox column */}
                          {isStrategic && (
                            <td className="px-4 py-4 text-center">
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
                                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{p?.indicator_name_with_group || p?.indicator_name}</div>
                                <div className="text-sm text-gray-500 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    {p?.sector_name}
                                  </span>
                                  <span className="flex items-center gap-1 mt-1">
                                    <Layers className="w-3 h-3" />
                                    {p?.department_name}
                                  </span>
                                </div>
                                {p?.indicator_unit && (
                                  <span className="inline-block mt-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                                    Unit: {p.indicator_unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              Quarter {pr.quarter}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Annual target: {p?.target}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-lg font-bold text-gray-900">{pr.value}</div>
                              {!isNaN(achievementRate) && (
                                <div className={`text-sm font-medium mt-1 ${
                                  achievementRate >= 100 ? 'text-emerald-600' :
                                  achievementRate >= 80 ? 'text-amber-600' :
                                  'text-red-600'
                                }`}>
                                  {achievementRate.toFixed(1)}% of target
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-700 whitespace-pre-line max-w-xs" title={pr.variance_description}>
                              {pr.variance_description && pr.variance_description.trim()
                                ? pr.variance_description
                                : '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => validatePerf(pr)}
                                disabled={!isStrategic}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                                  isStrategic
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <CheckSquare className="w-4 h-4" />
                                Validate
                              </button>
                              <button
                                onClick={() => rejectPerf(pr)}
                                disabled={!isStrategic}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                                  isStrategic
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Annual Plans Section */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Annual Plans (Reference)</h3>
                  <p className="text-sm text-purple-600">
                    {plans.length} plans • {etYear ? `Year ${etYear} ዓ.ም` : 'All years'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExpandedView(expandedView === 'plans' ? null : 'plans')}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
              >
                {expandedView === 'plans' ? 'Collapse' : 'Expand'}
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedView === 'plans' ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600">Loading annual plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Target className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No annual plans available</p>
              <p className="text-gray-500 text-sm mt-1">
                {etYear ? `No plans found for year ${etYear}` : 'No plans found for selected filters'}
              </p>
            </div>
          ) : (
            <div className={`overflow-x-auto transition-all duration-300 ${
              expandedView === 'plans' ? 'max-h-[5000px] opacity-100' : 'max-h-96 opacity-100'
            }`}>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indicator</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sector</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Annual Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{p.indicator_name_with_group || p.indicator_name}</div>
                        {p.indicator_unit && (
                          <span className="inline-block mt-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            Unit: {p.indicator_unit}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{p.department_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{p.sector_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-lg font-bold text-purple-700">{p.target}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Stats Footer */}
        <div className="mt-6 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {approvedBreakdowns.length + approvedPerfs.length} items awaiting strategic validation
              {hasActiveFilters && ' (filtered)'}
            </div>
            <div className="flex items-center gap-4">
              {!isStrategic && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <Shield className="w-4 h-4" />
                  Only Strategic Affairs Staff can perform validations
                </div>
              )}
              <div className="text-sm text-gray-500">
                Last updated: Just now
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}