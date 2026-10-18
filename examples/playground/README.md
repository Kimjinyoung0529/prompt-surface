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
