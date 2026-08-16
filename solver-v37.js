
import {V36_MEASUREMENT_CALIBRATION as CAL} from "./v36-calibration-profile.js";

const STORE="bodylab_v370_solver_model";
const MEASUREMENT_PROTOCOL_VERSION="v3.10";
const TARGETS=["chestBreadth","chestDepth","waistBreadth","waistDepth","hipBreadth","neckBase"];
const LABELS={chestBreadth:"Brustbreite",chestDepth:"Brusttiefe",waistBreadth:"Taillenbreite",waistDepth:"Taillentiefe",hipBreadth:"Hüftbreite",neckBase:"Halsbasis"};
// Selected from the user's V3.6 Morph-Sensitivity report:
// geometrically interpretable controls with useful regional effects.
// We deliberately exclude the highly entangled ELVS endocrine/bodyshape controls.
const SAFE_MORPHS=[
 {id:"d8",name:"torso-scale-depth"},
 {id:"d9",name:"torso-scale-horiz"},
 {id:"d14",name:"torso-vshape"},
 {id:"d15",name:"torso-muscle-dorsi"},
 {id:"d16",name:"torso-muscle-pectoral"},
 {id:"d17",name:"hip-scale-depth"},
 {id:"d18",name:"hip-scale-horiz"},
 {id:"d23",name:"hip-waist"},
 {id:"d25",name:"stomach-tone"},
 {id:"d28",name:"buttocks-volume"},
 {id:"d100",name:"measure-neck-circ"}
];

function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function mae(a){return a.length?mean(a.map(Math.abs)):NaN}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function solveLinear(A,b){
 const n=A.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let c=0;c<n;c++){
  let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
  if(Math.abs(M[p][c])<1e-10)return null;
  [M[c],M[p]]=[M[p],M[c]];
  const q=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=q;
  for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j]}
 }
 return M.map(r=>r[n]);
}
function features(r){
 const h=Number(r.height),w=Number(r.weight),c=Number(r.chest),wa=Number(r.waist),hip=Number(r.hip),g=Number(r.gender);
 if(![h,w,c,wa,hip,g].every(Number.isFinite))return null;
 const hm=h/100,bmi=w/(hm*hm);
 return [1,g,h,w,bmi,c,wa,hip,c-wa,hip-wa];
}
function ridgeFit(rows,target,lambda=.25){
 const pairs=[];
 for(const r of rows){
  const x=features(r),y=Number(r[target]);if(x&&Number.isFinite(y)&&y>0)pairs.push({x,y,row:r});
 }
 if(pairs.length<30)return null;
 const p=pairs[0].x.length,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(const q of pairs)for(let i=0;i<p;i++){b[i]+=q.x[i]*q.y;for(let j=0;j<p;j++)A[i][j]+=q.x[i]*q.x[j]}
 for(let i=1;i<p;i++)A[i][i]+=lambda;
 const beta=solveLinear(A,b);if(!beta)return null;
 return {beta,n:pairs.length,predict:r=>{const x=features(r);return x?x.reduce((s,v,i)=>s+v*beta[i],0):NaN}};
}
function split(rows){
 const tr=[],te=[];
 for(const r of rows){
  const s=String(r.sourceRow??r.id??"");let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  ((h%10)<8?tr:te).push(r);
 }
 return {train:tr,test:te};
}
function meshToReference(key,mesh){
 const c=CAL[key];if(!c)return mesh;
 return c.scale*mesh+c.offset;
}
function calWeight(key){
 const c=CAL[key];if(!c)return 0;
 // R² gates how much we trust protocol conversion as actual geometry,
 // not merely a population mean correction.
 if(c.r2<.10)return 0;
 if(c.r2<.20)return .25;
 if(c.r2<.35)return .6;
 return 1;
}

export class CalibratedSolverV37{
 constructor(engine,ui,lab,batch){
  this.engine=engine;this.ui=ui;this.lab=lab;this.batch=batch;
  this.model=null;this.load();
 }
 load(){try{const x=JSON.parse(localStorage.getItem(STORE)||"null");if(x?.targets)this.model=x}catch(e){}}
 trained(){return !!this.model}
 train(rows){
  const usable=rows.filter(r=>features(r));
  const {train,test}=split(usable),targets={};
  for(const k of TARGETS){
   const fit=ridgeFit(train,k);if(!fit)continue;
   const err=[];
   for(const r of test){const y=Number(r[k]),p=fit.predict(r);if(Number.isFinite(y)&&Number.isFinite(p))err.push(p-y)}
   targets[k]={beta:fit.beta,nTrain:fit.n,nTest:err.length,mae:mae(err),bias:mean(err)};
  }
  this.model={build:"BODY LAB v3.7.0",createdAt:new Date().toISOString(),rows:usable.length,features:["1","gender","height","weight","BMI","chest","waist","hip","chest-waist","hip-waist"],targets};
  localStorage.setItem(STORE,JSON.stringify(this.model));return this.model;
 }
 predict(row,key){
  const m=this.model?.targets?.[key],x=features(row);if(!m||!x)return NaN;
  return x.reduce((s,v,i)=>s+v*m.beta[i],0);
 }
 objective(row){
  const h=this.engine.harnessBlindMetrics(),parts=[];
  for(const k of TARGETS){
   const target=this.predict(row,k),mesh=h[k],w=calWeight(k);
   if(!Number.isFinite(target)||!Number.isFinite(mesh)||!w)continue;
   const pred=meshToReference(k,mesh),scale=Math.max(1,target);
   parts.push(w*((pred-target)/scale)**2);
  }
  // Preserve the dimensions the user actually measured much more strongly.
  const hard=[
   ["chest",this.engine.getMeasureCm("measure-bust-circ"),row.chest],
   ["waist",this.engine.getMeasureCm("measure-waist-circ"),row.waist],
   ["hip",this.engine.getMeasureCm("measure-hips-circ"),row.hip]
  ];
  for(const [k,a,t] of hard)if(Number.isFinite(a)&&Number.isFinite(t))parts.push(8*((a-t)/Math.max(1,t))**2);
  return parts.reduce((s,x)=>s+x,0);
 }
 async correct(row,{passes=3}={}){
  return {applied:false,reason:"v3.10-measurement-protocol-changed-recalibration-required"};
  /*
  if(!this.trained())return {applied:false,reason:"not-trained"};
  // We only run the calibrated shape layer when the Core-5 torso values exist.
  if(![row.height,row.weight,row.chest,row.waist,row.hip].every(Number.isFinite))return {applied:false,reason:"missing-core5"};
  const before=this.objective(row),used=[];
  for(let pass=0;pass<passes;pass++){
   const step=[.12,.07,.035][pass]||.03;
   for(const m of SAFE_MORPHS){
    if(!(m.id in this.engine.directState))continue;
    const cur=Number(this.engine.directState[m.id]||0);
    let bestV=cur,best=this.objective(row);
    for(const v of [clamp(cur-step,-1.5,1.5),clamp(cur+step,-1.5,1.5)]){
     this.engine.directState[m.id]=v;this.engine.updateBody({normals:false,metrics:false});
     const q=this.objective(row);if(q<best){best=q;bestV=v}
    }
    this.engine.directState[m.id]=bestV;this.engine.updateBody({normals:false,metrics:false});
    if(Math.abs(bestV-cur)>.0001)used.push({id:m.id,name:m.name,from:cur,to:bestV});
   }
   // Re-lock explicit tape measurements after every shape pass.
   await this.lab.solveDirect("measure-bust-circ",row.chest);
   await this.lab.solveDirect("measure-waist-circ",row.waist);
   await this.lab.solveDirect("measure-hips-circ",row.hip);
  }
  return {applied:true,before,after:this.objective(row),used};
  */
 }
 async baselineCore5(row){
  const l=this.lab,e=this.engine;
  e.reset();e.state.gender=row.gender===0?0:row.gender===1?1:.5;
  e.state.age=clamp(l.ageToSlider(row.age||30),0,1);e.state.muscle=clamp(row.build??.52,0,1);
  e.updateBody({normals:false,metrics:false});
  await l.solveCore("height",row.height,"height",0,1);
  await l.solveCore("weight",row.weight,"weight",0,1);
  await l.solveDirect("measure-bust-circ",row.chest);
  await l.solveDirect("measure-waist-circ",row.waist);
  await l.solveDirect("measure-hips-circ",row.hip);
  for(let p=0;p<2;p++){
   await l.solveCore("height",row.height,"height",0,1);await l.solveCore("weight",row.weight,"weight",0,1);
   await l.solveDirect("measure-bust-circ",row.chest);await l.solveDirect("measure-waist-circ",row.waist);await l.solveDirect("measure-hips-circ",row.hip);
  }
 }
 harnessBlindErrors(row){
  const h=this.engine.harnessBlindMetrics(),errs={};
  for(const k of TARGETS){if(!Number.isFinite(row[k])||!Number.isFinite(h[k]))continue;errs[k]=meshToReference(k,h[k])-row[k]}
  return errs;
 }
}
