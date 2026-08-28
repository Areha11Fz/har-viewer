import React from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;

export const Header: React.FC = () => {
  const searchFilter = useHarStore((s) => s.searchFilter);
  const setSearchFilter = useHarStore((s) => s.setSearchFilter);
  const methodFilter = useHarStore((s) => s.methodFilter);
  const setMethodFilter = useHarStore((s) => s.setMethodFilter);
  const entries = useHarStore((s) => s.entries);
  const setHarData = useHarStore((s) => s.setHarData);

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-[13px]">
      <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1 flex-1 max-w-xs">
        <Search size={14} className="text-neutral-500 shrink-0" />
        <input
          type="text"
          placeholder="Filter by URL..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="bg-transparent outline-none text-neutral-200 placeholder-neutral-500 w-full text-[13px]"
        />
        {searchFilter && (
          <button
            onClick={() => setSearchFilter('')}
            className="text-neutral-500 hover:text-neutral-200 transition-colors shrink-0"
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setMethodFilter(m)}
            className={`px-2 py-0.5 rounded text-[13px] font-mono transition-colors ${
              methodFilter === m
                ? m === 'ALL'
                  ? 'bg-neutral-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-neutral-500">{entries.length} entries</span>
        <button
          onClick={() => setHarData([])}
          className="text-neutral-500 hover:text-red-400 transition-colors p-1"
          title="Clear"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
