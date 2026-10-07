import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {fromExif,isOtherBrand} from '../dist/core.js';

// Exercise the real import workflow with deterministic image and DOM boundaries.
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function harness(){
  const elements=new Map(),trace=[];
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
  get('import-progress').hidden=true;
  get('import-label').textContent='＋ 导入照片';
  let progressValue=0;
  Object.defineProperty(get('import-progress'),'value',{get:()=>progressValue,set:value=>{
    progressValue=value;
    trace.push({value,max:get('import-progress').max,label:get('import-label').textContent,
      title:get('add').title,hidden:get('import-progress').hidden,disabled:get('add').disabled});
  }});
  const context=vm.createContext({console,fromExif,isOtherBrand,DEFAULT_CAPTION:'影像从心',BAR_RATIO:0.0878,
    readLens:async()=> 'Test lens',crypto:{randomUUID},clearTimeout,setTimeout,performance,
    requestAnimationFrame:callback=>setImmediate(callback),
    Image:class{decode(){return Promise.resolve();}},
    document:{getElementById:get,createElement:()=>element(),addEventListener(){},fonts:{load:async()=>[]}},
    exifr:{parse:async()=>({Make:'NIKON',Model:'NIKON D7100',FocalLength:30})},window:{addEventListener(){}}});
  vm.runInContext(source,context);
  context.decode=async file=>{if(file.bad)throw new Error('bad image');return {width:6000,height:4000,close(){}};};
  context.preview=async()=>{};
  return {context,get,trace,active:()=>trace.filter(s=>!s.hidden)};
}

test('every attempted file advances progress, including unsupported and damaged files',async()=>{
  const h=harness();
  await h.context.importFiles([{name:'a.jpg'},{name:'bad.jpg',bad:true},{name:'notes.txt'},{name:'b.jpg'}]);
  assert.deepEqual(h.active().map(s=>s.value),[0,1,2,3,4]);
  assert.deepEqual(h.active().map(s=>s.label),['导入 0%','导入 25%','导入 50%','导入 75%','导入 100%']);
  assert.ok(h.active().every(s=>s.disabled));
  assert.equal(h.active().at(-1).title,'已处理 4 / 4');
  assert.equal(h.get('status').textContent,'已导入 2 张，共 2 张');
  assert.match(h.get('errors').textContent,/bad.jpg/);
  assert.match(h.get('errors').textContent,/notes.txt/);
  assert.equal(h.get('import-progress').hidden,true);
  assert.equal(h.get('import-label').textContent,'＋ 导入照片');
  assert.equal(h.get('add').disabled,false);
});

test('100% stays visible and blocks another import until the preview finishes',async()=>{
  const h=harness();let finishPreview,previewStarted;
  const started=new Promise(resolve=>previewStarted=resolve);
  h.context.preview=()=>{previewStarted();return new Promise(resolve=>finishPreview=resolve);};
  const running=h.context.importFiles([{name:'first.jpg'}]);
  await started;
  assert.equal(h.get('import-progress').value,1);
  assert.equal(h.get('import-progress').hidden,false);
  assert.equal(h.get('import-label').textContent,'导入 100%');
  assert.equal(h.get('add').disabled,true);
  await h.context.importFiles([{name:'ignored.jpg'}]);
  assert.equal(h.active().length,2);
  finishPreview();await running;
  h.context.preview=async()=>{};
  await h.context.importFiles([{name:'next.jpg'}]);
  assert.deepEqual(h.active().map(s=>s.value),[0,1,0,1]);
  assert.equal(h.get('status').textContent,'已导入 1 张，共 2 张');
});

test('empty selections leave the button idle; unexpected failure restores it for retry',async()=>{
  const h=harness();
  await h.context.importFiles([]);await h.context.importFiles(null);
  assert.equal(h.trace.length,0);
  h.context.decode=async()=>({width:1,height:1,close(){throw new Error('resource failure');}});
  await h.context.importFiles([{name:'a.jpg'}]);
  assert.equal(h.get('add').disabled,false);
  assert.equal(h.get('add').classList.contains('importing'),false);
  assert.equal(h.get('add').getAttribute('aria-busy'),undefined);
  assert.equal(h.get('import-progress').hidden,true);
  assert.equal(h.get('import-label').textContent,'＋ 导入照片');
  assert.equal(h.get('status').textContent,'导入未完成');
  assert.match(h.get('errors').textContent,/导入未完成/);
});
