import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateSurface, createSurfaceStore, interpolate, patchSurface } from '../src/index.js';

const load = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));
const findNode = (node,type) => node.type===type?node:(node.children??[]).map(n=>findNode(n,type)).find(Boolean);

for (const name of ['recipe','dashboard','planner','showcase','quiz']) {
  test(`gallery preset ${name} passes full JSON protocol validation`,()=>{
    const doc = load(name);
    const validation = validateSurface(doc);
    assert.equal(validation.valid,true,validation.errors.join('; '));
    assert.ok(validation.nodeCount>3);
  });
}

test('gallery tabs have a bound state key and matching panels',()=>{
  for(const name of ['planner','showcase']){
    const doc=load(name),tabs=findNode(doc.root,'tabs');
    assert.ok(tabs);
    assert.equal(typeof doc.state[tabs.bind], 'string');
    assert.equal(tabs.children.length, tabs.props.options.length);
    for(const option of tabs.props.options){
      assert.ok(tabs.children.some(n=>n.type==='tab-panel'&&n.props.value===option.value));
    }
  }
});

test('the new controls operate with the same state-store API',()=>{
  const store=createSurfaceStore(load('planner'));
  store.setState('activeTab','costs');
  store.setState('pace','active');
  store.setState('slideIndex',2);
  store.setState('reminders',false);
  assert.deepEqual([store.getSnapshot().state.activeTab,store.getSnapshot().state.pace,store.getSnapshot().state.slideIndex,store.getSnapshot().state.reminders],['costs','active',2,false]);
  assert.match(interpolate('Travelers: {{guests}}',store.getSnapshot().state),/2/);
});

test('patches never allow model data to inject JavaScript actions',()=>{
  const doc=load('showcase');
  assert.throws(()=>patchSurface(doc,{op:'add',path:'/root/children/-',value:{type:'button',on:{click:[{type:'javascript',code:'alert(1)'}]}}}));
  assert.equal(validateSurface(doc).valid,true);
});
