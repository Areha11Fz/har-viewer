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
  );
};
