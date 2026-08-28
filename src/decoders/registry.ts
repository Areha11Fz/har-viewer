import type { DecoderPlugin, DecodeContext, DecodedResult } from '../types/decoder';

class DecoderRegistry {
  private decoders: Map<string, DecoderPlugin> = new Map();

  register(decoder: DecoderPlugin) {
    this.decoders.set(decoder.id, decoder);
  }

  getAll(): DecoderPlugin[] {
    return Array.from(this.decoders.values());
  }

  get(id: string): DecoderPlugin | undefined {
    return this.decoders.get(id);
  }

  findAutoDecoder(context: DecodeContext): DecoderPlugin | undefined {
    return this.getAll().find((d) => d.id !== 'raw' && d.canHandle(context));
  }

  async runDecoder(
    decoderId: string,
    rawText: string,
    context: DecodeContext
  ): Promise<DecodedResult> {
    const decoder = this.get(decoderId) || this.get('raw')!;

    let rawInput: Uint8Array | string = rawText;
    if (context.isBase64) {
      try {
        const binStr = atob(rawText);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        rawInput = bytes;
      } catch {
        return { data: rawText, language: 'text', error: 'Base64 decoding failed' };
      }
    }

    try {
      return await decoder.decode(rawInput, context);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        data: typeof rawInput === 'string' ? rawInput : '[Binary Display Unavailable]',
        language: 'text',
        error: `Decoder [${decoder.name}] failed: ${message}`,
      };
    }
  }
}

export const decoderRegistry = new DecoderRegistry();
