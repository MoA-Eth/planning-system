import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { currentEthiopianYear, toGregorianYearFromEthiopian } from '../lib/ethiopian';
import { formatQuarterValue, formatQuarterValueForInput, convertInputToAPIValue, isQuarterValueNull, isQuarterValueZero } from '../lib/quarterlyUtils';

// Types reused
type AnnualPlan = {
  id: number;
  year: number;
  indicator: number;
  indicator_name: string;
  indicator_unit?: string;
  indicator_group_name?: string | null;
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
  quarter: number; // 1..4
  value: string;
  value_display: string;
  status: string;
  variance_description?: string;
  review_comment?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  rejected_by_name?: string;
  rejected_at?: string;
};

export default function Performances() {
  const { user } = useAuth();
  const thisEtYear = currentEthiopianYear();
  const [etYear, setEtYear] = useState<number>(thisEtYear);
  const [plansCurr, setPlansCurr] = useState<AnnualPlan[]>([]);
  const [plansPrev, setPlansPrev] = useState<AnnualPlan[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<number, Breakdown>>({});
  const [perfs, setPerfs] = useState<Record<string, Performance>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [perfWindowOpen, setPerfWindowOpen] = useState<boolean>(true);
  const [perfWindowByQuarter, setPerfWindowByQuarter] = useState<Record<1|2|3|4, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });

  const [perfModal, setPerfModal] = useState<{ 
    open: boolean; 
    planId: number | null; 
    quarter: 1|2|3|4 | null; 
    value: string;
    indicatorName: string;
    planValue?: string;
    annualTarget: string;
    varianceDescription: string;
  }>(() => ({ 
    open: false, 
    planId: null, 
    quarter: null, 
    value: '', 
    indicatorName: '',
    planValue: '',
    annualTarget: '',
    varianceDescription: ''
  }));

  const [rejectionModal, setRejectionModal] = useState<{ 
    open: boolean; 
    title: string; 
    note: string; 
    by?: string; 
    at?: string;
    quarter?: number;
    indicatorName?: string;
  }>(() => ({ 
    open: false, 
    title: '', 
    note: '' 
  }));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const grYear = toGregorianYearFromEthiopian(etYear);
      const grPrevYear = toGregorianYearFromEthiopian(etYear - 1);
      const [plansCurrRes, plansPrevRes, bRes, pResCurr, pResPrev, winRes] = await Promise.all([
        api.get('/api/annual-plans/', { params: { year: grYear } }),
        api.get('/api/annual-plans/', { params: { year: grPrevYear } }),
        api.get('/api/breakdowns/'),
        api.get('/api/performances/', { params: { year: grYear } }),
        api.get('/api/performances/', { params: { year: grPrevYear } }),
        api.get('/api/submission-windows/status/', { params: { year: grYear } }),
      ]);
      
      const currPlans: AnnualPlan[] = plansCurrRes.data || [];
      const prevPlans: AnnualPlan[] = plansPrevRes.data || [];
      setPlansCurr(currPlans);
      setPlansPrev(prevPlans);
      
      const map: Record<number, Breakdown> = {};
      for (const b of (bRes.data || []) as Breakdown[]) map[b.plan] = b;
      setBreakdowns(map);
      
      const pmap: Record<string, Performance> = {};
      for (const pr of (pResCurr.data || []) as Performance[]) {
        if (pr) pmap[`${pr.plan}-${pr.quarter}`] = pr;
      }
      for (const pr of (pResPrev.data || []) as Performance[]) {
        if (pr) pmap[`${pr.plan}-${pr.quarter}`] = pr;
      }
      setPerfs(pmap);
      
      // Auto-create N/A performances for quarters with N/A plans (pass fresh data, not stale state)
      await autoCreateNAPerformances(currPlans, map, pmap);
      
      // Update performance window state (overall and per quarter) based on backend configuration
      const win = (winRes as any)?.data;
      if (win && win.performance_windows) {
        const perQuarter: Record<1|2|3|4, boolean> = {
          1: Boolean(win.performance_windows['1']),
          2: Boolean(win.performance_windows['2']),
          3: Boolean(win.performance_windows['3']),
          4: Boolean(win.performance_windows['4']),
        };
        setPerfWindowByQuarter(perQuarter);
        // Overall window flag: at least one quarter open
        setPerfWindowOpen(perQuarter[1] || perQuarter[2] || perQuarter[3] || perQuarter[4]);
      }
      
      // Auto-expand first sector and department
      if (Object.keys(grouped).length > 0) {
        const firstSector = Object.keys(grouped)[0];
        setExpandedSectors(new Set([firstSector]));
        const firstDept = Object.keys(grouped[firstSector]?.departments || {})[0];
        setExpandedDepartments(new Set([`${firstSector}-${firstDept}`]));
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
  }, [etYear]);

  const grouped = useMemo(() => {
    const filtered = (plansCurr || []).filter((p) =>
      query ? [p.indicator_name, p.department_name, p.sector_name, p.indicator_unit]
        .join(' ').toLowerCase().includes(query.toLowerCase()) : true
    );
    const map: Record<string, { name: string; departments: Record<string, { name: string; items: AnnualPlan[] }> }> = {};
    for (const p of filtered) {
      const sKey = String(p.sector_id ?? 'unknown');
      const dKey = String(p.department_id ?? 'unknown');
      if (!map[sKey]) map[sKey] = { name: p.sector_name || 'Unassigned Sector', departments: {} };
      if (!map[sKey].departments[dKey]) map[sKey].departments[dKey] = { name: p.department_name || 'Unassigned Department', items: [] };
      map[sKey].departments[dKey].items.push(p);
    }
    return map;
  }, [plansCurr, query]);

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
    rows.push([
      'Sector', 'Department', 'Indicator', 'Unit', 'Year',
      'Annual Target', 'Annual Performance',
      'Q1 Plan', 'Q1 Perf', 'Q1 Perf Status',
      'Q2 Plan', 'Q2 Perf', 'Q2 Perf Status',
      'Q3 Plan', 'Q3 Perf', 'Q3 Perf Status',
      'Q4 Plan', 'Q4 Perf', 'Q4 Perf Status'
    ]);

    const filtered = (plansCurr || []).filter((p) =>
      query ? [p.indicator_name, p.department_name, p.sector_name, p.indicator_unit]
        .join(' ').toLowerCase().includes(query.toLowerCase()) : true
    );

    for (const p of filtered) {
      const bd = breakdowns[p.id];
      const perf = (q: 1|2|3|4) => perfs[`${p.id}-${q}`]?.value_display || '';
      const perfS = (q: 1|2|3|4) => perfs[`${p.id}-${q}`]?.status || '';
      rows.push([
        p.sector_name || '',
        p.department_name || '',
        p.indicator_name || '',
        p.indicator_unit || '',
        String(etYear || ''),
        String(p.target || ''),
        annualPerformance(p.id).toFixed(2),
        String(bd?.q1 || ''), perf(1), perfS(1),
        String(bd?.q2 || ''), perf(2), perfS(2),
        String(bd?.q3 || ''), perf(3), perfS(3),
        String(bd?.q4 || ''), perf(4), perfS(4),
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
    a.download = `quarterly_performances_${etYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('CSV file downloaded');
    setTimeout(() => setSuccess(null), 3000);
  };

  const annualPerformance = (planId: number): number => {
    let sum = 0;
    for (let q: 1|2|3|4 = 1; q <= 4; q = (q + 1) as 1|2|3|4) {
      const key = `${planId}-${q}`;
      const v = parseFloat(perfs[key]?.value || '0');
      if (!isNaN(v)) sum += v;
    }
    return sum;
  };

  const findPrevBaseline = (indicatorId: number) => {
    const prev = plansPrev.find((p) => p.indicator === indicatorId);
    if (!prev) return { target: 0, perf: 0 };
    let perf = 0;
    const approvedSet = new Set(['APPROVED','VALIDATED','FINAL_APPROVED']);
    for (let q: 1|2|3|4 = 1; q <= 4; q = (q + 1) as 1|2|3|4) {
      const key = `${prev.id}-${q}`;
      const item = perfs[key];
      const ok = approvedSet.has(String(item?.status || 'DRAFT').toUpperCase());
      const v = ok ? parseFloat(item?.value || '0') : 0;
      if (!isNaN(v)) perf += v;
    }
    return { target: parseFloat(prev.target || '0') || 0, perf };
  };

  const canEditPerformance = (planId: number, quarter?: 1|2|3|4): boolean => {
    const role = (user?.role || '').toUpperCase();
    if (role !== 'LEAD_EXECUTIVE_BODY') return false;

    if (quarter) {
      const bd = breakdowns[planId];
      const quarterPlan = bd ? (bd[`q${quarter}` as const] as string | null) : null;
      const key = `${planId}-${quarter}`;
      const perfStatus = (perfs[key]?.status || 'DRAFT').toUpperCase();

      // N/A quarter (null/empty plan): only allow editing if rejected
      if (!quarterPlan || quarterPlan === '') {
        return perfStatus === 'REJECTED';
      }

      // Regular quarter: require window open, approved breakdown, and draft/rejected status
      if (!perfWindowOpen) return false;
      const st = (breakdowns[planId]?.status || 'DRAFT').toUpperCase();
      if (!(st === 'APPROVED' || st === 'VALIDATED' || st === 'FINAL_APPROVED')) return false;
      if (!perfWindowByQuarter[quarter]) return false;
      return perfStatus === 'DRAFT' || perfStatus === 'REJECTED';
    }

    // No quarter specified (e.g. banner check): require window open + approved breakdown
    if (!perfWindowOpen) return false;
    const st = (breakdowns[planId]?.status || 'DRAFT').toUpperCase();
    return st === 'APPROVED' || st === 'VALIDATED' || st === 'FINAL_APPROVED';
  };

  const canSubmitPerformance = (): boolean => {
    const role = (user?.role || '').toUpperCase();
    return perfWindowOpen && role === 'LEAD_EXECUTIVE_BODY';
  };

  const ensurePerf = async (planId: number, quarter: 1|2|3|4, initialValue?: string) => {
    const key = `${planId}-${quarter}`;
    if (perfs[key]?.id) return perfs[key];
    const res = await api.post('/api/performances/', { plan: planId, quarter, value: initialValue ?? '0' });
    const created: Performance = res.data;
    setPerfs((prev) => ({ ...prev, [key]: created }));
    return created;
  };

  const autoCreateNAPerformances = async (
    plans: AnnualPlan[],
    bds: Record<number, Breakdown>,
    perfMap: Record<string, Performance>
  ) => {
    // Auto-create N/A performances for quarters where the plan is N/A
    for (const plan of plans) {
      const bd = bds[plan.id];
      if (!bd) continue;
      
      // Check each quarter
      for (let quarter: 1|2|3|4 = 1; quarter <= 4; quarter = (quarter + 1) as 1|2|3|4) {
        const key = `${plan.id}-${quarter}`;
        const quarterPlan = bd ? (bd[`q${quarter}` as const] as string | null) : null;
        
        // Only auto-create N/A performance for quarters whose plan is N/A (null or empty).
        // Quarters with an actual plan value must never be auto-created as N/A.
        if ((quarterPlan === null || quarterPlan === '') && !perfMap[key]) {
          try {
            const res = await api.post('/api/performances/', { 
              plan: plan.id, 
              quarter, 
              value: 'N/A', 
              status: 'SUBMITTED' 
            });
            const created: Performance = res.data;
            perfMap[key] = created;
            setPerfs((prev) => ({ ...prev, [key]: created }));
          } catch (error) {
            // Log error but don't fail the entire load
            console.warn(`Failed to auto-create N/A performance for plan ${plan.id}, Q${quarter}:`, error);
          }
        }
      }
    }
  };

  const savePerformance = async (planId: number, quarter: 1|2|3|4, value: string) => {
    try {
      // Convert input value to API format, properly handling N/A vs 0
      const apiValue = convertInputToAPIValue(value);
      const perf = await ensurePerf(planId, quarter, apiValue || '0');
      await api.put(`/api/performances/${perf.id}/`, { plan: planId, quarter, value: apiValue, status: perf.status, variance_description: perfModal.varianceDescription || '' });
      
      const key = `${planId}-${quarter}`;
      setPerfs((prev) => ({ ...prev, [key]: { ...(prev[key] || perf), value: apiValue, variance_description: perfModal.varianceDescription || '' } as Performance }));
      
      setSuccess(`Q${quarter} performance saved`);
      setTimeout(() => setSuccess(null), 3000);
      
      await loadData();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || '';
      if (typeof detail === 'string' && detail.toLowerCase().includes('entry window closed')) {
        setPerfWindowOpen(false);
        setError('Entry window is closed. Quarterly performance is now read-only.');
      } else {
        setError(detail || 'Save performance failed');
      }
    }
  };

  const submitPerformance = async (planId: number, quarter: 1|2|3|4, value?: string) => {
    try {
      let perf: Performance;
      if (typeof value === 'string') {
        const apiValue = convertInputToAPIValue(value);
        perf = await ensurePerf(planId, quarter, apiValue || '0');
        await api.put(`/api/performances/${perf.id}/`, { plan: planId, quarter, value: apiValue, status: perf.status, variance_description: perfModal.varianceDescription || '' });
        
        const key = `${planId}-${quarter}`;
        setPerfs((prev) => ({ ...prev, [key]: { ...(prev[key] || perf), value: apiValue, variance_description: perfModal.varianceDescription || '' } as Performance }));
      } else {
        perf = await ensurePerf(planId, quarter);
      }
      
      await api.post(`/api/performances/${perf.id}/submit/`, {
        variance_description: perfModal.varianceDescription || undefined,
      });
      
      setSuccess(`Q${quarter} performance submitted for review`);
      setTimeout(() => setSuccess(null), 3000);
      
      await loadData();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || '';
      if (typeof detail === 'string' && detail.toLowerCase().includes('entry window closed')) {
        setPerfWindowOpen(false);
        setError('Entry window is closed. Quarterly performance is now read-only.');
      } else {
        setError(detail || 'Submit performance failed');
      }
    }
  };

  const resubmitNAPerformance = async (planId: number, quarter: 1|2|3|4) => {
    const key = `${planId}-${quarter}`;
    const perf = perfs[key];
    if (!perf?.id) return;
    try {
      await api.post(`/api/performances/${perf.id}/submit/`, {});
      setSuccess(`Q${quarter} N/A performance re-submitted for review`);
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Re-submit failed');
    }
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

  const getProgressPercentage = (planValue: string, perfValue: string): number => {
    // Handle N/A case
    if (planValue === 'N/A') return 0;
    const plan = parseFloat(planValue || '0');
    const perf = parseFloat(perfValue || '0');
    if (plan === 0) return 0;
    // Return the actual percentage (can be > 100) so the label shows real performance.
    return (perf / plan) * 100;
  };

  const getPerformanceColor = (perfValue: string, planValue: string): string => {
    // Handle N/A case
    if (planValue === 'N/A') return 'bg-gray-100 text-gray-500 border border-gray-300';
    
    const perf = parseFloat(perfValue || '0');
    const plan = parseFloat(planValue || '0');
    if (plan === 0) return 'bg-gray-100 text-gray-700';
    
    const percentage = (perf / plan) * 100;
    if (percentage >= 100) return 'bg-green-100 text-green-800 border border-green-300';
    if (percentage >= 80) return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    if (percentage >= 50) return 'bg-blue-100 text-blue-800 border border-blue-300';
    if (percentage > 0) return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    return 'bg-red-50 text-red-700 border border-red-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quarterly Performance Tracking</h1>
              <p className="mt-2 text-gray-600">
                Track and report quarterly performance against targets for {etYear} (Ethiopian Calendar)
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
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-blue-600 rounded-xl bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transition-all duration-200"
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
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-4 py-2">
                <label className="text-sm text-gray-700 font-medium">Year:</label>
                <input 
                  type="number" 
                  min={2000} 
                  max={3000} 
                  value={etYear} 
                  onChange={(e) => setEtYear(Number(e.target.value))}
                  className="w-28 border-0 focus:outline-none focus:ring-0 text-right font-medium"
                />
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Showing:</span> {plansCurr.length} indicators for {etYear}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {canEditPerformance(0) && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Performance Edit Mode Enabled
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-sm text-gray-500 font-medium">Total Indicators</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{plansCurr.length}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-sm text-gray-500 font-medium">Tracked Quarters</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {Object.values(perfs).filter(p => p?.plan && plansCurr.some(plan => plan.id === p.plan)).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-sm text-gray-500 font-medium">Submitted</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {Object.values(perfs).filter(p => p?.status === 'SUBMITTED' && plansCurr.some(plan => plan.id === p.plan)).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-sm text-gray-500 font-medium">Approved</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {Object.values(perfs).filter(p => ['APPROVED', 'VALIDATED', 'FINAL_APPROVED'].includes(p?.status) && plansCurr.some(plan => plan.id === p.plan)).length}
            </div>
          </div>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="text-gray-600">Loading performance data...</div>
            </div>
          </div>
        ) : plansCurr.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">No performance data found</h3>
                <p className="mt-1 text-gray-600">No annual plans available for {etYear}. Try selecting a different year.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
                <div className="col-span-12 lg:col-span-3">Indicator Details</div>
                <div className="col-span-12 lg:col-span-9">
                  <div className="grid grid-cols-9 gap-2">
                    <div className="col-span-2 text-center">Baseline ({etYear - 1})</div>
                    <div className="col-span-2 text-center">Target vs Performance</div>
                    {[1,2,3,4].map(q => (
                      <div key={q} className="text-center">{getQuarterLabel(q as 1|2|3|4)}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Data Sections */}
            <div className="divide-y divide-gray-100">
              {Object.entries(grouped).map(([sKey, sVal]) => (
                <div key={sKey} className="bg-white">
                  {/* Sector Header */}
                  <div 
                    className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 cursor-pointer hover:from-blue-100 transition-colors"
                    onClick={() => toggleSector(sKey)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg 
                          className={`w-5 h-5 text-blue-600 transform transition-transform ${expandedSectors.has(sKey) ? 'rotate-90' : ''}`} 
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
        )}

        {/* Performance Modal */}
        {perfModal.open && perfModal.planId && perfModal.quarter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg">Enter Performance Data</div>
                  <button 
                    onClick={() => setPerfModal({ 
                      open: false, 
                      planId: null, 
                      quarter: null, 
                      value: '', 
                      indicatorName: '',
                      planValue: '',
                      annualTarget: '',
                      varianceDescription: ''
                    })} 
                    className="text-white/80 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="text-sm opacity-90 mt-1">
                  Quarter {perfModal.quarter} • {perfModal.indicatorName}
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">Plan Target</div>
                    <div className="font-semibold text-gray-900">{perfModal.planValue || '0'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500">Annual Target</div>
                    <div className="font-semibold text-gray-900">{perfModal.annualTarget || '0'}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Performance Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={perfModal.value}
                    onChange={(e) => setPerfModal((m) => ({ ...m, value: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    placeholder="Enter performance value"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variance Explanation
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Required if the quarterly performance is less than 84% or greater than 110% of the quarterly target.
                  </p>
                  <textarea
                    value={perfModal.varianceDescription}
                    onChange={(e) => setPerfModal((m) => ({ ...m, varianceDescription: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-y"
                    placeholder="Provide explanation when performance is significantly below or above the target"
                  />
                </div>

                {!canEditPerformance(perfModal.planId, perfModal.quarter) && (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="font-medium mb-1">⚠️ Edit Restrictions</div>
                    <div className="text-xs">
                      Quarterly performance can only be edited when:
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>You are a Lead Executive Body member</li>
                        <li>The quarterly breakdown plan is approved</li>
                        <li>The performance status is DRAFT or REJECTED</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setPerfModal({ 
                    open: false, 
                    planId: null, 
                    quarter: null, 
                    value: '', 
                    indicatorName: '',
                    planValue: '',
                    annualTarget: '',
                    varianceDescription: ''
                  })}
                  className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  disabled={!canEditPerformance(perfModal.planId, perfModal.quarter) || perfModal.value.trim() === ''}
                  onClick={() => {
                    if (perfModal.planId && perfModal.quarter && perfModal.value.trim() !== '') {
                      savePerformance(perfModal.planId, perfModal.quarter, perfModal.value);
                    }
                    setPerfModal({ 
                      open: false, 
                      planId: null, 
                      quarter: null, 
                      value: '', 
                      indicatorName: '',
                      planValue: '',
                      annualTarget: '',
                      varianceDescription: ''
                    });
                  }}
                  className={`px-5 py-2.5 rounded-xl transition-colors shadow-sm ${
                    canEditPerformance(perfModal.planId, perfModal.quarter) && perfModal.value.trim() !== ''
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save Performance
                </button>

                <button
                  disabled={!canSubmitPerformance() || perfModal.value.trim() === ''}
                  onClick={() => {
                    if (canSubmitPerformance() && perfModal.planId && perfModal.quarter && perfModal.value.trim() !== '') {
                      submitPerformance(perfModal.planId, perfModal.quarter, perfModal.value);
                    }
                    setPerfModal({ 
                      open: false, 
                      planId: null, 
                      quarter: null, 
                      value: '', 
                      indicatorName: '',
                      planValue: '',
                      annualTarget: '',
                      varianceDescription: ''
                    });
                  }}
                  className={`px-5 py-2.5 rounded-xl transition-colors shadow-sm ${
                    canSubmitPerformance() && perfModal.value.trim() !== ''
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Submit for Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectionModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86A2.07 2.07 0 0021 16.93V7.07A2.07 2.07 0 0018.93 5H5.07A2.07 2.07 0 003 7.07v9.86A2.07 2.07 0 005.07 19z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {rejectionModal.title || 'Performance Rejection Note'}
                    </div>
                    <div className="text-xs text-white/70">
                      {rejectionModal.indicatorName && `${rejectionModal.indicatorName} • `}
                      {rejectionModal.quarter && `Quarter ${rejectionModal.quarter} • `}
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
                  {rejectionModal.note || 'No rejection note provided.'}
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => { 
                    try { 
                      navigator.clipboard.writeText(rejectionModal.note || ''); 
                      setSuccess('Rejection note copied to clipboard');
                      setTimeout(() => setSuccess(null), 3000);
                    } catch {} 
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Copy Note
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

  // Helper function to render indicator row
  function renderIndicatorRow(p: AnnualPlan) {
    const bd = breakdowns[p.id];
    const baseline = findPrevBaseline(p.indicator);
    const annualPerf = annualPerformance(p.id);
    const planQ = (q: 1|2|3|4) => {
      const planValue = (bd ? (bd[`q${q}` as const] as string | null) : null) ?? '';
      // If plan is null, empty, or undefined, return 'N/A'
      return planValue === '' || planValue === null ? 'N/A' : planValue;
    };
    const perfQ = (q: 1|2|3|4) => perfs[`${p.id}-${q}`]?.value_display ?? '';
    const perfS = (q: 1|2|3|4) => perfs[`${p.id}-${q}`]?.status ?? '';

    const openPerfModal = (q: 1|2|3|4) => {
      const existing = String(perfQ(q) || '').trim();
      // If performance is N/A or empty, use empty string for input; otherwise use existing value
      const initial = existing === 'N/A' ? '' : existing;
      setPerfModal({ 
        open: true, 
        planId: p.id, 
        quarter: q, 
        value: initial,
        indicatorName: p.indicator_name,
        planValue: planQ(q),
        annualTarget: p.target,
        varianceDescription: perfs[`${p.id}-${q}`]?.variance_description || '',
      });
    };

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
          <div className="col-span-12 lg:col-span-9">
            <div className="grid grid-cols-9 gap-2">
              {/* Baseline */}
              <div className="col-span-2">
                <div className="space-y-2">
                  <div className="bg-gray-100 text-gray-700 px-3 py-2.5 rounded-lg text-center">
                    <div className="text-xs text-gray-500 mb-1">Target</div>
                    <div className="font-semibold">{baseline.target.toFixed(2)}</div>
                  </div>
                  <div className="bg-blue-100 text-blue-800 px-3 py-2.5 rounded-lg text-center border border-blue-200">
                    <div className="text-xs text-blue-600 mb-1">Actual</div>
                    <div className="font-semibold">{baseline.perf.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Annual Target vs Performance */}
              <div className="col-span-2">
                <div className="space-y-2">
                  <div className="bg-emerald-100 text-emerald-800 px-3 py-2.5 rounded-lg text-center border border-emerald-200">
                    <div className="text-xs text-emerald-600 mb-1">Target</div>
                    <div className="font-semibold">{p.target || '0'}</div>
                  </div>
                  <div className={`px-3 py-2.5 rounded-lg text-center border ${
                    annualPerf >= parseFloat(p.target || '0') 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    <div className="text-xs mb-1">Performance</div>
                    <div className="font-semibold">{annualPerf.toFixed(2)}</div>
                    {parseFloat(p.target || '0') > 0 && (
                      <div className="text-xs mt-1 opacity-75">
                        {((annualPerf / parseFloat(p.target || '0')) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quarters */}
              {[1, 2, 3, 4].map((q) => {
                const qValue = perfQ(q as 1|2|3|4);
                const qPlan = planQ(q as 1|2|3|4);
                const qStatus = perfS(q as 1|2|3|4);
                const progress = getProgressPercentage(qPlan, qValue); // actual percentage
                const cappedProgress = Math.min(Math.max(progress, 0), 100); // for bar width 0–100
                const perfColor = getPerformanceColor(qValue, qPlan);

                return (
                  <div key={q} className="col-span-1">
                    <div className="space-y-2">
                      {/* Plan Target */}
                      <div className="bg-gray-50 text-gray-700 px-2 py-2 rounded-lg text-center">
                        <div className="text-xs text-gray-500">Plan</div>
                        <div className="font-medium">{qPlan || '0'}</div>
                      </div>

                      {/* Performance Button */}
                      <button
                        disabled={!canEditPerformance(p.id, q as 1|2|3|4)}
                        onClick={() => openPerfModal(q as 1|2|3|4)}
                        className={`w-full px-2 py-2 rounded-lg text-center transition-all relative overflow-hidden ${perfColor} ${
                          canEditPerformance(p.id, q as 1|2|3|4) 
                            ? 'hover:shadow-sm hover:scale-[1.02] cursor-pointer' 
                            : 'cursor-not-allowed'
                        }`}
                        title={qPlan === 'N/A' && (!qValue || qValue === 'N/A') ? 'N/A' : (qValue || '-')}
                      >
                        <div className="text-xs mb-1">Performance</div>
                        <div className="font-semibold">{qPlan === 'N/A' && (!qValue || qValue === 'N/A') ? 'N/A' : (qValue || '-')}</div>
                        {qPlan && parseFloat(qPlan) > 0 && (
                          <div className="mt-1 text-[11px] text-gray-700 opacity-80">
                            {progress.toFixed(1)}% of plan
                          </div>
                        )}
                        
                        {/* Progress Bar */}
                        {qPlan && parseFloat(qPlan) > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${cappedProgress}%` }}
                            />
                          </div>
                        )}
                      </button>

                      {/* Status */}
                      {perfs[`${p.id}-${q}`] && (
                        <div className="flex flex-col items-center gap-1">
                          {statusBadge(qStatus)}

                          {/* Rejection Note + Re-submit buttons */}
                          {qStatus.toUpperCase() === 'REJECTED' && (
                            <>
                              <button
                                onClick={() => {
                                  const perf = perfs[`${p.id}-${q}`];
                                  if (perf?.review_comment) {
                                    setRejectionModal({
                                      open: true,
                                      title: `Performance Rejection - Q${q}`,
                                      note: perf.review_comment || '',
                                      by: perf.reviewed_by_name || perf.rejected_by_name || '',
                                      at: perf.reviewed_at || perf.rejected_at || '',
                                      quarter: q,
                                      indicatorName: p.indicator_name
                                    });
                                  }
                                }}
                                className="text-xs text-red-600 hover:text-red-800 hover:underline"
                              >
                                View note
                              </button>
                              {/* Re-submit button for rejected N/A performances */}
                              {qPlan === 'N/A' && (user?.role || '').toUpperCase() === 'LEAD_EXECUTIVE_BODY' && (
                                <button
                                  onClick={() => resubmitNAPerformance(p.id, q as 1|2|3|4)}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Re-submit N/A
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}