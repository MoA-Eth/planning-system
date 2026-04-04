import { useEffect, useMemo, useState, Fragment } from 'react';
import api from '../lib/api';
import {
  Search,
  Filter,
  Calendar,
  Building,
  Layers,
  User,
  Clock,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Download,
  RefreshCw,
 
  Activity,
  Shield
} from 'lucide-react';

type ActivityItem = {
  type: 'BREAKDOWN' | 'PERFORMANCE' | 'ADMIN_EDIT';
  action: string;
  by: string | null;
  at: string;
  status: string;
  indicator: string;
  sector: string | null;
  department: string | null;
  comment: string;
};

type FilterState = {
  type: 'ALL' | 'BREAKDOWN' | 'PERFORMANCE' | 'ADMIN_EDIT';
  action: string;
  status: string;
  search: string;
  dateRange: 'today' | 'week' | 'month' | 'all';
};

export default function ActivityLogs() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const pageSize = 15;

  const [filters, setFilters] = useState<FilterState>({
    type: 'ALL',
    action: '',
    status: '',
    search: '',
    dateRange: 'week'
  });

  const loadData = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await api.get('/api/activity-logs/');
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load activity logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, items.length]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  );

  const filteredItems = useMemo(() => {
    let result = [...items];
    
    // Apply type filter
    if (filters.type !== 'ALL') {
      result = result.filter(item => item.type === filters.type);
    }
    
    // Apply action filter
    if (filters.action) {
      result = result.filter(item => 
        item.action.toLowerCase().includes(filters.action.toLowerCase())
      );
    }
    
    // Apply status filter
    if (filters.status) {
      result = result.filter(item => 
        item.status.toLowerCase().includes(filters.status.toLowerCase())
      );
    }
    
    // Apply date range filter
    const now = new Date();
    const cutoff = new Date();
    
    switch (filters.dateRange) {
      case 'today':
        cutoff.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case 'all':
        // No date filtering
        break;
    }
    
    if (filters.dateRange !== 'all') {
      result = result.filter(item => {
        const itemDate = new Date(item.at);
        return itemDate >= cutoff;
      });
    }
    
    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(item => 
        item.indicator.toLowerCase().includes(searchTerm) ||
        (item.sector && item.sector.toLowerCase().includes(searchTerm)) ||
        (item.department && item.department.toLowerCase().includes(searchTerm)) ||
        (item.by && item.by.toLowerCase().includes(searchTerm)) ||
        item.comment.toLowerCase().includes(searchTerm)
      );
    }
    
    return result;
  }, [items, filters]);

  const paged = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [filteredItems, page, pageSize]
  );

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const breakdowns = items.filter(item => item.type === 'BREAKDOWN');
    const performances = items.filter(item => item.type === 'PERFORMANCE');
    const adminEdits = items.filter(item => item.type === 'ADMIN_EDIT');
    
    const todayActivities = items.filter(item => {
      const itemDate = new Date(item.at);
      return itemDate >= today;
    });
    
    const approvals = items.filter(item => 
      item.status.toUpperCase().includes('APPROVED') || 
      item.status.toUpperCase().includes('VALIDATED')
    ).length;
    
    const rejections = items.filter(item => 
      item.status.toUpperCase().includes('REJECTED')
    ).length;
    
    return {
      total: items.length,
      today: todayActivities.length,
      breakdowns: breakdowns.length,
      performances: performances.length,
      adminEdits: adminEdits.length,
      approvals,
      rejections,
      approvalRate: items.length > 0 ? Math.round((approvals / items.length) * 100) : 0
    };
  }, [items]);

  const getStatusColor = (status: string) => {
    const upperStatus = status.toUpperCase();
    if (upperStatus.includes('APPROVED') || upperStatus.includes('VALIDATED')) {
      return 'bg-emerald-100 text-emerald-800';
    } else if (upperStatus.includes('REJECTED')) {
      return 'bg-red-100 text-red-800';
    } else if (upperStatus.includes('SUBMITTED')) {
      return 'bg-blue-100 text-blue-800';
    } else if (upperStatus.includes('PENDING')) {
      return 'bg-amber-100 text-amber-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (type: string, action: string) => {
    if (type === 'ADMIN_EDIT') {
      return <Shield className="w-4 h-4 text-amber-500" />;
    }
    if (action.toLowerCase().includes('approve') || action.toLowerCase().includes('validate')) {
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    } else if (action.toLowerCase().includes('reject')) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    } else if (action.toLowerCase().includes('submit')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    
    return type === 'BREAKDOWN' 
      ? <FileText className="w-4 h-4 text-blue-500" />
      : <TrendingUp className="w-4 h-4 text-purple-500" />;
  };

  const resetFilters = () => {
    setFilters({
      type: 'ALL',
      action: '',
      status: '',
      search: '',
      dateRange: 'week'
    });
  };

  const hasActiveFilters = filters.type !== 'ALL' || filters.action || filters.status || filters.search || filters.dateRange !== 'week';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
              <p className="text-gray-600 mt-2">
                Track all system activities including approvals, validations, rejections, and submissions
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
                  <p className="text-sm font-medium text-gray-600">Total Activities</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.today} today
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Breakdowns</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.breakdowns}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.performances} performances
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approvals</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.approvals}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.approvalRate}% approval rate
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejections</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.rejections}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Quality control
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-600" />
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
                  placeholder="Search activities by indicator, department, user, or comment..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
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
                      {[
                        filters.type !== 'ALL',
                        filters.action,
                        filters.status,
                        filters.search,
                        filters.dateRange !== 'week'
                      ].filter(Boolean).length}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Filter Activities</h3>
                  <p className="text-sm text-gray-600">Refine your view by selecting specific criteria</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Activity Type
                    </label>
                    <div className="relative">
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters({...filters, type: e.target.value as any})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      >
                        <option value="ALL">All Types</option>
                        <option value="BREAKDOWN">Quarterly Breakdowns</option>
                        <option value="PERFORMANCE">Performance Reports</option>
                        <option value="ADMIN_EDIT">Admin Edits</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Action
                    </label>
                    <input
                      type="text"
                      placeholder="Filter by action..."
                      value={filters.action}
                      onChange={(e) => setFilters({...filters, action: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                      >
                        <option value="">All Status</option>
                        <option value="APPROVED">Approved</option>
                        <option value="VALIDATED">Validated</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="SUBMITTED">Submitted</option>
                        <option value="PENDING">Pending</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Date Range Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="inline w-4 h-4 mr-1" />
                      Date Range
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['today', 'week', 'month', 'all'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setFilters({...filters, dateRange: range})}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            filters.dateRange === range
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {range.charAt(0).toUpperCase() + range.slice(1)}
                        </button>
                      ))}
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

        {/* Activity Log Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">System Activities</h3>
                <p className="text-sm text-gray-600">
                  Showing {paged.length} of {filteredItems.length} activities
                  {hasActiveFilters && ' (filtered)'}
                </p>
              </div>
              <div className="text-sm text-gray-600">
                {filteredItems.length} total • {stats.today} today
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-800">Active Filters:</span>
                  <div className="flex flex-wrap gap-2">
                    {filters.type !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Type: {filters.type === 'BREAKDOWN' ? 'Breakdowns' : 'Performance'}
                        <button
                          onClick={() => setFilters({...filters, type: 'ALL'})}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {filters.action && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Action: {filters.action}
                        <button
                          onClick={() => setFilters({...filters, action: ''})}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {filters.status && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Status: {filters.status}
                        <button
                          onClick={() => setFilters({...filters, status: ''})}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {filters.dateRange !== 'week' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Date: {filters.dateRange.charAt(0).toUpperCase() + filters.dateRange.slice(1)}
                        <button
                          onClick={() => setFilters({...filters, dateRange: 'week'})}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {filters.search && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Search: "{filters.search}"
                        <button
                          onClick={() => setFilters({...filters, search: ''})}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600">Loading activity logs...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Activity className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {items.length === 0 ? 'No activity logs available yet' : 'No activities match your filters'}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {items.length === 0 
                  ? 'System activities will appear here once they occur' 
                  : 'Try adjusting or clearing your filters'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Context</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paged.map((item, idx) => {
                    const globalIdx = (page - 1) * pageSize + idx;
                    const isExpanded = expandedRow === globalIdx;
                    
                    return (
                      <Fragment key={globalIdx}>
                        <tr 
                          className={`hover:bg-gray-50 transition-colors duration-150 cursor-pointer ${
                            isExpanded ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setExpandedRow(isExpanded ? null : globalIdx)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {getActionIcon(item.type, item.action)}
                              <div>
                                <div className="font-medium text-gray-900">
                                  {item.type === 'BREAKDOWN' ? 'Quarterly Breakdown' : item.type === 'ADMIN_EDIT' ? 'Admin Override' : 'Performance Report'}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">{item.action}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{item.by || 'System'}</div>
                                <div className="text-xs text-gray-500">User</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="max-w-xs">
                              <div className="font-medium text-gray-900 truncate">{item.indicator}</div>
                              <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                {item.sector && (
                                  <span className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    {item.sector}
                                  </span>
                                )}
                                {item.department && (
                                  <span className="flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    {item.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-900">{formatDate(item.at)}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(item.at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <ChevronRight 
                              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          </td>
                        </tr>
                        
                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="pl-10 space-y-3">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 mb-2">Details</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500">Full Indicator</p>
                                      <p className="text-sm text-gray-900">{item.indicator}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Activity Type</p>
                                      <p className="text-sm text-gray-900">{item.type}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Sector</p>
                                      <p className="text-sm text-gray-900">{item.sector || '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Department</p>
                                      <p className="text-sm text-gray-900">{item.department || '—'}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                {item.comment && (
                                  <div>
                                    <p className="text-xs text-gray-500">Comment / Note</p>
                                    <p className="text-sm text-gray-900 bg-white p-3 rounded-lg mt-1 border border-gray-200">
                                      {item.comment}
                                    </p>
                                  </div>
                                )}
                                
                                <div className="text-xs text-gray-500">
                                  Full timestamp: {new Date(item.at).toLocaleString()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredItems.length > 0 && !loading && (
          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredItems.length)} of {filteredItems.length} activities
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                  page === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-200 ${
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {totalPages > 5 && page < totalPages - 2 && (
                  <>
                    <span className="px-2 text-gray-500">...</span>
                    <button
                      onClick={() => setPage(totalPages)}
                      className="w-10 h-10 flex items-center justify-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                  page === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats Footer */}
        <div className="mt-6 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Activities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.approvals}</div>
              <div className="text-sm text-gray-600">Approvals & Validations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.rejections}</div>
              <div className="text-sm text-gray-600">Rejections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.adminEdits}</div>
              <div className="text-sm text-gray-600">Admin Overrides</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}