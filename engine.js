
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {MEASURE_RULERS} from "./measurements.js";

const N=13380;
// Stable MakeHuman base-mesh landmarks (topology is invariant under morphing).
// L/R shoulder are the outer endpoint of MakeHuman's shoulder measurement on each side.
// Crotch is the center seam vertex at the inseam.
const LANDMARKS={shoulderL:1602,shoulderR:8274,crotch:4376};
export class BodyEngine{
 constructor(viewport,onProgress){
  this.viewport=viewport;this.onProgress=onProgress||function(){};
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.01,100);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance",preserveDrawingBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  this.renderer.setSize(innerWidth,innerHeight);
  viewport.prepend(this.renderer.domElement);
  this.orbit=new OrbitControls(this.camera,this.renderer.domElement);
  this.orbit.enableDamping=true;this.orbit.dampingFactor=.08;this.orbit.minDistance=.8;this.orbit.maxDistance=20;
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x333333,2.2));
  const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(3,5,4);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,.9);fill.position.set(-3,2,2);this.scene.add(fill);
  this.state={gender:.5,age:.5,weight:.5,muscle:.5,height:.5,proportions:.5,breastSize:.5,breastFirmness:.5,caucasian:1/3,asian:1/3,african:1/3};
  this.directState={};this.faceState={};
  this.exactMeta=[];this.exactChunks=[];this.directData=null;this.faceData=null;
  this.scaleFactor=1;this.base=null;this.body=null;this.rawVerts=null;
  this.rig=null;this.skeleton=null;this.bones=new Map();
  this.metrics={};
  this.metricTimer=null;
  this.landmarkMarkers=null;
  this.landmarksVisible=false;
  this.renderer.setAnimationLoop(()=>{this.orbit.update();this.renderer.render(this.scene,this.camera)});
  addEventListener("resize",()=>this.resize());
 }
 async loadBase(){
  this.onProgress("Basismodell lädt …","base.obj");
  const r=await fetch("./base.obj",{cache:"force-cache"});if(!r.ok)throw new Error("base.obj HTTP "+r.status);
  const g=this.parseOBJ(await r.text());
  g.computeBoundingBox();let b=g.boundingBox;
  this.scaleFactor=1.82/(b.max.y-b.min.y);
  g.scale(this.scaleFactor,this.scaleFactor,this.scaleFactor);g.computeBoundingBox();b=g.boundingBox;
  const cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,miny=b.min.y;
  g.translate(-cx,-miny,-cz);g.computeVertexNormals();
  this.base=new Float32Array(g.attributes.position.array);
  this.body=new THREE.Mesh(g,new THREE.MeshPhysicalMaterial({color:0xd8ccc4,roughness:.63,metalness:0,clearcoat:.02,side:THREE.DoubleSide}));
  this.scene.add(this.body);
  this.frame();
  this.updateBody();
 }
 async loadMacroStack(){
  this.onProgress("MakeHuman-Makros …","Metadaten");
  const meta=await import("./exact-macro-meta.js");
  this.exactMeta=meta.EXACT_META;
  this.exactChunks=[];
  for(let i=0;i<6;i++){
   this.onProgress("MakeHuman-Makros …","Paket "+(i+1)+" / 6");
   const r=await fetch("./exact-macros-"+(i+1)+".bin",{cache:"force-cache"});
   if(!r.ok)throw new Error("exact-macros-"+(i+1)+".bin HTTP "+r.status);
   this.exactChunks.push(new Float32Array(await r.arrayBuffer()));
   this.updateBody();
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 async loadAdvancedData(){
  this.onProgress("Detailparameter …","Body");
  const [cfg,data]=await Promise.all([import("./modifier-config.js"),import("./body-morphs.js")]);
  this.groups=cfg.GROUPS;this.directData=data.DIRECT;
  this.onProgress("Detailparameter …","Face");
  const [fc,fd]=await Promise.all([import("./face-config.js"),import("./face-morphs.js")]);
  this.faceGroups=fc.FACE_GROUPS;this.faceData=fd.FACE;
 }
 async loadRig(){
  this.onProgress("Rig lädt …","MakeHuman default");
  const mod=await import("./rig-data.js");this.rig=mod.RIG;
  // Rig data is retained for the next validated BVH step. Do not replace the stable mesh yet.
  return Object.keys(this.rig.bones||{}).length;
 }
 parseOBJ(text){
  const verts=[],faces=[];
  for(const raw of text.split(/\r?\n/)){
   const line=raw.trim();if(!line||line[0]==="#")continue;const p=line.split(/\s+/);
   if(p[0]==="v")verts.push([+p[1],+p[2],+p[3]]);
   else if(p[0]==="f"){
    const ids=p.slice(1).map(s=>{let i=parseInt(s.split("/")[0],10);if(i<0)i=verts.length+1+i;return i-1});
    if(ids.every(i=>i>=0&&i<N))for(let k=1;k<ids.length-1;k++)faces.push(ids[0],ids[k],ids[k+1]);
   }
  }
  this.rawVerts=verts;
  const pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){pos[i*3]=verts[i][0];pos[i*3+1]=verts[i][1];pos[i*3+2]=-verts[i][2]}
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.setIndex(faces);return g;
 }
 tri(v){return{min:Math.max(0,1-v*2),avg:1-Math.abs(v-.5)*2,max:Math.max(0,v*2-1)}}
 ageFactors(v){
  let baby=0,child=0,young=0,old=0;
  if(v<.5){baby=Math.max(0,1-v*5.333);young=Math.max(0,(v-.1875)*3.2);child=Math.max(0,Math.min(1,5.333*v)-young)}
  else{old=Math.max(0,v*2-1);young=1-old}
  return{baby,child,young,old}
 }
 ageYears(v){return v<=.5?1+48*v:25+130*(v-.5)}
 factors(){
  const s=this.state,mu=this.tri(s.muscle),we=this.tri(s.weight),he=this.tri(s.height),pr=this.tri(s.proportions),cu=this.tri(s.breastSize),fi=this.tri(s.breastFirmness),ag=this.ageFactors(s.age);
  return{male:s.gender,female:1-s.gender,baby:ag.baby,child:ag.child,young:ag.young,old:ag.old,caucasian:s.caucasian,asian:s.asian,african:s.african,
   minmuscle:mu.min,averagemuscle:mu.avg,maxmuscle:mu.max,minweight:we.min,averageweight:we.avg,maxweight:we.max,
   minheight:he.min,averageheight:he.avg,maxheight:he.max,uncommonproportions:pr.min,regularproportions:pr.avg,idealproportions:pr.max,
   mincup:cu.min,averagecup:cu.avg,maxcup:cu.max,minfirmness:fi.min,averagefirmness:fi.avg,maxfirmness:fi.max}
 }
 applyFlat(out,flat,a){
  if(!flat||!a)return;
  for(let k=0;k<flat.length;k+=4){const i=flat[k]*3;out[i]+=flat[k+1]*this.scaleFactor*a;out[i+1]+=flat[k+2]*this.scaleFactor*a;out[i+2]-=flat[k+3]*this.scaleFactor*a}
 }
 updateBody(options={}){
  if(!this.body||!this.base)return;
  const doNormals=options.normals!==false;
  const doMetrics=options.metrics!==false;
  const out=new Float32Array(this.base),fv=this.factors();
  if(this.exactChunks.length===6){
   for(const t of this.exactMeta){
    let a=1;for(const token of t.tokens){a*=fv[token]===undefined?1:fv[token];if(a===0)break}
    if(!a)continue;const data=this.exactChunks[t.chunk];
    for(let k=t.start,end=t.start+t.length;k<end;k+=4){const i=data[k]*3;out[i]+=data[k+1]*this.scaleFactor*a;out[i+1]+=data[k+2]*this.scaleFactor*a;out[i+2]-=data[k+3]*this.scaleFactor*a}
   }
  }
  if(this.directData)for(const [id,v] of Object.entries(this.directState)){if(!v)continue;const d=this.directData[id];if(!d)continue;this.applyFlat(out,v<0?d.minus:d.plus,Math.abs(v))}
  if(this.faceData)for(const [id,v] of Object.entries(this.faceState)){if(!v)continue;const d=this.faceData[id];if(!d)continue;this.applyFlat(out,v<0?d.minus:d.plus,Math.abs(v))}
  const p=this.body.geometry.attributes.position;p.array.set(out);p.needsUpdate=true;
  if(doNormals)this.body.geometry.computeVertexNormals();
  this.body.geometry.computeBoundingBox();this.body.geometry.computeBoundingSphere();
  if(this.landmarkMarkers)this.updateLandmarkMarkers();
  if(doMetrics){clearTimeout(this.metricTimer);this.metricTimer=setTimeout(()=>this.computeMetrics(),100)}
 }
 measure(indices){
  if(!this.body||!indices)return NaN;const a=this.body.geometry.attributes.position.array;let total=0,prev=indices[0];
  for(const vi of indices){const i=prev*3,j=vi*3;total+=Math.hypot(a[i]-a[j],a[i+1]-a[j+1],a[i+2]-a[j+2]);prev=vi}
  return total*100;
 }
 vertexXYZ(index){
  const a=this.body?.geometry?.attributes?.position?.array;
  if(!a)return null;
  const i=index*3;
  return {x:a[i],y:a[i+1],z:a[i+2]};
 }
 shoulderBreadthCm(){
  const l=this.vertexXYZ(LANDMARKS.shoulderL),r=this.vertexXYZ(LANDMARKS.shoulderR);
  if(!l||!r)return NaN;
  return Math.hypot(l.x-r.x,l.y-r.y,l.z-r.z)*100;
 }
 shoulderToCrotchCm(){
  const l=this.vertexXYZ(LANDMARKS.shoulderL),r=this.vertexXYZ(LANDMARKS.shoulderR),c=this.vertexXYZ(LANDMARKS.crotch);
  if(!l||!r||!c)return NaN;
  // Match the reference definition: vertical height difference, not a surface tape path.
  return Math.abs((l.y+r.y)*.5-c.y)*100;
 }
 landmarkData(){
  return {
   shoulderL:{index:LANDMARKS.shoulderL,...this.vertexXYZ(LANDMARKS.shoulderL)},
   shoulderR:{index:LANDMARKS.shoulderR,...this.vertexXYZ(LANDMARKS.shoulderR)},
   crotch:{index:LANDMARKS.crotch,...this.vertexXYZ(LANDMARKS.crotch)},
   shoulderBreadthCm:this.shoulderBreadthCm(),
   shoulderToCrotchCm:this.shoulderToCrotchCm()
  };
 }
 ensureLandmarkMarkers(){
  if(this.landmarkMarkers)return;
  const make=(radius)=>new THREE.Mesh(
   new THREE.SphereGeometry(radius,16,12),
   new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false})
  );
  const l=make(.018),r=make(.018),c=make(.021);
  l.renderOrder=r.renderOrder=c.renderOrder=50;
  this.scene.add(l,r,c);
  this.landmarkMarkers={l,r,c};
  this.updateLandmarkMarkers();
 }
 updateLandmarkMarkers(){
  if(!this.landmarkMarkers||!this.body)return;
  const d=this.landmarkData();
  if(d.shoulderL)this.landmarkMarkers.l.position.set(d.shoulderL.x,d.shoulderL.y,d.shoulderL.z);
  if(d.shoulderR)this.landmarkMarkers.r.position.set(d.shoulderR.x,d.shoulderR.y,d.shoulderR.z);
  if(d.crotch)this.landmarkMarkers.c.position.set(d.crotch.x,d.crotch.y,d.crotch.z);
  const vis=!!this.landmarksVisible;
  this.landmarkMarkers.l.visible=vis;this.landmarkMarkers.r.visible=vis;this.landmarkMarkers.c.visible=vis;
 }
 toggleLandmarks(force){
  this.landmarksVisible=force===undefined?!this.landmarksVisible:!!force;
  this.ensureLandmarkMarkers();
  this.updateLandmarkMarkers();
  return this.landmarksVisible;
 }

 heightCm(){
  if(!this.body)return NaN;
  this.body.geometry.computeBoundingBox();
  const b=this.body.geometry.boundingBox;
  return (b.max.y-b.min.y)*100;
 }
 getMeasureCm(name){
  return this.measure(MEASURE_RULERS[name]);
 }
 torsoProxyCm(){
  // Legacy diagnostic only. Generator V3.1.1 uses shoulderToCrotchCm().
  return this.getMeasureCm("measure-napetowaist-dist")+this.getMeasureCm("measure-waisttohip-dist");
 }
 weightKg(){
  const h=this.heightCm();
  const bsa=this.surfaceArea();
  return bsa*bsa*3600/h;
 }

 surfaceArea(){
  const p=this.body.geometry.attributes.position.array,idx=this.body.geometry.index.array;let area=0;
  for(let k=0;k<idx.length;k+=3){const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3,abx=p[b]-p[a],aby=p[b+1]-p[a+1],abz=p[b+2]-p[a+2],acx=p[c]-p[a],acy=p[c+1]-p[a+1],acz=p[c+2]-p[a+2];area+=.5*Math.hypot(aby*acz-abz*acy,abz*acx-abx*acz,abx*acy-aby*acx)}
  return area;
 }
 volume(){
  const p=this.body.geometry.attributes.position.array,idx=this.body.geometry.index.array;let v=0;
  for(let k=0;k<idx.length;k+=3){const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3;v+=(p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])-p[a+1]*(p[b]*p[c+2]-p[b+2]*p[c])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]))/6}
  return Math.abs(v);
 }
 computeMetrics(emit=true){
  if(!this.body)return this.metrics;
  const heightCm=this.heightCm(),bsa=this.surfaceArea(),weightKg=bsa*bsa*3600/heightCm,volumeL=this.volume()*1000,measures={};
  for(const [name,path] of Object.entries(MEASURE_RULERS))measures[name]=this.measure(path);
  this.metrics={heightCm,bsa,weightKg,volumeL,ageYears:this.ageYears(this.state.age),measures,torsoProxyCm:this.torsoProxyCm(),shoulderToCrotchCm:this.shoulderToCrotchCm(),shoulderBreadthCm:this.shoulderBreadthCm(),landmarks:this.landmarkData()};
  if(emit)dispatchEvent(new CustomEvent("body-metrics",{detail:this.metrics}));
  return this.metrics;
 }
 frame(){
  this.body.geometry.computeBoundingBox();const b=this.body.geometry.boundingBox,s=new THREE.Vector3(),c=new THREE.Vector3();b.getSize(s);b.getCenter(c);c.x=0;c.z=0;this.orbit.target.copy(c);
  const vf=THREE.MathUtils.degToRad(this.camera.fov),hf=2*Math.atan(Math.tan(vf/2)*Math.max(.42,innerWidth/innerHeight)),d=Math.max((s.y*.72)/Math.tan(vf/2),(s.x*.68)/Math.tan(hf/2),3.8);
  this.camera.position.set(0,c.y,d);this.orbit.maxDistance=Math.max(20,d*5);this.orbit.update();
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)}
 snapshot(){return{core:JSON.parse(JSON.stringify(this.state)),direct:Object.assign({},this.directState),face:Object.assign({},this.faceState)}}
 restore(s){Object.assign(this.state,s.core||{});Object.assign(this.directState,s.direct||{});Object.assign(this.faceState,s.face||{});this.updateBody()}
 reset(){Object.assign(this.state,{gender:.5,age:.5,weight:.5,muscle:.5,height:.5,proportions:.5,breastSize:.5,breastFirmness:.5,caucasian:1/3,asian:1/3,african:1/3});for(const k in this.directState)this.directState[k]=0;for(const k in this.faceState)this.faceState[k]=0;this.updateBody()}
}
