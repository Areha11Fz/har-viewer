import type { HarEntry } from '../types/har';

function headersToRecord(headers: Array<{ name: string; value: string }>): Record<string, string> {
  return headers.reduce((acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }), {} as Record<string, string>);
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

export async function markdownForEntry(entry: HarEntry): Promise<string> {
  const { decoderRegistry } = await import('../decoders/registry');

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

export async function markdownForAll(entries: HarEntry[]): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const md = await markdownForEntry(entries[i]);
    // Add entry separator with index for LLM clarity, keep token-light
    parts.push(`# Entry ${i + 1} / ${entries.length}\n\n${md}`);
  }
  // Clear separation between entries — horizontal rule is token-light and LLM-friendly
  return parts.join('\n\n---\n\n');
}
