import { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { IndicatorGroup, Department, Sector } from '../types/indicator';
import { 
  Layers, 
  Building, 
  Plus, 
  Edit2, 
  Trash2, 
  Filter, 
  Search, 
  RefreshCw,
  X,
  Save,
  ChevronDown,
  Hash,
  PieChart,
  AlertCircle,
  ArrowUpDown,
  Signal
} from 'lucide-react';

export default function IndicatorGroups() {
  const { user } = useAuth();
  const isSuperuser = !!user?.is_superuser;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [groups, setGroups] = useState<IndicatorGroup[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [sectorId, setSectorId] = useState<number | ''>('');
  const [associationType, setAssociationType] = useState<'department' | 'sector'>('department');
  const [formSectorId, setFormSectorId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [isLabel, setIsLabel] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<number | ''>('');
  const [groupStatus, setGroupStatus] = useState<'HIGH' | 'MEDIUM' | 'LOW' | ''>('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [editing, setEditing] = useState<IndicatorGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Filter parent groups based on association type and selections
  const filteredParentGroups = useMemo(() => {
    console.log('useMemo called with:', { 
      associationType, 
      formSectorId, 
      departmentId,
      editingId: editing?.id, 
      groupsCount: groups.length 
    });
    
    if (!formSectorId) {
      console.log('Returning empty array - no sector selected');
      return [];
    }
    
    const filtered = groups.filter(g => {
      // Skip the current group being edited
      if (g.id === editing?.id) {
        return false;
      }
      
      if (associationType === 'department') {
        // For department-level groups, show:
        // 1. All sector-level groups from the selected sector
        // 2. All department-level groups from the selected department
        
        // Check if it's a sector-level group from the same sector
        if (g.sector?.id === formSectorId && !g.department) {
          console.log('Including sector-level group:', g.name);
          return true;
        }
        
        // Check if it's a department-level group from the same department
        if (departmentId && g.department?.id === departmentId) {
          console.log('Including department-level group from same department:', g.name);
          return true;
        }
        
        console.log('Excluding group:', g.name);
        return false;
      } else {
        // For sector-level groups, only show other sector-level groups from the same sector
        if (g.sector?.id === formSectorId && !g.department) {
          console.log('Including sector-level group:', g.name);
          return true;
        }
        return false;
      }
    });
    
    console.log('Final filtered result:', filtered.map(g => g.name));
    return filtered;
  }, [associationType, formSectorId, departmentId, editing?.id, groups]);

  // Separate filtered groups by type for better organization
  const sectorLevelParents = useMemo(() => {
    return filteredParentGroups.filter(g => !g.department);
  }, [filteredParentGroups]);

  const departmentLevelParents = useMemo(() => {
    return filteredParentGroups.filter(g => g.department);
  }, [filteredParentGroups]);

  const loadDepartments = async () => {
    try {
      const res = await api.get('/api/departments/');
      setDepartments(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load departments');
    }
  };

  const loadSectors = async () => {
    try {
      const res = await api.get('/api/sectors/');
      setSectors(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load sectors');
    }
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const params: any = {};
      // Don't filter groups when loading for parent dropdown
      // Only use filters for the main table display
      if (false) { // Temporarily disable filtering
        if (departmentId) {
          params.department = departmentId;
        } else if (sectorId) {
          params.sector = sectorId;
        }
      }
      const res = await api.get('/api/indicator-groups', { params });
      console.log('API response groups:', res.data.length);
      setGroups(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadSectors();
    loadGroups();
  }, []);

  useEffect(() => {
    loadGroups();
  }, [departmentId, sectorId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formSectorId) {
      setError('Please select a sector');
      return;
    }

    if (associationType === 'department' && !departmentId) {
      setError('Please select a department for department-level groups');
      return;
    }
    
    try {
      const payload: any = { 
        name, 
        unit: unit || undefined,
        is_label: isLabel,
        display_order: displayOrder !== '' ? Number(displayOrder) : null,
        status: groupStatus || null,
        parent_id: parentId || null
      };
      
      if (associationType === 'department') {
        payload.department_id = departmentId;
        payload.sector_id = null;
      } else {
        payload.department_id = null;
        payload.sector_id = formSectorId;
      }
      
      if (editing) {
        await api.put(`/api/indicator-groups/${editing.id}/`, payload);
      } else {
        await api.post('/api/indicator-groups/', payload);
      }
      setName('');
      setUnit('');
      setIsLabel(false);
      setDisplayOrder('');
      setGroupStatus('');
      setParentId(null);
      setDepartmentId('');
      setSectorId('');
      setFormSectorId('');
      setAssociationType('department');
      setEditing(null);
      setShowForm(false);
      loadGroups();
    } catch (e: any) {
      const data = e?.response?.data;
      if (data) {
        if (data.display_order) {
          setError(`Display order ${displayOrder ? `"${displayOrder}" ` : ''}is already used by another group. Please choose a unique number.`);
        } else if (data.status) {
          setError('Invalid status selected. Please choose High, Medium, or Low.');
        } else if (data.detail) {
          setError(data.detail);
        } else {
          const fieldMessages = Object.entries(data)
            .map(([field, msgs]) => {
              const label = field === 'display_order' ? 'Display Order'
                          : field === 'status'        ? 'Status'
                          : field === 'name'          ? 'Name'
                          : field;
              const msg = Array.isArray(msgs) ? msgs[0] : msgs;
              return `${label}: ${msg}`;
            })
            .join(' | ');
          setError(fieldMessages || 'Save failed. Please try again.');
        }
      } else {
        setError('Save failed. Please check your connection and try again.');
      }
    }
  };

  const onEdit = (g: IndicatorGroup) => {
    setEditing(g);
    setName(g.name);
    setUnit(g.unit || '');
    setIsLabel(g.is_label || false);
    setDisplayOrder(g.display_order ?? '');
    setGroupStatus((g.status as any) || '');
    setParentId(g.parent_id || null);
    if (g.department) {
      setAssociationType('department');
      setDepartmentId(g.department.id);
      setFormSectorId(g.department.sector?.id || '');
      setSectorId('');
    } else if (g.sector) {
      setAssociationType('sector');
      setSectorId(g.sector.id);
      setFormSectorId(g.sector.id);
      setDepartmentId('');
    } else {
      setAssociationType('department');
      setDepartmentId('');
      setSectorId('');
      setFormSectorId('');
    }
    
    setShowForm(true);
  };

  const onDelete = async (g: IndicatorGroup) => {
    if (!confirm(`Delete group "${g.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/api/indicator-groups/${g.id}/`);
      loadGroups();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Delete failed');
    }
  };

  const resetForm = () => {
    setEditing(null);
    setName('');
    setUnit('');
    setIsLabel(false);
    setDisplayOrder('');
    setGroupStatus('');
    setParentId(null);
    setDepartmentId('');
    setSectorId('');
    setFormSectorId('');
    setAssociationType('department');
    setShowForm(false);
    setError(null);
  };

  // Filter groups based on search and department/sector filter
  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      const matchesSearch = searchQuery === '' || 
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.department?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.sector?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = departmentId === '' || 
        group.department?.id === departmentId;
      
      const matchesSector = sectorId === '' || 
        group.sector?.id === sectorId;
      
      return matchesSearch && (matchesDepartment || matchesSector);
    });
  }, [groups, searchQuery, departmentId, sectorId]);

  // Get group count by department and sector
  const groupCountByDepartment = useMemo(() => {
    return departments.reduce((acc, dept) => {
      acc[dept.id] = groups.filter(g => g.department?.id === dept.id).length;
      return acc;
    }, {} as Record<number, number>);
  }, [departments, groups]);
  
  const groupCountBySector = useMemo(() => {
    return sectors.reduce((acc, sector) => {
      acc[sector.id] = groups.filter(g => g.sector?.id === sector.id).length;
      return acc;
    }, {} as Record<number, number>);
  }, [sectors, groups]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Indicator Groups</h1>
              <p className="text-gray-600 mt-2">Organize indicators into meaningful groups by department or sector</p>
            </div>
            
            {isSuperuser && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                Add New Group
              </button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Groups</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{groups.length}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Layers className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Departments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{departments.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Building className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sectors</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{sectors.length}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <PieChart className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Filter</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {(departmentId || sectorId) ? 1 : 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(departmentId || sectorId) ? 'Filter applied' : 'No filter'}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Filter className="w-6 h-6 text-amber-600" />
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
                  placeholder="Search groups by name, department, or sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-64">
                  <div className="relative">
                    <select
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value ? Number(e.target.value) : '');
                        setSectorId(''); // Clear sector when department is selected
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm appearance-none"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({groupCountByDepartment[d.id] || 0})
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <Building className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
                
                <div className="w-64">
                  <div className="relative">
                    <select
                      value={sectorId}
                      onChange={(e) => {
                        setSectorId(e.target.value ? Number(e.target.value) : '');
                        setDepartmentId(''); // Clear department when sector is selected
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm appearance-none"
                    >
                      <option value="">All Sectors</option>
                      {sectors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({groupCountBySector[s.id] || 0})
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <PieChart className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={loadGroups}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchQuery || departmentId || sectorId) && (
              <div className="flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-800 text-sm rounded-full">
                    <Search className="w-3 h-3" />
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-purple-600 hover:text-purple-800 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {departmentId !== '' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-800 text-sm rounded-full">
                    <Building className="w-3 h-3" />
                    Department: {departments.find(d => d.id === departmentId)?.name}
                    <button
                      onClick={() => setDepartmentId('')}
                      className="text-purple-600 hover:text-purple-800 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {sectorId !== '' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                    <PieChart className="w-3 h-3" />
                    Sector: {sectors.find(s => s.id === sectorId)?.name}
                    <button
                      onClick={() => setSectorId('')}
                      className="text-emerald-600 hover:text-emerald-800 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Form */}
        {showForm && isSuperuser && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 shadow-lg p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${editing ? 'bg-yellow-100' : 'bg-purple-100'}`}>
                  {editing ? <Edit2 className="w-5 h-5 text-yellow-600" /> : <Plus className="w-5 h-5 text-purple-600" />}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {editing ? `Editing "${editing.name}"` : 'Create New Indicator Group'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {editing ? 'Update the group details below' : 'Organize indicators into meaningful groups'}
                  </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Layers className="inline w-4 h-4 mr-1" />
                    Group Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Productivity KPIs, Quality Metrics"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <PieChart className="inline w-4 h-4 mr-1" />
                    Sector *
                  </label>
                  <div className="relative">
                    <select
                      value={formSectorId}
                      onChange={(e) => {
                        const newSectorId = e.target.value ? Number(e.target.value) : '';
                        setFormSectorId(newSectorId);
                        // Clear department when sector changes
                        setDepartmentId('');
                        // Update association type based on whether we want department or sector level
                        if (newSectorId && associationType === 'department') {
                          // Keep as department type but wait for department selection
                        } else if (newSectorId) {
                          setSectorId(newSectorId);
                        } else {
                          setSectorId('');
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      required
                    >
                      <option value="">Select sector</option>
                      {sectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select the sector first</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Layers className="inline w-4 h-4 mr-1" />
                    Association Type *
                  </label>
                  <div className="relative">
                    <select
                      value={associationType}
                      onChange={(e) => {
                        const newType = e.target.value as 'department' | 'sector';
                        setAssociationType(newType);
                        setDepartmentId('');
                        if (newType === 'sector' && formSectorId) {
                          setSectorId(formSectorId);
                        } else {
                          setSectorId('');
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      required
                      disabled={!formSectorId}
                    >
                      <option value="sector">Sector Level Only</option>
                      <option value="department">Department Level</option>
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose whether this group belongs to the entire sector or a specific department within the sector
                  </p>
                </div>
                {associationType === 'department' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Building className="inline w-4 h-4 mr-1" />
                      Department *
                    </label>
                    <div className="relative">
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                        required
                      >
                        <option value="">Select department</option>
                        {departments
                          .filter(d => d.sector?.id === formSectorId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formSectorId 
                        ? `Select department from ${sectors.find(s => s.id === formSectorId)?.name}`
                        : 'Select a sector first'
                      }
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <PieChart className="inline w-4 h-4 mr-1" />
                      Sector Level Group
                    </label>
                    <div className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                      <p className="text-sm text-gray-700">
                        {formSectorId 
                          ? `This group will be associated with: ${sectors.find(s => s.id === formSectorId)?.name}`
                          : 'Select a sector first'
                        }
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This group will be associated with the entire sector</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Hash className="inline w-4 h-4 mr-1" />
                    Unit of Measurement
                  </label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Tons, Number, Percentage"
                  />
                  <p className="text-xs text-gray-500 mt-1">Unit for this group and its indicators (optional)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <ArrowUpDown className="inline w-4 h-4 mr-1" />
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g. 1, 2, 3 …"
                  />
                  <p className="text-xs text-gray-500 mt-1">Controls order in reports — must be unique</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Signal className="inline w-4 h-4 mr-1" />
                    Status
                  </label>
                  <select
                    value={groupStatus}
                    onChange={(e) => setGroupStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">— None —</option>
                    <option value="HIGH">High (Orange rows)</option>
                    <option value="MEDIUM">Medium (Green rows)</option>
                    <option value="LOW">Low (Grey rows)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Drives row colour in Excel export</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Layers className="inline w-4 h-4 mr-1" />
                    Parent Group
                  </label>
                  <div className="relative">
                    <select
                      value={parentId || ''}
                      onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      disabled={!formSectorId || (associationType === 'department' && !departmentId)}
                    >
                      <option value="">No Parent (Root Level)</option>
                      
                      {sectorLevelParents.length > 0 && (
                        <optgroup label="Sector Level Groups">
                          {sectorLevelParents.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.hierarchy_path}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      
                      {departmentLevelParents.length > 0 && associationType === 'department' && (
                        <optgroup label="Department Level Groups">
                          {departmentLevelParents.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.hierarchy_path} (Dept: {g.department?.name})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  
                  {/* Helper text showing what groups are available */}
                  <div className="mt-2 space-y-1">
                    {formSectorId && associationType === 'department' && departmentId && (
                      <p className="text-xs text-purple-600">
                        <span className="font-medium">Available parents:</span>
                        <br />
                        • All sector-level groups from {sectors.find(s => s.id === formSectorId)?.name}
                        <br />
                        • All department-level groups from {departments.find(d => d.id === departmentId)?.name}
                      </p>
                    )}
                    
                    {formSectorId && associationType === 'sector' && (
                      <p className="text-xs text-purple-600">
                        <span className="font-medium">Available parents:</span>
                        <br />
                        • All sector-level groups from {sectors.find(s => s.id === formSectorId)?.name}
                      </p>
                    )}
                    
                    {!formSectorId && (
                      <p className="text-xs text-amber-600">
                        Select a sector first to see available parent groups
                      </p>
                    )}
                    
                    {associationType === 'department' && !departmentId && formSectorId && (
                      <p className="text-xs text-amber-600">
                        Select a department to see department-level parent groups
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-3 text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLabel}
                      onChange={(e) => setIsLabel(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <span className="flex items-center gap-2">
                      <Layers className="inline w-4 h-4" />
                      Is Label
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-7">Whether this group is a section header</p>
                </div>
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Save className="w-5 h-5" />
                  {editing ? 'Update Group' : 'Create Group'}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Indicator Groups ({filteredGroups.length})
              </h3>
              <p className="text-sm text-gray-600">
                Showing {filteredGroups.length} of {groups.length} groups
                {(searchQuery || departmentId || sectorId) && ' (filtered)'}
              </p>
            </div>
            <div className="text-sm text-gray-600">
              Sorted by department/sector • {departments.length} departments, {sectors.length} sectors
            </div>
          </div>
        </div>

        {/* Groups Table/Cards */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Group</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Sector</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-gray-300 border-t-purple-600 rounded-full animate-spin"></div>
                        <p className="text-gray-600">Loading indicator groups...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Layers className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">
                          {groups.length === 0 ? 'No indicator groups created yet' : 'No groups match your filters'}
                        </p>
                        <p className="text-gray-500 text-sm">
                          {groups.length === 0
                            ? 'Start by creating your first indicator group'
                            : 'Try adjusting your search or filters'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((g) => (
                    <tr
                      key={g.id}
                      className="transition-colors duration-150 group"
                      style={{
                        backgroundColor:
                          g.status === 'HIGH'   ? '#FDF3E3' :
                          g.status === 'MEDIUM' ? '#EEF7E8' :
                          g.status === 'LOW'    ? '#F3F3F3' :
                          undefined
                      }}
                    >
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {g.display_order ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Layers className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{g.name}</p>
                            {g.unit && <p className="text-xs text-gray-500">Unit: {g.unit}</p>}
                            {g.parent && <p className="text-xs text-gray-500">Parent: {g.parent.name}</p>}
                            {g.is_label && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full mt-1">
                                <Layers className="w-3 h-3" />
                                Label
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {g.status ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: g.status === 'HIGH' ? '#F5CC94' : g.status === 'MEDIUM' ? '#52992F' : '#ADADAD',
                              color: g.status === 'MEDIUM' ? '#fff' : '#1a1a1a'
                            }}
                          >
                            {g.status === 'HIGH' ? 'High' : g.status === 'MEDIUM' ? 'Medium' : 'Low'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-100 rounded-md">
                            <Building className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-gray-700">{g.department?.name || 'No department'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-100 rounded-md">
                            <PieChart className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="text-gray-700">
                            {g.sector?.name || g.department?.sector?.name || 'No sector'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isSuperuser && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => onEdit(g)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                              title="Edit group"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(g)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors duration-200"
                              title="Delete group"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-600">Loading indicator groups...</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Layers className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">
                  {groups.length === 0 ? 'No indicator groups created yet' : 'No groups match your filters'}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {groups.length === 0 
                    ? 'Start by creating your first indicator group' 
                    : 'Try adjusting your search or filters'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredGroups.map((g) => (
                  <div
                  key={g.id}
                  className="p-4 transition-colors duration-150"
                  style={{
                    backgroundColor:
                      g.status === 'HIGH'   ? '#FDF3E3' :
                      g.status === 'MEDIUM' ? '#EEF7E8' :
                      g.status === 'LOW'    ? '#F3F3F3' :
                      undefined
                  }}
                >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Layers className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{g.name}</h4>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ID: {g.id}
                            </span>
                            {g.is_label && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                                <Layers className="w-3 h-3" />
                                Label
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSuperuser && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEdit(g)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                            title="Edit group"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(g)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors duration-200"
                            title="Delete group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700">{g.department?.name || 'No department'}</span>
                      </div>
                      {(g.sector?.name || g.department?.sector?.name) && (
                        <div className="flex items-center gap-2">
                          <PieChart className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700">
                            Sector: {g.sector?.name || g.department?.sector?.name}
                          </span>
                        </div>
                      )}
                      {g.unit && (
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700">Unit: {g.unit}</span>
                        </div>
                      )}
                      {g.parent && (
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700">Parent: {g.parent.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}