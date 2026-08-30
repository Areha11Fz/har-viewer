import { decoderRegistry } from './registry';
import type { DecoderPlugin } from '../types/decoder';
import { decompressSync } from 'fflate';
import { ZstdCodec } from 'zstd-codec';

interface ZstdSimple {
  decompress(data: Uint8Array): Uint8Array;
}

let zstdSimple: ZstdSimple | null = null;
let zstdReady: Promise<ZstdSimple> | null = null;

function getZstd(): Promise<ZstdSimple> {
  if (zstdSimple) return Promise.resolve(zstdSimple);
  if (zstdReady) return zstdReady;
  zstdReady = new Promise((resolve) => {
    ZstdCodec.run((zstd) => {
      zstdSimple = new zstd.Simple() as ZstdSimple;
      resolve(zstdSimple);
    });
  });
  return zstdReady;
}

const rawDecoder: DecoderPlugin = {
  id: 'raw',
  name: 'Raw / Plaintext',
  canHandle: () => false,
  decode: (raw) => {
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return { data: JSON.stringify(parsed, null, 2), language: 'json' };
      } catch {
        return { data: raw, language: 'text' };
      }
    }
    const text = new TextDecoder().decode(raw);
    try {
      const parsed = JSON.parse(text);
      return { data: JSON.stringify(parsed, null, 2), language: 'json' };
    } catch {
      return { data: text, language: 'text' };
    }
  },
};

const jsonDecoder: DecoderPlugin = {
  id: 'json',
  name: 'JSON Formatter',
  canHandle: (ctx) => ctx.mimeType.includes('json'),
  decode: (raw) => {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    try {
      const parsed = JSON.parse(text);
      return { data: JSON.stringify(parsed, null, 2), language: 'json' };
    } catch {
      return { data: text, language: 'text', error: 'Invalid JSON' };
    }
  },
};

const xmlDecoder: DecoderPlugin = {
  id: 'xml',
  name: 'XML Formatter',
  canHandle: (ctx) => ctx.mimeType.includes('xml'),
  decode: (raw) => {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    return { data: text, language: 'xml' };
  },
};

const htmlDecoder: DecoderPlugin = {
  id: 'html',
  name: 'HTML Viewer',
  canHandle: (ctx) => ctx.mimeType.includes('html'),
  decode: (raw) => {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    return { data: text, language: 'html' };
  },
};

const urlencodedDecoder: DecoderPlugin = {
  id: 'urlencoded',
  name: 'URL-Encoded Form',
  canHandle: (ctx) => ctx.mimeType.includes('x-www-form-urlencoded'),
  decode: (raw) => {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    try {
      const params = new URLSearchParams(text);
      const obj: Record<string, string | string[]> = {};
      params.forEach((value, key) => {
        if (obj[key]) {
          const existing = obj[key];
          obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
        } else {
          obj[key] = value;
        }
      });
      return { data: JSON.stringify(obj, null, 2), language: 'json' };
    } catch {
      return { data: text, language: 'text', error: 'Failed to parse URL-encoded data' };
    }
  },
};

const protobufDecoder: DecoderPlugin = {
  id: 'protobuf-base64',
  name: 'Protobuf (Base64)',
  description: 'Encodes protobuf bytes as base64 for display',
  canHandle: (ctx) => ctx.mimeType.includes('application/x-protobuf'),
  decode: (raw) => {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const b64 = btoa(binary);
    return { data: b64, language: 'text' };
  },
};

const customXorDecoder: DecoderPlugin = {
  id: 'custom-xor',
  name: 'Custom XOR Cipher',
  canHandle: (ctx) =>
    ctx.headers['x-custom-encryption'] === 'true' ||
    ctx.requestHeaders['x-custom-encryption'] === 'true' ||
    ctx.mimeType.includes('application/x-custom'),
  decode: (raw) => {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
    const decrypted = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      decrypted[i] = bytes[i] ^ 0x5a;
    }
    const text = new TextDecoder().decode(decrypted);
    try {
      return { data: JSON.stringify(JSON.parse(text), null, 2), language: 'json' };
    } catch {
      return { data: text, language: 'text' };
    }
  },
};

const customGzipDecoder: DecoderPlugin = {
  id: 'custom-gzip',
  name: 'Custom Gzip',
  canHandle: (ctx) => {
    const headers = ctx.source === 'request' ? ctx.requestHeaders : ctx.headers;
    const enc = headers['x-bd-content-encoding'] ?? headers['log-encode-type'];
    return enc?.trim().toLowerCase() === 'gzip';
  },
  decode: (raw) => {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
    try {
      const decompressed = decompressSync(bytes);
      const text = new TextDecoder().decode(decompressed);
      try {
        const parsed = JSON.parse(text);
        return { data: JSON.stringify(parsed, null, 2), language: 'json' };
      } catch {
        return { data: text, language: 'text' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: '[Gzip decompression failed]', language: 'text', error: msg };
    }
  },
};

const customZstdDecoder: DecoderPlugin = {
  id: 'custom-zstd',
  name: 'Custom Zstd',
  canHandle: (ctx) => {
    const headers = ctx.source === 'request' ? ctx.requestHeaders : ctx.headers;
    const enc = headers['x-bd-content-encoding'] ?? headers['log-encode-type'];
    return enc?.trim().toLowerCase() === 'zstd';
  },
  decode: async (raw) => {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
    try {
      const simple = await getZstd();
      const decompressed = simple.decompress(new Uint8Array(bytes));
      const text = new TextDecoder().decode(decompressed);
      try {
        const parsed = JSON.parse(text);
        return { data: JSON.stringify(parsed, null, 2), language: 'json' };
      } catch {
        return { data: text, language: 'text' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: '[Zstd decompression failed]', language: 'text', error: msg };
    }
  },
};

decoderRegistry.register(rawDecoder);
decoderRegistry.register(protobufDecoder);
decoderRegistry.register(jsonDecoder);
decoderRegistry.register(xmlDecoder);
decoderRegistry.register(htmlDecoder);
decoderRegistry.register(urlencodedDecoder);
decoderRegistry.register(customXorDecoder);
decoderRegistry.register(customGzipDecoder);
decoderRegistry.register(customZstdDecoder);
