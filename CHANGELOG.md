# Changelog

## 0.2.0 — 2026-10-18

- Added `prompt-surface/transport` with `parseSurfaceText`, `createSurfaceEventDecoder` and `consumeSurfaceStream` for JSONL/SSE Fetch and ReadableStream input.
- Added UTF-8 chunk boundary handling, abort propagation, per-line/frame and total byte limits, HTTP status checks and validated incremental store writes.
- Fixed JSONL parsing of large chunks containing many individually small lines.
- Added an editable React Studio playground with built-in recipe/dashboard samples, event inspector, stream simulation and opt-in local AI generator.
- Added transport/security tests (20 total core + transport tests at this release).

## 0.1.0 — 2026-10-18

- Initial JSON surface protocol, immutable state store, action dispatcher, atomic JSON Pointer patches and 19-component React renderer.
