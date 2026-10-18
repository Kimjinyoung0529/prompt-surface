# Prompt Surface Studio (local React playground)

Interactive, editable React app showcasing Prompt Surface. Use sample documents without an API key. The optional local AI backend can generate a new Surface document from a plain-English request.

## Start the UI

From this folder:

```bash
npm install
npm run dev
```

Visit http://127.0.0.1:5173 and try the sample cards, live JSON editor and `Simulate JSONL stream`. The preset interactions do not require a model or server.

## Connect an AI model (optional)

In a **second** terminal in this same folder:

```bash
export OPENAI_API_KEY='your key'    # server-only, never commit it
export OPENAI_MODEL='a model supporting JSON object output'
npm run server
```

Then enter a request and select **Generate surface**. `server.mjs` is a **loopback-only development example**, not an internet-ready API service. It uses the Chat Completions JSON mode and validates the result with `parseSurfaceText` before returning it. JSON mode does not guarantee protocol compliance; handle failures/retries in production.

For production, move API calls to your own authenticated backend, enforce budgets and rate limits, and restrict image URLs according to your content security policy.

## Browser tests and real PNG screenshots

```bash
npx playwright install chromium
npm run test:e2e
```

This starts the actual Vite + React app. Each Chromium desktop/mobile test captures a full-page PNG in `test-results/`; the GitHub CI workflow uploads this folder as an artifact. Tests also verify interactive state updates, document switching, JSON editor validation, stream simulation and horizontal overflow. The model API is optional and never used by the browser tests.

Studio offers **Reset state** and **Export surface.json** controls, responsive panels, focus indication, and an optional collapsible JSON inspector.

## New v0.3 gallery

Pick **UI Gallery**, **Travel planner** or **Knowledge quiz** to exercise tabs, switch, slider, radio, carousel, accordion, table and conditional rendering. Toggle `☾ Dark` in the preview toolbar to test scoped dark styling.

The API generation endpoint still returns **one complete validated JSON document**; it is not a token-by-token streaming model connector. JSONL/SSE consumption is available separately and Studio includes a deterministic stream simulation.
