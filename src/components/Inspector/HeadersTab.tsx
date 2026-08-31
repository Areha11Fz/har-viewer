import React, { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  headers: Array<{ name: string; value: string }>;
}

export const HeadersTab: React.FC<Props> = ({ headers }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const obj: Record<string, string> = {};
    headers.forEach((h) => { obj[h.name] = h.value; });
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [headers]);

  if (headers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        No headers
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[13px] shrink-0">
        <span className="text-neutral-500">{headers.length} headers</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          title="Copy headers as JSON"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-[13px]">
          <tbody>
            {headers.map((h, i) => (
              <tr key={i} className="border-b border-neutral-900/50 hover:bg-neutral-900/30">
                <td className="px-3 py-2 text-right text-neutral-400 font-medium align-top whitespace-nowrap w-[220px]">
                  {h.name}
                </td>
                <td className="px-3 py-2 text-neutral-200 break-all">
                  {h.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
