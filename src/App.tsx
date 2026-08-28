import './decoders/builtin';
import { useHarStore } from './store/useHarStore';
import { Dropzone } from './components/Dropzone';
import { Header } from './components/Header';
import { RequestTable } from './components/RequestTable/Table';
import { InspectorPanel } from './components/Inspector/InspectorPanel';

export default function App() {
  const entries = useHarStore((s) => s.entries);

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
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-neutral-800 overflow-hidden">
          <RequestTable />
        </div>
        <div className="w-1/2 overflow-hidden">
          <InspectorPanel />
        </div>
      </div>
    </div>
  );
}
