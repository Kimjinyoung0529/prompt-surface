# Prompt Surface protocol v1.0

A document consists of `{version:"1.0", title?, state:{}, root:Node}`. Nodes are `{id?, type, props?, bind?, when?, on?, children?}`. `type` may name a built-in component or a host-registered component.

## Conditions

`when` supports `{path, op, value}` with `truthy`, `falsy`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`. Missing conditions mean visible.

## State binding

`bind` is a dot-separated state path (for example, `user.email`). Input controls call `store.setState` when edited. Labels interpolate `{{user.email}}` safely as text.

## Actions

Actions are data, never JavaScript. Click handlers look like `{on:{click:[...]}}`. The built-in input controls also support `on.change`.

- `{type:"set",path:"count",value:3}`
- `{type:"toggle",path:"checked"}`
- `{type:"increment",path:"count",by:1}` (negative increments are allowed)
- `{type:"append",path:"items",value:"foo"}`
- `{type:"removeAt",path:"items",index:0}`
- `{type:"emit",name:"form.submit",payload:{source:"form"}}`

The host has to handle `emit` with its own authorization and side-effect logic. `event.state` contains the current browser-side form state.

## Streaming protocol

The transport is NDJSON (one JSON object per line) in UTF-8.

```
{"type":"snapshot","document":{"version":"1.0","state":{"count":1},"root":{"type":"text","props":{"text":"Count: {{count}}"}}}}
{"type":"patch","op":"replace","path":"/state/count","value":2}
```

A decoder reassembles chunk boundaries, parses complete lines and calls the store. The store accepts `snapshot` and `patch` events. Patch operations use JSON Pointer paths and may target only `/root`, `/state` or `/title`. The entire result is revalidated after each patch.

## JSON Schema

The bundled [`surface.schema.json`](surface.schema.json) expresses the machine-readable shape. Runtime validation has additional constraints and is authoritative.

## Additional v0.3 renderer node contracts

The core JSON schema is permissive about node types. Host renderers decide which `type` values are supported; Prompt Surface's React renderer includes the following contracts.

- `switch`, `radio-group`, `segmented-control`: set `bind` to state key; supply `props.label`, and for option controls `props.options` (strings or `{label,value}` objects).
- `tabs`: supply `bind`, `props.options` and `tab-panel` children. Set each panel's `props.value` to a matching option value. Tabs support click and keyboard navigation.
- `accordion`: supply `bind`, `props.options`, children with `props.value`. A bound string stores the single expanded option (empty string closes all).
- `carousel`: supply `bind` pointing to a numeric index, with child nodes acting as slides. Navigation wraps around.
- `table`: supply `props.columns: [{key,label}]`, plus `props.rows` or `props.dataPath` pointing to state. Cells render as text, not HTML.
- `list`: `props.items` or `props.dataPath`, optionally `props.ordered`.
- `callout`: `props.title`, `description`, `variant` (`info`, `success`, `warning`, `danger`).
- `code`/`quote`/`link`: text-only code and quote, and HTTP(S)/safe relative links; `javascript:` is blocked.
- `spacer`: `props.height` in clamped CSS pixels.
- `bar-chart` / `line-chart`: supply `props.data` or `props.dataPath` pointing to an array of `{label, value}` points, plus an optional `props.title`. SVG charts expose a descriptive accessible name and a screen-reader-only text summary of the displayed categories and numeric values (up to 36 points). Empty charts announce that no data is available. The text is escaped by React and never interpreted as HTML.

For reusable app integrations, always use unique node IDs. State paths passed through `bind` are validated and guarded against prototype pollution. When JSON is model-generated, authenticate privileged `emit` actions separately; a UI gesture does not grant backend authorization.
