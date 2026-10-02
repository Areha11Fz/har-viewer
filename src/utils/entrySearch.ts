import type { HarEntry } from '../types/har';

// Response bodies with these MIME types are binary blobs (base64 noise) —
// scanning them is expensive and never matches anything meaningful.
function isBinaryResponseMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith('image/') ||
    m.startsWith('video/') ||
    m.startsWith('audio/') ||
    m.startsWith('font/') ||
    m.includes('octet-stream') ||
    m.includes('application/pdf') ||
    m.includes('application/zip')
  );
}

// Cap per-body scan cost so huge bodies can't freeze filtering.
const MAX_BODY_SCAN_CHARS = 300_000;

function sliceForScan(text: string): string {
  return text.length > MAX_BODY_SCAN_CHARS ? text.slice(0, MAX_BODY_SCAN_CHARS) : text;
}

function getRawRequestBodyText(entry: HarEntry): string | undefined {
  const postData = entry.request.postData;
  if (postData?.text) return postData.text;
  if (postData?.params && postData.params.length > 0) {
    return postData.params.map((p) => `${p.name ?? ''} ${p.value ?? ''}`).join('\n');
  }
  const raw = entry.request as unknown as Record<string, unknown>;
  const candidates: unknown[] = [raw['_content'], raw['content'], raw['_postData'], raw['body']];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
    if (c && typeof c === 'object') {
      const obj = c as Record<string, unknown>;
      const text = (obj['text'] as string) ?? (obj['data'] as string);
      if (typeof text === 'string' && text.length > 0) return text;
    }
  }
  return undefined;
}

/**
 * Case-insensitive substring match across URL, headers and bodies.
 * `q` must already be trimmed + lower-cased by the caller.
 * Cheap checks (URL, headers) run first; bodies last.
 */
export function matchesEntry(entry: HarEntry, q: string): boolean {
  if (!q) return true;

  // 1. URL (cheapest, most common)
  if (entry.request.url.toLowerCase().includes(q)) return true;

  // 2. Query string names + values
  for (const param of entry.request.queryString) {
    if (param.name.toLowerCase().includes(q) || param.value.toLowerCase().includes(q)) return true;
  }

  // 3. Request headers (name + value)
  for (const h of entry.request.headers) {
    if (h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)) return true;
  }

  // 4. Response headers (name + value)
  for (const h of entry.response.headers) {
    if (h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)) return true;
  }

  // 5. Request body (raw text: postData.text / params / _content vendor field)
  const reqBody = getRawRequestBodyText(entry);
  if (reqBody && sliceForScan(reqBody).toLowerCase().includes(q)) return true;

  // 6. Response body (skip binary blobs)
  const respContent = entry.response.content;
  const respText = respContent.text;
  if (respText && !isBinaryResponseMime(respContent.mimeType || '')) {
    if (sliceForScan(respText).toLowerCase().includes(q)) return true;
  }

  return false;
}
