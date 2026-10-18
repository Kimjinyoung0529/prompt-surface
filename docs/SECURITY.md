# Security model

Prompt Surface handles **untrusted data from language models**. It does *not* provide a secure sandbox for arbitrary user code and it does *not* grant network, database, account or file privileges to JSON documents.

## Current boundaries

- JSON-only input; no `eval`, `new Function`, `dangerouslySetInnerHTML`, arbitrary event handler source, or dynamically loaded JS.
- `assertSurface` validates the entire tree, node count (500), nesting depth (32), JSON values and state/action paths.
- Prototype-polluting keys (`__proto__`, `prototype`, `constructor`) are rejected in JSON objects, paths and patches.
- The React renderer uses a limited property allowlist, rather than forwarding arbitrary model-controlled DOM attributes.
- Images accept only http(s) URLs; they must still be covered by your CSP and network/content policy.
- A stream line/frame is size limited (default 256 KiB), and browser stream consumption has an additional total byte cap (default 4 MiB). It must be valid JSON before an event is applied.
- SSE only accepts Prompt Surface event JSON in `data:` fields; it is not a generic provider event interpreter. Browser cancellation propagates via `AbortSignal`.
- Patches clone and validate the resulting whole document. On failure, nothing is committed.

## Responsibilities of the host application

- **Never put API keys in the browser**; generate model output on your backend.
- Authenticate and authorize every incoming network request, user action, stored document, and `emit` handler. Do not treat an emitted event name as proof of permission.
- Rate-limit generation and side effects, and set transport size limits.
- Use TLS, an appropriate CSP, safe image proxy/allowlist and asset moderation for remote images.
- Validate the protocol independently at the server boundary. UI validation is not authorization.
- Registered custom components are trusted **code**, not sandboxed, so validate their external props.
- Avoid directly exposing user secrets within generated state, since state is intentionally visible to the browser.

This is a developer preview and has **not** undergone an independent security audit.

## Local development backend

`examples/playground/server.mjs` binds only to `127.0.0.1` and requires environment-based credentials. It is **not production ready**: add authentication, CSRF protections, rate limiting, observability, content moderation, quotas, retry policy, timeout governance, and deployment-specific network controls before exposure to anyone else. Never use a production secret in front-end source.
