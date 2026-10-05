import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/error';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X,
  Save,
  Layers,
  Building,
  Tag,
  Hash,
  ArrowUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

type Department = { id: number; name: string; sector?: { id: number; name: string } };
type IndicatorGroup = { id: number; name: string; department: Department };
type Indicator = { id: number; name: string; unit?: string; description?: string; department: Department; groups?: IndicatorGroup[]; is_aggregatable?: boolean; is_incremental?: boolean; display_order?: number | null; is_active_current_year?: boolean };
type Sector = { id: number; name: string };

export default function Indicators() {
  const { user } = useAuth();
  const isSuperuser = !!user?.is_superuser;

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [sectorId, setSectorId] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [groups, setGroups] = useState<IndicatorGroup[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [isAggregatable, setIsAggregatable] = useState(true);
  const [isIncremental, setIsIncremental] = useState(false);
  const [isActiveCurrentYear, setIsActiveCurrentYear] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sector: '',
    department: '',
    hasGroup: ''
  });
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pageSize = 15;

  const fetchAll = async () => {
    try {
      setLoading(true);
      setListError(null);
      const [indRes, depRes, secRes] = await Promise.all([
        api.get('/api/indicators/'),
        api.get('/api/departments/'),
        api.get('/api/sectors/'),
      ]);
      setIndicators(indRes.data);
      setDepartments(depRes.data);
      setSectors(secRes.data);
    } catch (e: any) {
      const msg = e?.userMessage || getErrorMessage(e, 'Failed to load data');
      setListError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [indicators.length]);

  const filteredIndicators = useMemo(() => {
    return indicators.filter(indicator => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        indicator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        indicator.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        indicator.department.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Sector filter
      const matchesSector = filters.sector === '' || 
        indicator.department.sector?.id.toString() === filters.sector;

      // Department filter
      const matchesDepartment = filters.department === '' || 
        indicator.department.id.toString() === filters.department;

      // Group filter
      const matchesGroup = filters.hasGroup === '' || 
        (filters.hasGroup === 'yes' ? (indicator.groups && indicator.groups.length > 0) : 
         filters.hasGroup === 'no' ? (!indicator.groups || indicator.groups.length === 0) : true);

      return matchesSearch && matchesSector && matchesDepartment && matchesGroup;
    });
  }, [indicators, searchQuery, filters]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredIndicators.length / pageSize)),
    [filteredIndicators.length, pageSize]
  );

  const paged = useMemo(
    () => filteredIndicators.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [filteredIndicators, page, pageSize]
  );

  useEffect(() => {
    const loadGroups = async () => {
      if (!departmentId) { 
        setGroups([]); 
        setGroupIds([]); 
        return; 
      }
      try {
        const res = await api.get(`/api/indicator-groups`, { params: { department: departmentId } });
        setGroups(res.data);
      } catch (e: any) {
        // keep silent, optional field
        setGroups([]);
      }
    };
    loadGroups();
  }, [departmentId]);

  const filteredDepartments = useMemo(() => {
    if (!sectorId) return departments;
    return departments.filter((d) => (d.sector?.id ?? null) === sectorId);
  }, [departments, sectorId]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setUnit('');
    setDescription('');
    setSectorId('');
    setDepartmentId('');
    setGroupIds([]);
    setIsAggregatable(true);
    setIsIncremental(false);
    setIsActiveCurrentYear(true);
    setDisplayOrder('');
    setFormError(null);
    setIsFormVisible(true);
  };

  const handleAddNewIndicator = () => {
    resetForm();
    // Scroll to form smoothly
    setTimeout(() => {
      document.getElementById('indicator-form')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    
    if (!departmentId) {
      setFormError('Please select a department');
      return;
    }
    
    if (!name.trim()) {
      setFormError('Indicator name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { 
        name: name.trim(), 
        unit: unit.trim() || undefined, 
        description: description.trim() || undefined, 
        department_id: departmentId, 
        group_ids: groupIds,
        ...(groupIds.length > 0 && { is_aggregatable: isAggregatable }),
        is_incremental: isIncremental,
        is_active_current_year: isActiveCurrentYear,
        display_order: displayOrder !== '' ? Number(displayOrder) : null,
      };
      
      if (editing) {
        await api.put(`/api/indicators/${editing.id}/`, payload);
        setSuccessMessage(`Indicator "${name}" updated successfully!`);
      } else {
        await api.post('/api/indicators/', payload);
        setSuccessMessage(`Indicator "${name}" created successfully!`);
        resetForm(); // Clear form on successful creation
      }
      
      fetchAll();
      
      // Auto-hide success message after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      
    } catch (e: any) {
      const data = e?.response?.data;
      if (data) {
        if (data.display_order) {
          setFormError(`Display order ${displayOrder !== '' ? `"${displayOrder}" ` : ''}is already used by another indicator. Please choose a unique number.`);
        } else if (data.detail) {
          setFormError(data.detail);
        } else {
          const fieldMessages = Object.entries(data)
            .map(([field, msgs]) => {
              const label = field === 'display_order' ? 'Display Order'
                          : field === 'name'          ? 'Name'
                          : field === 'department_id' ? 'Department'
                          : field;
              const msg = Array.isArray(msgs) ? msgs[0] : msgs;
              return `${label}: ${msg}`;
            })
            .join(' | ');
          setFormError(fieldMessages || 'Save failed. Please try again.');
        }
      } else {
        setFormError(e?.userMessage || getErrorMessage(e, 'Save failed. Please check your connection and try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEdit = (i: Indicator) => {
    setEditing(i);
    setName(i.name);
    setUnit(i.unit || '');
    setDescription(i.description || '');
    const sec = i.department?.sector?.id ? Number(i.department.sector.id) : '';
    setSectorId(sec as any);
    setDepartmentId(i.department.id);
    setGroupIds((i.groups || []).map((g) => g.id));
    setIsAggregatable(i.is_aggregatable ?? true);
    setIsIncremental(i.is_incremental ?? false);
    setIsActiveCurrentYear(i.is_active_current_year ?? true);
    setDisplayOrder(i.display_order ?? '');
    setIsFormVisible(true);
    
    // Scroll to form
    setTimeout(() => {
      document.getElementById('indicator-form')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  const onDelete = async (i: Indicator) => {
    if (!confirm(`Are you sure you want to delete indicator "${i.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/api/indicators/${i.id}/`);
      setSuccessMessage(`Indicator "${i.name}" deleted successfully!`);
      fetchAll();
      
      // Auto-hide success message after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (e: any) {
      const msg = e?.userMessage || getErrorMessage(e, 'Delete failed');
      setListError(msg);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilters({ sector: '', department: '', hasGroup: '' });
  };

  const hasActiveFilters = searchQuery || filters.sector || filters.department || filters.hasGroup;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Indicators</h1>
              <p className="text-gray-600 mt-2">Manage and track performance indicators across departments</p>
            </div>
            {isSuperuser && (
              <button
                onClick={handleAddNewIndicator}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
              >
                <Plus className="w-5 h-5" />
                Add New Indicator
              </button>
            )}
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 animate-fade-in">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
                </div>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-emerald-500 hover:text-emerald-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search indicators by name, description, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm"
              >
                <Filter className="w-4 h-4" />
                Filters
                {(filters.sector || filters.department || filters.hasGroup) && (
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sector</label>
                    <select
                      value={filters.sector}
                      onChange={(e) => setFilters({...filters, sector: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">All Sectors</option>
                      {sectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      value={filters.department}
                      onChange={(e) => setFilters({...filters, department: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Has Groups</label>
                    <select
                      value={filters.hasGroup}
                      onChange={(e) => setFilters({...filters, hasGroup: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">All</option>
                      <option value="yes">With Groups</option>
                      <option value="no">Without Groups</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Form */}
        {isSuperuser && (
          <div 
            id="indicator-form"
            className={`mb-8 bg-white rounded-2xl border border-gray-200 shadow-lg p-6 transition-all duration-300 ${isFormVisible ? 'block' : 'hidden'}`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${editing ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                  {editing ? <Edit2 className="w-5 h-5 text-yellow-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {editing ? `Editing "${editing.name}"` : 'Create New Indicator'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {editing ? 'Update the indicator details below' : 'Fill in the details to create a new indicator'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormVisible(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Hash className="inline w-4 h-4 mr-1" />
                    Indicator Name *
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Fishery per square area"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="inline w-4 h-4 mr-1" />
                    Unit
                  </label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., tons, %, km²"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building className="inline w-4 h-4 mr-1" />
                    Sector
                  </label>
                  <select
                    value={sectorId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : '';
                      setSectorId(v as any);
                      setDepartmentId('');
                      setGroupIds([]);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    disabled={isSubmitting}
                  >
                    <option value="">All sectors</option>
                    {sectors.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <ArrowUp className="inline w-4 h-4 mr-1" />
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g. 1, 2, 3"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be unique across all KPIs</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building className="inline w-4 h-4 mr-1" />
                    Department *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select department</option>
                    {filteredDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Layers className="inline w-4 h-4 mr-1" />
                  Groups (optional)
                </label>
                <select
                  multiple
                  value={groupIds.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((opt) => Number(opt.value));
                    setGroupIds(selected);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-h-[120px]"
                  disabled={!departmentId || isSubmitting}
                  title={!departmentId ? 'Select a department first' : undefined}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {groupIds.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-800 mb-2">Selected Groups ({groupIds.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {groups
                        .filter((g) => groupIds.includes(g.id))
                        .map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {g.name}
                            <button
                              type="button"
                              onClick={() => setGroupIds(prev => prev.filter(id => id !== g.id))}
                              className="ml-1 text-blue-500 hover:text-blue-700"
                              disabled={isSubmitting}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Aggregatable Checkbox - only show when indicator has groups */}
              {groupIds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CheckCircle className="inline w-4 h-4 mr-1" />
                    Aggregatable
                  </label>
                  <div className="flex items-center h-10">
                    <input
                      type="checkbox"
                      id="is-aggregatable"
                      checked={isAggregatable}
                      onChange={(e) => setIsAggregatable(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      disabled={isSubmitting}
                    />
                    <label htmlFor="is-aggregatable" className="ml-2 text-sm text-gray-700">
                      Include in parent group calculations
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    When enabled, this indicator's value will be summed and contribute to the parent group's total
                  </p>
                </div>
              )}

              {/* Incremental Checkbox - always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ArrowUp className="inline w-4 h-4 mr-1" />
                  Incremental
                </label>
                <div className="flex items-center h-10">
                  <input
                    type="checkbox"
                    id="is-incremental"
                    checked={isIncremental}
                    onChange={(e) => setIsIncremental(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="is-incremental" className="ml-2 text-sm text-gray-700">
                    Calculate performance incrementally (cumulative)
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  When enabled, performance will be calculated cumulatively across quarters
                </p>
              </div>

              {/* Active Current Year Checkbox - always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CheckCircle className="inline w-4 h-4 mr-1" />
                  Active for Current Year
                </label>
                <div className="flex items-center h-10">
                  <input
                    type="checkbox"
                    id="is-active-current-year"
                    checked={isActiveCurrentYear}
                    onChange={(e) => setIsActiveCurrentYear(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="is-active-current-year" className="ml-2 text-sm text-gray-700">
                    This indicator is active in the current planning year
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Uncheck to deactivate this indicator for the current year without deleting it
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  rows={3}
                  placeholder="Optional description of what this indicator measures..."
                  disabled={isSubmitting}
                />
              </div>

              {/* Form Error */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{formError}</p>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsFormVisible(false)}
                  className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : (editing ? 'Update Indicator' : 'Create Indicator')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Indicators List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Indicators ({filteredIndicators.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading indicators...</span>
            </div>
          ) : filteredIndicators.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Hash className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No indicators found</h3>
              <p className="text-gray-600">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Get started by creating your first indicator'}
              </p>
              {!hasActiveFilters && isSuperuser && (
                <button
                  onClick={handleAddNewIndicator}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Plus className="w-4 h-4" />
                  Create Indicator
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indicator</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Groups</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Properties</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paged.map((indicator) => (
                    <tr key={indicator.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {indicator.display_order ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{indicator.name}</div>
                          {indicator.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{indicator.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {indicator.unit || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{indicator.department.name}</td>
                      <td className="px-6 py-4">
                        {(indicator.groups && indicator.groups.length > 0) ? (
                          <div className="space-y-1">
                            {indicator.groups.map((group) => (
                              <span
                                key={group.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 mr-1 mb-1"
                              >
                                {group.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No groups</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {(indicator.groups && indicator.groups.length > 0) ? (
                            <>
                              {indicator.is_aggregatable === false ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  No
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Yes
                                </span>
                              )}
                              <span className="text-xs text-gray-500 ml-1">Aggregatable</span>
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs">No groups</span>
                          )}
                          {indicator.is_incremental && (
                            <>
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Yes
                                </span>
                                <span className="text-xs text-gray-500 ml-1">Incremental</span>
                              </div>
                            </>
                          )}
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              indicator.is_active_current_year !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {indicator.is_active_current_year !== false ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">This Year</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isSuperuser && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onEdit(indicator)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                              title="Edit indicator"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(indicator)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Delete indicator"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredIndicators.length)} of {filteredIndicators.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
