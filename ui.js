
import {GROUP_LABELS} from "./labels.js";
import {RevisionManager} from "./revision.js";

export class BodyUI{
 constructor(engine){
  this.engine=engine;this.registry=new Map();this.revision=new RevisionManager(engine,this.registry);this.groupsBuilt=false;this.userPresets=this.loadPresets();
  this.bindSheet();this.bindTop();this.buildCore();this.buildPresets();
  addEventListener("body-metrics",e=>this.updateMetrics(e.detail));
 }
 register(id,label,parent,min,max,value,get,set,opts){
  const wrap=document.createElement("div");wrap.className="controlWrap";wrap.dataset.search=(label+" "+(opts.target||"")).toLowerCase();
  const row=document.createElement("div");row.className="controlRow";
  const lab=document.createElement("span");lab.className="controlLabel";lab.textContent=label;
  const range=document.createElement("input");range.type="range";range.min=min;range.max=max;range.step=.01;range.value=value;
  const vb=document.createElement("div");vb.className="valueBox";const tech=document.createElement("button");tech.className="techValue";const real=document.createElement("span");real.className="realValue";vb.append(tech,real);
  row.append(lab,range,vb);wrap.append(row);parent.append(wrap);
  const c={id,wrap,row,label:lab,range,tech,real,originalParent:parent,target:opts.target||"",get,set,default:value,defaultMin:min,defaultMax:max};
  const fmt=()=>opts.display?opts.display(+range.value):Math.round(+range.value*100)+"%";tech.textContent=fmt();
  range.oninput=()=>{set(+range.value);tech.textContent=fmt();this.engine.updateBody()};
  if(opts.overdrive){
   tech.title="Tippen: Sliderbereich ändern";
   tech.onclick=()=>{const mn=prompt("Min %",Math.round(+range.min*100));if(mn===null)return;const mx=prompt("Max %",Math.round(+range.max*100));if(mx===null)return;let a=Number(mn),b=Number(mx);if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return;range.min=a/100;range.max=b/100}
  }else tech.disabled=true;
  this.registry.set(id,c);this.revision.attach(c);return c;
 }
 buildCore(){
  const p=document.getElementById("coreControls"),s=this.engine.state,pct=v=>Math.round(v*100)+"%";
  this.register("gender","Female ↔ Male",p,0,1,s.gender,()=>s.gender,v=>s.gender=v,{display:pct,overdrive:true});
  this.register("age","Age",p,0,1,s.age,()=>s.age,v=>s.age=v,{display:pct});
  this.register("weight","Weight",p,0,1,s.weight,()=>s.weight,v=>s.weight=v,{display:pct,overdrive:true});
  this.register("muscle","Muscle",p,0,1,s.muscle,()=>s.muscle,v=>s.muscle=v,{display:pct,overdrive:true});
  this.register("height","Height",p,0,1,s.height,()=>s.height,v=>s.height=v,{display:pct,overdrive:true});
  this.register("proportions","Body proportions",p,0,1,s.proportions,()=>s.proportions,v=>s.proportions=v,{display:pct,overdrive:true});
  this.register("breastSize","Breast size",p,0,1,s.breastSize,()=>s.breastSize,v=>s.breastSize=v,{display:pct,overdrive:true});
  this.register("breastFirmness","Breast firmness",p,0,1,s.breastFirmness,()=>s.breastFirmness,v=>s.breastFirmness=v,{display:pct,overdrive:true});
 }
 buildAdvanced(){
  if(this.groupsBuilt)return;
  let count=0,fc=0;
  const host=document.getElementById("bodyGroups");
  const fh=document.getElementById("faceGroups");

  for(const g of this.engine.groups||[]){
   if(!g || !Array.isArray(g.controls))continue;
   const d=document.createElement("details");
   d.className="group";
   const sum=document.createElement("summary");
   const t=document.createElement("span");
   const b=document.createElement("b");
   const groupBody=document.createElement("div");
   groupBody.className="groupBody";
   t.textContent=GROUP_LABELS[g.id]||this.humanize(g.id);
   b.textContent=String(g.controls.length);
   sum.append(t,b);
   d.append(sum,groupBody);
   host.append(d);

   for(const x of g.controls){
    if(!x || !x.id)continue;
    try{
     this.engine.directState[x.id]=0;
     this.register(
      x.id,this.humanize(x.target),groupBody,x.oneWay?0:-1,1,0,
      ()=>this.engine.directState[x.id],
      v=>this.engine.directState[x.id]=v,
      {target:x.target,overdrive:true}
     );
     count++;
    }catch(err){
     console.warn("Body control skipped",x.id,err);
    }
   }
  }

  for(const g of this.engine.faceGroups||[]){
   if(!g || !Array.isArray(g.controls))continue;
   const d=document.createElement("details");
   d.className="group";
   const sum=document.createElement("summary");
   const t=document.createElement("span");
   const b=document.createElement("b");
   const groupBody=document.createElement("div");
   groupBody.className="groupBody";
   t.textContent=this.humanize(g.id);
   b.textContent=String(g.controls.length);
   sum.append(t,b);
   d.append(sum,groupBody);
   fh.append(d);

   for(const x of g.controls){
    if(!x || !x.id)continue;
    try{
     this.engine.faceState[x.id]=0;
     this.register(
      x.id,this.humanize(x.target),groupBody,x.oneWay?0:-1,1,0,
      ()=>this.engine.faceState[x.id],
      v=>this.engine.faceState[x.id]=v,
      {target:x.target,overdrive:true}
     );
     fc++;
    }catch(err){
     console.warn("Face control skipped",x.id,err);
    }
   }
  }

  document.getElementById("advancedCount").textContent=count+" Body";
  document.getElementById("faceCount").textContent=String(fc);
  document.getElementById("controlCount").textContent=this.registry.size+" MakeHuman-Regler";
  this.revision.applyLayout();
  this.bindSearch();
  this.groupsBuilt=true;
 }
 humanize(s){return String(s).replace(/^measure-/,"").replace(/-/g," ").replace(/\b\w/g,m=>m.toUpperCase())}
 updateMetrics(m){
  document.getElementById("statHeight").textContent=m.heightCm.toFixed(1)+" cm";document.getElementById("statWeight").textContent="≈ "+m.weightKg.toFixed(1)+" kg";document.getElementById("statBsa").textContent=m.bsa.toFixed(2)+" m²";document.getElementById("statVolume").textContent="≈ "+m.volumeL.toFixed(1)+" L";
  for(const [id,c] of this.registry){if(id==="age")c.real.textContent=m.ageYears.toFixed(0)+" Jahre";else if(id==="height")c.real.textContent=m.heightCm.toFixed(1)+" cm";else if(id==="weight")c.real.textContent="≈ "+m.weightKg.toFixed(1)+" kg";else if(c.target&&m.measures[c.target]!==undefined)c.real.textContent=m.measures[c.target].toFixed(1)+" cm";else c.real.textContent=""}
  if(this.revision.mode)this.revision.refresh();
 }
 sync(){
  for(const [id,c] of this.registry){let v;if(this.engine.state[id]!==undefined)v=this.engine.state[id];else if(this.engine.directState[id]!==undefined)v=this.engine.directState[id];else if(this.engine.faceState[id]!==undefined)v=this.engine.faceState[id];if(v!==undefined){c.range.value=v;c.tech.textContent=Math.round(v*100)+"%"}}
 }
 bindTop(){
  document.getElementById("revisionToggle").onclick=()=>this.revision.toggle();
  document.getElementById("revisionToggle").oncontextmenu=e=>{e.preventDefault();this.revision.export()};
  document.getElementById("resetBtn").onclick=()=>{this.engine.reset();this.sync()};
  document.getElementById("neutralPoseBtn").onclick=()=>this.engine.updateBody();
 }
 bindSheet(){
  const sheet=document.getElementById("sheet"),handle=document.getElementById("handle");let top=innerHeight*.52,drag=false,sy=0,st=0;
  const set=y=>{top=Math.max(12,Math.min(innerHeight-88,y));sheet.style.setProperty("--sheetTop",top+"px")};set(top);
  handle.onpointerdown=e=>{drag=true;sy=e.clientY;st=top;handle.setPointerCapture(e.pointerId)};
  handle.onpointermove=e=>{if(drag)set(st+e.clientY-sy)};
  handle.onpointerup=handle.onpointercancel=()=>drag=false;
 }
 bindSearch(){
  const inp=document.getElementById("searchInput");inp.oninput=()=>{const q=inp.value.trim().toLowerCase();document.querySelectorAll("#bodyGroups .controlWrap,#faceGroups .controlWrap").forEach(w=>w.classList.toggle("hidden",!!q&&!w.dataset.search.includes(q)))};
  let open=false;document.getElementById("openAllBtn").onclick=()=>{open=!open;document.querySelectorAll("#bodyGroups details,#faceGroups details").forEach(d=>d.open=open);document.getElementById("openAllBtn").textContent=open?"Alle schließen":"Alle öffnen"};
 }
 buildPresets(){
  const presets={Neutral:{gender:.5,age:.5,weight:.5,muscle:.5,height:.5,proportions:.5,breastSize:.5,breastFirmness:.5},Male:{gender:1,age:.5,weight:.5,muscle:.5,height:.58,proportions:.5,breastSize:.5,breastFirmness:.5},Female:{gender:0,age:.5,weight:.5,muscle:.42,height:.46,proportions:.5,breastSize:.5,breastFirmness:.5},Muscular:{gender:1,age:.5,weight:.52,muscle:.88,height:.62,proportions:.58,breastSize:.5,breastFirmness:.5}};
  const h=document.getElementById("builtInPresets");for(const [name,p] of Object.entries(presets)){const b=document.createElement("button");b.textContent=name;b.onclick=()=>{Object.assign(this.engine.state,p);for(const k in this.engine.directState)this.engine.directState[k]=0;for(const k in this.engine.faceState)this.engine.faceState[k]=0;this.engine.updateBody();this.sync()};h.append(b)}
  document.getElementById("presetSaveBtn").onclick=()=>{const n=document.getElementById("presetName").value.trim();if(!n)return;this.userPresets[n]=this.engine.snapshot();localStorage.setItem("bodylab_v3_presets",JSON.stringify(this.userPresets));document.getElementById("presetName").value="";this.renderUserPresets()};this.renderUserPresets();
 }
 loadPresets(){try{return JSON.parse(localStorage.getItem("bodylab_v3_presets")||"{}")}catch(e){return{}}}
 renderUserPresets(){const h=document.getElementById("userPresets");h.innerHTML="";for(const [n,s] of Object.entries(this.userPresets)){const b=document.createElement("button");b.textContent=n;b.onclick=()=>{this.engine.restore(s);this.sync()};h.append(b)}}
}
