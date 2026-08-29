import React from 'react';
import { useHarStore } from '../../store/useHarStore';
import { HeadersTab } from './HeadersTab';
import { ResponseTab } from './ResponseTab';
import { RequestBodyTab } from './RequestBodyTab';
import { UrlTab } from './UrlTab';
import { VerticalSplitPane } from '../SplitPane/VerticalSplitPane';
import { Copy, Check, ChevronDown } from 'lucide-react';
import type { HarEntry } from '../../types/har';
import { decompressSync } from 'fflate';
import { ZstdCodec } from 'zstd-codec';

type TopTabId = 'url' | 'req-headers' | 'req-body';
type BottomTabId = 'resp-headers' | 'resp-body';

const TOP_TAB_KEY = 'har-viewer:topTab';
const BOTTOM_TAB_KEY = 'har-viewer:bottomTab';

function getInitialTab<T extends string>(key: string, fallback: T, valid: T[]): T {
  try {
    const saved = localStorage.getItem(key) as T | null;
    if (saved && valid.includes(saved)) return saved;
  } catch { /* ignore */ }
  return fallback;
}

interface ZstdSimple { decompress(data: Uint8Array): Uint8Array; }
let zstdSimple: ZstdSimple | null = null;
let zstdReady: Promise<ZstdSimple> | null = null;
function getZstd(): Promise<ZstdSimple> {
  if (zstdSimple) return Promise.resolve(zstdSimple);
  if (zstdReady) return zstdReady;
  zstdReady = new Promise((resolve) => {
    ZstdCodec.run((zstd) => { zstdSimple = new zstd.Simple() as ZstdSimple; resolve(zstdSimple); });
  });
  return zstdReady;
}

function toPythonValue(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map((v) => toPythonValue(v, indent + 4)).join(', ');
    return `[${inner}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const inner = entries
      .map(([k, v]) => `${pad}    ${JSON.stringify(k)}: ${toPythonValue(v, indent + 4)}`)
      .join(',\n');
    return `{\n${inner}\n${pad}}`;
  }
  return JSON.stringify(value);
}

function extractRawBody(entry: HarEntry): { text: string; encoding?: string; mimeType: string } | null {
  const postData = entry.request.postData;
  if (postData?.text) return { text: postData.text, mimeType: postData.mimeType || '', encoding: postData.encoding as string | undefined };
  if (postData?.params && postData.params.length > 0) {
    return { text: JSON.stringify(postData.params, null, 2), mimeType: postData.mimeType || 'application/json' };
  }
  const raw = entry.request as unknown as Record<string, unknown>;
  const candidates: unknown[] = [raw['_content'], raw['content'], raw['_postData'], raw['body']];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.length > 0) {
      const ct = (entry.request.headers.find((h) => h.name.toLowerCase() === 'content-type')?.value) || '';
      return { text: c, mimeType: ct };
    }
    if (typeof c === 'object') {
      const obj = c as Record<string, unknown>;
      const text = (obj['text'] as string) ?? (obj['data'] as string);
      if (typeof text === 'string' && text.length > 0) {
        return { text, mimeType: (obj['mimeType'] as string) || '', encoding: obj['encoding'] as string | undefined };
      }
    }
  }
  return null;
}

function tryDecompressGzip(base64Text: string): string | null {
  try {
    const binStr = atob(base64Text.trim());
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null;
    const dec = decompressSync(bytes);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

async function tryDecompressZstd(base64Text: string): Promise<string | null> {
  try {
    const binStr = atob(base64Text.trim());
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    if (bytes[0] !== 0x28 || bytes[1] !== 0xb5 || bytes[2] !== 0x2f || bytes[3] !== 0xfd) return null;
    const simple = await getZstd();
    const dec = simple.decompress(bytes);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

async function generatePythonRequests(entry: HarEntry): Promise<string> {
  const rawUrl = entry.request.url || '';
  const baseUrl = rawUrl.split('?')[0];
  const hasQuery = entry.request.queryString.length > 0;
  const queryObj: Record<string, string> = {};
  entry.request.queryString.forEach((q) => { queryObj[q.name] = q.value; });

  const headersObj: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersObj[h.name] = h.value; });

  const headersLower: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersLower[h.name.toLowerCase()] = h.value; });
  const bdEncoding = (headersLower['x-bd-content-encoding'] ?? headersLower['log-encode-type'] ?? '').trim().toLowerCase();
  const isGzip = bdEncoding === 'gzip';
  const isZstd = bdEncoding === 'zstd';

  const extracted = extractRawBody(entry);
  let rawBody = extracted?.text ?? '';

  // Decompress for payload display — keep as object, compress again in Python
  if (rawBody) {
    if (isGzip) {
      const dec = tryDecompressGzip(rawBody);
      if (dec) rawBody = dec;
    } else if (isZstd) {
      const dec = await tryDecompressZstd(rawBody);
      if (dec) rawBody = dec;
    }
  }

  let payloadExists = typeof rawBody === 'string' && rawBody.length > 0;
  let payloadObj: unknown = null;
  let payloadIsJson = false;
  if (payloadExists) {
    try {
      payloadObj = JSON.parse(rawBody as string);
      payloadIsJson = true;
    } catch {
      payloadObj = rawBody;
    }
  }

  const method = (entry.request.method || 'GET').toLowerCase();

  const lines: string[] = [];

  if (isGzip) {
    lines.push('import requests', 'import gzip', 'import json', '');
  } else if (isZstd) {
    lines.push('import requests', 'import zstandard as zstd', 'import json', '');
  } else {
    lines.push('import requests', '');
  }

  lines.push(`url = ${JSON.stringify(baseUrl)}`, '');

  if (hasQuery) {
    lines.push(`querystring = ${toPythonValue(queryObj)}`, '');
  }

  if (payloadExists) {
    if (payloadIsJson) {
      lines.push(`payload = ${toPythonValue(payloadObj)}`, '');
    } else {
      lines.push(`payload = ${JSON.stringify(payloadObj)}`, '');
    }
  }

  lines.push(`headers = ${toPythonValue(headersObj)}`, '');

  if (isGzip) {
    if (payloadExists && payloadIsJson) {
      lines.push('compressed = gzip.compress(json.dumps(payload).encode())', '');
    } else if (payloadExists) {
      lines.push('compressed = gzip.compress(payload.encode() if isinstance(payload, str) else payload)', '');
    }
  } else if (isZstd) {
    lines.push('cctx = zstd.ZstdCompressor()', '');
    if (payloadExists && payloadIsJson) {
      lines.push('compressed = cctx.compress(json.dumps(payload).encode())', '');
    } else if (payloadExists) {
      lines.push('compressed = cctx.compress(payload.encode() if isinstance(payload, str) else payload)', '');
    }
  }

  const args: string[] = [];
  if (isGzip || isZstd) {
    args.push('data=compressed');
  } else if (payloadExists && payloadIsJson) {
    args.push('json=payload');
  } else if (payloadExists) {
    args.push('data=payload');
  }
  args.push('headers=headers');
  if (hasQuery) args.push('params=querystring');

  lines.push(`response = requests.${method}(url, ${args.join(', ')})`, '', 'print(response.text)');

  return lines.join('\n');
}

async function generatePythonHttpClient(entry: HarEntry): Promise<string> {
  const rawUrl = entry.request.url || '';
  let host = '';
  let path = '';
  try {
    const u = new URL(rawUrl);
    host = u.host;
    path = u.pathname + u.search;
    if (!path) path = '/';
  } catch {
    host = rawUrl;
    path = '/';
  }

  const headersObj: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersObj[h.name] = h.value; });

  const headersLower: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersLower[h.name.toLowerCase()] = h.value; });
  const bdEncoding = (headersLower['x-bd-content-encoding'] ?? headersLower['log-encode-type'] ?? '').trim().toLowerCase();
  const isGzip = bdEncoding === 'gzip';
  const isZstd = bdEncoding === 'zstd';

  const extracted = extractRawBody(entry);
  let rawBody = extracted?.text ?? '';
  if (rawBody) {
    if (isGzip) {
      const dec = tryDecompressGzip(rawBody);
      if (dec) rawBody = dec;
    } else if (isZstd) {
      const dec = await tryDecompressZstd(rawBody);
      if (dec) rawBody = dec;
    }
  }

  let payloadExists = typeof rawBody === 'string' && rawBody.length > 0;
  let payloadObj: unknown = null;
  let payloadIsJson = false;
  if (payloadExists) {
    try { payloadObj = JSON.parse(rawBody as string); payloadIsJson = true; } catch { payloadObj = rawBody; }
  }

  const method = (entry.request.method || 'GET').toUpperCase();
  const isHttps = rawUrl.toLowerCase().startsWith('https://');

  const lines: string[] = [];
  lines.push('import http.client');
  if (isGzip) lines.push('import gzip', 'import io', 'import sys', 'from pathlib import Path');
  if (isZstd) lines.push('import zstandard as zstd');
  lines.push('import json', '');

  if (isGzip) {
    lines.push(
      'def _normalize_json_bytes(data: bytes) -> bytes:',
      '    stripped = data.strip()',
      '    if not stripped or stripped[0:1] not in (b"{", b"["):',
      '        return data',
      '    try:',
      '        obj = json.loads(data)',
      '    except Exception:',
      '        return data',
      '    try:',
      '        compact = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")',
      '        return compact',
      '    except Exception:',
      '        return data',
      '',
      'def compress_gzip(input_file, output_file, compresslevel=6, mtime=0, strip_json=True):',
      '    raw = Path(input_file).read_bytes()',
      '    if strip_json:',
      '        normalized = _normalize_json_bytes(raw)',
      '        if normalized != raw:',
      '            print(f"Stripped JSON formatting: {len(raw)} -> {len(normalized)} bytes (compact)")',
      '            raw = normalized',
      '    with open(output_file, "wb") as f_out_raw:',
      '        with gzip.GzipFile(filename="", mode="wb", compresslevel=compresslevel, mtime=mtime, fileobj=f_out_raw) as f_out:',
      '            f_out.write(raw)',
      '',
      'def compress_gzip_bytes(data: bytes) -> bytes:',
      '    normalized = _normalize_json_bytes(data)',
      '    buf = io.BytesIO()',
      '    with gzip.GzipFile(filename="", mode="wb", compresslevel=6, mtime=0, fileobj=buf) as f:',
      '        f.write(normalized)',
      '    return buf.getvalue()',
      '',
    );
  }

  lines.push(`conn = http.client.${isHttps ? 'HTTPSConnection' : 'HTTPConnection'}(${JSON.stringify(host)})`, '');

  if (payloadExists) {
    if (payloadIsJson) lines.push(`payload = ${toPythonValue(payloadObj)}`, '');
    else lines.push(`payload = ${JSON.stringify(payloadObj)}`, '');
  } else {
    lines.push('payload = {}', '');
  }

  lines.push(`headers = ${toPythonValue(headersObj)}`, '');

  if (isGzip) {
    if (payloadExists && payloadIsJson) lines.push('body = compress_gzip_bytes(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))', '');
    else if (payloadExists) lines.push('body = compress_gzip_bytes(payload.encode() if isinstance(payload, str) else str(payload).encode())', '');
    else lines.push('body = b""', '');
  } else if (isZstd) {
    lines.push('cctx = zstd.ZstdCompressor()', '');
    if (payloadExists && payloadIsJson) lines.push('body = cctx.compress(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode())', '');
    else if (payloadExists) lines.push('body = cctx.compress(payload.encode() if isinstance(payload, str) else str(payload).encode())', '');
    else lines.push('body = b""', '');
  } else {
    if (payloadExists && payloadIsJson) lines.push('body = json.dumps(payload)', '');
    else if (payloadExists) lines.push('body = payload if isinstance(payload, str) else str(payload)', '');
    else lines.push('body = ""', '');
  }
  lines.push('');

  // http.client always sends body as last arg; for GET without body use empty
  if (isGzip || isZstd) {
    lines.push(`conn.request(${JSON.stringify(method)}, ${JSON.stringify(path)}, body, headers)`, '');
  } else if (payloadExists) {
    lines.push(`conn.request(${JSON.stringify(method)}, ${JSON.stringify(path)}, body, headers)`, '');
  } else {
    lines.push(`conn.request(${JSON.stringify(method)}, ${JSON.stringify(path)}, headers=headers)`, '');
  }

  lines.push('res = conn.getresponse()', 'data = res.read()', '');
  lines.push("if res.headers.get('content-encoding') == 'gzip':");
  lines.push('    print(gzip.decompress(data).decode("utf-8"))');
  lines.push('else:');
  lines.push('    print(data.decode("utf-8"))');

  return lines.join('\n');
}

async function generateNodeWreqGzip(entry: HarEntry): Promise<string> {
  const headersObj: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersObj[h.name] = h.value; });
  const headersLower: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersLower[h.name.toLowerCase()] = h.value; });
  const bdEncoding = (headersLower['x-bd-content-encoding'] ?? headersLower['log-encode-type'] ?? '').trim().toLowerCase();
  const isGzip = bdEncoding === 'gzip';
  const isZstd = bdEncoding === 'zstd';

  const extracted = extractRawBody(entry);
  let rawBody = extracted?.text ?? '';
  if (rawBody) {
    if (isGzip) {
      const dec = tryDecompressGzip(rawBody);
      if (dec) rawBody = dec;
    } else if (isZstd) {
      const dec = await tryDecompressZstd(rawBody);
      if (dec) rawBody = dec;
    }
  }

  let bodyObj: unknown = {};
  if (rawBody) {
    try { bodyObj = JSON.parse(rawBody); } catch { bodyObj = rawBody; }
  }

  const url = entry.request.url || '';

  const lines: string[] = [];
  lines.push("const { createWreqSession, sessionGzipFetch } = require('./wreq_template');");
  lines.push(`const URL = ${JSON.stringify(url)};`);
  lines.push(`const HEADERS = ${JSON.stringify(headersObj, null, 2)};`);
  lines.push(`const BODY = ${JSON.stringify(bodyObj, null, 2)};`);
  lines.push('');
  lines.push('(async () => {');
  lines.push('  const session = await createWreqSession();');
  lines.push('  try {');
  lines.push('    const res = await sessionGzipFetch(session, URL, HEADERS, BODY);');
  lines.push("    console.log('Status', res.status);");
  lines.push('    const json = await res.json();');
  lines.push('    console.log(JSON.stringify(json, null, 2));');
  lines.push('  } finally {');
  lines.push('    await session.close();');
  lines.push('  }');
  lines.push('})();');
  return lines.join('\n');
}

async function generateNodeWreqZstd(entry: HarEntry): Promise<string> {
  const headersObj: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersObj[h.name] = h.value; });
  const headersLower: Record<string, string> = {};
  entry.request.headers.forEach((h) => { headersLower[h.name.toLowerCase()] = h.value; });
  const bdEncoding = (headersLower['x-bd-content-encoding'] ?? headersLower['log-encode-type'] ?? '').trim().toLowerCase();
  const isGzip = bdEncoding === 'gzip';
  const isZstd = bdEncoding === 'zstd';

  const extracted = extractRawBody(entry);
  let rawBody = extracted?.text ?? '';
  if (rawBody) {
    if (isGzip) {
      const dec = tryDecompressGzip(rawBody);
      if (dec) rawBody = dec;
    } else if (isZstd) {
      const dec = await tryDecompressZstd(rawBody);
      if (dec) rawBody = dec;
    }
  }

  let bodyObj: unknown = {};
  if (rawBody) {
    try { bodyObj = JSON.parse(rawBody); } catch { bodyObj = rawBody; }
  }

  const url = entry.request.url || '';

  const lines: string[] = [];
  lines.push("const { createWreqSession, sessionZstdFetch } = require('./wreq_template');");
  lines.push(`const URL = ${JSON.stringify(url)};`);
  lines.push(`const HEADERS = ${JSON.stringify(headersObj, null, 2)};`);
  lines.push(`const BODY = ${JSON.stringify(bodyObj, null, 2)};`);
  lines.push('');
  lines.push('(async () => {');
  lines.push('  const session = await createWreqSession();');
  lines.push('  try {');
  lines.push('    const res = await sessionZstdFetch(session, URL, HEADERS, BODY);');
  lines.push("    console.log('Status', res.status);");
  lines.push('    const json = await res.json();');
  lines.push('    console.log(JSON.stringify(json, null, 2));');
  lines.push('  } finally {');
  lines.push('    await session.close();');
  lines.push('  }');
  lines.push('})();');
  return lines.join('\n');
}

function headersToRecord(headers: Array<{ name: string; value: string }>): Record<string, string> {
  return headers.reduce((acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }), {} as Record<string, string>);
}

async function generateMarkdown(entry: HarEntry): Promise<string> {
  const { decoderRegistry } = await import('../../decoders/registry');

  const reqHeadersObj: Record<string, string> = {};
  entry.request.headers.forEach((h) => { reqHeadersObj[h.name] = h.value; });
  const respHeadersObj: Record<string, string> = {};
  entry.response.headers.forEach((h) => { respHeadersObj[h.name] = h.value; });

  const reqExtracted = extractRawBody(entry);
  let reqBodyMd = '';
  if (!reqExtracted) {
    reqBodyMd = '_No request body_\n';
  } else {
    const reqHeaders = headersToRecord(entry.request.headers);
    const respHeaders = headersToRecord(entry.response.headers);
    const isBase64 = (() => {
      if (reqExtracted.encoding === 'base64') return true;
      if (reqHeaders['x-bd-content-encoding'] || reqHeaders['log-encode-type']) return true;
      const mime = reqExtracted.mimeType || '';
      if (mime.includes('octet-stream') || mime.includes('gzip') || mime.includes('zstd')) return true;
      const stripped = reqExtracted.text.replace(/\s/g, '');
      return stripped.length >= 4 && /^[A-Za-z0-9+/=]+$/.test(stripped);
    })();
    const ctx = { mimeType: reqExtracted.mimeType || '', url: entry.request.url, headers: respHeaders, requestHeaders: reqHeaders, isBase64, source: 'request' as const };
    const dec = decoderRegistry.findAutoDecoder(ctx);
    const result = await decoderRegistry.runDecoder(dec?.id ?? 'raw', reqExtracted.text, ctx);
    const lang = result.language === 'json' ? 'json' : result.language === 'xml' ? 'xml' : result.language === 'html' ? 'html' : 'text';
    reqBodyMd = `\`\`\`${lang}\n${result.data}\n\`\`\`\n`;
    if (result.error) reqBodyMd = `> ⚠️ ${result.error}\n\n` + reqBodyMd;
  }

  const respContent = entry.response.content;
  let respBodyMd = '';
  if (!respContent.text) {
    respBodyMd = '_No response body_\n';
  } else {
    const reqHeaders = headersToRecord(entry.request.headers);
    const respHeaders = headersToRecord(entry.response.headers);
    const isBase64 = respContent.encoding === 'base64' || !!(respHeaders['x-bd-content-encoding'] ?? respHeaders['log-encode-type']);
    const ctx = { mimeType: respContent.mimeType || '', url: entry.request.url, headers: respHeaders, requestHeaders: reqHeaders, isBase64, source: 'response' as const };
    const dec = decoderRegistry.findAutoDecoder(ctx);
    const result = await decoderRegistry.runDecoder(dec?.id ?? 'raw', respContent.text, ctx);
    const lang = result.language === 'json' ? 'json' : result.language === 'xml' ? 'xml' : result.language === 'html' ? 'html' : 'text';
    respBodyMd = `\`\`\`${lang}\n${result.data}\n\`\`\`\n`;
    if (result.error) respBodyMd = `> ⚠️ ${result.error}\n\n` + respBodyMd;
  }

  const md = [
    `${entry.request.method} ${entry.request.url}`,
    `status ${entry.response.status} ${entry.response.statusText}`.trim(),
    ``,
    `## Request Headers`,
    '```json',
    JSON.stringify(reqHeadersObj, null, 2),
    '```',
    ``,
    `## Request Body`,
    reqBodyMd.trim(),
    ``,
    `## Response Headers`,
    '```json',
    JSON.stringify(respHeadersObj, null, 2),
    '```',
    ``,
    `## Response Body`,
    respBodyMd.trim(),
  ].join('\n');

  return md;
}

export const InspectorPanel: React.FC = () => {
  const entries = useHarStore((s) => s.entries);
  const selectedEntryId = useHarStore((s) => s.selectedEntryId);
  const [topTab, setTopTab] = React.useState<TopTabId>(() => getInitialTab(TOP_TAB_KEY, 'req-body', ['url', 'req-headers', 'req-body']));
  const [bottomTab, setBottomTab] = React.useState<BottomTabId>(() => getInitialTab(BOTTOM_TAB_KEY, 'resp-body', ['resp-headers', 'resp-body']));
  const [exportOpen, setExportOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);

  const entry = entries.find((e) => e._id === selectedEntryId);

  React.useEffect(() => {
    try { localStorage.setItem(TOP_TAB_KEY, topTab); } catch { /* ignore */ }
  }, [topTab]);
  React.useEffect(() => {
    try { localStorage.setItem(BOTTOM_TAB_KEY, bottomTab); } catch { /* ignore */ }
  }, [bottomTab]);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleExportPython = React.useCallback(async () => {
    if (!entry) return;
    const code = await generatePythonRequests(entry);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setExportOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [entry]);

  const handleExportHttpClient = React.useCallback(async () => {
    if (!entry) return;
    const code = await generatePythonHttpClient(entry);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setExportOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [entry]);

  const handleExportNodeWreq = React.useCallback(async () => {
    if (!entry) return;
    const code = await generateNodeWreqGzip(entry);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setExportOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [entry]);

  const handleExportNodeWreqZstd = React.useCallback(async () => {
    if (!entry) return;
    const code = await generateNodeWreqZstd(entry);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setExportOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [entry]);

  const handleExportMarkdown = React.useCallback(async () => {
    if (!entry) return;
    const md = await generateMarkdown(entry);
    await navigator.clipboard.writeText(md);
    // also download as file
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    let host = 'export';
    try { host = new URL(entry.request.url).hostname || 'export'; } catch { /* ignore */ }
    const safeMethod = (entry.request.method || 'GET').toLowerCase();
    a.href = url;
    a.download = `har-${safeMethod}-${host}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setCopied(true);
    setExportOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, [entry]);

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
            <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 shrink-0">
              <div className="flex">
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
              <div className="relative pr-2" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-2.5 py-1 rounded border border-neutral-700 transition-colors"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Export'}
                  <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={handleExportPython}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
                    >
                      Python Requests
                    </button>
                    <button
                      onClick={handleExportHttpClient}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors border-t border-neutral-700"
                    >
                      Python http.client
                    </button>
                    <button
                      onClick={handleExportNodeWreq}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors border-t border-neutral-700"
                    >
                      Node.js wreq gzip
                    </button>
                    <button
                      onClick={handleExportNodeWreqZstd}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors border-t border-neutral-700"
                    >
                      Node.js wreq zstd
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors border-t border-neutral-700"
                    >
                      Markdown (LLM)
                    </button>
                  </div>
                )}
              </div>
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
