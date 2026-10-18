# Prompt Surface

**A model-agnostic generative UI engine for React.** Turn validated JSON into real, stateful, interactive React UI—without executing model-produced code.

> Status: **v0.2.1 developer preview**. Core tests pass; production hardening, full a11y audits, full accessibility audits and security review are still required. Not yet published to npm.

Prompt Surface is an original implementation, **not a bundled copy** of OpenAI Apps SDK UI, json-render, CopilotKit, or Open Intelligent UI. Those projects are useful inspirations and potential future adapters, but no code from them is vendored here.

한국어: 모델 출력(JSON)을 안전한 인터랙티브 UI로 바꾸는 오픈소스 라이브러리입니다. React에서 쓰거나 별도 렌더러를 구현할 수 있습니다.

## Features

- **Model independent:** your backend may use OpenAI, Anthropic, local models, or rules.
- **No generated JSX or `eval`:** a restricted JSON protocol describes the UI and supported actions.
- **Interactive state:** immutable store, `set`, `toggle`, `increment`, `append`, `removeAt` and host-bound `emit`.
- **Stream updates:** JSONL and SSE `snapshot`/`patch` event protocols, validated before commit. Includes fetch `Response`/`ReadableStream` transport with UTF-8 splitting, aborts and size bounds.
- **React renderer:** 19 built-in node types, composable with your own registered components.
- **Dependency-light:** core works in Node and modern browsers; React is a peer dependency only for `/react`.
- **Safety boundaries:** key/path guards, no HTML injection, max node/depth/stream sizes, URL restrictions.

## Local Studio (interactive React playground)

An editable 3-panel UI lives in [`examples/playground`](examples/playground/README.md). The presets and stream simulation are fully local; optionally connect a model using a **server-side** API key. Studio v0.2.1 has responsive layouts, keyboard focus cues, state reset, document export and automated Chromium tests.

```bash
cd examples/playground
npm install
npm run dev
# open http://127.0.0.1:5173
```

`npm run server` runs a separate loopback-only backend that requires `OPENAI_API_KEY` and `OPENAI_MODEL`. This integration is optional. The UI and core library work without a model.

## Install from local source

```bash
# clone or unzip this repository, then from your React project:
npm install ../prompt-surface
npm install react react-dom
```

Once published to npm, the install command can be `npm install prompt-surface react react-dom`.

## React quick start

```jsx
import React from 'react';
import { Surface } from 'prompt-surface/react';
import 'prompt-surface/styles.css';

const doc = {
  version: '1.0',
  title: 'Counter',
  state: { count: 0 },
  root: {
    type: 'card',
    children: [
      { type: 'heading', props: { text: 'Count: {{count}}' } },
      { type: 'button', props: { label: 'Add one' },
        on: { click: [{ type: 'increment', path: 'count', by: 1 }] } },
      { type: 'button', props: { label: 'Save' },
        on: { click: [{ type: 'emit', name: 'counter.save' }] } }
    ]
  }
};

export default function App() {
  return <Surface document={doc} onEvent={(event) => {
    if (event.name === 'counter.save') {
      // Authorize and persist event.state on your own server.
      console.log(event.state);
    }
  }} />;
}
```

`onEvent` is the only way a generated document can request an app-specific side effect. **You control what event names mean, and enforce authorization on the server.**

## Stream a UI from any language model

Generate a complete surface JSON object using `surfaceSystemPrompt()` as part of the server-side system instruction; verify and return it, then render via `<Surface document={result} />`.

To stream, send **newline-delimited JSON** updates. The first event is a full snapshot and subsequent events may be JSON-pointer patches:

```jsonl
{"type":"snapshot","document":{"version":"1.0","state":{"likes":0},"root":{"type":"text","props":{"text":"Likes: {{likes}}"}}}}
{"type":"patch","op":"add","path":"/root/children","value":[]}
{"type":"patch","op":"add","path":"/root/children/-","value":{"type":"button","props":{"label":"Like"},"on":{"click":[{"type":"increment","path":"likes","by":1}]}}}
```

```js
import { createSurfaceStore, createJSONLDecoder } from 'prompt-surface';

const store = createSurfaceStore(initialDocument);
const decoder = createJSONLDecoder((event) => store.applyEvent(event));

// Example with a fetch response body from YOUR backend:
const response = await fetch('/api/surface');
if (!response.ok || !response.body) throw new Error('Generation failed');
const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  decoder.push(value);
}
decoder.finish();
// Render using <Surface store={store} />
```

Streaming patch applications are **atomic**: invalid updates are rejected without changing the existing document. The protocol does not run untrusted scripts.

## v0.2.x: consume a model response or a live stream

`prompt-surface/transport` adds **provider-neutral** helpers. A model endpoint can return a single complete JSON surface or send JSONL / SSE with `snapshot` and `patch` events. On input, the runtime validates every event without executing arbitrary model code.

```js
import { parseSurfaceText, consumeSurfaceStream } from 'prompt-surface/transport';
import { createSurfaceStore } from 'prompt-surface';

// When your server returns a JSON document:
const response = await fetch('/api/generate', { method: 'POST' });
if (!response.ok) throw new Error('Generation failed');
const surface = parseSurfaceText(await response.text());

// Alternatively, consume JSONL or SSE events from a streaming endpoint:
const store = createSurfaceStore(surface);
const controller = new AbortController();
const streamResponse = await fetch('/api/surface-stream', {signal: controller.signal});
const result = await consumeSurfaceStream(streamResponse, store, {
  format: 'sse', // use 'jsonl' for newline-delimited JSON
  signal: controller.signal,
  maxTotalBytes: 4 * 1024 * 1024
});
// <Surface store={store}/> automatically updates when each event commits.
console.log(result.events, result.snapshot.revision);
```

SSE frames should look like `data: {"type":"snapshot", "document":{...}}\n\n` and may end with `data: [DONE]\n\n`. This protocol is **not** an adapter for raw model-provider streaming events; transform those into Prompt Surface events on your own backend.

The optional [local AI generator](examples/playground/server.mjs) demonstrates one way to call an OpenAI-compatible Chat Completions endpoint via server-side `fetch` and check the result before it reaches the browser. It is a development-only example, not a production authentication/authorization layer.

## Register your own component

```jsx
const registry = {
  'weather-tile': ({ props }) => (
    <article aria-label="Weather tile">
      <strong>{props.city}</strong> — {props.temp}°
    </article>
  )
};

<Surface document={document} registry={registry} />
```

Custom renderers are trusted application code; they receive data from model outputs, so **validate props and never interpolate them into unsafe HTML**.

## Component catalog

| Component | Important props | Notes |
|---|---|---|
| `column`, `row`, `grid` | `gap`, `columns` | Container layout |
| `card`, `divider` | — | Content framing |
| `heading`, `text`, `badge` | `text`, `level` | `{{state.field}}` interpolation |
| `button` | `label` | `on.click` actions |
| `input`, `textarea` | `label`, `placeholder` | `bind` to state |
| `checkbox`, `slider`, `select` | `label`, `options`, `min`, `max`, `step` | `bind` to state |
| `progress`, `metric` | `value`, `label`, `max` | Basic indicators |
| `image` | `src`, `alt` | http(s) URL only |
| `bar-chart`, `line-chart` | `data`, `dataPath`, `title` | Lightweight SVG charts |

Maps, editors, 3D, video, product grids and more are **custom registry components**, not built in at v0.2.1. This package does not ship ready-made adapters for CopilotKit, json-render or Apps SDK yet.

## API

`prompt-surface`: `validateSurface`, `assertSurface`, `createSurfaceStore`, `patchSurface`, `createJSONLDecoder`, `surfaceSystemPrompt`, `readPath`, `writePath`, `interpolate`.

`prompt-surface/react`: `Surface`, `SurfaceProvider`, `useSurface`.

`prompt-surface/styles.css`: default styles with `--ps-*` CSS variables; you can theme or override styles.

See [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), and the [JSON Schema](docs/surface.schema.json). Example documents: [`recipe.json`](examples/recipe.json) and [`dashboard.json`](examples/dashboard.json).

## Actual browser screenshots and integration tests

Unlike a static mockup, the screenshots produced by the browser test suite come from the **actual built React Studio**, driven by Chromium. The GitHub Actions CI workflow runs 6 Playwright checks across desktop and mobile, including input binding, checkbox/action events, document validation, JSONL streaming, viewport overflow, and screenshots. On CI, open the latest successful [Actions run](https://github.com/Kimjinyoung0529/prompt-surface/actions) and download the artifact `prompt-surface-studio-browser-results` (PNG images inside test-results) or `prompt-surface-studio-build` (built React app). Screenshots are artifacts of that particular commit, not hand-drawn mockups.

Run locally after installing Studio dependencies:

```bash
cd examples/playground
npm install
npx playwright install chromium
npm run test:e2e
```

The Playwright suite launches Vite on localhost automatically. Browser test tooling is only a dev dependency of Studio, not of the core library.

## Quality checks

```bash
npm test
npm run check
npm run pack:dry
npm run example
```

`npm test` needs only Node 18+. `npm run check` uses `tsc` (install `typescript` as a dev dependency if it is not already on PATH). The React integration itself requires `react` to be installed in the consuming app.

## Roadmap

1. Comprehensive keyboard and screen-reader accessibility testing, visual regression baselines.
2. JSON Schema-constrained generation adapters for multiple LLM providers.
3. Opt-in Maps, 3D and editor adapters via custom component registry.
4. Authenticated server event hooks, themes, SSR testing, docs site, versioned changelog.

## GitHub repository

Source and CI: https://github.com/Kimjinyoung0529/prompt-surface. New users can fork the repository or clone it locally.

## License

MIT. Contributions welcome.
