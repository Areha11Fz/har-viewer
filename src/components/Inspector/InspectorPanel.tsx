import React from 'react';
import { useHarStore } from '../../store/useHarStore';
import { HeadersTab } from './HeadersTab';
import { ResponseTab } from './ResponseTab';
import { RequestBodyTab } from './RequestBodyTab';

type TabId = 'resp-headers' | 'req-headers' | 'req-body' | 'resp-body';

export const InspectorPanel: React.FC = () => {
  const entries = useHarStore((s) => s.entries);
  const selectedEntryId = useHarStore((s) => s.selectedEntryId);
  const [activeTab, setActiveTab] = React.useState<TabId>('resp-body');

  const entry = entries.find((e) => e._id === selectedEntryId);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        Select a request to inspect
      </div>
    );
  }

  const hasBody = !!entry.request.postData?.text;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'resp-body', label: 'Response Body' },
    { id: 'resp-headers', label: 'Response Headers' },
    { id: 'req-body', label: 'Request Body' },
    { id: 'req-headers', label: 'Request Headers' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-neutral-800 bg-neutral-900">
        {tabs.map((tab) => {
          const isDisabled = tab.id === 'req-body' && !hasBody;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={isDisabled}
              className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : isDisabled
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'resp-headers' && <HeadersTab headers={entry.response.headers} />}
        {activeTab === 'req-headers' && <HeadersTab headers={entry.request.headers} />}
        {activeTab === 'req-body' && <RequestBodyTab entry={entry} />}
        {activeTab === 'resp-body' && <ResponseTab entry={entry} />}
      </div>
    </div>
  );
};
