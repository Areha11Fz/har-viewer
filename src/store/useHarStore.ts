import { create } from 'zustand';
import type { HarEntry } from '../types/har';

const STORAGE_KEY = 'har-viewer:lastHar';

function loadSaved(): HarEntry[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as HarEntry[];
    if (parsed && Array.isArray((parsed as { entries?: unknown }).entries)) {
      return (parsed as { entries: HarEntry[] }).entries;
    }
    return null;
  } catch {
    return null;
  }
}

function saveEntries(entries: HarEntry[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const json = JSON.stringify(entries);
    // localStorage quota ~5-10MB; keep headroom
    if (json.length > 4.5 * 1024 * 1024) {
      console.warn('[har-viewer] HAR too large for localStorage (~4.5MB limit), skipping auto-save');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.warn('[har-viewer] localStorage save failed', e);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

const savedEntries = loadSaved();

interface HarStore {
  entries: HarEntry[];
  selectedEntryId: string | null;
  checkedEntryIds: string[];
  searchFilter: string;
  methodFilter: string;
  setHarData: (entries: HarEntry[]) => void;
  selectEntry: (id: string | null) => void;
  toggleChecked: (id: string) => void;
  setCheckedAll: (ids: string[]) => void;
  clearChecked: () => void;
  setSearchFilter: (query: string) => void;
  setMethodFilter: (method: string) => void;
}

export const useHarStore = create<HarStore>((set) => ({
  entries: savedEntries ?? [],
  selectedEntryId: savedEntries?.[0]?._id ?? null,
  checkedEntryIds: [],
  searchFilter: '',
  methodFilter: 'ALL',
  setHarData: (entries) => {
    saveEntries(entries);
    set({ entries, selectedEntryId: entries[0]?._id ?? null, checkedEntryIds: [] });
  },
  selectEntry: (id) => set({ selectedEntryId: id }),
  toggleChecked: (id) =>
    set((s) => ({
      checkedEntryIds: s.checkedEntryIds.includes(id)
        ? s.checkedEntryIds.filter((x) => x !== id)
        : [...s.checkedEntryIds, id],
    })),
  setCheckedAll: (ids) => set({ checkedEntryIds: ids }),
  clearChecked: () => set({ checkedEntryIds: [] }),
  setSearchFilter: (searchFilter) => set({ searchFilter }),
  setMethodFilter: (methodFilter) => set({ methodFilter }),
}));
