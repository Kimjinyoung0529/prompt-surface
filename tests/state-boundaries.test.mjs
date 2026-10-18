import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceStore, SurfaceError, validateSurface } from '../src/index.js';

const document = () => ({ version: '1.0', state: { count: 1 }, root: { type: 'text' } });

test('setState rejects oversized state atomically and remains usable', () => {
  const store = createSurfaceStore(document());
  const initial = store.getSnapshot();
  let notifications = 0;
  store.subscribe(() => notifications++);
  assert.throws(() => store.setState('huge', 'x'.repeat(1024 * 1024)), SurfaceError);
  assert.equal(store.getSnapshot(), initial);
  assert.equal(store.getSnapshot().state.huge, undefined);
  assert.equal(notifications, 0);
  store.setState('count', 2);
  assert.equal(store.getSnapshot().state.count, 2);
  assert.equal(store.getSnapshot().revision, 1);
  assert.equal(notifications, 1);
});

test('invalid direct state writes and overflowing actions never notify', () => {
  const store = createSurfaceStore(document());
  store.setState('count', Number.MAX_VALUE);
  const before = store.getSnapshot();
  let notifications = 0;
  store.subscribe(() => notifications++);
  assert.throws(() => store.setState('count', Number.NaN), SurfaceError);
  assert.throws(() => store.setState('missing', undefined), SurfaceError);
  assert.throws(() => store.setState('__proto__.flag', true), SurfaceError);
  assert.throws(() => store.dispatch({ type: 'increment', path: 'count', by: Number.MAX_VALUE }), SurfaceError);
  assert.equal(store.getSnapshot(), before);
  assert.equal(notifications, 0);
  assert.equal({}.flag, undefined);
  assert.equal(validateSurface(store.getSnapshot().document).valid, true);
});
