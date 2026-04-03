import { useEffect, useState } from 'react';
import api from '../lib/api';
import documentBg from '../assets/document.jpg';

interface Sector {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  sector: number;
}

interface Document {
  id: number;
  name: string;
  description: string;
  document_type: string;
  document_type_display: string;
  sector: number | null;
  sector_name: string | null;
  department: number | null;
  department_name: string | null;
  year: number | null;
  quarter: string | null;
  quarter_display: string | null;
  file: string;
  file_url: string;
  file_name: string;
  uploaded_by: number;
  uploaded_by_username: string;
  uploaded_at: string;
}

const DOCUMENT_TYPES = [
  { value: 'NARATIVE', label: 'Narative', icon: '📝', color: 'indigo' },
  { value: 'REPORT', label: 'Report', icon: '📊', color: 'blue' },
  { value: 'POLICY', label: 'Policy', icon: '📋', color: 'purple' },
  { value: 'GUIDELINE', label: 'Guideline', icon: '📖', color: 'teal' },
  { value: 'PLAN', label: 'Plan', icon: '🎯', color: 'emerald' },
  { value: 'DIRECTIVE', label: 'Directive', icon: '⚡', color: 'orange' },
  { value: 'CIRCULAR', label: 'Circular', icon: '🔄', color: 'pink' },
  { value: 'OTHER', label: 'Other', icon: '📄', color: 'gray' },
];

const TYPE_COLORS: Record<string, string> = {
  REPORT: 'bg-blue-50 text-blue-700 border-blue-200',
  NARATIVE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  POLICY: 'bg-purple-50 text-purple-700 border-purple-200',
  GUIDELINE: 'bg-teal-50 text-teal-700 border-teal-200',
  PLAN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DIRECTIVE: 'bg-orange-50 text-orange-700 border-orange-200',
  CIRCULAR: 'bg-pink-50 text-pink-700 border-pink-200',
  OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
};

const QUARTERS = [
  { value: 'Q1', label: 'Quarter 1', period: 'Jan - Mar' },
  { value: 'Q2', label: 'Quarter 2', period: 'Apr - Jun' },
  { value: 'Q3', label: 'Quarter 3', period: 'Jul - Sep' },
  { value: 'Q4', label: 'Quarter 4', period: 'Oct - Dec' },
];

function FileIcon({ fileName }: { fileName: string }) {
  const ext = (fileName?.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isDoc = ['doc', 'docx'].includes(ext);
  const isXls = ['xls', 'xlsx', 'csv'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

  if (isPdf) return (
    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
      <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM9.5 13.5c0 .8-.7 1.5-1.5 1.5H7v2H5.5v-5H8c.8 0 1.5.7 1.5 1.5v1Zm5 1c0 1.1-.9 2-2 2h-2v-5h2c1.1 0 2 .9 2 2v1Zm4-3h-3v1h2v1h-2v2H14v-5h4.5v1Z"/>
      </svg>
    </div>
  );
  if (isDoc) return (
    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM7 17l2-6h1.5l2 6H11l-.4-1.2H9.4L9 17H7Zm2-2.3h1.6l-.8-2.5-.8 2.5Z"/>
      </svg>
    </div>
  );
  if (isXls) return (
    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM7 17l2-3-2-3h1.7l1.3 2.2L11.3 11H13l-2 3 2 3h-1.7l-1.3-2.2L8.7 17H7Z"/>
      </svg>
    </div>
  );
  if (isImage) return (
    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
      <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 3H3v18h18V3Zm-2 16H5V5h14v14Zm-5-7-3 4-2-2.5L6 18h12l-4-6Z"/>
      </svg>
    </div>
  );
  return (
    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
      <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM8 13h8v1.5H8V13Zm0 3h5v1.5H8V16Zm0-6h3v1.5H8V10Z"/>
      </svg>
    </div>
  );
}

export default function DocumentsView() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userSectorId, setUserSectorId] = useState<string>('');
  const [filterSector, setFilterSector] = useState<string>('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [deptOptions, setDeptOptions] = useState<Department[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');

  const isAdminRole = ['EXECUTIVE', 'STRATEGIC_STAFF'].includes(userRole);

  useEffect(() => {
    api.get('/api/me/').then((res) => {
      const role = res.data.role || '';
      setUserRole(role);
      const sid = res.data.sector?.id;
      if (sid) setUserSectorId(String(sid));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAdminRole) {
      api.get('/api/sectors/').then((res) => setSectors(res.data.results ?? res.data)).catch(() => {});
    }
  }, [userRole]);

  useEffect(() => {
    if (!isAdminRole) return;
    if (filterSector) {
      api.get('/api/departments/', { params: { sector: filterSector } })
        .then((res) => setDeptOptions(res.data.results ?? res.data))
        .catch(() => setDeptOptions([]));
    } else {
      setDeptOptions([]);
      setFilterDept('');
    }
  }, [filterSector, userRole]);

  useEffect(() => {
    if (isAdminRole) return;
    if (userSectorId) {
      api.get('/api/departments/', { params: { sector: userSectorId } })
        .then((res) => setDeptOptions(res.data.results ?? res.data))
        .catch(() => setDeptOptions([]));
    }
  }, [userSectorId, userRole]);

  useEffect(() => { fetchDocuments(); }, [filterType, filterSector, filterDept, filterYear, filterQuarter]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filterType) params.document_type = filterType;
      if (filterSector && isAdminRole) params.sector = filterSector;
      if (filterDept) params.department = filterDept;
      if (filterYear) params.year = filterYear;
      if (filterQuarter) params.quarter = filterQuarter;
      const res = await api.get('/api/documents/', { params });
      setDocuments(res.data.results ?? res.data);
    } catch {
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    setDownloading(doc.id);
    try {
      const relativePath = doc.file_url.replace(/^https?:\/\/[^/]+/, '');
      const res = await api.get(relativePath, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const getSortedDocuments = () => {
    const filtered = documents.filter((d) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.document_type_display.toLowerCase().includes(q) ||
        d.uploaded_by_username.toLowerCase().includes(q)
      );
    });

    switch (sortBy) {
      case 'name':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      case 'type':
        return [...filtered].sort((a, b) => a.document_type.localeCompare(b.document_type));
      case 'date':
      default:
        return [...filtered].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    }
  };

  const sortedDocuments = getSortedDocuments();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const countByType = (type: string) => documents.filter((d) => d.document_type === type).length;

  const years = Array.from({ length: 16 }, (_, i) => 2010 + i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Document Library
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Access and download official documents from the Lead Executive Body and Advisors
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 5h2v2H3V5Zm4 0h14v2H7V5Zm-4 6h2v2H3v-2Zm4 0h14v2H7v-2Zm-4 6h2v2H3v-2Zm4 0h14v2H7v-2Z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-800">{documents.length}</p>
          </div>
          {DOCUMENT_TYPES.slice(0, 6).map((type) => (
            <div key={type.value} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{type.icon} {type.label}</p>
              <p className={`text-xl font-bold text-${type.color}-600`}>{countByType(type.value)}</p>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, description, type, or author..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Document Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">All Types</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">All Years</option>
                  {years.map((y) => (
                    <option key={y} value={String(y)}>EY {y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Quarter</label>
                <select
                  value={filterQuarter}
                  onChange={(e) => setFilterQuarter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">All Quarters</option>
                  {QUARTERS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="date">Latest First</option>
                  <option value="name">Name A-Z</option>
                  <option value="type">Type</option>
                </select>
              </div>
            </div>

            {isAdminRole && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Sector</label>
                  <select
                    value={filterSector}
                    onChange={(e) => { setFilterSector(e.target.value); setFilterDept(''); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">All Sectors</option>
                    {sectors.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Department</label>
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    disabled={!filterSector || deptOptions.length === 0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Departments</option>
                    {deptOptions.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {(filterType || filterYear || filterQuarter || filterSector || filterDept) && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {
                    setFilterType('');
                    setFilterYear('');
                    setFilterQuarter('');
                    setFilterSector('');
                    setFilterDept('');
                    setSearch('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/>
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin border-t-emerald-500"></div>
            </div>
            <p className="mt-4 text-sm text-gray-500">Loading documents...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && sortedDocuments.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5Z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {search || filterType ? 'Try adjusting your search or filters' : 'No documents have been uploaded yet'}
            </p>
            {(search || filterType) && (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterType('');
                  setFilterYear('');
                  setFilterQuarter('');
                }}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Document Grid */}
        {!loading && sortedDocuments.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Card thumbnail */}
                <div
                  className="relative h-32 overflow-hidden"
                  style={{
                    backgroundImage: `url(${documentBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
                  <div className="absolute bottom-3 left-3">
                    <FileIcon fileName={doc.file_name || doc.name} />
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${TYPE_COLORS[doc.document_type] || TYPE_COLORS.OTHER} bg-white/90`}>
                      {doc.document_type_display}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  
                  <h3 className="text-base font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                    {doc.name}
                  </h3>
                  
                  {doc.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{doc.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {doc.sector_name && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                        {doc.sector_name}
                      </span>
                    )}
                    {doc.department_name && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700">
                        {doc.department_name}
                      </span>
                    )}
                    {doc.year && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700">
                        EY {doc.year}
                      </span>
                    )}
                    {doc.quarter && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-cyan-50 text-cyan-700">
                        {doc.quarter_display ?? doc.quarter}
                      </span>
                    )}
                  </div>
                  
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        <span>{doc.uploaded_by_username}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                        </svg>
                        <span>{formatDate(doc.uploaded_at)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-emerald-400 disabled:to-emerald-400 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
                    >
                      {downloading === doc.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Downloading...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 20h14v-2H5v2zm7-18v12.17l4.59-4.58L18 11l-6 6-6-6 1.41-1.41L11 14.17V2h2z"/>
                          </svg>
                          Download
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Document List */}
        {!loading && sortedDocuments.length > 0 && viewMode === 'list' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {sortedDocuments.map((doc) => (
                <div key={doc.id} className="p-5 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-start gap-4">
                    <FileIcon fileName={doc.file_name || doc.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <h3 className="text-base font-semibold text-gray-800 group-hover:text-emerald-600 transition-colors">
                          {doc.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${TYPE_COLORS[doc.document_type] || TYPE_COLORS.OTHER}`}>
                          {doc.document_type_display}
                        </span>
                      </div>
                      
                      {doc.description && (
                        <p className="text-sm text-gray-500 mb-2">{doc.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mb-2">
                        {doc.sector_name && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                            {doc.sector_name}
                          </span>
                        )}
                        {doc.department_name && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700">
                            {doc.department_name}
                          </span>
                        )}
                        {doc.year && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700">
                            EY {doc.year}
                          </span>
                        )}
                        {doc.quarter && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-cyan-50 text-cyan-700">
                            {doc.quarter_display ?? doc.quarter}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                          {doc.uploaded_by_username}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                          </svg>
                          {formatDate(doc.uploaded_at)}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                          </svg>
                          <span className="truncate">{doc.file_name}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                      {downloading === doc.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 20h14v-2H5v2zm7-18v12.17l4.59-4.58L18 11l-6 6-6-6 1.41-1.41L11 14.17V2h2z"/>
                          </svg>
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}