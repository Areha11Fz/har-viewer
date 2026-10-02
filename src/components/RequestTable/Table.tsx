import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useHarStore } from '../../store/useHarStore';
import { matchesEntry } from '../../utils/entrySearch';

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
  const checkedEntryIds = useHarStore((s) => s.checkedEntryIds);
  const toggleChecked = useHarStore((s) => s.toggleChecked);

  const lowercaseQuery = searchFilter.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!lowercaseQuery && methodFilter === 'ALL') return entries;
    return entries.filter((e) => {
      if (methodFilter !== 'ALL' && e.request.method !== methodFilter) return false;
      if (!lowercaseQuery) return true;
      return matchesEntry(e, lowercaseQuery);
    });
  }, [entries, lowercaseQuery, methodFilter]);

  const checkedSet = useMemo(() => new Set(checkedEntryIds), [checkedEntryIds]);

  const rowVirtualizer = useVirtualizer({
    count: filteredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  });

  useEffect(() => {
    parentRef.current?.focus();
  }, [entries.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredEntries.length === 0) return;
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
    let nextIndex = -1;
    const currentIndex = filteredEntries.findIndex((en) => en._id === selectedEntryId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = currentIndex === -1 ? 0 : Math.min(filteredEntries.length - 1, currentIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = filteredEntries.length - 1;
    } else {
      return;
    }
    const next = filteredEntries[nextIndex];
    if (next) {
      selectEntry(next._id);
      rowVirtualizer.scrollToIndex(nextIndex, { align: 'auto' });
    }
  }, [filteredEntries, selectedEntryId, selectEntry, rowVirtualizer]);

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      // Only handle if left pane is in viewport and no modal is open
      if (!parentRef.current) return;
      handleKeyDown(e as unknown as React.KeyboardEvent);
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [handleKeyDown]);

  return (
    <div ref={parentRef} tabIndex={0} className="h-full overflow-auto bg-neutral-950 select-none text-[13px] outline-none focus:outline-none">
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
            const isChecked = checkedSet.has(item._id);
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
                className={`flex items-center px-2 gap-2 cursor-pointer border-b border-neutral-900/50 ${
                  isSelected
                    ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
                    : 'hover:bg-neutral-900/50 border-l-2 border-l-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleChecked(item._id)}
                  className="shrink-0 w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                  title="Select for export"
                />
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
