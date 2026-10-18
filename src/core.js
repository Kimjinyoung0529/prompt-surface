/**
 * prompt-surface core — zero dependencies and no dynamic code execution.
 * Surface documents are data, never executable JSX/HTML/JavaScript.
 */
export const SURFACE_VERSION = '1.0';
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_NODES = 500;
const MAX_DEPTH = 32;
const MAX_DOCUMENT_BYTES = 1024 * 1024;

export class SurfaceError extends Error {
  constructor(message, code = 'SURFACE_INVALID') {
    super(message);
    this.name = 'SurfaceError';
    this.code = code;
  }
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function safeSegments(path) {
  if (typeof path !== 'string' || !path.length) throw new SurfaceError('Path must be a nonempty string', 'PATH_INVALID');
  const parts = path.split('.');
  if (parts.some(x => !x || FORBIDDEN.has(x))) throw new SurfaceError('Unsafe path', 'PATH_INVALID');
  return parts;
}

export function readPath(object, path, fallback = undefined) {
  if (!path) return fallback;
  const segments = safeSegments(path);
  let current = object;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) return fallback;
    current = current[segment];
  }
  return current === undefined ? fallback : current;
}

export function writePath(object, path, value) {
  const segments = safeSegments(path);
  const root = copyJson(object);
  let cursor = root;
  for (const part of segments.slice(0, -1)) {
    const next = cursor[part];
    if (next !== undefined && next !== null && !isPlainObject(next)) throw new SurfaceError('Cannot write through a non-object', 'PATH_INVALID');
    if (!isPlainObject(next)) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[segments.at(-1)] = copyJson(value);
  return root;
}

export function interpolate(template, state) {
  if (typeof template !== 'string') return String(template ?? '');
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    try {
      const value = readPath(state, path, '');
      return value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    } catch { return ''; }
  });
}

function validateJson(value, path, depth = 0, count = { value: 0 }) {
  if (depth > MAX_DEPTH) throw new SurfaceError(`Value too deep at ${path}`);
  count.value++;
  if (count.value > 10000) throw new SurfaceError('Too many values');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) validateJson(value[i], `${path}[${i}]`, depth + 1, count);
    return;
  }
  if (!isPlainObject(value)) throw new SurfaceError(`Expected JSON at ${path}`);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new SurfaceError(`Forbidden key at ${path}.${key}`, 'UNSAFE_KEY');
    validateJson(child, `${path}.${key}`, depth + 1, count);
  }
}

export function copyJson(value) {
  validateJson(value, 'value');
  return JSON.parse(JSON.stringify(value));
}

function checkAction(action) {
  if (!isPlainObject(action) || !['set','toggle','increment','append','removeAt','emit'].includes(action.type)) {
    throw new SurfaceError('Unsupported action');
  }
  if (action.type !== 'emit') safeSegments(action.path);
  if (action.type === 'emit' && (typeof action.name !== 'string' || !/^[\w.-]{1,80}$/.test(action.name))) {
    throw new SurfaceError('Invalid event name');
  }
  if (action.type === 'increment' && action.by !== undefined && (typeof action.by !== 'number' || !Number.isFinite(action.by))) throw new SurfaceError('Invalid increment');
  if (action.type === 'removeAt' && (!Number.isInteger(action.index) || action.index < 0)) throw new SurfaceError('Invalid array index');
  validateJson(action, 'action');
}

export function validateSurface(input) {
  try {
    validateJson(input, 'document');
    const length = JSON.stringify(input).length;
    if (length > MAX_DOCUMENT_BYTES) throw new SurfaceError('Document exceeds 1 MiB');
    if (!isPlainObject(input)) throw new SurfaceError('Document must be an object');
    if (input.version !== SURFACE_VERSION) throw new SurfaceError(`Version must be ${SURFACE_VERSION}`);
    if (!isPlainObject(input.state)) throw new SurfaceError('State must be an object');
    if (!isPlainObject(input.root)) throw new SurfaceError('Root node missing');
    const ids = new Set();
    let nodeCount = 0;
    const visit = (node, depth) => {
      if (depth > MAX_DEPTH) throw new SurfaceError('Tree too deep');
      if (++nodeCount > MAX_NODES) throw new SurfaceError('Too many UI nodes');
      if (!isPlainObject(node) || typeof node.type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(node.type)) throw new SurfaceError('Invalid node type');
      if (node.id !== undefined) {
        if (typeof node.id !== 'string' || !node.id.trim() || ids.has(node.id)) throw new SurfaceError('Duplicate or invalid node id');
        ids.add(node.id);
      }
      if (node.props !== undefined && !isPlainObject(node.props)) throw new SurfaceError('Node props must be an object');
      if (node.bind !== undefined) safeSegments(node.bind);
      if (node.when !== undefined) {
        if (!isPlainObject(node.when) || typeof node.when.path !== 'string') throw new SurfaceError('Invalid when condition');
        safeSegments(node.when.path);
        if (node.when.op !== undefined && !['eq','neq','truthy','falsy','gt','gte','lt','lte'].includes(node.when.op)) throw new SurfaceError('Invalid condition operator');
      }
      if (node.on !== undefined) {
        if (!isPlainObject(node.on)) throw new SurfaceError('Node on must be an object');
        for (const actions of Object.values(node.on)) {
          if (!Array.isArray(actions)) throw new SurfaceError('Handlers must be arrays');
          actions.forEach(checkAction);
        }
      }
      if (node.children !== undefined) {
        if (!Array.isArray(node.children)) throw new SurfaceError('Children must be an array');
        node.children.forEach(child => visit(child, depth + 1));
      }
    };
    visit(input.root, 0);
    return { valid: true, errors: [], nodeCount };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)], nodeCount: 0 };
  }
}

export function assertSurface(document) {
  const result = validateSurface(document);
  if (!result.valid) throw new SurfaceError(result.errors.join('; '));
  return document;
}

export function evaluateCondition(condition, state) {
  if (!condition) return true;
  const value = readPath(state, condition.path);
  switch (condition.op ?? 'truthy') {
    case 'eq': return Object.is(value, condition.value);
    case 'neq': return !Object.is(value, condition.value);
    case 'truthy': return Boolean(value);
    case 'falsy': return !value;
    case 'gt': return typeof value === 'number' && value > condition.value;
    case 'gte': return typeof value === 'number' && value >= condition.value;
    case 'lt': return typeof value === 'number' && value < condition.value;
    case 'lte': return typeof value === 'number' && value <= condition.value;
    default: return false;
  }
}

function pointerSegments(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new SurfaceError('Expected JSON pointer', 'POINTER_INVALID');
  const segments = pointer.slice(1).split('/').map(p => {
    if (/~(?![01])/.test(p)) throw new SurfaceError('Invalid pointer escaping', 'POINTER_INVALID');
    return p.replace(/~1/g, '/').replace(/~0/g, '~');
  });
  if (segments.some(segment => !segment || FORBIDDEN.has(segment))) throw new SurfaceError('Unsafe JSON pointer', 'POINTER_INVALID');
  if (!['root','state','title'].includes(segments[0])) throw new SurfaceError('Patch target not allowed', 'POINTER_INVALID');
  return segments;
}

/** Patch uses add/replace/remove JSON pointers; validation is atomic. */
export function patchSurface(document, patch) {
  assertSurface(document);
  if (!isPlainObject(patch) || !['add','replace','remove'].includes(patch.op)) throw new SurfaceError('Unsupported patch');
  const segments = pointerSegments(patch.path);
  if (segments.length === 1 && (patch.op === 'remove' || segments[0] === 'root' && patch.op === 'add')) throw new SurfaceError('Cannot remove essential fields');
  if (patch.op !== 'remove') validateJson(patch.value, 'patch.value');
  const cloned = copyJson(document);
  let target = cloned;
  for (const part of segments.slice(0, -1)) {
    if (Array.isArray(target)) {
      if (!/^(0|[1-9]\d*)$/.test(part) || Number(part) >= target.length) throw new SurfaceError('Invalid array path');
      target = target[Number(part)];
    } else {
      if (!isPlainObject(target) || !Object.prototype.hasOwnProperty.call(target, part)) throw new SurfaceError('Path not found');
      target = target[part];
    }
  }
  const last = segments.at(-1);
  if (Array.isArray(target)) {
    if (last !== '-' && !/^(0|[1-9]\d*)$/.test(last)) throw new SurfaceError('Invalid array index');
    const index = last === '-' ? target.length : Number(last);
    if (patch.op === 'add') {
      if (index > target.length) throw new SurfaceError('Index out of range');
      target.splice(index, 0, copyJson(patch.value));
    } else {
      if (index >= target.length) throw new SurfaceError('Index out of range');
      if (patch.op === 'remove') target.splice(index, 1);
      else target[index] = copyJson(patch.value);
    }
  } else {
    if (!isPlainObject(target)) throw new SurfaceError('Target is not an object');
    if (patch.op !== 'add' && !Object.prototype.hasOwnProperty.call(target, last)) throw new SurfaceError('Path not found');
    if (patch.op === 'remove') delete target[last];
    else target[last] = copyJson(patch.value);
  }
  assertSurface(cloned);
  return cloned;
}

/** Immutable observable store; action dispatch is a restricted data protocol. */
export function createSurfaceStore(initialDocument, options = {}) {
  let document = copyJson(assertSurface(initialDocument));
  let snapshot = { document, state: document.state, revision: 0 };
  const listeners = new Set();
  const notify = () => {
    snapshot = { document, state: document.state, revision: snapshot.revision + 1 };
    for (const fn of [...listeners]) fn();
  };
  const api = {
    getSnapshot: () => snapshot,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    setState: (path, value) => {
      document = { ...document, state: writePath(document.state, path, value) };
      notify();
    },
    dispatch: (action, event) => {
      checkAction(action);
      if (action.type === 'emit') {
        options.onEvent?.({ name: action.name, payload: copyJson(action.payload ?? null), state: copyJson(document.state), event });
        return;
      }
      const current = readPath(document.state, action.path);
      let next;
      switch (action.type) {
        case 'set': next = action.value; break;
        case 'toggle': next = !current; break;
        case 'increment': next = (typeof current === 'number' ? current : 0) + (action.by ?? 1); break;
        case 'append': next = [...(Array.isArray(current) ? current : []), action.value]; break;
        case 'removeAt': {
          if (!Array.isArray(current)) throw new SurfaceError('removeAt target is not an array');
          next = current.filter((_, index) => index !== action.index);
          break;
        }
      }
      api.setState(action.path, next);
    },
    dispatchAll: (actions, event) => {
      if (!Array.isArray(actions)) throw new SurfaceError('Actions must be an array');
      for (const action of actions) api.dispatch(action, event);
    },
    replaceDocument: next => { document = copyJson(assertSurface(next)); notify(); },
    patch: operation => { document = patchSurface(document, operation); notify(); },
    applyEvent: event => {
      if (!isPlainObject(event)) throw new SurfaceError('Invalid stream event');
      if (event.type === 'snapshot') api.replaceDocument(event.document);
      else if (event.type === 'patch') api.patch(event);
      else throw new SurfaceError('Unsupported stream event');
    }
  };
  return api;
}

/** Stateful decoder for newline-delimited JSON; no eval and bounded buffering. */
export function createJSONLDecoder(onEvent, options = {}) {
  if (typeof onEvent !== 'function') throw new SurfaceError('onEvent callback required', 'STREAM_INVALID');
  const maxLine = options.maxLineBytes ?? 256 * 1024;
  if (!Number.isSafeInteger(maxLine) || maxLine < 1) throw new SurfaceError('Invalid line limit', 'STREAM_INVALID');
  let buffer = '';
  let closed = false;
  const parse = line => {
    if (!line.trim()) return;
    if (BufferByteLength(line) > maxLine) throw new SurfaceError('Stream line exceeds limit', 'STREAM_TOO_LARGE');
    let value;
    try { value = JSON.parse(line); }
    catch { throw new SurfaceError('Invalid stream JSON', 'STREAM_INVALID'); }
    onEvent(value);
  };
  const push = chunk => {
    if (closed) throw new SurfaceError('Stream already finished');
    if (typeof chunk !== 'string') throw new SurfaceError('Chunk must be a string');
    let start = 0;
    for (let index = 0; index < chunk.length; index++) {
      if (chunk[index] !== '\n') continue;
      const line = buffer + chunk.slice(start, index);
      buffer = '';
      if (BufferByteLength(line) > maxLine) throw new SurfaceError('Stream line exceeds limit', 'STREAM_TOO_LARGE');
      parse(line.replace(/\r$/, ''));
      start = index + 1;
    }
    buffer += chunk.slice(start);
    if (BufferByteLength(buffer) > maxLine) throw new SurfaceError('Stream line exceeds limit', 'STREAM_TOO_LARGE');
  };
  const finish = () => { if (!closed) { if (buffer.trim()) parse(buffer); buffer = ''; closed = true; } };
  return { push, finish };
}

function BufferByteLength(value) {
  // TextEncoder is supported in browsers and in Node 18+.
  return new TextEncoder().encode(value).length;
}

/** Generator-agnostic prompt fragment; use on your server, never expose secrets. */
export function surfaceSystemPrompt() {
  return `You produce data-only Prompt Surface documents, not HTML, JSX or JavaScript. Return a valid JSON object: {"version":"1.0","title":"...","state":{},"root":{"type":"column","props":{},"children":[]}}. Use nodes heading, text, card, row, column, grid, badge, divider, button, input, textarea, checkbox, switch, radio-group, segmented-control, tabs with tab-panel children, accordion, carousel, slider, select, progress, metric, callout, quote, link, code, list, table, spacer, image, bar-chart, line-chart. For tabs and accordion, use bind to a string state path, props.options [{label,value}], and child nodes with props.value matching an option. Carousel children are slides and bind is a numeric state index. For tables, use props.columns [{key,label}] and props.rows [{key:value}]. Each node may contain id, props, bind (dot-separated state path), when {path,op,value}, on {click:[{type:"set|toggle|increment|append|removeAt|emit",path,...}]}, children. Text and labels can interpolate state as {{field}}. Output JSON only. Never place JavaScript, onClick strings, arbitrary HTML, markdown code fences or API keys in the document. Max ${MAX_NODES} nodes.`;
}
