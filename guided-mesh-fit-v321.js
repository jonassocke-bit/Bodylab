const STORE='bodylab_meshfit_diag_v3211';
const TARGETS=[['shoulder','Schulterbreite'],['torso','Schulter→Schritt'],['chestBreadth','Brustbreite'],['chestDepth','Brusttiefe'],['waistBreadth','Taillenbreite'],['waistDepth','Taillentiefe'],['hipBreadth','Hüftbreite'],['neckBase','Halsbasis']];
const fmt=x=>Number.isFinite(x)?x.toFixed(3):'—';
function hashRow(r){const s=String(r.sourceRow??'');let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h>>>0}
function role(r){const m=hashRow(r)%100;return m<70?'train':m<85?'validation':'final'}
function clone(o){return JSON.parse(JSON.stringify(o))}
export class GuidedMeshFitV321{
 constructor(engine,ui,lab,batch,calibration){this.engine=engine;this.ui=ui;this.lab=lab;this.batch=batch;this.calibration=calibration;this.panel=document.getElementById('calibrationPanel');this.state=this.load();this.abort=false;this.inject();this.bind();this.sync()}
 load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return {}}}
 save(){localStorage.setItem(STORE,JSON.stringify(this.state))}
 rows(){return (this.batch?.rows||[]).filter(r=>role(r)==='validation'&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,5)}
 inject(){const h=document.createElement('div');h.id='meshFitV321';h.innerHTML=`
 <div class="generatorSectionTitle">MESH-FIT · V3.25.0</div>
 <div class="generatorIntro"><b>Kein weiterer Kalibrierungslauf.</b> Dieser Test prüft an nur 5 Personen die technische Kette: Morphwert → Meshänderung → Messwertänderung → Umfangs-Verriegelung. Erst wenn diese Kette nachweislich funktioniert, wird der 100-Personen-Fit wieder freigeschaltet.</div>
 <section class="fcStep"><div class="fcStepHead"><span>1</span><div><b>5 Personen diagnostizieren</b><small>ca. 1–3 Minuten · verändert kein gespeichertes Modell</small></div><strong id="mdStatus">BEREIT</strong></div>
 <div class="generatorActions"><button id="mdRun" class="primary">Diagnose starten</button><button id="mdAbort">Abbrechen</button></div>
 <div id="mdProgress" class="batchProgressRich hidden"><div class="batchProgressTop"><b id="mdTitle">Technische Diagnose</b><span id="mdPct">0%</span></div><div class="batchProgressTrack"><div id="mdBar"></div></div><div class="batchProgressMeta"><span id="mdCount">0 / 5</span><span>nur Diagnose</span></div></div>
 <div id="mdSummary" class="calResults"></div></section>
 <section class="fcStep"><div class="fcStepHead"><span>2</span><div><b>Technisches Protokoll</b><small>zeigt exakt, wo Änderungen verloren gehen</small></div><strong>DETAILS</strong></div><div id="mdDetails" class="calResults"></div></section>
 <section class="fcStep"><div class="fcStepHead"><span>3</span><div><b>Zielfunktion & Morph-Auswahl</b><small>5 Personen · kein großer Batch</small></div><strong id="mdNext">BEREIT</strong></div><div id="mdNextText" class="batchInfo">Nach erfolgreicher Technik-Diagnose hier die Auswahlentscheidung des Optimierers prüfen.</div><div class="generatorActions"><button id="objRun" class="primary">Auswahltest starten</button><button id="objAbort">Abbrechen</button></div><div id="objProgress" class="batchProgressRich hidden"><div class="batchProgressTop"><b>Objective Diagnose</b><span id="objPct">0%</span></div><div class="batchProgressTrack"><div id="objBar"></div></div><div class="batchProgressMeta"><span id="objCount">0 / 5</span><span>kein großer Batch</span></div></div><div id="objResult" class="calResults"></div></section>
 <section class="fcStep"><div class="fcStepHead"><span>4</span><div><b>100-Personen Ziel-Audit</b><small>ANSUR ↔ Solver-Ziel ↔ echtes Mesh</small></div><strong id="auditStatus">BEREIT</strong></div>
 <div class="generatorIntro"><b>Entscheidungstest.</b> Kein Training und kein Morph-Tuning. Für 100 Validation-Personen vergleichen wir die echten ANSUR-Maße mit dem eingefrorenen statistischen Ziel und dem tatsächlich erzeugten Baseline-Mesh.</div>
 <div class="generatorActions"><button id="auditRun" class="primary">100 Personen analysieren</button><button id="auditAbort">Abbrechen</button></div>
 <div id="auditProgress" class="batchProgressRich hidden"><div class="batchProgressTop"><b>Ziel-Audit</b><span id="auditPct">0%</span></div><div class="batchProgressTrack"><div id="auditBar"></div></div><div class="batchProgressMeta"><span id="auditCount">0 / 100</span><span id="auditEta">Restzeit wird geschätzt …</span></div></div>
 <div id="auditResult" class="calResults"></div></section>
 <section class="fcStep"><div class="fcStepHead"><span>5</span><div><b>Modifier-Limit & Geschlecht</b><small>100 Personen · Diagnose ohne Training</small></div><strong id="limitStatus">BEREIT</strong></div>
 <div class="generatorIntro">
  Prüft zwei mögliche Ursachen des Brusttiefenfehlers gleichzeitig:
  <b>A)</b> reicht <code>torso-scale-depth</code> bis 100 % überhaupt aus?
  <b>B)</b> verhält sich Brusttiefe bei Frauen anders bzw. reagiert sie stark auf die separaten Brust-Morphs?
 </div>
 <div class="generatorActions"><button id="limitRun" class="primary">100 Personen prüfen</button><button id="limitAbort">Abbrechen</button></div>
 <div id="limitProgress" class="batchProgressRich hidden"><div class="batchProgressTop"><b>Limit/Gender Diagnose</b><span id="limitPct">0%</span></div><div class="batchProgressTrack"><div id="limitBar"></div></div><div class="batchProgressMeta"><span id="limitCount">0 / 100</span><span id="limitEta">Restzeit wird geschätzt …</span></div></div>
 <div id="limitResult" class="calResults"></div></section>
 <section class="fcStep"><div class="fcStepHead"><span>6</span><div><b>V3.23 Mesh-Fitter bestätigen</b><small>100 Validation-Personen · echte Mesh-Rekonstruktion</small></div><strong id="fit23Status">BEREIT</strong></div>
 <div class="generatorIntro"><b>Jetzt wird wirklich korrigiert.</b> Frauen: Brusttiefe ist Gesamttiefe bis zum Bustpoint; Brust-Morphs werden vor generischer Torso-Tiefe bevorzugt. Männer: Torso-Tiefe bleibt primär. <code>torso-scale-depth</code> wird für beide bei 100 % gedeckelt. Brustumfang, Taille und Hüfte werden nach jedem Versuch wieder verriegelt.</div>
 <div class="generatorActions"><button id="fit23Run" class="primary">100 Personen fitten</button><button id="fit23Abort">Abbrechen</button></div>
 <div id="fit23Progress" class="batchProgressRich hidden"><div class="batchProgressTop"><b>V3.23 Mesh-Fit</b><span id="fit23Pct">0%</span></div><div class="batchProgressTrack"><div id="fit23Bar"></div></div><div class="batchProgressMeta"><span id="fit23Count">0 / 100</span><span id="fit23Eta">Restzeit wird geschätzt …</span></div></div>
 <div id="fit23Result" class="calResults"></div></section>
 <section class="fcStep"><div class="fcStepHead"><span>7</span><div><b>V3.24 Thorax + Brustprojektion</b><small>100 Validation-Personen · eigentliche Korrektur</small></div><strong id="fit24Status">BEREIT</strong></div>
 <div class="generatorIntro">
  <b>Frauen werden jetzt anders konstruiert:</b> Aus ausschließlich männlichen Trainingsdaten wird zunächst eine erwartbare
  Thorax-Grundtiefe aus Größe, Gewicht und den drei eingegebenen Umfängen geschätzt. Die weibliche ANSUR-Brusttiefe bleibt
  das <b>Gesamtziel bis zum Bustpoint</b>. Erst wird der Thorax auf seine Grundtiefe gebracht, danach wird die fehlende
  Projektion ausschließlich über Breast-Size und lokale Brust-Morphs ergänzt. Männer bleiben auf direkter Thorax-Tiefe.
  Taille/Hüfte werden nicht mehr durch den alten globalen Cross-Section-Optimizer umgebaut.
 </div>
 <div class="generatorActions"><button id="fit24Run" class="primary">100 Personen V3.24 fitten</button><button id="fit24Abort">Abbrechen</button></div>
 <div id="fit24Progress" class="batchProgressRich hidden"><div class="batchProgressTop"><b>V3.24 Mesh-Fit</b><span id="fit24Pct">0%</span></div><div class="batchProgressTrack"><div id="fit24Bar"></div></div><div class="batchProgressMeta"><span id="fit24Count">0 / 100</span><span id="fit24Eta">Restzeit wird geschätzt …</span></div></div>
 <div id="fit24Result" class="calResults"></div>
 <div class="batchInfo"><b>Danach</b><span>Wenn Gesamt-MAE und insbesondere Brusttiefe klar besser sind, folgt nur noch ein Final-Holdout auf unangetasteten Personen. Danach wird der Solver + V3.24-Mesh-Fitter eingefroren.</span></div>
 </section>
 <section class="fcStep"><div class="fcStepHead"><span>8</span><div><b>V3.25 Lokale Brustprojektion</b><small>100 Validation-Personen · finale Korrekturstrategie</small></div><strong id="fit25Status">BEREIT</strong></div>
 <div class="generatorIntro">
  <b>d8 bleibt auf ±100 % begrenzt.</b> Danach wird die bei Frauen noch fehlende Gesamttiefe
  ausschließlich mit <b>Brust-lokalen Reglern</b> erzeugt. Der Optimierer darf Brusttiefe verbessern,
  aber Brustbreite, Taille, Hüfte, Torso und Halsbasis nicht mehr deutlich verschlechtern.
  Männer bleiben auf dem bewährten direkten Torso-Tiefenpfad.
 </div>
 <div class="generatorActions"><button id="fit25Run" class="primary">100 Personen V3.25 fitten</button><button id="fit25Abort">Abbrechen</button></div>
 <div id="fit25Progress" class="batchProgressRich hidden"><div class="batchProgressTop"><b>V3.25 Mesh-Fit</b><span id="fit25Pct">0%</span></div><div class="batchProgressTrack"><div id="fit25Bar"></div></div><div class="batchProgressMeta"><span id="fit25Count">0 / 100</span><span id="fit25Eta">Restzeit wird geschätzt …</span></div></div>
 <div id="fit25Result" class="calResults"></div>
 <div class="batchInfo"><b>Wenn dieser Test besteht</b><span>Dann keine weitere Kalibrierung: nur noch Final-Holdout auf unangetasteten Personen und danach einfrieren.</span></div>
 </section>`;this.panel.appendChild(h)}
 bind(){this.panel.querySelector('#mdRun').onclick=()=>this.run();this.panel.querySelector('#mdAbort').onclick=()=>{this.abort=true};this.panel.querySelector('#objRun').onclick=()=>this.runObjective();this.panel.querySelector('#objAbort').onclick=()=>{this.abort=true};this.panel.querySelector('#auditRun').onclick=()=>this.runTargetAudit();this.panel.querySelector('#auditAbort').onclick=()=>{this.abort=true};this.panel.querySelector('#limitRun').onclick=()=>this.runLimitGenderAudit();this.panel.querySelector('#limitAbort').onclick=()=>{this.abort=true};this.panel.querySelector('#fit23Run').onclick=()=>this.runV323Fit();this.panel.querySelector('#fit23Abort').onclick=()=>{this.abort=true};this.panel.querySelector('#fit24Run').onclick=()=>this.runV324Fit();this.panel.querySelector('#fit24Abort').onclick=()=>{this.abort=true};this.panel.querySelector('#fit25Run').onclick=()=>this.runV325Fit();this.panel.querySelector('#fit25Abort').onclick=()=>{this.abort=true}}
 sync(){if(this.state.result)this.render(this.state.result)}
 current(){const h=this.engine.harnessBlindMetrics();return {shoulder:this.engine.shoulderBreadthCm(),torso:this.engine.shoulderToCrotchCm(),chestBreadth:h.chestBreadth,chestDepth:h.chestDepth,waistBreadth:h.waistBreadth,waistDepth:h.waistDepth,hipBreadth:h.hipBreadth,neckBase:h.neckBase}}
 meshSample(){const a=this.engine.body?.geometry?.attributes?.position?.array;if(!a)return [];const out=[];const step=Math.max(3,Math.floor(a.length/180));for(let i=0;i<a.length;i+=step)out.push(a[i]);return out}
 meshDelta(a,b){let s=0,m=0,n=Math.min(a.length,b.length);for(let i=0;i<n;i++){const d=Math.abs((b[i]||0)-(a[i]||0));s+=d;if(d>m)m=d}return {sum:s,max:m}}
 measureDelta(a,b){let max=0,key='';for(const [k] of TARGETS){const d=Math.abs((b[k]??NaN)-(a[k]??NaN));if(Number.isFinite(d)&&d>max){max=d;key=k}}return {max,key}}
 morphs(){
  const out=[],seen=new Set(),wanted=/(stomach|waist|torso|breast|chest|hip|pelvis|butt)/i,blocked=/(face|eye|nose|mouth|ear)/i;
  for(const group of this.engine.groups||[])for(const c of group.controls||[]){
   if(!c?.id||seen.has(c.id)||!(c.id in (this.engine.directState||{})))continue;
   const semantic=`${group.id||""} ${c.group||""} ${c.target||""}`;
   if(!wanted.test(semantic)||blocked.test(semantic))continue;
   seen.add(c.id);out.push({id:c.id,target:c.target||c.id,group:c.group||group.id||""});
  }
  return out.slice(0,24);
 }
 async baseline(r){const e=this.engine,l=this.lab;e.reset();e.state.gender=r.gender===0?0:r.gender===1?1:.5;e.state.age=Math.max(0,Math.min(1,l.ageToSlider(r.age||30)));e.state.muscle=Math.max(0,Math.min(1,r.build??.52));e.updateBody({normals:false,metrics:false});await l.solveCore('height',r.height,'height',0,1);await l.solveCore('weight',r.weight,'weight',0,1);e.updateBody({normals:false,metrics:false});await this.relock(r);e.updateBody({normals:false,metrics:false})}
 async relock(r){await this.lab.solveDirect('measure-bust-circ',r.chest);await this.lab.solveDirect('measure-waist-circ',r.waist);await this.lab.solveDirect('measure-hips-circ',r.hip)}
 async diagnosePerson(r,index){await this.baseline(r);const baseM=this.current(),baseMesh=this.meshSample(),morphs=this.morphs();let chosen=null;
  for(const morph of morphs){const id=morph.id;const old=Number(this.engine.directState[id]||0),test=Math.max(-1.2,Math.min(1.2,old+.10));this.engine.directState[id]=test;this.engine.updateBody({normals:false,metrics:false});const m=this.current(),mesh=this.meshSample(),md=this.meshDelta(baseMesh,mesh),xd=this.measureDelta(baseM,m);this.engine.directState[id]=old;this.engine.updateBody({normals:false,metrics:false});if(!chosen||xd.max>chosen.measureDelta)chosen={id,target:morph.target,group:morph.group,old,test,meshDelta:md.max,measureDelta:xd.max,measureKey:xd.key,afterMorph:m};if(xd.max>.02&&md.max>1e-7)break}
  if(!chosen)return {index,problem:`Keine passenden Rumpf-Morphs gefunden · groups=${(this.engine.groups||[]).length} · directState=${Object.keys(this.engine.directState||{}).length}`};
  const id=chosen.id,old=Number(this.engine.directState[id]||0);this.engine.directState[id]=chosen.test;this.engine.updateBody({normals:false,metrics:false});const preRelockM=this.current(),preRelockMesh=this.meshSample();const stateBefore=clone(this.engine.directState);await this.relock(r);const stateAfterSolve=clone(this.engine.directState);const meshImmediately=this.meshSample(),immediateM=this.current();this.engine.updateBody({normals:false,metrics:false});const meshAfterUpdate=this.meshSample(),afterUpdateM=this.current();
  const relockStateChanged=Object.keys(stateAfterSolve).some(k=>Math.abs((stateAfterSolve[k]||0)-(stateBefore[k]||0))>1e-6);const stale=this.meshDelta(meshImmediately,meshAfterUpdate).max>1e-7||this.measureDelta(immediateM,afterUpdateM).max>.005;
  return {index,morph:id,morphFrom:old,morphTo:chosen.test,morphMeshDelta:chosen.meshDelta,morphMeasureDelta:chosen.measureDelta,morphMeasureKey:chosen.measureKey,relockStateChanged,staleAfterRelock:stale,immediateVsUpdatedMesh:this.meshDelta(meshImmediately,meshAfterUpdate).max,immediateVsUpdatedMeasure:this.measureDelta(immediateM,afterUpdateM).max,preRelock:preRelockM,immediate:immediateM,updated:afterUpdateM}}

 target(r){const wf=this.calibration?.workflow,o={};for(const [k] of TARGETS)o[k]=wf?.correctedPrediction?.(r,k);return o}
 objective(cur,tgt,base){const w={chestBreadth:1.2,chestDepth:1.5,waistBreadth:1.6,waistDepth:2.5,hipBreadth:1.2,shoulder:1.3,torso:1.3,neckBase:1.2};let s=0,n=0;for(const k in w){if(!Number.isFinite(cur[k])||!Number.isFinite(tgt[k]))continue;const e=(cur[k]-tgt[k])/Math.max(10,Math.abs(tgt[k]));s+=w[k]*e*e;n+=w[k]}for(const k of ['shoulder','torso','neckBase','hipBreadth'])if(Number.isFinite(cur[k])&&Number.isFinite(base[k])){const d=Math.abs(cur[k]-base[k]);if(d>.35)s+=(d-.35)*(d-.35)*8}return n?s/n:Infinity}
 worstError(cur,tgt){let best=null;for(const [k] of TARGETS){if(!Number.isFinite(cur[k])||!Number.isFinite(tgt[k]))continue;const e=cur[k]-tgt[k];if(!best||Math.abs(e)>Math.abs(best.err))best={key:k,err:e}}return best}
 async scanChoices(r){
  await this.baseline(r);const base=this.current(),tgt=this.target(r),before=this.objective(base,tgt,base),worst=this.worstError(base,tgt),choices=[];
  for(const morph of this.morphs().slice(0,18)){
   const id=morph.id,old=Number(this.engine.directState[id]||0);
   for(const dir of [-1,1]){
    const val=Math.max(-1.2,Math.min(1.2,old+dir*.08));this.engine.directState[id]=val;this.engine.updateBody({normals:false,metrics:false});await this.relock(r);
    const now=this.current(),obj=this.objective(now,tgt,base),delta=worst&&Number.isFinite(now[worst.key])?now[worst.key]-base[worst.key]:NaN;
    choices.push({id,target:morph.target,group:morph.group,dir,val,obj,delta});
   }
   this.engine.directState[id]=old;this.engine.updateBody({normals:false,metrics:false});await this.relock(r);
  }
  choices.sort((a,b)=>a.obj-b.obj);return {base,tgt,before,worst,choices:choices.slice(0,5)}
 }
 async runObjective(){
  const rows=this.rows();if(rows.length<5){alert('Nicht genug Validation-Personen geladen.');return}
  const box=this.panel.querySelector('#objResult'),snap=this.engine.snapshot(),results=[];this.abort=false;this.panel.querySelector('#objProgress').classList.remove('hidden');
  try{for(let i=0;i<5;i++){if(this.abort)break;results.push(await this.scanChoices(rows[i]));const pct=(i+1)*20;this.panel.querySelector('#objPct').textContent=pct+'%';this.panel.querySelector('#objBar').style.width=pct+'%';this.panel.querySelector('#objCount').textContent=`${i+1} / 5`;await new Promise(r=>setTimeout(r,0))}this.renderObjective(results)}
  finally{this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics()}
 }
 renderObjective(results){
  if(!results.length)return;let improved=0,wrong=0;
  for(const r of results){const b=r.choices[0];if(b&&b.obj<r.before-1e-8)improved++;if(r.worst&&b&&Number.isFinite(b.delta)){const need=-Math.sign(r.worst.err),got=Math.sign(b.delta);if(need&&got&&need!==got)wrong++}}
  const ok=improved===results.length&&wrong===0;
  this.panel.querySelector('#objResult').innerHTML=`<div class="optimizerHero ${ok?'hit':'miss'}"><small>OBJECTIVE / MORPH-AUSWAHL</small><strong>${ok?'AUSWAHLLOGIK OK':'AUFFÄLLIGKEIT GEFUNDEN'}</strong><span>${improved}/${results.length} verbessern die Zielfunktion · ${wrong}/${results.length} bewegen das größte Fehlermaß in die falsche Richtung</span></div>`+results.map((r,i)=>{const b=r.choices[0],tops=r.choices.slice(0,3).map(x=>`${x.id} (${x.target||'?'}) ${x.dir>0?'+':'−'} · ${x.obj.toFixed(5)}`).join('<br>');return `<div class="batchInfo"><b>Person ${i+1}</b><span>Größter Fehler: ${r.worst?`${r.worst.key} ${r.worst.err>=0?'+':''}${r.worst.err.toFixed(2)} cm`:'—'}</span><span>Objective: ${r.before.toFixed(5)} → ${b?b.obj.toFixed(5):'—'}</span><span>Beste Wahl: ${b?`${b.id} · ${b.target||'?'} · ${b.dir>0?'+':'−'}`:'—'}</span><span>Wirkung auf größtes Fehlermaß: ${b&&Number.isFinite(b.delta)?`${b.delta>=0?'+':''}${b.delta.toFixed(3)} cm`:'—'}</span><span>Top 3:<br>${tops||'—'}</span></div>`}).join('');
  this.panel.querySelector('#mdNext').textContent=ok?'LOGIK OK':'PRÜFEN';
  this.panel.querySelector('#mdNextText').innerHTML=ok?'<b>Die Auswahl reagiert plausibel.</b><span>Dann können wir den eigentlichen 100-Personen-Mesh-Fit wieder freigeben.</span>':'<b>Noch keinen großen Test.</b><span>Die Auswahl/Gewichtung zeigt eine konkrete Auffälligkeit, die wir zuerst korrigieren.</span>';
 }


 auditRaw(r,k){
  const aliases={
   chestBreadth:["chestBreadth","chestbreadth"],
   chestDepth:["chestDepth","chestdepth"],
   waistBreadth:["waistBreadth","waistbreadth"],
   waistDepth:["waistDepth","waistdepth"],
   hipBreadth:["hipBreadth","hipbreadth"],
   shoulder:["shoulder","shoulderBreadth","biacromialBreadth"],
   torso:["torso","shoulderToCrotch"],
   neckBase:["neckBase","neckBaseCirc","neckCircumference"]
  };
  for(const key of aliases[k]||[k])if(Number.isFinite(+r[key]))return +r[key];
  return NaN;
 }
 stats(a){
  const x=a.filter(Number.isFinite);if(!x.length)return {n:0,mae:NaN,bias:NaN,p90:NaN};
  const abs=x.map(Math.abs).sort((a,b)=>a-b),bias=x.reduce((s,v)=>s+v,0)/x.length,mae=abs.reduce((s,v)=>s+v,0)/abs.length;
  const p90=abs[Math.min(abs.length-1,Math.floor((abs.length-1)*.9))];
  return {n:x.length,mae,bias,p90};
 }
 async runTargetAudit(){
  const rows=(this.batch?.rows||[]).filter(r=>role(r)==='validation'&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,100);
  if(rows.length<50){alert('Nicht genug Validation-Personen geladen.');return}
  const prog=this.panel.querySelector('#auditProgress'),box=this.panel.querySelector('#auditResult'),snap=this.engine.snapshot();
  prog.classList.remove('hidden');this.panel.querySelector('#auditStatus').textContent='LÄUFT';this.abort=false;
  const keys=["chestBreadth","chestDepth","waistBreadth","waistDepth","hipBreadth","shoulder","torso","neckBase"];
  const data={};for(const k of keys)data[k]={solverVsAns:[],meshVsAns:[],meshVsSolver:[]};
  const examples=[],samples=[];const tStart=performance.now();
  try{
   for(let i=0;i<rows.length;i++){
    if(this.abort)break;const t0=performance.now(),r=rows[i];
    await this.baseline(r);
    const mesh=this.current(),tgt=this.target(r),ex={index:i+1,vals:{}};
    for(const k of keys){
     const raw=this.auditRaw(r,k),pred=tgt[k],m=mesh[k];
     if(Number.isFinite(raw)&&Number.isFinite(pred))data[k].solverVsAns.push(pred-raw);
     if(Number.isFinite(raw)&&Number.isFinite(m))data[k].meshVsAns.push(m-raw);
     if(Number.isFinite(pred)&&Number.isFinite(m))data[k].meshVsSolver.push(m-pred);
     if(i<5)ex.vals[k]={raw,pred,mesh:m};
    }
    if(i<5)examples.push(ex);
    const sec=(performance.now()-t0)/1000;if(sec>.001&&sec<120)samples.push(sec);if(samples.length>20)samples.shift();
    const done=i+1,pct=100*done/rows.length,med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
    this.panel.querySelector('#auditPct').textContent=pct.toFixed(0)+'%';this.panel.querySelector('#auditBar').style.width=pct+'%';this.panel.querySelector('#auditCount').textContent=`${done} / ${rows.length}`;
    this.panel.querySelector('#auditEta').textContent=Number.isFinite(med)&&done>2?`ca. ${Math.max(0,Math.round(med*(rows.length-done)/60))} min verbleibend`:'Restzeit wird geschätzt …';
    await new Promise(q=>setTimeout(q,0));
   }
   const summary={n:rows.length,measures:{}};
   for(const k of keys)summary.measures[k]={solverVsAns:this.stats(data[k].solverVsAns),meshVsAns:this.stats(data[k].meshVsAns),meshVsSolver:this.stats(data[k].meshVsSolver)};
   this.renderTargetAudit(summary,examples);
  }finally{this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics()}
 }
 renderTargetAudit(s,examples){
  const box=this.panel.querySelector('#auditResult'),cd=s.measures.chestDepth,wd=s.measures.waistDepth;
  const ratio=(x)=>Number.isFinite(x.meshVsSolver.mae)&&Number.isFinite(x.solverVsAns.mae)?x.meshVsSolver.mae-x.solverVsAns.mae:NaN;
  const meshDominates=[cd,wd].filter(x=>ratio(x)>.5).length;
  const solverBad=[cd,wd].filter(x=>x.solverVsAns.mae>2.5).length;
  let verdict,title;
  if(solverBad>=1){title='ZIELMODELL PRÜFEN';verdict='Schon das statistisch vorhergesagte Ziel liegt deutlich vom echten ANSUR-Maß entfernt. Dann liegt der Hauptfehler vor dem Mesh-Fitter.'}
  else if(meshDominates>=1){title='MESH-UMSETZUNG IST ENGPASS';verdict='Die Solver-Ziele liegen deutlich näher an ANSUR als das erzeugte Mesh. Dann lohnt sich der gezielte Mesh-Fitter.'}
  else{title='GEMISCHTES BILD';verdict='Statistik und Mesh tragen beide relevant zum Restfehler bei. Wir entscheiden maßweise.'}
  const fmt2=x=>Number.isFinite(x)?x.toFixed(2):'—';
  box.innerHTML=`<div class="optimizerHero"><small>100-PERSONEN ZIEL-AUDIT</small><strong>${title}</strong><span>${verdict}</span></div>
   <div class="batchMeasureMatrix"><b>MAE je Ebene</b>${Object.entries(s.measures).map(([k,v])=>`<span>${k}: Solver↔ANSUR <strong>${fmt2(v.solverVsAns.mae)}</strong> · Mesh↔ANSUR <strong>${fmt2(v.meshVsAns.mae)}</strong> · Mesh↔Solver <strong>${fmt2(v.meshVsSolver.mae)}</strong> cm</span>`).join('')}</div>
   <div class="batchMeasureMatrix"><b>Bias (Vorzeichen zeigt Richtung)</b>${Object.entries(s.measures).map(([k,v])=>`<span>${k}: Solver ${v.solverVsAns.bias>=0?'+':''}${fmt2(v.solverVsAns.bias)} · Mesh ${v.meshVsAns.bias>=0?'+':''}${fmt2(v.meshVsAns.bias)} cm</span>`).join('')}</div>
   <div class="batchInfo"><b>5 Beispiele · Brust/Taille</b>${examples.map(e=>{const c=e.vals.chestDepth||{},w=e.vals.waistDepth||{};return `<span>P${e.index}: Brusttiefe ANSUR ${fmt2(c.raw)} → Ziel ${fmt2(c.pred)} → Mesh ${fmt2(c.mesh)} · Taillentiefe ANSUR ${fmt2(w.raw)} → Ziel ${fmt2(w.pred)} → Mesh ${fmt2(w.mesh)}</span>`}).join('')}</div>`;
  this.panel.querySelector('#auditStatus').textContent='ERLEDIGT';
 }


 findMorphByTarget(target){
  for(const group of this.engine.groups||[])for(const c of group.controls||[])if(c?.target===target&&c?.id)return c;
  return null;
 }
 breastMorphs(){
  const out=[];
  for(const group of this.engine.groups||[])for(const c of group.controls||[]){
   const semantic=`${group.id||""} ${c.group||""} ${c.target||""}`;
   if(c?.id&&/(breast|frontchest)/i.test(semantic)&&!(c.id in ({})))out.push(c);
  }
  return out.filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i).slice(0,20);
 }
 genderLabel(r){return r.gender===0?'Frauen':r.gender===1?'Männer':'Unbekannt'}
 absMean(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+Math.abs(v),0)/x.length:NaN}
 meanVal(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:NaN}
 pctVal(a,p){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return NaN;return x[Math.min(x.length-1,Math.floor((x.length-1)*p))]}
 async measureAtMorph(r,id,value){
  const old=Number(this.engine.directState[id]||0);
  this.engine.directState[id]=value;
  this.engine.updateBody({normals:false,metrics:false});
  await this.relock(r);
  this.engine.updateBody({normals:false,metrics:false});
  const m=this.current();
  this.engine.directState[id]=old;
  this.engine.updateBody({normals:false,metrics:false});
  await this.relock(r);
  this.engine.updateBody({normals:false,metrics:false});
  return m;
 }
 async strongestBreastDepthEffect(r,baseDepth){
  const morphs=this.breastMorphs();let best={id:null,target:null,delta:0};
  for(const c of morphs){
   const old=Number(this.engine.directState[c.id]||0);
   for(const step of [-.20,.20]){
    const val=Math.max(-1.2,Math.min(1.2,old+step));
    this.engine.directState[c.id]=val;this.engine.updateBody({normals:false,metrics:false});await this.relock(r);this.engine.updateBody({normals:false,metrics:false});
    const d=this.current().chestDepth-baseDepth;
    if(Number.isFinite(d)&&Math.abs(d)>Math.abs(best.delta))best={id:c.id,target:c.target,delta:d};
   }
   this.engine.directState[c.id]=old;this.engine.updateBody({normals:false,metrics:false});await this.relock(r);this.engine.updateBody({normals:false,metrics:false});
  }
  return best;
 }
 async runLimitGenderAudit(){
  const rows=(this.batch?.rows||[]).filter(r=>role(r)==='validation'&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,100);
  if(rows.length<50){alert('Nicht genug Validation-Personen geladen.');return}
  const d8=this.findMorphByTarget('torso-scale-depth');
  if(!d8){alert('torso-scale-depth wurde nicht gefunden.');return}

  const prog=this.panel.querySelector('#limitProgress'),snap=this.engine.snapshot(),samples=[];
  prog.classList.remove('hidden');this.panel.querySelector('#limitStatus').textContent='LÄUFT';this.abort=false;

  const groups={
   Frauen:{n:0,solverErr:[],meshErr:[],d8At1Err:[],d8At12Err:[],gain1:[],gain12:[],breastEffect:[],hitUseful:0},
   Männer:{n:0,solverErr:[],meshErr:[],d8At1Err:[],d8At12Err:[],gain1:[],gain12:[],breastEffect:[],hitUseful:0}
  };
  const extremes=[];

  try{
   for(let i=0;i<rows.length;i++){
    if(this.abort)break;
    const t0=performance.now(),r=rows[i],gl=this.genderLabel(r),G=groups[gl]||groups.Männer;
    await this.baseline(r);
    const base=this.current(),tgt=this.target(r),raw=this.auditRaw(r,'chestDepth');
    const baseDepth=base.chestDepth,target=tgt.chestDepth;

    const at1=await this.measureAtMorph(r,d8.id,1.0);
    const at12=await this.measureAtMorph(r,d8.id,1.2);

    // Return to baseline before breast sensitivity scan.
    await this.baseline(r);
    const breast=await this.strongestBreastDepthEffect(r,this.current().chestDepth);

    G.n++;
    if(Number.isFinite(raw)&&Number.isFinite(target))G.solverErr.push(target-raw);
    if(Number.isFinite(raw)&&Number.isFinite(baseDepth))G.meshErr.push(baseDepth-raw);
    if(Number.isFinite(raw)&&Number.isFinite(at1.chestDepth))G.d8At1Err.push(at1.chestDepth-raw);
    if(Number.isFinite(raw)&&Number.isFinite(at12.chestDepth))G.d8At12Err.push(at12.chestDepth-raw);
    if(Number.isFinite(baseDepth)&&Number.isFinite(at1.chestDepth))G.gain1.push(at1.chestDepth-baseDepth);
    if(Number.isFinite(at1.chestDepth)&&Number.isFinite(at12.chestDepth))G.gain12.push(at12.chestDepth-at1.chestDepth);
    if(Number.isFinite(breast.delta))G.breastEffect.push(Math.abs(breast.delta));

    const need=Number.isFinite(target)&&Number.isFinite(baseDepth)?target-baseDepth:NaN;
    const stillShort=Number.isFinite(target)&&Number.isFinite(at1.chestDepth)?target-at1.chestDepth:NaN;
    const over100Helps=Number.isFinite(target)&&Number.isFinite(at1.chestDepth)&&Number.isFinite(at12.chestDepth)
      ? Math.abs(target-at12.chestDepth)<Math.abs(target-at1.chestDepth)-.05 : false;
    if(Number.isFinite(need)&&need>1&&Number.isFinite(stillShort)&&stillShort>.5&&over100Helps)G.hitUseful++;

    if(Number.isFinite(need)){
     extremes.push({index:i+1,gender:gl,raw,target,base:baseDepth,at1:at1.chestDepth,at12:at12.chestDepth,need,stillShort,breast});
     extremes.sort((a,b)=>Math.abs(b.need)-Math.abs(a.need));if(extremes.length>8)extremes.pop();
    }

    const sec=(performance.now()-t0)/1000;if(sec>.01&&sec<300)samples.push(sec);if(samples.length>15)samples.shift();
    const done=i+1,pct=100*done/rows.length,med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
    this.panel.querySelector('#limitPct').textContent=pct.toFixed(0)+'%';this.panel.querySelector('#limitBar').style.width=pct+'%';this.panel.querySelector('#limitCount').textContent=`${done} / ${rows.length}`;
    this.panel.querySelector('#limitEta').textContent=Number.isFinite(med)&&done>2?`ca. ${Math.max(0,Math.round(med*(rows.length-done)/60))} min verbleibend`:'Restzeit wird geschätzt …';
    await new Promise(q=>setTimeout(q,0));
   }

   const summary={groups:{},extremes};
   for(const [name,G] of Object.entries(groups)){
    summary.groups[name]={
     n:G.n,
     solverMAE:this.absMean(G.solverErr),meshMAE:this.absMean(G.meshErr),
     at1MAE:this.absMean(G.d8At1Err),at12MAE:this.absMean(G.d8At12Err),
     meshBias:this.meanVal(G.meshErr),
     gain1:this.meanVal(G.gain1),gain12:this.meanVal(G.gain12),
     breastEffect:this.meanVal(G.breastEffect),breastP90:this.pctVal(G.breastEffect,.9),
     usefulBeyond100:G.hitUseful
    };
   }
   this.renderLimitGenderAudit(summary,d8);
  }finally{this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics()}
 }
 renderLimitGenderAudit(s,d8){
  const F=s.groups.Frauen,M=s.groups.Männer,fmt2=x=>Number.isFinite(x)?x.toFixed(2):'—';
  const genderGap=Number.isFinite(F.meshMAE)&&Number.isFinite(M.meshMAE)?F.meshMAE-M.meshMAE:NaN;
  const breastGap=Number.isFinite(F.breastEffect)&&Number.isFinite(M.breastEffect)?F.breastEffect-M.breastEffect:NaN;
  const totalN=(F.n||0)+(M.n||0),beyond=(F.usefulBeyond100||0)+(M.usefulBeyond100||0);
  const limitStrong=totalN>0&&beyond/totalN>=.30;
  const genderStrong=Number.isFinite(genderGap)&&Math.abs(genderGap)>=1.0;
  const breastStrong=Number.isFinite(breastGap)&&breastGap>=.35;

  let title,desc;
  if(limitStrong&&(genderStrong||breastStrong)){title='BEIDE EFFEKTE RELEVANT';desc='Die 100-%-Grenze begrenzt die erreichbare Brusttiefe, zugleich zeigt sich ein relevanter Geschlechts-/Brust-Morph-Effekt.'}
  else if(limitStrong){title='MODIFIER-LIMIT IST HAUPTVERDACHT';desc='Viele Personen bleiben bei d8=100 % zu flach, und 120 % bewegt sie weiter in Richtung Ziel. Das spricht klar für zu wenig Morph-Reichweite.'}
  else if(genderStrong||breastStrong){title='GESCHLECHT / BRUSTGEOMETRIE PRÜFEN';desc='Frauen und Männer unterscheiden sich deutlich bzw. separate Brust-Morphs beeinflussen die gemessene Brusttiefe stark. Die Messdefinition muss geschlechtsspezifisch geprüft werden.'}
  else{title='KEIN EINZELNER HAUPTVERURSACHER';desc='Weder die 100-%-Grenze noch ein klarer Geschlechtseffekt erklärt den Fehler allein. Dann ist die kombinierte Morph-Geometrie der nächste Ansatz.'}

  const row=(name,G)=>`<div class="batchMeasureMatrix"><b>${name} · n=${G.n}</b>
   <span>Solver↔ANSUR Brusttiefe MAE: <strong>${fmt2(G.solverMAE)} cm</strong></span>
   <span>Baseline-Mesh↔ANSUR MAE: <strong>${fmt2(G.meshMAE)} cm</strong> · Bias ${G.meshBias>=0?'+':''}${fmt2(G.meshBias)}</span>
   <span>d8 = 100 % → MAE <strong>${fmt2(G.at1MAE)} cm</strong> · mittlere Tiefenzunahme ${fmt2(G.gain1)} cm</span>
   <span>d8 = 120 % → MAE <strong>${fmt2(G.at12MAE)} cm</strong> · zusätzlich +${fmt2(G.gain12)} cm</span>
   <span>120 % hilft trotz Restfehler bei <strong>${G.usefulBeyond100}/${G.n}</strong> Personen</span>
   <span>stärkster Brust-Morph-Effekt: Ø <strong>${fmt2(G.breastEffect)} cm</strong> · P90 ${fmt2(G.breastP90)} cm</span>
  </div>`;

  this.panel.querySelector('#limitResult').innerHTML=
   `<div class="optimizerHero"><small>LIMIT / GENDER DIAGNOSE</small><strong>${title}</strong><span>${desc}</span></div>`+
   row('Frauen',F)+row('Männer',M)+
   `<div class="batchInfo"><b>Direkter Vergleich</b>
    <span>Mesh-MAE Frauen − Männer: ${genderGap>=0?'+':''}${fmt2(genderGap)} cm</span>
    <span>Brust-Morph-Effekt Frauen − Männer: ${breastGap>=0?'+':''}${fmt2(breastGap)} cm</span>
    <span>Getesteter Tiefenmorph: ${d8.id} · ${d8.target}</span>
   </div>`+
   `<div class="batchMeasureMatrix"><b>8 stärkste Brusttiefen-Fälle</b>${s.extremes.map(x=>`<span>P${x.index} · ${x.gender}: ANSUR ${fmt2(x.raw)} → Ziel ${fmt2(x.target)} → Mesh ${fmt2(x.base)} → d8 100 % ${fmt2(x.at1)} → 120 % ${fmt2(x.at12)} · Brust-Morph ${x.breast?.target||'—'} ${x.breast?.delta>=0?'+':''}${fmt2(x.breast?.delta)}</span>`).join('')}</div>`;
  this.panel.querySelector('#limitStatus').textContent='ERLEDIGT';
 }

 async run(){const rows=this.rows();if(rows.length<5){alert('Es sind nicht genug Validation-Personen geladen. Bitte den gespeicherten Datensatz laden.');return}this.abort=false;this.panel.querySelector('#mdProgress').classList.remove('hidden');this.panel.querySelector('#mdStatus').textContent='LÄUFT';const snap=this.engine.snapshot(),people=[];try{for(let i=0;i<5;i++){if(this.abort)break;people.push(await this.diagnosePerson(rows[i],i+1));const p=(i+1)/5*100;this.panel.querySelector('#mdPct').textContent=p.toFixed(0)+'%';this.panel.querySelector('#mdBar').style.width=p+'%';this.panel.querySelector('#mdCount').textContent=`${i+1} / 5`;await new Promise(r=>setTimeout(r,0))}const valid=people.filter(x=>!x.problem),morphWorks=valid.filter(x=>x.morphMeshDelta>1e-7&&x.morphMeasureDelta>.005).length,stale=valid.filter(x=>x.staleAfterRelock).length,stateChanges=valid.filter(x=>x.relockStateChanged).length;this.state.result={at:new Date().toISOString(),people,morphWorks,stale,stateChanges,n:valid.length};this.save();this.render(this.state.result)}finally{this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics()}}

 trainingRowsMale(){
  return (this.batch?.rows||[]).filter(r=>role(r)==='train'&&r.gender===1&&[r.height,r.weight,r.chest,r.waist,r.hip,this.auditRaw(r,'chestDepth')].every(Number.isFinite));
 }
 solveLinear(A,b){
  const n=A.length,M=A.map((row,i)=>row.slice().concat([b[i]]));
  for(let k=0;k<n;k++){
   let p=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;
   [M[k],M[p]]=[M[p],M[k]];const d=M[k][k];if(Math.abs(d)<1e-12)continue;
   for(let j=k;j<=n;j++)M[k][j]/=d;
   for(let i=0;i<n;i++)if(i!==k){const f=M[i][k];for(let j=k;j<=n;j++)M[i][j]-=f*M[k][j]}
  }
  return M.map(r=>r[n]);
 }
 trainMaleThoraxModel(){
  if(this._maleThoraxModel)return this._maleThoraxModel;
  const rows=this.trainingRowsMale();
  const rawFeatures=r=>[+r.height,+r.weight,+r.chest,+r.waist,+r.hip,Number.isFinite(+r.age)?+r.age:30];
  const p=6,means=Array(p).fill(0),stds=Array(p).fill(1);
  for(let j=0;j<p;j++){const v=rows.map(r=>rawFeatures(r)[j]);means[j]=v.reduce((s,x)=>s+x,0)/v.length;const vv=v.reduce((s,x)=>s+(x-means[j])**2,0)/v.length;stds[j]=Math.sqrt(vv)||1}
  const X=rows.map(r=>[1,...rawFeatures(r).map((x,j)=>(x-means[j])/stds[j])]),y=rows.map(r=>this.auditRaw(r,'chestDepth'));
  const q=p+1,ATA=Array.from({length:q},()=>Array(q).fill(0)),ATy=Array(q).fill(0),lambda=.08;
  for(let i=0;i<X.length;i++)for(let a=0;a<q;a++){ATy[a]+=X[i][a]*y[i];for(let b=0;b<q;b++)ATA[a][b]+=X[i][a]*X[i][b]}
  for(let j=1;j<q;j++)ATA[j][j]+=lambda;
  const beta=this.solveLinear(ATA,ATy);
  this._maleThoraxModel={n:rows.length,means,stds,beta};
  return this._maleThoraxModel;
 }
 predictMaleThorax(r){
  const m=this.trainMaleThoraxModel(),raw=[+r.height,+r.weight,+r.chest,+r.waist,+r.hip,Number.isFinite(+r.age)?+r.age:30];
  const x=[1,...raw.map((v,j)=>(v-m.means[j])/m.stds[j])];
  return x.reduce((s,v,j)=>s+v*m.beta[j],0);
 }
 breastControls(){
  const out=[];
  for(const group of this.engine.groups||[])for(const c of group.controls||[]){
   if(c?.id&&c.source==='modeling'&&c.group==='breast'&&/^breast-/.test(c.target||''))out.push(c);
  }
  return out;
 }
 async refreshLock(r){
  this.engine.updateBody({normals:false,metrics:false});
  await this.relock(r);
  this.engine.updateBody({normals:false,metrics:false});
 }
 protectedObjective(cur,tgt,focus='chestDepth'){
  const w={chestDepth:6,chestBreadth:2.2,waistBreadth:1.7,waistDepth:1.7,hipBreadth:1.7,shoulder:1.1,torso:1.1,neckBase:1.1};
  let s=0,n=0;
  for(const [k,ww] of Object.entries(w)){
   if(!Number.isFinite(cur[k])||!Number.isFinite(tgt[k]))continue;
   const scale=Math.max(10,Math.abs(tgt[k])),e=(cur[k]-tgt[k])/scale;
   s+=ww*e*e;n+=ww;
  }
  return n?s/n:Infinity;
 }
 async scanD8ToTarget(r,targetDepth,tgt){
  const c=this.findMorphByTarget('torso-scale-depth');if(!c)return null;
  const original=Number(this.engine.directState[c.id]||0),candidates=[];
  for(let v=-1;v<=1.0001;v+=.20){
   this.engine.directState[c.id]=Math.round(v*100)/100;await this.refreshLock(r);
   const cur=this.current(),err=Math.abs(cur.chestDepth-targetDepth),protect=this.protectedObjective(cur,tgt);
   candidates.push({v:this.engine.directState[c.id],err,score:err*err/100+protect*.45,cur});
  }
  candidates.sort((a,b)=>a.score-b.score);let center=candidates[0].v,best=candidates[0];
  for(let v=Math.max(-1,center-.20);v<=Math.min(1,center+.2001);v+=.04){
   this.engine.directState[c.id]=Math.round(v*100)/100;await this.refreshLock(r);
   const cur=this.current(),err=Math.abs(cur.chestDepth-targetDepth),protect=this.protectedObjective(cur,tgt),q={v:this.engine.directState[c.id],err,score:err*err/100+protect*.45,cur};
   if(q.score<best.score)best=q;
  }
  this.engine.directState[c.id]=best.v;await this.refreshLock(r);
  return {id:c.id,target:c.target,value:best.v,state:this.current()};
 }
 async femaleChestDecomposedFit(r,tgt){
  // Start from the non-cross-section correction only; do not run V3.16 global cross-section optimizer.
  const solver=this.calibration?.workflow?.solver;
  if(solver?.correct)await solver.correct(r);
  await this.refreshLock(r);

  const totalTarget=tgt.chestDepth;
  let thoraxTarget=this.predictMaleThorax(r);
  // Male-derived thorax may never exceed the female total Bustpoint depth.
  thoraxTarget=Math.min(totalTarget,Math.max(totalTarget*.58,thoraxTarget));

  // Remove breast projection while fitting the thorax. This is temporary and diagnostic-neutral.
  const savedBreastSize=this.engine.state.breastSize,savedFirm=this.engine.state.breastFirmness;
  const controls=this.breastControls(),savedDirect=Object.fromEntries(controls.map(c=>[c.id,Number(this.engine.directState[c.id]||0)]));
  this.engine.state.breastSize=0;
  this.engine.state.breastFirmness=.5;
  for(const c of controls)this.engine.directState[c.id]=0;
  await this.refreshLock(r);

  const d8=await this.scanD8ToTarget(r,thoraxTarget,tgt);

  // Now build projection from the fitted thorax. Search Breast Size first.
  let best={score:Infinity,size:0,firm:.5,direct:{}};
  const evalState=()=>{const cur=this.current();return {cur,score:this.protectedObjective(cur,tgt)}};
  for(let size=0;size<=1.0001;size+=.10){
   this.engine.state.breastSize=Math.round(size*100)/100;this.engine.state.breastFirmness=.5;
   for(const c of controls)this.engine.directState[c.id]=0;
   await this.refreshLock(r);const q=evalState();
   if(q.score<best.score)best={score:q.score,size:this.engine.state.breastSize,firm:.5,direct:{},cur:q.cur};
  }
  this.engine.state.breastSize=best.size;this.engine.state.breastFirmness=best.firm;
  for(const c of controls)this.engine.directState[c.id]=best.direct[c.id]||0;
  await this.refreshLock(r);

  // Conservative local coordinate descent: only breast-group morphs, torso depth fixed.
  for(const step of [.18,.08,.04]){
   for(const c of controls){
    const curV=Number(this.engine.directState[c.id]||0);let local={v:curV,score:this.protectedObjective(this.current(),tgt)};
    for(const dir of [-1,1]){
     const v=Math.max(-1,Math.min(1,curV+dir*step));this.engine.directState[c.id]=v;await this.refreshLock(r);
     const score=this.protectedObjective(this.current(),tgt);
     if(score<local.score)local={v,score};
    }
    this.engine.directState[c.id]=local.v;await this.refreshLock(r);
   }
  }

  return {thoraxTarget,totalTarget,d8,breastSize:this.engine.state.breastSize,breastFirmness:this.engine.state.breastFirmness,state:this.current()};
 }
 async maleChestFit(r,tgt){
  const solver=this.calibration?.workflow?.solver;
  if(solver?.correct)await solver.correct(r);
  await this.refreshLock(r);
  const d8=await this.scanD8ToTarget(r,tgt.chestDepth,tgt);
  return {d8,state:this.current()};
 }
 async fitV324Person(r){
  await this.baseline(r);
  const tgt=this.target(r);
  if(r.gender===0)return {gender:'Frauen',...(await this.femaleChestDecomposedFit(r,tgt))};
  return {gender:'Männer',...(await this.maleChestFit(r,tgt))};
 }

 localBreastControls(){
  // Keep only local breast shape/projection controls. Exclude generic body/torso/hip controls.
  const allowed=/^(breast-(trans|dist|point|volume-vert))$/i,out=[];
  for(const group of this.engine.groups||[])for(const c of group.controls||[]){
   if(c?.id&&allowed.test(c.target||''))out.push(c);
  }
  return out;
 }
 async scoreFemaleLocalState(r,tgt,baselineProtected){
  const cur=this.current();
  const weights={chestDepth:8.0,chestBreadth:3.0,waistBreadth:2.0,waistDepth:2.0,hipBreadth:2.5,shoulder:1.5,torso:2.0,neckBase:1.5};
  let s=0,n=0;
  for(const [k,w] of Object.entries(weights)){
   if(!Number.isFinite(cur[k])||!Number.isFinite(tgt[k]))continue;
   const scale=Math.max(10,Math.abs(tgt[k])),e=(cur[k]-tgt[k])/scale;
   s+=w*e*e;n+=w;
  }
  // Strong guard against damaging already acceptable geometry.
  const guardLimits={chestBreadth:.35,waistBreadth:.30,waistDepth:.30,hipBreadth:.30,shoulder:.30,torso:.30,neckBase:.30};
  let guard=0;
  for(const [k,lim] of Object.entries(guardLimits)){
   if(!Number.isFinite(cur[k])||!Number.isFinite(baselineProtected[k]))continue;
   const d=Math.abs(cur[k]-baselineProtected[k]);
   if(d>lim)guard+=(d-lim)*(d-lim)*18;
  }
  return {score:n?(s+guard)/n:Infinity,cur};
 }
 async optimizeFemaleProjectionLocal(r,tgt,baselineProtected){
  const controls=this.localBreastControls();
  // Search Breast Size first, with firmness as a small secondary degree of freedom.
  let best={score:Infinity,size:this.engine.state.breastSize,firm:this.engine.state.breastFirmness,direct:{}};
  for(const size of [0,.15,.30,.45,.60,.75,.90,1.0]){
   for(const firm of [.25,.50,.75]){
    this.engine.state.breastSize=size;this.engine.state.breastFirmness=firm;
    for(const c of controls)this.engine.directState[c.id]=0;
    await this.refreshLock(r);
    const q=await this.scoreFemaleLocalState(r,tgt,baselineProtected);
    if(q.score<best.score)best={score:q.score,size,firm,direct:{},cur:q.cur};
   }
  }
  this.engine.state.breastSize=best.size;this.engine.state.breastFirmness=best.firm;
  for(const c of controls)this.engine.directState[c.id]=0;
  await this.refreshLock(r);

  // Coordinate descent ONLY across local breast controls.
  for(const step of [.25,.12,.06,.03]){
   for(const c of controls){
    const curV=Number(this.engine.directState[c.id]||0);
    let local={v:curV,...(await this.scoreFemaleLocalState(r,tgt,baselineProtected))};
    for(const dir of [-1,1]){
     const v=Math.max(-1,Math.min(1,curV+dir*step));
     this.engine.directState[c.id]=v;await this.refreshLock(r);
     const q=await this.scoreFemaleLocalState(r,tgt,baselineProtected);
     if(q.score<local.score)local={v,...q};
    }
    this.engine.directState[c.id]=local.v;await this.refreshLock(r);
   }
  }

  return {
   state:this.current(),
   breastSize:this.engine.state.breastSize,
   breastFirmness:this.engine.state.breastFirmness,
   local:Object.fromEntries(controls.map(c=>[c.target,Number(this.engine.directState[c.id]||0)]))
  };
 }
 async femaleV325Fit(r,tgt){
  const solver=this.calibration?.workflow?.solver;
  // Only the stable non-cross-section correction is allowed before the chest-specific fit.
  if(solver?.correct)await solver.correct(r);
  await this.refreshLock(r);

  const totalTarget=tgt.chestDepth;
  let thoraxTarget=this.predictMaleThorax(r);
  thoraxTarget=Math.min(totalTarget,Math.max(totalTarget*.58,thoraxTarget));

  // Neutralize breast projection while fitting torso depth.
  const breastControls=this.localBreastControls();
  this.engine.state.breastSize=0;this.engine.state.breastFirmness=.5;
  for(const c of breastControls)this.engine.directState[c.id]=0;
  await this.refreshLock(r);

  const d8=await this.scanD8ToTarget(r,thoraxTarget,tgt);
  // From here on d8 is frozen. This snapshot is the protected thorax/base geometry.
  const protectedBase=this.current();

  const local=await this.optimizeFemaleProjectionLocal(r,tgt,protectedBase);
  return {
   thoraxTarget,totalTarget,d8:d8?.value,
   breastSize:local.breastSize,breastFirmness:local.breastFirmness,
   local:local.local,state:this.current()
  };
 }
 async maleV325Fit(r,tgt){
  // Same conservative male path that already worked well in V3.24.
  const solver=this.calibration?.workflow?.solver;
  if(solver?.correct)await solver.correct(r);
  await this.refreshLock(r);
  const d8=await this.scanD8ToTarget(r,tgt.chestDepth,tgt);
  return {d8:d8?.value,state:this.current()};
 }
 async fitV325Person(r){
  await this.baseline(r);
  const tgt=this.target(r);
  return r.gender===0?{gender:'Frauen',...(await this.femaleV325Fit(r,tgt))}:{gender:'Männer',...(await this.maleV325Fit(r,tgt))};
 }
 async runV325Fit(){
  const rows=(this.batch?.rows||[]).filter(r=>role(r)==='validation'&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,100);
  if(rows.length<50){alert('Nicht genug Validation-Personen geladen.');return}
  const snap=this.engine.snapshot(),samples=[],before=[],after=[],femaleBefore=[],femaleAfter=[],maleBefore=[],maleAfter=[];
  const perBefore=Object.fromEntries(TARGETS.map(([k])=>[k,[]])),perAfter=Object.fromEntries(TARGETS.map(([k])=>[k,[]]));
  const sexChest={Frauen:{b:[],a:[]},Männer:{b:[],a:[]}},details=[];
  const prog=this.panel.querySelector('#fit25Progress');prog.classList.remove('hidden');this.panel.querySelector('#fit25Status').textContent='LÄUFT';this.abort=false;
  const thoraxModel=this.trainMaleThoraxModel();

  try{
   for(let i=0;i<rows.length;i++){
    if(this.abort)break;
    const t0=performance.now(),r=rows[i];
    await this.baseline(r);
    const bMesh=this.current(),bErr=[],gl=r.gender===0?'Frauen':'Männer',rawCD=this.auditRaw(r,'chestDepth');
    for(const [k] of TARGETS){
     const raw=this.auditRaw(r,k),mv=bMesh[k];
     if(Number.isFinite(raw)&&Number.isFinite(mv)){const e=Math.abs(mv-raw);perBefore[k].push(e);bErr.push(e)}
    }
    if(Number.isFinite(rawCD)&&Number.isFinite(bMesh.chestDepth))sexChest[gl].b.push(Math.abs(bMesh.chestDepth-rawCD));
    const bMae=bErr.length?bErr.reduce((s,v)=>s+v,0)/bErr.length:NaN;
    if(Number.isFinite(bMae)){before.push(bMae);(r.gender===0?femaleBefore:maleBefore).push(bMae)}

    const fit=await this.fitV325Person(r),aMesh=this.current(),aErr=[];
    for(const [k] of TARGETS){
     const raw=this.auditRaw(r,k),mv=aMesh[k];
     if(Number.isFinite(raw)&&Number.isFinite(mv)){const e=Math.abs(mv-raw);perAfter[k].push(e);aErr.push(e)}
    }
    if(Number.isFinite(rawCD)&&Number.isFinite(aMesh.chestDepth))sexChest[gl].a.push(Math.abs(aMesh.chestDepth-rawCD));
    const aMae=aErr.length?aErr.reduce((s,v)=>s+v,0)/aErr.length:NaN;
    if(Number.isFinite(aMae)){after.push(aMae);(r.gender===0?femaleAfter:maleAfter).push(aMae)}

    if(details.length<8&&r.gender===0){
     details.push({
      raw:rawCD,target:this.target(r).chestDepth,thorax:fit.thoraxTarget,mesh:aMesh.chestDepth,
      d8:fit.d8,size:fit.breastSize,local:fit.local
     });
    }

    const sec=(performance.now()-t0)/1000;
    if(sec>.01&&sec<300)samples.push(sec);if(samples.length>15)samples.shift();
    const done=i+1,pct=100*done/rows.length,med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
    this.panel.querySelector('#fit25Pct').textContent=pct.toFixed(0)+'%';
    this.panel.querySelector('#fit25Bar').style.width=pct+'%';
    this.panel.querySelector('#fit25Count').textContent=`${done} / ${rows.length}`;
    this.panel.querySelector('#fit25Eta').textContent=Number.isFinite(med)&&done>2?`ca. ${Math.max(0,Math.round(med*(rows.length-done)/60))} min verbleibend`:'Restzeit wird geschätzt …';
    await new Promise(q=>setTimeout(q,0));
   }

   const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN,fmt2=x=>Number.isFinite(x)?x.toFixed(2):'—';
   const B=mean(before),A=mean(after),cdB=mean(perBefore.chestDepth),cdA=mean(perAfter.chestDepth);
   const femB=mean(sexChest.Frauen.b),femA=mean(sexChest.Frauen.a),maleB=mean(sexChest.Männer.b),maleA=mean(sexChest.Männer.a);

   const protectedKeys=['chestBreadth','waistBreadth','waistDepth','hipBreadth','shoulder','torso','neckBase'];
   const regress=protectedKeys.filter(k=>{
    const b=mean(perBefore[k]),a=mean(perAfter[k]);
    return Number.isFinite(a)&&Number.isFinite(b)&&a>b+.25;
   });
   const good=Number.isFinite(A)&&A<B-.10&&Number.isFinite(femA)&&femA<femB-1.0&&Number.isFinite(maleA)&&maleA<=1.4&&regress.length<=1;

   const localFmt=o=>o?Object.entries(o).filter(([,v])=>Math.abs(v)>.01).map(([k,v])=>`${k} ${v>=0?'+':''}${fmt2(v)}`).join(' · '):'—';

   this.panel.querySelector('#fit25Result').innerHTML=
    `<div class="optimizerHero ${good?'hit':'miss'}"><small>V3.25 · ${after.length} PERSONEN · THORAX-MODELL n=${thoraxModel.n}</small><strong>${good?'BEREIT FÜR FINAL-HOLDOUT':'NOCH NICHT EINFRIEREN'}</strong><span>Gesamt-MAE ${fmt2(B)} → <b>${fmt2(A)} cm</b> · Brusttiefe ${fmt2(cdB)} → <b>${fmt2(cdA)} cm</b></span></div>
     <div class="batchMeasureMatrix"><b>Brusttiefe getrennt</b><span>Frauen: ${fmt2(femB)} → <strong>${fmt2(femA)} cm</strong></span><span>Männer: ${fmt2(maleB)} → <strong>${fmt2(maleA)} cm</strong></span></div>
     <div class="batchMeasureMatrix"><b>Gesamtfehler je Geschlecht</b><span>Frauen: ${fmt2(mean(femaleBefore))} → <strong>${fmt2(mean(femaleAfter))} cm</strong></span><span>Männer: ${fmt2(mean(maleBefore))} → <strong>${fmt2(mean(maleAfter))} cm</strong></span></div>
     <div class="batchMeasureMatrix"><b>Einzelmaße · MAE vorher → V3.25</b>${TARGETS.map(([k,label])=>`<span>${label}: ${fmt2(mean(perBefore[k]))} → <strong>${fmt2(mean(perAfter[k]))} cm</strong></span>`).join('')}</div>
     <div class="batchInfo"><b>Schutzprüfung</b><span>${regress.length?`Schlechter >0,25 cm: ${regress.join(', ')}`:'Alle geschützten Maße bleiben stabil.'}</span></div>
     <div class="batchMeasureMatrix"><b>8 Frauen-Beispiele · lokale Projektion</b>${details.map((x,i)=>`<span>F${i+1}: ANSUR ${fmt2(x.raw)} · Solver gesamt ${fmt2(x.target)} · Thorax ${fmt2(x.thorax)} · Mesh ${fmt2(x.mesh)} · d8 ${fmt2(x.d8)} · BreastSize ${fmt2(x.size)} · ${localFmt(x.local)}</span>`).join('')}</div>
     <div class="batchInfo"><b>Entscheidung</b><span>${good?'Als Nächstes nur noch Final-Holdout. Danach Solver + V3.25 einfrieren und Kalibrierung beenden.':'Kein neuer allgemeiner Trainingszyklus. Wir korrigieren nur noch den konkret ausgewiesenen Restengpass.'}</span></div>`;
   this.panel.querySelector('#fit25Status').textContent=this.abort?'PAUSIERT':'ERLEDIGT';
  }finally{
   this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics();
  }
 }

 async runV324Fit(){
  const rows=(this.batch?.rows||[]).filter(r=>role(r)==='validation'&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,100);
  if(rows.length<50){alert('Nicht genug Validation-Personen geladen.');return}
  const snap=this.engine.snapshot(),samples=[],before=[],after=[],femaleBefore=[],femaleAfter=[],maleBefore=[],maleAfter=[];
  const perBefore=Object.fromEntries(TARGETS.map(([k])=>[k,[]])),perAfter=Object.fromEntries(TARGETS.map(([k])=>[k,[]]));
  const sexChest={Frauen:{b:[],a:[]},Männer:{b:[],a:[]}},details=[];
  const prog=this.panel.querySelector('#fit24Progress');prog.classList.remove('hidden');this.panel.querySelector('#fit24Status').textContent='LÄUFT';this.abort=false;
  // train once from male TRAIN split only
  const thoraxModel=this.trainMaleThoraxModel();
  try{
   for(let i=0;i<rows.length;i++){
    if(this.abort)break;
    const t0=performance.now(),r=rows[i];
    await this.baseline(r);
    const bMesh=this.current(),bErr=[];
    for(const [k] of TARGETS){const raw=this.auditRaw(r,k),mv=bMesh[k];if(Number.isFinite(raw)&&Number.isFinite(mv)){const e=Math.abs(mv-raw);perBefore[k].push(e);bErr.push(e)}}
    const gl=r.gender===0?'Frauen':'Männer',rawCD=this.auditRaw(r,'chestDepth');
    if(Number.isFinite(rawCD)&&Number.isFinite(bMesh.chestDepth))sexChest[gl].b.push(Math.abs(bMesh.chestDepth-rawCD));
    const bMae=bErr.length?bErr.reduce((s,v)=>s+v,0)/bErr.length:NaN;
    if(Number.isFinite(bMae)){before.push(bMae);(r.gender===0?femaleBefore:maleBefore).push(bMae)}

    const fit=await this.fitV324Person(r),aMesh=this.current(),aErr=[];
    for(const [k] of TARGETS){const raw=this.auditRaw(r,k),mv=aMesh[k];if(Number.isFinite(raw)&&Number.isFinite(mv)){const e=Math.abs(mv-raw);perAfter[k].push(e);aErr.push(e)}}
    if(Number.isFinite(rawCD)&&Number.isFinite(aMesh.chestDepth))sexChest[gl].a.push(Math.abs(aMesh.chestDepth-rawCD));
    const aMae=aErr.length?aErr.reduce((s,v)=>s+v,0)/aErr.length:NaN;
    if(Number.isFinite(aMae)){after.push(aMae);(r.gender===0?femaleAfter:maleAfter).push(aMae)}
    if(details.length<8&&r.gender===0)details.push({raw:rawCD,target:this.target(r).chestDepth,thorax:fit.thoraxTarget,mesh:aMesh.chestDepth,size:fit.breastSize,d8:fit.d8?.value});

    const sec=(performance.now()-t0)/1000;if(sec>.01&&sec<300)samples.push(sec);if(samples.length>15)samples.shift();
    const done=i+1,pct=100*done/rows.length,med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
    this.panel.querySelector('#fit24Pct').textContent=pct.toFixed(0)+'%';this.panel.querySelector('#fit24Bar').style.width=pct+'%';this.panel.querySelector('#fit24Count').textContent=`${done} / ${rows.length}`;
    this.panel.querySelector('#fit24Eta').textContent=Number.isFinite(med)&&done>2?`ca. ${Math.max(0,Math.round(med*(rows.length-done)/60))} min verbleibend`:'Restzeit wird geschätzt …';
    await new Promise(q=>setTimeout(q,0));
   }
   const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN,fmt2=x=>Number.isFinite(x)?x.toFixed(2):'—';
   const B=mean(before),A=mean(after),cdB=mean(perBefore.chestDepth),cdA=mean(perAfter.chestDepth);
   const femB=mean(sexChest.Frauen.b),femA=mean(sexChest.Frauen.a),maleB=mean(sexChest.Männer.b),maleA=mean(sexChest.Männer.a);
   const protectOK=['waistBreadth','waistDepth','hipBreadth','shoulder','torso','neckBase'].filter(k=>Number.isFinite(mean(perBefore[k]))&&Number.isFinite(mean(perAfter[k]))&&mean(perAfter[k])>mean(perBefore[k])+.35);
   const good=Number.isFinite(A)&&A<B-.08&&Number.isFinite(cdA)&&cdA<cdB-.5&&protectOK.length<=1;
   this.panel.querySelector('#fit24Result').innerHTML=
    `<div class="optimizerHero ${good?'hit':'miss'}"><small>V3.24 · ${after.length} PERSONEN · THORAX-MODELL n=${thoraxModel.n}</small><strong>${good?'BEREIT FÜR FINAL-HOLDOUT':'NOCH NICHT EINFRIEREN'}</strong><span>Gesamt-MAE ${fmt2(B)} → <b>${fmt2(A)} cm</b> · Brusttiefe ${fmt2(cdB)} → <b>${fmt2(cdA)} cm</b></span></div>
     <div class="batchMeasureMatrix"><b>Brusttiefe getrennt</b><span>Frauen: ${fmt2(femB)} → <strong>${fmt2(femA)} cm</strong></span><span>Männer: ${fmt2(maleB)} → <strong>${fmt2(maleA)} cm</strong></span></div>
     <div class="batchMeasureMatrix"><b>Gesamtfehler je Geschlecht</b><span>Frauen: ${fmt2(mean(femaleBefore))} → <strong>${fmt2(mean(femaleAfter))} cm</strong></span><span>Männer: ${fmt2(mean(maleBefore))} → <strong>${fmt2(mean(maleAfter))} cm</strong></span></div>
     <div class="batchMeasureMatrix"><b>Einzelmaße · MAE vorher → V3.24</b>${TARGETS.map(([k,label])=>`<span>${label}: ${fmt2(mean(perBefore[k]))} → <strong>${fmt2(mean(perAfter[k]))} cm</strong></span>`).join('')}</div>
     <div class="batchInfo"><b>Schutzprüfung</b><span>${protectOK.length?`Deutlich schlechter (>0,35 cm): ${protectOK.join(', ')}`:'Keines der geschützten Maße wird deutlich verschlechtert.'}</span></div>
     <div class="batchMeasureMatrix"><b>8 Frauen-Beispiele · Zerlegung</b>${details.map((x,i)=>`<span>F${i+1}: ANSUR ${fmt2(x.raw)} · Solver gesamt ${fmt2(x.target)} · Thorax-Ziel ${fmt2(x.thorax)} · fertiges Mesh ${fmt2(x.mesh)} · d8 ${fmt2(x.d8)} · BreastSize ${fmt2(x.size)}</span>`).join('')}</div>
     <div class="batchInfo"><b>Entscheidung</b><span>${good?'Keine weitere Kalibrierungsrunde: als Nächstes nur noch Final-Holdout auf unangetasteten Personen und danach einfrieren.':'Nicht einfrieren. Wir ändern nur den konkret ausgewiesenen Engpass; kein neuer allgemeiner Trainingszyklus.'}</span></div>`;
   this.panel.querySelector('#fit24Status').textContent=this.abort?'PAUSIERT':'ERLEDIGT';
  }finally{this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics()}
 }

 async runV323Fit(){
  const rows=(this.batch?.rows||[]).filter(r=>role(r)==='validation'&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,100);
  if(rows.length<50){alert('Nicht genug Validation-Personen geladen.');return}
  const solver=this.calibration?.workflow?.solver;
  if(!solver?.finalCorrect||!solver?.scoreHarness){alert('V3.23 Mesh-Fitter ist nicht verfügbar.');return}
  const snap=this.engine.snapshot(),samples=[],before=[],after=[],femaleBefore=[],femaleAfter=[],maleBefore=[],maleAfter=[];
  const perBefore=Object.fromEntries(TARGETS.map(([k])=>[k,[]])),perAfter=Object.fromEntries(TARGETS.map(([k])=>[k,[]]));
  const prog=this.panel.querySelector('#fit23Progress');prog.classList.remove('hidden');this.panel.querySelector('#fit23Status').textContent='LÄUFT';this.abort=false;
  try{
   for(let i=0;i<rows.length;i++){
    if(this.abort)break;
    const t0=performance.now(),r=rows[i];
    await solver.baseline(r);
    // Aggregate directly from the measured mesh against the ANSUR aliases.
    // scoreHarness() only scores fields that exist under the solver's canonical row keys;
    // chestBreadth/chestDepth can be present under imported lowercase aliases, which made
    // those two result rows appear as dashes although the fitter itself had measured them.
    const bMesh=this.current(),bErr=[];
    for(const [k] of TARGETS){const raw=this.auditRaw(r,k),mv=bMesh[k];if(Number.isFinite(raw)&&Number.isFinite(mv)){const e=Math.abs(mv-raw);perBefore[k].push(e);bErr.push(e)}}
    const bMae=bErr.length?bErr.reduce((s,v)=>s+v,0)/bErr.length:NaN;
    if(Number.isFinite(bMae)){before.push(bMae);(r.gender===0?femaleBefore:maleBefore).push(bMae)}
    await solver.finalCorrect(r);
    const aMesh=this.current(),aErr=[];
    for(const [k] of TARGETS){const raw=this.auditRaw(r,k),mv=aMesh[k];if(Number.isFinite(raw)&&Number.isFinite(mv)){const e=Math.abs(mv-raw);perAfter[k].push(e);aErr.push(e)}}
    const aMae=aErr.length?aErr.reduce((s,v)=>s+v,0)/aErr.length:NaN;
    if(Number.isFinite(aMae)){after.push(aMae);(r.gender===0?femaleAfter:maleAfter).push(aMae)}
    const sec=(performance.now()-t0)/1000;if(sec>.01&&sec<300)samples.push(sec);if(samples.length>15)samples.shift();
    const done=i+1,pct=100*done/rows.length,med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
    this.panel.querySelector('#fit23Pct').textContent=pct.toFixed(0)+'%';this.panel.querySelector('#fit23Bar').style.width=pct+'%';this.panel.querySelector('#fit23Count').textContent=`${done} / ${rows.length}`;
    this.panel.querySelector('#fit23Eta').textContent=Number.isFinite(med)&&done>2?`ca. ${Math.max(0,Math.round(med*(rows.length-done)/60))} min verbleibend`:'Restzeit wird geschätzt …';
    await new Promise(q=>setTimeout(q,0));
   }
   const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN,fmt2=x=>Number.isFinite(x)?x.toFixed(2):'—';
   const B=mean(before),A=mean(after),impr=B-A,cdB=mean(perBefore.chestDepth),cdA=mean(perAfter.chestDepth);
   const good=Number.isFinite(A)&&Number.isFinite(B)&&A<B&&Number.isFinite(cdA)&&cdA<cdB;
   this.panel.querySelector('#fit23Result').innerHTML=`<div class="optimizerHero ${good?'hit':'miss'}"><small>V3.23 · ${after.length} PERSONEN</small><strong>${good?'KORREKTUR WIRKT':'NOCH NICHT ÜBERNEHMEN'}</strong><span>Gesamt-MAE ${fmt2(B)} → <b>${fmt2(A)} cm</b> · Verbesserung ${fmt2(impr)} cm</span></div>
    <div class="batchMeasureMatrix"><b>Geschlecht</b><span>Frauen: ${fmt2(mean(femaleBefore))} → <strong>${fmt2(mean(femaleAfter))} cm</strong></span><span>Männer: ${fmt2(mean(maleBefore))} → <strong>${fmt2(mean(maleAfter))} cm</strong></span></div>
    <div class="batchMeasureMatrix"><b>Einzelmaße · MAE vorher → V3.23</b>${TARGETS.map(([k,label])=>`<span>${label}: ${fmt2(mean(perBefore[k]))} → <strong>${fmt2(mean(perAfter[k]))} cm</strong></span>`).join('')}</div>
    <div class="batchInfo"><b>Entscheidung</b><span>${good?'Wenn insbesondere Brusttiefe deutlich fällt und die übrigen Maße stabil bleiben, folgt nur noch der unangetastete Final-Holdout.':'Noch nicht einfrieren. Das Ergebnis zeigt dann konkret, welches Maß durch die Korrektur schlechter wird.'}</span></div>`;
   this.panel.querySelector('#fit23Status').textContent=this.abort?'PAUSIERT':'ERLEDIGT';
  }finally{this.engine.restore(snap);this.ui.sync();this.engine.computeMetrics()}
 }
 render(r){const p=this.panel;const morphOK=r.morphWorks===r.n&&r.n>0;const staleBug=r.stale>0;let verdict;if(!morphOK)verdict='<b>FEHLER A: Morph → Mesh</b><span>Mindestens ein getesteter Rumpf-Morph verändert das Mesh bzw. die Messung nicht zuverlässig.</span>';else if(staleBug)verdict='<b>FEHLER B GEFUNDEN: Verriegelung lässt Mesh veraltet</b><span>solveDirect ändert Reglerwerte, aber das Mesh wird nach dem letzten Solver-Schritt nicht erneut aufgebaut. Dadurch bewertet V3.21 teilweise einen anderen Mesh-Zustand als in directState gespeichert ist.</span>';else verdict='<b>Technische Kette funktioniert</b><span>Morphs verändern Mesh und Maße, und die Verriegelung hinterlässt keinen veralteten Mesh-Zustand. Dann suchen wir als Nächstes in der Optimierungslogik.</span>';p.querySelector('#mdSummary').innerHTML=`<div class="optimizerHero ${morphOK&&!staleBug?'hit':'miss'}"><small>DIAGNOSE · ${r.n} PERSONEN</small><strong>${staleBug?'BUG GEFUNDEN':morphOK?'KETTE OK':'BUG GEFUNDEN'}</strong><span>Morph→Mesh wirksam: ${r.morphWorks}/${r.n} · Relock-State geändert: ${r.stateChanges}/${r.n} · veraltetes Mesh nach Relock: ${r.stale}/${r.n}</span></div><div class="batchInfo">${verdict}</div>`;p.querySelector('#mdDetails').innerHTML=r.people.map(x=>x.problem?`<div class="batchInfo"><b>Person ${x.index}</b><span>${x.problem}</span></div>`:`<div class="batchMeasureMatrix"><b>Person ${x.index} · ${x.morph}</b><span>Morph: ${fmt(x.morphFrom)} → ${fmt(x.morphTo)}</span><span>stärkste Maßänderung: ${x.morphMeasureKey||'—'} · ${fmt(x.morphMeasureDelta)} cm</span><span>Meshänderung durch Morph: ${fmt(x.morphMeshDelta)}</span><span>Relock änderte Regler: ${x.relockStateChanged?'JA':'nein'}</span><span>Mesh nach Relock veraltet: <strong>${x.staleAfterRelock?'JA':'nein'}</strong></span><span>Messdifferenz vor/nach erzwungenem Mesh-Update: ${fmt(x.immediateVsUpdatedMeasure)} cm</span></div>`).join('');p.querySelector('#mdStatus').textContent='ERLEDIGT';p.querySelector('#mdNext').textContent=(morphOK&&!staleBug)?'BEREIT':'GESPERRT';p.querySelector('#mdNextText').innerHTML=staleBug?'<b>Nächster Fix ist eindeutig.</b><span>Wir korrigieren zuerst die Solver-/Mesh-Synchronisation. Noch keinen 100-Personen-Test starten.</span>':morphOK?'<b>Kein Synchronisationsfehler gefunden.</b><span>Dann untersuchen wir als Nächstes die Zielfunktion und Morph-Auswahl — weiterhin ohne großen Batch.</span>':'<b>Morph-Pipeline reparieren.</b><span>Noch keinen großen Batch starten.</span>'}
}
