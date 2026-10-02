import React from 'react';
import { Search, Trash2, X, FileDown, Check, ChevronDown } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import { markdownForAll } from '../utils/markdownExport';
import { matchesEntry } from '../utils/entrySearch';

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;

function getOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return url.split('/').slice(0, 3).join('/'); }
}

export const Header: React.FC = () => {
  const searchFilter = useHarStore((s) => s.searchFilter);
  const setSearchFilter = useHarStore((s) => s.setSearchFilter);
  const methodFilter = useHarStore((s) => s.methodFilter);
  const setMethodFilter = useHarStore((s) => s.setMethodFilter);
  const entries = useHarStore((s) => s.entries);
  const setHarData = useHarStore((s) => s.setHarData);
  const checkedEntryIds = useHarStore((s) => s.checkedEntryIds);
  const setCheckedAll = useHarStore((s) => s.setCheckedAll);
  const clearChecked = useHarStore((s) => s.clearChecked);
  const [exported, setExported] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportedSelected, setExportedSelected] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);

  const lowercaseQuery = searchFilter.trim().toLowerCase();

  const filteredEntries = React.useMemo(() => {
    if (!lowercaseQuery && methodFilter === 'ALL') return entries;
    return entries.filter((e) => {
      if (methodFilter !== 'ALL' && e.request.method !== methodFilter) return false;
      if (!lowercaseQuery) return true;
      return matchesEntry(e, lowercaseQuery);
    });
  }, [entries, lowercaseQuery, methodFilter]);

  const checkedSet = React.useMemo(() => new Set(checkedEntryIds), [checkedEntryIds]);
  const allFilteredChecked = filteredEntries.length > 0 && filteredEntries.every((e) => checkedSet.has(e._id));

  const origins = React.useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const o = getOrigin(e.request.url);
      map.set(o, (map.get(o) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const doExport = React.useCallback(async (origin: string | null) => {
    const filtered = origin ? entries.filter((e) => getOrigin(e.request.url) === origin) : entries;
    if (filtered.length === 0) return;
    const md = await markdownForAll(filtered);
    await navigator.clipboard.writeText(md);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeHost = origin ? origin.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_') : 'all';
    a.download = `har-export-${safeHost}-${filtered.length}entries.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExported(true);
    setExportOpen(false);
    setTimeout(() => setExported(false), 2000);
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800 text-[13px]">
      <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1 flex-1 max-w-xs">
        <Search size={14} className="text-neutral-500 shrink-0" />
        <input
          type="text"
          placeholder="Filter by URL, headers, body..."
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
        {checkedEntryIds.length > 0 && (
          <span className="text-blue-400">{checkedEntryIds.length} selected</span>
        )}
        <button
          onClick={() => {
            if (allFilteredChecked) clearChecked();
            else setCheckedAll(filteredEntries.map((e) => e._id));
          }}
          className="px-2 py-0.5 rounded text-xs border bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700 transition-colors"
          title={allFilteredChecked ? 'Unselect all (filtered)' : 'Select all (filtered)'}
        >
          {allFilteredChecked ? 'Unselect all' : 'Select all'}
        </button>
        {checkedEntryIds.length > 0 && (
          <>
            <button
              onClick={clearChecked}
              className="px-2 py-0.5 rounded text-xs border bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700 transition-colors"
              title="Clear selection"
            >
              Clear selection
            </button>
            <button
              onClick={async () => {
                const selected = entries.filter((e) => checkedSet.has(e._id));
                if (selected.length === 0) return;
                const md = await markdownForAll(selected);
                await navigator.clipboard.writeText(md);
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `har-export-selected-${selected.length}entries.md`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setExportedSelected(true);
                setTimeout(() => setExportedSelected(false), 2000);
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
                exportedSelected ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-800/50'
              }`}
              title="Export selected entries to Markdown (LLM)"
            >
              {exportedSelected ? <Check size={12} /> : <FileDown size={12} />}
              {exportedSelected ? 'Copied' : `Export selected (${checkedEntryIds.length})`}
            </button>
          </>
        )}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
              exported ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
            }`}
            title="Export to Markdown (LLM)"
          >
            {exported ? <Check size={12} /> : <FileDown size={12} />}
            {exported ? 'Copied' : 'Export MD'}
            <ChevronDown size={10} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-72 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-20 overflow-hidden">
              <button
                onClick={() => doExport(null)}
                className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                All hosts — {entries.length} entries
              </button>
              {origins.map(([origin, count]) => (
                <button
                  key={origin}
                  onClick={() => doExport(origin)}
                  className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors border-t border-neutral-700/50 truncate"
                  title={origin}
                >
                  {origin} — {count} {count === 1 ? 'entry' : 'entries'}
                </button>
              ))}
            </div>
          )}
        </div>
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
