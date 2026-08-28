# HAR Viewer

Client-side HAR viewer with pluggable, custom body decoders. Dark, DevTools-inspired UI. Fully in-browser — no upload, no server.

## Features

- **Drag & drop** `.har` / `.json` and raw `.bin` / `.gz` / `.zst` files
- **Virtualized request table** (`@tanstack/react-virtual`) — smooth with 20k+ entries
- **Pluggable decoder registry** — auto-selects decoder from headers / MIME, manually overridable per body
- **Custom gzip / zstd** via `x-bd-content-encoding` / `log-encode-type` (per-side: request header → request body only, response header → response body only). Gzip via `fflate`, zstd via `zstd-codec` (WASM, lazy-init)
- **Split-pane layout** — horizontal (list ↔ inspector) and vertical (request group ↔ response group) resizable dividers
- **Inspector** — URL (method/host/path/query/timing/status), Request Headers, Request Body, Response Headers, Response Body — each with copy button and CodeMirror preview (JSON/XML/HTML)
- **Robust HAR ingestion** — handles `postData.text`, `postData.params`, `_content` / `_postData` vendor extensions, `encoding: base64` and base64 heuristics
- **Persistence** — last opened HAR auto-reopens from `localStorage` (`har-viewer:lastHar`, ~4.5 MB cap)
- **Search + method filter** (`ALL/GET/POST/...`) with clear button, dark scrollbars, 13px Inter + JetBrains Mono

## Tech Stack

| Role | Tool | Why |
|---|---|---|
| Bundler & Framework | Vite + React + TypeScript | Fast HMR, strict HAR types |
| Styling & Icons | Tailwind CSS (v4 via `@tailwindcss/vite`) + Lucide | Dark theme, utility-first |
| State | Zustand | Large entry lists outside render tree |
| Virtualization | `@tanstack/react-virtual` | No DOM bloat |
| Editor | `@uiw/react-codemirror` + `@codemirror/lang-*` | JSON/XML/HTML highlighting |
| Binary | `fflate` / `zstd-codec` | In-browser decompression + base64 |

## Project Structure

```
har-viewer/
├── src/
│   ├── types/
│   │   ├── har.ts              # HAR 1.2 interfaces (postData + vendor extensions)
│   │   └── decoder.ts          # DecoderPlugin contract
│   ├── decoders/
│   │   ├── registry.ts         # DecoderRegistry (priority: x-bd/log-encode-type → canHandle)
│   │   └── builtin.ts          # raw, json, xml, html, urlencoded, xor, custom-gzip, custom-zstd
│   ├── store/
│   │   └── useHarStore.ts      # Zustand + localStorage auto-save/restore
│   ├── components/
│   │   ├── Dropzone.tsx        # HAR + BIN ingestion, magic-byte detection
│   │   ├── Header.tsx          # Search (with X) + method filters + count/clear
│   │   ├── RequestTable/Table.tsx
│   │   ├── Inspector/
│   │   │   ├── InspectorPanel.tsx   # VerticalSplitPane: top=URL/Req, bottom=Resp
│   │   │   ├── UrlTab.tsx
│   │   │   ├── HeadersTab.tsx
│   │   │   ├── RequestBodyTab.tsx   # extractor + per-source decoder
│   │   │   ├── ResponseTab.tsx
│   │   │   └── theme.ts             # dark CodeMirror theme
│   │   └── SplitPane/
│   │       ├── SplitPane.tsx          # horizontal
│   │       └── VerticalSplitPane.tsx  # vertical
│   ├── App.tsx
│   └── main.tsx
└── vite.config.ts
```

## Getting Started

```bash
# prerequisites: Node 20+
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  → dist/
npm run preview  # serve dist
npm run lint     # oxlint
```

## Usage

1. **Drop a file** onto the dropzone or click to browse:
   - `.har` / `.json` — parsed as `HarFile` (`log.entries[]. _id` injected, full 100MB+ supported)
   - `.bin` / `.gz` / `.zst` — read as `ArrayBuffer` → base64, magic-byte detected (`1F 8B` → gzip, `28 B5 2F FD` → zstd), synthetic entry created with `x-bd-content-encoding`
2. **Filter** by URL substring (X clears) and method pills; count shown on the right
3. **Select** a row — inspector on the right shows:
   - **Top:** `URL` | `Request Headers` | `Request Body`
   - **Bottom:** `Response Headers` | `Response Body`
   - Drag the middle bar to resize top/bottom, drag the center divider to resize list/inspector
4. **Body tabs** have a `Decoder` dropdown (auto-selected, overridable) and `Copy` (copies decoded text, not raw base64). `base64` badge shows when base64 → bytes was applied.

## Decoder System

### Contract — `src/types/decoder.ts:14`

```ts
export interface DecodeContext {
  mimeType: string;
  url: string;
  headers: Record<string,string>;        // response headers (lower-cased)
  requestHeaders: Record<string,string>; // request headers (lower-cased)
  isBase64: boolean;
  source: 'request' | 'response';
}
export interface DecodedResult { data: string; language: string; error?: string; }
export interface DecoderPlugin {
  id: string; name: string; description?: string;
  canHandle: (context: DecodeContext) => boolean;
  decode: (raw: Uint8Array | string, context: DecodeContext) => Promise<DecodedResult> | DecodedResult;
}
```

### Registry priority — `src/decoders/registry.ts:18`

1. If `relevantHeader = (source==='request' ? requestHeaders : headers)['x-bd-content-encoding' ?? 'log-encode-type']` is `gzip` → `custom-gzip`, `zstd` → `custom-zstd` (exact, trimmed, lower-cased).
2. Otherwise first `decoder.id !== 'raw' && canHandle(context)` in registration order.
3. `runDecoder` handles `isBase64` (`atob` → `Uint8Array`) before `decode`, catches and returns `{ error }`.

### Built-ins — `src/decoders/builtin.ts:25`

| id | name | `canHandle` |
|---|---|---|
| `raw` | Raw / Plaintext | `false` (fallback, tries JSON pretty-print) |
| `json` | JSON Formatter | `mimeType.includes('json')` |
| `xml` | XML Formatter | `mimeType.includes('xml')` |
| `html` | HTML Viewer | `mimeType.includes('html')` |
| `urlencoded` | URL-Encoded Form | `mimeType.includes('x-www-form-urlencoded')` |
| `custom-xor` | Custom XOR Cipher | `x-custom-encryption==='true'` or `application/x-custom` |
| `custom-gzip` | Custom Gzip | per-side `x-bd-content-encoding` / `log-encode-type` === `gzip` (via `fflate/decompressSync`) |
| `custom-zstd` | Custom Zstd | same === `zstd` (via `zstd-codec` WASM `Simple.decompress`, lazy `ZstdCodec.run`) |

Per-side isolation: request decoders only inspect `requestHeaders`, response decoders only `headers`. This prevents a request `x-bd-content-encoding: gzip` from forcing the response body through gzip.

### Adding a custom decoder

`src/decoders/my-decoder.ts`:

```ts
import { decoderRegistry } from './registry';

decoderRegistry.register({
  id: 'my-proto',
  name: 'My Protobuf',
  canHandle: (ctx) => ctx.mimeType.includes('protobuf') || ctx.headers['x-my-enc'] === 'proto',
  decode: (raw) => {
    const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
    // ... decode bytes ...
    return { data: JSON.stringify(decoded, null, 2), language: 'json' };
  },
});
```

Import it once in `src/App.tsx`:

```ts
import './decoders/builtin';
import './decoders/my-decoder';
```

It appears immediately in the body-tab dropdown and auto-selects when `canHandle` matches.

## HAR Quirks Handled

- **Bodies:** `request.postData.text` → `postData.params` (serialized) → vendor `request._content` / `content` / `_postData` / `body` (string or `{text, mimeType, encoding}`) → debug panel dumps `postData`, `_content` preview, `Object.keys(request)`, `bodySize`/`_requestBodyStatus` if nothing found.
- **Base64:** `response.content.encoding === 'base64'` or request side `detectBase64()` (true if `x-bd`/`log-encode-type` present, or `octet-stream`/`gzip`/`zstd`/`protobuf`, or base64 charset + `atob` probe). Registry base64-decodes via `atob` before `decode`. Response side also treats `log-encode-type`/`x-bd` + base64-like `text` as base64.
- **Headers:** lowered via `headersToRecord` in both body tabs (`src/components/Inspector/RequestBodyTab.tsx:26` / `ResponseTab.tsx:26`).

## Persistence

`src/store/useHarStore.ts:4` stores `entries` under `har-viewer:lastHar` (JSON, ~4.5 MB guard). `src/App.tsx:11` re-hydrates on mount if `entries` is empty. Trash button clears both state and storage.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview `dist` |
| `npm run lint` | Oxlint |

## License

MIT — see [LICENSE](LICENSE).
