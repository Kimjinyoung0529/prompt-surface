import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceStore, createJSONLDecoder, SurfaceError } from '../src/index.js';
import { consumeSurfaceStream, createSurfaceEventDecoder, parseSurfaceText } from '../src/transport.js';

const initial = () => ({version:'1.0', title:'Counter', state:{count:0}, root:{type:'heading',props:{text:'Count: {{count}}'}}});
const snapshot = () => ({type:'snapshot', document:initial()});
const patch = n => ({type:'patch',op:'replace',path:'/state/count',value:n});
const bytes = s => new TextEncoder().encode(s);
const chunks = (...parts) => new ReadableStream({start(c){ for(const p of parts)c.enqueue(typeof p==='string'?bytes(p):p);c.close(); }});

test('validates complete JSON model responses, rejects code fences and hostile keys',()=>{
  assert.deepEqual(parseSurfaceText(JSON.stringify(initial())),initial());
  assert.throws(()=>parseSurfaceText('```json\n{}\n```'),e=>e.code==='RESPONSE_INVALID');
  assert.throws(()=>parseSurfaceText('{"version":"1.0","state":{"__proto__":{"x":1}},"root":{"type":"text"}}'),SurfaceError);
});

test('JSONL accepts large multi-event chunks even with small individual line limits',()=>{
  let n=0;
  const decoder=createJSONLDecoder(()=>n++,{maxLineBytes:40});
  decoder.push(('{}\n').repeat(1000));
  decoder.finish();
  assert.equal(n,1000);
});

test('event decoder parses split JSONL and SSE frames',()=>{
  const seen=[];
  const d=createSurfaceEventDecoder(event=>seen.push(event),{format:'sse'});
  d.push('event: surface\r\ndata: '+JSON.stringify(patch(3)).slice(0,10));
  d.push(JSON.stringify(patch(3)).slice(10)+'\r\n\r\n: heartbeat\n\n');
  d.push('data: [DONE]\n\n');
  d.finish();
  assert.deepEqual(seen,[patch(3)]);
  assert.throws(()=>d.push('x'),SurfaceError);
});

test('SSE validates event JSON and imposes frame limits',()=>{
  const bad=createSurfaceEventDecoder(()=>{},{format:'sse'});
  assert.throws(()=>bad.push('data: {oops}\n\n'),e=>e.code==='STREAM_INVALID');
  const tooBig=createSurfaceEventDecoder(()=>{},{format:'sse',maxLineBytes:30});
  assert.throws(()=>tooBig.push('data: '+JSON.stringify(patch(5))+'\n\n'),e=>e.code==='STREAM_TOO_LARGE');
  assert.throws(()=>createSurfaceEventDecoder(()=>{},{format:'wat'}),SurfaceError);
});

test('consumes JSONL byte-stream chunks and keeps all state in sync',async()=>{
  const store=createSurfaceStore(initial());
  const lines=[snapshot(),patch(4),patch(9)].map(x=>JSON.stringify(x)+'\n').join('');
  const mid=lines.indexOf('\n')+3;
  const seen=[];
  const result=await consumeSurfaceStream(chunks(lines.slice(0,mid),lines.slice(mid)),store,{onEvent:(e,s)=>seen.push(s.state.count)});
  assert.equal(result.events,3);
  assert.equal(result.bytes,bytes(lines).length);
  assert.deepEqual(seen,[0,4,9]);
  assert.equal(store.getSnapshot().state.count,9);
});

test('consumes SSE frames from a Response',async()=>{
  const store=createSurfaceStore(initial());
  const lines=`data: ${JSON.stringify(snapshot())}\n\ndata: ${JSON.stringify(patch(17))}\n\ndata: [DONE]\n\n`;
  const response=new Response(chunks(lines),{headers:{'content-type':'text/event-stream'}});
  const result=await consumeSurfaceStream(response,store,{format:'sse'});
  assert.equal(result.events,2);
  assert.equal(store.getSnapshot().state.count,17);
});

test('does not commit invalid patch and surfaces http failures',async()=>{
  const store=createSurfaceStore(initial());
  // JSON.stringify Infinity becomes null, so explicitly use a schema-invalid UI patch.
  const data=JSON.stringify(patch(5))+'\n'+JSON.stringify({type:'patch',op:'replace',path:'/root/type',value:14})+'\n';
  await assert.rejects(consumeSurfaceStream(chunks(data),store),SurfaceError);
  assert.equal(store.getSnapshot().state.count,5);
  await assert.rejects(consumeSurfaceStream(new Response('oops',{status:503}),store),e=>e.code==='HTTP_ERROR');
});

test('rejects total size overrun and malformed UTF-8',async()=>{
  const store=createSurfaceStore(initial());
  await assert.rejects(consumeSurfaceStream(chunks(JSON.stringify(snapshot())+'\n'),store,{maxTotalBytes:10}),e=>e.code==='STREAM_TOO_LARGE');
  await assert.rejects(consumeSurfaceStream(chunks(Uint8Array.from([0xC3,0x28])),store),TypeError);
});

test('aborts pending transport without completing it',async()=>{
  const controller=new AbortController();
  let canceled=false;
  const stream=new ReadableStream({
    start(c){c.enqueue(bytes(JSON.stringify(snapshot())+'\n'));},
    cancel(){canceled=true;}
  });
  const store=createSurfaceStore(initial());
  const p=consumeSurfaceStream(stream,store,{signal:controller.signal,onEvent:()=>controller.abort()});
  await assert.rejects(p,e=>e.code==='ABORTED');
  assert.equal(canceled,true);
});

test('handles split multibyte UTF-8 without corrupting JSON strings',async()=>{
  const doc=initial();doc.title='한글 ⭐';
  const line=bytes(JSON.stringify({type:'snapshot',document:doc})+'\n');
  const idx=line.indexOf(0xED); // first byte of a Korean character
  assert.ok(idx>0);
  const store=createSurfaceStore(initial());
  await consumeSurfaceStream(chunks(line.slice(0,idx+1),line.slice(idx+1)),store);
  assert.equal(store.getSnapshot().document.title,'한글 ⭐');
});
