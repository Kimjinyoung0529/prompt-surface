import type { SurfaceDocument, SurfaceSnapshot, SurfaceStore, StreamEvent } from './index.js';
export declare function parseSurfaceText(text: string): SurfaceDocument;
export interface SurfaceDecoderOptions { format?: 'jsonl' | 'sse'; maxLineBytes?: number; }
export declare function createSurfaceEventDecoder(onEvent: (event: StreamEvent) => void, options?: SurfaceDecoderOptions): {
  push(chunk: string): void;
  finish(): void;
};
export interface SurfaceStreamOptions extends SurfaceDecoderOptions {
  signal?: AbortSignal;
  maxTotalBytes?: number;
  onEvent?: (event: StreamEvent, snapshot: SurfaceSnapshot) => void;
}
export declare function consumeSurfaceStream(
  source: Response | ReadableStream<Uint8Array | string>,
  store: SurfaceStore,
  options?: SurfaceStreamOptions
): Promise<{events: number; bytes: number; snapshot: SurfaceSnapshot}>;
