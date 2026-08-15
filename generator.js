
const PROFILE_KEY="bodylab_v310_measurement_profiles";

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function numberValue(el){
 const v=Number(String(el.value).replace(",","."));
 return Number.isFinite(v)?v:null;
}
function esc(s){
 return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

export class MeasurementLab{
 constructor(engine,ui){
  this.engine=engine;
  this.ui=ui;
  this.panel=document.getElementById("generatorPanel");
  this.button=document.getElementById("generatorToggle");
  this.lastReport=null;
  this.controlByTarget=new Map();
  this.indexControls();
  this.bind();
  this.render();
 }
 indexControls(){
  for(const g of this.engine.groups||[]){
   for(const c of g.controls||[]){
    if(c && c.target && !this.controlByTarget.has(c.target))this.controlByTarget.set(c.target,c.id);
   }
  }
 }
 bind(){
  this.button.disabled=false;
  this.button.onclick=()=>{this.panel.classList.remove("hidden");this.renderResultsPlaceholder()};
 }
 render(){
  this.panel.innerHTML=`
   <div class="generatorHead">
    <div><strong>BODY LAB · MEASUREMENT LAB</strong><small>V3.1 · wenige Maße → MakeHuman-Körper</small></div>
    <button id="genClose">Schließen</button>
   </div>

   <div class="generatorIntro">
    Ziel ist nicht, möglichst viele Maße abzufragen. Pflichtwerte formen den Körper;
    optionale Kontrollwerte können absichtlich <b>nicht</b> zur Generierung benutzt werden,
    damit wir messen können, wie gut sie aus den übrigen Angaben vorhergesagt werden.
   </div>

   <div class="generatorSectionTitle">GRUNDDATEN</div>
   <div class="generatorGrid">
    <label>Körperbasis
     <select id="genGender">
      <option value="0">weibliche Basis</option>
      <option value="0.5">neutraler Mix</option>
      <option value="1" selected>männliche Basis</option>
     </select>
    </label>
    <label>Alter
     <div class="inputUnit"><input id="genAge" type="number" inputmode="decimal" value="30" min="1" max="90"><span>Jahre</span></div>
    </label>
    <label>Körpergröße
     <div class="inputUnit"><input id="genHeight" type="number" inputmode="decimal" placeholder="z. B. 181"><span>cm</span></div>
    </label>
    <label>Gewicht
     <div class="inputUnit"><input id="genWeight" type="number" inputmode="decimal" placeholder="z. B. 82"><span>kg</span></div>
    </label>
    <label>Körperbau
     <select id="genBuild">
      <option value=".28">eher wenig Muskelmasse</option>
      <option value=".42">leicht / durchschnittlich</option>
      <option value=".52" selected>durchschnittlich</option>
      <option value=".68">athletisch</option>
      <option value=".84">stark muskulös</option>
     </select>
    </label>
   </div>

   <div class="generatorSectionTitle">DIE 3 KERNMASSE</div>
   <div class="measureCards">
    ${this.measureCard("genBust","Brustumfang","Um die stärkste Stelle von Brust/Brustkorb, Maßband waagerecht und nicht einschnüren.","cm",true)}
    ${this.measureCard("genWaist","Taillenumfang","An der natürlichen Taille messen; entspannt stehen und normal ausatmen.","cm",true)}
    ${this.measureCard("genTorso","Schulter → Schritt","Vom Schulter-/Halsansatz entlang des Torsos bis zum Schritt. Für unsere erste Kalibrierung nutzen wir im Mesh die kombinierte MakeHuman-Torsolänge als Proxy.","cm",true)}
   </div>

   <div class="generatorSectionTitle">OPTIONALE KONTROLLMASSE</div>
   <div class="generatorIntro compact">
    Wert eintragen und den Schalter <b>„zum Generieren“</b> aus lassen: Dann kennt der Solver das Maß nicht
    und wir sehen anschließend seinen echten Vorhersagefehler.
   </div>
   <div class="measureCards">
    ${this.optionalCard("genHip","Hüftumfang","Stärkste Stelle über Hüfte/Gesäß.","measure-hips-circ")}
    ${this.optionalCard("genUnderbust","Unterbrustumfang","Direkt unter der Brust, horizontal.","measure-underbust-circ")}
    ${this.optionalCard("genShoulder","Schulterbreite","Gerade Strecke zwischen den äußeren Schulterpunkten. Dieser MakeHuman-Messpfad muss noch gegen reale Messung kalibriert werden.","measure-shoulder-dist")}
   </div>

   <div class="generatorActions">
    <button id="genRun" class="primary">Modell generieren</button>
    <button id="genSaveProfile">Testprofil speichern</button>
    <button id="genExport" disabled>Report exportieren</button>
   </div>
   <div id="genProgress" class="generatorProgress hidden"></div>
   <div id="genResults" class="generatorResults"></div>
  `;
  this.panel.querySelector("#genClose").onclick=()=>this.panel.classList.add("hidden");
  this.panel.querySelector("#genRun").onclick=()=>this.run();
  this.panel.querySelector("#genSaveProfile").onclick=()=>this.saveProfile();
  this.panel.querySelector("#genExport").onclick=()=>this.exportReport();
 }
 measureCard(id,title,help,unit,required){
  return `<div class="measureCard">
   <div class="measureCardHead"><strong>${title}</strong><span>${required?"Pflicht":"optional"}</span></div>
   <p>${help}</p>
   <div class="inputUnit"><input id="${id}" type="number" inputmode="decimal" placeholder="–"><span>${unit}</span></div>
  </div>`;
 }
 optionalCard(id,title,help,target){
  return `<div class="measureCard" data-target="${target}">
   <div class="measureCardHead"><strong>${title}</strong><label class="useToggle"><input id="${id}Use" type="checkbox"> zum Generieren</label></div>
   <p>${help}</p>
   <div class="inputUnit"><input id="${id}" type="number" inputmode="decimal" placeholder="Kontrollwert"><span>cm</span></div>
  </div>`;
 }
 renderResultsPlaceholder(){
  const box=this.panel.querySelector("#genResults");
  if(box && !box.innerHTML.trim())box.innerHTML='<div class="emptyResult">Maße eingeben und „Modell generieren“ wählen.</div>';
 }
 getInput(){
  const q=id=>numberValue(this.panel.querySelector("#"+id));
  return {
   gender:q("genGender"), age:q("genAge"), height:q("genHeight"), weight:q("genWeight"),
   build:q("genBuild"), bust:q("genBust"), waist:q("genWaist"), torso:q("genTorso"),
   hip:q("genHip"), underbust:q("genUnderbust"), shoulder:q("genShoulder"),
   useHip:this.panel.querySelector("#genHipUse").checked,
   useUnderbust:this.panel.querySelector("#genUnderbustUse").checked,
   useShoulder:this.panel.querySelector("#genShoulderUse").checked
  };
 }
 validate(v){
  const missing=[];
  for(const [k,label] of [["height","Körpergröße"],["weight","Gewicht"],["bust","Brustumfang"],["waist","Taillenumfang"],["torso","Schulter→Schritt"]]){
   if(v[k]===null || v[k]<=0)missing.push(label);
  }
  if(v.age===null || v.age<1 || v.age>90)missing.push("Alter 1–90");
  if(missing.length)throw new Error("Bitte ausfüllen: "+missing.join(", "));
  if(v.height<130 || v.height>230)throw new Error("Körpergröße liegt außerhalb des vorgesehenen Testbereichs 130–230 cm.");
  if(v.weight<35 || v.weight>250)throw new Error("Gewicht liegt außerhalb des vorgesehenen Testbereichs 35–250 kg.");
 }
 ageToSlider(y){return y<=25?(y-1)/48:.5+(y-25)/130}
 async tick(label,detail){
  const p=this.panel.querySelector("#genProgress");
  p.classList.remove("hidden");p.innerHTML=`<b>${esc(label)}</b><span>${esc(detail||"")}</span>`;
  await new Promise(r=>setTimeout(r,25));
 }
 metric(name){
  if(name==="height")return this.engine.heightCm();
  if(name==="weight")return this.engine.weightKg();
  if(name==="torso")return this.engine.torsoProxyCm();
  return this.engine.getMeasureCm(name);
 }
 async solveCore(prop,target,metricName,min=0,max=1){
  let v=clamp(this.engine.state[prop],min,max);
  for(let iter=0;iter<4;iter++){
   this.engine.state[prop]=v;
   this.engine.updateBody({normals:false,metrics:false});
   const cur=this.metric(metricName);
   const step=.12;
   let probe=clamp(v+(cur<target?step:-step),min,max);
   if(Math.abs(probe-v)<.001)probe=clamp(v+(cur<target?-step:step),min,max);
   this.engine.state[prop]=probe;
   this.engine.updateBody({normals:false,metrics:false});
   const pm=this.metric(metricName);
   const slope=(pm-cur)/(probe-v||1);
   if(!Number.isFinite(slope)||Math.abs(slope)<.01){v=probe;continue}
   v=clamp(v+(target-cur)/slope,min,max);
   if(Math.abs(cur-target)<.15)break;
  }
  this.engine.state[prop]=v;
 }
 async solveDirect(targetName,targetCm,min=-1.8,max=1.8){
  const id=this.controlByTarget.get(targetName);
  if(!id)return {ok:false,reason:"kein MakeHuman-Regler"};
  let v=Number(this.engine.directState[id]||0);
  for(let iter=0;iter<3;iter++){
   this.engine.directState[id]=v;
   this.engine.updateBody({normals:false,metrics:false});
   const cur=this.metric(targetName);
   if(Math.abs(cur-targetCm)<.12)break;
   const step=.22;
   let probe=clamp(v+(cur<targetCm?step:-step),min,max);
   if(Math.abs(probe-v)<.001)probe=clamp(v+(cur<targetCm?-step:step),min,max);
   this.engine.directState[id]=probe;
   this.engine.updateBody({normals:false,metrics:false});
   const pm=this.metric(targetName);
   const slope=(pm-cur)/(probe-v||1);
   if(!Number.isFinite(slope)||Math.abs(slope)<.02){v=probe;continue}
   v=clamp(v+(targetCm-cur)/slope,min,max);
  }
  this.engine.directState[id]=v;
  return {ok:true,id,value:v};
 }
 async solveTorso(targetCm){
  const a=this.controlByTarget.get("measure-napetowaist-dist");
  const b=this.controlByTarget.get("measure-waisttohip-dist");
  if(!a||!b)return {ok:false,reason:"Torso-Regler fehlen"};
  let v=((this.engine.directState[a]||0)+(this.engine.directState[b]||0))/2;
  const min=-1.8,max=1.8;
  for(let iter=0;iter<3;iter++){
   this.engine.directState[a]=v;this.engine.directState[b]=v;
   this.engine.updateBody({normals:false,metrics:false});
   const cur=this.metric("torso");
   if(Math.abs(cur-targetCm)<.15)break;
   let probe=clamp(v+(cur<targetCm?.22:-.22),min,max);
   if(Math.abs(probe-v)<.001)probe=clamp(v+(cur<targetCm?-.22:.22),min,max);
   this.engine.directState[a]=probe;this.engine.directState[b]=probe;
   this.engine.updateBody({normals:false,metrics:false});
   const pm=this.metric("torso"),slope=(pm-cur)/(probe-v||1);
   if(!Number.isFinite(slope)||Math.abs(slope)<.02){v=probe;continue}
   v=clamp(v+(targetCm-cur)/slope,min,max);
  }
  this.engine.directState[a]=v;this.engine.directState[b]=v;
  return {ok:true,value:v};
 }
 async run(){
  const v=this.getInput();
  try{this.validate(v)}catch(err){alert(err.message);return}
  const runBtn=this.panel.querySelector("#genRun");
  runBtn.disabled=true;
  try{
   await this.tick("1 / 5 · Grundkörper","Alter, Körperbasis und Körperbau");
   this.engine.reset();
   this.engine.state.gender=v.gender;
   this.engine.state.age=clamp(this.ageToSlider(v.age),0,1);
   this.engine.state.muscle=clamp(v.build,0,1);
   this.engine.updateBody({normals:false,metrics:false});

   await this.tick("2 / 5 · Körpergröße","MakeHuman Height wird auf "+v.height.toFixed(1)+" cm optimiert");
   await this.solveCore("height",v.height,"height",0,1);

   await this.tick("3 / 5 · Gewicht","MakeHuman Weight wird auf ca. "+v.weight.toFixed(1)+" kg optimiert");
   await this.solveCore("weight",v.weight,"weight",0,1);

   await this.tick("4 / 5 · Torso","Brust, Taille und Torsohöhe");
   await this.solveDirect("measure-bust-circ",v.bust);
   await this.solveDirect("measure-waist-circ",v.waist);
   await this.solveTorso(v.torso);

   await this.tick("5 / 5 · Optionale Maße","Nur aktivierte Kontrollmaße beeinflussen das Modell");
   if(v.useHip && v.hip)await this.solveDirect("measure-hips-circ",v.hip);
   if(v.useUnderbust && v.underbust)await this.solveDirect("measure-underbust-circ",v.underbust);
   if(v.useShoulder && v.shoulder)await this.solveDirect("measure-shoulder-dist",v.shoulder);

   // One corrective pass because torso morphs influence each other.
   await this.solveDirect("measure-bust-circ",v.bust);
   await this.solveDirect("measure-waist-circ",v.waist);
   if(v.useHip && v.hip)await this.solveDirect("measure-hips-circ",v.hip);

   this.engine.updateBody();
   this.ui.sync();
   this.engine.computeMetrics();
   this.makeReport(v);
   this.renderReport();
   this.panel.querySelector("#genExport").disabled=false;
  }catch(err){
   console.error(err);
   alert("Generatorfehler: "+(err&&err.message||err));
  }finally{
   runBtn.disabled=false;
   this.panel.querySelector("#genProgress").classList.add("hidden");
  }
 }
 currentOutputs(){
  return {
   height:this.engine.heightCm(),
   weight:this.engine.weightKg(),
   bust:this.engine.getMeasureCm("measure-bust-circ"),
   waist:this.engine.getMeasureCm("measure-waist-circ"),
   torso:this.engine.torsoProxyCm(),
   hip:this.engine.getMeasureCm("measure-hips-circ"),
   underbust:this.engine.getMeasureCm("measure-underbust-circ"),
   shoulder:this.engine.getMeasureCm("measure-shoulder-dist")
  };
 }
 makeReport(v){
  const o=this.currentOutputs();
  const rows=[
   {key:"height",label:"Körpergröße",target:v.height,actual:o.height,used:true,unit:"cm"},
   {key:"weight",label:"Gewicht",target:v.weight,actual:o.weight,used:true,unit:"kg"},
   {key:"bust",label:"Brustumfang",target:v.bust,actual:o.bust,used:true,unit:"cm"},
   {key:"waist",label:"Taillenumfang",target:v.waist,actual:o.waist,used:true,unit:"cm"},
   {key:"torso",label:"Schulter → Schritt",target:v.torso,actual:o.torso,used:true,unit:"cm",proxy:true}
  ];
  if(v.hip)rows.push({key:"hip",label:"Hüftumfang",target:v.hip,actual:o.hip,used:v.useHip,unit:"cm"});
  if(v.underbust)rows.push({key:"underbust",label:"Unterbrustumfang",target:v.underbust,actual:o.underbust,used:v.useUnderbust,unit:"cm"});
  if(v.shoulder)rows.push({key:"shoulder",label:"Schulterbreite",target:v.shoulder,actual:o.shoulder,used:v.useShoulder,unit:"cm",calibration:true});
  this.lastReport={
   build:"BODY LAB v3.1.0",
   createdAt:new Date().toISOString(),
   inputs:v,rows,
   state:this.engine.snapshot(),
   notes:{
    torso:"V3.1 verwendet als Mesh-Proxy measure-napetowaist-dist + measure-waisttohip-dist.",
    shoulder:"MakeHuman measure-shoulder-dist wird noch gegen die reale Selbstmessmethode kalibriert.",
    weight:"Gewicht ist der MakeHuman-artige Mesh/BSA-Schätzwert der App."
   }
  };
 }
 renderReport(){
  const r=this.lastReport,box=this.panel.querySelector("#genResults");
  const body=r.rows.map(x=>{
   const err=x.actual-x.target,ae=Math.abs(err);
   const cls=ae<=.5?"good":ae<=1.5?"okay":"warn";
   const kind=x.used?"INPUT":"KONTROLLE";
   return `<div class="resultRow ${cls}">
    <div><strong>${esc(x.label)}</strong><small>${kind}${x.proxy?" · PROXY":""}${x.calibration?" · KALIBRIEREN":""}</small></div>
    <span>${x.target.toFixed(1)} ${x.unit}</span>
    <span>${x.actual.toFixed(1)} ${x.unit}</span>
    <b>${err>=0?"+":""}${err.toFixed(1)}</b>
   </div>`;
  }).join("");
  box.innerHTML=`
   <div class="resultHeader"><span>Maß</span><span>Ziel</span><span>Mesh</span><span>Δ</span></div>
   ${body}
   <div class="resultLegend">
    <b>Kontrolle</b> bedeutet: Das Maß wurde nicht zur Generierung benutzt.
    Genau diese Fehler sind für unseren späteren Minimal-Fragebogen besonders interessant.
   </div>`;
 }
 saveProfile(){
  const v=this.getInput();
  const name=prompt("Name des Testprofils","Testkörper "+new Date().toLocaleDateString());
  if(!name)return;
  let all={};try{all=JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")}catch(e){}
  all[name]={savedAt:new Date().toISOString(),inputs:v,report:this.lastReport};
  localStorage.setItem(PROFILE_KEY,JSON.stringify(all));
  alert("Testprofil gespeichert.");
 }
 exportReport(){
  if(!this.lastReport)return;
  const blob=new Blob([JSON.stringify(this.lastReport,null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download="Body-Lab-v3.1-Measurement-Report.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
}
