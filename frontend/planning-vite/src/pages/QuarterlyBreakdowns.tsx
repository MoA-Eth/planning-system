import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getCurrentEthiopianDate } from '../lib/ethiopian';
import YearFilter from '../components/YearFilter';
import { getErrorMessage } from '../lib/error';
import { formatQuarterValue, formatQuarterValueForInput, convertInputToAPIValue } from '../lib/quarterlyUtils';

// Reuse AnnualPlan shape enriched by backend
type AnnualPlan = {
  id: number;
  year: number;
  indicator: number;
  indicator_name: string;
  indicator_unit?: string;
  indicator_group_name?: string | null;
  indicator_is_incremental?: boolean;
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
  review_comment?: string;
};

type Performance = {
  id: number;
  plan: number;
  quarter: number; // 1..4
  value: string;
  status: string;
  review_comment?: string;
};

export default function QuarterlyBreakdowns() {
  const { user } = useAuth();
  const thisYear = getCurrentEthiopianDate()[0];
  const toGregorianYearFromEthiopian = (etYear: number) => etYear + 7;
  const toEthiopianYearFromGregorian = (grYear: number) => grYear - 7;
  
  const [year, setYear] = useState<number>(thisYear);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [allPlans, setAllPlans] = useState<AnnualPlan[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<number, Breakdown>>({});
  const [perfs, setPerfs] = useState<Record<string, Performance>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [planWindowOpen, setPlanWindowOpen] = useState<boolean>(true);

  const [planModal, setPlanModal] = useState<{ open: boolean; planId: number | null; quarter: 1|2|3|4 | null; value: string; indicatorName: string }>(() => ({ open: false, planId: null, quarter: null, value: '', indicatorName: '' }));
  const [rejectionModal, setRejectionModal] = useState<{ open: boolean; title: string; note: string; by?: string; at?: string; byId?: number }>(() => ({ open: false, title: '', note: '' }));

  const loadData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const gregYear = toGregorianYearFromEthiopian(year);
      const [plansRes, bRes, winRes] = await Promise.all([
        api.get('/api/annual-plans/', { params: { year: gregYear } }),
        api.get('/api/breakdowns/'),
        api.get('/api/submission-windows/status/', { params: { year: gregYear } }),
      ]);
      const all: AnnualPlan[] = plansRes.data || [];
      setAllPlans(all);
      const filtered = all.filter((p) => p.year === gregYear);
      setPlans(filtered);
      
      const map: Record<number, Breakdown> = {};
      for (const b of (bRes.data || []) as Breakdown[]) map[b.plan] = b;
      setBreakdowns(map);

      // Update breakdown window state based on backend configuration
      const win = (winRes as any)?.data;
      if (win && typeof win.is_breakdown_window_open === 'boolean') {
        setPlanWindowOpen(Boolean(win.is_breakdown_window_open));
      }
      
      // Auto-expand first sector and department only if not already expanded
      setExpandedSectors((prev) => {
        if (prev.size > 0) return prev;
        if (filtered.length > 0) {
          const firstSector = String(filtered[0].sector_id ?? 'unknown');
          return new Set([firstSector]);
        }
        return prev;
      });

      setExpandedDepartments((prev) => {
        if (prev.size > 0) return prev;
        if (filtered.length > 0) {
          const firstSector = String(filtered[0].sector_id ?? 'unknown');
          const firstDept = String(filtered[0].department_id ?? 'unknown');
          return new Set([`${firstSector}-${firstDept}`]);
        }
        return prev;
      });
    } catch (e: any) {
      const msg = e?.userMessage || getErrorMessage(e, 'Failed to load data');
      setError(msg);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setExpandedSectors(new Set());
    setExpandedDepartments(new Set());
    loadData(true);
  }, [year]);

  const canEditPlan = (planId?: number): boolean => {
    const role = (user?.role || '').toUpperCase();
    if (!planWindowOpen) return false;
    if (role !== 'LEAD_EXECUTIVE_BODY') return false;
    if (!planId) return true;
    const st = (breakdowns[planId]?.status || 'DRAFT').toUpperCase();
    return st === 'DRAFT' || st === 'REJECTED';
  };

  const canSubmitPlan = (planId?: number, plan?: AnnualPlan): boolean => {
    const role = (user?.role || '').toUpperCase();
    if (!planWindowOpen) return false;
    if (role !== 'LEAD_EXECUTIVE_BODY') return false;
    if (!planId) return true;
    const st = (breakdowns[planId]?.status || 'DRAFT').toUpperCase();
    if (st !== 'DRAFT' && st !== 'REJECTED') return false;
    if (plan && !plan.indicator_is_incremental && planMismatch(plan)) return false;
    return true;
  };

  const statusBadge = (status?: string) => {
    const s = (status || 'DRAFT').toUpperCase();
    const styles: Record<string, { bg: string; text: string; icon: string }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '✏️' },
      SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '📤' },
      APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✅' },
      VALIDATED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🔒' },
      FINAL_APPROVED: { bg: 'bg-green-200', text: 'text-green-800', icon: '🏆' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: '❌' },
    };
    const style = styles[s] || styles.DRAFT;
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${style.bg} ${style.text} text-xs font-medium`}>
        <span className="text-xs">{style.icon}</span>
        <span>{s.replace('_', ' ')}</span>
      </div>
    );
  };

  const getQuarterLabel = (quarter: 1|2|3|4) => {
    const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const periods = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'];
    return (
      <div className="flex flex-col items-center">
        <span className="font-semibold">{labels[quarter-1]}</span>
        <span className="text-xs text-gray-500">{periods[quarter-1]}</span>
      </div>
    );
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? plans.filter((p) =>
          [p.indicator_name, p.department_name, p.sector_name, p.indicator_unit]
            .join(' ').toLowerCase().includes(q)
        )
      : plans;
    const map: Record<string, { name: string; departments: Record<string, { name: string; items: AnnualPlan[] }> }> = {};
    for (const p of filtered) {
      const sKey = String(p.sector_id ?? 'unknown');
      const dKey = String(p.department_id ?? 'unknown');
      if (!map[sKey]) map[sKey] = { name: p.sector_name || 'Unassigned Sector', departments: {} };
      if (!map[sKey].departments[dKey]) map[sKey].departments[dKey] = { name: p.department_name || 'Unassigned Department', items: [] };
      map[sKey].departments[dKey].items.push(p);
    }
    return map;
  }, [plans]);

  const prevYearEC = useMemo(() => year - 1, [year]);
  const prevPlanByIndicator = useMemo(() => {
    const m: Record<number, AnnualPlan> = {};
    const prevGreg = toGregorianYearFromEthiopian(prevYearEC);
    for (const p of allPlans) {
      if (p.year === prevGreg) m[p.indicator] = p;
    }
    return m;
  }, [allPlans, prevYearEC]);

  const toggleSector = (sectorKey: string) => {
    const newExpanded = new Set(expandedSectors);
    if (newExpanded.has(sectorKey)) {
      newExpanded.delete(sectorKey);
    } else {
      newExpanded.add(sectorKey);
    }
    setExpandedSectors(newExpanded);
  };

  const toggleDepartment = (sectorKey: string, deptKey: string) => {
    const key = `${sectorKey}-${deptKey}`;
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedDepartments(newExpanded);
  };

  const toCSV = (): string => {
    const rows: string[][] = [];
    rows.push(['Sector','Department','Indicator','Unit','Year','Annual Target','Annual Performance','Q1 Plan','Q2 Plan','Q3 Plan','Q4 Plan','Plan Status']);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? plans.filter((p) => [p.indicator_name, p.department_name, p.sector_name, p.indicator_unit].join(' ').toLowerCase().includes(q))
      : plans;
    for (const p of filtered) {
      const bd = breakdowns[p.id];
      rows.push([
        p.sector_name || '',
        p.department_name || '',
        p.indicator_name || '',
        p.indicator_unit || '',
        String(toEthiopianYearFromGregorian(p.year) || ''),
        String(p.target || ''),
        '0.00', // annualPerformance(p.id).toFixed(2),
        formatQuarterValue(bd?.q1), formatQuarterValue(bd?.q2), formatQuarterValue(bd?.q3), formatQuarterValue(bd?.q4),
        (bd?.status || ''),
      ]);
    }
    return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  };

  const copyCSV = async () => {
    const csv = toCSV();
    try { 
      await navigator.clipboard.writeText(csv);
      setSuccess('CSV data copied to clipboard');
      setTimeout(() => setSuccess(null), 3000);
    } catch {}
  };

  const downloadCSV = () => {
    const csv = toCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarterly_breakdowns_${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('CSV file downloaded');
    setTimeout(() => setSuccess(null), 3000);
  };

  const updateCell = (planId: number, field: 'q1'|'q2'|'q3'|'q4', value: string) => {
    setBreakdowns((prev) => {
      const cur = prev[planId] || { id: 0, plan: planId, q1: null, q2: null, q3: null, q4: null, status: 'DRAFT' };
      return { ...prev, [planId]: { ...cur, [field]: value } as Breakdown };
    });
  };

  const ensureCreate = async (planId: number) => {
    if (breakdowns[planId]?.id) return breakdowns[planId];
    // Use empty strings instead of '0' to preserve N/A values
    const res = await api.post('/api/breakdowns/', { plan: planId, q1: '', q2: '', q3: '', q4: '' });
    const created: Breakdown = res.data;
    setBreakdowns((prev) => ({ ...prev, [planId]: created }));
    return created;
  };

  const savePlan = async (planId: number, overrides?: Partial<Pick<Breakdown,'q1'|'q2'|'q3'|'q4'>>) => {
    try {
      const bd = await ensureCreate(planId);
      const current = breakdowns[planId] || bd;
      
      // Convert values to API format, properly handling N/A vs 0
      const q1Value = overrides && overrides.q1 !== undefined ? convertInputToAPIValue(overrides.q1) : convertInputToAPIValue(current?.q1?.toString() ?? '');
      const q2Value = overrides && overrides.q2 !== undefined ? convertInputToAPIValue(overrides.q2) : convertInputToAPIValue(current?.q2?.toString() ?? '');
      const q3Value = overrides && overrides.q3 !== undefined ? convertInputToAPIValue(overrides.q3) : convertInputToAPIValue(current?.q3?.toString() ?? '');
      const q4Value = overrides && overrides.q4 !== undefined ? convertInputToAPIValue(overrides.q4) : convertInputToAPIValue(current?.q4?.toString() ?? '');
      
      const res = await api.put(`/api/breakdowns/${bd.id}/`, {
        plan: planId,
        q1: q1Value,
        q2: q2Value,
        q3: q3Value,
        q4: q4Value,
        status: current.status || bd.status,
      });
      if (res.data) {
        setBreakdowns((prev) => ({ ...prev, [planId]: res.data }));
      }
      await loadData(false);
      setSuccess('Quarterly plan saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      const rawMsg = e?.userMessage || getErrorMessage(e, 'Save failed');
      const detail = e?.response?.data?.detail || rawMsg;
      const text = typeof detail === 'string' ? detail : String(detail || rawMsg || '');
      if (text.toLowerCase().includes('entry window closed')) {
        setPlanWindowOpen(false);
        setError('Entry window is closed. Quarterly plan is now read-only.');
      } else {
        setError(text);
      }
    }
  };

  const submitPlan = async (planId: number) => {
    try {
      const bd = await ensureCreate(planId);
      const res = await api.post(`/api/breakdowns/${bd.id}/submit/`);
      if (res.data) {
        setBreakdowns((prev) => ({ ...prev, [planId]: res.data }));
      }
      await loadData(false);
      setSuccess('Quarterly plan submitted for review');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      const rawMsg = e?.userMessage || getErrorMessage(e, 'Submit failed');
      const detail = e?.response?.data?.detail || rawMsg;
      const text = typeof detail === 'string' ? detail : String(detail || rawMsg || '');
      if (text.toLowerCase().includes('entry window closed')) {
        setPlanWindowOpen(false);
        setError('Entry window is closed. Quarterly plan is now read-only.');
      } else {
        setError(text);
      }
    }
  };

  const planTotal = (bd?: Breakdown): number => {
    if (!bd) return 0;
    const v = ['q1','q2','q3','q4'].map((k) => parseFloat((bd as any)[k] || '0'));
    return v.reduce((a,b)=>a + (isNaN(b) ? 0 : b), 0);
  };

  const planMismatch = (p: AnnualPlan): boolean => {
    if (p.indicator_is_incremental) return false;
    const bd = breakdowns[p.id];
    const total = planTotal(bd);
    const target = parseFloat(p.target || '0');
    return Math.abs(total - (isNaN(target) ? 0 : target)) > 0.0001;
  };

  const renderIndicatorRow = (p: AnnualPlan) => {
    const bd = breakdowns[p.id];
    const planQ = (q: 1|2|3|4) => formatQuarterValue(bd ? (bd[`q${q}` as const] as string | null) : null);
    const prev = prevPlanByIndicator[p.indicator];
    const prevAnnualStr = prev ? String(prev.target || '') : '-';

    return (
      <div key={p.id} className="px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Indicator Details */}
          <div className="col-span-12 lg:col-span-3">
            <div className="font-medium text-gray-900">{p.indicator_name}</div>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {p.indicator_unit || 'No unit'}
              </span>
              {p.indicator_group_name && (
                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-xs">
                  {p.indicator_group_name}
                </span>
              )}
            </div>
          </div>

          {/* Data Cells */}
          <div className="col-span-12 lg:col-span-7">
            <div className="grid grid-cols-8 gap-2">
              {/* Baseline */}
              <div className="col-span-2">
                <div className="bg-gray-100 text-gray-700 px-3 py-2.5 rounded-lg text-center font-medium">
                  {prevAnnualStr}
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Baseline</div>
              </div>

              {/* Annual Target */}
              <div className="col-span-2">
                <div className={`px-3 py-2.5 rounded-lg text-center font-medium ${
                  planMismatch(p) 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {p.target || '0'}
                  {planMismatch(p) && (
                    <div className="text-xs mt-1 text-amber-600">
                      ✗ Mismatch: {planTotal(bd).toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">Annual</div>
              </div>

              {/* Quarters */}
              {[1, 2, 3, 4].map((q) => (
                <div key={q} className="col-span-1">
                  <button
                  disabled={!canEditPlan(p.id)}
                    title={`${p.indicator_name} • Q${q}: ${String(planQ(q as 1|2|3|4) || '0')}`}
                  onClick={() => canEditPlan(p.id) && setPlanModal({ 
                      open: true, 
                      planId: p.id, 
                      quarter: q as 1|2|3|4, 
                      value: formatQuarterValueForInput(String(planQ(q as 1|2|3|4) || '')), 
                      indicatorName: p.indicator_name 
                    })}
                    className={`w-full px-2 py-2.5 rounded-lg text-center font-medium transition-all ${
                      canEditPlan(p.id)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:shadow-sm'
                        : 'bg-gray-50 text-gray-500 border border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    {planQ(q as 1|2|3|4) || '0'}
                  </button>
                  <div className="text-xs text-gray-500 text-center mt-1">Q{q}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Status & Actions */}
          <div className="col-span-12 lg:col-span-2">
            <div className="flex flex-col gap-3">
              {/* Status */}
              <div className="flex justify-center">
                {statusBadge(bd?.status)}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  disabled={!canEditPlan(p.id)}
                  onClick={() => canEditPlan(p.id) && savePlan(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    canEditPlan(p.id)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save Plan
                </button>
                <button
                  disabled={!canSubmitPlan(p.id, p)}
                  title={!p.indicator_is_incremental && planMismatch(p) ? `Quarter total (${planTotal(bd).toFixed(2)}) must equal annual target (${p.target}) before submitting` : undefined}
                  onClick={() => canSubmitPlan(p.id, p) && submitPlan(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    canSubmitPlan(p.id, p)
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {(bd?.status || '').toUpperCase() === 'REJECTED' ? 'Resubmit' : 'Submit'}
                </button>
              </div>

              {/* Rejection Note */}
              {bd?.status?.toUpperCase() === 'REJECTED' && bd?.review_comment && (
                <button
                  onClick={() => setRejectionModal({
                    open: true,
                    title: 'Plan Rejection Details',
                    note: bd.review_comment || '',
                    by: (bd as any)?.reviewed_by_name || (bd as any)?.rejected_by_name || '',
                    at: (bd as any)?.reviewed_at || (bd as any)?.rejected_at || ''
                  })}
                  className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 hover:bg-red-100 transition-colors"
                >
                  View Rejection Note
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quarterly Breakdown Management</h1>
              <p className="mt-2 text-gray-600">
                Plan and track quarterly distributions for {year} (Ethiopian Calendar)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search indicators, departments..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyCSV}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy CSV
                </button>
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-emerald-600 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <YearFilter 
                label="Select Year" 
                value={year} 
                onChange={setYear}
                className="bg-white border-gray-300 rounded-xl"
              />
              <div className="text-sm text-gray-600">
                <span className="font-medium">Showing:</span> {plans.length} indicators for {year}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {canEditPlan() && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  Edit Mode Enabled
                </div>
              )}
              <div className="text-sm text-gray-500">
                Role: <span className="font-medium">{user?.role || 'Guest'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm text-emerald-700">{success}</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <div className="text-gray-600">Loading quarterly breakdowns...</div>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">No annual plans found</h3>
                <p className="mt-1 text-gray-600">No annual plans available for {year}. Try selecting a different year.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-sm text-gray-500 font-medium">Total Indicators</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{plans.length}</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-sm text-gray-500 font-medium">Sectors</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{Object.keys(grouped).length}</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-sm text-gray-500 font-medium">Departments</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {Object.values(grouped).reduce((acc, sector) => acc + Object.keys(sector.departments).length, 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-sm text-gray-500 font-medium">Editable Plans</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                {plans.filter(p => canEditPlan(p.id)).length}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
                  <div className="col-span-12 lg:col-span-3">Indicator Details</div>
                  <div className="col-span-12 lg:col-span-7">
                    <div className="grid grid-cols-8 gap-2">
                      <div className="col-span-2 text-center">Baseline ({prevYearEC})</div>
                      <div className="col-span-2 text-center">Annual Target</div>
                      {[1,2,3,4].map(q => (
                        <div key={q} className="text-center">{getQuarterLabel(q as 1|2|3|4)}</div>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-2 text-center">Status & Actions</div>
                </div>
              </div>

              {/* Data Sections */}
              <div className="divide-y divide-gray-100">
                {Object.entries(grouped).map(([sKey, sVal]) => (
                  <div key={sKey} className="bg-white">
                    {/* Sector Header */}
                    <div 
                      className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-200 cursor-pointer hover:from-emerald-100 transition-colors"
                      onClick={() => toggleSector(sKey)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <svg 
                            className={`w-5 h-5 text-emerald-600 transform transition-transform ${expandedSectors.has(sKey) ? 'rotate-90' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div>
                            <h3 className="font-semibold text-gray-900">{sVal.name}</h3>
                            <div className="text-sm text-gray-600 mt-1">
                              {Object.keys(sVal.departments).length} departments •{' '}
                              {Object.values(sVal.departments).reduce((acc, dept) => acc + dept.items.length, 0)} indicators
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border">
                            Sector
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Department Sections */}
                    {expandedSectors.has(sKey) && Object.entries(sVal.departments).map(([dKey, dVal]) => (
                      <div key={dKey} className="border-b border-gray-100">
                        {/* Department Header */}
                        <div 
                          className="px-6 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => toggleDepartment(sKey, dKey)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <svg 
                                className={`w-4 h-4 text-gray-500 transform transition-transform ${expandedDepartments.has(`${sKey}-${dKey}`) ? 'rotate-90' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <div>
                                <h4 className="font-medium text-gray-900">{dVal.name}</h4>
                                <div className="text-sm text-gray-600">{dVal.items.length} indicators</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Indicators Table */}
                        {expandedDepartments.has(`${sKey}-${dKey}`) && (
                          <div className="overflow-x-auto">
                            {(() => {
                              const groupsMap = new Map<string, AnnualPlan[]>();
                              const ungrouped: AnnualPlan[] = [];
                              
                              for (const it of dVal.items as AnnualPlan[]) {
                                if (it.indicator_group_name) {
                                  const key = it.indicator_group_name;
                                  if (!groupsMap.has(key)) groupsMap.set(key, []);
                                  groupsMap.get(key)!.push(it);
                                } else {
                                  ungrouped.push(it);
                                }
                              }

                              return (
                                <div className="divide-y divide-gray-100">
                                  {Array.from(groupsMap.entries()).map(([gname, items]) => (
                                    <div key={`group-${gname}`}>
                                      <div className="px-6 py-2.5 bg-gray-100">
                                        <div className="text-sm font-medium text-gray-700">{gname}</div>
                                      </div>
                                      {items.map((p) => renderIndicatorRow(p))}
                                    </div>
                                  ))}
                                  {ungrouped.map((p) => renderIndicatorRow(p))}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Plan Modal */}
        {planModal.open && planModal.planId && planModal.quarter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">Edit Quarterly Plan</div>
                  <button 
                    onClick={() => setPlanModal({ open: false, planId: null, quarter: null, value: '', indicatorName: '' })} 
                    className="text-white/80 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="text-sm opacity-90 mt-1">Quarter {planModal.quarter} • {planModal.indicatorName}</div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={planModal.value}
                    onChange={(e) => setPlanModal((m) => ({ ...m, value: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
                    placeholder="N/A (leave empty for not applicable)"
                    autoFocus
                  />
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium mb-1">Note:</div>
                  <div>Quarterly plans must sum to the annual target. Empty fields will be saved as N/A (not applicable).</div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setPlanModal({ open: false, planId: null, quarter: null, value: '', indicatorName: '' })}
                  className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (planModal.planId && planModal.quarter) {
                      const key = `q${planModal.quarter}` as 'q1' | 'q2' | 'q3' | 'q4';
                      savePlan(planModal.planId, { [key]: planModal.value } as any);
                    }
                    setPlanModal({ open: false, planId: null, quarter: null, value: '', indicatorName: '' });
                  }}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectionModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86A2.07 2.07 0 0021 16.93V7.07A2.07 2.07 0 0018.93 5H5.07A2.07 2.07 0 003 7.07v9.86A2.07 2.07 0 005.07 19z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{rejectionModal.title || 'Rejection Note'}</div>
                    <div className="text-xs text-white/70">
                      {(() => {
                        const by = rejectionModal.by && String(rejectionModal.by).trim();
                        const at = rejectionModal.at && String(rejectionModal.at).trim();
                        let when = '' as string;
                        if (at) {
                          const d = new Date(at);
                          when = isNaN(d.getTime()) ? at : d.toLocaleString();
                        }
                        if (by && when) return `By ${by} • ${when}`;
                        if (by) return `By ${by}`;
                        if (when) return when;
                        return 'Reason provided during review';
                      })()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setRejectionModal({ open: false, title: '', note: '' })}
                  className="text-white/80 hover:text-white text-xl"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="p-6">
                <div className="text-sm text-gray-800 whitespace-pre-wrap break-words border border-gray-200 rounded-xl bg-gray-50 px-4 py-4 max-h-72 overflow-auto">
                  {rejectionModal.note || 'No note provided.'}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => { try { navigator.clipboard.writeText(rejectionModal.note || ''); } catch {} }}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => setRejectionModal({ open: false, title: '', note: '' })}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
