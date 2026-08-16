import {V310_CALIBRATION as CAL} from "./v310-calibration-profile.js";

const STORE_KEY="bodylab_final_calibration_v320";
const SEEN_HOLDOUT_COUNT=50;

function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function mae(a){return a.length?mean(a.map(Math.abs)):NaN}
function pctl(a,p){if(!a.length)return NaN;const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return x[l]+(x[h]-x[l])*(i-l)}
function fmt(x){return Number.isFinite(x)?x.toFixed(2):"—"}
function hashRow(r){
 const s=String(r.sourceRow??"");let h=0;
 for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
 return h>>>0;
}
function splitRole(r){
 const m=hashRow(r)%100;
 // Existing deterministic V3.11 training concept is preserved where possible,
 // but the final workflow is explicit:
 // 0..69 train, 70..84 validation, 85..99 final.
 if(m<70)return "train";
 if(m<85)return "validation";
 return "final";
}
function features(r){
 const h=+r.height,w=+r.weight,c=+r.chest,wa=+r.waist,hip=+r.hip,g=+r.gender;
 if(![h,w,c,wa,hip,g].every(Number.isFinite))return null;
 const bmi=w/((h/100)**2);
 return [1,g,h,w,bmi,c,wa,hip,c-wa,hip-wa,c/Math.max(1,h),wa/Math.max(1,h),hip/Math.max(1,h)];
}
function solveLinear(A,b){
 const n=A.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let c=0;c<n;c++){
  let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
  if(Math.abs(M[p][c])<1e-10)return null;
  [M[c],M[p]]=[M[p],M[c]];
  const q=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=q;
  for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j]}
 }
 return M.map(r=>r[n]);
}
function ridgeFit(rows,key,lambda=2){
 const pairs=[];
 for(const r of rows){const x=features(r),y=+r[key];if(x&&Number.isFinite(y))pairs.push({x,y})}
 if(pairs.length<30)return null;
 const p=pairs[0].x.length,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(const q of pairs)for(let i=0;i<p;i++){b[i]+=q.x[i]*q.y;for(let j=0;j<p;j++)A[i][j]+=q.x[i]*q.x[j]}
 for(let i=1;i<p;i++)A[i][i]+=lambda;
 const beta=solveLinear(A,b);return beta?{beta,n:pairs.length}:null;
}
function predict(beta,r){const x=features(r);return x?x.reduce((s,v,i)=>s+v*beta[i],0):NaN}

const TARGETS=["shoulder","torso","chestBreadth","chestDepth","waistBreadth","waistDepth","hipBreadth","neckBase"];

export class FinalCalibrationWorkflowV320{
 constructor(engine,ui,lab,batch,solver){
  this.engine=engine;this.ui=ui;this.lab=lab;this.batch=batch;this.solver=solver;
  this.panel=document.getElementById("calibrationPanel");this.state=this.load();
  this.abort=false;this.render();this.bind();this.sync();
 }
 load(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"{}")}catch(e){return {}}}
 save(){localStorage.setItem(STORE_KEY,JSON.stringify(this.state))}
 rows(){return (this.batch?.rows||[]).filter(r=>features(r))}
 split(){
  const all=this.rows(),train=[],validation=[],final=[];
  for(const r of all){const role=splitRole(r);(role==="train"?train:role==="validation"?validation:final).push(r)}
  // User has already inspected 50 people from the former holdout.
  // Conservatively remove the first 50 rows of the new final pool from final eligibility.
  const seen=final.slice(0,Math.min(SEEN_HOLDOUT_COUNT,final.length));
  return {all,train,validation,final:final.slice(seen.length),seen};
 }
 render(){
  this.panel.innerHTML=`
   <div class="generatorHead">
    <div><strong>BODY LAB · FINAL CALIBRATION</strong><small>V3.20.1 · echter Mesh-Finaltest</small></div>
    <button id="fcClose">Schließen</button>
   </div>
   <div class="generatorIntro">
    Nur noch fünf Schritte. Kein Legacy-Tuning, keine alten Solver-Experimente.
    <b>Training</b> darf lernen, <b>Validation</b> darf korrigieren, <b>Final Test</b> darf nur noch prüfen.
   </div>

   <section class="fcStep" data-step="1">
    <div class="fcStepHead"><span>1</span><div><b>Datensatz festschreiben</b><small>Train / Validation / Final sauber trennen</small></div><strong id="fcS1">OFFEN</strong></div>
    <div id="fcSplitInfo" class="batchInfo">Noch nicht vorbereitet.</div>
    <div class="generatorActions"><button id="fcPrepare" class="primary">Split vorbereiten</button></div>
   </section>

   <section class="fcStep" data-step="2">
    <div class="fcStepHead"><span>2</span><div><b>Trainieren</b><small>Aus Core‑5 die versteckte Körpergeometrie lernen</small></div><strong id="fcS2">GESPERRT</strong></div>
    <div class="generatorIntro compact">Der Solver lernt ausschließlich auf dem Trainingssplit. Zielwerte sind die bekannten ANSUR-Maße, die der spätere Nutzer nicht eingibt.</div>
    <div class="generatorActions"><button id="fcTrain" class="primary" disabled>Training starten</button></div>
    <div id="fcTrainResult" class="calResults"></div>
   </section>

   <section class="fcStep" data-step="3">
    <div class="fcStepHead"><span>3</span><div><b>Validation & Restkalibrierung</b><small>Systematische Restfehler einmalig korrigieren</small></div><strong id="fcS3">GESPERRT</strong></div>
    <div class="generatorIntro compact">Hier dürfen wir noch lernen: pro Zielmaß wird geprüft, ob ein einfacher additiver Bias auf unbekannten Validation-Personen stabil hilft.</div>
    <div class="generatorActions"><button id="fcValidate" class="primary" disabled>Validation analysieren</button></div>
    <div id="fcValidationResult" class="calResults"></div>
   </section>

   <section class="fcStep" data-step="4">
    <div class="fcStepHead"><span>4</span><div><b>Solver einfrieren</b><small>Ab hier keine Anpassung mehr</small></div><strong id="fcS4">GESPERRT</strong></div>
    <div class="generatorActions"><button id="fcFreeze" class="primary" disabled>Finalen Solver einfrieren</button></div>
    <div id="fcFreezeInfo" class="batchInfo">Noch nicht eingefroren.</div>
   </section>

   <section class="fcStep" data-step="5">
    <div class="fcStepHead"><span>5</span><div><b>Final Test</b><small>Einmalig auf wirklich ungesehenen Personen</small></div><strong id="fcS5">GESPERRT</strong></div>
    <div class="generatorIntro compact">Dieser Schritt verändert nichts mehr. Jede ungesehene Person wird vollständig als 3D-Mesh rekonstruiert; anschließend werden die tatsächlichen Mesh-Maße gegen ANSUR geprüft. Fortschritt wird gespeichert und kann fortgesetzt werden.</div>
    <div class="generatorActions"><button id="fcFinal" class="primary" disabled>Final Test starten</button><button id="fcPause">Pausieren</button></div>
    <div id="fcProgress" class="batchProgressRich hidden">
     <div class="batchProgressTop"><b id="fcProgressTitle">Final Test</b><span id="fcProgressPct">0%</span></div>
     <div class="batchProgressTrack"><div id="fcProgressBar"></div></div>
     <div class="batchProgressMeta"><span id="fcProgressCount">0 / 0</span><span id="fcProgressEta">Restzeit wird geschätzt …</span></div>
    </div>
    <div id="fcFinalResult" class="calResults"></div>
   </section>

   <div class="fcReset"><button id="fcReset">Workflow zurücksetzen</button></div>
  `;
 }
 bind(){
  this.panel.querySelector("#fcClose").onclick=()=>this.panel.classList.add("hidden");
  this.panel.querySelector("#fcPrepare").onclick=()=>this.prepare();
  this.panel.querySelector("#fcTrain").onclick=()=>this.train();
  this.panel.querySelector("#fcValidate").onclick=()=>this.validate();
  this.panel.querySelector("#fcFreeze").onclick=()=>this.freeze();
  this.panel.querySelector("#fcFinal").onclick=()=>this.finalTest();
  this.panel.querySelector("#fcPause").onclick=()=>{this.abort=true};
  this.panel.querySelector("#fcReset").onclick=()=>{if(confirm("Final-Calibration-Workflow wirklich zurücksetzen?")){this.state={};this.save();this.sync()}};
 }
 sync(){
  const st=this.state;
  const set=(id,text,ok)=>{const el=this.panel.querySelector(id);if(el){el.textContent=text;el.classList.toggle("ok",!!ok)}};
  set("#fcS1",st.prepared?"ERLEDIGT":"OFFEN",st.prepared);
  set("#fcS2",st.trained?"ERLEDIGT":st.prepared?"BEREIT":"GESPERRT",st.trained);
  set("#fcS3",st.validated?"ERLEDIGT":st.trained?"BEREIT":"GESPERRT",st.validated);
  set("#fcS4",st.frozen?"EINGEFROREN":st.validated?"BEREIT":"GESPERRT",st.frozen);
  set("#fcS5",st.finalResult?"ERLEDIGT":st.frozen?"BEREIT":"GESPERRT",!!st.finalResult);

  this.panel.querySelector("#fcTrain").disabled=!st.prepared||st.frozen;
  this.panel.querySelector("#fcValidate").disabled=!st.trained||st.frozen;
  this.panel.querySelector("#fcFreeze").disabled=!st.validated||st.frozen;
  this.panel.querySelector("#fcFinal").disabled=!st.frozen;

  if(st.split){
   this.panel.querySelector("#fcSplitInfo").innerHTML=`<b>${st.split.total} Personen festgeschrieben</b><span>Training ${st.split.train} · Validation ${st.split.validation} · Final ${st.split.final} · bereits gesehen/ausgeschlossen ${st.split.seen}</span>`;
  }
  if(st.trainingSummary)this.renderTraining(st.trainingSummary);
  if(st.validationSummary)this.renderValidation(st.validationSummary);
  if(st.frozen){
   this.panel.querySelector("#fcFreezeInfo").innerHTML=`<b>Solver eingefroren</b><span>${st.frozenAt} · Training und Restkalibrierung sind gesperrt.</span>`;
  }
  if(st.finalResult)this.renderFinal(st.finalResult);
 }
 prepare(){
  const x=this.split();
  if(x.all.length<500){alert("Zu wenige verwertbare Personen geladen.");return}
  this.state.prepared=true;
  this.state.split={total:x.all.length,train:x.train.length,validation:x.validation.length,final:x.final.length,seen:x.seen.length};
  this.state.preparedAt=new Date().toISOString();
  this.state.trained=false;this.state.validated=false;this.state.frozen=false;delete this.state.finalResult;
  this.save();this.sync();
 }
 train(){
  const {train}=this.split(),targets={};
  for(const k of TARGETS){
   const f=ridgeFit(train,k);
   if(!f)continue;
   const errs=[];
   for(const r of train){const y=+r[k],p=predict(f.beta,r);if(Number.isFinite(y)&&Number.isFinite(p))errs.push(p-y)}
   targets[k]={beta:f.beta,n:f.n,trainMAE:mae(errs),trainBias:mean(errs)};
  }
  this.state.model={features:["1","gender","height","weight","BMI","chest","waist","hip","chest-waist","hip-waist","chest/height","waist/height","hip/height"],targets};
  this.state.trainingSummary=Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,{n:v.n,mae:v.trainMAE,bias:v.trainBias}]));
  this.state.trained=true;this.state.trainedAt=new Date().toISOString();
  this.state.validated=false;this.state.frozen=false;delete this.state.finalResult;
  this.save();this.sync();
 }
 renderTraining(x){
  const box=this.panel.querySelector("#fcTrainResult");
  box.innerHTML=`<div class="calTable calHead"><span>Ziel</span><span>n</span><span>MAE</span><span>Bias</span></div>`+
   Object.entries(x).map(([k,v])=>`<div class="calTable"><span><b>${k}</b></span><span>${v.n}</span><span>${fmt(v.mae)}</span><span>${fmt(v.bias)}</span></div>`).join("");
 }
 validate(){
  const {validation}=this.split(),model=this.state.model;if(!model)return;
  const summary={},corrections={};
  for(const [k,m] of Object.entries(model.targets)){
   const errs=[];
   for(const r of validation){const y=+r[k],p=predict(m.beta,r);if(Number.isFinite(y)&&Number.isFinite(p))errs.push(p-y)}
   const bias=mean(errs),raw=mae(errs);
   // One conservative correction only: remove 80% of stable additive validation bias.
   const corr=Number.isFinite(bias)?-0.8*bias:0;
   const corrected=mae(errs.map(e=>e+corr));
   corrections[k]={offset:corr,rawMAE:raw,correctedMAE:corrected,bias};
   summary[k]={n:errs.length,raw,corrected,bias,offset:corr};
  }
  this.state.corrections=corrections;this.state.validationSummary=summary;
  this.state.validated=true;this.state.validatedAt=new Date().toISOString();this.state.frozen=false;delete this.state.finalResult;
  this.save();this.sync();
 }
 renderValidation(x){
  const box=this.panel.querySelector("#fcValidationResult");
  box.innerHTML=`<div class="calTable calHead"><span>Ziel</span><span>Raw</span><span>Kal.</span><span>Offset</span></div>`+
   Object.entries(x).map(([k,v])=>`<div class="calTable"><span><b>${k}</b><small>n=${v.n}</small></span><span>${fmt(v.raw)}</span><span>${fmt(v.corrected)}</span><span>${v.offset>=0?"+":""}${fmt(v.offset)}</span></div>`).join("");
 }
 freeze(){
  if(!this.state.validated)return;
  this.state.frozen=true;this.state.frozenAt=new Date().toISOString();
  this.state.frozenModel=JSON.parse(JSON.stringify({model:this.state.model,corrections:this.state.corrections,split:this.state.split}));
  this.save();this.sync();
 }
 correctedPrediction(r,k){
  const f=this.state.frozenModel?.model?.targets?.[k];if(!f)return NaN;
  const p=predict(f.beta,r),off=this.state.frozenModel?.corrections?.[k]?.offset||0;
  return p+off;
 }
 time(sec){if(!Number.isFinite(sec))return "wird geschätzt …";sec=Math.round(sec);if(sec<60)return `${sec}s`;const m=Math.floor(sec/60),s=sec%60;if(m<60)return `${m}:${String(s).padStart(2,"0")} min`;return `${Math.floor(m/60)}h ${m%60}m`}
 progress(done,total,start,samples){
  const pct=100*done/Math.max(1,total),med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
  this.panel.querySelector("#fcProgressPct").textContent=`${pct.toFixed(1)}%`;
  this.panel.querySelector("#fcProgressBar").style.width=`${pct.toFixed(1)}%`;
  this.panel.querySelector("#fcProgressCount").textContent=`${done} / ${total}`;
  this.panel.querySelector("#fcProgressEta").textContent=done>=3?`ca. ${this.time(med*(total-done))} verbleibend`:"Restzeit wird geschätzt …";
 }
 async finalTest(){
  const {final}=this.split();if(!this.state.frozen||!final.length||!this.solver)return;
  const prog=this.panel.querySelector("#fcProgress");prog.classList.remove("hidden");
  this.panel.querySelector("#fcProgressTitle").textContent="Finaler Mesh-Test";
  const cp=this.state.meshFinalCheckpoint||{next:0,errs:Object.fromEntries(TARGETS.map(k=>[k,[]])),female:[],male:[],elapsed:0};
  // A result from V3.20's instant regression-only test is deliberately invalidated.
  if(this.state.finalResult&&!this.state.finalResult.meshBased)delete this.state.finalResult;
  const start=performance.now(),samples=[];this.abort=false;
  for(const k of TARGETS)if(!Array.isArray(cp.errs[k]))cp.errs[k]=[];

  // Use exactly the frozen hidden-target model from step 4, never retrain on final data.
  const oldModel=this.solver.model;
  this.solver.model=JSON.parse(JSON.stringify(this.state.frozenModel.model));
  try{
   for(let i=cp.next;i<final.length;i++){
    if(this.abort){
     cp.elapsed+=(performance.now()-start)/1000;this.state.meshFinalCheckpoint=cp;this.save();
     this.panel.querySelector("#fcProgressTitle").textContent="Finaler Mesh-Test pausiert";return;
    }
    const t0=performance.now(),r=final[i];
    // Full production path: Core-5 -> real MakeHuman mesh -> morph correction -> cross-section optimization.
    await this.solver.baseline(r);
    await this.solver.finalCorrect(r);
    const cur=this.solver.current(),person=[];
    for(const k of TARGETS){
     const y=+r[k],mesh=+cur[k];
     if(!Number.isFinite(y)||!Number.isFinite(mesh))continue;
     // Mesh metrics use the previously validated mesh->ANSUR measurement mapping.
     const c=CAL[k],pred=c?c.scale*mesh+c.offset:mesh;
     if(!Number.isFinite(pred))continue;
     const e=Math.abs(pred-y);cp.errs[k].push(e);person.push(e);
    }
    const pm=mean(person);if(Number.isFinite(pm))(r.gender===0?cp.female:cp.male).push(pm);
    cp.next=i+1;
    const sec=(performance.now()-t0)/1000;if(sec>.01&&sec<300)samples.push(sec);if(samples.length>30)samples.shift();
    this.progress(cp.next,final.length,start,samples);
    // Durable checkpoint after every person: safe on iOS reload/background suspension.
    this.state.meshFinalCheckpoint=cp;this.save();
    await new Promise(q=>setTimeout(q,0));
   }
  }finally{this.solver.model=oldModel}

  cp.elapsed+=(performance.now()-start)/1000;
  const flat=Object.values(cp.errs).flat(),result={
   n:final.length,mae:mean(flat),p90:pctl(flat,.9),female:mean(cp.female),male:mean(cp.male),meshBased:true,
   per:Object.fromEntries(Object.entries(cp.errs).map(([k,v])=>[k,{mae:mean(v),p90:pctl(v,.9),n:v.length}])),
   finishedAt:new Date().toISOString(),elapsed:cp.elapsed
  };
  this.state.finalResult=result;this.state.finalTested=true;delete this.state.meshFinalCheckpoint;this.save();this.sync();
  this.panel.querySelector("#fcProgressTitle").textContent="Finaler Mesh-Test abgeschlossen";
  this.panel.querySelector("#fcProgressEta").textContent=`Fertig in ${this.time(cp.elapsed)}`;
 }

 renderFinal(r){
  const box=this.panel.querySelector("#fcFinalResult");
  box.innerHTML=`<div class="optimizerHero hit"><small>FINALER MESH-TEST · ${r.n} UNGESEHENE PERSONEN</small><strong>${fmt(r.mae)} cm</strong><span>P90 ${fmt(r.p90)} cm · Frauen ${fmt(r.female)} · Männer ${fmt(r.male)} cm</span><b>Solver eingefroren · keine weitere Kalibrierung</b></div>
   <div class="batchMeasureMatrix"><b>Einzelmaße</b>${Object.entries(r.per).map(([k,v])=>`<span>${k}: <strong>${fmt(v.mae)} cm</strong> · P90 ${fmt(v.p90)} · n=${v.n}</span>`).join("")}</div>`;
 }
}
