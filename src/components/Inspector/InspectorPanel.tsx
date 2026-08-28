import React from 'react';
import { useHarStore } from '../../store/useHarStore';
import { HeadersTab } from './HeadersTab';
import { ResponseTab } from './ResponseTab';
import { RequestBodyTab } from './RequestBodyTab';
import { UrlTab } from './UrlTab';
import { VerticalSplitPane } from '../SplitPane/VerticalSplitPane';

type TopTabId = 'url' | 'req-headers' | 'req-body';
type BottomTabId = 'resp-headers' | 'resp-body';

export const InspectorPanel: React.FC = () => {
  const entries = useHarStore((s) => s.entries);
  const selectedEntryId = useHarStore((s) => s.selectedEntryId);
  const [topTab, setTopTab] = React.useState<TopTabId>('url');
  const [bottomTab, setBottomTab] = React.useState<BottomTabId>('resp-body');

  const entry = entries.find((e) => e._id === selectedEntryId);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-[15px]">
        Select a request to inspect
      </div>
    );
  }

  const topTabs: { id: TopTabId; label: string }[] = [
    { id: 'url', label: 'URL' },
    { id: 'req-headers', label: 'Request Headers' },
    { id: 'req-body', label: 'Request Body' },
  ];

  const bottomTabs: { id: BottomTabId; label: string }[] = [
    { id: 'resp-headers', label: 'Response Headers' },
    { id: 'resp-body', label: 'Response Body' },
  ];

  return (
    <div className="flex flex-col h-full">
      <VerticalSplitPane
        defaultTopHeight={45}
        minTopHeight={20}
        maxTopHeight={80}
        top={
          <div className="flex flex-col h-full min-h-0">
            <div className="flex border-b border-neutral-800 bg-neutral-900 shrink-0">
              {topTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTopTab(tab.id)}
                  className={`px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                    topTab === tab.id
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {topTab === 'url' && <UrlTab entry={entry} />}
              {topTab === 'req-headers' && <HeadersTab headers={entry.request.headers} />}
              {topTab === 'req-body' && <RequestBodyTab entry={entry} />}
            </div>
          </div>
        }
        bottom={
          <div className="flex flex-col h-full min-h-0">
            <div className="flex border-b border-neutral-800 bg-neutral-900 shrink-0">
              {bottomTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBottomTab(tab.id)}
                  className={`px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                    bottomTab === tab.id
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {bottomTab === 'resp-headers' && <HeadersTab headers={entry.response.headers} />}
              {bottomTab === 'resp-body' && <ResponseTab entry={entry} />}
            </div>
          </div>
        }
      />
    </div>
  );
};
