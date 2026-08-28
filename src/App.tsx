import { useEffect } from 'react';
import './decoders/builtin';
import { useHarStore } from './store/useHarStore';
import { Dropzone } from './components/Dropzone';
import { Header } from './components/Header';
import { RequestTable } from './components/RequestTable/Table';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { SplitPane } from './components/SplitPane/SplitPane';

export default function App() {
  const entries = useHarStore((s) => s.entries);
  const setHarData = useHarStore((s) => s.setHarData);

  useEffect(() => {
    if (entries.length === 0) {
      try {
        const raw = localStorage.getItem('har-viewer:lastHar');
        if (raw) {
          const parsed = JSON.parse(raw);
          const saved = Array.isArray(parsed) ? parsed : parsed?.entries;
          if (Array.isArray(saved) && saved.length > 0) {
            setHarData(saved);
          }
        }
      } catch { /* ignore */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (entries.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-neutral-950">
        <div className="flex items-center px-4 py-2 bg-neutral-900 border-b border-neutral-800">
          <span className="text-sm font-semibold text-neutral-200 tracking-tight">HAR Viewer</span>
        </div>
        <div className="flex-1">
          <Dropzone />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950">
      <div className="flex items-center px-4 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-sm font-semibold text-neutral-200 tracking-tight">HAR Viewer</span>
      </div>
      <Header />
      <SplitPane
        left={<RequestTable />}
        right={<InspectorPanel />}
        defaultLeftWidth={50}
        minLeftWidth={25}
        maxLeftWidth={75}
      />
    </div>
  );
}
