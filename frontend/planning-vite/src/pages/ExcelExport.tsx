import { useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { currentEthiopianYear, toGregorianYearFromEthiopian } from '../lib/ethiopian';

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodOption = {
  value: string;
  label: string;
  sublabel: string;
  quarter: number;
  months: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '3',  label: '3-Month Report',  sublabel: 'Q1 — First Quarter',  quarter: 1, months: 3  },
  { value: '6',  label: '6-Month Report',  sublabel: 'Q2 — Second Quarter', quarter: 2, months: 6  },
  { value: '9',  label: '9-Month Report',  sublabel: 'Q3 — Third Quarter',  quarter: 3, months: 9  },
  { value: '12', label: '12-Month Report', sublabel: 'Q4 — Fourth Quarter', quarter: 4, months: 12 },
];

// const COLUMN_DESCRIPTIONS = [
//   { col: 'A', header: 'የቁልፍ አፈፃፀም አመልካቾች',                      desc: 'Indicator name' },
//   { col: 'B', header: 'መለኪያ',                     desc: 'Measurement unit (%, number, etc.)' },
//   { col: 'C', header: 'የ[Year] ዕቅድ',              desc: 'Full annual target for the KPI' },
//   { col: 'D', header: 'የQ[X]ኛ ሩብ ዓመት ዒላማ',               desc: 'Quarterly plan target for the selected quarter only' },
//   { col: 'E', header: 'የQ[X]ኛ ሩብ ዓመት አፈፃፀም',        desc: 'Actual result for the selected quarter only' },
//   { col: 'F', header: 'የ[N] ወር ዒላማ',   desc: 'Cumulative plan from Q1 up to selected quarter' },
//   { col: 'G', header: 'የ[N] ወር አፈፃፀም',   desc: 'Cumulative actual performance from Q1 up to selected quarter' },
//   { col: 'H', header: 'የ[N] ወር አፈፃፀም በመቶኛ', desc: 'Cumulative performance ÷ cumulative plan × 100' },
// ];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExcelExport() {
  const thisEthYear = currentEthiopianYear();

  const [ethYear, setEthYear]   = useState<number>(thisEthYear);
  const [period, setPeriod]     = useState<string>('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const gregYear      = toGregorianYearFromEthiopian(ethYear);
  const ethYearOpts   = Array.from({ length: 10 }, (_, i) => thisEthYear - 4 + i);
  const selectedPeriod = PERIOD_OPTIONS.find((p) => p.value === period) ?? null;

  const canDownload = !!period;

  async function handleDownload() {
    if (!canDownload) return;
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const url   = `${API_BASE_URL}/api/excel-export/?year=${gregYear}&period=${period}`;

      const res = await fetch(url, {
        headers: { Authorization: `Token ${token}` },
      });

      if (!res.ok) {
        let detail = `Server error (${res.status})`;
        try {
          const json = await res.json();
          detail = json.detail || detail;
        } catch {
          // non-JSON body
        }
        throw new Error(detail);
      }

      const blob        = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a           = document.createElement('a');
      a.href            = downloadUrl;
      a.download        = `MOA_Q${selectedPeriod!.quarter}_${period}Month_Report_${gregYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 flex items-center justify-center shadow-md flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 1.5V9h4.5L13 3.5zM12 17l-4-4h2.5v-3h3v3H16l-4 4z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Excel Export</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Generate a structured spreadsheet of KPI plan &amp; performance data for a reporting period.
            </p>
          </div>
        </div>

        {/* ── Selection card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.25 5.61C6.57 8.59 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.43-4.41 5.75-7.39c.51-.66.04-1.61-.79-1.61H5.04c-.83 0-1.3.95-.79 1.61z"/>
            </svg>
            <h2 className="font-semibold text-gray-800 text-sm">Select Reporting Parameters</h2>
          </div>

          <div className="p-6 space-y-6">

            {/* Year selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Reporting Year
              </label>
              <select
                value={ethYear}
                onChange={(e) => setEthYear(Number(e.target.value))}
                className="w-full sm:w-72 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-white shadow-sm"
              >
                {ethYearOpts.map((y) => (
                  <option key={y} value={y}>
                    {y} EC &nbsp;({toGregorianYearFromEthiopian(y)} GC)
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-400">
                Ethiopian Calendar year — Gregorian year shown in parentheses
              </p>
            </div>

            {/* Period selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Reporting Period
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PERIOD_OPTIONS.map((opt) => {
                  const active = period === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setPeriod(opt.value); setSuccess(false); setError(null); }}
                      className={`
                        relative flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-xl border-2 transition-all text-center
                        ${active
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                        }
                      `}
                    >
                      {active && (
                        <span className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </span>
                      )}
                      <span className={`text-base font-bold ${active ? 'text-emerald-700' : 'text-gray-800'}`}>
                        Q{opt.quarter}
                      </span>
                      <span className={`text-xs font-semibold ${active ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {opt.label}
                      </span>
                      <span className={`text-[10px] leading-tight ${active ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {opt.sublabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Selecting a period also includes cumulative totals from all previous quarters.
              </p>
            </div>

            {/* Summary banner when both are selected */}
            {selectedPeriod && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <div className="text-sm text-emerald-800">
                  <span className="font-semibold">Ready to export: </span>
                  {ethYear} EC ({gregYear} GC) · {selectedPeriod.label} ·{' '}
                  Reports Q{selectedPeriod.quarter} data with {selectedPeriod.months}-month cumulative totals
                </div>
              </div>
            )}

            {/* Error / success */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-red-700">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-700 font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                File downloaded successfully!
              </div>
            )}

            {/* Download button */}
            <div className="flex items-center gap-4 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!canDownload || loading}
                className="
                  flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md
                  hover:from-emerald-700 hover:to-green-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all active:scale-95
                "
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    Download Excel
                  </>
                )}
              </button>
              {!canDownload && (
                <span className="text-xs text-gray-400 italic">
                  Select a reporting period to enable download
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Column reference card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 2v4H6V4h12zM4 20V10h16v10H4z"/>
            </svg>
            <h2 className="font-semibold text-gray-700 text-sm">File Structure — 8 Columns</h2>
          </div>
          {/* <div className="divide-y divide-gray-50">
            {COLUMN_DESCRIPTIONS.map((c, i) => (
              <div key={c.col} className={`flex items-start gap-4 px-6 py-3 ${i % 2 === 1 ? 'bg-gray-50/60' : ''}`}>
                <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {c.col}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-800 block">
                    {selectedPeriod
                      ? c.header
                          .replace('[Year]', String(gregYear))
                          .replace('[X]', String(selectedPeriod.quarter))
                          .replace('[N]', String(selectedPeriod.months))
                      : c.header}
                  </span>
                  <span className="text-xs text-gray-500">{c.desc}</span>
                </div>
              </div>
            ))}
          </div> */}
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-start gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            Rows are grouped by Sector and Department. Cumulative columns only sum applicable quarters per indicator.
          </div>
        </div>

      </div>
    </div>
  );
}
