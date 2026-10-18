# Architecture and extension points

```text
AI model / structured output / custom backend
                   |
                 JSON
                   v
      parseSurfaceText / transport
                   |
       validateSurface / assertSurface
                   |
                   v
         createSurfaceStore
        /     |      |      \
 actions     state  patches  host emit() callback
        \     |      |      /
                   v
      React <Surface store={store} />
        | built-in components
        | registry['your-component']
        v
    Interactive UI, under host control
```

## Design commitments

- `src/core.js` has **zero external dependencies**, and doesn't know about React, HTTP, provider SDKs, or credentials.
- `src/react.js` renders **known component types** or calls an **explicitly registered** trusted renderer. Generated JSON never becomes executable code.
- All components observe one store snapshot. State paths address nested JSON objects.
- The protocol uses **whole-document snapshots** and **small, validated JSON Pointer patches**; no partial JSX tokens. The optional `/transport` module handles JSONL and SSE from browser Fetch streams, total byte limits, UTF-8 boundaries and cancellation.
- Host actions (`emit`) are requests, not privileges. The application authenticates/authorizes them.
- CSS themes use variables. Layout properties are intentionally limited rather than allowing arbitrary CSS injected by model output.

## Adding custom components

The host registers a renderer under a node name. Renderers are normal application code and can integrate external map, video, chart or 3D frameworks. They get resolved props and `children`, plus the current state and store.

## State model

```js
store.subscribe(() => render(store.getSnapshot()));
store.dispatch({type:'increment',path:'count',by:1});
store.setState('form.email','me@example.com');
store.patch({op:'replace',path:'/root/props/text',value:'Hello'});
```

All writes replace the `state` object or document immutably. `revision` increments for every successful state/document write.

## Not currently supported

There is no visual drag/drop authoring, untrusted CSS/JS execution, background automation, image/video generation, managed LLM API proxy, websocket service, theme editor, or npm publication workflow. There is a local-only example AI server under `examples/playground/`, which must not be deployed unchanged. These may be added in future releases.
