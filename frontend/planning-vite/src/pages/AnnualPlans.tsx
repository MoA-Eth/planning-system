import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getCurrentEthiopianDate } from '../lib/ethiopian';
import SearchableSelect from '../components/SearchableSelect';
import { 
  Calendar, 
  Target, 
  Building, 
  Layers, 
  Filter, 
  X, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Download,
  Search,
  CheckCircle,
  AlertCircle,
  Sliders
} from 'lucide-react';

type Sector = { id: number; name: string };
type Department = { id: number; name: string; sector: Sector };
type Indicator = { 
  id: number; 
  name: string; 
  department?: Department; 
  groups?: Array<{
    id: number;
    name: string;
    hierarchy_path?: string;
    level?: number;
  }>;
  hierarchy_context?: {
    group_id: number;
    group_name: string;
    hierarchy_path: string;
    level: number;
    unit?: string;
  };
};
type AnnualPlan = {
  id: number;
  year: number;
  indicator: number;
  indicator_name: string;
  indicator_unit?: string;
  indicator_group_id?: number | null;
  indicator_group_name?: string | null;
  indicator_is_aggregatable?: boolean;
  department_id?: number;
  department_name?: string;
  sector_id?: number;
  sector_name?: string;
  target: string;
};

export default function AnnualPlans() {
  const { user } = useAuth();
  const isSuperuser = !!user?.is_superuser;
  const thisYear = getCurrentEthiopianDate()[0];
  const toGregorianYearFromEthiopian = (etYear: number) => etYear + 7;
  const toEthiopianYearFromGregorian = (grYear: number) => grYear - 7;

  // Helper function to format indicator display name with group context
  const formatIndicatorDisplayName = (indicator: Indicator): string => {
    // If indicator has hierarchy context, use it
    if (indicator.hierarchy_context) {
      const ctx = indicator.hierarchy_context;
      return `${indicator.name} (${ctx.hierarchy_path})`;
    }
    
    // If indicator has groups, show the first group's hierarchy path
    if (indicator.groups && indicator.groups.length > 0) {
      const group = indicator.groups[0];
      const path = group.hierarchy_path || group.name;
      return `${indicator.name} (${path})`;
    }
    
    // Fallback to just the name
    return indicator.name;
  };

  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Filter states
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [sectorFilter, setSectorFilter] = useState<number | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
  const [hasGroupFilter, setHasGroupFilter] = useState<string>('');

  // year in the UI is Ethiopian calendar year
  const [year, setYear] = useState<number>(thisYear);
  const [sectorId, setSectorId] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [indicatorId, setIndicatorId] = useState<number | ''>('');
  const [target, setTarget] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AnnualPlan | null>(null);
  const [editYear, setEditYear] = useState<number>(thisYear);
  const [editTarget, setEditTarget] = useState<string>('');

  const isAdvisorOrMinister = useMemo(() => {
    const r = (user?.role || '').toUpperCase();
    return r === 'ADVISOR' || r === 'STATE_MINISTER' || r === 'REGIONAL_STATE_MINISTER' || r === 'MINISTER' || r === 'REGIONAL_STATE_MINISTER';
  }, [user?.role]);

  const loadPlans = async () => {
    const res = await api.get('/api/annual-plans/');
    setPlans(res.data);
  };

  const loadSectors = async () => {
    const res = await api.get('/api/sectors/');
    setSectors(res.data);
  };

  const loadDepartments = async (sid: number) => {
    const res = await api.get('/api/departments/', { params: { sector: sid } });
    setDepartments(res.data);
  };

  const loadIndicators = async (did: number) => {
    const res = await api.get('/api/indicators/', { params: { department: did } });
    setIndicators(res.data);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadPlans();
        await loadSectors();
        // Auto-preselect based on user
        if (user?.sector) {
          setSectorId(user.sector as unknown as number);
          await loadDepartments(Number(user.sector));
        }
        if (user?.department) {
          setDepartmentId(user.department as unknown as number);
          await loadIndicators(Number(user.department));
        }
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.sector, user?.department]);

  // When sector changes manually
  useEffect(() => {
    (async () => {
      if (sectorId) {
        setDepartmentId('');
        setIndicatorId('');
        setIndicators([]);
        await loadDepartments(Number(sectorId));
      }
    })();
  }, [sectorId]);

  // When department changes
  useEffect(() => {
    (async () => {
      if (departmentId) {
        setIndicatorId('');
        await loadIndicators(Number(departmentId));
      }
    })();
  }, [departmentId]);

  // When sector filter changes, reset department filter and load departments for that sector
  useEffect(() => {
    (async () => {
      if (sectorFilter) {
        setDepartmentFilter('');
        await loadDepartments(Number(sectorFilter));
      } else {
        const res = await api.get('/api/departments/');
        setDepartments(res.data);
      }
    })();
  }, [sectorFilter]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (!indicatorId) return setError('Please select an indicator');
      const payload = { 
        year: toGregorianYearFromEthiopian(year), 
        indicator: indicatorId, 
        target: target || '0' 
      } as any;
      await api.post('/api/annual-plans/', payload);
      setIndicatorId('');
      setTarget('');
      setShowForm(false);
      await loadPlans();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Save failed');
    }
  };

  const onDelete = async (plan: AnnualPlan) => {
    if (!confirm(`Delete plan for ${plan.indicator_name} (${plan.year})?`)) return;
    try {
      await api.delete(`/api/annual-plans/${plan.id}/`);
      await loadPlans();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Delete failed');
    }
  };

  const openEdit = (p: AnnualPlan) => {
    setEditing(p);
    setEditYear(toEthiopianYearFromGregorian(p.year));
    setEditTarget(String(p.target ?? ''));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.put(`/api/annual-plans/${editing.id}/`, {
        year: toGregorianYearFromEthiopian(editYear),
        indicator: editing.indicator,
        target: editTarget || '0',
      });
      setEditOpen(false);
      setEditing(null);
      await loadPlans();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Update failed');
    }
  };

  // Apply filters to plans
  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      const ethiopianYear = toEthiopianYearFromGregorian(plan.year);
      
      // Year filter
      if (yearFilter !== '' && ethiopianYear !== yearFilter) return false;
      
      // Sector filter
      if (sectorFilter !== '' && plan.sector_id !== sectorFilter) return false;
      
      // Department filter
      if (departmentFilter !== '' && plan.department_id !== departmentFilter) return false;
      
      // Group filter
      if (hasGroupFilter === 'yes' && !plan.indicator_group_name) return false;
      if (hasGroupFilter === 'no' && plan.indicator_group_name) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          plan.indicator_name.toLowerCase().includes(query) ||
          plan.sector_name?.toLowerCase().includes(query) ||
          plan.department_name?.toLowerCase().includes(query) ||
          plan.indicator_unit?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [plans, yearFilter, sectorFilter, departmentFilter, hasGroupFilter, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<string, { 
      name: string; 
      departments: Record<string, { 
        name: string; 
        items: AnnualPlan[];
        collapsed?: boolean;
      }> 
    }> = {};
    
    for (const p of filteredPlans) {
      const sKey = String(p.sector_id ?? 'unknown');
      const dKey = String(p.department_id ?? 'unknown');
      
      if (!map[sKey]) map[sKey] = { 
        name: p.sector_name || 'Unassigned Sector', 
        departments: {} 
      };
      
      if (!map[sKey].departments[dKey]) map[sKey].departments[dKey] = { 
        name: p.department_name || 'Unassigned Department', 
        items: [] 
      };
      
      map[sKey].departments[dKey].items.push(p);
    }
    
    return map;
  }, [filteredPlans]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleDepartment = (sectorId: string, deptId: string) => {
    const groupId = `${sectorId}-${deptId}`;
    toggleGroup(groupId);
  };

  const resetForm = () => {
    setShowForm(false);
    setSectorId('');
    setDepartmentId('');
    setIndicatorId('');
    setTarget('');
    setError(null);
  };

  const resetFilters = () => {
    setYearFilter('');
    setSectorFilter('');
    setDepartmentFilter('');
    setHasGroupFilter('');
    setSearchQuery('');
  };

  const hasActiveFilters = yearFilter !== '' || sectorFilter !== '' || departmentFilter !== '' || hasGroupFilter !== '' || searchQuery !== '';

  const activeFilterCount = [
    yearFilter !== '',
    sectorFilter !== '',
    departmentFilter !== '',
    hasGroupFilter !== '',
    searchQuery !== ''
  ].filter(Boolean).length;

  // Get unique years from plans
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(plans.map(p => toEthiopianYearFromGregorian(p.year))))
      .sort((a, b) => b - a);
    return years;
  }, [plans]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Annual Plans</h1>
              <p className="text-gray-600 mt-2">Manage annual performance targets across departments and sectors</p>
            </div>
            
            <div className="flex items-center gap-3">
              {isSuperuser && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  New Plan
                </button>
              )}
              
              <button className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm">
                <Download className="w-5 h-5" />
                Export
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Plans</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{filteredPlans.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {plans.length !== filteredPlans.length ? `${plans.length} total` : ''}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Filters</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {activeFilterCount}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {hasActiveFilters ? 'Filters applied' : 'No filters'}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Sliders className="w-6 h-6 text-amber-600" />
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
                  placeholder="Search plans by indicator, department, or sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 shadow-sm"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-emerald-600 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Filter Annual Plans</h3>
                  <p className="text-sm text-gray-600">Refine your view by selecting specific criteria</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Year Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="inline w-4 h-4 mr-1" />
                      Year
                    </label>
                    <div className="relative">
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      >
                        <option value="">All Years</option>
                        {availableYears.map(y => (
                          <option key={y} value={y}>
                            {y} ዓ.ም
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    {yearFilter !== '' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          Year: {yearFilter}
                        </span>
                        <button
                          onClick={() => setYearFilter('')}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
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
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                        disabled={!!user?.sector && isAdvisorOrMinister}
                      >
                        <option value="">All Sectors</option>
                        {sectors.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    {sectorFilter !== '' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          {sectors.find(s => s.id === sectorFilter)?.name}
                        </span>
                        <button
                          onClick={() => setSectorFilter('')}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
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
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                        disabled={!!user?.department && isAdvisorOrMinister}
                      >
                        <option value="">All Departments</option>
                        {departments
                          .filter(d => sectorFilter === '' || d.sector.id === sectorFilter)
                          .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    {departmentFilter !== '' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          {departments.find(d => d.id === departmentFilter)?.name}
                        </span>
                        <button
                          onClick={() => setDepartmentFilter('')}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Group Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Layers className="inline w-4 h-4 mr-1" />
                      Has Group
                    </label>
                    <div className="relative">
                      <select
                        value={hasGroupFilter}
                        onChange={(e) => setHasGroupFilter(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      >
                        <option value="">All</option>
                        <option value="yes">With Groups</option>
                        <option value="no">Without Groups</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    {hasGroupFilter !== '' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          {hasGroupFilter === 'yes' ? 'With Groups' : 'Without Groups'}
                        </span>
                        <button
                          onClick={() => setHasGroupFilter('')}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Quick Year Filters */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Year Filters</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setYearFilter(thisYear)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        yearFilter === thisYear
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Current Year ({thisYear})
                    </button>
                    <button
                      onClick={() => setYearFilter(thisYear - 1)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        yearFilter === thisYear - 1
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Last Year ({thisYear - 1})
                    </button>
                    <button
                      onClick={() => setYearFilter(thisYear + 1)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        yearFilter === thisYear + 1
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Next Year ({thisYear + 1})
                    </button>
                    <button
                      onClick={() => setYearFilter('')}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Clear Year Filter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Plan Form */}
        {showForm && isSuperuser && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 shadow-lg p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Plus className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">Create New Annual Plan</h3>
                  <p className="text-sm text-gray-600">Define annual targets for indicators</p>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Year *
                  </label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter Ethiopian year"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ethiopian year: {year} ዓ.ም = {toGregorianYearFromEthiopian(year)} G.C.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building className="inline w-4 h-4 mr-1" />
                    Sector
                  </label>
                  <select
                    value={sectorId}
                    onChange={(e) => setSectorId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    disabled={!!user?.sector && isAdvisorOrMinister}
                    required
                  >
                    <option value="">Select sector</option>
                    {sectors.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building className="inline w-4 h-4 mr-1" />
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    disabled={!!user?.department && isAdvisorOrMinister}
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Layers className="inline w-4 h-4 mr-1" />
                    Indicator *
                  </label>
                  <SearchableSelect
                    options={indicators}
                    value={indicatorId}
                    onChange={(v) => setIndicatorId(v)}
                    placeholder="Select indicator"
                    disabled={!departmentId}
                    getLabel={(i) => formatIndicatorDisplayName(i)}
                    getValue={(i) => i.id}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="inline w-4 h-4 mr-1" />
                  Target Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter target value"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Enter the annual target for this indicator</p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <CheckCircle className="w-5 h-5" />
                  Create Plan
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Plans Dashboard */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Annual Plans Overview</h3>
                <p className="text-sm text-gray-600">
                  Showing {filteredPlans.length} of {plans.length} plans
                  {hasActiveFilters && ' (filtered)'}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                {Object.keys(grouped).length} sectors • {Object.values(grouped).reduce((sum, sector) => sum + Object.keys(sector.departments).length, 0)} departments
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-emerald-800">Active Filters:</span>
                  <div className="flex flex-wrap gap-2">
                    {yearFilter !== '' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                        <Calendar className="w-3 h-3" />
                        Year: {yearFilter} ዓ.ም
                        <button
                          onClick={() => setYearFilter('')}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {sectorFilter !== '' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                        <Building className="w-3 h-3" />
                        Sector: {sectors.find(s => s.id === sectorFilter)?.name}
                        <button
                          onClick={() => setSectorFilter('')}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {departmentFilter !== '' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                        <Layers className="w-3 h-3" />
                        Department: {departments.find(d => d.id === departmentFilter)?.name}
                        <button
                          onClick={() => setDepartmentFilter('')}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {hasGroupFilter !== '' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                        <Layers className="w-3 h-3" />
                        {hasGroupFilter === 'yes' ? 'With Groups' : 'Without Groups'}
                        <button
                          onClick={() => setHasGroupFilter('')}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                        <Search className="w-3 h-3" />
                        Search: "{searchQuery}"
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-emerald-600 hover:text-emerald-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={resetFilters}
                  className="text-sm text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600">Loading annual plans...</p>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {plans.length === 0 ? 'No annual plans created yet' : 'No plans match your filters'}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {plans.length === 0 
                  ? 'Start by creating your first annual plan' 
                  : 'Try adjusting or clearing your filters'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {Object.entries(grouped).map(([sKey, sVal]) => (
                <div key={sKey} className="group">
                  {/* Sector Header */}
                  <div 
                    className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 cursor-pointer transition-all duration-200"
                    onClick={() => toggleGroup(sKey)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`transform transition-transform duration-200 ${
                          expandedGroups.has(sKey) ? 'rotate-90' : ''
                        }`}>
                          <ChevronRight className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <Building className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{sVal.name}</h4>
                          <p className="text-sm text-emerald-600">
                            {Object.keys(sVal.departments).length} departments •{' '}
                            {Object.values(sVal.departments).reduce((sum, dept) => sum + dept.items.length, 0)} plans
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Click to {expandedGroups.has(sKey) ? 'collapse' : 'expand'}
                      </div>
                    </div>
                  </div>

                  {/* Departments - Animated Collapse */}
                  <div className={`overflow-hidden transition-all duration-300 ${
                    expandedGroups.has(sKey) ? 'opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    {Object.entries(sVal.departments).map(([dKey, dVal]) => (
                      <div key={dKey} className="border-t border-gray-100">
                        {/* Department Header */}
                        <div 
                          className="px-6 py-4 bg-emerald-50/50 hover:bg-emerald-100/50 cursor-pointer transition-colors duration-200"
                          onClick={() => toggleDepartment(sKey, dKey)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`transform transition-transform duration-200 ${
                                expandedGroups.has(`${sKey}-${dKey}`) ? 'rotate-90' : ''
                              }`}>
                                <ChevronRight className="w-4 h-4 text-emerald-500" />
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-800">{dVal.name}</h5>
                                <p className="text-sm text-emerald-500">
                                  {dVal.items.length} indicators • {yearFilter ? `Year ${yearFilter}` : 'All Years'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Indicators - Nested Animated Collapse */}
                        <div className={`overflow-hidden transition-all duration-300 ${
                          expandedGroups.has(`${sKey}-${dKey}`) ? 'opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <div className="px-6 py-4 bg-gray-50/50 overflow-y-auto">
                            {/* Grouped Indicators */}
                            {(() => {
                              const groupsMap = new Map<string, AnnualPlan[]>();
                              const ungrouped: AnnualPlan[] = [];
                              
                              for (const p of dVal.items) {
                                if (p.indicator_group_name) {
                                  const key = p.indicator_group_name;
                                  if (!groupsMap.has(key)) groupsMap.set(key, []);
                                  groupsMap.get(key)!.push(p);
                                } else {
                                  ungrouped.push(p);
                                }
                              }

                              return (
                                <div className="space-y-6">
                                  {/* Group Sections */}
                                  {Array.from(groupsMap.entries()).map(([gname, items]) => {
                                    const yearTotals = new Map<number, number>();
                                    for (const p of items) {
                                      // Only include aggregatable indicators in group totals
                                      if (p.indicator_is_aggregatable !== false) {
                                        const y = toEthiopianYearFromGregorian(p.year);
                                        const val = parseFloat(String(p.target || '0')) || 0;
                                        yearTotals.set(y, (yearTotals.get(y) || 0) + val);
                                      }
                                    }

                                    return (
                                      <div key={gname} className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                          <div className="p-2 bg-emerald-100 rounded-lg">
                                            <Layers className="w-4 h-4 text-emerald-600" />
                                          </div>
                                          <h6 className="font-semibold text-emerald-800">{gname}</h6>
                                          <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                                            {items.length} indicators
                                          </span>
                                        </div>

                                        {/* Group Summary */}
                                        <div className="mb-4 p-3 bg-emerald-50 rounded-lg">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-emerald-700">Yearly Targets</span>
                                            <div className="flex gap-3">
                                              {[...yearTotals.entries()].sort((a,b) => a[0] - b[0]).map(([y, sum]) => (
                                                <div key={y} className="text-center">
                                                  <div className="text-xs text-emerald-600">Year {y}</div>
                                                  <div className="font-bold text-emerald-800">{sum.toLocaleString()}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Indicators in Group */}
                                        <div className="space-y-3">
                                          {items.map((p) => (
                                            <div 
                                              key={p.id} 
                                              className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-150 group-hover:bg-gray-50"
                                            >
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-gray-800">{p.indicator_name}</span>
                                                  {p.indicator_unit && (
                                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                                      {p.indicator_unit}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                  <div className="text-sm text-gray-500">Year</div>
                                                  <div className="font-medium">{toEthiopianYearFromGregorian(p.year)}</div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-sm text-gray-500">Target</div>
                                                  <div className="font-bold text-emerald-700">{p.target}</div>
                                                </div>
                                                {isSuperuser && (
                                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <button
                                                      onClick={() => openEdit(p)}
                                                      className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                                                      title="Edit plan"
                                                    >
                                                      <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                      onClick={() => onDelete(p)}
                                                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                                      title="Delete plan"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Ungrouped Indicators */}
                                  {ungrouped.length > 0 && (
                                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                      <h6 className="font-semibold text-gray-700 mb-4">Individual Indicators</h6>
                                      <div className="space-y-3">
                                        {ungrouped.map((p) => (
                                          <div 
                                            key={p.id} 
                                            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors duration-150"
                                          >
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-800">{p.indicator_name}</span>
                                                {p.indicator_unit && (
                                                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                                    {p.indicator_unit}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                              <div className="text-right">
                                                <div className="text-sm text-gray-500">Year</div>
                                                <div className="font-medium">{toEthiopianYearFromGregorian(p.year)}</div>
                                              </div>
                                              <div className="text-right">
                                                <div className="text-sm text-gray-500">Target</div>
                                                <div className="font-bold text-emerald-700">{p.target}</div>
                                              </div>
                                              {isSuperuser && (
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                  <button
                                                    onClick={() => openEdit(p)}
                                                    className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                                                    title="Edit plan"
                                                  >
                                                    <Edit2 className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() => onDelete(p)}
                                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                                    title="Delete plan"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div 
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-green-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Edit2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Edit Annual Plan</h3>
                  <p className="text-sm text-emerald-600">Update target values for {editing.indicator_name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">{editing.indicator_name}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {editing.sector_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      {editing.department_name}
                    </span>
                  </div>
                  {editing.indicator_unit && (
                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      Unit: {editing.indicator_unit}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Year
                  </label>
                  <input 
                    type="number" 
                    min={2000} 
                    max={2100} 
                    value={editYear} 
                    onChange={(e) => setEditYear(Number(e.target.value))} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter Ethiopian year"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ethiopian year: {editYear} ዓ.ም = {toGregorianYearFromEthiopian(editYear)} G.C.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Target className="inline w-4 h-4 mr-1" />
                    Target
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={editTarget} 
                    onChange={(e) => setEditTarget(e.target.value)} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setEditOpen(false)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}