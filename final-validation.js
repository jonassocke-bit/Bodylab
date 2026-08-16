
function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function pctl(a,p){if(!a.length)return NaN;const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return x[l]+(x[h]-x[l])*(i-l)}
function fmt(x){return Number.isFinite(x)?x.toFixed(2):"—"}
function isHoldout(r){
 const s=String(r.sourceRow??"");let h=0;
 for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
 return (h%10)>=8; // exact complement of SolverV3.11's training split
}
export class FinalValidationV313{
 constructor(engine,ui,lab,batch,solver){
  this.engine=engine;this.ui=ui;this.lab=lab;this.batch=batch;this.solver=solver;this.abort=false;
  this.panel=document.getElementById("calibrationPanel");this.inject();
 }
 inject(){
  const wrap=document.createElement("div");
  wrap.innerHTML=`<div class="generatorSectionTitle">E · FINAL VALIDATION · V3.13</div>
  <div class="generatorIntro compact">
   Abschlussprüfung des <b>eingefrorenen V3.11-Solvers</b>. Verwendet werden ausschließlich Personen aus seinem
   deterministischen 20%-Holdout; an diesen Personen wurde das Hidden-Geometry-Modell nicht trainiert.
  </div>
  <div class="generatorGrid"><label>Max. Holdout-Personen
   <select id="finalN"><option value="250">250</option><option value="500">500</option><option value="1000">1.000</option><option value="999999" selected>Alle verfügbaren</option></select>
  </label></div>
  <div class="generatorActions"><button id="finalRun" class="primary">Final Validation starten</button><button id="finalAbort">Abbrechen</button></div>
  <div id="finalProgress" class="batchProgressRich hidden">
   <div class="batchProgressTop"><b id="finalTitle">Warte …</b><span id="finalPct">0%</span></div>
   <div class="batchProgressTrack"><div id="finalBar"></div></div>
   <div class="batchProgressMeta"><span id="finalCount">0 / 0 Personen</span><span id="finalEta">Restzeit wird geschätzt …</span></div>
  </div>
  <div id="finalResults" class="calResults"></div>`;
  this.panel.appendChild(wrap);
  this.panel.querySelector("#finalRun").onclick=()=>this.run();
  this.panel.querySelector("#finalAbort").onclick=()=>{this.abort=true};
 }
 time(sec){if(!Number.isFinite(sec))return "wird geschätzt …";sec=Math.round(sec);if(sec<60)return `${sec} s`;const m=Math.floor(sec/60),s=sec%60;if(m<60)return `${m}:${String(s).padStart(2,"0")} min`;return `${Math.floor(m/60)} h ${m%60} min`}
 progress(done,total,start,samples){
  const pct=total?100*done/total:0,med=samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:NaN;
  this.panel.querySelector("#finalPct").textContent=`${pct.toFixed(1)}%`;
  this.panel.querySelector("#finalBar").style.width=`${pct.toFixed(1)}%`;
  this.panel.querySelector("#finalCount").textContent=`${done} / ${total} Personen`;
  this.panel.querySelector("#finalEta").textContent=done>=3?`ca. ${this.time(med*(total-done))} verbleibend`:"Restzeit wird geschätzt …";
  this.panel.querySelector("#finalTitle").textContent=`Final Validation · ${done}/${total}`;
 }
 async run(){
  if(!this.solver?.trained()){alert("Das eingefrorene V3.11-Modell ist auf diesem Gerät nicht mehr gespeichert. Bitte nicht neu tunen; wir müssen dann V3.11 einmal reproduzierbar auf dem Trainingssplit wiederherstellen.");return}
  const candidates=(this.batch?.rows||[]).filter(r=>isHoldout(r)&&[r.height,r.weight,r.chest,r.waist,r.hip].every(Number.isFinite));
  if(!candidates.length){alert("Keine V3.11-Holdout-Personen im gespeicherten Datensatz gefunden.");return}
  const cap=Number(this.panel.querySelector("#finalN").value)||candidates.length,rows=candidates.slice(0,Math.min(cap,candidates.length));
  const before=this.engine.snapshot(),start=performance.now(),samples=[],base=[],next=[],female={b:[],n:[]},male={b:[],n:[]},per={};
  const prog=this.panel.querySelector("#finalProgress"),box=this.panel.querySelector("#finalResults");prog.classList.remove("hidden");this.abort=false;
  try{
   for(let i=0;i<rows.length;i++){
    if(this.abort)break;const t0=performance.now(),r=rows[i];this.progress(i,rows.length,start,samples);
    await this.solver.baseline(r);const a=this.solver.scoreHarness(r);if(Number.isFinite(a.mae))base.push(a.mae);
    await this.solver.correct(r);const z=this.solver.scoreHarness(r);if(Number.isFinite(z.mae))next.push(z.mae);
    const sx=r.gender===0?female:male;if(Number.isFinite(a.mae))sx.b.push(a.mae);if(Number.isFinite(z.mae))sx.n.push(z.mae);
    for(const k of new Set([...Object.keys(a.per||{}),...Object.keys(z.per||{})])){
     per[k]??={b:[],n:[]};if(Number.isFinite(a.per?.[k]))per[k].b.push(Math.abs(a.per[k]));if(Number.isFinite(z.per?.[k]))per[k].n.push(Math.abs(z.per[k]));
    }
    const sec=(performance.now()-t0)/1000;if(sec>.001&&sec<300)samples.push(sec);if(samples.length>30)samples.shift();
    this.progress(i+1,rows.length,start,samples);await new Promise(q=>setTimeout(q,0));
   }
   if(this.abort){this.panel.querySelector("#finalTitle").textContent="Final Validation abgebrochen";return}
   const mb=mean(base),mn=mean(next),gain=mb-mn,rel=100*gain/mb,pb=pctl(base,.9),pn=pctl(next,.9);
   const fg=mean(female.b)-mean(female.n),mg=mean(male.b)-mean(male.n);
   const bad=Object.entries(per).filter(([k,v])=>mean(v.n)>mean(v.b)+.25);
   const pass=gain>.10&&fg>0&&mg>0&&bad.length===0;
   box.innerHTML=`<div class="optimizerHero ${pass?"hit":"miss"}"><small>FINAL HOLDOUT · ${base.length} PERSONEN</small><strong>${fmt(mn)} cm</strong><span>Baseline ${fmt(mb)} → V3.11 ${fmt(mn)} cm</span><b>${gain>=0?"Verbesserung":"Verschlechterung"} ${fmt(Math.abs(gain))} cm · ${rel.toFixed(1)}%</b></div>
   <div class="batchMeasureMatrix"><b>Robustheit</b><span>P90: ${fmt(pb)} → ${fmt(pn)} cm</span><span>Frauen: ${fmt(mean(female.b))} → ${fmt(mean(female.n))} cm</span><span>Männer: ${fmt(mean(male.b))} → ${fmt(mean(male.n))} cm</span></div>
   <div class="batchMeasureMatrix"><b>Harness-Maße</b>${Object.entries(per).map(([k,v])=>`<span>${k}: ${fmt(mean(v.b))} → <strong>${fmt(mean(v.n))} cm</strong></span>`).join("")}</div>
   <div class="optimizerHero ${pass?"hit":"miss"}"><small>ABSCHLUSSENTSCHEIDUNG</small><strong>${pass?"BESTANDEN ✓":"NICHT BESTANDEN"}</strong><span>${pass?"V3.11 kann als Produktionsbasis übernommen werden.":"Nicht automatisch übernehmen; Ergebnis zuerst beurteilen."}</span></div>`;
   this.panel.querySelector("#finalTitle").textContent="Final Validation abgeschlossen";
   this.panel.querySelector("#finalEta").textContent=`Fertig in ${this.time((performance.now()-start)/1000)}`;
  }finally{this.engine.restore(before);this.ui.sync();this.engine.computeMetrics()}
 }
}
