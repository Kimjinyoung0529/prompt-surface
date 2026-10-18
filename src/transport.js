/** Prompt Surface network adapters. No provider SDK, credentials, React or eval required. */
import { assertSurface, createJSONLDecoder, SurfaceError } from './core.js';

const DEFAULT_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_LINE_BYTES = 256 * 1024;

/** Convert a model's JSON-only text response into a validated Surface document. */
export function parseSurfaceText(text) {
  if (typeof text !== 'string') throw new SurfaceError('Surface response must be JSON text', 'RESPONSE_INVALID');
  let json;
  try { json = JSON.parse(text); }
  catch { throw new SurfaceError('Surface response is not valid JSON', 'RESPONSE_INVALID'); }
  return assertSurface(json);
}

/**
 * Decode data-only Surface events from JSONL or Server-Sent Events (SSE).
 * SSE frames may use `data: {json}` or multiple `data:` lines. Other fields are ignored.
 * The returned decoder accepts arbitrary text chunks, including split boundaries.
 */
export function createSurfaceEventDecoder(onEvent, options = {}) {
  if (typeof onEvent !== 'function') throw new SurfaceError('onEvent callback required', 'STREAM_INVALID');
  const format = options.format ?? 'jsonl';
  const maxLineBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1) throw new SurfaceError('Invalid line limit', 'STREAM_INVALID');
  if (format === 'jsonl') return createJSONLDecoder(onEvent, { maxLineBytes });
  if (format !== 'sse') throw new SurfaceError('Unsupported stream format', 'STREAM_INVALID');

  const byteLength = value => new TextEncoder().encode(value).length;
  let pending = '';
  let dataLines = [];
  let closed = false;
  let done = false;
  let frameBytes = 0;
  const flushFrame = () => {
    if (dataLines.length === 0) return;
    const text = dataLines.join('\n');
    dataLines = [];
    frameBytes = 0;
    if (text.trim() === '[DONE]') { done = true; return; }
    let value;
    try { value = JSON.parse(text); }
    catch { throw new SurfaceError('Invalid SSE event JSON', 'STREAM_INVALID'); }
    onEvent(value);
  };
  const pushLine = line => {
    if (done) return;
    if (!line.trim()) { flushFrame(); return; }
    if (line.startsWith(':')) return;
    if (line === 'data' || line.startsWith('data:')) {
      const value = line === 'data' ? '' : line.slice(5).replace(/^ /, '');
      frameBytes += byteLength(value) + 1;
      if (frameBytes > maxLineBytes) throw new SurfaceError('SSE frame exceeds limit', 'STREAM_TOO_LARGE');
      dataLines.push(value);
    }
  };
  return {
    push(chunk) {
      if (closed) throw new SurfaceError('Stream already finished', 'STREAM_INVALID');
      if (typeof chunk !== 'string') throw new SurfaceError('Chunk must be text', 'STREAM_INVALID');
      let start = 0;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] !== '\n') continue;
        const line = pending + chunk.slice(start, i);
        pending = '';
        if (byteLength(line) > maxLineBytes) throw new SurfaceError('SSE line exceeds limit', 'STREAM_TOO_LARGE');
        pushLine(line.replace(/\r$/, ''));
        start = i + 1;
      }
      pending += chunk.slice(start);
      if (byteLength(pending) > maxLineBytes) throw new SurfaceError('SSE line exceeds limit', 'STREAM_TOO_LARGE');
    },
    finish() {
      if (closed) return;
      if (pending) pushLine(pending.replace(/\r$/, ''));
      if (!done) flushFrame();
      pending = '';
      closed = true;
    }
  };
}

/**
 * Consume a fetch Response or ReadableStream of UTF-8 JSONL/SSE Surface events.
 * Every accepted event updates the provided store through its validated applyEvent().
 * A transport failure preserves the last successfully applied event, not a partial event.
 */
export async function consumeSurfaceStream(source, store, options = {}) {
  if (!store || typeof store.applyEvent !== 'function') throw new SurfaceError('Surface store required', 'STREAM_INVALID');
  const response = source && typeof source === 'object' && 'body' in source ? source : null;
  if (response && 'ok' in response && !response.ok) throw new SurfaceError(`HTTP response ${response.status}`, 'HTTP_ERROR');
  const stream = response ? response.body : source;
  if (!stream || typeof stream.getReader !== 'function') throw new SurfaceError('ReadableStream body required', 'STREAM_INVALID');
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  if (!Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1) throw new SurfaceError('Invalid total stream limit', 'STREAM_INVALID');
  if (options.signal?.aborted) throw new SurfaceError('Stream aborted', 'ABORTED');
  let events = 0;
  const parser = createSurfaceEventDecoder(event => {
    store.applyEvent(event);
    events++;
    options.onEvent?.(event, store.getSnapshot());
  }, options);
  const reader = stream.getReader();
  const textDecoder = new TextDecoder('utf-8', {fatal:true});
  const encoder = new TextEncoder();
  let total = 0;
  let abort = false;
  const onAbort = () => { abort = true; void reader.cancel().catch(() => {}); };
  options.signal?.addEventListener('abort', onAbort, {once:true});
  try {
    while (true) {
      if (abort || options.signal?.aborted) throw new SurfaceError('Stream aborted', 'ABORTED');
      const { value, done } = await reader.read();
      if (abort || options.signal?.aborted) throw new SurfaceError('Stream aborted', 'ABORTED');
      if (done) break;
      if (!(value instanceof Uint8Array) && typeof value !== 'string') throw new SurfaceError('Stream chunks must be bytes or text', 'STREAM_INVALID');
      const size = typeof value === 'string' ? encoder.encode(value).length : value.byteLength;
      total += size;
      if (total > maxTotalBytes) throw new SurfaceError('Stream exceeds total byte limit', 'STREAM_TOO_LARGE');
      parser.push(typeof value === 'string' ? value : textDecoder.decode(value, {stream:true}));
    }
    parser.push(textDecoder.decode());
    parser.finish();
    return { events, bytes:total, snapshot:store.getSnapshot() };
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (abort || options.signal?.aborted) throw new SurfaceError('Stream aborted', 'ABORTED');
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
