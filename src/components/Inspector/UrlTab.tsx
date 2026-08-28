import React, { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { HarEntry } from '../../types/har';

interface Props {
  entry: HarEntry;
}

export const UrlTab: React.FC<Props> = ({ entry }) => {
  const { request } = entry;
  const [copied, setCopied] = useState(false);

  const fullUrl = request.url;
  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    parsed = null as unknown as URL;
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [fullUrl]);

  const queryParams = request.queryString;

  return (
    <div className="h-full overflow-auto p-4 space-y-4 text-[13px]">
      {/* Method + URL */}
      <div className="space-y-1.5">
        <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Request</div>
        <div className="flex items-start gap-2">
          <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold font-mono ${
            request.method === 'GET' ? 'bg-emerald-900/50 text-emerald-300' :
            request.method === 'POST' ? 'bg-yellow-900/50 text-yellow-300' :
            request.method === 'PUT' ? 'bg-blue-900/50 text-blue-300' :
            request.method === 'DELETE' ? 'bg-red-900/50 text-red-300' :
            'bg-neutral-800 text-neutral-300'
          }`}>
            {request.method}
          </span>
          <div className="flex-1 min-w-0">
            {parsed ? (
              <div className="break-all">
                <span className="text-neutral-400">{parsed.protocol}//</span>
                <span className="text-neutral-200 font-medium">{parsed.host}</span>
                <span className="text-blue-300">{parsed.pathname}</span>
              </div>
            ) : (
              <span className="text-neutral-200 break-all">{fullUrl}</span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 text-neutral-500 hover:text-neutral-200 transition-colors p-0.5"
            title="Copy URL"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Host */}
      {parsed && (
        <div className="space-y-1.5">
          <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Host</div>
          <div className="text-neutral-200 font-mono">{parsed.host}</div>
        </div>
      )}

      {/* Pathname */}
      {parsed && (
        <div className="space-y-1.5">
          <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Path</div>
          <div className="text-blue-300 font-mono break-all">{parsed.pathname}</div>
        </div>
      )}

      {/* Query Parameters */}
      {queryParams.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">
            Query Parameters ({queryParams.length})
          </div>
          <div className="border border-neutral-800 rounded overflow-hidden">
            <table className="w-full">
              <tbody>
                {queryParams.map((p, i) => (
                  <tr key={i} className="border-b border-neutral-800/50 last:border-b-0 hover:bg-neutral-900/50">
                    <td className="px-3 py-1.5 text-right text-neutral-400 font-medium whitespace-nowrap w-[200px] align-top">
                      {p.name}
                    </td>
                    <td className="px-3 py-1.5 text-neutral-200 break-all">
                      {p.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timing */}
      <div className="space-y-1.5">
        <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Timing</div>
        <div className="text-neutral-200 font-mono">
          {entry.time >= 1000 ? `${(entry.time / 1000).toFixed(2)}s` : `${Math.round(entry.time)}ms`}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Status</div>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold ${
            entry.response.status >= 200 && entry.response.status < 300 ? 'text-emerald-400' :
            entry.response.status >= 300 && entry.response.status < 400 ? 'text-yellow-400' :
            entry.response.status >= 400 && entry.response.status < 500 ? 'text-orange-400' :
            'text-red-400'
          }`}>
            {entry.response.status}
          </span>
          <span className="text-neutral-400">{entry.response.statusText}</span>
        </div>
      </div>
    </div>
  );
};
