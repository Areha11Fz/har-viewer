import React from 'react';

interface Props {
  headers: Array<{ name: string; value: string }>;
}

export const HeadersTab: React.FC<Props> = ({ headers }) => {
  if (headers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        No headers
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <tbody>
          {headers.map((h, i) => (
            <tr key={i} className="border-b border-neutral-900/50">
              <td className="px-3 py-1.5 text-right text-neutral-400 font-mono font-medium align-top whitespace-nowrap w-[200px]">
                {h.name}
              </td>
              <td className="px-3 py-1.5 text-neutral-200 font-mono break-all">
                {h.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
