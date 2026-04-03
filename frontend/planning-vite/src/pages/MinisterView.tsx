import React, { useEffect, useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { X, ChevronRight, Activity, TrendingUp, Target, Info, Search, Calendar, Download } from 'lucide-react';

import api from '../lib/api';
import YearFilter from '../components/YearFilter';
import QuarterFilter from '../components/QuarterFilter';
import { getCurrentEthiopianDate, toEthiopianYearFromGregorian, toGregorianYearFromEthiopian } from '../lib/ethiopian';
import homePic from '../assets/home_pic.jpg';
import moaLogo from '../assets/moa planinig logo.png';

// --- Types ---
type Indicator = {
  id: number;
  plan_id: number;
  name: string;
  unit: string;
  description: string;
  is_aggregatable: boolean;
  kpi_characteristics: string;
  target: number;
  achieved: number;
  performance_percentage: number | null;
  group_id: number | null;
  group_name: string | null;
};

type IndicatorGroup = {
  id: number;
  name: string;
  performance_percentage: number | null;
  indicators: Indicator[];
};

type Department = {
  id: number;
  name: string;
  performance_percentage: number | null;
  groups: IndicatorGroup[];
  ungrouped_indicators: Indicator[];
};

type Sector = {
  id: number;
  name: string;
  performance_percentage: number | null;
  departments: Department[];
};

type DashboardData = {
  year: number;
  quarter_months: number | null;
  ministry_performance: number | null;
  sectors: Sector[];
};

type IndicatorDetailData = {
  indicator: {
    id: number;
    name: string;
    unit: string;
    description: string;
    department_name: string;
    kpi_characteristics: string;
  };
  yearly_data: Array<{
    year: number;
    target: number;
    achieved: number;
    percentage: number | null;
  }>;
  current_year_quarters: Array<{
    quarter: number;
    target: number;
    achieved: number | null;
    percentage: number | null;
  }>;
  last_year_quarters: Array<{
    quarter: number;
    target: number;
    achieved: number | null;
    percentage: number | null;
  }>;
};

// --- Colors (matching legend: Achieved / On track / In progress / Weak / Requires intervention / No Data) ---
const PERFORMANCE_RANGES = [
  { label: 'Achieved', range: '95% – 100%', color: '#047857', min: 95, max: Infinity },
  { label: 'On track', range: '85% – 94%', color: '#22c55e', min: 85, max: 94.999 },
  { label: 'In progress', range: '65% – 84%', color: '#eab308', min: 65, max: 84.999 },
  { label: 'Weak performance', range: '50% – 64%', color: '#f97316', min: 50, max: 64.999 },
  { label: 'Requires intervention', range: '0% – 49%', color: '#ef4444', min: 0, max: 49.999 },
  { label: 'No Data', range: 'N/A', color: '#9ca3af', min: -1, max: -1 },
];

const matchesRange = (percentage: number | null, rangeLabel: string | null): boolean => {
  if (!rangeLabel) return true;
  const range = PERFORMANCE_RANGES.find(r => r.label === rangeLabel);
  if (!range) return true;
  if (range.label === 'No Data') return percentage === null || isNaN(percentage as number);
  if (percentage === null || isNaN(percentage)) return false;
  return percentage >= range.min && percentage <= range.max;
};

const getPerformanceColor = (percentage: number | null) => {
  if (percentage === null || isNaN(percentage)) return '#9ca3af';
  if (percentage >= 95) return '#047857';
  if (percentage >= 85) return '#22c55e';
  if (percentage >= 65) return '#eab308';
  if (percentage >= 50) return '#f97316';
  return '#ef4444';
};

const formatValue = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatPct = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return `${val.toFixed(1)}%`;
};

const HERO_MARQUEE_STYLES = `
@keyframes heroSweep {
  0% { transform: translateX(-140%); opacity: 0; }
  10% { opacity: 1; }
  35% { transform: translateX(0%); opacity: 1; }
  55% { transform: translateX(0%); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateX(140%); opacity: 0; }
}
.hero-marquee-text {
  animation: heroSweep 18s ease-in-out infinite;
  will-change: transform, opacity;
}
`;

// --- Components ---
export default function MinisterView() {
  const ethDate = getCurrentEthiopianDate();
  const currentYear = Array.isArray(ethDate) && typeof ethDate[0] === 'number' ? ethDate[0] : new Date().getFullYear() - 7;

  const [year, setYear] = useState<number>(currentYear);
  const [quarterMonths, setQuarterMonths] = useState<number | null>(null);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection states
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  // Department & Indicator filters
  const [filterDeptId, setFilterDeptId] = useState<number | null>(null);
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [selectedRangeLabel, setSelectedRangeLabel] = useState<string | null>(null);

  // Modal state
  const [modalIndicatorId, setModalIndicatorId] = useState<number | null>(null);
  const [modalData, setModalData] = useState<IndicatorDetailData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalView, setModalView] = useState<'yearly' | 'quarterly'>('yearly');
  const [heroScale, setHeroScale] = useState(1.18);
  const [heroTransition, setHeroTransition] = useState('transform 400ms ease-out');
  const modalRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Export function using html-to-image
  const exportModalToPng = async () => {
    if (!modalRef.current || !modalData) return;
    
    setExporting(true);
    
    try {
      const dataUrl = await htmlToImage.toPng(modalRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipAutoScale: false,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `${modalData.indicator.name.replace(/\s+/g, '_')}_analysis.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export image. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const marqueeStyleTag = React.useMemo(() => ({ __html: HERO_MARQUEE_STYLES }), []);

  // Load Main Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const gYear = toGregorianYearFromEthiopian(year);
        const res = await api.get('/api/indicator-performance/', {
          params: { year: gYear, quarter_months: quarterMonths }
        });
        setData(res.data);
        // Reset selections when filters change
        setSelectedSectorId(null);
        setSelectedDeptId(null);
        setFilterDeptId(null);
        setIndicatorSearch('');
        setSelectedRangeLabel(null);
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [year, quarterMonths]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    setHeroTransition('transform 350ms ease-out');
    setHeroScale(1.2);
    const frame = requestAnimationFrame(() => {
      setHeroTransition('transform 8500ms ease-out');
      setHeroScale(1);
      timers.push(setTimeout(() => {
        setHeroTransition('transform 6500ms ease-in-out');
        setHeroScale(1.08);
      }, 8500));
      timers.push(setTimeout(() => {
        setHeroTransition('transform 9000ms ease-in-out');
        setHeroScale(1);
      }, 15000));
    });
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [year, quarterMonths]);

  // Load Modal Data
  useEffect(() => {
    if (!modalIndicatorId) return;
    const loadModal = async () => {
      setModalLoading(true);
      try {
        const gYear = toGregorianYearFromEthiopian(year);
        const res = await api.get('/api/indicator-detail/', {
          params: { indicator_id: modalIndicatorId, year: gYear, quarter_months: quarterMonths }
        });
        setModalData(res.data);
        setModalView(quarterMonths ? 'quarterly' : 'yearly');
      } catch (err) {
        console.error(err);
      } finally {
        setModalLoading(false);
      }
    };
    loadModal();
  }, [modalIndicatorId, year, quarterMonths]);

  // Derived: flat list of all departments (for filter dropdown)
  const allDepartments = React.useMemo(() => {
    if (!data) return [];
    const depts: { id: number; name: string; sectorId: number; sectorName: string }[] = [];
    for (const sector of data.sectors) {
      for (const dept of sector.departments) {
        depts.push({ id: dept.id, name: dept.name, sectorId: sector.id, sectorName: sector.name });
      }
    }
    return depts.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Derived: flat list of ALL indicators with department info (for range filter view)
  const allIndicators = React.useMemo(() => {
    if (!data) return [];
    const list: (Indicator & { departmentName: string; sectorName: string })[] = [];
    for (const sector of data.sectors) {
      for (const dept of sector.departments) {
        for (const group of dept.groups) {
          for (const ind of group.indicators) {
            list.push({ ...ind, departmentName: dept.name, sectorName: sector.name });
          }
        }
        for (const ind of dept.ungrouped_indicators) {
          list.push({ ...ind, departmentName: dept.name, sectorName: sector.name });
        }
      }
    }
    return list;
  }, [data]);

  // Search-filtered indicators (applies indicatorSearch to the full list)
  const searchFilteredIndicators = React.useMemo(() => {
    if (!indicatorSearch) return allIndicators;
    const q = indicatorSearch.toLowerCase();
    return allIndicators.filter(ind => ind.name.toLowerCase().includes(q));
  }, [allIndicators, indicatorSearch]);

  // Filtered indicators for the active range filter
  const rangeFilteredIndicators = React.useMemo(() => {
    if (!selectedRangeLabel) return [];
    return searchFilteredIndicators.filter(ind => matchesRange(ind.performance_percentage, selectedRangeLabel));
  }, [searchFilteredIndicators, selectedRangeLabel]);

  // Derived selections
  const selectedSector = data?.sectors.find(s => s.id === selectedSectorId);
  const selectedDept = selectedSector?.departments.find(d => d.id === selectedDeptId);

  // --- Handlers ---
  const handleSectorClick = (id: number) => {
    if (selectedSectorId === id) {
      setSelectedSectorId(null);
      setSelectedDeptId(null);
    } else {
      setSelectedSectorId(id);
      setSelectedDeptId(null);
    }
  };

  const handleDeptClick = (id: number) => {
    setSelectedDeptId(id === selectedDeptId ? null : id);
  };

  const handleDeptFilter = (deptId: number | null) => {
    setFilterDeptId(deptId);
    if (deptId === null) {
      setSelectedSectorId(null);
      setSelectedDeptId(null);
      return;
    }
    const match = allDepartments.find(d => d.id === deptId);
    if (match) {
      setSelectedSectorId(match.sectorId);
      setSelectedDeptId(match.id);
    }
  };

  // --- Render Helpers ---
  const renderModalChart = () => {
    if (!modalData) return null;

    let chartData: any[] = [];

    if (modalView === 'yearly') {
      chartData = modalData.yearly_data.map(d => {
        const ethYear = toEthiopianYearFromGregorian(d.year);
        return {
          name: `${ethYear} ዓ.ም`,
          Target: d.target,
          Achievement: d.achieved,
          PerformanceLine: d.achieved
        };
      });
    } else {
      const currentQData = modalData.current_year_quarters;
      const lastQData = modalData.last_year_quarters;

      let quartersToInclude = [1, 2, 3, 4];
      if (quarterMonths) {
        const map: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };
        quartersToInclude = [1, 2, 3, 4].filter(q => map[q] <= quarterMonths);
      }

      for (let i = 0; i < currentQData.length; i++) {
        const cQ = currentQData[i];
        const lQ = lastQData[i];

        if (!quartersToInclude.includes(cQ.quarter)) continue;
        if (cQ.target === 0 && (cQ.achieved === null || cQ.achieved === 0)) continue;

        chartData.push({
          name: `Q${cQ.quarter} (Prev Yr)`,
          Target: lQ.target,
          Achievement: lQ.achieved || 0,
          PerformanceLine: lQ.achieved || 0,
        });
        chartData.push({
          name: `Q${cQ.quarter} (Curr Yr)`,
          Target: cQ.target,
          Achievement: cQ.achieved || 0,
          PerformanceLine: cQ.achieved || 0,
        });
      }
    }

    if (chartData.length === 0) {
      return <div className="h-64 flex items-center justify-center text-gray-500">No chart data available</div>;
    }

    return (
      <div className="h-80 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="Target" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar yAxisId="left" dataKey="Achievement" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="PerformanceLine"
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Achievement Trend"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderModalTable = () => {
    if (!modalData) return null;

    if (modalView === 'yearly') {
      return (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Percent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {modalData.yearly_data.map((row, idx) => {
              const ethY = toEthiopianYearFromGregorian(row.year);
              return (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ethY} ዓ.ም</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatValue(row.target)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{formatValue(row.achieved)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right" style={{ color: getPerformanceColor(row.percentage) }}>
                    {formatPct(row.percentage)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    } else {
      let quartersToInclude = [1, 2, 3, 4];
      if (quarterMonths) {
        const map: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };
        quartersToInclude = [1, 2, 3, 4].filter(q => map[q] <= quarterMonths);
      }

      return (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year-Quarter</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Percent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {modalData.current_year_quarters
              .filter(row => quartersToInclude.includes(row.quarter))
              .map((row, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{year} - {row.quarter * 3}M</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {row.target === 0 && row.achieved === null ? 'N/A' : formatValue(row.target)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {row.achieved === null ? 'N/A' : formatValue(row.achieved)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right" style={{ color: getPerformanceColor(row.percentage) }}>
                    {row.target === 0 || row.achieved === null ? '—' : formatPct(row.percentage)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      );
    }
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <style dangerouslySetInnerHTML={marqueeStyleTag} />
      {/* 1. Hero Section — Background Image */}
      <div className="relative">
        <div className="h-[340px] md:h-[400px] w-full relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${heroScale})`, transition: heroTransition }}
            aria-hidden
          >
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${homePic})` }}
            />
          </div>
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'linear-gradient(rgba(30, 64, 130, 0.35), rgba(30, 64, 130, 0.25))' }}
            aria-hidden
          />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-4 overflow-hidden">
            <div className="hero-marquee-text uppercase tracking-[0.35em] text-xs sm:text-sm md:text-base font-semibold text-white/90 whitespace-nowrap bg-slate-900/30 backdrop-blur-sm px-6 py-3 rounded-full border border-white/30 shadow-[0_10px_45px_rgba(15,23,42,0.35)]">
              ENHANCING AGRICULTURE PRODUCTION GROWTH FOR FOOD SELF-RELIANCE
            </div>
          </div>
        </div>

        {/* White card overlapping the image bottom */}
        <div className="relative -mt-24 mx-auto max-w-5xl px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
            {/* Left: Performance bar + year */}
            <div className="flex-1 w-full">
              <div className="mb-3">
                <div className="relative w-full h-10 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-center text-white font-bold text-sm transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, data?.ministry_performance || 0)}%`,
                      backgroundColor: getPerformanceColor(data?.ministry_performance ?? null),
                    }}
                  >
                    {data?.ministry_performance ? `${data.ministry_performance.toFixed(2)}%` : 'N/A'}
                  </div>
                </div>
              </div>
              <span className="inline-block px-3 py-1 border border-amber-400 text-amber-700 rounded-full text-xs font-semibold">
                {year}
              </span>
            </div>

            {/* Right: MoA Logo + text */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center overflow-hidden -mt-16 md:-mt-20">
                <img src={moaLogo} alt="Ministry of Agriculture" className="w-20 h-20 md:w-24 md:h-24 object-contain" />
              </div>
              <h2 className="mt-3 text-lg font-bold text-gray-800 text-center">Ministry of Agriculture</h2>
              <span className="text-sm text-gray-400">MoA</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar — labeled dropdowns */}
      <div className="max-w-5xl mx-auto px-4 mt-4">
        <div className="flex flex-wrap items-start justify-end gap-4">
          {/* Row 1: Data type + Year */}
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Select data type</label>
              <div className="relative">
                <QuarterFilter
                  value={quarterMonths}
                  onChange={setQuarterMonths}
                  variant="compact"
                  showLabel={false}
                  className="text-gray-900 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Select time</label>
              <YearFilter
                value={year}
                onChange={setYear}
                variant="compact"
                showLabel={false}
                className="text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Row 2: Organization + Search */}
          <div className="flex gap-4">
            <div className="w-64">
              <label className="block text-xs text-gray-400 mb-1">Select Department</label>
              <select
                value={filterDeptId ?? ''}
                onChange={e => handleDeptFilter(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-300 appearance-none"
              >
                <option value="">All</option>
                {allDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="w-56">
              <label className="block text-xs text-gray-400 mb-1">Search indicators</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={indicatorSearch}
                  onChange={e => setIndicatorSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-300 placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Range Filter Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-400">Indicator's Performances</h2>
          <span className="text-sm italic text-gray-400">Click a card to see details</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {PERFORMANCE_RANGES.map(item => {
            const count = searchFilteredIndicators.filter(ind => matchesRange(ind.performance_percentage, item.label)).length;
            const isActive = selectedRangeLabel === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setSelectedRangeLabel(isActive ? null : item.label)}
                className={`relative bg-gray-100 rounded-xl p-5 text-center transition-all duration-200 cursor-pointer border-2 hover:shadow-md ${
                  isActive
                    ? 'border-blue-400 shadow-lg bg-blue-50/40'
                    : 'border-transparent hover:border-gray-200'
                }`}
              >
                {/* Colored left accent bar */}
                <div
                  className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="text-4xl font-bold text-gray-800 mb-1">{count}</div>
                <div className="text-sm text-gray-500 font-medium">{item.label}</div>
                <div className="text-xs text-gray-400 mt-1">{item.range}</div>
              </button>
            );
          })}
        </div>
        {selectedRangeLabel && (
          <div className="mt-3 text-right">
            <button
              onClick={() => setSelectedRangeLabel(null)}
              className="px-3 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              ✕ Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Range-filtered indicator list */}
      {selectedRangeLabel && !loading && data && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full inline-block"
                  style={{ backgroundColor: PERFORMANCE_RANGES.find(r => r.label === selectedRangeLabel)?.color }}
                />
                {selectedRangeLabel} — {rangeFilteredIndicators.length} indicator{rangeFilteredIndicators.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {rangeFilteredIndicators.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No indicators in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Indicator</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Achieved</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {rangeFilteredIndicators.map(ind => (
                      <tr
                        key={ind.id}
                        onClick={() => setModalIndicatorId(ind.id)}
                        className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs">
                          <span className="hover:text-emerald-700 transition-colors">{ind.name}</span>
                          <div className="text-xs text-gray-400 mt-0.5">{ind.unit}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ind.departmentName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right tabular-nums">{formatValue(ind.target)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right tabular-nums">{formatValue(ind.achieved)}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className="inline-block px-2.5 py-1 rounded text-xs font-bold text-white"
                            style={{ backgroundColor: getPerformanceColor(ind.performance_percentage) }}
                          >
                            {formatPct(ind.performance_percentage)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading && <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div></div>}
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center shadow-sm">{error}</div>}

        {!loading && !error && data && (
          <div className="space-y-12">
            {/* 3. Sector Performance Cards */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-emerald-600" />
                Sector Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.sectors.map(sector => (
                  <div
                    key={sector.id}
                    onClick={() => handleSectorClick(sector.id)}
                    className={`cursor-pointer bg-white rounded-2xl p-6 shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                      selectedSectorId === sector.id ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-gray-100 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-800 leading-snug pr-4">{sector.name}</h3>
                      <div
                        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-inner"
                        style={{ backgroundColor: getPerformanceColor(sector.performance_percentage) }}
                      >
                        {sector.performance_percentage !== null ? Math.round(sector.performance_percentage) + '%' : '—'}
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, sector.performance_percentage || 0)}%`,
                          backgroundColor: getPerformanceColor(sector.performance_percentage)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Department Performance Cards */}
            {selectedSector && (
              <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-2 mb-6">
                  <ChevronRight className="text-gray-400" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Departments in {selectedSector.name}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedSector.departments.map(dept => (
                    <div
                      key={dept.id}
                      onClick={() => handleDeptClick(dept.id)}
                      className={`cursor-pointer bg-white rounded-xl p-5 shadow-sm border transition-all ${
                        selectedDeptId === dept.id ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-gray-800">{dept.name}</h4>
                        <span
                          className="px-3 py-1 rounded-full text-sm font-bold text-white shadow-sm"
                          style={{ backgroundColor: getPerformanceColor(dept.performance_percentage) }}
                        >
                          {formatPct(dept.performance_percentage)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. Indicators & Groups */}
            {selectedDept && (
              <section className="animate-in fade-in slide-in-from-top-4 duration-300 bg-white rounded-2xl p-6 shadow-md border border-gray-100">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                  <Activity className="text-emerald-600" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Indicators - {selectedDept.name}
                  </h2>
                </div>

                <div className="space-y-8">
                  {/* Group Cards */}
                  {selectedDept.groups
                    .map(group => ({
                      ...group,
                      filteredIndicators: group.indicators.filter(ind => {
                        const nameMatch = !indicatorSearch || ind.name.toLowerCase().includes(indicatorSearch.toLowerCase());
                        const rangeMatch = matchesRange(ind.performance_percentage, selectedRangeLabel);
                        return nameMatch && rangeMatch;
                      }),
                    }))
                    .filter(group => group.filteredIndicators.length > 0)
                    .map(group => (
                      <div key={group.id} className="bg-gray-50/50 rounded-xl p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase mb-1 block">Indicator Group</span>
                            <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                          </div>
                          <div
                            className="px-4 py-2 rounded-lg font-bold text-white shadow-sm flex items-center gap-2"
                            style={{ backgroundColor: getPerformanceColor(group.performance_percentage) }}
                          >
                            Overall: {formatPct(group.performance_percentage)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {group.filteredIndicators.map(ind => (
                            <div
                              key={ind.id}
                              onClick={() => setModalIndicatorId(ind.id)}
                              className="bg-white p-4 rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <h5 className="font-semibold text-gray-800 text-sm leading-snug group-hover:text-emerald-700 transition-colors pr-2">
                                  {ind.name}
                                </h5>
                                <span
                                  className="px-2.5 py-1 rounded text-xs font-bold text-white shadow-sm whitespace-nowrap"
                                  style={{ backgroundColor: getPerformanceColor(ind.performance_percentage) }}
                                >
                                  {formatPct(ind.performance_percentage)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                                <span>Target: <strong className="text-gray-700">{formatValue(ind.target)}</strong></span>
                                <span>Act: <strong className="text-gray-700">{formatValue(ind.achieved)}</strong> {ind.unit}</span>
                              </div>
                              {!ind.is_aggregatable && (
                                <div className="mt-2 text-[10px] text-orange-600 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded">
                                  Non-Aggregatable
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                  {/* Ungrouped Indicators */}
                  {(() => {
                    const filtered = selectedDept.ungrouped_indicators.filter(ind => {
                      const nameMatch = !indicatorSearch || ind.name.toLowerCase().includes(indicatorSearch.toLowerCase());
                      const rangeMatch = matchesRange(ind.performance_percentage, selectedRangeLabel);
                      return nameMatch && rangeMatch;
                    });
                    return filtered.length > 0 ? (
                      <div>
                        <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-4 pl-2">Individual Indicators</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filtered.map(ind => (
                            <div
                              key={ind.id}
                              onClick={() => setModalIndicatorId(ind.id)}
                              className="bg-white p-4 rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <h5 className="font-semibold text-gray-800 text-sm leading-snug group-hover:text-emerald-700 transition-colors pr-2">
                                  {ind.name}
                                </h5>
                                <span
                                  className="px-2.5 py-1 rounded text-xs font-bold text-white shadow-sm whitespace-nowrap"
                                  style={{ backgroundColor: getPerformanceColor(ind.performance_percentage) }}
                                >
                                  {formatPct(ind.performance_percentage)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                                <span>Target: <strong className="text-gray-700">{formatValue(ind.target)}</strong></span>
                                <span>Act: <strong className="text-gray-700">{formatValue(ind.achieved)}</strong> {ind.unit}</span>
                              </div>
                              {!ind.is_aggregatable && (
                                <div className="mt-2 text-[10px] text-orange-600 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded">
                                  Non-Aggregatable
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* 6. Indicator Detail Modal */}
      {modalIndicatorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Indicator Analysis</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportModalToPng}
                  disabled={exporting}
                  title="Export as PNG"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors rounded-lg ${
                    exporting 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Exporting...' : 'Export PNG'}
                </button>
                <button
                  onClick={() => setModalIndicatorId(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {modalLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                </div>
              ) : modalData ? (
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left Side - Basic Info */}
                  <div className="w-full lg:w-1/3 space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                        {modalData.indicator.name}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
                        Unit: {modalData.indicator.unit || 'N/A'}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                      <div className="flex items-center gap-2 mb-2 text-gray-700 font-semibold">
                        <Info className="w-4 h-4 text-emerald-600" /> Description
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {modalData.indicator.description || 'No description available.'}
                      </p>
                    </div>

                    <div className="bg-emerald-50/50 rounded-xl p-5 border border-emerald-100/50">
                      <div className="flex items-center gap-2 mb-2 text-gray-700 font-semibold">
                        <TrendingUp className="w-4 h-4 text-emerald-600" /> KPI Characteristics
                      </div>
                      <p className="text-sm text-gray-600">
                        {modalData.indicator.kpi_characteristics || 'Increasing or decreasing over consecutive years based on target.'}
                      </p>
                    </div>
                  </div>

                  {/* Right Side - Visualization & Table */}
                  <div className="w-full lg:w-2/3 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Performance Trend</h3>
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setModalView('yearly')}
                          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            modalView === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Yearly
                        </button>
                        <button
                          onClick={() => setModalView('quarterly')}
                          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            modalView === 'quarterly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Quarterly
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-6">
                      {renderModalChart()}
                    </div>

                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto max-h-96">
                        {renderModalTable()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}