# Prompt Surface

**A model-agnostic generative UI engine for React.** Turn validated JSON into real, stateful, interactive React UI—without executing model-produced code.

> Status: **v0.1.0 developer preview**. Core tests pass; production hardening, full a11y audits, React integration tests and security review are still required. Not yet published to npm.

Prompt Surface is an original implementation, **not a bundled copy** of OpenAI Apps SDK UI, json-render, CopilotKit, or Open Intelligent UI. Those projects are useful inspirations and potential future adapters, but no code from them is vendored here.

한국어: 모델 출력(JSON)을 안전한 인터랙티브 UI로 바꾸는 오픈소스 라이브러리입니다. React에서 쓰거나 별도 렌더러를 구현할 수 있습니다.

## Features

- **Model independent:** your backend may use OpenAI, Anthropic, local models, or rules.
- **No generated JSX or `eval`:** a restricted JSON protocol describes the UI and supported actions.
- **Interactive state:** immutable store, `set`, `toggle`, `increment`, `append`, `removeAt` and host-bound `emit`.
- **Stream updates:** newline-delimited JSON `snapshot`/`patch` event protocol with validation before commit.
- **React renderer:** 19 built-in node types, composable with your own registered components.
- **Dependency-light:** core works in Node and modern browsers; React is a peer dependency only for `/react`.
- **Safety boundaries:** key/path guards, no HTML injection, max node/depth/stream sizes, URL restrictions.

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

Maps, editors, 3D, video, product grids and more are **custom registry components**, not built in at v0.1.0. This package does not ship ready-made adapters for CopilotKit, json-render or Apps SDK yet.

## API

`prompt-surface`: `validateSurface`, `assertSurface`, `createSurfaceStore`, `patchSurface`, `createJSONLDecoder`, `surfaceSystemPrompt`, `readPath`, `writePath`, `interpolate`.

`prompt-surface/react`: `Surface`, `SurfaceProvider`, `useSurface`.

`prompt-surface/styles.css`: default styles with `--ps-*` CSS variables; you can theme or override styles.

See [protocol](docs/PROTOCOL.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), and the [JSON Schema](docs/surface.schema.json). Example documents: [`recipe.json`](examples/recipe.json) and [`dashboard.json`](examples/dashboard.json).

## Quality checks

```bash
npm test
npm run check
npm run pack:dry
npm run example
```

`npm test` needs only Node 18+. `npm run check` uses `tsc` (install `typescript` as a dev dependency if it is not already on PATH). The React integration itself requires `react` to be installed in the consuming app.

## Roadmap

1. React DOM and browser integration tests, focus/accessibility test suite.
2. JSON Schema-constrained generation adapters for multiple LLM providers.
3. Opt-in Maps, 3D and editor adapters via custom component registry.
4. Authenticated server event hooks, themes, SSR testing, docs site, versioned changelog.

## Create a GitHub repository

This starter is GitHub-ready. After installing the GitHub CLI and signing in with `gh auth login`, run `./scripts/create-github-repo.sh prompt-surface` from the project root. The script creates a **new public repository** and pushes the initial commit. This does not happen automatically when you download the archive.

## License

MIT. Contributions welcome after a GitHub repository is initialized.
