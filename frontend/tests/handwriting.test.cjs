const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const calls = [];
  const context = new Proxy({}, {
    get: (_, name) => (...args) => calls.push([name, ...args]),
    set: (_, name, value) => {calls.push([name, value]); return true;}
  });
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.rect = {left:0, top:0, width:500, height:300}; }
    append(...items) {this.children.push(...items);}
    setAttribute(key, value) {this.attrs[key] = value;}
    getContext() {return context;}
    getBoundingClientRect() {return this.rect;}
    setPointerCapture(id) {this.capture = id;}
    hasPointerCapture(id) {return id === this.capture;}
    releasePointerCapture() {this.capture = null;}
  }
  let resize;
  const sandbox = {
    document: {createElement: tag => new Element(tag), createTextNode: text => text,
      addEventListener() {}, removeEventListener() {}},
    window: {devicePixelRatio:2, addEventListener() {}, removeEventListener() {}},
    ResizeObserver: class {constructor(callback) {resize = callback;} observe() {} disconnect() {}}
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/handwriting.js', 'utf8') + '\nthis.ink = Handwriting;', sandbox);
  const host = new Element('div');
  const drawing = sandbox.ink.empty();
  let saves = 0;
  const dispose = sandbox.ink.mount(host, drawing, () => saves++);
  const [toolbar, canvas] = host.children;
  const button = text => toolbar.children.find(x => x.textContent === text);
  const event = (type, id=1, x=100, y=100) => ({pointerType:type, pointerId:id, button:0, clientX:x, clientY:y, preventDefault() {}});
  return {ink:sandbox.ink, drawing, canvas, button, event, dispose, calls, resize:()=>resize(), saves:()=>saves};
}

test('pen strokes persist; touch does not draw; cancel preserves ink', () => {
  const t = setup();
  t.canvas.onpointerdown(t.event('touch'));
  assert.equal(t.canvas.capture, undefined);
  t.canvas.onpointerdown(t.event('pen'));
  t.canvas.onpointermove(t.event('touch',2));
  t.canvas.onpointermove(t.event('pen',1,150,150));
  t.canvas.onpointerup(t.event('pen',1,200,200));
  assert.equal(t.drawing.strokes.length,1);
  assert.equal(t.drawing.strokes[0].points.length,3);
  assert.equal(t.saves(),1);
  assert.equal(t.ink.validate(JSON.parse(JSON.stringify(t.drawing))),true);
  t.canvas.onpointerdown(t.event('pen'));
  t.canvas.onpointercancel(t.event('pen'));
  assert.equal(t.drawing.strokes.length,2);
});

test('eraser, undo, redo, resize and disposal retain consistent drawings', () => {
  const t = setup();
  t.canvas.onpointerdown(t.event('pen'));
  t.canvas.onpointerup(t.event('pen'));
  t.button('Silgi').onclick();
  t.canvas.onpointerdown(t.event('pen'));
  t.canvas.onpointerup(t.event('pen'));
  assert.equal(t.drawing.strokes[1].tool,'eraser');
  assert.ok(t.calls.some(x => x[0]==='globalCompositeOperation' && x[1]==='destination-out'));
  t.button('↶ Geri al').onclick();
  assert.equal(t.drawing.strokes.length,1);
  t.button('↷ Yinele').onclick();
  assert.equal(t.drawing.strokes.length,2);
  const before = JSON.stringify(t.drawing);
  t.canvas.rect.width=800; t.canvas.rect.height=480; t.resize();
  assert.equal(JSON.stringify(t.drawing),before);
  t.canvas.onpointerdown(t.event('pen'));
  t.dispose();
  assert.equal(t.drawing.strokes.length,3);
});

test('invalid drawing archives are rejected', () => {
  const t = setup();
  assert.equal(t.ink.validate({version:1,strokes:[{tool:'pen',color:'#000000',size:4,points:[[Infinity,0]]}]}),false);
  assert.equal(t.ink.validate({version:2,strokes:[]}),false);
  assert.equal(t.ink.validate({version:1,strokes:[{tool:'pen',color:'red',size:4,points:[[0,0]]}]}),false);
});

test('handwriting backup roundtrip, duplicate import, invalid data and legacy text', async () => {
  const t = setup();
  t.canvas.onpointerdown(t.event('pen'));
  t.canvas.onpointerup(t.event('pen'));
  const records = new Map([['page1',{id:'page1',day:'2026-11-11',title:'Anı',kind:'Günlük',
    blocks:[{id:'ink1',type:'handwriting',value:JSON.parse(JSON.stringify(t.drawing))}]}]]);
  const database = {
    close() {},
    transaction() {
      const tx = {objectStore:()=>({
        getAll() {const query={};queueMicrotask(()=>{query.result=structuredClone([...records.values()]);query.onsuccess();});return query;},
        getAllKeys() {const query={};queueMicrotask(()=>{query.result=[...records.keys()];query.onsuccess();tx.oncomplete();});return query;},
        add(p) {records.set(p.id,p);}
      })};
      return tx;
    }
  };
  const context = {Handwriting:t.ink,Blob,File,atob,Uint8Array,db:database,rec:null,pages:[],selected:'page1',
    render(){},daily:()=>[], indexedDB:{open(){const req={};queueMicrotask(()=>{req.result=database;req.onsuccess();});return req;}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/export-notebook.js','utf8'),context);
  const journal = fs.readFileSync('public/journal.js','utf8');
  vm.runInContext(journal.slice(journal.indexOf('async function importYaprakNotebook')),context);
  const backup = await context.exportYaprakNotebook();
  assert.equal(await context.importYaprakNotebook(backup),0);
  records.clear();
  assert.equal(await context.importYaprakNotebook(backup),1);
  assert.equal(JSON.stringify(records.get('page1').blocks[0].value),JSON.stringify(t.drawing));
  const legacy = {format:'yaprak-1',pages:[{id:'old',day:'2026-11-10',title:'Not',kind:'Unutulmayacak notlar',blocks:[{id:'text1',type:'note',value:'Eski not'}]}]};
  assert.equal(await context.importYaprakNotebook(new Blob([JSON.stringify(legacy)])),1);
  const bad = JSON.parse(await backup.text());
  bad.pages[0].blocks[0].value.strokes[0].points[0]=[-1,0];
  await assert.rejects(()=>context.importYaprakNotebook(new Blob([JSON.stringify(bad)])),/Geçersiz el yazısı/);
  assert.equal(records.size,2);
});
