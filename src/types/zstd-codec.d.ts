declare module 'zstd-codec' {
  interface ZstdInstance {
    Simple: new () => {
      decompress(data: Uint8Array): Uint8Array;
      compress(data: Uint8Array, level?: number): Uint8Array;
    };
    Generic: unknown;
    Streaming: unknown;
    Dict: unknown;
  }

  export const ZstdCodec: {
    run(callback: (zstd: ZstdInstance) => void): void;
  };
}
