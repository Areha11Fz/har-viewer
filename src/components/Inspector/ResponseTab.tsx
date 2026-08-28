import React, { useEffect, useState, useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { html } from '@codemirror/lang-html';
import { Copy, Check } from 'lucide-react';
import { editorTheme } from './theme';
import { decoderRegistry } from '../../decoders/registry';
import type { DecodeContext, DecodedResult } from '../../types/decoder';
import type { HarEntry } from '../../types/har';

interface Props {
  entry: HarEntry;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'json': return [json()];
    case 'xml': return [xml()];
    case 'html': return [html()];
    default: return [];
  }
}

export const ResponseTab: React.FC<Props> = ({ entry }) => {
  const content = entry.response.content;
  const isBase64 = content.encoding === 'base64';

  const context: DecodeContext = useMemo(
    () => ({
      mimeType: content.mimeType || '',
      url: entry.request.url,
      headers: entry.response.headers.reduce(
        (acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }),
        {} as Record<string, string>
      ),
      isBase64,
    }),
    [entry, content.mimeType, isBase64]
  );

  const autoDecoder = useMemo(() => decoderRegistry.findAutoDecoder(context), [context]);
  const [selectedDecoderId, setSelectedDecoderId] = useState<string>(autoDecoder?.id || 'raw');
  const [result, setResult] = useState<DecodedResult>({ data: '', language: 'text' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!content.text) {
      setResult({ data: '[No response body]', language: 'text' });
      return;
    }
    let cancelled = false;
    decoderRegistry.runDecoder(selectedDecoderId, content.text, context).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => { cancelled = true; };
  }, [selectedDecoderId, content.text, context]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result.data).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [result.data]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Decoder:</span>
          <select
            value={selectedDecoderId}
            onChange={(e) => setSelectedDecoderId(e.target.value)}
            className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-0.5 text-[13px] outline-none focus:border-blue-500"
          >
            {decoderRegistry.getAll().map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.id === autoDecoder?.id ? '(Auto)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-neutral-600">
            {content.mimeType} | {(content.size / 1024).toFixed(1)} KB
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200 transition-colors"
            title="Copy response body"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {result.error && (
        <div className="bg-red-950/50 text-red-400 text-[13px] px-3 py-1 border-b border-red-900/50">
          {result.error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={result.data}
          height="100%"
          theme={editorTheme}
          extensions={getLanguageExtension(result.language)}
          editable={false}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
        />
      </div>
    </div>
  );
};
