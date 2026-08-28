import React from 'react';
import { useHarStore } from '../../store/useHarStore';
import { HeadersTab } from './HeadersTab';
import { ResponseTab } from './ResponseTab';

type TabId = 'headers' | 'request' | 'response';

export const InspectorPanel: React.FC = () => {
  const entries = useHarStore((s) => s.entries);
  const selectedEntryId = useHarStore((s) => s.selectedEntryId);
  const [activeTab, setActiveTab] = React.useState<TabId>('response');

  const entry = entries.find((e) => e._id === selectedEntryId);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        Select a request to inspect
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'headers', label: 'Response Headers' },
    { id: 'request', label: 'Request Headers' },
    { id: 'response', label: 'Response Body' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-neutral-800 bg-neutral-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'headers' && <HeadersTab headers={entry.response.headers} />}
        {activeTab === 'request' && <HeadersTab headers={entry.request.headers} />}
        {activeTab === 'response' && <ResponseTab entry={entry} />}
      </div>
    </div>
  );
};
