
const PROFILE_KEY="bodylab_v360_measurement_calibration";
const SENS_KEY="bodylab_v360_sensitivity";

const METRICS=[
 {key:"chest",label:"Brustumfang",group:"Torso",input:"chest"},
 {key:"waist",label:"Taillenumfang",group:"Torso",input:"waist"},
 {key:"torso",label:"Schulter→Schritt",group:"Torso",input:"torso"},
 {key:"hip",label:"Hüft-/Gesäßumfang",group:"Torso",input:"hip"},
 {key:"shoulder",label:"Schulterbreite",group:"Torso",input:"shoulder"},
 {key:"neck",label:"Halsumfang",group:"Whole Body"},
 {key:"wrist",label:"Handgelenkumfang",group:"Whole Body"},
 {key:"thigh",label:"Oberschenkelumfang",group:"Whole Body"},
 {key:"calf",label:"Wadenumfang",group:"Whole Body"},
 {key:"ankle",label:"Knöchelumfang",group:"Whole Body"},
 {key:"chestBreadth",label:"Brustbreite",group:"Harness Blind"},
 {key:"chestDepth",label:"Brusttiefe",group:"Harness Blind"},
 {key:"waistBreadth",label:"Taillenbreite",group:"Harness Blind"},
 {key:"waistDepth",label:"Taillentiefe",group:"Harness Blind"},
 {key:"hipBreadth",label:"Hüftbreite",group:"Harness Blind"},
 {key:"waistBackLength",label:"Rückenlänge bis Taille",group:"Harness Blind"},
 {key:"neckBase",label:"Halsumfang Basis",group:"Harness Blind"},
 {key:"upperarmCirc",label:"Oberarmumfang",group:"Calibration Extra"},
 {key:"upperarmLength",label:"Oberarmlänge",group:"Calibration Extra"},
 {key:"lowerarmLength",label:"Unterarmlänge",group:"Calibration Extra"},
 {key:"lowerlegHeight",label:"Unterschenkelhöhe",group:"Calibration Extra"},
 {key:"upperlegHeight",label:"Oberschenkelhöhe",group:"Calibration Extra"}
];

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function mae(a){return a.length?mean(a.map(Math.abs)):NaN}
function rmse(a){return a.length?Math.sqrt(mean(a.map(x=>x*x))):NaN}
function pct(a,p){if(!a.length)return NaN;const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return x[l]+(x[h]-x[l])*(i-l)}
function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function linfit(pairs){
 if(pairs.length<3)return null;
 const xs=pairs.map(x=>x.mesh),ys=pairs.map(x=>x.ref),mx=mean(xs),my=mean(ys);
 let cov=0,vx=0;for(let i=0;i<xs.length;i++){cov+=(xs[i]-mx)*(ys[i]-my);vx+=(xs[i]-mx)**2}
 if(Math.abs(vx)<1e-12)return null;
 const a=cov/vx,b=my-a*mx;
 const pred=xs.map(x=>a*x+b);
 const ssr=ys.reduce((s,y,i)=>s+(y-pred[i])**2,0),sst=ys.reduce((s,y)=>s+(y-my)**2,0);
 return {a,b,r2:sst>0?1-ssr/sst:0};
}
function splitPairs(pairs){
 // deterministic 70/30 split by subject identity; all scenarios for a subject stay in one side.
 const train=[],test=[];
 for(const p of pairs){
  const s=String(p.row??"");
  let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  ((h%10)<7?train:test).push(p);
 }
 return {train,test};
}

export class CalibrationLab{
 constructor(engine,ui,batchLab,solverV37){
  this.engine=engine;this.ui=ui;this.batch=batchLab;this.solverV37=solverV37;
  this.panel=document.getElementById("calibrationPanel");
  this.button=document.getElementById("calibrationToggle");
  this.calibration=null;this.sensitivity=null;this.abort=false;
  this.render();this.bind();
 }
 bind(){this.button.disabled=false;this.button.onclick=()=>{this.panel.classList.remove("hidden");this.refreshStatus()}}
 render(){
  this.panel.innerHTML=`
   <div class="generatorHead"><div><strong>BODY LAB · CALIBRATION LAB</strong><small>V3.6 · ANSUR↔MakeHuman + Morph-Sensitivity</small></div><button id="calClose">Schließen</button></div>
   <div class="generatorIntro">
    V3.6 trennt <b>Messdefinition</b> und <b>Morph-Wirkung</b>. Die Kalibrierung nutzt den letzten Batch-Report,
    fitttet lineare ANSUR↔Mesh-Korrekturen auf 70% der Personen und bewertet sie auf den übrigen 30%.
   </div>

   <div class="generatorSectionTitle">A · MEASUREMENT CALIBRATION</div>
   <div id="calStatus" class="batchInfo"></div>
   <div class="generatorActions">
    <button id="calRun" class="primary">Letzten Batch kalibrieren</button>
    <button id="calActivate" disabled>Profil aktiv markieren</button>
    <button id="calExport" disabled>Kalibrierung exportieren</button>
   </div>
   <div id="calResults" class="calResults"></div>

   <div class="generatorSectionTitle">B · V3.7 CALIBRATED CORE-5 SOLVER</div>
   <div class="generatorIntro compact">
    Lernt aus den aktuell geladenen ANSUR-Personen die zu Core‑5 passenden Rumpfbreiten/-tiefen.
    Danach korrigiert eine kleine, aus der V3.6-Sensitivity ausgewählte Morph-Gruppe die Körperform,
    während Brust, Taille und Hüfte als harte Tape-Maße nach jedem Schritt wieder verriegelt werden.
   </div>
   <div class="generatorActions">
    <button id="v37Train" class="primary">Core‑5 Modell trainieren</button>
    <button id="v37AB" disabled>Baseline vs. V3.7 testen</button>
   </div>
   <div id="v37Results" class="calResults"></div>

   <div class="generatorSectionTitle">C · MORPH SENSITIVITY MATRIX</div>
   <div class="generatorIntro compact">
    Jeder Body-Regler wird auf einer weiblichen und einer männlichen Standardbasis kurz perturbiert.
    Gemessen wird, welche realen Körperdimensionen sich dabei tatsächlich verändern. Face-Regler werden bewusst ausgelassen.
   </div>
   <div class="generatorGrid">
    <label>Testschritt
     <select id="sensStep"><option value=".05">5%</option><option value=".1" selected>10%</option><option value=".2">20%</option></select>
    </label>
    <label>Anzeige
     <select id="sensShow"><option value="30" selected>Top 30 Regler</option><option value="60">Top 60</option><option value="999">Alle</option></select>
    </label>
   </div>
   <div class="generatorActions">
    <button id="sensRun" class="primary">Alle Body-Regler analysieren</button>
    <button id="sensAbort" disabled>Abbrechen</button>
    <button id="sensExport" disabled>Matrix exportieren</button>
   </div>
   <div id="sensProgress" class="generatorProgress hidden"></div>
   <div id="sensResults" class="calResults"></div>
  `;
  this.panel.querySelector("#calClose").onclick=()=>this.panel.classList.add("hidden");
  this.panel.querySelector("#calRun").onclick=()=>this.runCalibration();
  this.panel.querySelector("#calActivate").onclick=()=>this.activateCalibration();
  this.panel.querySelector("#calExport").onclick=()=>this.calibration&&download("BodyLab-v3.6-Measurement-Calibration.json",this.calibration);
  this.panel.querySelector("#v37Train").onclick=()=>this.trainV37();
  this.panel.querySelector("#v37AB").onclick=()=>this.testV37();
  this.panel.querySelector("#sensRun").onclick=()=>this.runSensitivity();
  this.panel.querySelector("#sensAbort").onclick=()=>{this.abort=true};
  this.panel.querySelector("#sensExport").onclick=()=>this.sensitivity&&download("BodyLab-v3.6-Morph-Sensitivity.json",this.sensitivity);
  this.panel.querySelector("#sensShow").onchange=()=>this.renderSensitivity();
 }
 refreshStatus(){
  const r=this.batch?.results,box=this.panel.querySelector("#calStatus");
  if(!r){box.innerHTML="<b>Kein Batch-Report im Speicher.</b><span>Im Batch Lab zuerst einen ANSUR-Lauf durchführen.</span>";return}
  box.innerHTML=`<b>${esc(r.build||"Batch")} · ${r.sourceRows||0} Personen · ${r.scenarioCount||0} Szenarien</b><span>Rohdatensätze: ${r.raw?.length||0}. Für Zielmaße werden nur Szenarien verwendet, in denen das betreffende Maß nicht als Solver-Input diente.</span>`;
 }
 collectPairs(metric){
  const raw=this.batch?.results?.raw||[],bySubject=new Map();
  for(const rec of raw){
   if(metric.input && rec.inputs?.includes(metric.input))continue;
   const ref=Number(rec.reference?.[metric.key]),mesh=Number(rec.mesh?.[metric.key]);
   if(!Number.isFinite(ref)||!Number.isFinite(mesh)||ref<=0||mesh<=0)continue;
   const row=rec.row??rec.reference?.sourceRow;
   const key=String(row);
   // A subject appears in many questionnaire scenarios. Keep the first valid holdout occurrence
   // so one person cannot dominate the regression simply because 32 scenarios were tested.
   if(!bySubject.has(key))bySubject.set(key,{row,ref,mesh,sex:rec.sourceSex});
  }
  return [...bySubject.values()];
 }
 runCalibration(){
  if(!this.batch?.results?.raw?.length){alert("Bitte zuerst im Batch Lab einen ANSUR-Batch laufen lassen.");return}
  const result=[];
  for(const m of METRICS){
   const pairs=this.collectPairs(m);
   if(pairs.length<20)continue;
   const {train,test}=splitPairs(pairs),fit=linfit(train);
   if(!fit||test.length<5)continue;
   const rawErr=test.map(p=>p.mesh-p.ref);
   const calErr=test.map(p=>fit.a*p.mesh+fit.b-p.ref);
   result.push({
    key:m.key,label:m.label,group:m.group,n:pairs.length,trainN:train.length,testN:test.length,
    raw:{bias:mean(rawErr),mae:mae(rawErr),rmse:rmse(rawErr),p90:pct(rawErr.map(Math.abs),.9)},
    fit:{scale:fit.a,offsetCm:fit.b,r2Train:fit.r2},
    calibrated:{bias:mean(calErr),mae:mae(calErr),rmse:rmse(calErr),p90:pct(calErr.map(Math.abs),.9)},
    improvement:mae(rawErr)-mae(calErr)
   });
  }
  result.sort((a,b)=>b.improvement-a.improvement);
  this.calibration={build:"BODY LAB v3.6.0",createdAt:new Date().toISOString(),sourceBuild:this.batch.results.build,sourceRows:this.batch.results.sourceRows,method:"70/30 deterministic subject split; reference = scale*mesh + offset",metrics:result};
  this.renderCalibration();
  this.panel.querySelector("#calActivate").disabled=false;this.panel.querySelector("#calExport").disabled=false;
 }
 renderCalibration(){
  const box=this.panel.querySelector("#calResults");if(!this.calibration)return;
  const ms=this.calibration.metrics;
  const useful=ms.filter(x=>x.improvement>.1).length;
  box.innerHTML=`<div class="optimizerHero"><small>MESSKALIBRIERUNG</small><strong>${ms.length} Maße</strong><span>${useful} profitieren auf dem unabhängigen 30%-Test um >0,10 cm</span><b>Keine Solver-Morphs verändert</b></div>
  <div class="calTable calHead"><span>Maß</span><span>Raw</span><span>Kal.</span><span>Δ</span></div>
  ${ms.map(x=>`<div class="calTable">
    <span><b>${esc(x.label)}</b><small>${esc(x.group)} · n=${x.n} · R² ${x.fit.r2Train.toFixed(2)}</small></span>
    <span>${x.raw.mae.toFixed(2)}</span><span>${x.calibrated.mae.toFixed(2)}</span>
    <span class="${x.improvement>0?"calGood":"calBad"}">${x.improvement>=0?"−":"+"}${Math.abs(x.improvement).toFixed(2)}</span>
   </div>`).join("")}
  <div class="batchMeasureMatrix"><b>Interpretation</b><span>Scale nahe 1 + konstanter Offset → hauptsächlich Messdefinitions-Bias.</span><span>Deutlich andere Scale → proportionaler Definitions-/Geometrieunterschied.</span><span>Niedriges R² trotz hohem Fehler → eher echte Forminformation/Morphproblem statt einfacher Messkorrektur.</span></div>`;
 }
 activateCalibration(){
  if(!this.calibration)return;
  localStorage.setItem(PROFILE_KEY,JSON.stringify({...this.calibration,active:true}));
  alert("Kalibrierprofil gespeichert. V3.6 markiert es als aktiv; automatische Solver-Anwendung kommt erst nach der Validierung der Kalibrierwerte.");
 }
 trainV37(){
  const rows=this.batch?.rows||[];
  if(rows.length<50){alert("Bitte im Batch Lab zuerst mindestens 50 ANSUR-Personen laden. Ein Solver-Batch muss dafür nicht laufen.");return}
  const model=this.solverV37.train(rows);
  const box=this.panel.querySelector("#v37Results");
  box.innerHTML=`<div class="optimizerHero"><small>V3.7 STATISTISCHES FORMMODELL</small><strong>${model.rows} Personen</strong><span>80/20 Holdout · Core‑5 → unbekannte Rumpfform</span><b>${Object.keys(model.targets).length} Zielmaße gelernt</b></div>
   <div class="calTable calHead"><span>Ziel</span><span>Train</span><span>Test</span><span>MAE</span></div>
   ${Object.entries(model.targets).map(([k,m])=>`<div class="calTable"><span><b>${k}</b><small>Bias ${m.bias.toFixed(2)} cm</small></span><span>${m.nTrain}</span><span>${m.nTest}</span><span>${m.mae.toFixed(2)}</span></div>`).join("")}`;
  this.panel.querySelector("#v37AB").disabled=false;
 }
 async testV37(){
  if(!this.solverV37.trained()){alert("Bitte zuerst Core‑5 Modell trainieren.");return}
  const rows=(this.batch?.rows||[]).filter(r=>[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite)).slice(0,50);
  if(!rows.length){alert("Keine geeigneten ANSUR-Zeilen geladen.");return}
  const before=this.engine.snapshot(),base=[],cal=[],box=this.panel.querySelector("#v37Results");
  try{
   for(let i=0;i<rows.length;i++){
    const r=rows[i];
    box.innerHTML=`<div class="generatorProgress"><b>A/B Test ${i+1}/${rows.length}</b><span>Baseline + V3.7 auf derselben Person</span></div>`;
    await this.solverV37.baselineCore5(r);
    const eb=Object.values(this.solverV37.harnessBlindErrors(r)).filter(Number.isFinite);base.push(...eb.map(Math.abs));
    await this.solverV37.correct(r,{passes:3});
    const ec=Object.values(this.solverV37.harnessBlindErrors(r)).filter(Number.isFinite);cal.push(...ec.map(Math.abs));
    await new Promise(q=>setTimeout(q,0));
   }
   const mb=mean(base),mc=mean(cal),gain=mb-mc;
   box.innerHTML=`<div class="optimizerHero ${gain>0?"hit":"miss"}"><small>CORE‑5 A/B · ${rows.length} PERSONEN</small><strong>${mc.toFixed(2)} cm</strong><span>Baseline ${mb.toFixed(2)} cm → V3.7 ${mc.toFixed(2)} cm</span><b>${gain>=0?"Verbesserung":"Verschlechterung"} ${Math.abs(gain).toFixed(2)} cm</b></div>
   <div class="batchMeasureMatrix"><b>Entscheidungsregel</b><span>Nur wenn V3.7 auf diesem unabhängigen A/B-Lauf besser ist, übernehmen wir die Formkorrektur später in den normalen Generator.</span></div>`;
  }finally{
   this.engine.restore(before);this.ui.sync();this.engine.computeMetrics();
  }
 }
 metricSnapshot(){
  const e=this.engine,h=e.harnessBlindMetrics();
  return {
   chest:e.getMeasureCm("measure-bust-circ"),waist:e.getMeasureCm("measure-waist-circ"),
   hip:e.getMeasureCm("measure-hips-circ"),shoulder:e.shoulderBreadthCm(),torso:e.shoulderToCrotchCm(),
   neck:e.getMeasureCm("measure-neck-circ"),wrist:e.getMeasureCm("measure-wrist-circ"),
   thigh:e.getMeasureCm("measure-thigh-circ"),calf:e.getMeasureCm("measure-calf-circ"),ankle:e.getMeasureCm("measure-ankle-circ"),
   upperarmCirc:e.getMeasureCm("measure-upperarm-circ"),upperarmLength:e.getMeasureCm("measure-upperarm-length"),
   lowerarmLength:e.getMeasureCm("measure-lowerarm-length"),lowerlegHeight:e.getMeasureCm("measure-lowerleg-height"),upperlegHeight:e.getMeasureCm("measure-upperleg-height"),
   ...h
  };
 }
 async yieldProgress(i,n,label){
  const p=this.panel.querySelector("#sensProgress");p.classList.remove("hidden");
  p.innerHTML=`<b>${i} / ${n}</b><span>${esc(label)}</span>`;
  await new Promise(r=>setTimeout(r,0));
 }
 async runSensitivity(){
  const controls=[];
  for(const g of this.engine.groups||[])for(const c of g.controls||[])if(c?.id)controls.push({...c,group:g.id});
  if(!controls.length){alert("Body-Regler sind noch nicht geladen.");return}
  const before=this.engine.snapshot(),step=Number(this.panel.querySelector("#sensStep").value);
  this.abort=false;this.panel.querySelector("#sensRun").disabled=true;this.panel.querySelector("#sensAbort").disabled=false;
  const results=[];
  try{
   for(let ci=0;ci<controls.length;ci++){
    if(this.abort)break;
    const c=controls[ci],sexRuns=[];
    await this.yieldProgress(ci+1,controls.length,c.target||c.id);
    for(const gender of [0,1]){
     this.engine.reset();
     Object.assign(this.engine.state,{gender,age:.5,weight:.5,muscle:.5,height:.5,proportions:.5,breastSize:.5,breastFirmness:.5});
     this.engine.directState[c.id]=0;
     this.engine.updateBody({normals:false,metrics:false});
     const base=this.metricSnapshot();

     this.engine.directState[c.id]=step;
     this.engine.updateBody({normals:false,metrics:false});
     const plus=this.metricSnapshot();

     let minus=null;
     if(!c.oneWay){
      this.engine.directState[c.id]=-step;
      this.engine.updateBody({normals:false,metrics:false});
      minus=this.metricSnapshot();
     }
     const deltas={};
     for(const k of Object.keys(base)){
      if(!Number.isFinite(base[k])||!Number.isFinite(plus[k]))continue;
      deltas[k]=minus&&Number.isFinite(minus[k])?(plus[k]-minus[k])/2:(plus[k]-base[k]);
     }
     sexRuns.push({gender,deltas});
    }
    const avg={};
    for(const k of Object.keys(sexRuns[0]?.deltas||{}))avg[k]=mean(sexRuns.map(x=>x.deltas[k]).filter(Number.isFinite));
    const ranked=Object.entries(avg).map(([key,deltaCm])=>({key,deltaCm,abs:Math.abs(deltaCm)})).sort((a,b)=>b.abs-a.abs);
    results.push({
     id:c.id,target:c.target,group:c.group,oneWay:!!c.oneWay,step,
     scoreCm:ranked[0]?.abs||0,affected:ranked.filter(x=>x.abs>=.05).length,
     top:ranked.slice(0,8),all:avg
    });
   }
   results.sort((a,b)=>b.scoreCm-a.scoreCm);
   this.sensitivity={build:"BODY LAB v3.6.0",createdAt:new Date().toISOString(),step,controlCount:results.length,bases:["female","male"],results};
   localStorage.setItem(SENS_KEY,JSON.stringify(this.sensitivity));
   this.renderSensitivity();this.panel.querySelector("#sensExport").disabled=false;
  }finally{
   this.engine.restore(before);this.ui.sync();this.engine.computeMetrics();
   this.panel.querySelector("#sensRun").disabled=false;this.panel.querySelector("#sensAbort").disabled=true;this.panel.querySelector("#sensProgress").classList.add("hidden");
  }
 }
 renderSensitivity(){
  const box=this.panel.querySelector("#sensResults");if(!this.sensitivity)return;
  const n=Number(this.panel.querySelector("#sensShow").value),rows=this.sensitivity.results.slice(0,n);
  box.innerHTML=`<div class="optimizerHero"><small>MORPH SENSITIVITY</small><strong>${this.sensitivity.controlCount} Regler</strong><span>Ø aus weiblicher + männlicher Standardbasis · Schritt ${Math.round(this.sensitivity.step*100)}%</span><b>Ranking nach stärkster Maßänderung</b></div>
  ${rows.map((x,i)=>`<details class="sensRow"${i<10?" open":""}><summary><span><b>${i+1}. ${esc(x.target||x.id)}</b><small>${esc(x.group)} · ${x.affected} Maße ≥0,05 cm</small></span><strong>${x.scoreCm.toFixed(2)} cm</strong></summary><div>${x.top.map(t=>`<span>${esc(t.key)} <b>${t.deltaCm>=0?"+":""}${t.deltaCm.toFixed(2)} cm</b></span>`).join("")}</div></details>`).join("")}`;
 }
}
