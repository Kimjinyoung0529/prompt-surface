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
