import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useHarStore } from '../../store/useHarStore';

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
  OPTIONS: 'text-neutral-400',
  HEAD: 'text-neutral-400',
};

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 300 && status < 400) return 'text-yellow-400';
  if (status >= 400 && status < 500) return 'text-orange-400';
  if (status >= 500) return 'text-red-400';
  return 'text-neutral-500';
}

function getDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export const RequestTable: React.FC = () => {
  const entries = useHarStore((s) => s.entries);
  const selectedEntryId = useHarStore((s) => s.selectedEntryId);
  const selectEntry = useHarStore((s) => s.selectEntry);
  const searchFilter = useHarStore((s) => s.searchFilter);
  const methodFilter = useHarStore((s) => s.methodFilter);
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredEntries = entries.filter((e) => {
    const matchesSearch = !searchFilter || e.request.url.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || e.request.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 20,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto bg-neutral-950 select-none text-xs">
      {filteredEntries.length === 0 ? (
        <div className="flex items-center justify-center h-full text-neutral-600">
          {entries.length === 0 ? 'No HAR file loaded' : 'No matching entries'}
        </div>
      ) : (
        <div
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = filteredEntries[virtualRow.index];
            const isSelected = item._id === selectedEntryId;
            const status = item.response.status;

            return (
              <div
                key={item._id}
                onClick={() => selectEntry(item._id)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`flex items-center px-3 gap-3 cursor-pointer border-b border-neutral-900/50 ${
                  isSelected
                    ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
                    : 'hover:bg-neutral-900/50 border-l-2 border-l-transparent'
                }`}
              >
                <span className={`w-10 text-right font-semibold tabular-nums ${getStatusColor(status)}`}>
                  {status || '---'}
                </span>
                <span className={`w-14 font-mono font-medium ${METHOD_COLORS[item.request.method] || 'text-neutral-400'}`}>
                  {item.request.method}
                </span>
                <span className="flex-1 truncate font-mono text-neutral-300" title={item.request.url}>
                  {item.request.url}
                </span>
                <span className="text-neutral-600 tabular-nums shrink-0">
                  {getDuration(item.time)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
