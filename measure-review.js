
import * as THREE from "three";

const KEY="bodylab_measure_review_v390";
const MEASURES=[
 {id:"chest",title:"Brustumfang",ansur:"Chest Circumference",kind:"path",path:"measure-bust-circ",group:"Kernmaße",confidence:"mittel",
  simple:"Waagerechter Umfang um den Brustkorb auf der von ANSUR festgelegten Brusthöhe. Das Maßband liegt nur am Körper an und soll nicht einschnüren.",
  protocol:"ANSUR misst den horizontalen Brustumfang im anthropometrischen Stand. Die Messhöhe ist durch die Brust-/Bustpoint-Landmarks festgelegt; gemessen wird bei ruhiger Atmung.",
  bodylab:"v3.20.0: horizontaler echter Mesh-Schnitt 4 cm über der alten MakeHuman-Bust-Schleife. Dadurch wird der Umfang begradigt und die revidierte Höhe tatsächlich gemessen."},

 {id:"waist",title:"Taillenumfang",ansur:"Waist Circumference (Omphalion)",kind:"path",path:"measure-waist-circ",group:"Kernmaße",confidence:"hoch",
  simple:"Waagerecht um den Rumpf auf Höhe der Mitte des Bauchnabels. Wichtig: ANSUR meint hier ausdrücklich nicht automatisch die schmalste Stelle der Taille.",
  protocol:"Der Umfang wird horizontal auf Höhe des Omphalion – dem Zentrum des Bauchnabels – gemessen. Das Band läuft über die markierten vorderen, hinteren und seitlichen Omphalion-Punkte und liegt nur so straff an, dass es Kontakt hält.",
  bodylab:"Body Lab verwendet „measure-waist-circ“. Wenn der Ring nicht durch die Bauchnabelhöhe läuft, markiere oder verschiebe ihn."},

 {id:"hip",title:"Hüft-/Gesäßumfang",ansur:"Buttock Circumference",kind:"path",path:"measure-hips-circ",group:"Kernmaße",confidence:"hoch",
  simple:"Waagerechter Umfang um die stärkste Stelle von Gesäß und Hüfte – auf Höhe der größten hinteren Ausladung des Gesäßes.",
  protocol:"ANSUR misst den horizontalen Umfang auf Höhe der maximalen hinteren Vorwölbung des Gesäßes. Das Maßband muss in einer horizontalen Ebene bleiben und darf das Gewebe nicht zusammendrücken.",
  bodylab:"v3.20.0: horizontaler Mesh-Schnitt auf der bestätigten Hüft-/Gesäßhöhe; die frühere wobbelige Schleife dient nur noch als Positionsanker."},

 {id:"shoulder",title:"Schulterbreite",ansur:"Biacromial Breadth",kind:"shoulder",group:"Kernmaße",confidence:"hoch",
  simple:"Gerade Strecke von einem knöchernen äußeren Schulterpunkt zum anderen. Nicht über die Rundung der Schultern messen.",
  protocol:"Biacromiale Breite ist die gerade Distanz zwischen dem rechten und linken Acromion-Landmark.",
  bodylab:"Body Lab nutzt zwei feste symmetrische Schulter-Landmarks. Prüfe, ob beide Punkte optisch wirklich auf den knöchernen Acromion-Positionen liegen."},

 {id:"torso",title:"Schulter → Schritt",ansur:"abgeleitet aus Acromial Height − Crotch Height",kind:"proxy",group:"Kernmaße",confidence:"abgeleitet",
  simple:"Vertikale Torsohöhe zwischen Schulterhöhe und Schritt. Dieses Maß ist für unseren Harness praktisch, wurde aber so nicht als einzelne ANSUR-Strecke vermessen.",
  protocol:"Body Lab bildet dieses Maß aus zwei ANSUR-Höhen: Acromial Height und Crotch Height. Es ist daher ein abgeleitetes Kalibriermaß, kein originales ANSUR-Tape-Maß.",
  bodylab:"Aktuell verwenden wir die mittlere Schulterhöhe und den Crotch-Landmark. Prüfe, ob diese geometrische Interpretation für den Harness sinnvoll ist."},

 {id:"neck",title:"Halsumfang",ansur:"Neck Circumference",kind:"path",path:"measure-neck-circ",group:"Umfänge",confidence:"mittel",
  simple:"Umfang um den Hals an der für ANSUR definierten Hals-Messhöhe.",
  protocol:"ANSUR unterscheidet Halsumfang und Halsumfang an der Basis. Deshalb darf dieser Wert nicht automatisch mit „Neck Circumference, Base“ gleichgesetzt werden.",
  bodylab:"v3.20.0: Halsumfang ist jetzt eine eigene horizontale Schnittebene 1,5 cm oberhalb des früheren Pfads."},

 {id:"neckBase",title:"Halsumfang Basis",ansur:"Neck Circumference, Base",kind:"path",path:"measure-neck-circ",group:"Harness Blind",confidence:"mittel",
  simple:"Umfang am unteren Halsansatz – dort, wo der Hals in Schulter/Trapez übergeht.",
  protocol:"ANSUR führt „Neck Circumference, Base“ als eigenes Maß getrennt vom normalen Neck Circumference. Die Lage ist deshalb ausdrücklich als untere Halsbasis zu prüfen.",
  bodylab:"v3.20.0: Halsbasis ist jetzt separat und liegt 0,5 cm unterhalb des früheren Halspfads. Die visuelle Vor-/Zurück-Korrektur bleibt dokumentiert, beeinflusst einen horizontalen Umfang aber nicht."},

 {id:"wrist",title:"Handgelenkumfang",ansur:"Wrist Circumference",kind:"path",path:"measure-wrist-circ",group:"Extremitäten",confidence:"hoch",
  simple:"Umfang um das Handgelenk an der definierten schmalen Handgelenkregion.",
  protocol:"Direkt gemessener ANSUR-Umfang am Handgelenk. Die Messung erfolgt am standardisierten Landmark-Niveau.",
  bodylab:"Body Lab verwendet „measure-wrist-circ“. Prüfe lediglich die Höhe des Rings."},

 {id:"thigh",title:"Oberschenkelumfang",ansur:"Thigh Circumference",kind:"path",path:"measure-thigh-circ",group:"Extremitäten",confidence:"mittel",
  simple:"Umfang um den rechten Oberschenkel an der von ANSUR definierten Messstelle, nicht einfach irgendwo an der dicksten Stelle.",
  protocol:"ANSUR verwendet eine standardisierte Oberschenkel-Messhöhe. Das Band liegt rechtwinklig zur Längsachse des Beins und komprimiert die Haut nicht.",
  bodylab:"v3.20.0: eigener Mesh-Schnitt 7 cm oberhalb der früheren Oberschenkel-Schleife, orthogonal zur lokalen Oberschenkelachse."},

 {id:"calf",title:"Wadenumfang",ansur:"Calf Circumference",kind:"path",path:"measure-calf-circ",group:"Extremitäten",confidence:"hoch",
  simple:"Umfang um die Wade auf Höhe des größten Wadenumfangs.",
  protocol:"Direkt gemessener ANSUR-Wadenumfang an der maximalen Wadenausprägung.",
  bodylab:"v3.20.0: Mesh-Schnitt orthogonal zur lokalen Unterschenkelachse auf der bestätigten Wadenhöhe."},

 {id:"ankle",title:"Knöchelumfang",ansur:"Ankle Circumference",kind:"path",path:"measure-ankle-circ",group:"Extremitäten",confidence:"hoch",
  simple:"Umfang um die Knöchelregion an der definierten ANSUR-Messhöhe.",
  protocol:"Direkt gemessener Umfang im Knöchelbereich. Nicht mit Heel-Ankle Circumference verwechseln, das zusätzlich über die Ferse läuft.",
  bodylab:"v3.20.0: Mesh-Schnitt 3 cm unterhalb der früheren Knöchel-Schleife, orthogonal zur lokalen Unterschenkelachse."},

 {id:"chestBreadth",title:"Brustbreite",ansur:"Chest Breadth",kind:"extent",path:"measure-bust-circ",axis:"x",group:"Harness Blind",confidence:"niedrig",
  simple:"Gerade horizontale Breite des Brustkorbs von links nach rechts – kein Umfang.",
  protocol:"ANSUR definiert Chest Breadth als maximale horizontale Brustbreite auf Höhe des anterioren Chest-Point-Landmarks. Sie wird mit einem Beam Caliper gemessen; Brustgewebe soll möglichst nicht in die knöcherne Brustkorbbereite eingehen.",
  bodylab:"Body Lab nimmt bisher einfach die maximale Links-Rechts-Ausdehnung der Brustumfangsschleife. Das ist wahrscheinlich nicht exakt dieselbe Methode und muss besonders kritisch geprüft werden."},

 {id:"chestDepth",title:"Brusttiefe",ansur:"Chest Depth",kind:"extent",path:"measure-bust-circ",axis:"z",group:"Harness Blind",confidence:"mittel",
  simple:"Gerade Tiefe des Brustkorbs von vorne nach hinten auf der festgelegten Brusthöhe.",
  protocol:"ANSUR misst die antero-posteriore Brusttiefe an einer definierten Brusthöhe mit einem Caliper. Das ist keine Oberflächenstrecke.",
  bodylab:"v3.20.0: Brusttiefe wird mittig auf der Körperachse als gerade Vorderseite→Rückseite-Distanz durch den horizontalen Brustschnitt gemessen."},

 {id:"waistBreadth",title:"Taillenbreite",ansur:"Waist Breadth (Omphalion)",kind:"extent",path:"measure-waist-circ",axis:"x",group:"Harness Blind",confidence:"hoch",
  simple:"Gerade Breite des Rumpfs von links nach rechts auf Bauchnabelhöhe.",
  protocol:"ANSUR misst die horizontale Taillenbreite auf Höhe des Omphalion im Stand.",
  bodylab:"Body Lab verwendet die maximale Links-Rechts-Ausdehnung der Waist-Schleife. Wenn die Schleife auf Omphalion-Höhe sitzt, ist die geometrische Entsprechung plausibel."},

 {id:"waistDepth",title:"Taillentiefe",ansur:"Waist Depth",kind:"extent",path:"measure-waist-circ",axis:"z",group:"Harness Blind",confidence:"hoch",
  simple:"Gerade Tiefe des Rumpfs von Bauchseite zu Rückenseite auf der definierten Taillenhöhe.",
  protocol:"ANSUR misst die antero-posteriore Tiefe des Rumpfs auf der standardisierten Taillenhöhe.",
  bodylab:"Body Lab verwendet die Vorne-Hinten-Ausdehnung der Waist-Schleife."},

 {id:"hipBreadth",title:"Hüftbreite",ansur:"Hip Breadth",kind:"extent",path:"measure-hips-circ",axis:"x",group:"Harness Blind",confidence:"mittel",
  simple:"Gerade horizontale Breite des Beckens/Hüftbereichs von links nach rechts.",
  protocol:"ANSUR führt Hip Breadth als direkte Breitenmessung. Sie ist nicht automatisch identisch mit der maximalen Breite des Buttock-Circumference-Rings.",
  bodylab:"Body Lab leitet die Hüftbreite derzeit aus der Hüft-/Gesäßumfangsschleife ab. Prüfe, ob die Höhe wirklich der ANSUR-Hip-Breadth-Messhöhe entspricht."},

 {id:"waistBackLength",title:"Rückenlänge bis Taille",ansur:"Waist Back Length (Omphalion)",kind:"path",path:"measure-napetowaist-dist",group:"Harness Blind",confidence:"niedrig",
  simple:"Rückenlänge vom definierten oberen Rücken-/Nacken-Landmark bis zur Taillenhöhe am Bauchnabel.",
  protocol:"ANSUR „Waist Back Length (Omphalion)“ bezieht sich auf die Omphalion-Taillenebene. Unsere bisherige Zuordnung zeigte praktisch keine individuelle Korrelation und ist deshalb ausdrücklich ungeklärt.",
  bodylab:"Body Lab verwendet bisher MakeHumans „measure-napetowaist-dist“. Bitte besonders kritisch Anfangspunkt, Endpunkt und Verlauf prüfen."},

 {id:"upperarmCirc",title:"Oberarmumfang",ansur:"Biceps Circumference, Flexed",kind:"path",path:"measure-upperarm-circ",group:"Calibration Extra",confidence:"niedrig",
  simple:"ANSUR misst den Umfang des angespannten Oberarms. Das ist nicht dasselbe wie ein entspannter Oberarmumfang.",
  protocol:"Der ANSUR-Datensatz enthält „Biceps Circumference, Flexed“. Der Arm wird dafür in der vorgeschriebenen Flexions-/Anspannungsposition gemessen.",
  bodylab:"v3.20.0: Umfang wird zumindest geometrisch orthogonal zur lokalen Oberarmachse gemessen. Der grundlegende Unterschied zu ANSURs angespanntem Bizeps bleibt bestehen und wird nicht künstlich wegkalibriert."},

 {id:"upperarmLength",title:"Oberarmlänge",ansur:"Acromion-Radiale Length",kind:"path",path:"measure-upperarm-length",group:"Calibration Extra",confidence:"hoch",
  simple:"Gerade/definierte Segmentlänge von der Schulterknochen-Landmarke Acromion bis zur Radiale-Landmarke am Ellenbogen.",
  protocol:"ANSUR Acromion-Radiale Length beschreibt die Strecke zwischen Acromion und Radiale.",
  bodylab:"Body Lab verwendet „measure-upperarm-length“. Prüfe, ob Start und Ende tatsächlich auf Schulter-Acromion und Ellenbogen-Radiale liegen."},

 {id:"lowerarmLength",title:"Unterarmlänge",ansur:"Radiale-Stylion Length",kind:"path",path:"measure-lowerarm-length",group:"Calibration Extra",confidence:"hoch",
  simple:"Strecke vom Radiale-Landmark am Ellenbogen bis zum Stylion-Landmark am Handgelenk.",
  protocol:"ANSUR Radiale-Stylion Length ist eine standardisierte Unterarmlänge zwischen diesen beiden knöchernen Landmarken.",
  bodylab:"Body Lab verwendet „measure-lowerarm-length“. Prüfe Start- und Endpunkt."},

 {id:"lowerlegHeight",title:"Unterschenkelhöhe",ansur:"Tibiale Height",kind:"path",path:"measure-lowerleg-height",group:"Calibration Extra",confidence:"mittel",
  simple:"Vertikale Höhe vom Boden bis zum Tibiale-Landmark im Kniebereich.",
  protocol:"Tibiale Height ist eine stehende Bodenhöhe eines definierten knöchernen Knie-Landmarks.",
  bodylab:"MakeHuman „measure-lowerleg-height“ ist eine Segmentmessung. Prüfe deshalb besonders, ob sie wirklich Boden→Tibiale und nicht nur eine interne Beinsegmentlänge darstellt."},

 {id:"upperlegHeight",title:"Oberschenkelhöhe",ansur:"abgeleitet aus Trochanterion Height − Tibiale Height",kind:"path",path:"measure-upperleg-height",group:"Calibration Extra",confidence:"abgeleitet",
  simple:"Von uns abgeleitete vertikale Oberschenkelkomponente zwischen Trochanter-Höhe und Tibiale-Höhe.",
  protocol:"ANSUR enthält Trochanterion Height und Tibiale Height getrennt. Body Lab hat für die Kalibrierung deren Differenz verwendet; das ist kein direkt erhobenes ANSUR-Maß.",
  bodylab:"MakeHuman „measure-upperleg-height“ wird gegen diese Differenz verglichen. Prüfe, ob das sichtbare Segment anatomisch dazu passt."},

 {id:"frontChest",title:"Vordere Bruststrecke",ansur:"kein direktes aktuell verwendetes ANSUR-Ziel",kind:"path",path:"measure-frontchest-dist",group:"MakeHuman Zusatz",confidence:"intern",
  simple:"MakeHuman-interne vordere Bruststrecke. Sie wird derzeit nicht als ANSUR-Ziel trainiert, kann aber für spätere Harness-Maße interessant sein.",
  protocol:"Kein direkt zugeordnetes ANSUR-II-Ziel in unserem aktuellen Kalibrationssatz.",
  bodylab:"Nur zur visuellen Revision aufgenommen, damit kein vorhandener relevanter MakeHuman-Messpfad unbemerkt bleibt."},

 {id:"neckHeight",title:"Halshöhe",ansur:"kein direktes aktuell verwendetes ANSUR-Ziel",kind:"path",path:"measure-neck-height",group:"MakeHuman Zusatz",confidence:"intern",
  simple:"MakeHuman-interne Halshöhe.",
  protocol:"Aktuell nicht direkt einem unserer ANSUR-Kalibrierziele zugeordnet.",
  bodylab:"Zur Kontrolle des vorhandenen MakeHuman-Pfads aufgenommen."},

 {id:"shoulderDist",title:"Schulterstrecke",ansur:"Shoulder Length / nicht identisch zu Biacromial Breadth",kind:"path",path:"measure-shoulder-dist",group:"MakeHuman Zusatz",confidence:"niedrig",
  simple:"MakeHuman-interne Schulterstrecke. Nicht mit der geraden Schulterbreite zwischen beiden Acromionpunkten verwechseln.",
  protocol:"ANSUR hat mehrere Schultermaße, darunter Shoulder Length und Biacromial Breadth. Unser MakeHuman-Pfad muss erst eindeutig einem davon zugeordnet werden.",
  bodylab:"Bitte Verlauf und Endpunkte visuell prüfen."},

 {id:"waistToHip",title:"Taille → Hüfte",ansur:"kein direktes aktuelles Solver-Ziel",kind:"path",path:"measure-waisttohip-dist",group:"MakeHuman Zusatz",confidence:"intern",
  simple:"Vertikale/oberflächennahe Strecke zwischen MakeHuman-Taillen- und Hüftniveau.",
  protocol:"Aktuell kein direkt verwendetes ANSUR-II-Ziel.",
  bodylab:"Für Harness-Geometrie potenziell interessant; deshalb zur Revision sichtbar."}
];

export class MeasureReviewLab{
 constructor(engine){
  this.engine=engine;this.panel=document.getElementById("measureReviewPanel");this.data=this.load();
  this.active=MEASURES[0].id;this.filter="Alle";this.group=new THREE.Group();this.group.renderOrder=90;engine.scene.add(this.group);this.group.visible=false;
  this.build();const b=document.getElementById("measureReviewToggle");b.disabled=false;b.onclick=()=>this.toggle();
 }
 load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return {}}}
 save(){localStorage.setItem(KEY,JSON.stringify(this.data))}
 get m(){return MEASURES.find(x=>x.id===this.active)}
 build(){
  const groups=["Alle",...new Set(MEASURES.map(x=>x.group))];
  this.panel.innerHTML=`<div class="mrSheetHandle"><span></span></div>
  <div class="mrHead"><div><div class="sectionLabel">MESS-REVISION · v3.20.0</div><h2>Alle Messmethoden prüfen</h2><p>Referenzbeschreibung + aktuelle Body-Lab-Linie direkt am Modell.</p></div><button id="mrClose">Schließen</button></div>
  <div class="mrFilters">${groups.map(g=>`<button data-g="${g}" class="${g==="Alle"?"active":""}">${g}</button>`).join("")}</div>
  <div class="mrBody"><div id="mrList" class="mrList"></div><div id="mrCard" class="mrCard"></div></div>
  <div class="mrFooter"><button id="mrExport">Revision exportieren</button><span id="mrProgress"></span></div>`;
  this.panel.querySelector("#mrClose").onclick=()=>this.toggle(false);this.panel.querySelector("#mrExport").onclick=()=>this.export();
  this.panel.querySelectorAll(".mrFilters button").forEach(b=>b.onclick=()=>{this.filter=b.dataset.g;this.panel.querySelectorAll(".mrFilters button").forEach(x=>x.classList.toggle("active",x===b));this.renderList()});
  this.renderList();this.renderCard();
 }
 filtered(){return this.filter==="Alle"?MEASURES:MEASURES.filter(x=>x.group===this.filter)}
 renderList(){
  const el=this.panel.querySelector("#mrList");el.innerHTML="";
  for(const m of this.filtered()){
   const d=this.data[m.id]||{},b=document.createElement("button");b.className="mrItem"+(m.id===this.active?" active":"");
   b.innerHTML=`<span>${m.title}</span><small>${d.status==="ok"?"✓ geprüft":d.status==="adjust"?"✎ angepasst":d.status==="unclear"?"? unklar":"noch offen"}</small>`;
   b.onclick=()=>{this.active=m.id;this.renderList();this.renderCard();this.draw()};el.append(b);
  }
  const done=MEASURES.filter(m=>this.data[m.id]?.status).length;this.panel.querySelector("#mrProgress").textContent=`${done}/${MEASURES.length} geprüft`;
 }
 renderCard(){
  const m=this.m,d=this.data[m.id]||{},c=this.panel.querySelector("#mrCard");
  c.innerHTML=`<div class="mrTitle"><div><h3>${m.title}</h3><small>Referenz: ${m.ansur}</small></div><span class="mrConfidence">${m.confidence}</span></div>
   <div class="mrExplain"><b>So ist das Maß gemeint</b><p>${m.simple}</p></div>
   <div class="mrProtocol"><b>ANSUR / Referenzmethode</b><p>${m.protocol}</p></div>
   <div class="mrProtocol bodylab"><b>Body Lab macht aktuell</b><p>${m.bodylab}</p></div>
   <div class="mrAdjust"><label>Markierung hoch / runter <b id="mrYVal">${Number(d.yOffset||0).toFixed(1)} cm</b><input id="mrY" type="range" min="-20" max="20" step=".5" value="${d.yOffset||0}"></label>
   <label>Markierung vor / zurück <b id="mrZVal">${Number(d.zOffset||0).toFixed(1)} cm</b><input id="mrZ" type="range" min="-15" max="15" step=".5" value="${d.zOffset||0}"></label></div>
   <label class="mrNote">Deine Notiz<textarea id="mrNote" placeholder="Was stimmt nicht / wie sollte es sein?">${d.note||""}</textarea></label>
   <div class="mrDecisions"><button data-s="ok">✓ Stimmt</button><button data-s="adjust">✎ Anpassen</button><button data-s="unclear">? Unklar</button></div>
   <p class="mrHint">Die Slider verschieben nur die Revisions-Markierung. Die eigentliche Messfunktion bleibt unverändert, bis deine Revision ausgewertet und bewusst übernommen wurde.</p>`;
  const saveAdj=()=>{const q=this.data[m.id]||(this.data[m.id]={});q.yOffset=+c.querySelector("#mrY").value;q.zOffset=+c.querySelector("#mrZ").value;q.note=c.querySelector("#mrNote").value;c.querySelector("#mrYVal").textContent=q.yOffset.toFixed(1)+" cm";c.querySelector("#mrZVal").textContent=q.zOffset.toFixed(1)+" cm";this.save();this.draw()};
  c.querySelector("#mrY").oninput=saveAdj;c.querySelector("#mrZ").oninput=saveAdj;c.querySelector("#mrNote").oninput=saveAdj;
  c.querySelectorAll(".mrDecisions button").forEach(b=>b.onclick=()=>{saveAdj();this.data[m.id].status=b.dataset.s;this.data[m.id].reviewedAt=new Date().toISOString();this.save();this.renderList();this.renderCard()});
 }
 clear(){while(this.group.children.length){const o=this.group.children.pop();o.geometry?.dispose();o.material?.dispose()}}
 line(points,color=0xff4fa3){
  if(points.length<2)return;const g=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.98});
  const l=new THREE.Line(g,mat);l.renderOrder=90;this.group.add(l);
  for(const p of [points[0],points[points.length-1]]){const s=new THREE.Mesh(new THREE.SphereGeometry(.018,16,12),new THREE.MeshBasicMaterial({color,depthTest:false}));s.position.copy(p);s.renderOrder=91;this.group.add(s)}
 }
 draw(){
  this.clear();if(!this.group.visible||!this.engine.body)return;const m=this.m,d=this.data[m.id]||{},off=new THREE.Vector3(0,(d.yOffset||0)/100,(d.zOffset||0)/100);
  if(m.id==="chest"){
   for(const seg of this.engine.planeSliceSegments("measure-bust-circ",new THREE.Vector3(0,1,0),4,.06))this.line(seg);
  }else if(m.id==="hip"){
   for(const seg of this.engine.planeSliceSegments("measure-hips-circ",new THREE.Vector3(0,1,0),0,.06))this.line(seg);
  }else if(m.id==="thigh"){
   for(const seg of this.engine.planeSliceSegments("measure-thigh-circ",this.engine.limbAxisFromRuler("measure-upperleg-height"),7,.045))this.line(seg);
  }else if(m.id==="calf"){
   for(const seg of this.engine.planeSliceSegments("measure-calf-circ",this.engine.limbAxisFromRuler("measure-lowerleg-height"),0,.04))this.line(seg);
  }else if(m.id==="ankle"){
   for(const seg of this.engine.planeSliceSegments("measure-ankle-circ",this.engine.limbAxisFromRuler("measure-lowerleg-height"),-3,.035))this.line(seg);
  }else if(m.id==="upperarmCirc"){
   for(const seg of this.engine.planeSliceSegments("measure-upperarm-circ",this.engine.limbAxisFromRuler("measure-upperarm-length"),0,.04))this.line(seg);
  }else if(m.id==="neck"){
   for(const seg of this.engine.planeSliceSegments("measure-neck-circ",new THREE.Vector3(0,1,0),1.5,.04))this.line(seg);
  }else if(m.id==="neckBase"){
   for(const seg of this.engine.planeSliceSegments("measure-neck-circ",new THREE.Vector3(0,1,0),-.5,.055))this.line(seg);
  }else if(m.id==="chestDepth"){
   const segs=this.engine.planeSliceSegments("measure-bust-circ",new THREE.Vector3(0,1,0),0,.06),seed=this.engine.measurePathPoints("measure-bust-circ");
   const cx=seed.reduce((q,p)=>q+p.x,0)/Math.max(1,seed.length),zs=[];
   for(const [a,b] of segs){const dx=b.x-a.x;if(Math.abs(dx)>1e-9){const t=(cx-a.x)/dx;if(t>=0&&t<=1)zs.push(a.z+(b.z-a.z)*t)}}
   if(zs.length>=2)this.line([new THREE.Vector3(cx,seed.reduce((q,p)=>q+p.y,0)/seed.length,Math.min(...zs)),new THREE.Vector3(cx,seed.reduce((q,p)=>q+p.y,0)/seed.length,Math.max(...zs))],0xffc857);
  }else if(m.kind==="path"){
   const pts=this.engine.measurePathPoints(m.path).map(p=>p.clone().add(off));this.line(pts);
  }else if(m.kind==="extent"){
   const pts=this.engine.measurePathAxisLine(m.path,m.axis).map(p=>p.clone().add(off));this.line(pts,m.axis==="x"?0x5bd7ff:0xffc857);
  }else if(m.kind==="shoulder"){
   const x=this.engine.landmarkData();if(x.shoulderL&&x.shoulderR)this.line([new THREE.Vector3(x.shoulderL.x,x.shoulderL.y,x.shoulderL.z).add(off),new THREE.Vector3(x.shoulderR.x,x.shoulderR.y,x.shoulderR.z).add(off)],0x5bd7ff);
  }else if(m.kind==="proxy"){
   const x=this.engine.landmarkData();if(x.shoulderL&&x.shoulderR&&x.crotch){const mid=new THREE.Vector3((x.shoulderL.x+x.shoulderR.x)/2,(x.shoulderL.y+x.shoulderR.y)/2,(x.shoulderL.z+x.shoulderR.z)/2).add(off);this.line([mid,new THREE.Vector3(x.crotch.x,x.crotch.y,x.crotch.z)],0xffc857)}
  }
 }
 toggle(force){const show=force===undefined?this.panel.classList.contains("hidden"):!!force;this.panel.classList.toggle("hidden",!show);this.group.visible=show;document.getElementById("measureReviewToggle").classList.toggle("active",show);if(show){this.renderList();this.renderCard();this.draw()}}
 export(){
  const out={build:"BODY LAB v3.20.0",type:"full-measurement-protocol-review",exportedAt:new Date().toISOString(),
   methodology:"Descriptions distinguish official/ANSUR target meaning from the current Body Lab mapping. Derived/internal measures are marked explicitly.",
   reviews:MEASURES.map(m=>({id:m.id,title:m.title,reference:m.ansur,group:m.group,confidence:m.confidence,referenceDescription:m.simple,protocol:m.protocol,bodyLabMapping:m.bodylab,...(this.data[m.id]||{})}))};
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="BODYLAB_FULL_MEASURE_REVIEW_v3.20.0.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)
 }
}
