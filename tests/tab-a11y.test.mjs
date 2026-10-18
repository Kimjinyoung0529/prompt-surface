import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedTabValue } from '../src/tab-a11y.js';

const options = [{label:'Overview',value:'overview'},{label:'Settings',value:'settings'}];

test('tabs retain valid bound selection over defaults', () => {
  assert.equal(selectedTabValue(options,'settings','overview'),'settings');
});

test('tabs fall back to a valid default, then first tab for stale state', () => {
  assert.equal(selectedTabValue(options,'removed','settings'),'settings');
  assert.equal(selectedTabValue(options,'removed','also-removed'),'overview');
  assert.equal(selectedTabValue(options,undefined,undefined),'overview');
});

test('tabs support empty-string and numeric option values without losing focusability', () => {
  assert.equal(selectedTabValue([{label:'None',value:''},{label:'One',value:'1'}],'', '1'), '');
  assert.equal(selectedTabValue([{label:'Zero',value:'0'},{label:'One',value:'1'}],0,1),'0');
});

test('tabs with no options have no selection', () => {
  assert.equal(selectedTabValue([], 'removed', 'also-removed'), '');
});
