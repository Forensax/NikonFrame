import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {fromExif,isOtherBrand} from '../dist/core.js';

// Run the actual importer, replacing only browser/image boundaries.
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function harness(){
  const elements=new Map(),trace=[],events=new Map();
  function element(id=''){
    const classes=new Set(),attributes=new Map();
    return {id,hidden:false,disabled:false,textContent:'',value:'',children:[],
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
      setAttribute:(k,v)=>attributes.set(k,String(v)),removeAttribute:k=>attributes.delete(k),getAttribute:k=>attributes.get(k),
      addEventListener(){},querySelectorAll:()=>[],append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},
      getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,thumb'};
  }
  const get=id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};
  const fields=['model','lens','date','focal','aperture','iso','shutter','caption'].map(name=>({...element(),name}));
  for(const field of fields)fields[field.name]=field;
  get('metadata').elements=fields;
  get('import-overlay').hidden=true;
  get('add').textContent='＋ 导入照片';
  let progressValue=0;
  Object.defineProperty(get('import-progress'),'value',{get:()=>progressValue,set:value=>{
    progressValue=value;
    trace.push({value,max:get('import-progress').max,percent:get('import-percent').textContent,
      count:get('import-count').textContent,hidden:get('import-overlay').hidden,disabled:get('add').disabled});
  }});
  const context=vm.createContext({console,fromExif,isOtherBrand,DEFAULT_CAPTION:'影像从心',BAR_RATIO:0.0878,
    readLens:async()=> 'Test lens',crypto:{randomUUID},clearTimeout,setTimeout,performance,
    requestAnimationFrame:callback=>setImmediate(callback),
    Image:class{decode(){return Promise.resolve();}},
    document:{getElementById:get,createElement:()=>element(),addEventListener:(name,handler)=>events.set(name,handler),fonts:{load:async()=>[]}},
    exifr:{parse:async()=>({Make:'NIKON',Model:'NIKON D7100',FocalLength:30})},window:{addEventListener(){}}});
  vm.runInContext(source,context);
  context.decode=async file=>{if(file.bad)throw new Error('bad image');return {width:6000,height:4000,close(){}};};
  context.preview=async()=>{};
  return {context,get,trace,events,active:()=>trace.filter(s=>!s.hidden),state:()=>vm.runInContext('({count:items.length,name:selected?.file.name,busy})',context)};
}

test('every attempted file advances central progress, including unsupported and damaged files',async()=>{
  const h=harness();
  await h.context.importFiles([{name:'a.jpg'},{name:'bad.jpg',bad:true},{name:'notes.txt'},{name:'b.jpg'}]);
  assert.deepEqual(h.active().map(s=>s.value),[0,1,2,3,4]);
  assert.deepEqual(h.active().map(s=>s.percent),['0%','25%','50%','75%','100%']);
  assert.ok(h.active().every(s=>s.disabled));
  assert.equal(h.active().at(-1).count,'已处理 4 / 4');
  assert.equal(h.get('status').textContent,'已导入 2 张，共 2 张');
  assert.match(h.get('errors').textContent,/bad.jpg/);
  assert.match(h.get('errors').textContent,/notes.txt/);
  assert.equal(h.get('import-overlay').hidden,true);
  assert.equal(h.get('add').textContent,'＋ 导入照片');
  assert.equal(h.get('add').disabled,false);
  assert.equal(h.get('empty').inert,false);
});

test('100% remains visible and operations stay disabled until preview finishes; retry starts at zero',async()=>{
  const h=harness();let finishPreview,previewStarted;
  const started=new Promise(resolve=>previewStarted=resolve);
  h.context.preview=()=>{previewStarted();return new Promise(resolve=>finishPreview=resolve);};
  const running=h.context.importFiles([{name:'first.jpg'}]);
  await started;
  assert.equal(h.get('import-progress').value,1);
  assert.equal(h.get('import-overlay').hidden,false);
  assert.equal(h.get('import-percent').textContent,'100%');
  assert.equal(h.get('add').disabled,true);
  assert.equal(h.get('export-one').disabled,true);
  assert.ok(h.get('metadata').elements.every(field=>field.disabled));
  assert.equal(h.get('drop-zone').getAttribute('aria-busy'),'true');
  await h.context.importFiles([{name:'ignored.jpg'}]);
  assert.equal(h.active().length,2);
  finishPreview();await running;
  h.context.preview=async()=>{};
  await h.context.importFiles([{name:'next.jpg'}]);
  assert.deepEqual(h.active().map(s=>s.value),[0,1,0,1]);
  assert.equal(h.get('status').textContent,'已导入 1 张，共 2 张');
  assert.equal(h.get('drop-zone').getAttribute('aria-busy'),undefined);
});

test('empty selection leaves UI idle and unexpected errors clean up overlay for retry',async()=>{
  const h=harness();
  await h.context.importFiles([]);await h.context.importFiles(null);
  assert.equal(h.trace.length,0);
  h.context.decode=async()=>({width:1,height:1,close(){throw new Error('resource failure');}});
  await h.context.importFiles([{name:'a.jpg'}]);
  assert.equal(h.get('add').disabled,false);
  assert.equal(h.get('drop-zone').classList.contains('importing'),false);
  assert.equal(h.get('drop-zone').getAttribute('aria-busy'),undefined);
  assert.equal(h.get('import-overlay').hidden,true);
  assert.equal(h.get('preview-wrap').inert,false);
  assert.equal(h.get('status').textContent,'导入未完成');
  assert.match(h.get('errors').textContent,/导入未完成/);
});

test('all failures preserve the previous selection or empty state and preview errors stay visible',async()=>{
  const h=harness();
  await h.context.importFiles([{name:'bad.jpg',bad:true},{name:'notes.txt'}]);
  assert.equal(h.state().count,0);
  assert.equal(h.state().name,undefined);
  await h.context.importFiles([{name:'original.jpg'}]);
  await h.context.importFiles([{name:'bad.jpg',bad:true}]);
  assert.equal(h.state().name,'original.jpg');
  assert.equal(h.state().count,1);
  h.context.preview=async()=> '预览失败';
  await h.context.importFiles([{name:'notes.txt'}]);
  assert.match(h.get('errors').textContent,/notes.txt/);
  assert.match(h.get('errors').textContent,/预览失败/);
});

test('drop uses the same importer and drag hints stay hidden while importing',async()=>{
  const h=harness();let finishPreview,previewStarted;
  const started=new Promise(resolve=>previewStarted=resolve);
  h.context.preview=()=>{previewStarted();return new Promise(resolve=>finishPreview=resolve);};
  const event={preventDefault(){},dataTransfer:{types:['Files'],files:[{name:'dropped.jpg'}]}};
  h.events.get('dragenter')(event);
  assert.equal(h.get('drop-zone').classList.contains('dragging'),true);
  h.events.get('drop')(event);
  await started;
  assert.equal(h.get('import-percent').textContent,'100%');
  h.events.get('dragenter')(event);
  h.events.get('drop')(event);
  assert.equal(h.get('drop-zone').classList.contains('dragging'),false);
  assert.equal(h.state().count,1);
  finishPreview();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.get('import-overlay').hidden,true);
  assert.equal(h.state().busy,false);
});
