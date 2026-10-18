import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSurface, assertSurface, readPath, writePath, patchSurface, createSurfaceStore,
  createJSONLDecoder, SurfaceError, interpolate, evaluateCondition, surfaceSystemPrompt,
} from '../src/index.js';

const fixture = () => ({
  version:'1.0', title:'Recipe',
  state:{servings:2, accepted:false, items:['tomato'], profile:{name:'Jane'}},
  root:{type:'column',id:'root',children:[
    {type:'heading',props:{text:'Servings: {{servings}}'}},
    {type:'button',props:{label:'More'},on:{click:[{type:'increment',path:'servings',by:1}]}},
    {type:'checkbox',props:{label:'Agreed'},bind:'accepted'}
  ]}
});

test('validates minimal and nested documents',()=>{
  assert.deepEqual(validateSurface(fixture()),{valid:true,errors:[],nodeCount:4});
  assert.equal(assertSurface(fixture()).title,'Recipe');
});
test('rejects duplicate node ids and unsafe document keys',()=>{
  const dup=fixture();dup.root.children[0].id='root';assert.equal(validateSurface(dup).valid,false);
  const hostile=JSON.parse('{"version":"1.0","state":{"__proto__":{"admin":true}},"root":{"type":"text"}}');
  assert.equal(validateSurface(hostile).valid,false);
  assert.equal({}.admin,undefined);
});
test('rejects unsupported actions and non-JSON values',()=>{
  const doc=fixture(); doc.root.on={click:[{type:'eval',code:'alert(1)'}]};
  assert.equal(validateSurface(doc).valid,false);
  const invalid=fixture(); invalid.state.x=Infinity;
  assert.equal(validateSurface(invalid).valid,false);
});
test('immutable paths, interpolation and conditions',()=>{
  const source={nested:{count:1}};
  const edited=writePath(source,'nested.count',4);
  assert.equal(source.nested.count,1);
  assert.equal(readPath(edited,'nested.count'),4);
  assert.equal(readPath(edited,'missing','default'),'default');
  assert.equal(interpolate('Hello {{profile.name}}, {{servings}}!',fixture().state),'Hello Jane, 2!');
  assert.equal(evaluateCondition({path:'servings',op:'gte',value:2},fixture().state),true);
  assert.throws(()=>writePath({},'__proto__.polluted',true),SurfaceError);
  assert.equal({}.polluted,undefined);
});
test('store dispatch updates and events',()=>{
  const events=[];
  const store=createSurfaceStore(fixture(),{onEvent:e=>events.push(e)});
  const versions=[];const unsub=store.subscribe(()=>versions.push(store.getSnapshot().revision));
  store.dispatch({type:'increment',path:'servings',by:2});
  store.dispatch({type:'toggle',path:'accepted'});
  store.dispatch({type:'append',path:'items',value:'cheese'});
  store.dispatch({type:'removeAt',path:'items',index:0});
  store.dispatch({type:'set',path:'profile.name',value:'Mo'});
  store.dispatch({type:'emit',name:'order',payload:{id:42}});
  assert.equal(store.getSnapshot().state.servings,4);
  assert.equal(store.getSnapshot().state.accepted,true);
  assert.deepEqual(store.getSnapshot().state.items,['cheese']);
  assert.equal(store.getSnapshot().state.profile.name,'Mo');
  assert.equal(events.length,1);
  assert.deepEqual(versions,[1,2,3,4,5]);
  unsub();
});
test('safe add / replace / remove patches without mutating input',()=>{
  const source=fixture();
  let next=patchSurface(source,{op:'add',path:'/root/children/-',value:{type:'text',props:{text:'Hello'}}});
  assert.equal(next.root.children.length,4);
  next=patchSurface(next,{op:'replace',path:'/root/children/0/props/text',value:'Welcome'});
  next=patchSurface(next,{op:'remove',path:'/root/children/3'});
  assert.equal(next.root.children[0].props.text,'Welcome');
  assert.equal(next.root.children.length,3);
  assert.equal(source.root.children[0].props.text,'Servings: {{servings}}');
});
test('patch validation is atomic and disallows prototype pollution',()=>{
  const source=fixture();
  assert.throws(()=>patchSurface(source,{op:'replace',path:'/state/__proto__/flag',value:true}),SurfaceError);
  assert.throws(()=>patchSurface(source,{op:'replace',path:'/root/children/0/type',value:123}),SurfaceError);
  assert.throws(()=>patchSurface(source,{op:'remove',path:'/root'}),SurfaceError);
  assert.equal(source.root.children[0].type,'heading');
  assert.equal({}.flag,undefined);
});
test('decoder handles split streaming chunks and snapshots/patches',()=>{
  const store=createSurfaceStore(fixture());
  const decoder=createJSONLDecoder(event=>store.applyEvent(event));
  const one=JSON.stringify({type:'patch',op:'replace',path:'/state/servings',value:6});
  decoder.push(one.slice(0,13));decoder.push(one.slice(13)+'\n');
  decoder.finish();
  assert.equal(store.getSnapshot().state.servings,6);
  assert.throws(()=>decoder.push('{}\n'),SurfaceError);
});
test('decoder rejects invalid lines and oversized buffers',()=>{
  const decoder=createJSONLDecoder(()=>{}, {maxLineBytes:20});
  assert.throws(()=>decoder.push('x'.repeat(21)), SurfaceError);
  const decoder2=createJSONLDecoder(()=>{});
  assert.throws(()=>decoder2.push('{bad json}\n'), SurfaceError);
});
test('generated system prompt describes safe protocol',()=>{
  const prompt=surfaceSystemPrompt();
  assert.match(prompt,/data-only/);
  assert.match(prompt,/version/);
});


test('state updates reject oversized and non-finite results without mutation or notifications',()=>{
  const store=createSurfaceStore(fixture());
  const original=store.getSnapshot();
  let notices=0;
  store.subscribe(()=>notices++);
  assert.throws(()=>store.setState('oversized','x'.repeat(1024*1024)),SurfaceError);
  assert.strictEqual(store.getSnapshot(),original);
  assert.equal(notices,0);
  store.setState('servings',1e308);
  const beforeOverflow=store.getSnapshot();
  assert.throws(()=>store.dispatch({type:'increment',path:'servings',by:1e308}),SurfaceError);
  assert.strictEqual(store.getSnapshot(),beforeOverflow);
  assert.equal(notices,1);
  assert.equal(validateSurface(store.getSnapshot().document).valid,true);
});

test('dispatchAll is atomic and defers host events until after commit',()=>{
  const events=[];
  const store=createSurfaceStore(fixture(),{onEvent:emitted=>events.push(emitted)});
  let notices=0;
  store.subscribe(()=>notices++);
  const initial=store.getSnapshot();
  assert.throws(()=>store.dispatchAll([
    {type:'increment',path:'servings',by:1},
    {type:'emit',name:'checkout'},
    {type:'removeAt',path:'items',index:-1}
  ]),SurfaceError);
  assert.strictEqual(store.getSnapshot(),initial);
  assert.equal(notices,0);
  assert.deepEqual(events,[]);

  store.dispatchAll([
    {type:'increment',path:'servings',by:1},
    {type:'emit',name:'checkout'},
    {type:'toggle',path:'accepted'}
  ],'click');
  assert.equal(store.getSnapshot().state.servings,3);
  assert.equal(store.getSnapshot().state.accepted,true);
  assert.equal(notices,1);
  assert.equal(events.length,1);
  assert.equal(events[0].name,'checkout');
  assert.equal(events[0].event,'click');
  assert.equal(events[0].state.servings,3);
  assert.equal(events[0].state.accepted,false);
  store.dispatchAll([{type:'emit',name:'ping'}]);
  assert.equal(notices,1);
  assert.equal(events.length,2);
});
