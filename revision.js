
const UI_KEY="bodylab_v3_ui",MARK_KEY="bodylab_v3_marks";
export class RevisionManager{
 constructor(engine,registry){this.engine=engine;this.registry=registry;this.mode=false;this.config=this.load(UI_KEY,{});this.marks=this.load(MARK_KEY,[])}
 load(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(e){return f}}
 save(){localStorage.setItem(UI_KEY,JSON.stringify(this.config));localStorage.setItem(MARK_KEY,JSON.stringify(this.marks))}
 defaultTier(id){return["gender","age","weight","muscle","height","proportions","breastSize","breastFirmness"].includes(id)?"main":"advanced"}
 defaultUnit(id,c){if(id==="weight")return"kg";if(id==="height")return"cm";if(id==="age")return"Jahre";if(c.target&&this.engine.metrics.measures&&this.engine.metrics.measures[c.target]!==undefined)return"cm";return""}
 currentValue(id,c){
  const m=this.engine.metrics||{};
  if(id==="weight"&&m.weightKg)return m.weightKg.toFixed(1)+" kg";
  if(id==="height"&&m.heightCm)return m.heightCm.toFixed(1)+" cm";
  if(id==="age")return this.engine.ageYears(this.engine.state.age).toFixed(0)+" Jahre";
  if(c.target&&m.measures&&m.measures[c.target]!==undefined)return m.measures[c.target].toFixed(1)+" cm";
  return [c.tech.textContent,c.real.textContent].filter(Boolean).join(" · ");
 }
 attach(c){
  if(c.rev)return;
  const r=document.createElement("div");r.className="revisionRow";
  r.innerHTML='<div class="revisionGrid"><label>Anzeige<select class="tier"><option value="main">Hauptansicht</option><option value="fine">Feinanpassung</option><option value="advanced">Advanced</option></select></label><label>Anzeigename<input class="label"></label><label>Referenzwert<input class="reference" inputmode="decimal"></label><label>Einheit<input class="unit"></label></div><label>Notiz<textarea class="note"></textarea></label><div class="revisionAuto">Aktueller Wert: –</div><div class="revisionButtons"><button class="saveUI">UI speichern</button><button class="saveMark">Marke speichern</button></div>';
  c.wrap.append(r);c.rev=r;this.fill(c);
  r.querySelector(".saveUI").onclick=()=>{this.config[c.id]={tier:r.querySelector(".tier").value,label:r.querySelector(".label").value.trim()||c.label.textContent,unit:r.querySelector(".unit").value.trim(),note:r.querySelector(".note").value.trim()};this.save();this.applyLayout();this.refresh()};
  r.querySelector(".saveMark").onclick=()=>{let ref=r.querySelector(".reference").value.trim();if(!ref)ref=this.currentValue(c.id,c).replace(/[^\d.,-]/g,"");if(!ref)return alert("Bitte Referenzwert eingeben.");this.marks.push({id:c.id,label:r.querySelector(".label").value.trim()||c.label.textContent,reference:ref,unit:r.querySelector(".unit").value.trim(),autoValue:this.currentValue(c.id,c),note:r.querySelector(".note").value.trim(),capturedAt:new Date().toISOString(),state:this.engine.snapshot()});this.save();r.querySelector(".reference").value="";r.querySelector(".revisionAuto").textContent="Marke gespeichert · "+this.currentValue(c.id,c)}
 }
 fill(c){if(!c.rev)return;const cfg=this.config[c.id]||{},r=c.rev;r.querySelector(".tier").value=cfg.tier||this.defaultTier(c.id);r.querySelector(".label").value=cfg.label||c.label.textContent;r.querySelector(".unit").value=cfg.unit!==undefined?cfg.unit:this.defaultUnit(c.id,c);r.querySelector(".note").value=cfg.note||"";r.querySelector(".revisionAuto").textContent="Aktueller Wert: "+this.currentValue(c.id,c)}
 refresh(){for(const c of this.registry.values())this.fill(c)}
 toggle(){this.mode=!this.mode;document.body.classList.toggle("revisionMode",this.mode);const b=document.getElementById("revisionToggle");b.classList.toggle("active",this.mode);b.textContent=this.mode?"Revision ✓":"Revision";if(this.mode)this.refresh()}
 applyLayout(){
  const main=document.getElementById("mainExtraControls"),fine=document.getElementById("fineControls");let mc=0,fc=0;
  for(const c of this.registry.values()){
   if(c.originalParent.id==="coreControls")continue;
   const tier=(this.config[c.id]&&this.config[c.id].tier)||this.defaultTier(c.id);
   if(tier==="main"){main.append(c.wrap);mc++}else if(tier==="fine"){fine.append(c.wrap);fc++}else c.originalParent.append(c.wrap);
   if(this.config[c.id]&&this.config[c.id].label)c.label.textContent=this.config[c.id].label;
  }
  document.getElementById("mainExtraSection").classList.toggle("hidden",mc===0);document.getElementById("fineSection").classList.toggle("hidden",fc===0);document.getElementById("fineCount").textContent=fc;
 }
 export(){
  const blob=new Blob([JSON.stringify({build:"BODY LAB v3.0.0",exportedAt:new Date().toISOString(),ui:this.config,marks:this.marks},null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="Body-Lab-v3-REVISION.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)
 }
}
