# Changelog

## Unreleased — 2026-10-18

- Hardened store state writes against oversized documents and non-finite results.
- Made `dispatchAll` transactional: no partial state or host events on failure; one notification per successful state-changing batch.
- Added regression tests and protocol/security documentation for batch semantics.

## 0.2.1 — 2026-10-18

- Added Chromium Playwright end-to-end tests for actual React Studio on desktop and mobile; automatic PNG screenshots included as GitHub Actions artifacts.
- Improved readable labels, visible keyboard focus, responsive panels and mobile spacing.
- Added document/state reset, document JSON export, and a collapsible inspector.
- Extended GitHub Actions CI to run browser tests and upload a built Studio and real screenshots.
- Core protocol and 19 built-in components remain backwards compatible.

## 0.2.0 — 2026-10-18

- Added `prompt-surface/transport` with `parseSurfaceText`, `createSurfaceEventDecoder` and `consumeSurfaceStream` for JSONL/SSE Fetch and ReadableStream input.
- Added UTF-8 chunk boundary handling, abort propagation, per-line/frame and total byte limits, HTTP status checks and validated incremental store writes.
- Fixed JSONL parsing of large chunks containing many individually small lines.
- Added an editable React Studio playground with built-in recipe/dashboard samples, event inspector, stream simulation and opt-in local AI generator.
- Added transport/security tests (20 total core + transport tests at this release).

## 0.1.0 — 2026-10-18

- Initial JSON surface protocol, immutable state store, action dispatcher, atomic JSON Pointer patches and 19-component React renderer.
