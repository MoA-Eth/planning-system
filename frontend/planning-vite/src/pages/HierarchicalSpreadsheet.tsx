import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getCurrentEthiopianDate, toGregorianYearFromEthiopian } from '../lib/ethiopian';
import {
  ChevronRight,
  ChevronDown,
  Table2,
  BarChart3,
  Filter,
  Download,
  Search,
  Layers,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type SpreadsheetRow = {
  type: 'group' | 'indicator';
  id: number;
  name: string;
  unit: string;
  baseline: number | null;
  is_aggregatable: boolean;
  is_label: boolean;
  annual_target: number | null;
  sector_name: string;
  department_name: string;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q1_display: string;
  q2_display: string;
  q3_display: string;
  q4_display: string;
  q1_status?: string;
  q2_status?: string;
  q3_status?: string;
  q4_status?: string;
  breakdown_status?: string;
  children?: SpreadsheetRow[];
  indicators?: SpreadsheetRow[];
};

type SectorOption = { id: number; name: string };

// ─── Flatten helper ──────────────────────────────────────────────────────────

type FlatRow = SpreadsheetRow & { level: number; hasChildren: boolean; nodeKey: string };

function flattenTree(
  nodes: SpreadsheetRow[],
  level: number,
  expanded: Set<string>,
  parentKey: string
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    const nodeKey = `${parentKey}/${node.type}-${node.id}`;
    const childGroups = node.children || [];
    const childIndicators = node.indicators || [];
    const hasChildren = childGroups.length > 0 || childIndicators.length > 0;

    rows.push({ ...node, level, hasChildren, nodeKey });

    if (hasChildren && expanded.has(nodeKey)) {
      // Child groups first, then indicators
      rows.push(...flattenTree(childGroups, level + 1, expanded, nodeKey));
      rows.push(...flattenTree(childIndicators, level + 1, expanded, nodeKey));
    }
  }
  return rows;
}

function flattenAll(
  nodes: SpreadsheetRow[],
  level: number,
  parentKey: string
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    const nodeKey = `${parentKey}/${node.type}-${node.id}`;
    const childGroups = node.children || [];
    const childIndicators = node.indicators || [];
    const hasChildren = childGroups.length > 0 || childIndicators.length > 0;

    rows.push({ ...node, level, hasChildren, nodeKey });

    if (hasChildren) {
      rows.push(...flattenAll(childGroups, level + 1, nodeKey));
      rows.push(...flattenAll(childIndicators, level + 1, nodeKey));
    }
  }
  return rows;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HierarchicalSpreadsheet() {
  useAuth();
  const thisYear = getCurrentEthiopianDate()[0];

  const [viewType, setViewType] = useState<'plan' | 'performance'>('plan');
  const [year, setYear] = useState<number>(thisYear);
  const [sectorId, setSectorId] = useState<number | ''>('');
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [tree, setTree] = useState<SpreadsheetRow[]>([]);
  const [ungrouped, setUngrouped] = useState<SpreadsheetRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gregYear = toGregorianYearFromEthiopian(year);
      const params: Record<string, string | number> = { year: gregYear, view_type: viewType };
      if (sectorId) params.sector_id = sectorId;
      const res = await api.get('/api/hierarchical-spreadsheet/', { params });
      const data = res.data;
      setTree(data.tree || []);
      setUngrouped(data.ungrouped || []);
      if (data.sectors) setSectors(data.sectors);
      if (!sectorId && data.sector_id) setSectorId(data.sector_id);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [year, viewType, sectorId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Expand / collapse ──────────────────────────────────────────────────────

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    const collect = (nodes: SpreadsheetRow[], parentKey: string) => {
      for (const n of nodes) {
        const key = `${parentKey}/${n.type}-${n.id}`;
        keys.add(key);
        if (n.children) collect(n.children, key);
        if (n.indicators) collect(n.indicators, key);
      }
    };
    collect(tree, '');
    collect(ungrouped, '/ungrouped');
    setExpanded(keys);
  };

  const collapseAll = () => setExpanded(new Set());

  // ── Flatten rows ───────────────────────────────────────────────────────────

  const flatRows = [
    ...flattenTree(tree, 0, expanded, ''),
    ...flattenTree(ungrouped, 0, expanded, '/ungrouped'),
  ];

  // ── Search filter ──────────────────────────────────────────────────────────

  const filteredRows = searchQuery.trim()
    ? flatRows.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : flatRows;

  // ── Format helpers ─────────────────────────────────────────────────────────

  const fmt = (v: number | null) => (v !== null ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

  // ── CSV export ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const allRows = [
      ...flattenAll(tree, 0, ''),
      ...flattenAll(ungrouped, 0, '/ungrouped'),
    ];
    const header = ['Level', 'Type', 'Sector', 'Department', 'Indicator Name', 'Unit', 'Baseline', 'Annual Target', 'Q1', 'Q2', 'Q3', 'Q4'];
    const csvRows = [header.join(',')];
    for (const r of allRows) {
      csvRows.push([
        r.level,
        r.type,
        `"${r.sector_name || ''}"`,
        `"${r.department_name || ''}"`,
        `"${r.name}"`,
        `"${r.unit}"`,
        r.baseline ?? '',
        r.annual_target ?? '',
        r.q1_display || '',
        r.q2_display || '',
        r.q3_display || '',
        r.q4_display || '',
      ].join(','));
    }
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spreadsheet_${viewType}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Row styles ─────────────────────────────────────────────────────────────

  const rowBg = (r: FlatRow) => {
    if (r.type === 'group' && r.is_label) return 'bg-gray-100';
    if (r.type === 'group') return 'bg-emerald-50';
    return 'bg-white';
  };

  const rowFont = (r: FlatRow) => {
    if (r.type === 'group') return 'font-semibold';
    return 'font-normal';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Table2 className="w-6 h-6 text-emerald-600" />
          Hierarchical Spreadsheet
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View type toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewType('plan')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewType === 'plan' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Layers className="w-4 h-4 inline mr-1" /> Plan
            </button>
            <button
              onClick={() => setViewType('performance')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewType === 'performance' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" /> Performance
            </button>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap bg-white p-3 rounded-lg shadow-sm border border-gray-100">
        <Filter className="w-4 h-4 text-gray-400" />

        {/* Year selector */}
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
        >
          {Array.from({ length: 10 }, (_, i) => thisYear - 3 + i).map((y) => (
            <option key={y} value={y}>{y} EC ({toGregorianYearFromEthiopian(y)} GC)</option>
          ))}
        </select>

        {/* Sector selector */}
        {sectors.length > 1 && (
          <select
            value={sectorId}
            onChange={(e) => setSectorId(Number(e.target.value))}
            className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search indicators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Expand / Collapse */}
        <button onClick={expandAll} className="text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600">
          Expand All
        </button>
        <button onClick={collapseAll} className="text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600">
          Collapse All
        </button>

        {/* CSV Export */}
        <button onClick={exportCSV} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[320px]">
                Indicator Name
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-700 min-w-[140px]">Sector</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-700 min-w-[140px]">Department</th>
              <th className="text-center px-3 py-2.5 font-semibold text-gray-700 w-20">Unit</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Baseline</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Annual Target</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Q1</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Q2</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Q3</th>
              <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Q4</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-400">No data found</td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.nodeKey}
                  className={`${rowBg(row)} border-b border-gray-100 hover:bg-gray-50/60 transition-colors`}
                >
                  {/* Name cell with indent & expand toggle */}
                  <td
                    className={`px-3 py-2 sticky left-0 ${rowBg(row)} ${rowFont(row)} text-gray-800`}
                    style={{ paddingLeft: `${12 + row.level * 24}px` }}
                  >
                    <div className="flex items-center gap-1">
                      {row.hasChildren ? (
                        <button
                          onClick={() => toggleExpand(row.nodeKey)}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200/60 flex-shrink-0"
                        >
                          {expanded.has(row.nodeKey) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      ) : (
                        <span className="w-5 flex-shrink-0" />
                      )}
                      <span className="truncate">
                        {row.type === 'group' && row.is_label ? (
                          <span className="italic text-gray-500">{row.name}</span>
                        ) : row.type === 'group' ? (
                          <span className="text-emerald-800">{row.name}</span>
                        ) : (
                          row.name
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Sector */}
                  <td className="text-left px-3 py-2 text-gray-500 text-xs">{row.sector_name || ''}</td>

                  {/* Department */}
                  <td className="text-left px-3 py-2 text-gray-500 text-xs">{row.department_name || ''}</td>

                  {/* Unit */}
                  <td className="text-center px-3 py-2 text-gray-500">{row.unit || ''}</td>

                  {/* Baseline */}
                  <td className="text-right px-3 py-2 text-gray-600 font-mono text-xs">
                    {row.baseline !== null ? fmt(row.baseline) : ''}
                  </td>

                  {/* Annual Target */}
                  <td className={`text-right px-3 py-2 font-mono text-xs ${row.type === 'group' ? 'text-emerald-700 font-semibold' : 'text-gray-700'}`}>
                    {row.annual_target !== null ? fmt(row.annual_target) : ''}
                  </td>

                  {/* Q1-Q4 */}
                  {[1, 2, 3, 4].map((q) => {
                    const display = (row as any)[`q${q}_display`] as string;
                    const val = (row as any)[`q${q}`] as number | null;
                    const isNA = display === 'N/A';
                    const isEmpty = display === '-' || display === '';
                    return (
                      <td
                        key={q}
                        className={`text-right px-3 py-2 font-mono text-xs ${
                          isNA
                            ? 'text-gray-400 italic'
                            : isEmpty
                            ? 'text-gray-300'
                            : row.type === 'group'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-gray-700'
                        }`}
                      >
                        {isNA ? 'N/A' : isEmpty ? '-' : val !== null ? fmt(val) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      {!loading && filteredRows.length > 0 && (
        <div className="text-xs text-gray-400 px-1">
          {filteredRows.filter((r) => r.type === 'indicator').length} indicators &middot;{' '}
          {filteredRows.filter((r) => r.type === 'group').length} groups &middot;{' '}
          Showing {viewType === 'plan' ? 'Plan / Breakdown' : 'Performance'} data for {year} EC
        </div>
      )}
    </div>
  );
}
