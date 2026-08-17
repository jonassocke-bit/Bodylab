const V='4.0.2';
const S3='https://amazon-bodym.s3.us-west-2.amazonaws.com';
const fmt=x=>Number.isFinite(+x)?(+x).toFixed(2):'—';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

function tableParse(text){
 const firstLine=(text.split(/\r?\n/,1)[0]||'');
 const candidates=[',','\t',';'];
 const delimiter=candidates.sort((a,b)=>(firstLine.split(b).length-firstLine.split(a).length))[0];
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(c==='"'&&q&&n==='"'){cell+='"';i++;continue}
  if(c==='"'){q=!q;continue}
  if(c===delimiter&&!q){row.push(cell);cell='';continue}
  if((c==='\n'||c==='\r')&&!q){
   if(c==='\r'&&n==='\n')i++;
   row.push(cell);cell='';
   if(row.some(x=>String(x).trim()!==''))rows.push(row);
   row=[];continue
  }
  cell+=c
 }
 if(cell||row.length){row.push(cell);rows.push(row)}
 if(rows.length<2)return [];
 const h=rows[0].map(x=>String(x).trim());
 return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))
}
function stripExt(v){return String(v??'').trim().split('/').pop().replace(/\.(png|jpe?g|csv|tsv)$/i,'')}
function token(v){
 const z=stripExt(v).toLowerCase();
 if(!z||z.length<6||z.length>96||/^\d+([.,]\d+)?$/.test(z))return null;
 if(/^(female|male|front|frontal|side|lateral|profile|train|testa|testb|true|false)$/i.test(z))return null;
 return /^[a-z0-9_-]+$/i.test(z)?z:null
}
function viewFromRow(row){
 const txt=Object.entries(row).map(([k,v])=>`${k}:${v}`).join(' ').toLowerCase();
 if(/\b(front|frontal|anterior)\b/.test(txt))return 'front';
 if(/\b(side|lateral|profile)\b/.test(txt))return 'side';
 return null
}
function subjectToken(row,imageIds){
 const preferred=Object.keys(row).filter(k=>/subject|person|participant|body[_ -]?id|scan[_ -]?id|user[_ -]?id/i.test(k)&&!/image|photo|mask|file/i.test(k));
 for(const k of preferred){const t=token(row[k]);if(t&&!imageIds.has(t))return t}
 for(const k of Object.keys(row)){if(/^id$/i.test(k)){const t=token(row[k]);if(t&&!imageIds.has(t))return t}}
 return null
}
function num(v){const n=+String(v??'').replace(',','.');return Number.isFinite(n)?n:NaN}
function first(o,keys){for(const k of keys){if(k in o&&String(o[k]).trim()!=='')return o[k]}return undefined}
function normGender(v){const s=String(v??'').toLowerCase();if(s==='0'||s.startsWith('f')||s.includes('female')||s.includes('woman'))return 0;if(s==='1'||s.startsWith('m')||s.includes('male')||s.includes('man'))return 1;return NaN}

export class SilhouetteLab{
 constructor(engine,ui,batch){this.engine=engine;this.ui=ui;this.batch=batch;this.panel=document.getElementById('silhouettePanel');this.btn=document.getElementById('silhouetteToggle');this.keys=[];this.people=[];this.personIndex=0;this.ref={front:null,side:null};this.running=false;this.pause=false;this.build();this.bindSheet();this.btn.disabled=false;this.btn.onclick=()=>this.toggle()}
 build(){this.panel.innerHTML=`
  <div class="silHandle" id="silHandle"><span></span></div><div class="silScroll">
  <div class="silHead"><div><div class="sectionLabel">SILHOUETTE LAB · V${V}</div><h2>BodyM Referenz-Fit</h2><p>Neuer unabhängiger Fitter · alter V3.29-Brustalgorithmus wird hier nicht benutzt.</p></div><button id="silClose">Schließen</button></div>
  <section class="silStep"><div class="silStepHead"><b>1</b><div><strong>BodyM direkt verbinden</strong><small>kein Account · keine Downloads · AWS Open Data</small></div><em id="silSourceState">BEREIT</em></div>
   <div class="silActions"><button id="silConnect" class="primary">Verbindung testen & Daten suchen</button></div><div id="silSourceInfo" class="batchInfo"><b>Noch nicht getestet</b><span>Die App prüft S3-Listing, Metadaten und CORS-Pixelzugriff direkt auf deinem iPhone.</span></div></section>
  <section class="silStep"><div class="silStepHead"><b>2</b><div><strong>10 Referenzpersonen</strong><small>bevorzugt Training/Test-A · gemischt ♀/♂</small></div><em id="silPeopleState">WARTE</em></div>
   <div class="silPersonNav"><button id="silPrev">‹</button><div><strong id="silPersonTitle">Person –/10</strong><small id="silPersonMeta">–</small></div><button id="silNext">›</button></div>
   <div class="silRefGrid"><div><b>FRONT</b><canvas id="silFront" width="280" height="360"></canvas></div><div><b>SEITE</b><canvas id="silSide" width="280" height="360"></canvas></div></div>
   <div id="silMeasures" class="silMeasures"></div></section>
  <section class="silStep"><div class="silStepHead"><b>3</b><div><strong>Alignment & Toleranzzonen</strong><small>Pose-/Bildfehler nicht mit Körperform verwechseln</small></div><em>MANUELL</em></div>
   <div class="silGrid">
    <label>Kontur-Toleranz Torso <input id="silTolTorso" type="range" min="0.3" max="3" step="0.1" value="1.2"><span id="silTolTorsoV">1.2 cm</span></label>
    <label>Kontur-Toleranz Gliedmaßen <input id="silTolLimb" type="range" min="0.5" max="5" step="0.1" value="2.5"><span id="silTolLimbV">2.5 cm</span></label>
    <label>Maß-Toleranz <input id="silTolMeasure" type="range" min="0.3" max="3" step="0.1" value="1.0"><span id="silTolMeasureV">1.0 cm</span></label>
    <label>Front Gewicht <input id="silWFront" type="range" min="0" max="2" step="0.1" value="1"><span id="silWFrontV">1.0×</span></label>
    <label>Seite Gewicht <input id="silWSide" type="range" min="0" max="2" step="0.1" value="1.3"><span id="silWSideV">1.3×</span></label>
    <label>Referenzmaß Gewicht <input id="silWMeasure" type="range" min="0" max="2" step="0.1" value="0.7"><span id="silWMeasureV">0.7×</span></label>
   </div><div class="batchInfo"><b>Wichtig</b><span>Innerhalb der Toleranzzone gibt es keinen Optimierungsdruck. Dadurch jagt der Fitter nicht jedem Pixel, jeder Poseabweichung oder jedem Mess-Zehntel hinterher.</span></div></section>
  <section class="silStep"><div class="silStepHead"><b>4</b><div><strong>Ausgangskörper vergleichen</strong><small>Silhouette-Fehler vor automatischer Anpassung</small></div><em id="silBaseState">BEREIT</em></div>
   <div class="silActions"><button id="silBaseline" class="primary">Basis aus Größe/Gewicht/Geschlecht aufbauen</button><button id="silScore">Kontur neu messen</button></div><div id="silScoreCard" class="silScoreCard">Noch keine Referenz geladen.</div></section>
  <section class="silStep"><div class="silStepHead"><b>5</b><div><strong>Live-Fit</strong><small>probieren → neu messen → behalten/zurücknehmen → weiter korrigieren</small></div><em id="silFitState">BEREIT</em></div>
   <label class="batchInfo"><input id="silLive" type="checkbox" checked> Live anzeigen: jeder akzeptierte/verworfene Morph bleibt kurz sichtbar</label>
   <div class="silActions"><button id="silFit" class="primary">▶ Live-Fit starten</button><button id="silPause">Pause</button><button id="silUndoFit">Ausgangszustand</button></div>
   <div class="silProgress"><div><span id="silStage">–</span><b id="silScoreNow">–</b></div><div class="silProgressTrack"><i id="silProgressBar"></i></div></div><div id="silLog" class="silLog"></div></section>
  <section class="silStep"><div class="silStepHead"><b>6</b><div><strong>Optische Revision</strong><small>erst nach sichtbarer Plausibilität größere Serien zulassen</small></div><em>DEINE PRÜFUNG</em></div>
   <div class="silActions"><button data-review="ok">✓ plausibel</button><button data-review="bad">✕ falsch</button><button data-review="unclear">? unklar</button></div><textarea id="silNote" class="silNote" placeholder="Was fällt an dieser Person auf?"></textarea>
   <div class="batchInfo"><b>Alpha-Ziel</b><span>Wir prüfen zuerst, ob BodyM auf deinem iPhone direkt funktioniert und ob der neue Fit sichtbar in die richtige Richtung korrigiert. Noch kein unbeaufsichtigter 100-Personen-Lauf.</span></div></section>
  </div>`;
  this.panel.querySelector('#silClose').onclick=()=>this.toggle(false);this.panel.querySelector('#silConnect').onclick=()=>this.connect();this.panel.querySelector('#silPrev').onclick=()=>this.selectPerson(this.personIndex-1);this.panel.querySelector('#silNext').onclick=()=>this.selectPerson(this.personIndex+1);this.panel.querySelector('#silBaseline').onclick=()=>this.makeBaseline();this.panel.querySelector('#silScore').onclick=()=>this.measureScore(true);this.panel.querySelector('#silFit').onclick=()=>this.liveFit();this.panel.querySelector('#silPause').onclick=()=>{this.pause=true};this.panel.querySelector('#silUndoFit').onclick=()=>this.restoreStart();
  for(const id of ['TolTorso','TolLimb','TolMeasure','WFront','WSide','WMeasure']){const e=this.panel.querySelector('#sil'+id),v=this.panel.querySelector('#sil'+id+'V');e.oninput=()=>v.textContent=(id.startsWith('Tol')?e.value+' cm':(+e.value).toFixed(1)+'×')}
 }
 bindSheet(){const h=this.panel.querySelector('#silHandle');let top=innerHeight*.39,drag=false,sy=0,st=0;const set=y=>{top=Math.max(72,Math.min(innerHeight-100,y));this.panel.style.setProperty('--silTop',top+'px')};set(top);h.onpointerdown=e=>{drag=true;sy=e.clientY;st=top;h.setPointerCapture?.(e.pointerId)};h.onpointermove=e=>{if(drag)set(st+e.clientY-sy)};h.onpointerup=h.onpointercancel=()=>drag=false}
 toggle(force){const show=force===undefined?this.panel.classList.contains('hidden'):!!force;this.panel.classList.toggle('hidden',!show);this.btn.classList.toggle('active',show)}
 async connect(){
  const state=this.panel.querySelector('#silSourceState'),info=this.panel.querySelector('#silSourceInfo');
  state.textContent='PRÜFT';
  info.innerHTML='<b>BodyM wird abgefragt …</b><span>Vollständiges S3-Listing + Tabellen-Zuordnung ohne Login.</span>';
  try{
   const keys=await this.listS3();
   this.keys=keys;
   const tableKeys=keys.filter(k=>/\.(csv|tsv)$/i.test(k));
   const imgKeys=keys.filter(k=>/\.(png|jpg|jpeg)$/i.test(k));
   state.textContent='ONLINE';
   info.innerHTML=`<b>Direktzugriff funktioniert</b><span>${keys.length} Dateien gefunden · ${tableKeys.length} Tabellen · ${imgKeys.length} Bilder. Tabellen werden jetzt relational zugeordnet …</span>`;
   await this.discoverPeople(tableKeys,imgKeys)
  }catch(e){
   console.error(e);state.textContent='BLOCKIERT';
   info.innerHTML=`<b>BodyM-Zugriff fehlgeschlagen</b><span>${esc(e.message)}</span>`
  }
 }
 async listS3(){
  let tokenNext='',keys=[];
  for(let page=0;page<20;page++){
   const u=S3+'/?list-type=2&max-keys=1000'+(tokenNext?'&continuation-token='+encodeURIComponent(tokenNext):'');
   const r=await fetch(u,{mode:'cors'});
   if(!r.ok)throw new Error('S3 HTTP '+r.status);
   const xml=new DOMParser().parseFromString(await r.text(),'application/xml');
   keys.push(...[...xml.querySelectorAll('Contents > Key')].map(x=>x.textContent));
   const next=xml.querySelector('NextContinuationToken')?.textContent;
   if(!next)break;
   tokenNext=next
  }
  if(!keys.length)throw new Error('Bucket antwortet, aber Listing ist leer');
  return keys
 }
 async fetchTables(keys){
  const tables=[];
  for(const k of keys){
   try{
    const r=await fetch(S3+'/'+encodeURI(k),{mode:'cors'});
    if(!r.ok)continue;
    const text=await r.text(),rows=tableParse(text);
    if(rows.length)tables.push({key:k,rows,headers:Object.keys(rows[0]||{})})
   }catch(e){console.warn('BodyM table skipped',k,e)}
  }
  return tables
 }
 rowImageIds(row,imageIds){
  const out=[];
  for(const v of Object.values(row)){
   const raw=String(v??'');
   const candidates=[stripExt(raw).toLowerCase(),...(raw.match(/[a-f0-9]{16,64}/ig)||[]).map(x=>x.toLowerCase())];
   for(const c of candidates)if(imageIds.has(c)&&!out.includes(c))out.push(c)
  }
  return out
 }
 mergeMeta(base,row){
  for(const [k,v] of Object.entries(row)){
   if(k.startsWith('__')||String(v??'').trim()==='')continue;
   if(!(k in base)||String(base[k]??'').trim()==='')base[k]=v
  }
  return base
 }
 async discoverPeople(tableKeys,imgKeys){
  const info=this.panel.querySelector('#silSourceInfo'),state=this.panel.querySelector('#silPeopleState');
  const tables=await this.fetchTables(tableKeys);
  const imageById=new Map();
  for(const k of imgKeys)imageById.set(stripExt(k).toLowerCase(),k);
  const imageIds=new Set(imageById.keys());

  // Build a small relational graph from non-numeric identifiers co-occurring in table rows.
  const parent=new Map();
  const find=x=>{if(!parent.has(x))parent.set(x,x);let p=parent.get(x);if(p!==x){p=find(p);parent.set(x,p)}return p};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a)};
  const records=[];
  for(const table of tables){
   for(const row of table.rows){
    const imgs=this.rowImageIds(row,imageIds);
    const toks=[];
    for(const v of Object.values(row)){const t=token(v);if(t)toks.push(t)}
    for(const id of imgs)if(!toks.includes(id))toks.push(id);
    for(let i=1;i<toks.length;i++)union(toks[0],toks[i]);
    records.push({row,table:table.key,imgs,subject:subjectToken(row,imageIds),view:viewFromRow(row),tokens:toks})
   }
  }

  const components=new Map();
  for(const id of imageIds){
   const root=find(id),c=components.get(root)||{images:new Set(),records:[],meta:{},views:{}};
   c.images.add(id);components.set(root,c)
  }
  for(const rec of records){
   if(!rec.tokens.length)continue;
   const root=find(rec.tokens[0]),c=components.get(root);
   if(!c)continue;
   c.records.push(rec);this.mergeMeta(c.meta,rec.row);
   for(const id of rec.imgs){
    c.images.add(id);
    if(rec.view)c.views[rec.view]=id
   }
  }

  // Also group by explicit subject IDs. This handles tables where subject and images are linked in separate rows.
  const subjGroups=new Map();
  for(const rec of records){
   if(!rec.subject)continue;
   const g=subjGroups.get(rec.subject)||{images:new Set(),records:[],meta:{},views:{}};
   rec.imgs.forEach(x=>g.images.add(x));
   g.records.push(rec);this.mergeMeta(g.meta,rec.row);
   for(const id of rec.imgs)if(rec.view)g.views[rec.view]=id;
   subjGroups.set(rec.subject,g)
  }

  const pools=[...subjGroups.entries(),...[...components.entries()].map(([k,v])=>['component-'+k,v])];
  const seen=new Set(),people=[];
  for(const [id,g] of pools){
   const ids=[...g.images].filter(x=>imageById.has(x));
   if(ids.length<2)continue;
   const sig=ids.slice().sort().join('|');if(seen.has(sig))continue;seen.add(sig);
   const meta=g.meta||{};
   const height=num(first(meta,['height','Height','height_cm','stature','head_to_heel','head-to-heel']));
   const weight=num(first(meta,['weight','Weight','weight_kg']));
   const gender=normGender(first(meta,['gender','Gender','sex','Sex']));
   people.push({
    id:String(id),meta,gender,height,weight,
    imageIds:ids.slice(0,8),
    front:g.views.front?imageById.get(g.views.front):null,
    side:g.views.side?imageById.get(g.views.side):null
   })
  }

  // Direct two-image rows, if the data uses front/side columns rather than relational rows.
  for(const table of tables)for(const row of table.rows){
   let front=null,side=null;
   for(const [k,v] of Object.entries(row)){
    const id=stripExt(v).toLowerCase();
    if(!imageById.has(id))continue;
    if(/front|frontal|anterior/i.test(k))front=imageById.get(id);
    if(/side|lateral|profile/i.test(k))side=imageById.get(id)
   }
   if(front&&side){
    const sig=[front,side].sort().join('|');if(seen.has(sig))continue;seen.add(sig);
    people.push({
     id:subjectToken(row,imageIds)||stripExt(front),
     meta:row,front,side,imageIds:[stripExt(front).toLowerCase(),stripExt(side).toLowerCase()],
     gender:normGender(first(row,['gender','Gender','sex','Sex'])),
     height:num(first(row,['height','Height','height_cm','stature','head_to_heel','head-to-heel'])),
     weight:num(first(row,['weight','Weight','weight_kg']))
    })
   }
  }

  const diag=tables.map(t=>`${t.key} [${t.headers.slice(0,7).join(', ')}${t.headers.length>7?', …':''}]`).join(' · ');
  if(!people.length){
   state.textContent='ZUORDNUNG FEHLT';
   info.innerHTML=`<b>Tabellen gefunden, aber noch keine Person mit ≥2 Bildern verbunden.</b><span>${esc(diag)}</span><span>Damit ist die Struktur jetzt sichtbar; bitte Screenshot schicken.</span>`;
   return
  }

  this.people=this.pickTen(people);
  state.textContent=this.people.length+'/10';
  info.innerHTML=`<b>BodyM erfolgreich zugeordnet</b><span>${tables.length} Tabellen gelesen · ${people.length} Personen-/Bildgruppen erkannt · ${this.people.length} für den visuellen Test ausgewählt.</span><span class="silDiag">${esc(diag)}</span>`;
  await this.selectPerson(0)
 }
 async maskEnvelopeOnly(key){
  const img=new Image();img.crossOrigin='anonymous';img.src=S3+'/'+encodeURI(key);await img.decode();
  const c=document.createElement('canvas');c.width=220;c.height=300;
  const ctx=c.getContext('2d',{willReadFrequently:true}),sc=Math.min(c.width/img.width,c.height/img.height),w=img.width*sc,h=img.height*sc,x=(c.width-w)/2,y=(c.height-h)/2;
  ctx.drawImage(img,x,y,w,h);
  const data=ctx.getImageData(0,0,c.width,c.height),env=this.envelopeFromImageData(data,c.width,c.height);
  let maxW=0,sum=0,n=0;
  for(let yy=env.ymin;yy<=env.ymax;yy++){const r=env.rows[yy];if(r){const ww=r.all[1]-r.all[0];maxW=Math.max(maxW,ww);sum+=ww;n++}}
  return {env,ratio:(n?sum/n:maxW)/Math.max(1,env.pixH)}
 }
 async resolveViews(p){
  if(p.front&&p.side)return p;
  const keys=(p.imageIds||[]).map(id=>this.keys.find(k=>stripExt(k).toLowerCase()===id)).filter(Boolean).slice(0,6);
  if(keys.length<2)throw new Error('Für diese Person wurden weniger als zwei Masken gefunden');
  const scored=[];
  for(const k of keys){try{const q=await this.maskEnvelopeOnly(k);scored.push({key:k,ratio:q.ratio})}catch{}}
  if(scored.length<2)throw new Error('Masken konnten nicht geometrisch klassifiziert werden');
  scored.sort((a,b)=>a.ratio-b.ratio);
  // side is normally narrower, front wider
  p.side=scored[0].key;p.front=scored[scored.length-1].key;
  return p
 }
 pickTen(p){const F=p.filter(x=>x.gender===0),M=p.filter(x=>x.gender===1),out=[];for(let i=0;i<5;i++){if(F[i])out.push(F[i]);if(M[i])out.push(M[i])}for(const x of p)if(out.length<10&&!out.includes(x))out.push(x);return out.slice(0,10)}
 async selectPerson(i){
  if(!this.people.length)return;
  this.personIndex=(i+this.people.length)%this.people.length;
  const p=this.people[this.personIndex];
  this.panel.querySelector('#silPersonTitle').textContent=`Person ${this.personIndex+1}/${this.people.length}`;
  this.panel.querySelector('#silPersonMeta').textContent=`${p.gender===0?'FRAU':p.gender===1?'MANN':'?'} · ${Number.isFinite(p.height)?fmt(p.height)+' cm':'Höhe ?'} · ${Number.isFinite(p.weight)?fmt(p.weight)+' kg':'Gewicht ?'} · ${p.id}`;
  try{
   this.panel.querySelector('#silPeopleState').textContent='KLASSIFIZIERT';
   await this.resolveViews(p);
   this.ref.front=await this.loadMask(p.front,'#silFront');
   this.ref.side=await this.loadMask(p.side,'#silSide');
   this.renderMeasures();
   this.panel.querySelector('#silPeopleState').textContent='GELADEN'
  }catch(e){
   console.error(e);
   this.panel.querySelector('#silPeopleState').textContent='FEHLER';
   this.panel.querySelector('#silSourceInfo').innerHTML+=`<span>Person ${this.personIndex+1}: ${esc(e.message)}</span>`
  }
 }
 async loadMask(key,canvasSel){const img=new Image();img.crossOrigin='anonymous';img.src=S3+'/'+encodeURI(key);await img.decode();const c=this.panel.querySelector(canvasSel),ctx=c.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,c.width,c.height);const sc=Math.min(c.width/img.width,c.height/img.height),w=img.width*sc,h=img.height*sc,x=(c.width-w)/2,y=(c.height-h)/2;ctx.drawImage(img,x,y,w,h);let data;try{data=ctx.getImageData(0,0,c.width,c.height)}catch{throw new Error('CORS erlaubt Bildanzeige, aber nicht das Auslesen der Silhouette')};return this.envelopeFromImageData(data,c.width,c.height)}
 envelopeFromImageData(im,w,h){const border=[];for(let x=0;x<w;x++){for(const y of [0,h-1]){const i=(y*w+x)*4;border.push((im.data[i]+im.data[i+1]+im.data[i+2])/3)}}const borderMean=border.reduce((a,b)=>a+b,0)/border.length,fgDark=borderMean>127;const rows=[];let ymin=h,ymax=0;for(let y=0;y<h;y++){const runs=[];let run=-1;for(let x=0;x<w;x++){const i=(y*w+x)*4,v=(im.data[i]+im.data[i+1]+im.data[i+2])/3,a=im.data[i+3],fg=a>20&&(fgDark?v<128:v>128);if(fg&&run<0)run=x;if((!fg||x===w-1)&&run>=0){runs.push([run,fg&&x===w-1?x:x-1]);run=-1}}if(runs.length){ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);const cx=w/2,center=runs.reduce((best,r)=>Math.abs((r[0]+r[1])/2-cx)<Math.abs((best[0]+best[1])/2-cx)?r:best,runs[0]);rows[y]={all:[Math.min(...runs.map(r=>r[0])),Math.max(...runs.map(r=>r[1]))],center}}}const pixH=Math.max(1,ymax-ymin);return {rows,ymin,ymax,pixH,w,h}}
 renderMeasures(){const p=this.people[this.personIndex],m=p?.meta||{};const keys=Object.keys(m).filter(k=>/height|weight|chest|waist|hip|shoulder|arm|bicep|calf|thigh|wrist|ankle|leg|forearm/i.test(k));this.panel.querySelector('#silMeasures').innerHTML=keys.length?keys.slice(0,18).map(k=>`<span><small>${esc(k)}</small><b>${esc(m[k])}</b></span>`).join(''):'<div class="batchInfo">Metadaten für diese Person wurden aus dem ersten automatischen Listing noch nicht sicher zugeordnet.</div>'}
 async makeBaseline(){const p=this.people[this.personIndex];if(!p)return;this.startSnap=this.engineSnapshot();if(Number.isFinite(p.gender))this.engine.state.gender=p.gender;if(Number.isFinite(p.height)){const target=(p.height-150)/50;this.engine.state.height=Math.max(0,Math.min(1,target))}if(Number.isFinite(p.weight)){const bmi=p.weight/Math.pow((p.height||175)/100,2);this.engine.state.weight=Math.max(0,Math.min(1,(bmi-16)/20))}this.engine.state.breastSize=.5;this.engine.state.breastFirmness=.5;for(const k of Object.keys(this.engine.directState))this.engine.directState[k]=0;this.engine.updateBody();this.engine.computeMetrics();this.panel.querySelector('#silBaseState').textContent='GEBAUT';await this.measureScore(true)}
 engineSnapshot(){return {state:JSON.parse(JSON.stringify(this.engine.state)),direct:JSON.parse(JSON.stringify(this.engine.directState))}}
 restoreSnapshot(s){if(!s)return;Object.assign(this.engine.state,s.state);this.engine.directState={...s.direct};this.engine.updateBody();this.engine.computeMetrics()}
 restoreStart(){this.restoreSnapshot(this.startSnap);this.measureScore(true)}
 meshEnvelope(bins=180){const a=this.engine.body?.geometry?.attributes?.position?.array;if(!a)return null;let minY=Infinity,maxY=-Infinity;for(let i=1;i<a.length;i+=3){minY=Math.min(minY,a[i]);maxY=Math.max(maxY,a[i])}const front=Array.from({length:bins},()=>[Infinity,-Infinity]),side=Array.from({length:bins},()=>[Infinity,-Infinity]);for(let i=0;i<a.length;i+=3){const y=a[i+1],b=Math.max(0,Math.min(bins-1,Math.floor((y-minY)/(maxY-minY)*bins))),x=a[i]*100,z=a[i+2]*100;front[b][0]=Math.min(front[b][0],x);front[b][1]=Math.max(front[b][1],x);side[b][0]=Math.min(side[b][0],z);side[b][1]=Math.max(side[b][1],z)}return {front,side,heightCm:(maxY-minY)*100,bins}}
 refWidth(env,t,p,heightCm,center=true){if(!env)return NaN;const y=env.ymax-Math.round(t*env.pixH),row=env.rows[Math.max(0,Math.min(env.h-1,y))];if(!row)return NaN;const r=center?row.center:row.all;return (r[1]-r[0])/env.pixH*heightCm}
 score(){const p=this.people[this.personIndex],mesh=this.meshEnvelope();if(!p||!mesh||!this.ref.front||!this.ref.side)return null;const height=Number.isFinite(p.height)?p.height:mesh.heightCm,tTorso=+this.panel.querySelector('#silTolTorso').value,tLimb=+this.panel.querySelector('#silTolLimb').value,wF=+this.panel.querySelector('#silWFront').value,wS=+this.panel.querySelector('#silWSide').value;let qF=0,qS=0,nF=0,nS=0;for(let b=8;b<mesh.bins-4;b++){const t=b/(mesh.bins-1),mf=mesh.front[b][1]-mesh.front[b][0],ms=mesh.side[b][1]-mesh.side[b][0];if(!Number.isFinite(mf)||!Number.isFinite(ms))continue;const torso=t>.38&&t<.78,tol=torso?tTorso:tLimb,rf=this.refWidth(this.ref.front,t,p,height,torso),rs=this.refWidth(this.ref.side,t,p,height,false);if(Number.isFinite(rf)){const e=Math.max(0,Math.abs(mf-rf)-tol);qF+=e*e*(torso?2:.3);nF+=torso?2:.3}if(Number.isFinite(rs)){const e=Math.max(0,Math.abs(ms-rs)-tol);qS+=e*e*(torso?2:.3);nS+=torso?2:.3}}const front=Math.sqrt(qF/Math.max(.001,nF)),side=Math.sqrt(qS/Math.max(.001,nS));return {front,side,total:(front*wF+side*wS)/(wF+wS||1)}}
 async measureScore(render=false){const s=this.score();if(!s)return null;if(render)this.panel.querySelector('#silScoreCard').innerHTML=`<b>Konturfehler außerhalb Toleranz</b><span>Front <strong>${fmt(s.front)} cm</strong> · Seite <strong>${fmt(s.side)} cm</strong> · kombiniert <strong>${fmt(s.total)} cm</strong></span>`;this.panel.querySelector('#silScoreNow').textContent=fmt(s.total)+' cm';return s}
 candidateControls(){const out=[];for(const g of this.engine.groups||[])for(const c of g.controls||[]){const sem=(g.id+' '+(c.group||'')+' '+(c.target||'')).toLowerCase();if(!c.id||/face|hand|finger|toe|ear|eye|nose|mouth/.test(sem))continue;if(/torso|chest|breast|waist|stomach|hip|pelvis|butt|shoulder|neck|upperleg|lowerleg|upperarm|lowerarm/.test(sem))out.push(c)}return out.slice(0,90)}
 log(text,cls=''){const d=this.panel.querySelector('#silLog'),p=document.createElement('div');p.className=cls;p.textContent=text;d.prepend(p);while(d.children.length>80)d.lastChild.remove()}
 async liveFit(){
  if(this.running)return;
  if(!this.people.length||!this.ref.front){this.log('Erst Referenzperson laden.','bad');return;}
  this.running=true;
  this.pause=false;
  this.startSnap=this.engineSnapshot();
  const controls=this.candidateControls();
  const live=this.panel.querySelector('#silLive').checked;
  this.panel.querySelector('#silFitState').textContent='LÄUFT';
  let current=await this.measureScore(true);
  let trial=0;
  const total=controls.length*6;
  try{
   for(const step of [.18,.09,.045]){
    for(const c of controls){
     if(this.pause)throw new Error('PAUSE');
     const old=+this.engine.directState[c.id]||0;
     let best={v:old,s:current};
     for(const dir of [-1,1]){
      const v=Math.max(-1,Math.min(1,old+dir*step));
      this.engine.directState[c.id]=v;
      this.engine.updateBody({normals:false,metrics:false});
      const score=this.score();
      trial++;
      this.panel.querySelector('#silStage').textContent=`${c.target} ${v>=0?'+':''}${v.toFixed(2)}`;
      this.panel.querySelector('#silProgressBar').style.width=Math.min(100,100*trial/total)+'%';
      if(score&&best.s&&score.total<best.s.total-.015)best={v:v,s:score};
      if(live)await new Promise(resolve=>setTimeout(resolve,45));
     }
     this.engine.directState[c.id]=best.v;
     this.engine.updateBody({normals:false,metrics:false});
     if(best.v!==old){
      this.log(`✓ ${c.target}: ${old.toFixed(2)} → ${best.v.toFixed(2)} | ${current.total.toFixed(2)} → ${best.s.total.toFixed(2)} cm`,'ok');
      current=best.s;
     }else{
      this.log(`↩ ${c.target}: beide Richtungen verworfen`,'muted');
     }
     if(live&&best.v!==old)await new Promise(resolve=>setTimeout(resolve,90));
    }
   }
   this.engine.updateBody();
   this.engine.computeMetrics();
   await this.measureScore(true);
   this.panel.querySelector('#silFitState').textContent='FERTIG';
  }catch(e){
   this.panel.querySelector('#silFitState').textContent=e.message==='PAUSE'?'PAUSE':'FEHLER';
   if(e.message!=='PAUSE')this.log(e.message,'bad');
  }finally{
   this.running=false;
  }
 }

}
