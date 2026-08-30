import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check } from 'lucide-react';
import { decoderRegistry } from '../../decoders/registry';
import type { DecodeContext, DecodedResult } from '../../types/decoder';
import type { HarEntry } from '../../types/har';

interface Props {
  entry: HarEntry;
  onDecoderInfo?: (decoderName: string | null) => void;
}

function getMonacoLanguage(lang: string): string {
  switch (lang) {
    case 'json': return 'json';
    case 'xml': return 'xml';
    case 'html': return 'html';
    default: return 'plaintext';
  }
}

function headersToRecord(headers: Array<{ name: string; value: string }>): Record<string, string> {
  return headers.reduce((acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }), {} as Record<string, string>);
}

function isBase64Like(text: string): boolean {
  if (!text || text.length < 4) return false;
  const stripped = text.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(stripped)) return false;
  try { atob(stripped.slice(0, 64)); return true; } catch { return false; }
}

export const ResponseTab: React.FC<Props> = ({ entry, onDecoderInfo }) => {
  const content = entry.response.content;

  const reqHeaders = useMemo(() => headersToRecord(entry.request.headers), [entry.request.headers]);
  const respHeaders = useMemo(() => headersToRecord(entry.response.headers), [entry.response.headers]);

  const isBase64 = useMemo(() => {
    if (content.encoding === 'base64') return true;
    const enc = respHeaders['log-encode-type'] ?? respHeaders['x-bd-content-encoding'];
    if (enc && content.text && isBase64Like(content.text)) return true;
    return false;
  }, [content.encoding, content.text, respHeaders]);

  const context: DecodeContext = useMemo(
    () => ({
      mimeType: content.mimeType || '',
      url: entry.request.url,
      headers: respHeaders,
      requestHeaders: reqHeaders,
      isBase64,
      source: 'response',
    }),
    [entry.request.url, content.mimeType, isBase64, reqHeaders, respHeaders]
  );

  const autoDecoder = useMemo(() => decoderRegistry.findAutoDecoder(context), [context]);
  const [selectedDecoderId, setSelectedDecoderId] = useState<string>(autoDecoder?.id || 'raw');
  const [result, setResult] = useState<DecodedResult>({ data: '', language: 'text' });
  const [copied, setCopied] = useState(false);

  // Reset decoder when entry changes
  useEffect(() => {
    const newAuto = decoderRegistry.findAutoDecoder(context);
    setSelectedDecoderId(newAuto?.id || 'raw');
  }, [entry._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onDecoderInfo) {
      const decoder = decoderRegistry.get(selectedDecoderId);
      if (decoder && decoder.id !== 'raw') {
        onDecoderInfo(decoder.name);
      } else {
        onDecoderInfo(null);
      }
    }
  }, [selectedDecoderId, onDecoderInfo]);

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

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={getMonacoLanguage(result.language)}
          value={result.data}
          theme="vs-dark"
          options={{
            readOnly: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            selectOnLineNumbers: true,
            lineNumbersMinChars: 3,
          }}
        />
      </div>
    </div>
  );
};
