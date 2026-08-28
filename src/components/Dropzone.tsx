import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useHarStore } from '../store/useHarStore';
import type { HarFile, HarEntry } from '../types/har';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function detectBinEncoding(bytes: Uint8Array): string | null {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (bytes.length >= 4 && bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) return 'zstd';
  return null;
}

export const Dropzone: React.FC = () => {
  const setHarData = useHarStore((s) => s.setHarData);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseHar = useCallback(
    async (text: string) => {
      setLoading(true);
      setError(null);
      try {
        const har: HarFile = JSON.parse(text);
        if (!har.log || !Array.isArray(har.log.entries)) {
          throw new Error('Invalid HAR file: missing log.entries');
        }
        const entries: HarEntry[] = har.log.entries.map((e, i) => ({
          ...e,
          _id: `entry-${i}-${Date.now()}`,
        }));
        setHarData(entries);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to parse HAR: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [setHarData]
  );

  const handleHarFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') parseHar(text);
    };
    reader.readAsText(file);
  }, [parseHar]);

  const handleBinFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      const base64 = arrayBufferToBase64(buffer);
      const encoding = detectBinEncoding(bytes) || (file.name.includes('zstd') ? 'zstd' : file.name.includes('gzip') ? 'gzip' : null);
      const headers: Array<{ name: string; value: string }> = [
        { name: 'Content-Type', value: 'application/octet-stream' },
      ];
      if (encoding) headers.push({ name: 'x-bd-content-encoding', value: encoding });
      const entry: HarEntry = {
        _id: `bin-${Date.now()}`,
        startedDateTime: new Date().toISOString(),
        time: 0,
        request: {
          method: 'POST',
          url: `file://${file.name}`,
          headers,
          queryString: [],
          postData: { mimeType: 'application/octet-stream', text: base64 },
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: { size: bytes.length, mimeType: 'application/json', text: '' },
        },
      };
      setHarData([entry]);
    };
    reader.readAsArrayBuffer(file);
  }, [setHarData]);

  const isBinFile = (name: string) => /\.(bin|gz|zst|zstd|br|dat)$/i.test(name);

  const handleFile = useCallback((file: File) => {
    if (isBinFile(file.name)) handleBinFile(file);
    else handleHarFile(file);
  }, [handleHarFile, handleBinFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => fileInputRef.current?.click()}
      className={`flex flex-col items-center justify-center h-full cursor-pointer transition-colors ${
        isDragging ? 'bg-blue-600/10 border-blue-500' : 'bg-neutral-950 hover:bg-neutral-900'
      } border-2 border-dashed ${isDragging ? 'border-blue-500' : 'border-neutral-700'} m-2 rounded-lg`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".har,.json,.bin,.gz,.zst,.zstd"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {loading ? (
        <div className="flex items-center gap-2 text-neutral-400 text-[15px]">
          <div className="animate-spin h-5 w-5 border-2 border-neutral-400 border-t-transparent rounded-full" />
          <span>Parsing file...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-400 text-[15px]">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <FileText size={48} className="text-neutral-600 mb-4" />
          <Upload size={24} className="text-neutral-500 mb-2" />
          <p className="text-neutral-400 text-[15px]">
            Drag & drop a <strong>.har</strong> or <strong>.bin</strong> file here
          </p>
          <p className="text-neutral-600 text-[13px] mt-1">or click to browse</p>
        </>
      )}
    </div>
  );
};
