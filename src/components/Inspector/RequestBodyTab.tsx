import React, { useCallback, useState, useEffect, useMemo } from 'react';
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

function detectBase64(text: string, mimeType: string, headers: Record<string, string>): boolean {
  if (headers['x-bd-content-encoding'] || headers['log-encode-type']) return true;
  const enc = (headers['content-encoding'] || '').toLowerCase();
  if (enc === 'gzip' || enc === 'zstd' || enc === 'br') return true;
  if (mimeType.includes('octet-stream') || mimeType.includes('gzip') || mimeType.includes('zstd') || mimeType.includes('protobuf')) return true;
  if (text.length < 4) return false;
  const stripped = text.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(stripped)) return false;
  try { atob(stripped.slice(0, 64)); return true; } catch { return false; }
}

function extractBodyText(entry: HarEntry): { text: string; mimeType: string; encoding?: string } | null {
  const postData = entry.request.postData;
  if (postData?.text) {
    return { text: postData.text, mimeType: postData.mimeType || '', encoding: postData.encoding as string | undefined };
  }
  if (postData?.params && postData.params.length > 0) {
    const paramsText = JSON.stringify(postData.params, null, 2);
    return { text: paramsText, mimeType: postData.mimeType || 'application/json' };
  }
  const raw = entry.request as unknown as Record<string, unknown>;
  const reqHeaders = (entry.request.headers as Array<{ name: string; value: string }>) || [];
  const contentType = reqHeaders.find((h) => h.name.toLowerCase() === 'content-type')?.value || (postData?.mimeType as string) || '';

  const candidates: unknown[] = [
    raw['_content'],
    raw['content'],
    raw['_postData'],
    raw['body'],
    raw['_requestBody'],
    (raw as Record<string, unknown>)['_content'],
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.length > 0) {
      return { text: c, mimeType: contentType, encoding: undefined };
    }
    if (typeof c === 'object') {
      const obj = c as Record<string, unknown>;
      const text = (obj['text'] as string) ?? (obj['data'] as string) ?? (obj['content'] as string) ?? (obj['body'] as string);
      if (typeof text === 'string' && text.length > 0) {
        return {
          text,
          mimeType: (obj['mimeType'] as string) || contentType,
          encoding: obj['encoding'] as string | undefined,
        };
      }
      if (typeof obj['text'] === 'string') {
        return {
          text: obj['text'] as string,
          mimeType: (obj['mimeType'] as string) || contentType,
          encoding: obj['encoding'] as string | undefined,
        };
      }
    }
  }
  const directContent = raw['_content'];
  if (typeof directContent === 'string' && directContent.length > 0) {
    return { text: directContent, mimeType: contentType };
  }
  return null;
}

export const RequestBodyTab: React.FC<Props> = ({ entry, onDecoderInfo }) => {
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<DecodedResult>({ data: '', language: 'text' });

  const extracted = useMemo(() => extractBodyText(entry), [entry]);
  const bodyText = extracted?.text ?? '';
  const mimeType = extracted?.mimeType ?? entry.request.postData?.mimeType ?? '';

  const reqHeaders = useMemo(() => headersToRecord(entry.request.headers), [entry.request.headers]);
  const respHeaders = useMemo(() => headersToRecord(entry.response.headers), [entry.response.headers]);

  const isBase64 = useMemo(() => {
    if (!bodyText) return false;
    if (extracted?.encoding === 'base64') return true;
    return detectBase64(bodyText, mimeType, reqHeaders);
  }, [bodyText, mimeType, reqHeaders, extracted?.encoding]);

  const context: DecodeContext = useMemo(
    () => ({
      mimeType,
      url: entry.request.url,
      headers: respHeaders,
      requestHeaders: reqHeaders,
      isBase64,
      source: 'request',
    }),
    [entry.request.url, mimeType, respHeaders, reqHeaders, isBase64]
  );

  const autoDecoder = useMemo(() => decoderRegistry.findAutoDecoder(context), [context]);
  const [selectedDecoderId, setSelectedDecoderId] = useState<string>(autoDecoder?.id || 'raw');

  useEffect(() => {
    const newAuto = decoderRegistry.findAutoDecoder(context);
    setSelectedDecoderId(newAuto?.id || 'raw');
  }, [entry._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onDecoderInfo) {
      const decoder = decoderRegistry.get(selectedDecoderId);
      if (decoder && decoder.id !== 'raw') onDecoderInfo(decoder.name);
      else onDecoderInfo(null);
    }
  }, [selectedDecoderId, onDecoderInfo]);

  useEffect(() => {
    if (!bodyText) {
      setResult({ data: '', language: 'text' });
      return;
    }
    let cancelled = false;
    decoderRegistry.runDecoder(selectedDecoderId, bodyText, context).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => { cancelled = true; };
  }, [selectedDecoderId, bodyText, context]);

  const handleCopy = useCallback(() => {
    const text = result.data || bodyText;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [result.data, bodyText]);

  if (!extracted) {
    const raw = entry.request as unknown as Record<string, unknown>;
    const contentPreview = (() => {
      const c = raw['_content'] ?? raw['content'] ?? raw['_postData'];
      if (!c) return 'undefined';
      if (typeof c === 'string') return c.slice(0, 500) + (c.length > 500 ? '…' : '');
      try { return JSON.stringify(c, null, 2).slice(0, 800); } catch { return String(c).slice(0, 500); }
    })();
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[13px]">
          <span className="text-neutral-500">No request body detected</span>
          <span className="text-neutral-600 text-xs">postData: {JSON.stringify(entry.request.postData) ?? 'undefined'}</span>
        </div>
        <div className="flex-1 overflow-auto p-4 text-[13px] text-neutral-500">
          <p>This request has no <code className="bg-neutral-800 px-1 rounded">postData.text</code>.</p>
          <p className="mt-2">postData dump:</p>
          <pre className="mt-1 bg-neutral-900 border border-neutral-800 rounded p-2 text-xs overflow-auto">
            {JSON.stringify(entry.request.postData, null, 2) ?? 'undefined'}
          </pre>
          <p className="mt-2">_content preview:</p>
          <pre className="mt-1 bg-neutral-900 border border-neutral-800 rounded p-2 text-xs overflow-auto break-all">
            {contentPreview}
          </pre>
          <p className="mt-2">Available request keys: {Object.keys(entry.request).join(', ')}</p>
          <p className="mt-1 text-xs text-neutral-600">BodySize: {(raw['bodySize'] as number) ?? 'n/a'} | _requestBodyStatus: {String(raw['_requestBodyStatus'] ?? 'n/a')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Content-Type:</span>
          <span className="text-neutral-300">{mimeType || '(none)'}</span>
          <span className="text-neutral-600">|</span>
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
          {isBase64 && <span className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded">base64</span>}
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
