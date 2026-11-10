'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls='',value='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=value;return n};
const btn=(label,act)=>{const b=el('button','',label);b.onclick=act;return b};
const fmt=(d,opts)=>d.toLocaleDateString('tr-TR',opts);
const key=d=>[d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');
let day=new Date(),month=new Date(day.getFullYear(),day.getMonth(),1),pages=[],selected=null,db,rec=null,recordOwner=null,urls=[];
const page=()=>pages.find(p=>p.id===selected),daily=()=>pages.filter(p=>p.day===key(day));
const status=t=>$('status').textContent=t;
function save(p){const tx=db.transaction('pages','readwrite');tx.objectStore('pages').put(p);tx.oncomplete=()=>status('Bu tarayıcıya kaydedildi.');tx.onerror=()=>status('Kaydedilemedi. Tarayıcının depolama alanını kontrol et.')}
function selectDay(d){day=d;month=new Date(d.getFullYear(),d.getMonth(),1);selected=daily()[0]?.id;render()}
function calendar(){const c=$('cal');c.replaceChildren();$('month').textContent=fmt(month,{month:'long',year:'numeric'});for(const t of ['Pt','Sa','Ça','Pe','Cu','Ct','Pa'])c.append(el('small','',t));for(let i=0;i<(month.getDay()+6)%7;i++)c.append(el('span'));const d=new Date(month);while(d.getMonth()===month.getMonth()){const target=new Date(d),b=btn(String(d.getDate()),()=>selectDay(target));if(key(d)===key(day))b.classList.add('active');if(pages.some(p=>p.day===key(d)))b.classList.add('marked');c.append(b);d.setDate(d.getDate()+1)}}
function nav(){const n=$('nav');n.replaceChildren();if(!daily().length)n.append(el('p','','Henüz sayfa yok.'));for(const p of daily()){const b=btn((p.kind==='Günlük'?'✎  ':'☷  ')+(p.title||p.kind),()=>{selected=p.id;render()});b.className='navpage'+(selected===p.id?' sel':'');n.append(b)}}
function menu(title,options){$('question').textContent=title;$('choices').replaceChildren(...options.map(([name,fn])=>btn(name,()=>{$('dialog').close();fn()})));$('dialog').showModal()}
function create(kind){const p={day:key(day),id:crypto.randomUUID(),kind,title:kind,blocks:[]};pages.push(p);selected=p.id;add(p,kind==='Günlük'?'text':kind==='Yapılacaklar'?'task':'note','')}
function add(p,type,value){p.blocks.push({id:crypto.randomUUID(),type,value});save(p);render()}
function file(p,type){const input=el('input');input.type='file';input.accept=type==='image'?'image/*':'audio/*';input.onchange=()=>{if(input.files[0])add(p,type,input.files[0])};input.click()}
async function voice(p){if(rec){if(rec.state==='recording')rec.stop();return}let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});if(rec){stream.getTracks().forEach(t=>t.stop());return}rec=new MediaRecorder(stream);recordOwner=p;const chunks=[];rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=()=>{const blob=new Blob(chunks,{type:rec.mimeType});stream.getTracks().forEach(t=>t.stop());rec=null;recordOwner=null;if(pages.includes(p))add(p,'audio',blob);else render()};rec.start();render()}catch(e){stream?.getTracks().forEach(t=>t.stop());rec=null;recordOwner=null;status('Mikrofon açılamadı. Mikrofon iznini kontrol edebilir veya ses dosyası ekleyebilirsin.')}}
function link(p){menu('Şarkı ekle',[['Ses dosyası seç',()=>file(p,'song')],['Şarkı bağlantısı ekle',()=>{const input=el('input');input.type='url';input.placeholder='https://…';input.setAttribute('aria-label','Şarkı bağlantısı');$('question').textContent='Şarkı bağlantısı';$('choices').replaceChildren(input,btn('Ekle',()=>{try{const u=new URL(input.value);if(!['http:','https:'].includes(u.protocol))throw Error();$('dialog').close();add(p,'link',u.href)}catch{input.setCustomValidity('Geçerli bir https bağlantısı gir.');input.reportValidity();input.oninput=()=>input.setCustomValidity('')}}));$('dialog').showModal()}]])}
function renderBlock(p,b){const box=el('div','block');const del=btn('Kaldır',()=>{p.blocks=p.blocks.filter(x=>x.id!==b.id);save(p);render()});del.className='del';box.append(del);
if(['text','note','task'].includes(b.type)){const row=el('div',b.type==='task'?'task':'');if(b.type==='task'){const cb=el('input');cb.type='checkbox';cb.checked=!!b.done;cb.ariaLabel='Görevi tamamla';cb.onchange=()=>{b.done=cb.checked;save(p)};row.append(cb)}const field=el(b.type==='task'?'input':'textarea','line');field.placeholder={task:'Bir görev yaz…',note:'Hatırlamak istediğin bir şey…',text:'Bugün neler oldu?'}[b.type];field.ariaLabel=field.placeholder;field.value=b.value;field.oninput=()=>{b.value=field.value;save(p)};row.append(field);box.append(row)}
else if(['image','audio','song'].includes(b.type)){const n=el(b.type==='image'?'img':'audio');n.controls=true;n.alt='Günlüğe eklenen görsel';const u=URL.createObjectURL(b.value);urls.push(u);n.src=u;if(b.type==='song')box.append(el('p','hint','♫ '+(b.value.name||'Şarkım')));box.append(n)}
else if(b.type==='link'){const a=el('a','','♫ Şarkıyı aç · '+new URL(b.value).hostname);a.href=b.value;a.target='_blank';a.rel='noopener noreferrer';box.append(a)}
else box.append(el(b.type==='quote'?'blockquote':'span',b.type==='sticker'?'sticker':'',b.value));return box}
function render(){urls.forEach(URL.revokeObjectURL);urls=[];calendar();nav();$('year').textContent='Defterim / '+day.getFullYear();$('dateTitle').textContent=fmt(day,{day:'numeric',month:'long'});$('weekday').textContent=fmt(day,{weekday:'long'});const paper=$('paper');paper.replaceChildren();if(rec){const stop=btn('● Ses kaydını bitir',()=>voice(recordOwner));stop.className='recording';paper.append(stop)}const p=page();if(!p){const empty=el('div','empty');empty.append(el('i','','Y.'),el('h3','','Bugünün ilk sayfası'),el('p','','Bir anını yazmak ya da gününü planlamak için sayfa ekle.'));paper.append(empty);return}
const title=el('input','title');title.value=p.title;title.ariaLabel='Sayfa başlığı';title.oninput=()=>{p.title=title.value;save(p);nav()};paper.append(el('span','label',p.kind==='Günlük'?'Günlük':'Ajanda / '+p.kind),title);
const bar=el('div','tools');const options=p.kind==='Günlük'?[['＋ Metin',()=>add(p,'text','')],['▧ Görsel',()=>file(p,'image')],['◉ Ses',()=>menu('Ses ekle',[['Mikrofonla kaydet',()=>voice(p)],['Ses dosyası seç',()=>file(p,'audio')]])],['♫ Şarkı',()=>link(p)]]:[[p.kind==='Yapılacaklar'?'＋ Görev':'＋ Not',()=>add(p,p.kind==='Yapılacaklar'?'task':'note','')]];
options.push(['✿ Sticker',()=>menu('Bir sticker seç',['🌼','🌿','🌙','☕','🦋','🍓','🪴','💌'].map(s=>[s,()=>add(p,'sticker',s)]))],['❝ Güzel söz',()=>menu('Bir söz seç',['Bugün kendime biraz zaman ayırıyorum.','Küçük adımlar da iz bırakır.','Bir yaprakta bir an saklı.'].map(s=>[s,()=>add(p,'quote',s)]))]);bar.append(...options.map(([n,f])=>btn(n,f)));paper.append(bar,...p.blocks.map(b=>renderBlock(p,b)))}
$('close').onclick=()=>$('dialog').close();$('prev').onclick=()=>{month.setMonth(month.getMonth()-1);calendar()};$('next').onclick=()=>{month.setMonth(month.getMonth()+1);calendar()};$('today').onclick=()=>selectDay(new Date());$('newPage').disabled=true;$('newPage').onclick=()=>menu('Nasıl bir sayfa ekleyelim?',[['✎  Günlük',()=>create('Günlük')],['☷  Ajanda',()=>menu('Ajanda sayfanı seç',[['☑  Günlük yapılacaklar listesi',()=>create('Yapılacaklar')],['✧  Unutulmayacak notlar',()=>create('Unutulmayacak notlar')]])]]);if(innerWidth<761)$('calWrap').open=false;
const open=indexedDB.open('yaprak-notebook',1);open.onupgradeneeded=()=>open.result.createObjectStore('pages',{keyPath:'id'});open.onsuccess=()=>{db=open.result;const read=db.transaction('pages').objectStore('pages').getAll();read.onsuccess=()=>{pages=read.result;$('newPage').disabled=false;selectDay(new Date())}};open.onerror=()=>status('Defter açılamadı. Tarayıcı depolama iznini kontrol et.');

async function importYaprakNotebook(file) {
  if (!db) throw Error('Defter henüz hazır değil.');
  if (rec) throw Error('Önce ses kaydını bitir.');
  const archive = JSON.parse(await file.text());
  if (archive.format !== 'yaprak-1' || !Array.isArray(archive.pages)) throw Error('Geçersiz Yaprak dosyası.');
  const media = ['image', 'song', 'audio'];
  const types = [...media, 'text', 'note', 'task', 'sticker', 'quote', 'link'];
  for (const p of archive.pages) {
    if (typeof p.id !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(p.day) ||
        typeof p.title !== 'string' || !['Günlük','Yapılacaklar','Unutulmayacak notlar'].includes(p.kind) ||
        !Array.isArray(p.blocks)) throw Error('Geçersiz sayfa.');
    for (const block of p.blocks) {
      if (!types.includes(block.type) || typeof block.id !== 'string') throw Error('Geçersiz içerik.');
      if (media.includes(block.type)) {
        const {data, mime, name} = block.value;
        if (typeof data !== 'string' || typeof mime !== 'string') throw Error('Geçersiz medya.');
        const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        block.value = new File([bytes], name || 'Medya', {type:mime});
      } else if (typeof block.value !== 'string' ||
        (block.type === 'link' && !['https:','http:'].includes(new URL(block.value).protocol))) {
        throw Error('Geçersiz metin veya bağlantı.');
      }
    }
  }
  const added = [];
  await new Promise((resolve, reject) => {
    const tx = db.transaction('pages', 'readwrite');
    const store = tx.objectStore('pages');
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      const known = new Set(keys.result);
      for (const p of archive.pages) {
        if (known.has(p.id)) continue;
        known.add(p.id);
        store.add(p);
        added.push(p);
      }
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || Error('İçe aktarma iptal edildi.'));
  });
  pages.push(...added);
  if (!selected) selected = daily()[0]?.id;
  render();
  return added.length;
}
