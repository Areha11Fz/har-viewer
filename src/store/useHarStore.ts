import { create } from 'zustand';
import type { HarEntry } from '../types/har';

interface HarStore {
  entries: HarEntry[];
  selectedEntryId: string | null;
  searchFilter: string;
  methodFilter: string;
  setHarData: (entries: HarEntry[]) => void;
  selectEntry: (id: string | null) => void;
  setSearchFilter: (query: string) => void;
  setMethodFilter: (method: string) => void;
}

export const useHarStore = create<HarStore>((set) => ({
  entries: [],
  selectedEntryId: null,
  searchFilter: '',
  methodFilter: 'ALL',
  setHarData: (entries) => set({ entries, selectedEntryId: entries[0]?._id ?? null }),
  selectEntry: (id) => set({ selectedEntryId: id }),
  setSearchFilter: (searchFilter) => set({ searchFilter }),
  setMethodFilter: (methodFilter) => set({ methodFilter }),
}));
