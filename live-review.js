
import * as THREE from "three";
import {MEASURES} from "./measure-review.js?v=4.0.1";

const KEY="bodylab_live_manual_review_v330";
const fmt=x=>Number.isFinite(x)?x.toFixed(2):"—";
const TARGET_MAP={
 chest:"chest",waist:"waist",hip:"hip",shoulder:"shoulder",torso:"torso",neck:"neck",neckBase:"neckBase",
 wrist:"wrist",thigh:"thigh",calf:"calf",ankle:"ankle",chestBreadth:"chestBreadth",chestDepth:"chestDepth",
 waistBreadth:"waistBreadth",waistDepth:"waistDepth",hipBreadth:"hipBreadth",waistBackLength:"waistBackLength",
 upperarmCirc:"upperarmCirc",upperarmLength:"upperarmLength",lowerarmLength:"lowerarmLength",
 lowerlegHeight:"lowerlegHeight",upperlegHeight:"upperlegHeight"
};

function isFiniteN(x){return Number.isFinite(+x)}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

export class LiveManualReview{
 constructor(engine,batch,calibration,measureReview){
  this.engine=engine;this.batch=batch;this.calibration=calibration;this.measureReview=measureReview;
  this.panel=document.getElementById("liveReviewPanel");this.button=document.getElementById("liveReviewToggle");
  this.rows=[];this.index=0;this.selected="chestDepth";this.busy=false;this.review=this.load();
  this.group=new THREE.Group();this.group.visible=false;this.group.renderOrder=95;engine.scene.add(this.group);
  this.hitMeshes=[];this.pointerDown=null;
  this.build();this.bindResizablePanel();this.bind3D();
  this.button.disabled=false;this.button.onclick=()=>this.toggle();
 }
 load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return {}}}
 save(){localStorage.setItem(KEY,JSON.stringify(this.review))}
 chooseRows(){
  const all=(this.batch?.rows||[]).filter(r=>[r.height,r.weight,r.chest,r.waist,r.hip].every(isFiniteN));
  const F=all.filter(r=>r.gender===0),M=all.filter(r=>r.gender===1),out=[];
  for(let i=0;i<5;i++){if(F[i])out.push(F[i]);if(M[i])out.push(M[i])}
  return out.slice(0,10);
 }
 build(){
  this.panel.innerHTML=`
   <div class="mrSheetHandle" id="lmrHandle"><span></span></div>
   <div class="lmrScroll">
   <div class="lmrHead">
    <div><div class="sectionLabel">LIVE-MESS-REVISION · V4.0.1</div><h2>10 Personen manuell prüfen</h2>
    <p>Studienwert ↔ aktuelles Mesh. Markierung am Modell oder Tabellenzeile antippen.</p></div>
    <button id="lmrClose">Schließen</button>
   </div>
   <div class="lmrPersonBar">
    <button id="lmrPrev">‹</button>
    <div><b id="lmrPerson">Person –/10</b><small id="lmrSex">–</small></div>
    <button id="lmrNext">›</button>
   </div>
   <div class="lmrActions">
    <button id="lmrBuild" class="primary">Aktuelle Person mit V3.29 aufbauen</button>
    <button id="lmrBaseline">Nur Ausgangsform</button>
   </div>
   <div id="lmrStatus" class="batchInfo"><b>Bereit</b><span>Datensatz wird beim Öffnen zusammengestellt.</span></div>
   <div class="lmrSelected" id="lmrSelected"></div>
   <div class="lmrTableWrap"><table class="lmrTable">
    <thead><tr><th>Maß</th><th>Studie</th><th>Mesh</th><th>Δ</th></tr></thead><tbody id="lmrRows"></tbody>
   </table></div>
   <div class="lmrFooter">
    <button data-v="ok">✓ plausibel</button><button data-v="bad">✕ falsch</button><button data-v="unclear">? unklar</button>
    <textarea id="lmrNote" placeholder="Notiz zu diesem Maß / dieser Person"></textarea>
   </div>
   </div>`;
  this.panel.querySelector("#lmrClose").onclick=()=>this.toggle(false);
  this.panel.querySelector("#lmrPrev").onclick=()=>this.setPerson(this.index-1);
  this.panel.querySelector("#lmrNext").onclick=()=>this.setPerson(this.index+1);
  this.panel.querySelector("#lmrBuild").onclick=()=>this.buildCurrent(true);
  this.panel.querySelector("#lmrBaseline").onclick=()=>this.buildCurrent(false);
  this.panel.querySelectorAll(".lmrFooter button[data-v]").forEach(b=>b.onclick=()=>this.mark(b.dataset.v));
  this.panel.querySelector("#lmrNote").oninput=()=>this.note();
 }
 bindResizablePanel(){
  const handle=this.panel.querySelector("#lmrHandle");
  let top=Math.max(90,window.innerHeight*.42),drag=false,sy=0,st=0;
  const set=y=>{
   top=Math.max(72,Math.min(window.innerHeight-105,y));
   this.panel.style.setProperty("--lmrTop",top+"px");
  };
  set(top);
  handle.onpointerdown=e=>{
   drag=true;sy=e.clientY;st=top;
   handle.setPointerCapture?.(e.pointerId);
   e.preventDefault();
  };
  handle.onpointermove=e=>{
   if(!drag)return;
   set(st+e.clientY-sy);
   e.preventDefault();
  };
  handle.onpointerup=handle.onpointercancel=()=>drag=false;
  window.addEventListener("resize",()=>set(Math.min(top,window.innerHeight-105)));
 }
 key(){
  const r=this.rows[this.index];return r?`${r.sourceRow??this.index}:${this.selected}`:`${this.index}:${this.selected}`
 }
 note(){
  const k=this.key(),q=this.review[k]||(this.review[k]={});q.note=this.panel.querySelector("#lmrNote").value;q.updatedAt=new Date().toISOString();this.save()
 }
 mark(status){
  const k=this.key(),q=this.review[k]||(this.review[k]={});q.status=status;q.note=this.panel.querySelector("#lmrNote").value;q.updatedAt=new Date().toISOString();this.save();this.renderTable();this.renderSelected()
 }
 toggle(force){
  const show=force===undefined?this.panel.classList.contains("hidden"):!!force;
  this.panel.classList.toggle("hidden",!show);this.group.visible=show;
  this.button.classList.toggle("active",show);
  if(show){
   this.rows=this.chooseRows();
   if(!this.rows.length){this.panel.querySelector("#lmrStatus").innerHTML="<b>Kein Datensatz</b><span>Bitte zuerst ANSUR/Testdaten im Batch laden.</span>";return}
   this.index=Math.min(this.index,this.rows.length-1);this.refresh();this.drawAll();
  }
 }
 async setPerson(i){
  if(this.busy||!this.rows.length)return;
  this.index=(i+this.rows.length)%this.rows.length;
  await this.buildCurrent(false);
 }
 async buildCurrent(runFit){
  if(this.busy||!this.rows.length)return;this.busy=true;
  const r=this.rows[this.index],st=this.panel.querySelector("#lmrStatus");
  try{
   st.innerHTML=`<b>Person ${this.index+1}/10 wird aufgebaut …</b><span>${r.gender===0?"Frau":"Mann"} · Datensatz ${esc(r.sourceRow)}</span>`;
   await this.calibration.meshFit.baseline(r);
   if(runFit){
    const live=this.calibration.panel?.querySelector("#fit29Live");const old=live?.checked;if(live)live.checked=false;
    await this.calibration.meshFit.fitV329Person(r,this.index+1);
    if(live)live.checked=old;
   }
   this.engine.computeMetrics();this.refresh();this.drawAll();
   st.innerHTML=`<b>${runFit?"V3.29-Rekonstruktion":"Ausgangsform"} geladen</b><span>Tippe eine Markierung oder Tabellenzeile an.</span>`;
  }catch(e){
   console.error(e);st.innerHTML=`<b>Fehler</b><span>${esc(e?.message||e)}</span>`;
  }finally{this.busy=false}
 }
 currentActual(id){
  const e=this.engine;
  if(id==="chest")return e.getMeasureCm("measure-bust-circ");
  if(id==="waist")return e.getMeasureCm("measure-waist-circ");
  if(id==="hip")return e.getMeasureCm("measure-hips-circ");
  if(id==="shoulder")return e.shoulderBreadthCm();
  if(id==="torso")return e.shoulderToCrotchCm();
  if(id==="neck")return e.neckCircCm();
  if(id==="neckBase")return e.neckBaseCm();
  if(id==="wrist")return e.getMeasureCm("measure-wrist-circ");
  if(id==="thigh")return e.getMeasureCm("measure-thigh-circ");
  if(id==="calf")return e.getMeasureCm("measure-calf-circ");
  if(id==="ankle")return e.getMeasureCm("measure-ankle-circ");
  if(id==="upperarmCirc")return e.getMeasureCm("measure-upperarm-circ");
  if(id==="upperarmLength")return e.getMeasureCm("measure-upperarm-length");
  if(id==="lowerarmLength")return e.getMeasureCm("measure-lowerarm-length");
  if(id==="lowerlegHeight")return e.getMeasureCm("measure-lowerleg-height");
  if(id==="upperlegHeight")return e.getMeasureCm("measure-upperleg-height");
  if(id==="waistBackLength")return e.getMeasureCm("measure-napetowaist-dist");
  if(id==="frontChest")return e.getMeasureCm("measure-frontchest-dist");
  if(id==="neckHeight")return e.getMeasureCm("measure-neck-height");
  if(id==="shoulderDist")return e.getMeasureCm("measure-shoulder-dist");
  if(id==="waistToHip")return e.getMeasureCm("measure-waisttohip-dist");
  const h=e.harnessBlindMetrics();
  return h[id];
 }
 target(id){
  const r=this.rows[this.index],k=TARGET_MAP[id];return k&&r?+r[k]:NaN
 }
 sexProtocol(m){
  const r=this.rows[this.index];
  if(m.id!=="chestDepth")return "";
  return r?.gender===0
   ? "GESCHLECHTSSPEZIFISCH: Bei Frauen muss die ANSUR-Brusttiefe bis zum vorderen Bustpoint interpretiert werden. Sie darf nicht als reine knöcherne Thorax-Tiefe plus zusätzliche Brust doppelt angesetzt werden."
   : "GESCHLECHTSSPEZIFISCH: Bei Männern bezieht sich die Brusttiefe auf den anterioren Chest-Point; hier ist der direkte Torso-/Thorax-Tiefenvergleich wesentlich näher an der Referenz.";
 }
 refresh(){
  const r=this.rows[this.index];if(!r)return;
  this.panel.querySelector("#lmrPerson").textContent=`Person ${this.index+1}/${this.rows.length}`;
  this.panel.querySelector("#lmrSex").textContent=`${r.gender===0?"FRAU":"MANN"} · ID ${r.sourceRow??"—"} · ${fmt(r.height)} cm · ${fmt(r.weight)} kg`;
  this.renderTable();this.renderSelected();
 }
 renderTable(){
  const body=this.panel.querySelector("#lmrRows"),r=this.rows[this.index];if(!r)return;
  body.innerHTML=MEASURES.map(m=>{
   const t=this.target(m.id),a=this.currentActual(m.id),d=Number.isFinite(t)&&Number.isFinite(a)?a-t:NaN,q=this.review[`${r.sourceRow??this.index}:${m.id}`]||{};
   return `<tr data-id="${m.id}" class="${m.id===this.selected?"active":""} ${q.status||""}">
    <td><b>${esc(m.title)}</b><small>${esc(m.ansur)}</small></td>
    <td>${fmt(t)}</td><td>${fmt(a)}</td><td class="${Number.isFinite(d)&&Math.abs(d)>2?"warn":""}">${Number.isFinite(d)?(d>=0?"+":"")+d.toFixed(2):"—"}</td>
   </tr>`}).join("");
  body.querySelectorAll("tr").forEach(tr=>tr.onclick=()=>this.select(tr.dataset.id));
 }
 renderSelected(){
  const m=MEASURES.find(x=>x.id===this.selected)||MEASURES[0],r=this.rows[this.index],t=this.target(m.id),a=this.currentActual(m.id),d=Number.isFinite(t)&&Number.isFinite(a)?a-t:NaN;
  const q=this.review[this.key()]||{},sex=this.sexProtocol(m);
  this.panel.querySelector("#lmrSelected").innerHTML=`
   <div class="lmrSelTitle"><div><h3>${esc(m.title)}</h3><small>${esc(m.ansur)} · ${esc(m.confidence)}</small></div>
   <div class="lmrBig"><b>${fmt(t)}</b><span>Studie</span><b>${fmt(a)}</b><span>Mesh</span><b>${Number.isFinite(d)?(d>=0?"+":"")+d.toFixed(2):"—"}</b><span>Δ cm</span></div></div>
   ${sex?`<div class="lmrSexNote">${esc(sex)}</div>`:""}
   <details open><summary>So ist das Maß gemeint</summary><p>${esc(m.simple)}</p></details>
   <details><summary>ANSUR / Referenzmethode – Wortlaut der Revision</summary><p>${esc(m.protocol)}</p></details>
   <details><summary>Body Lab – aktueller Messpfad</summary><p>${esc(m.bodylab)}</p></details>`;
  this.panel.querySelector("#lmrNote").value=q.note||"";
 }
 select(id){
  this.selected=id;this.refresh();this.drawAll();
 }
 clearGroup(){
  while(this.group.children.length){const o=this.group.children.pop();o.geometry?.dispose();o.material?.dispose()}
  this.hitMeshes=[];
 }
 addLine(points,id,selected,color){
  if(points.length<2)return;
  const mat=new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:selected?1:.28});
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat);line.renderOrder=95;this.group.add(line);
  const mid=points[Math.floor(points.length/2)].clone();
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(selected?.026:.018,14,10),new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:selected?1:.72}));
  sphere.position.copy(mid);sphere.userData.measureId=id;sphere.renderOrder=96;this.group.add(sphere);this.hitMeshes.push(sphere);
 }
 pointsFor(m){
  const e=this.engine,d=this.measureReview.data?.[m.id]||{},off=new THREE.Vector3(0,(d.yOffset||0)/100,(d.zOffset||0)/100);
  if(m.id==="chest")return e.planeSliceSegments("measure-bust-circ",new THREE.Vector3(0,1,0),4,.06).flat();
  if(m.id==="hip")return e.planeSliceSegments("measure-hips-circ",new THREE.Vector3(0,1,0),0,.06).flat();
  if(m.id==="thigh")return e.planeSliceSegments("measure-thigh-circ",e.limbAxisFromRuler("measure-upperleg-height"),7,.045).flat();
  if(m.id==="calf")return e.planeSliceSegments("measure-calf-circ",e.limbAxisFromRuler("measure-lowerleg-height"),0,.04).flat();
  if(m.id==="ankle")return e.planeSliceSegments("measure-ankle-circ",e.limbAxisFromRuler("measure-lowerleg-height"),-3,.035).flat();
  if(m.id==="upperarmCirc")return e.planeSliceSegments("measure-upperarm-circ",e.limbAxisFromRuler("measure-upperarm-length"),0,.04).flat();
  if(m.id==="neck")return e.planeSliceSegments("measure-neck-circ",new THREE.Vector3(0,1,0),1.5,.04).flat();
  if(m.id==="neckBase")return e.planeSliceSegments("measure-neck-circ",new THREE.Vector3(0,1,0),-.5,.055).flat();
  if(m.id==="chestDepth"){
   const segs=e.planeSliceSegments("measure-bust-circ",new THREE.Vector3(0,1,0),0,.06),seed=e.measurePathPoints("measure-bust-circ");if(!seed.length)return [];
   const cx=seed.reduce((q,p)=>q+p.x,0)/seed.length,zs=[];
   for(const [a,b] of segs){const dx=b.x-a.x;if(Math.abs(dx)>1e-9){const t=(cx-a.x)/dx;if(t>=0&&t<=1)zs.push(a.z+(b.z-a.z)*t)}}
   const y=seed.reduce((q,p)=>q+p.y,0)/seed.length;
   return zs.length>=2?[new THREE.Vector3(cx,y,Math.min(...zs)),new THREE.Vector3(cx,y,Math.max(...zs))]:[];
  }
  if(m.kind==="path")return e.measurePathPoints(m.path).map(p=>p.clone().add(off));
  if(m.kind==="extent")return e.measurePathAxisLine(m.path,m.axis).map(p=>p.clone().add(off));
  if(m.kind==="shoulder"){const x=e.landmarkData();return x.shoulderL&&x.shoulderR?[new THREE.Vector3(x.shoulderL.x,x.shoulderL.y,x.shoulderL.z).add(off),new THREE.Vector3(x.shoulderR.x,x.shoulderR.y,x.shoulderR.z).add(off)]:[]}
  if(m.kind==="proxy"){const x=e.landmarkData();if(x.shoulderL&&x.shoulderR&&x.crotch){const mid=new THREE.Vector3((x.shoulderL.x+x.shoulderR.x)/2,(x.shoulderL.y+x.shoulderR.y)/2,(x.shoulderL.z+x.shoulderR.z)/2).add(off);return [mid,new THREE.Vector3(x.crotch.x,x.crotch.y,x.crotch.z)]}}
  return [];
 }
 drawAll(){
  this.clearGroup();if(!this.group.visible||!this.engine.body)return;
  for(const m of MEASURES){
   const pts=this.pointsFor(m);if(pts.length<2)continue;
   const selected=m.id===this.selected,color=selected?0xffc857:(m.kind==="extent"||m.kind==="shoulder"?0x5bd7ff:0xff4fa3);
   // Plane slices are returned as independent line segments: draw in pairs.
   if(["chest","hip","thigh","calf","ankle","upperarmCirc","neck","neckBase"].includes(m.id)){
    for(let i=0;i+1<pts.length;i+=2)this.addLine([pts[i],pts[i+1]],m.id,selected,color);
   }else this.addLine(pts,m.id,selected,color);
  }
 }
 bind3D(){
  const el=this.engine.renderer.domElement,ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  el.addEventListener("pointerdown",e=>{this.pointerDown={x:e.clientX,y:e.clientY}});
  el.addEventListener("pointerup",e=>{
   if(!this.group.visible||!this.pointerDown)return;
   if(Math.hypot(e.clientX-this.pointerDown.x,e.clientY-this.pointerDown.y)>8)return;
   const r=el.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;
   ray.setFromCamera(mouse,this.engine.camera);const hit=ray.intersectObjects(this.hitMeshes,false)[0];
   if(hit?.object?.userData?.measureId){e.preventDefault();e.stopPropagation();this.select(hit.object.userData.measureId)}
  },true);
 }
}
