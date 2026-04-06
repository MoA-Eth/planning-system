import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
  id: number;
  username: string;
  role: string;
  sector: { id: number; name: string } | null;
  department: { id: number; name: string } | null;
}

interface Document {
  id: number;
  name: string;
  description: string;
  document_type: string;
  document_type_display: string;
  sector: number | null;
  sector_name: string;
  department: number | null;
  department_name: string;
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
  { value: 'NARRATIVE', label: 'Narrative' },
  { value: 'REPORT', label: 'Report' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'GUIDELINE', label: 'Guideline' },
  { value: 'PLAN', label: 'Plan' },
  { value: 'DIRECTIVE', label: 'Directive' },
  { value: 'CIRCULAR', label: 'Circular' },
  { value: 'OTHER', label: 'Other' },
];

const TYPE_COLORS: Record<string, string> = {
  REPORT: 'bg-blue-100 text-blue-700',
  POLICY: 'bg-purple-100 text-purple-700',
  GUIDELINE: 'bg-teal-100 text-teal-700',
  PLAN: 'bg-emerald-100 text-emerald-700',
  DIRECTIVE: 'bg-orange-100 text-orange-700',
  CIRCULAR: 'bg-pink-100 text-pink-700',
  OTHER: 'bg-gray-100 text-gray-600',
  NARRATIVE:'bg-teal-100 text-teal-700'
};

function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isDoc = ['doc', 'docx'].includes(ext);
  const isXls = ['xls', 'xlsx', 'csv'].includes(ext);

  if (isPdf) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM9.5 13.5c0 .8-.7 1.5-1.5 1.5H7v2H5.5v-5H8c.8 0 1.5.7 1.5 1.5v1Zm5 1c0 1.1-.9 2-2 2h-2v-5h2c1.1 0 2 .9 2 2v1Zm4-3h-3v1h2v1h-2v2H14v-5h4.5v1Z"/>
      </svg>
    );
  }
  if (isDoc) {
    return (
      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM7 17l2-6h1.5l2 6H11l-.4-1.2H9.4L9 17H7Zm2-2.3h1.6l-.8-2.5-.8 2.5Z"/>
      </svg>
    );
  }
  if (isXls) {
    return (
      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM7 17l2-3-2-3h1.7l1.3 2.2L11.3 11H13l-2 3 2 3h-1.7l-1.3-2.2L8.7 17H7Z"/>
      </svg>
    );
  }
  if (isImage) {
    return (
      <svg className="w-8 h-8 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 3H3v18h18V3Zm-2 16H5V5h14v14Zm-5-7-3 4-2-2.5L6 18h12l-4-6Z"/>
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5ZM8 13h8v1.5H8V13Zm0 3h5v1.5H8V16Zm0-6h3v1.5H8V10Z"/>
    </svg>
  );
}

export default function DocumentUpload() {
  const { user } = useAuth();
  const role = (user?.role || '').toUpperCase();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    document_type: 'OTHER',
    year: '',
    quarter: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
    api.get('/api/me/').then((res) => setUserProfile(res.data)).catch(() => {});
  }, [filterType]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterType) params.document_type = filterType;
      const res = await api.get('/api/documents/', { params });
      setDocuments(res.data.results ?? res.data);
    } catch {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (selected: File | null) => {
    if (!selected) return;
    const ext = selected.name.split('.').pop()?.toLowerCase() || '';
    if (!['doc', 'docx'].includes(ext)) {
      setError('Only Word documents (.doc, .docx) are allowed.');
      return;
    }
    setError('');
    setFile(selected);
    if (!form.name) {
      const baseName = selected.name.replace(/\.[^/.]+$/, '');
      setForm((f) => ({ ...f, name: baseName }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a file.'); return; }
    if (!form.name.trim()) { setError('Document name is required.'); return; }
    const isAdvisor = role === 'ADVISOR';
    if (!userProfile?.sector) {
      setError('Your account does not have a sector assigned. Please contact your administrator.');
      return;
    }
    if (!isAdvisor && !userProfile?.department) {
      setError('Your account does not have a department assigned. Please contact your administrator.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('name', form.name.trim());
    formData.append('description', form.description.trim());
    formData.append('document_type', form.document_type);
    if (form.year) formData.append('year', form.year);
    if (form.quarter) formData.append('quarter', form.quarter);
    formData.append('file', file);

    try {
      await api.post('/api/documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('Document uploaded successfully.');
      setForm({ name: '', description: '', document_type: 'OTHER', year: '', quarter: '' });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (err: any) {
      setError(err?.userMessage || 'Failed to upload document.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (doc: Document) => {
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
      setError('Failed to download document.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/documents/${id}/`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirm(null);
      setSuccess('Document deleted.');
    } catch {
      setError('Failed to delete document.');
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const formatSize = (file: File) => {
    const kb = file.size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Document Management</h1>
          <p className="text-sm text-gray-500 mt-1">Upload and manage official documents for distribution</p>
        </div>
        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
          {role === 'ADVISOR' ? 'Advisor' : 'Lead Executive Body'}
        </span>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/>
          </svg>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/>
          </svg>
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2h14v2H5v-2Z"/>
            </svg>
            Upload New Document
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Document Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Document Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter document name"
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
              />
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.document_type}
                onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Year + Quarter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ethiopian Year <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                placeholder="e.g. 2017"
                min={2000}
                max={2030}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Quarter <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={form.quarter}
                onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
              >
                <option value="">Select Quarter</option>
                <option value="Q1">Quarter 1</option>
                <option value="Q2">Quarter 2</option>
                <option value="Q3">Quarter 3</option>
                <option value="Q4">Quarter 4</option>
              </select>
            </div>
          </div>

          {/* Auto-assigned Sector & Department */}
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <p className="text-xs font-semibold text-indigo-600 mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>
              {role === 'ADVISOR' ? 'Sector auto-assigned from your profile' : 'Sector & Department auto-assigned from your profile'}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-500 font-medium">Sector:</span>
                {userProfile?.sector
                  ? <span className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-indigo-800">{userProfile.sector.name}</span>
                  : <span className="text-xs text-red-500 font-medium">Not assigned — contact admin</span>
                }
              </div>
              {role !== 'ADVISOR' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-500 font-medium">Department:</span>
                  {userProfile?.department
                    ? <span className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-indigo-800">{userProfile.department.name}</span>
                    : <span className="text-xs text-red-500 font-medium">Not assigned — contact admin</span>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the document..."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition resize-none"
            />
          </div>

          {/* File Drop Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              File <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-emerald-400 bg-emerald-50'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                accept=".doc,.docx"
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileIcon fileName={file.name} />
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(file)}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2h14v2H5v-2Z"/>
                  </svg>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-emerald-600">Click to browse</span> or drag & drop
                  </p>
                  <p className="text-xs text-gray-400">Word documents only (.doc, .docx)</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting || !file}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z"/>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2h14v2H5v-2Z"/>
                  </svg>
                  Upload Document
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5Z"/>
            </svg>
            Uploaded Documents
            <span className="text-xs font-normal text-gray-400 ml-1">({documents.length})</span>
          </h2>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-gray-600"
          >
            <option value="">All Types</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="w-6 h-6 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z"/>
            </svg>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5Z"/>
            </svg>
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {documents.map((doc) => (
              <li key={doc.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <FileIcon fileName={doc.file_name || doc.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 truncate">{doc.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${TYPE_COLORS[doc.document_type] || TYPE_COLORS.OTHER}`}>
                      {doc.document_type_display}
                    </span>
                    {doc.sector_name && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{doc.sector_name}</span>
                    )}
                    {doc.department_name && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100">{doc.department_name}</span>
                    )}
                    {doc.year && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">EY {doc.year}</span>
                    )}
                    {doc.quarter && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-100">{doc.quarter_display ?? doc.quarter}</span>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-xs text-gray-500 mb-1.5 line-clamp-2">{doc.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 1.5L18.5 9H13V3.5Z"/>
                      </svg>
                      {doc.file_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V8h14v11Z"/>
                      </svg>
                      {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 20h14v-2H5v2Zm7-18v12.17l4.59-4.58L18 11l-6 6-6-6 1.41-1.41L11 14.17V2h2Z"/>
                    </svg>
                    Download
                  </button>
                  {deleteConfirm === doc.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(doc.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/>
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
