import React, { useCallback, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { Copy, Check } from 'lucide-react';
import { editorTheme } from './theme';
import type { HarEntry } from '../../types/har';

interface Props {
  entry: HarEntry;
}

function formatBody(body: string, mimeType: string): { text: string; language: string } {
  if (mimeType.includes('json')) {
    try {
      return { text: JSON.stringify(JSON.parse(body), null, 2), language: 'json' };
    } catch {
      return { text: body, language: 'text' };
    }
  }
  if (mimeType.includes('xml') || mimeType.includes('html')) {
    return { text: body, language: mimeType.includes('xml') ? 'xml' : 'html' };
  }
  // Try JSON anyway
  try {
    const parsed = JSON.parse(body);
    return { text: JSON.stringify(parsed, null, 2), language: 'json' };
  } catch {
    return { text: body, language: 'text' };
  }
}

export const RequestBodyTab: React.FC<Props> = ({ entry }) => {
  const postData = entry.request.postData;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!postData?.text) return;
    navigator.clipboard.writeText(postData.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [postData?.text]);

  if (!postData || !postData.text) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        No request body
      </div>
    );
  }

  const { text, language } = formatBody(postData.text, postData.mimeType);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Content-Type:</span>
          <span className="text-neutral-300">{postData.mimeType}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          title="Copy request body"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={text}
          height="100%"
          theme={editorTheme}
          extensions={language === 'json' ? [json()] : []}
          editable={false}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
        />
      </div>
    </div>
  );
};
