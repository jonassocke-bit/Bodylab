
const MEASURE_KEYS=["chest","waist","torso","hip","shoulder","underbust"];
const LABELS={
 height:"Größe",weight:"Gewicht",chest:"Brust",waist:"Taille",
 torso:"Schulter→Schritt",hip:"Hüfte",shoulder:"Schulter",underbust:"Unterbrust"
};
const BLIND_KEYS=["neck","wrist","thigh","calf","ankle"];
const BLIND_LABELS={neck:"Halsumfang",wrist:"Handgelenk",thigh:"Oberschenkel",calf:"Wade",ankle:"Knöchel"};
const BLIND_RULERS={neck:"measure-neck-circ",wrist:"measure-wrist-circ",thigh:"measure-thigh-circ",calf:"measure-calf-circ",ankle:"measure-ankle-circ"};

const SCENARIOS=[
 {id:"hw",name:"H + W",use:[]},
 {id:"hw_c",name:"H + W + Brust",use:["chest"]},
 {id:"hw_cw",name:"H + W + Brust + Taille",use:["chest","waist"]},
 {id:"core5",name:"CORE 5",use:["chest","waist","torso"]},
 {id:"core5_s",name:"CORE 5 + Schulter",use:["chest","waist","torso","shoulder"]},
 {id:"core5_h",name:"CORE 5 + Hüfte",use:["chest","waist","torso","hip"]}
];
const ANSUR_URLS={
 female:"https://raw.githubusercontent.com/senihberkay/US-Army-ANSUR-II/refs/heads/master/ANSUR%20II%20FEMALE%20Public.csv",
 male:"https://raw.githubusercontent.com/senihberkay/US-Army-ANSUR-II/refs/heads/master/ANSUR%20II%20MALE%20Public.csv"
};

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function norm(s){return String(s??"").toLowerCase().trim().replace(/[ä]/g,"ae").replace(/[ö]/g,"oe").replace(/[ü]/g,"ue").replace(/[ß]/g,"ss").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
function num(v){
 const raw=String(v??"").trim();
 if(raw==="")return null;
 const n=Number(raw.replace(",","."));
 return Number.isFinite(n)?n:null;
}
function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function rmse(a){return a.length?Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length):NaN}
function percentile(a,p){if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return b[lo]+(b[hi]-b[lo])*(i-lo)}
function download(name,text,type="application/json"){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

function parseDelimited(text){
 const first=(text.split(/\r?\n/).find(x=>x.trim())||"");
 const counts={",":(first.match(/,/g)||[]).length,";":(first.match(/;/g)||[]).length,"\t":(first.match(/\t/g)||[]).length};
 const delim=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
 const rows=[];let row=[],field="",quote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quote && text[i+1]==='"'){field+='"';i++}else quote=!quote;
  }else if(c===delim && !quote){row.push(field);field=""}
  else if((c==="\n"||c==="\r")&&!quote){
   if(c==="\r"&&text[i+1]==="\n")i++;
   row.push(field);field="";
   if(row.some(x=>String(x).trim()!==""))rows.push(row);
   row=[];
  }else field+=c;
 }
 row.push(field);if(row.some(x=>String(x).trim()!==""))rows.push(row);
 if(rows.length<2)return [];
 const head=rows[0].map(norm);
 return rows.slice(1).map((r,i)=>Object.fromEntries(head.map((h,j)=>[h,r[j]??""]))).map((x,i)=>({...x,__row:i+2}));
}

const ALIASES={
 gender:["gender","sex","body_basis","bodybasis"],
 age:["age","years"],
 height:["height","height_cm","stature","body_height","overall_height"],
 weight:["weight","weight_kg","mass","body_weight"],
 chest:["chest","chest_cm","chest_circumference","bust","bust_circumference"],
 waist:["waist","waist_cm","waist_circumference"],
 torso:["shoulder_to_crotch","shoulder_to_crotch_cm","shouldertocrotch","torso","torso_length"],
 hip:["hip","hips","hip_cm","hip_circumference","hips_circumference"],
 shoulder:["shoulder","shoulder_cm","shoulder_breadth","shoulder_width"],
 underbust:["underbust","under_bust","underbust_circumference"],
 build:["build","muscle","muscularity"]
};
function pick(o,key){
 for(const a of ALIASES[key])if(o[a]!==undefined&&String(o[a]).trim()!=="")return o[a];
 return null;
}
function normalizeRow(o){
 let height=num(pick(o,"height")),weight=num(pick(o,"weight"));
 const cv=k=>{let v=num(pick(o,k));if(v!==null&&v>300)v/=10;return v};
 if(height!==null&&height>300)height/=10;
 let g=String(pick(o,"gender")??"").toLowerCase();
 let gender=g.startsWith("f")||g==="2"||g.includes("weib")?0:g.startsWith("m")||g==="1"||g.includes("maenn")||g.includes("männ")?1:.5;
 let build=num(pick(o,"build"));if(build===null)build=.52;else if(build>1)build/=100;
 return {
  sourceRow:o.__row,gender,age:num(pick(o,"age"))??30,height,weight,build,
  chest:cv("chest"),waist:cv("waist"),torso:cv("torso"),hip:cv("hip"),shoulder:cv("shoulder"),underbust:cv("underbust")
 };
}
function normalizeANSURRow(o,sourceSex){
 const mm=k=>{const v=num(o[k]);return v===null?null:v/10};
 const ah=num(o.acromialheight),ch=num(o.crotchheight);
 const torso=(ah===null||ch===null)?null:(ah-ch)/10;
 const wk=num(o.weightkg);
 const sex=String(o.gender||sourceSex||"").toLowerCase();
 return {
  sourceRow:o.subjectid||o.__row,
  gender:sex.startsWith("f")?0:1,
  age:num(o.age)??30,
  height:mm("stature"),
  weight:wk===null?null:wk/10,
  build:.52,
  chest:mm("chestcircumference"),
  waist:mm("waistcircumference"),
  torso,
  // ANSUR II calls this buttock circumference. It is our closest direct
  // analogue to the maximum hip / seat circumference used by the Body Lab.
  hip:mm("buttockcircumference"),
  shoulder:mm("biacromialbreadth"),
  underbust:null,
  neck:mm("neckcircumference"),
  wrist:mm("wristcircumference"),
  thigh:mm("thighcircumference"),
  calf:mm("calfcircumference"),
  ankle:mm("anklecircumference"),
  sourceDataset:"ANSUR II",
  sourceSex:sex.startsWith("f")?"female":"male"
 };
}

export class BatchLab{
 constructor(engine,ui,measurementLab){
  this.engine=engine;this.ui=ui;this.lab=measurementLab;
  this.panel=document.getElementById("batchPanel");this.button=document.getElementById("batchToggle");
  this.rows=[];this.results=null;this.abort=false;this.bind();this.render();
 }
 bind(){this.button.disabled=false;this.button.onclick=()=>this.panel.classList.remove("hidden")}
 render(){
  this.panel.innerHTML=`
   <div class="generatorHead">
    <div><strong>BODY LAB · BATCH LAB</strong><small>V3.2 · Datensatz rein → Fragebogenvergleich raus</small></div>
    <button id="batchClose">Schließen</button>
   </div>
   <div class="generatorIntro">
    CSV oder JSON mit vielen Referenzpersonen laden. Die App testet automatisch mehrere
    Eingabe-Sets und bewertet nur Maße, die im jeweiligen Test <b>nicht</b> als Input verwendet wurden.
   </div>

   <div class="generatorSectionTitle">DATENSATZ</div>
   <div class="batchImport">
    <label class="fileButton">CSV / JSON auswählen<input id="batchFile" type="file" accept=".csv,.tsv,.txt,.json,text/csv,application/json"></label>
    <button id="batchSample">Referenzbeispiel laden</button>
    <button id="batchTemplate">CSV-Vorlage</button>
   </div>
   <div class="generatorSectionTitle">ECHTE ANSUR-II-PERSONEN</div>
   <div class="batchImport">
    <button id="ansurFemale">1.986 Frauen laden</button>
    <button id="ansurMale">4.082 Männer laden</button>
    <button id="ansurAll" class="primary">Alle 6.068 laden</button>
   </div>
   <div class="generatorIntro compact">
    Direkt gemessene ANSUR-II-Personen. Größe, Brust, Taille, Biacromial-Schulterbreite und Körpermasse
    kommen direkt aus dem Datensatz. Schulter→Schritt wird aus Acromialhöhe minus Schritthöhe gebildet.
    Für „Hüfte“ verwenden wir ANSURs Buttock Circumference als nächstes direktes Umfangs-Analog.
   </div>
   <div id="batchDatasetInfo" class="batchInfo">Noch kein Datensatz geladen.</div>

   <div class="generatorSectionTitle">TESTUMFANG</div>
   <div class="generatorGrid">
    <label>Max. Personen
     <select id="batchLimit">
      <option value="10">10 · schneller Test</option>
      <option value="25" selected>25</option>
      <option value="50">50</option>
      <option value="100">100</option>
      <option value="250">250</option>
      <option value="500">500</option>
      <option value="1000">1.000</option>
      <option value="2000">2.000</option>
      <option value="0">Alle</option>
     </select>
    </label>
    <label>Tests
     <select id="batchMode">
      <option value="ladder" selected>6 sinnvolle Stufen</option>
      <option value="all">alle 32 Torso-Kombinationen</option>
     </select>
    </label>
   </div>
   <div class="generatorIntro compact">
    Für iPhone zuerst 10–25 Personen nehmen. Wenn das sauber läuft, erhöhen wir.
    Der Batch läuft ohne Normalenberechnung und stellt dein vorheriges Modell danach wieder her.
   </div>

   <div class="generatorSectionTitle">QUESTIONNAIRE OPTIMIZER</div>
   <div class="generatorGrid">
    <label>Zielgenauigkeit
     <select id="optTarget">
      <option value="0.5">≤ 0,50 cm</option><option value="0.75">≤ 0,75 cm</option>
      <option value="1" selected>≤ 1,00 cm</option><option value="1.5">≤ 1,50 cm</option><option value="2">≤ 2,00 cm</option>
     </select>
    </label>
    <label>Optimieren nach
     <select id="optMetric"><option value="blindMAE" selected>Blind-MAE · empfohlen</option><option value="fullMAE">Gesamt-MAE</option><option value="holdoutMAE">Holdout-MAE</option></select>
    </label>
   </div>
   <div class="generatorIntro compact">Nach einem 32-Kombinationen-Lauf sucht der Optimizer automatisch den kleinsten Fragebogen, der dein Fehlerziel erreicht.</div>
   <div id="optimizerResults" class="batchResults"></div>
   <div class="generatorSectionTitle">BLIND VALIDATION</div>
   <div class="generatorIntro compact">
    Hals-, Handgelenk-, Oberschenkel-, Waden- und Knöchelumfang werden niemals an den Solver übergeben.
    Sie prüfen ausschließlich, ob der restliche Körper ohne direkte Vorgabe plausibel mitkommt.
   </div>
   <div id="blindResults" class="batchResults"></div>
   <div class="generatorActions">
    <button id="batchRun" class="primary">Batch starten</button>
    <button id="batchAbort" disabled>Abbrechen</button>
    <button id="batchExport" disabled>Ergebnis exportieren</button>
   </div>
   <div id="batchProgress" class="generatorProgress hidden"></div>
   <div id="batchResults" class="batchResults"></div>
  `;
  this.panel.querySelector("#batchClose").onclick=()=>this.panel.classList.add("hidden");
  this.panel.querySelector("#batchSample").onclick=()=>this.loadSample();
  this.panel.querySelector("#batchTemplate").onclick=()=>this.downloadTemplate();
  this.panel.querySelector("#batchFile").onchange=e=>this.loadFile(e.target.files?.[0]);
  this.panel.querySelector("#ansurFemale").onclick=()=>this.loadANSUR("female");
  this.panel.querySelector("#ansurMale").onclick=()=>this.loadANSUR("male");
  this.panel.querySelector("#ansurAll").onclick=()=>this.loadANSUR("all");
  this.panel.querySelector("#batchRun").onclick=()=>this.run();
  this.panel.querySelector("#batchAbort").onclick=()=>{this.abort=true};
  this.panel.querySelector("#batchExport").onclick=()=>this.export();
  this.panel.querySelector("#optTarget").onchange=()=>this.renderOptimizer();
  this.panel.querySelector("#optMetric").onchange=()=>this.renderOptimizer();
 }
 async loadANSUR(which){
  const buttons=["ansurFemale","ansurMale","ansurAll"].map(id=>this.panel.querySelector("#"+id));
  buttons.forEach(x=>x.disabled=true);
  const info=this.panel.querySelector("#batchDatasetInfo");
  try{
   const sexes=which==="all"?["female","male"]:[which];
   const rows=[];
   for(const sex of sexes){
    info.innerHTML=`<b>ANSUR II lädt …</b><span>${sex==="female"?"Frauen":"Männer"} werden heruntergeladen und umgerechnet.</span>`;
    const r=await fetch(ANSUR_URLS[sex],{cache:"force-cache"});
    if(!r.ok)throw new Error("ANSUR "+sex+" HTTP "+r.status);
    const text=await r.text();
    const raw=parseDelimited(text);
    for(const x of raw){
     const row=normalizeANSURRow(x,sex);
     if(row.height&&row.weight&&row.chest&&row.waist&&row.torso&&row.hip&&row.shoulder)rows.push(row);
    }
   }
   this.rows=rows;
   this.showDataset(which==="all"?"ANSUR II · alle realen Personen":`ANSUR II · ${which==="female"?"Frauen":"Männer"}`);
  }catch(err){
   console.error(err);
   info.innerHTML=`<b>ANSUR-Download fehlgeschlagen</b><span>${esc(err.message||err)}</span>`;
   alert("ANSUR konnte nicht geladen werden: "+(err.message||err));
  }finally{
   buttons.forEach(x=>x.disabled=false);
  }
 }
 loadSample(){
  this.rows=[{
   sourceRow:2,gender:1,age:30,height:172,weight:65,build:.52,
   chest:89.44,waist:84.36,torso:64.38,hip:92.78,shoulder:35.31,underbust:null
  }];
  this.showDataset();
 }
 downloadTemplate(){
  const t="gender,age,height,weight,chest,waist,shoulder_to_crotch,hip,shoulder_breadth,underbust\nmale,30,172,65,89.44,84.36,64.38,92.78,35.31,\n";
  download("BodyLab-Batch-Template.csv",t,"text/csv");
 }
 async loadFile(file){
  if(!file)return;
  try{
   const text=await file.text(),ext=(file.name.split(".").pop()||"").toLowerCase();
   let raw;
   if(ext==="json"||text.trim().startsWith("[")||text.trim().startsWith("{")){
    const j=JSON.parse(text);raw=Array.isArray(j)?j:(j.rows||j.data||[]);
    raw=raw.map((x,i)=>{const o={};for(const [k,v] of Object.entries(x))o[norm(k)]=v;o.__row=i+1;return o});
   }else raw=parseDelimited(text);
   this.rows=raw.map(normalizeRow).filter(r=>r.height&&r.weight);
   this.showDataset(file.name);
  }catch(err){alert("Importfehler: "+(err.message||err))}
 }
 showDataset(name="Datensatz"){
  const n=this.rows.length,has={};
  for(const k of ["chest","waist","torso","hip","shoulder","underbust"])has[k]=this.rows.filter(r=>r[k]!=null).length;
  const female=this.rows.filter(r=>r.gender===0).length,male=this.rows.filter(r=>r.gender===1).length;
  this.panel.querySelector("#batchDatasetInfo").innerHTML=
   `<b>${esc(name)} · ${n} Personen</b><span>${female?`♀ ${female} · `:""}${male?`♂ ${male} · `:""}`+
   Object.entries(has).map(([k,v])=>`${LABELS[k]} ${v}/${n}`).join(" · ")+"</span>";
 }
 scenarios(){
  if(this.panel.querySelector("#batchMode").value==="ladder")return SCENARIOS;
  const dims=["chest","waist","torso","hip","shoulder"];
  const all=[];
  for(let mask=0;mask<(1<<dims.length);mask++){
   const use=dims.filter((_,i)=>mask&(1<<i));
   all.push({id:"m"+mask,name:use.length?("H+W + "+use.map(x=>LABELS[x]).join(" + ")):"H + W",use});
  }
  return all.sort((a,b)=>a.use.length-b.use.length||a.name.localeCompare(b.name));
 }
 async tick(text,sub){
  const p=this.panel.querySelector("#batchProgress");p.classList.remove("hidden");p.innerHTML=`<b>${esc(text)}</b><span>${esc(sub||"")}</span>`;
  await new Promise(r=>setTimeout(r,0));
 }
 async solveCase(row,scenario){
  const e=this.engine,l=this.lab;
  e.reset();e.state.gender=row.gender;e.state.age=Math.max(0,Math.min(1,l.ageToSlider(row.age)));e.state.muscle=Math.max(0,Math.min(1,row.build));
  e.updateBody({normals:false,metrics:false});
  await l.solveCore("height",row.height,"height",0,1);
  await l.solveCore("weight",row.weight,"weight",0,1);

  const use=new Set(scenario.use);
  if(use.has("chest")&&row.chest!=null)await l.solveDirect("measure-bust-circ",row.chest);
  if(use.has("waist")&&row.waist!=null)await l.solveDirect("measure-waist-circ",row.waist);
  if(use.has("torso")&&row.torso!=null)await l.solveTorso(row.torso);
  if(use.has("hip")&&row.hip!=null)await l.solveDirect("measure-hips-circ",row.hip);
  if(use.has("shoulder")&&row.shoulder!=null)await l.solveShoulder(row.shoulder);
  if(use.has("underbust")&&row.underbust!=null)await l.solveDirect("measure-underbust-circ",row.underbust);

  // Two coupled passes are enough for batch ranking; the interactive generator uses more.
  for(let pass=0;pass<2;pass++){
   await l.solveCore("height",row.height,"height",0,1);
   await l.solveCore("weight",row.weight,"weight",0,1);
   if(use.has("chest")&&row.chest!=null)await l.solveDirect("measure-bust-circ",row.chest);
   if(use.has("waist")&&row.waist!=null)await l.solveDirect("measure-waist-circ",row.waist);
   if(use.has("torso")&&row.torso!=null)await l.solveTorso(row.torso);
   if(use.has("hip")&&row.hip!=null)await l.solveDirect("measure-hips-circ",row.hip);
   if(use.has("shoulder")&&row.shoulder!=null)await l.solveShoulder(row.shoulder);
  }

  return {
   height:e.heightCm(),weight:e.weightKg(),
   chest:e.getMeasureCm("measure-bust-circ"),waist:e.getMeasureCm("measure-waist-circ"),
   torso:e.shoulderToCrotchCm(),hip:e.getMeasureCm("measure-hips-circ"),
   shoulder:e.shoulderBreadthCm(),underbust:e.getMeasureCm("measure-underbust-circ"),
   neck:e.getMeasureCm(BLIND_RULERS.neck),wrist:e.getMeasureCm(BLIND_RULERS.wrist),
   thigh:e.getMeasureCm(BLIND_RULERS.thigh),calf:e.getMeasureCm(BLIND_RULERS.calf),
   ankle:e.getMeasureCm(BLIND_RULERS.ankle)
  };
 }
 async run(){
  if(!this.rows.length){alert("Bitte zuerst einen Datensatz laden.");return}
  const lim=Number(this.panel.querySelector("#batchLimit").value),rows=lim?this.rows.slice(0,lim):this.rows;
  const scenarios=this.scenarios(),before=this.engine.snapshot();
  this.abort=false;this.panel.querySelector("#batchRun").disabled=true;this.panel.querySelector("#batchAbort").disabled=false;
  const raw=[],summary=[];
  try{
   let done=0,total=rows.length*scenarios.length;
   for(const s of scenarios){
    const errors=Object.fromEntries(MEASURE_KEYS.map(k=>[k,[]]));
    const inputErrors=Object.fromEntries(MEASURE_KEYS.map(k=>[k,[]]));
    const allErrors=Object.fromEntries(MEASURE_KEYS.map(k=>[k,[]]));
    const blindErrors=Object.fromEntries(BLIND_KEYS.map(k=>[k,[]]));
    let usedRows=0;
    for(let ri=0;ri<rows.length;ri++){
     if(this.abort)throw new Error("__ABORT__");
     const r=rows[ri];
     if(s.use.some(k=>r[k]==null))continue;
     await this.tick(`${s.name} · Person ${ri+1}/${rows.length}`,`${done}/${total} Modellläufe`);
     const out=await this.solveCase(r,s);usedRows++;done++;
     const rec={scenario:s.id,scenarioName:s.name,row:r.sourceRow,inputs:s.use,reference:r,mesh:out,errors:{}};
     for(const k of MEASURE_KEYS){
      if(r[k]==null)continue;
      const err=out[k]-r[k],ae=Math.abs(err);rec.errors[k]=err;
      allErrors[k].push(ae);
      (s.use.includes(k)?inputErrors[k]:errors[k]).push(ae);
     }
     rec.blindErrors={};
     for(const k of BLIND_KEYS){
      if(r[k]==null||!Number.isFinite(out[k]))continue;
      const err=out[k]-r[k];rec.blindErrors[k]=err;blindErrors[k].push(Math.abs(err));
     }
     raw.push(rec);
    }
    const holdout=[].concat(...Object.values(errors));
    const fit=[].concat(...Object.values(inputErrors));
    const all=[].concat(...Object.values(allErrors));
    const blind=[].concat(...Object.values(blindErrors));
    summary.push({
     id:s.id,name:s.name,use:s.use,people:usedRows,
     fullMAE:mean(all),fullRMSE:rmse(all),fullP90:percentile(all,.9),
     holdoutMAE:mean(holdout),holdoutRMSE:rmse(holdout),holdoutP90:percentile(holdout,.9),
     blindMAE:mean(blind),blindRMSE:rmse(blind),blindP90:percentile(blind,.9),
     blindPerMeasure:Object.fromEntries(BLIND_KEYS.map(k=>[k,{n:blindErrors[k].length,mae:mean(blindErrors[k]),p90:percentile(blindErrors[k],.9)}])),
     fitMAE:mean(fit),
     perMeasure:Object.fromEntries(MEASURE_KEYS.map(k=>[k,{
       n:allErrors[k].length,mae:mean(allErrors[k]),p90:percentile(allErrors[k],.9),
       holdoutN:errors[k].length,holdoutMAE:mean(errors[k]),holdoutP90:percentile(errors[k],.9),
       inputN:inputErrors[k].length,inputMAE:mean(inputErrors[k])
     }]))
    });
   }
   summary.sort((a,b)=>(a.fullMAE||999)-(b.fullMAE||999));
   this.results={build:"BODY LAB v3.4.0",createdAt:new Date().toISOString(),sourceRows:rows.length,scenarioCount:scenarios.length,summary,raw};
   this.renderResults();
   this.renderOptimizer();
   this.renderBlindValidation();
   this.panel.querySelector("#batchExport").disabled=false;
  }catch(err){
   if(err.message!=="__ABORT__")console.error(err),alert("Batchfehler: "+(err.message||err));
  }finally{
   this.engine.restore(before);this.ui.sync();this.engine.computeMetrics();
   this.panel.querySelector("#batchRun").disabled=false;this.panel.querySelector("#batchAbort").disabled=true;
   this.panel.querySelector("#batchProgress").classList.add("hidden");
  }
 }
 renderResults(){
  const box=this.panel.querySelector("#batchResults"),s=this.results.summary;
  box.innerHTML=`
   <div class="batchHeadline">Ranking nach <b>Gesamt-MAE</b> · Holdout separat</div>
   <div class="batchTable batchTableHead"><span>Variante</span><span>Personen</span><span>Gesamt</span><span>Holdout</span></div>
   ${s.map((x,i)=>`<div class="batchTable ${i===0?"best":""}">
    <span><b>${i+1}. ${esc(x.name)}</b><small>${x.use.length?x.use.map(k=>LABELS[k]).join(" · "):"keine Torso-Maße als Input"}</small></span>
    <span>${x.people}</span>
    <span>${Number.isFinite(x.fullMAE)?x.fullMAE.toFixed(2)+" cm":"–"}</span>
    <span>${Number.isFinite(x.holdoutMAE)?x.holdoutMAE.toFixed(2)+" cm":"–"}</span>
   </div>`).join("")}
   <div class="batchMeasureMatrix">
    <b>Was bedeuten die beiden Werte?</b>
    <span><strong>Gesamt-MAE</strong>: Fehler aller bekannten Referenzmaße. Damit messen wir, wie akkurat der fertige Körper insgesamt wird.</span>
    <span><strong>Holdout-MAE</strong>: nur Maße, die der jeweilige Fragebogen nicht bekommen hat. Damit messen wir, wie gut fehlende Maße vorhergesagt werden.</span>
   </div>
   <div class="batchMeasureMatrix">
    <b>Beste Holdout-Vorhersage je Maß</b>
    ${MEASURE_KEYS.map(k=>{
     const vals=s.map(x=>({x,m:x.perMeasure[k]})).filter(q=>q.m.holdoutN&&Number.isFinite(q.m.holdoutMAE)).sort((a,b)=>a.m.holdoutMAE-b.m.holdoutMAE);
     if(!vals.length)return "";
     const q=vals[0];return `<span>${LABELS[k]}: <strong>${q.m.holdoutMAE.toFixed(2)} cm</strong> · ${esc(q.x.name)} · n=${q.m.holdoutN}</span>`;
    }).join("")}
   </div>`;
 }
 renderOptimizer(){
  const box=this.panel?.querySelector("#optimizerResults"); if(!box)return;
  if(!this.results){box.innerHTML='<div class="batchInfo">Noch kein Ergebnis vorhanden.</div>';return}
  const target=Number(this.panel.querySelector("#optTarget").value),metric=this.panel.querySelector("#optMetric").value;
  const rows=this.results.summary.filter(x=>Number.isFinite(x[metric]));
  const bestByCount=[];
  for(let n=0;n<=5;n++){const c=rows.filter(x=>x.use.length===n).sort((a,b)=>a[metric]-b[metric]);if(c.length)bestByCount.push(c[0])}
  const qualifying=rows.filter(x=>x[metric]<=target).sort((a,b)=>a.use.length-b.use.length||a[metric]-b[metric]);
  const winner=qualifying[0]||[...rows].sort((a,b)=>a[metric]-b[metric])[0],met=winner[metric]<=target;
  const gains=bestByCount.map((x,i)=>({x,gain:i?bestByCount[i-1][metric]-x[metric]:null}));
  const optional=["chest","waist","torso","hip","shoulder"];
  const marginal=optional.map(k=>{const d=[];for(const a of rows){if(a.use.includes(k))continue;const key=[...a.use,k].sort().join("|"),q=rows.find(x=>[...x.use].sort().join("|")===key);if(q)d.push(a[metric]-q[metric])}return{k,n:d.length,avg:mean(d),median:percentile(d,.5)}}).filter(x=>x.n).sort((a,b)=>b.avg-a.avg);
  box.innerHTML=`<div class="optimizerHero ${met?"hit":"miss"}"><small>${met?"KLEINSTER FRAGEBOGEN FÜR DAS ZIEL":"ZIEL NICHT ERREICHT · BESTE VARIANTE"}</small><strong>${winner.use.length+2} Angaben</strong><span>Größe · Gewicht${winner.use.length?" · "+winner.use.map(k=>LABELS[k]).join(" · "):""}</span><b>${winner[metric].toFixed(2)} cm</b></div>
  <div class="batchMeasureMatrix"><b>Pareto-Pfad · beste Variante je Länge</b>${gains.map(g=>`<span>${g.x.use.length+2} Angaben: <strong>${g.x[metric].toFixed(2)} cm</strong> · ${g.x.use.length?g.x.use.map(k=>LABELS[k]).join(" + "):"nur Größe + Gewicht"}${g.gain!==null?` · Gewinn <strong>${g.gain.toFixed(2)} cm</strong>`:""}</span>`).join("")}</div>
  <div class="batchMeasureMatrix"><b>Ø Grenznutzen einer zusätzlichen Messung</b>${marginal.map(x=>`<span>${LABELS[x.k]}: <strong>−${x.avg.toFixed(2)} cm</strong> · Median −${x.median.toFixed(2)} cm · ${x.n} Paarvergleiche</span>`).join("")}</div>`;
 }
 renderBlindValidation(){
  const box=this.panel?.querySelector("#blindResults");if(!box)return;
  if(!this.results){box.innerHTML="";return}
  const rows=this.results.summary.filter(x=>Number.isFinite(x.blindMAE)).sort((a,b)=>a.blindMAE-b.blindMAE);
  if(!rows.length){box.innerHTML='<div class="batchInfo">Keine Blind-Maße im Datensatz vorhanden.</div>';return}
  const best=rows[0];
  box.innerHTML=`<div class="optimizerHero blind"><small>BESTE BLIND-REKONSTRUKTION</small><strong>${best.blindMAE.toFixed(2)} cm</strong><span>Größe · Gewicht${best.use.length?" · "+best.use.map(k=>LABELS[k]).join(" · "):""}</span><b>P90 ${best.blindP90.toFixed(2)} cm · ${best.people} Personen</b></div>
  <div class="batchMeasureMatrix"><b>Unbekannte Kontrollmaße dieser Variante</b>${BLIND_KEYS.map(k=>{const m=best.blindPerMeasure?.[k];return m&&m.n?`<span>${BLIND_LABELS[k]}: <strong>${m.mae.toFixed(2)} cm</strong> · P90 ${m.p90.toFixed(2)} cm · n=${m.n}</span>`:""}).join("")}</div>
  <div class="batchMeasureMatrix"><b>Top 5 nach Blind-MAE</b>${rows.slice(0,5).map((x,i)=>`<span>${i+1}. <strong>${x.blindMAE.toFixed(2)} cm</strong> · ${x.use.length+2} Angaben · ${x.use.length?x.use.map(k=>LABELS[k]).join(" + "):"nur Größe + Gewicht"}</span>`).join("")}</div>`;
 }
 export(){if(!this.results)return;this.results.optimizer={targetCm:Number(this.panel.querySelector("#optTarget").value),metric:this.panel.querySelector("#optMetric").value};download("BodyLab-v3.4.0-Batch-Report.json",JSON.stringify(this.results,null,2))}
}
