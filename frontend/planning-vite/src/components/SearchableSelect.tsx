import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface SearchableSelectProps {
  options: any[];
  value: string | number | '';
  onChange: (v: number | '') => void;
  placeholder: string;
  disabled?: boolean;
  getLabel: (o: any) => string;
  getValue: (o: any) => number;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  getLabel,
  getValue,
}: SearchableSelectProps) {
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
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all
          ${disabled
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer'
          }`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[400px] max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto overflow-x-auto">
            {value !== '' && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 italic whitespace-nowrap"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No results found</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={getValue(o)}
                  type="button"
                  onClick={() => { onChange(getValue(o)); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 hover:text-emerald-800 transition-colors whitespace-nowrap
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
