/** React renderer for prompt-surface — no arbitrary markup or code execution. */
import * as React from 'react';
import { createSurfaceStore, evaluateCondition, interpolate, readPath } from './core.js';
import { chartAccessibleDescription } from './chart-a11y.js';

const h = React.createElement;
const SurfaceContext = React.createContext(null);
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value) || low));
const safeUrl = url => typeof url === 'string' && /^https?:\/\//i.test(url) ? url : undefined;
const safeLink = url => typeof url === 'string' && (/^https?:\/\//i.test(url) || /^(?:\/[^/]|#[a-z0-9_-])/i.test(url)) ? url : undefined;
const optionsOf = value => (Array.isArray(value) ? value : []).slice(0, 60).map((item, index) => typeof item === 'string' ? {label:item,value:item} : {label:String(item?.label ?? item?.value ?? index),value:String(item?.value ?? index)});
const safeRead = (state, path) => { try { return readPath(state, path); } catch { return undefined; } };
const units = x => typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(64, x)) : 12;

/** Use a store to drive multiple UI surfaces from the same state. */
export function SurfaceProvider({ store, children }) {
  if (!store || typeof store.subscribe !== 'function') throw new Error('SurfaceProvider requires a surface store');
  return h(SurfaceContext.Provider, { value: store }, children);
}

export function useSurface() {
  const store = React.useContext(SurfaceContext);
  if (!store) throw new Error('useSurface requires a SurfaceProvider');
  const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, store, setState: store.setState, dispatch: store.dispatch, patch: store.patch };
}

/**
 * Surface can use an externally controlled store or build its own from document.
 * Custom registry functions receive {node, props, children, state, store, emit}.
 */
export function Surface({ document, store: suppliedStore, registry = {}, onEvent, className = '', theme = 'light', empty = null }) {
  const instanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;
  const localStore = React.useMemo(() => document ? createSurfaceStore(document, {
    onEvent: event => onEventRef.current?.(event)
  }) : null, []);
  const contextStore = React.useContext(SurfaceContext);
  const store = suppliedStore ?? contextStore ?? localStore;
  if (!store) throw new Error('Surface needs a document, store or SurfaceProvider');
  React.useEffect(() => { if (document && !suppliedStore && !contextStore) store.replaceDocument(document); }, [document, suppliedStore, contextStore, store]);
  const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const state = snapshot.state;
  const renderNode = (node, key) => {
    if (!evaluateCondition(node.when, state)) return null;
    const p = node.props ?? {};
    const text = value => interpolate(value ?? '', state);
    const props = {...p};
    for (const name of ['text','label','description','title','subtitle','value']) {
      if (typeof props[name] === 'string') props[name] = text(props[name]);
    }
    const handle = name => event => store.dispatchAll(node.on?.[name] ?? [], event?.type);
    const childNodes = node.children?.map((child, i) => renderNode(child, child.id ?? i)) ?? [];
    const id = node.id ?? key;
    const domId = `ps-${instanceId}-${String(id ?? 'element').replace(/[^a-zA-Z0-9_-]/g,'-')}`;
    const gap = units(p.gap);
    const css = { gap: `${gap}px` };
    const inputValue = node.bind ? readPath(state, node.bind, '') : (props.value ?? '');
    const change = value => { if (node.bind) store.setState(node.bind, value); handle('change')({type:'change'}); };
    const wrap = element => h(React.Fragment, {key: id}, element);
    if (typeof registry[node.type] === 'function') {
      return wrap(registry[node.type]({node, props, children: childNodes, state, store, emit: (name,payload) => onEventRef.current?.({name,payload,state})}));
    }
    switch (node.type) {
      case 'column': return h('div', {key:id,className:'ps-column',style:css}, childNodes);
      case 'row': return h('div', {key:id,className:'ps-row',style:css}, childNodes);
      case 'grid': return h('div', {key:id,className:'ps-grid',style:{...css,'--ps-cols':clamp(p.columns ?? 2,1,6)}}, childNodes);
      case 'card': return h('section', {key:id,className:'ps-card'}, childNodes);
      case 'heading': {
        const level = Math.round(clamp(p.level ?? 2,1,6));
        return h(`h${level}`, {key:id,className:'ps-heading'}, text(p.text));
      }
      case 'text': return h('p',{key:id,className:'ps-text'},text(p.text));
      case 'badge': return h('span',{key:id,className:'ps-badge'},text(p.text ?? p.label));
      case 'divider': return h('hr',{key:id,className:'ps-divider'});
      case 'button': return h('button', {key:id,type:'button',className:'ps-button',disabled:!!p.disabled,onClick:handle('click')},text(p.label ?? 'Button'));
      case 'input': return h('label',{key:id,className:'ps-field'},
        p.label ? h('span',null,text(p.label)) : null,
        h('input',{className:'ps-input',type:['text','email','number'].includes(p.inputType)?p.inputType:'text',placeholder:text(p.placeholder),value:inputValue ?? '',min:p.min,max:p.max,onChange:e=>change(p.inputType==='number' ? Number(e.target.value) : e.target.value)}));
      case 'textarea': return h('label',{key:id,className:'ps-field'},
        p.label ? h('span',null,text(p.label)) : null,
        h('textarea',{className:'ps-input',rows:clamp(p.rows??3,1,12),value:inputValue??'',placeholder:text(p.placeholder),onChange:e=>change(e.target.value)}));
      case 'checkbox': return h('label',{key:id,className:'ps-checkbox'},
        h('input',{type:'checkbox',checked:!!inputValue,onChange:e=>change(e.target.checked)}),
        h('span',null,text(p.label)));
      case 'slider': return h('label',{key:id,className:'ps-field'},
        h('span',null,`${text(p.label)}${p.showValue === false ? '' : `: ${inputValue}`}`),
        h('input',{type:'range',className:'ps-range',min:p.min??0,max:p.max??100,step:p.step??1,value:inputValue,onChange:e=>change(Number(e.target.value))}));
      case 'select': return h('label',{key:id,className:'ps-field'},
        p.label ? h('span',null,text(p.label)) : null,
        h('select',{className:'ps-input',value:inputValue,onChange:e=>change(e.target.value)},
          (Array.isArray(p.options)?p.options:[]).map((option,i)=>{
            const value = typeof option==='string'?option:String(option?.value??'');
            const label = typeof option==='string'?option:String(option?.label??value);
            return h('option',{key:i,value},label);
          })));
      case 'switch': return h('label',{key:id,className:'ps-switch'},
        h('input',{type:'checkbox',role:'switch',checked:!!inputValue,onChange:e=>change(e.target.checked)}),
        h('span',{className:'ps-switch-track','aria-hidden':true}),
        h('span',null,text(p.label)));
      case 'radio-group': return h('fieldset',{key:id,className:'ps-radio-group'},
        p.label ? h('legend',null,text(p.label)) : null,
        ...optionsOf(p.options).map((option,i)=>h('label',{key:i,className:'ps-radio-option'},
          h('input',{type:'radio',name:domId,value:option.value,checked:String(inputValue)===option.value,onChange:()=>change(option.value)}),
          h('span',null,text(option.label)))));
      case 'segmented-control': return h('div',{key:id,className:'ps-segmented',role:'group','aria-label':text(p.label??'Options')},
        ...optionsOf(p.options).map((option,i)=>h('button',{key:i,type:'button',className:'ps-segment', 'aria-pressed':String(inputValue)===option.value,
          onClick:()=>change(option.value)},text(option.label))));
      case 'tabs': {
        const options = optionsOf(p.options);
        const selected = String(inputValue || p.defaultValue || options[0]?.value || '');
        const panel = (node.children??[]).find(child=>child.type==='tab-panel' && String(child.props?.value)===selected);
        return h('div',{key:id,className:'ps-tabs'},
          h('div',{role:'tablist','aria-label':text(p.label??'Tabs'),className:'ps-tab-list'},
            ...options.map((option,i)=>h('button',{key:i,type:'button',role:'tab',id:`${domId}-tab-${i}`,className:'ps-tab',
              'aria-selected':selected===option.value,'aria-controls':`${domId}-panel`,tabIndex:selected===option.value?0:-1,
              onKeyDown:e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
                e.preventDefault();let next=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowRight'?1:-1)+options.length)%options.length;
                change(options[next].value);e.currentTarget.parentElement?.children[next]?.focus();},
              onClick:()=>change(option.value)},text(option.label)))),
          h('div',{role:'tabpanel',id:`${domId}-panel`,className:'ps-tab-panel','aria-labelledby':`${domId}-tab-${Math.max(0,options.findIndex(item=>item.value===selected))}`},
            panel?.children?.map((child,i)=>renderNode(child,child.id??i)) ?? null));
      }
      case 'tab-panel': return h('div',{key:id,className:'ps-tab-panel'},childNodes);
      case 'accordion': {
        const options = optionsOf(p.options);
        const selected = String(inputValue ?? p.defaultValue ?? '');
        return h('div',{key:id,className:'ps-accordion'},...options.map((option,i)=>{
          const open = selected === option.value;
          const child = (node.children??[]).find(item=>String(item.props?.value)===option.value);
          return h('div',{key:i,className:'ps-accordion-item'},
            h('h3',{className:'ps-accordion-title'},h('button',{type:'button','aria-expanded':open,'aria-controls':`${domId}-content-${i}`,
              onClick:()=>change(open?'':option.value)},text(option.label),h('span',{'aria-hidden':true},open?'−':'+'))),
            h('div',{id:`${domId}-content-${i}`,hidden:!open,className:'ps-accordion-body'},
              open?child?.children?.map((item,j)=>renderNode(item,item.id??j)):null));
        }));
      }
      case 'carousel': {
        const count = (node.children??[]).length;
        const raw = Number(inputValue ?? p.initialIndex ?? 0);
        const index = count ? ((Math.trunc(Number.isFinite(raw)?raw:0)%count)+count)%count : 0;
        return h('section',{key:id,className:'ps-carousel','aria-label':text(p.label??'Carousel')},
          h('div',{className:'ps-carousel-slide','aria-live':'polite'},count?renderNode(node.children[index],node.children[index].id??index):null),
          count>1?h('div',{className:'ps-carousel-controls'},
            h('button',{type:'button','aria-label':'Previous slide',onClick:()=>change((index-1+count)%count)},'←'),
            h('span',null,`${index+1} / ${count}`),
            h('button',{type:'button','aria-label':'Next slide',onClick:()=>change((index+1)%count)},'→')):null);
      }
      case 'callout': return h('aside',{key:id,className:`ps-callout ps-callout-${['info','success','warning','danger'].includes(p.variant)?p.variant:'info'}`,role:p.variant==='danger'?'alert':'note'},
        p.title?h('strong',null,text(p.title)):null,
        p.description?h('p',null,text(p.description)):null,
        childNodes);
      case 'code': return h('pre',{key:id,className:'ps-code'},h('code',null,text(p.text)));
      case 'quote': return h('blockquote',{key:id,className:'ps-quote'},
        h('p',null,text(p.text)),p.author?h('footer',null,`— ${text(p.author)}`):null);
      case 'link': {
        const url = safeLink(text(p.href));
        return url?h('a',{key:id,className:'ps-link',href:url,target:p.external?'_blank':undefined,
          rel:p.external?'noopener noreferrer':undefined},text(p.label??p.text??url)):null;
      }
      case 'list': {
        const fromState = p.dataPath?safeRead(state,p.dataPath):null;
        const items = (Array.isArray(fromState)?fromState:Array.isArray(p.items)?p.items:[]).slice(0,100);
        return h(p.ordered?'ol':'ul',{key:id,className:'ps-list'},...items.map((item,i)=>
          h('li',{key:i},text(typeof item==='object'&&item!==null?item.label??item.text??'':item))));
      }
      case 'table': {
        const columns = (Array.isArray(p.columns)?p.columns:[]).slice(0,16).filter(c=>c && typeof c.key==='string');
        const fromState = p.dataPath?safeRead(state,p.dataPath):null;
        const rows = (Array.isArray(fromState)?fromState:Array.isArray(p.rows)?p.rows:[]).slice(0,100);
        const headers = h('thead',null,h('tr',null,...columns.map((col,i)=>h('th',{key:i,scope:'col'},text(col.label??col.key)))));
        const bodyRows = rows.map((item,i)=>h('tr',{key:i},...columns.map((column,j)=>
          h('td',{key:j},text(item && typeof item==='object' && Object.prototype.hasOwnProperty.call(item,column.key) ? item[column.key] : '')))));
        return h('div',{key:id,className:'ps-table-wrap'},h('table',{className:'ps-table'},
          p.caption?h('caption',null,text(p.caption)):null,headers,h('tbody',null,...bodyRows)));
      }
      case 'spacer': return h('div',{key:id,className:'ps-spacer',style:{height:`${units(p.height)}px`},'aria-hidden':true});
      case 'progress': {
        const value = node.bind ? Number(inputValue) : Number(p.value??0);
        const max = Number(p.max)>0?Number(p.max):100;
        return h('div',{key:id,className:'ps-progress-group'},p.label?h('span',null,text(p.label)):null,
          h('progress',{className:'ps-progress',value:clamp(value,0,max),max,'aria-label':text(p.label || 'Progress')}));
      }
      case 'metric': return h('div',{key:id,className:'ps-metric'},
        h('span',{className:'ps-metric-label'},text(p.label)),
        h('strong',{className:'ps-metric-value'},node.bind?String(inputValue??''):text(p.value)),
        p.description?h('span',{className:'ps-metric-description'},text(p.description)):null);
      case 'image': {
        const src = safeUrl(text(p.src));
        return src ? h('img',{key:id,className:'ps-image',src,alt:text(p.alt),loading:'lazy'}) : null;
      }
      case 'bar-chart': return wrap(h(BarChart,{data:chartData(p,state),title:text(p.title)}));
      case 'line-chart': return wrap(h(LineChart,{data:chartData(p,state),title:text(p.title)}));
      default: return h('div',{key:id,className:'ps-unknown','data-surface-unknown':node.type},
        `Unregistered component: ${node.type}`);
    }
  };
  return h('div',{className:`ps-surface ${className}`.trim(),'data-ps-theme':['light','dark'].includes(theme)?theme:'light'},
    snapshot.document.root ? renderNode(snapshot.document.root,'root') : empty);
}

function chartData(props,state) {
  const fromState = props.dataPath ? safeRead(state,props.dataPath) : null;
  const source = Array.isArray(fromState)?fromState:props.data;
  return (Array.isArray(source)?source:[]).slice(0,36).filter(item =>
    item && typeof item.label==='string' && Number.isFinite(Number(item.value))
  ).map(item=>({label:item.label.slice(0,26),value:Number(item.value)}));
}

function BarChart({data,title}) {
  const descriptionId = React.useId();
  const width=500,height=210,pad=35,plotW=width-2*pad,plotH=height-2*pad;
  const max=Math.max(1,...data.map(d=>d.value),0);
  const min=Math.min(0,...data.map(d=>d.value));
  const range=max-min||1;
  const zeroY=pad+(max/range)*plotH;
  const step=plotW/Math.max(data.length,1),barW=Math.max(4,step*.6);
  return h('figure',{className:'ps-chart'},
    title?h('figcaption',null,title):null,
    h('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':title||'Bar chart','aria-describedby':descriptionId},
      h('line',{x1:pad,y1:zeroY,x2:width-pad,y2:zeroY,className:'ps-chart-axis'}),
      ...data.map((d,i)=>{
        const x=pad+i*step+(step-barW)/2;
        const y=pad+(max-d.value)/range*plotH;
        return h('g',{key:i},
          h('title',null,`${d.label}: ${d.value}`),
          h('rect',{x,y:Math.min(y,zeroY),width:barW,height:Math.max(1,Math.abs(zeroY-y)),rx:3,className:'ps-chart-bar'}),
          h('text',{x:x+barW/2,y:height-14,textAnchor:'middle',className:'ps-chart-label'},d.label.slice(0,9)),
          h('text',{x:x+barW/2,y:Math.max(11,Math.min(y,zeroY)-6),textAnchor:'middle',className:'ps-chart-label'},String(d.value)));
      })),
    h('p',{id:descriptionId,className:'ps-sr-only'},chartAccessibleDescription(data)));
}

function LineChart({data,title}) {
  const descriptionId = React.useId();
  const width=500,height=210,pad=35,plotW=width-2*pad,plotH=height-2*pad;
  const max=Math.max(1,...data.map(d=>d.value));
  const min=Math.min(0,...data.map(d=>d.value));
  const range=max-min||1;
  const points=data.map((d,i)=>({x:pad+(data.length<=1?plotW/2:i*plotW/(data.length-1)),y:pad+(max-d.value)/range*plotH,...d}));
  return h('figure',{className:'ps-chart'},
    title?h('figcaption',null,title):null,
    h('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':title||'Line chart','aria-describedby':descriptionId},
      h('line',{x1:pad,y1:height-pad,x2:width-pad,y2:height-pad,className:'ps-chart-axis'}),
      points.length>0?h('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',strokeWidth:3,className:'ps-chart-line'}):null,
      ...points.map((p,i)=>h('g',{key:i},
        h('title',null,`${p.label}: ${p.value}`),
        h('circle',{cx:p.x,cy:p.y,r:5,className:'ps-chart-dot'}),
        h('text',{x:p.x,y:height-14,textAnchor:'middle',className:'ps-chart-label'},p.label.slice(0,9))))),
    h('p',{id:descriptionId,className:'ps-sr-only'},chartAccessibleDescription(data)));
}
