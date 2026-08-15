
import * as THREE from "three";

const KEY="bodylab_measure_review_v380";
const MEASURES=[
 {id:"chestCirc",title:"Brustumfang",ansur:"Chest Circumference",path:"measure-bust-circ",kind:"path",
  simple:"Maßband waagerecht um den Brustkorb führen. Entscheidend ist, dass Body Lab dieselbe Höhe und denselben Verlauf benutzt wie die Referenzmessung.",
  technical:"ANSUR-II-Referenzmaß. Prüfe besonders Messhöhe, horizontalen Verlauf und ob der sichtbare Pfad den Brustkorb an der richtigen Stelle umschließt.",confidence:"mittel"},
 {id:"waistCirc",title:"Taillenumfang",ansur:"Waist Circumference (Omphalion)",path:"measure-waist-circ",kind:"path",
  simple:"Waagerecht um den Rumpf auf Höhe des Bauchnabel-Landmarks. Nicht automatisch die schmalste Stelle der Taille.",
  technical:"ANSUR verwendet für dieses Maß eine definierte Landmark-Höhe. Prüfe deshalb vor allem, ob unser Ring zu hoch oder zu tief sitzt.",confidence:"mittel"},
 {id:"hipCirc",title:"Hüft-/Gesäßumfang",ansur:"Buttock Circumference",path:"measure-hips-circ",kind:"path",
  simple:"Waagerecht um die stärkste Stelle von Hüfte und Gesäß. Der Ring soll die größte hintere Ausladung einschließen.",
  technical:"Vergleiche den aktuellen MakeHuman-Hüftpfad mit dem horizontalen maximalen Gesäßumfang.",confidence:"mittel"},
 {id:"shoulder",title:"Schulterbreite",ansur:"Biacromial Breadth",kind:"shoulder",
  simple:"Gerade Strecke von äußerem Schulterknochen zu äußerem Schulterknochen – nicht entlang der Hautoberfläche.",
  technical:"Landmarken sind die beiden Acromion-Punkte. Body Lab verwendet dafür feste symmetrische Mesh-Landmarks.",confidence:"hoch"},
 {id:"neck",title:"Halsumfang Basis",ansur:"Neck Circumference",path:"measure-neck-circ",kind:"path",
  simple:"Umfang an der definierten Halsbasis. Prüfe, ob der Ring wirklich am unteren Hals und nicht mittig am Hals sitzt.",
  technical:"Dieses Maß korrelierte in unserer bisherigen Kalibrierung deutlich besser als mehrere Rumpfbreiten; trotzdem wird hier die Lage visuell geprüft.",confidence:"hoch"},
 {id:"back",title:"Rückenlänge bis Taille",ansur:"Waist Back Length",path:"measure-napetowaist-dist",kind:"path",
  simple:"Länge am Rücken vom oberen Hals-/Nacken-Landmark bis zur definierten Taillenhöhe. Hier bitte besonders kritisch prüfen.",
  technical:"Unsere bisherige MakeHuman-Nape-to-Waist-Zuordnung zeigte praktisch keine individuelle Übereinstimmung mit dem ANSUR-Ziel. Dieses Mapping gilt deshalb als ungeklärt.",confidence:"niedrig"},
 {id:"shoulderCrotch",title:"Schulter → Schritt",ansur:"Body-Lab Harness Proxy",kind:"proxy",
  simple:"Gerade bzw. definierte Torso-Strecke von Schulterregion zum Schritt. Das ist für Harness-Geometrie wichtig, aber kein 1:1-ANSUR-Standardmaß.",
  technical:"Body-Lab-spezifisches Kontrollmaß. Es dient der Harness-Passung und wird getrennt von echten ANSUR-Definitionen behandelt.",confidence:"intern"}
];

export class MeasureReviewLab{
 constructor(engine){
  this.engine=engine; this.panel=document.getElementById("measureReviewPanel");
  this.data=this.load(); this.active=MEASURES[0].id; this.group=new THREE.Group(); this.group.renderOrder=90;
  engine.scene.add(this.group); this.group.visible=false; this.build();
  const b=document.getElementById("measureReviewToggle"); b.disabled=false; b.onclick=()=>this.toggle();
 }
 load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return {}}}
 save(){localStorage.setItem(KEY,JSON.stringify(this.data))}
 get m(){return MEASURES.find(x=>x.id===this.active)}
 build(){
  this.panel.innerHTML=`<div class="mrSheetHandle"><span></span></div>
  <div class="mrHead"><div><div class="sectionLabel">MESS-REVISION · V3.8.1</div><h2>Messmethoden prüfen</h2><p>Maß wählen → Linie am Modell prüfen → bei Bedarf korrigieren.</p></div><button id="mrClose">Schließen</button></div>
  <div class="mrBody">
    <div id="mrList" class="mrList"></div>
    <div id="mrCard" class="mrCard"></div>
  </div>
  <div class="mrFooter"><button id="mrExport">Revision exportieren</button><span id="mrProgress"></span></div>`;
  this.panel.querySelector("#mrClose").onclick=()=>this.toggle(false);
  this.panel.querySelector("#mrExport").onclick=()=>this.export();
  this.renderList(); this.renderCard();
 }
 renderList(){
  const el=this.panel.querySelector("#mrList"); el.innerHTML="";
  for(const m of MEASURES){
   const d=this.data[m.id]||{},b=document.createElement("button");
   b.className="mrItem"+(m.id===this.active?" active":"");
   b.innerHTML=`<span>${m.title}</span><small>${d.status==="ok"?"✓ geprüft":d.status==="adjust"?"✎ angepasst":d.status==="unclear"?"? unklar":"noch offen"}</small>`;
   b.onclick=()=>{this.active=m.id;this.renderList();this.renderCard();this.draw()};
   el.append(b);
  }
  const done=MEASURES.filter(m=>this.data[m.id]?.status).length;
  this.panel.querySelector("#mrProgress").textContent=`${done}/${MEASURES.length} geprüft`;
 }
 renderCard(){
  const m=this.m,d=this.data[m.id]||{},c=this.panel.querySelector("#mrCard");
  c.innerHTML=`<div class="mrTitle"><div><h3>${m.title}</h3><small>Referenz: ${m.ansur}</small></div><span class="mrConfidence ${m.confidence}">Sicherheit: ${m.confidence}</span></div>
   <div class="mrExplain"><b>Einfach erklärt</b><p>${m.simple}</p></div>
   <details><summary>Technischer Hinweis</summary><p>${m.technical}</p></details>
   <div class="mrAdjust"><label>Markierung hoch / runter <b id="mrYVal">${Number(d.yOffset||0).toFixed(1)} cm</b>
   <input id="mrY" type="range" min="-15" max="15" step=".5" value="${d.yOffset||0}"></label>
   <label>Markierung vor / zurück <b id="mrZVal">${Number(d.zOffset||0).toFixed(1)} cm</b>
   <input id="mrZ" type="range" min="-10" max="10" step=".5" value="${d.zOffset||0}"></label></div>
   <label class="mrNote">Deine Notiz<textarea id="mrNote" placeholder="z. B. Ring 3 cm höher; Schulterpunkt weiter außen …">${d.note||""}</textarea></label>
   <div class="mrDecisions"><button data-s="ok">✓ Stimmt</button><button data-s="adjust">✎ Anpassen</button><button data-s="unclear">? Unklar</button></div>
   <p class="mrHint">Die Slider verändern zunächst die <b>Revisions-Markierung</b>, nicht heimlich die Messfunktion. Deine Korrektur wird exportiert und danach sauber in die Messlogik übernommen.</p>`;
  const saveAdj=()=>{
   const q=this.data[m.id]||(this.data[m.id]={});
   q.yOffset=+c.querySelector("#mrY").value;q.zOffset=+c.querySelector("#mrZ").value;q.note=c.querySelector("#mrNote").value;
   c.querySelector("#mrYVal").textContent=q.yOffset.toFixed(1)+" cm";c.querySelector("#mrZVal").textContent=q.zOffset.toFixed(1)+" cm";this.save();this.draw();
  };
  c.querySelector("#mrY").oninput=saveAdj;c.querySelector("#mrZ").oninput=saveAdj;c.querySelector("#mrNote").oninput=saveAdj;
  c.querySelectorAll(".mrDecisions button").forEach(b=>b.onclick=()=>{saveAdj();this.data[m.id].status=b.dataset.s;this.data[m.id].reviewedAt=new Date().toISOString();this.save();this.renderList();this.renderCard()});
 }
 clear(){while(this.group.children.length){const o=this.group.children.pop();o.geometry?.dispose();o.material?.dispose()}}
 line(points,color=0xff4fa3){
  if(points.length<2)return;const g=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.95});
  const l=new THREE.Line(g,mat);l.renderOrder=90;this.group.add(l);
  for(const p of [points[0],points[points.length-1]]){const s=new THREE.Mesh(new THREE.SphereGeometry(.018,16,12),new THREE.MeshBasicMaterial({color,depthTest:false}));s.position.copy(p);s.renderOrder=91;this.group.add(s)}
 }
 draw(){
  this.clear(); if(!this.group.visible||!this.engine.body)return;
  const m=this.m,d=this.data[m.id]||{},dy=(d.yOffset||0)/100,dz=(d.zOffset||0)/100;
  if(m.kind==="path"){
   let pts=this.engine.measurePathPoints(m.path).map(p=>p.clone().add(new THREE.Vector3(0,dy,dz)));
   this.line(pts);
  }else if(m.kind==="shoulder"){
   const x=this.engine.landmarkData(); if(x.shoulderL&&x.shoulderR)this.line([new THREE.Vector3(x.shoulderL.x,x.shoulderL.y+dy,x.shoulderL.z+dz),new THREE.Vector3(x.shoulderR.x,x.shoulderR.y+dy,x.shoulderR.z+dz)],0x5bd7ff);
  }else if(m.kind==="proxy"){
   const x=this.engine.landmarkData(); if(x.shoulderL&&x.shoulderR&&x.crotch){const mid=new THREE.Vector3((x.shoulderL.x+x.shoulderR.x)/2,(x.shoulderL.y+x.shoulderR.y)/2+dy,(x.shoulderL.z+x.shoulderR.z)/2+dz);this.line([mid,new THREE.Vector3(x.crotch.x,x.crotch.y,x.crotch.z)],0xffc857)}
  }
 }
 toggle(force){
  const show=force===undefined?this.panel.classList.contains("hidden"):!!force;
  this.panel.classList.toggle("hidden",!show);this.group.visible=show;
  document.getElementById("measureReviewToggle").classList.toggle("active",show);
  if(show){this.renderList();this.renderCard();this.draw()}
 }
 export(){
  const out={build:"BODY LAB v3.8.1",type:"measurement-protocol-review",exportedAt:new Date().toISOString(),source:"ANSUR II Measurer's Handbook / Body Lab mapping review",reviews:MEASURES.map(m=>({id:m.id,title:m.title,ansur:m.ansur,...(this.data[m.id]||{})}))};
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="BODYLAB_MEASURE_REVIEW_V3.8.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)
 }
}
