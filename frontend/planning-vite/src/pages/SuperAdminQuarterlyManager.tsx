import { useEffect, useState, useRef } from 'react';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Sector = { id: number; name: string };
type Department = { id: number; name: string; sector: number };
type IndicatorGroup = { id: number; name: string; department: number | null };
type Indicator = {
  id: number;
  name: string;
  department: number;
  groups: { id: number; name: string }[];
};

type QuarterCell = {
  applicable: boolean;
  plan: {
    breakdown_id: number;
    value: string | null;
    status: string | null;
  } | null;
  performance: {
    id: number;
    value: string | null;
    status: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    validated_at: string | null;
    final_approved_at: string | null;
  } | null;
};

type QuarterlyData = {
  indicator: {
    id: number;
    name: string;
    unit: string;
    group_name: string | null;
    department: string;
    sector: string;
    applicable_quarters: number[];
  };
  annual_plan: { id: number | null; target: string | null; year: number };
  breakdown: { id: number; status: string } | null;
  quarters: { q1: QuarterCell; q2: QuarterCell; q3: QuarterCell; q4: QuarterCell };
};

type EditTarget = {
  quarter: number;
  type: 'plan_value' | 'plan_status' | 'performance_value' | 'performance_status';
  currentValue: string;
  breakdownId?: number;
  performanceId?: number;
};

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'VALIDATED', 'FINAL_APPROVED', 'REJECTED'];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  VALIDATED: 'bg-teal-100 text-teal-700 border-teal-200',
  FINAL_APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  VALIDATED: 'Validated',
  FINAL_APPROVED: 'Final Approved',
  REJECTED: 'Rejected',
};

// ─── Helper Components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs italic">—</span>;
  const cls = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ValueDisplay({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined || value === '')
    return <span className="text-gray-400 text-xs italic">N/A</span>;
  return <span className="font-mono text-sm font-semibold text-gray-800">{parseFloat(value).toLocaleString()}</span>;
}

// ─── SearchableSelect ──────────────────────────────────────────────────────────

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  getLabel,
  getValue,
}: {
  options: any[];
  value: string | number | null;
  onChange: (v: string | number | null) => void;
  placeholder: string;
  disabled?: boolean;
  getLabel: (o: any) => string;
  getValue: (o: any) => string | number;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => getValue(o) === value);
  const filtered = options.filter((o) =>
    getLabel(o).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all
          ${disabled
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 hover:border-emerald-400 focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer'
          }`}
      >
        <span className={selected ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[400px] max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto overflow-x-auto">
            {value !== null && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 italic whitespace-nowrap"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">No results</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={getValue(o)}
                  type="button"
                  onClick={() => { onChange(getValue(o)); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 hover:text-emerald-800 transition-colors whitespace-nowrap
                    ${getValue(o) === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                >
                  {getLabel(o)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  target,
  onClose,
  onSave,
  saving,
}: {
  target: EditTarget;
  onClose: () => void;
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [val, setVal] = useState(target.currentValue || '');
  const isStatus = target.type === 'plan_status' || target.type === 'performance_status';
  const isValue = target.type === 'plan_value' || target.type === 'performance_value';

  const typeLabel: Record<EditTarget['type'], string> = {
    plan_value: 'Plan Value',
    plan_status: 'Plan Status',
    performance_value: 'Performance Value',
    performance_status: 'Performance Status',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">Edit Q{target.quarter}</h3>
            <p className="text-emerald-100 text-sm">{typeLabel[target.type]}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-2">
            <p className="text-sm text-gray-500 mb-1">Current value</p>
            <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              {isStatus
                ? <StatusBadge status={target.currentValue || null} />
                : <ValueDisplay value={target.currentValue} />
              }
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New {isStatus ? 'Status' : 'Value'}
            </label>
            {isStatus ? (
              <select
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white shadow-sm"
              >
                <option value="">— Select status —</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder="Enter numeric value…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 shadow-sm"
              />
            )}
          </div>

          {isValue && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2 items-start">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              Changing a plan value does not auto-recalculate the annual target. Ensure values remain consistent.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(val)}
            disabled={saving || !val}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SuperAdminQuarterlyManager() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<IndicatorGroup[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [quarterlyData, setQuarterlyData] = useState<QuarterlyData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => currentYear - 3 + i);

  // ── Load sectors on mount ──
  useEffect(() => {
    api.get('/api/sectors/').then((r) => setSectors(r.data?.results ?? r.data ?? []));
  }, []);

  // ── Load departments when sector changes ──
  useEffect(() => {
    setSelectedDept(null);
    setSelectedGroup(null);
    setSelectedIndicator(null);
    setQuarterlyData(null);
    setDepartments([]);
    setGroups([]);
    setIndicators([]);
    if (!selectedSector) return;
    api.get(`/api/departments/?sector=${selectedSector}`).then((r) =>
      setDepartments(r.data?.results ?? r.data ?? [])
    );
  }, [selectedSector]);

  // ── Load groups + indicators when department changes ──
  useEffect(() => {
    setSelectedGroup(null);
    setSelectedIndicator(null);
    setQuarterlyData(null);
    setGroups([]);
    setIndicators([]);
    if (!selectedDept) return;
    Promise.all([
      api.get(`/api/indicator-groups/?department=${selectedDept}`),
      api.get(`/api/indicators/?department=${selectedDept}`),
    ]).then(([gRes, iRes]) => {
      setGroups(gRes.data?.results ?? gRes.data ?? []);
      setIndicators(iRes.data?.results ?? iRes.data ?? []);
    });
  }, [selectedDept]);

  // ── Re-filter indicators when group changes ──
  useEffect(() => {
    setSelectedIndicator(null);
    setQuarterlyData(null);
  }, [selectedGroup]);

  // ── Fetch quarterly data when indicator+year selected ──
  useEffect(() => {
    if (!selectedIndicator) { setQuarterlyData(null); return; }
    setLoadingData(true);
    setDataError(null);
    api
      .get(`/api/superadmin/quarterly-data/?indicator=${selectedIndicator}&year=${selectedYear}`)
      .then((r) => setQuarterlyData(r.data))
      .catch((e) => setDataError(e?.response?.data?.detail || 'Failed to load data'))
      .finally(() => setLoadingData(false));
  }, [selectedIndicator, selectedYear]);

  // ── Filtered indicators by selected group ──
  const filteredIndicators = selectedGroup
    ? indicators.filter((ind) => ind.groups?.some((g) => g.id === selectedGroup))
    : indicators;

  const indicatorOptions = filteredIndicators.map((ind) => {
    const groupName = ind.groups?.[0]?.name;
    return {
      ...ind,
      label: groupName ? `${ind.name} [${groupName}]` : ind.name,
    };
  });

  // ── Handle save ──
  const handleSave = async (newValue: string) => {
    if (!editTarget) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const payload: Record<string, any> = {
        type: editTarget.type,
        quarter: editTarget.quarter,
        value: newValue,
        year: selectedYear,
      };
      if (editTarget.breakdownId) payload.breakdown_id = editTarget.breakdownId;
      if (editTarget.performanceId) payload.performance_id = editTarget.performanceId;

      const res = await api.post('/api/superadmin/update-quarterly/', payload);
      setSaveSuccess(res.data?.detail || 'Updated successfully.');
      setEditTarget(null);
      // Refresh the data
      const refreshed = await api.get(
        `/api/superadmin/quarterly-data/?indicator=${selectedIndicator}&year=${selectedYear}`
      );
      setQuarterlyData(refreshed.data);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (
    quarter: number,
    type: EditTarget['type'],
    currentValue: string,
    breakdownId?: number,
    performanceId?: number
  ) => {
    setSaveError(null);
    setEditTarget({ quarter, type, currentValue, breakdownId, performanceId });
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const quarters: Array<{ key: keyof QuarterlyData['quarters']; label: string; num: number }> = [
    { key: 'q1', label: 'Q1', num: 1 },
    { key: 'q2', label: 'Q2', num: 2 },
    { key: 'q3', label: 'Q3', num: 3 },
    { key: 'q4', label: 'Q4', num: 4 },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h18v14H7l-4 4V3Zm4 6h10V7H7v2Zm0 4h6v-2H7v2Z" />
              </svg>
            </span>
            Quarterly Data Manager
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 ml-11">View and override quarterly plan &amp; performance values for any indicator</p>
        </div>
        <div className="flex items-center gap-2 ml-11 sm:ml-0">
          <span className="px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            SuperAdmin Only
          </span>
        </div>
      </div>

      {/* Toast Notifications */}
      {saveSuccess && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l7.5 4.5-7.5 4.5z" />
          </svg>
          <span className="font-medium">{saveSuccess}</span>
          <span className="text-xs text-emerald-500 ml-1">All changes are logged to the activity log.</span>
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 13h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span className="font-medium">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      )}

      {/* Filters Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 flex items-center gap-2 rounded-t-2xl">
          <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.25 5.61C6.57 8.59 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.43-4.41 5.75-7.39c.51-.66.04-1.61-.79-1.61H5.04c-.83 0-1.3.95-.79 1.61z" />
          </svg>
          <h2 className="font-semibold text-gray-800 text-sm">Filter & Select Indicator</h2>
        </div>

        <div className="p-6">
          {/* Row 1: Sector + Department + Group */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Sector <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={sectors}
                value={selectedSector}
                onChange={(v) => setSelectedSector(v as number | null)}
                placeholder="Select sector…"
                getLabel={(o) => o.name}
                getValue={(o) => o.id}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Department <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={departments}
                value={selectedDept}
                onChange={(v) => setSelectedDept(v as number | null)}
                placeholder={selectedSector ? 'Select department…' : 'Select sector first'}
                disabled={!selectedSector}
                getLabel={(o) => o.name}
                getValue={(o) => o.id}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Indicator Group <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <SearchableSelect
                options={groups}
                value={selectedGroup}
                onChange={(v) => setSelectedGroup(v as number | null)}
                placeholder={selectedDept ? 'Filter by group…' : 'Select department first'}
                disabled={!selectedDept}
                getLabel={(o) => o.name}
                getValue={(o) => o.id}
              />
            </div>
          </div>

          {/* Row 2: Indicator + Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Indicator <span className="text-red-500">*</span>
                {filteredIndicators.length > 0 && (
                  <span className="ml-2 text-[10px] normal-case font-normal bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">
                    {filteredIndicators.length} available
                  </span>
                )}
              </label>
              <SearchableSelect
                options={indicatorOptions}
                value={selectedIndicator}
                onChange={(v) => setSelectedIndicator(v as number | null)}
                placeholder={selectedDept ? 'Search indicators…' : 'Select department first'}
                disabled={!selectedDept}
                getLabel={(o) => o.label}
                getValue={(o) => o.id}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white shadow-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {loadingData && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading quarterly data…</p>
        </div>
      )}

      {dataError && !loadingData && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
          <svg className="w-10 h-10 text-red-300 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 13h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <p className="text-red-600 font-medium">{dataError}</p>
        </div>
      )}

      {!loadingData && !dataError && quarterlyData && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table Header Info */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900 text-base">
                  {quarterlyData.indicator.name}
                  {quarterlyData.indicator.group_name && (
                    <span className="ml-2 text-sm font-normal text-emerald-600">[{quarterlyData.indicator.group_name}]</span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2 2 12h3v8h6v-5h2v5h6v-8h3L12 2Z" /></svg>
                    {quarterlyData.indicator.sector}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3h18v4H3V3Zm0 6h18v4H3V9Zm0 6h18v4H3v-4Z" /></svg>
                    {quarterlyData.indicator.department}
                  </span>
                  {quarterlyData.indicator.unit && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h4v8H3v-8Zm7-6h4v14h-4V7Zm7 3h4v11h-4V10Z" /></svg>
                      Unit: {quarterlyData.indicator.unit}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 shrink-0">
                {quarterlyData.annual_plan.id ? (
                  <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                    <p className="text-xs text-emerald-600 font-medium">Annual Target</p>
                    <p className="text-lg font-bold text-emerald-800 font-mono">
                      {parseFloat(quarterlyData.annual_plan.target || '0').toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="text-center bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                    <p className="text-xs text-amber-600 font-medium">No Annual Plan</p>
                    <p className="text-sm text-amber-700">Not created for {selectedYear}</p>
                  </div>
                )}
                {quarterlyData.breakdown && (
                  <div className="text-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                    <p className="text-xs text-gray-500 font-medium">Breakdown Status</p>
                    <div className="mt-1"><StatusBadge status={quarterlyData.breakdown.status} /></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quarters Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Quarter</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-600 uppercase tracking-wide">Plan Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-600 uppercase tracking-wide">Plan Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wide">Performance Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wide">Performance Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quarters.map(({ key, label, num }) => {
                  const cell: QuarterCell = quarterlyData.quarters[key as keyof typeof quarterlyData.quarters];
                  const isNA = !cell.applicable;

                  return (
                    <tr
                      key={key}
                      className={`transition-colors ${isNA ? 'bg-gray-50/60 opacity-60' : 'hover:bg-emerald-50/30'}`}
                    >
                      {/* Quarter label */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold
                            ${isNA ? 'bg-gray-100 text-gray-400' : 'bg-emerald-100 text-emerald-700'}`}>
                            {label}
                          </span>
                          {isNA && (
                            <span className="text-[10px] font-medium text-gray-400 uppercase">N/A</span>
                          )}
                        </div>
                      </td>

                      {/* Plan Value */}
                      <td className="px-4 py-4">
                        {isNA ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : cell.plan ? (
                          <ValueDisplay value={cell.plan.value} />
                        ) : (
                          <span className="text-gray-400 text-xs italic">No breakdown</span>
                        )}
                      </td>

                      {/* Plan Status */}
                      <td className="px-4 py-4">
                        {isNA ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : cell.plan ? (
                          <StatusBadge status={cell.plan.status} />
                        ) : (
                          <span className="text-gray-400 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Performance Value */}
                      <td className="px-4 py-4">
                        {isNA ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : cell.performance ? (
                          <ValueDisplay value={cell.performance.value} />
                        ) : (
                          <span className="text-gray-400 text-xs italic">Not recorded</span>
                        )}
                      </td>

                      {/* Performance Status */}
                      <td className="px-4 py-4">
                        {isNA ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : cell.performance ? (
                          <StatusBadge status={cell.performance.status} />
                        ) : (
                          <span className="text-gray-400 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        {isNA ? (
                          <span className="text-gray-300 text-xs text-center block">—</span>
                        ) : (
                          <div className="flex flex-col gap-1.5 items-center">
                            {/* Plan edits */}
                            {cell.plan && (
                              <>
                                <button
                                  onClick={() =>
                                    openEdit(num, 'plan_value', cell.plan?.value ?? '', cell.plan?.breakdown_id)
                                  }
                                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  title="Edit plan value"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                  </svg>
                                  Plan Val
                                </button>
                                <button
                                  onClick={() =>
                                    openEdit(num, 'plan_status', cell.plan?.status ?? '', cell.plan?.breakdown_id)
                                  }
                                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  title="Edit plan status"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l7.5 4.5-7.5 4.5z" />
                                  </svg>
                                  Plan Stat
                                </button>
                              </>
                            )}
                            {/* Performance edits */}
                            {cell.performance && (
                              <>
                                <button
                                  onClick={() =>
                                    openEdit(num, 'performance_value', cell.performance?.value ?? '', undefined, cell.performance?.id)
                                  }
                                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                  title="Edit performance value"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                  </svg>
                                  Perf Val
                                </button>
                                <button
                                  onClick={() =>
                                    openEdit(num, 'performance_status', cell.performance?.status ?? '', undefined, cell.performance?.id)
                                  }
                                  className="w-full flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                  title="Edit performance status"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l7.5 4.5-7.5 4.5z" />
                                  </svg>
                                  Perf Stat
                                </button>
                              </>
                            )}
                            {!cell.plan && !cell.performance && (
                              <span className="text-gray-300 text-xs italic">No data</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2 text-xs text-gray-400">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            All changes made on this page are recorded in the
            <a href="/activity-logs" className="text-emerald-600 font-medium hover:underline ml-0.5">Activity Log</a>.
            <span className="ml-auto text-gray-300">Fiscal Year: {selectedYear}</span>
          </div>
        </div>
      )}

      {/* Empty state when no indicator chosen */}
      {!loadingData && !dataError && !quarterlyData && selectedDept && !selectedIndicator && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h4v8H3v-8Zm7-6h4v14h-4V7Zm7 3h4v11h-4V10Z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Select an indicator to view its Q1–Q4 data</p>
          <p className="text-gray-400 text-sm">Use the searchable dropdown above to find an indicator by name or group</p>
        </div>
      )}

      {!selectedDept && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.25 5.61C6.57 8.59 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.43-4.41 5.75-7.39c.51-.66.04-1.61-.79-1.61H5.04c-.83 0-1.3.95-.79 1.61z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">Start by selecting a Sector and Department</p>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditModal
          target={editTarget}
          onClose={() => { setEditTarget(null); setSaveError(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
