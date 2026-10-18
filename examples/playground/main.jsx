import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Surface } from 'prompt-surface/react';
import { createSurfaceStore, validateSurface } from 'prompt-surface';
import { consumeSurfaceStream, parseSurfaceText } from 'prompt-surface/transport';
import recipe from '../recipe.json';
import dashboard from '../dashboard.json';
import planner from '../planner.json';
import showcase from '../showcase.json';
import quiz from '../quiz.json';
import 'prompt-surface/styles.css';
import './style.css';

const presets = { 'Recipe planner':recipe, 'Dashboard':dashboard, 'Travel planner':planner, 'UI Gallery':showcase, 'Knowledge quiz':quiz };
const presetIcons = { 'Recipe planner':'🍋', 'Dashboard':'📊', 'Travel planner':'🗺️', 'UI Gallery':'✦', 'Knowledge quiz':'🎓' };
const clone = obj => JSON.parse(JSON.stringify(obj));
const initial = clone(recipe);

function App() {
  const [events,setEvents] = useState([]);
  const [doc,setDoc] = useState(initial);
  const [editor,setEditor] = useState(JSON.stringify(initial,null,2));
  const [prompt,setPrompt] = useState('Build a travel planning UI with a destination field, a budget slider and an itinerary card.');
  const [status,setStatus] = useState('Ready — choose a preset, edit JSON, or connect a model');
  const [busy,setBusy] = useState(false);
  const [active,setActive] = useState('Recipe planner');
  const [theme,setTheme] = useState('light');
  const [showEditor,setShowEditor] = useState(true);
  const store = useMemo(() => createSurfaceStore(initial,{
    onEvent:event=>setEvents(prev=>[`${new Date().toLocaleTimeString()} • ${event.name}`, ...prev].slice(0,8))
  }),[]);
  useEffect(() => store.subscribe(() => setDoc(store.getSnapshot().document)),[store]);
  const validation = useMemo(() => {try{return validateSurface(JSON.parse(editor));}catch(e){return {valid:false,errors:[e.message]};}},[editor]);
  const install = (document,label) => {
    store.replaceDocument(document);
    setDoc(document);
    setEditor(JSON.stringify(document,null,2));
    setStatus(label);
  };
  const loadPreset = name => {setActive(name);install(clone(presets[name]),`${name} loaded`);};
  const resetSurface = () => {
    const base = presets[active] ?? recipe;
    install(clone(base),'Document and interactive state reset');
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(store.getSnapshot().document,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'surface.json';
    link.click(); URL.revokeObjectURL(url);
  };
  const applyJson = () => {
    try {install(parseSurfaceText(editor),'Document updated from JSON editor');}
    catch(error){setStatus(`Invalid document: ${error.message}`);}
  };
  const generate = async () => {
    setBusy(true);setStatus('Contacting your local model backend…');
    try {
      const response = await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
      if (!response.ok) {const body=await response.json().catch(()=>({error:response.statusText}));throw new Error(body.error??`HTTP ${response.status}`);}
      install(parseSurfaceText(await response.text()),'AI-generated document validated and rendered');
      setActive('AI generated');
    } catch(error) {setStatus(`Generation failed: ${error.message}`);} finally {setBusy(false);}
  };
  const simulate = async () => {
    setBusy(true);
    setStatus('Applying simulated JSONL stream…');
    try {
      const base=clone(recipe);
      const stream=new ReadableStream({start(controller){
        const encoder=new TextEncoder();
        const events=[
          {type:'snapshot',document:base},
          {type:'patch',op:'replace',path:'/state/servings',value:4},
          {type:'patch',op:'replace',path:'/state/name',value:'Prompt Surface'}
        ];
        for(const event of events)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));
        controller.close();
      }});
      const result=await consumeSurfaceStream(stream,store);
      setEditor(JSON.stringify(store.getSnapshot().document,null,2));
      setStatus(`Processed ${result.events} stream events (${result.bytes} bytes)`);
      setActive('Stream');
    } catch(error) {setStatus(`Stream failed: ${error.message}`);} finally {setBusy(false);}
  };
  return <div className="studio">
    <a className="skip-link" href="#studio-workspace">Skip to workspace</a>
    <header className="topbar">
      <div className="brand"><div className="mark">✳</div><div><strong>Prompt Surface</strong><small>STUDIO · 0.3.0</small></div></div>
      <div className="top-right"><span className="pill"><span className="live-dot"/> Local development</span><a href="https://github.com/Kimjinyoung0529/prompt-surface" target="_blank" rel="noreferrer">GitHub ↗</a></div>
    </header>
    <main id="studio-workspace">
      <div className="intro"><div><p className="eyebrow">GENERATIVE UI ENGINE</p><h1>Build conversations that become interfaces.</h1><p>Compose responsive, stateful cards, charts, tabs, carousels and forms from validated JSON — no generated code execution.</p></div><div className="version-chip">Version 0.3.0 · 33 components</div></div>
      <div className="workspace">
        <section className="panel controls"><div className="panel-heading"><span className="step">01</span><div><h2>Create</h2><p>Explore five fully interactive UI templates</p></div></div>
          <label className="field-label">PRESET DOCUMENTS</label>
          <div className="presets">{Object.keys(presets).map(name=><button key={name} className={active===name?'preset selected':'preset'} onClick={()=>loadPreset(name)}>{presetIcons[name]} {name}</button>)}</div>
          <div className="rule"/>
          <label htmlFor="prompt" className="field-label">GENERATE WITH AN AI MODEL</label>
          <textarea id="prompt" className="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={1000}/>
          <button className="primary" onClick={generate} disabled={busy||!prompt.trim()}>✦ Generate surface</button>
          <div className="hint">Optional: run <code>npm run server</code> with <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL</code> on your computer. The browser never receives your API key.</div>
          <button className="outline" onClick={simulate} disabled={busy}>▶ Simulate JSONL stream</button>
          <div className="rule"/>
          <div className="side-status" role="status" aria-live="polite"><span className="status-dot"/>{status}</div>
          {events.length>0&&<div className="events"><label className="field-label">HOST EVENTS</label>{events.map((e,i)=><div className="event" key={i}>{e}</div>)}</div>}
        </section>
        <section className="panel preview"><div className="panel-heading"><span className="step">02</span><div><h2>Live preview</h2><p>Click, type and interact with the generated components</p></div></div>
          <div className="preview-toolbar"><span>Interactive canvas · React</span><div className="toolbar-controls"><button type="button" className="toolbar-action" aria-label="Toggle preview theme" onClick={()=>setTheme(v=>v==='light'?'dark':'light')}>{theme==='light'?'☾ Dark':'☀ Light'}</button><button type="button" className="toolbar-action" onClick={resetSurface}>↺ Reset state</button></div></div>
          <div className={`preview-stage preview-${theme}`}><div className="stage-top"><span className="stage-bullet"/><span className="stage-bullet"/><span className="stage-bullet"/><span className="stage-title">{doc.title??'Untitled surface'}</span></div><div className="stage-body"><Surface store={store} theme={theme}/></div></div>
          <div className="note">State changes are local and immediate. Host-only events appear in the left panel.</div>
        </section>
        <section className="panel codepanel"><div className="panel-heading"><span className="step">03</span><div><h2>Inspect & edit</h2><p>Validate the protocol and apply your changes</p></div><button type="button" className="editor-toggle" onClick={()=>setShowEditor(v=>!v)} aria-expanded={showEditor} aria-controls="json-editor-area">{showEditor?'Collapse':'Expand'}</button></div>
          <div id="json-editor-area" hidden={!showEditor}>
          <div className="editor-header"><span>surface.json</span><span className={validation.valid?'valid':'invalid'}>{validation.valid?'✓ Valid':'✕ Invalid'}</span></div>
          <textarea aria-label="JSON document editor" className="json-editor" spellCheck="false" value={editor} onChange={e=>setEditor(e.target.value)}/>
          {!validation.valid&&<div className="validation-error">{validation.errors?.[0]}</div>}
          <button className="primary" onClick={applyJson} disabled={!validation.valid}>Apply JSON →</button>
          <button type="button" className="outline" onClick={downloadJson}>↓ Export surface.json</button>
          </div>
          <p className="footnote">No JSX evaluation. All nodes and actions are validated before rendering.</p>
        </section>
      </div>
    </main>
    <footer>Built with Prompt Surface · MIT licensed · Provider agnostic</footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
