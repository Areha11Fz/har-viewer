export interface DecodeContext {
  mimeType: string;
  url: string;
  headers: Record<string, string>;
  isBase64: boolean;
}

export interface DecodedResult {
  data: string;
  language: string;
  error?: string;
}

export interface DecoderPlugin {
  id: string;
  name: string;
  description?: string;
  canHandle: (context: DecodeContext) => boolean;
  decode: (raw: Uint8Array | string, context: DecodeContext) => Promise<DecodedResult> | DecodedResult;
}
