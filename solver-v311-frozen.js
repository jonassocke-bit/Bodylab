
import {V310_CALIBRATION as CAL} from "./v310-calibration-profile.js";
import {V310_SENSITIVITY as SENS} from "./v310-sensitivity-profile.js";

const STORE="bodylab_v311_hidden_model";
const HIDDEN=["shoulder","torso","waistBreadth","waistDepth","hipBreadth","neckBase"];
const LABELS={shoulder:"Schulterbreite",torso:"Schulter→Schritt",waistBreadth:"Taillenbreite",waistDepth:"Taillentiefe",hipBreadth:"Hüftbreite",neckBase:"Halsbasis"};
const HARD=["chest","waist","hip"];

function mean(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function mae(a){return a.length?mean(a.map(Math.abs)):NaN}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function solve(A,b){
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
function feat(r){
 const h=+r.height,w=+r.weight,c=+r.chest,wa=+r.waist,hip=+r.hip,g=+r.gender;
 if(![h,w,c,wa,hip,g].every(Number.isFinite))return null;
 const bmi=w/((h/100)**2);
 // modest nonlinear feature set; still small enough for 100-person development samples
 return [1,g,h,w,bmi,c,wa,hip,c-wa,hip-wa,c/Math.max(1,h),wa/Math.max(1,h),hip/Math.max(1,h)];
}
function ridge(rows,key,lambda=2){
 const ps=[];for(const r of rows){const x=feat(r),y=+r[key];if(x&&Number.isFinite(y))ps.push({x,y})}
 if(ps.length<30)return null;
 const p=ps[0].x.length,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);
 for(const q of ps)for(let i=0;i<p;i++){b[i]+=q.x[i]*q.y;for(let j=0;j<p;j++)A[i][j]+=q.x[i]*q.x[j]}
 for(let i=1;i<p;i++)A[i][i]+=lambda;
 const beta=solve(A,b);return beta?{beta,n:ps.length}:null;
}
function predict(beta,r){const x=feat(r);return x?x.reduce((s,v,i)=>s+v*beta[i],0):NaN}
function split(rows){
 const tr=[],te=[];for(const r of rows){const q=String(r.sourceRow??"");let h=0;for(let i=0;i<q.length;i++)h=(h*31+q.charCodeAt(i))>>>0;((h%10)<8?tr:te).push(r)}return {tr,te}
}
function refFromMesh(k,v){const c=CAL[k];return c?c.scale*v+c.offset:v}
function trust(k){
 const c=CAL[k];if(!c)return 0;
 // Mapping trust comes from individual relationship, not from how well an offset fixes the mean.
 const r=c.r2;
 if(r<.10)return 0;
 if(r<.20)return .15;
 if(r<.35)return .45;
 if(r<.50)return .75;
 return 1;
}
function transpose(A){return A[0].map((_,i)=>A.map(r=>r[i]))}
function matMul(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,x,k)=>s+x*B[k][j],0)))}
function matVec(A,v){return A.map(r=>r.reduce((s,x,i)=>s+x*v[i],0))}

export class FrozenSolverV311{
 constructor(engine,ui,lab,batch){
  this.engine=engine;this.ui=ui;this.lab=lab;this.batch=batch;this.model=null;
  try{this.model=JSON.parse(localStorage.getItem("bodylab_v313_frozen_v311_model")||"null")}catch(e){}
  if(!this.model)this.load();
 }
 load(){try{this.model=JSON.parse(localStorage.getItem(STORE)||"null")}catch(e){}}
 trained(){return !!this.model?.targets}
 train(rows){
  const usable=rows.filter(r=>feat(r));const {tr,te}=split(usable),targets={};
  for(const k of HIDDEN){
   const f=ridge(tr,k);if(!f)continue;
   const es=[];for(const r of te){const y=+r[k],p=predict(f.beta,r);if(Number.isFinite(y)&&Number.isFinite(p))es.push(p-y)}
   targets[k]={beta:f.beta,nTrain:f.n,nTest:es.length,holdoutMAE:mae(es),holdoutBias:mean(es),trust:trust(k)};
  }
  this.model={build:"BODY LAB v3.11.0",createdAt:new Date().toISOString(),rows:usable.length,targets};
  localStorage.setItem(STORE,JSON.stringify(this.model));
  try{localStorage.setItem("bodylab_v313_frozen_v311_model",JSON.stringify(this.model))}catch(e){}
  return this.model;
 }
 hiddenTarget(r,k){const t=this.model?.targets?.[k];return t?predict(t.beta,r):NaN}
 current(){
  const h=this.engine.harnessBlindMetrics();
  return {shoulder:this.engine.shoulderBreadthCm(),torso:this.engine.shoulderToCrotchCm(),...h,
   chest:this.engine.getMeasureCm("measure-bust-circ"),waist:this.engine.getMeasureCm("measure-waist-circ"),hip:this.engine.getMeasureCm("measure-hips-circ")};
 }
 residualVector(row){
  const cur=this.current(),res=[],keys=[],weights=[];
  for(const k of HIDDEN){
   const target=this.hiddenTarget(row,k),w=trust(k);
   if(!Number.isFinite(target)||!Number.isFinite(cur[k])||w<=0)continue;
   keys.push(k);res.push(target-refFromMesh(k,cur[k]));weights.push(w);
  }
  return {keys,res,weights};
 }
 morphCandidates(keys){
  const arr=[];
  for(const m of SENS.morphs){
   if(!(m.id in this.engine.directState))continue;
   // sensitivity in ANSUR-reference units per full morph unit
   const col=keys.map(k=>{
    const raw=Number(m.all[k]||0),c=CAL[k],scale=c?.scale??1;
    return (raw*scale)/(m.step||.1);
   });
   const useful=Math.sqrt(col.reduce((s,x)=>s+x*x,0));
   if(useful<.08)continue;
   // penalty for changing Core-5 hard measurements; those will be re-locked, but we prefer selective morphs
   const spill=HARD.reduce((s,k)=>s+Math.abs(Number(m.all[k]||0))/(m.step||.1),0);
   arr.push({...m,col,useful,spill,selectivity:useful/(.25+spill)});
  }
  arr.sort((a,b)=>b.selectivity-a.selectivity);
  return arr.slice(0,14);
 }
 async relock(row){
  await this.lab.solveDirect("measure-bust-circ",row.chest);
  await this.lab.solveDirect("measure-waist-circ",row.waist);
  await this.lab.solveDirect("measure-hips-circ",row.hip);
 }
 async correct(row,{passes=4}={}){
  if(!this.trained())return {applied:false,reason:"not-trained"};
  if(![row.height,row.weight,row.chest,row.waist,row.hip].every(Number.isFinite))return {applied:false,reason:"missing-core5"};
  const log=[];
  for(let pass=0;pass<passes;pass++){
   const {keys,res,weights}=this.residualVector(row);if(!keys.length)break;
   const morphs=this.morphCandidates(keys);if(!morphs.length)break;
   // Weighted ridge least squares: min ||W(J dx-r)||² + lambda||dx||²
   const J=keys.map((k,i)=>morphs.map(m=>m.col[i]*Math.sqrt(weights[i])));
   const rw=res.map((x,i)=>x*Math.sqrt(weights[i]));
   const JT=transpose(J),A=matMul(JT,J),bb=matVec(JT,rw),lambda=8;
   for(let i=0;i<A.length;i++)A[i][i]+=lambda;
   const dx=solve(A,bb);if(!dx)break;
   let moved=0;
   for(let j=0;j<morphs.length;j++){
    let d=clamp(dx[j],-.16,.16);
    if(morphs[j].oneWay){
     const cur=Number(this.engine.directState[morphs[j].id]||0);
     d=Math.max(-cur,d);
    }
    if(Math.abs(d)<.002)continue;
    const id=morphs[j].id,from=Number(this.engine.directState[id]||0),to=clamp(from+d,-1.25,1.25);
    this.engine.directState[id]=to;moved+=Math.abs(to-from);
    log.push({pass,id,target:morphs[j].target,from,to});
   }
   this.engine.updateBody({normals:false,metrics:false});
   await this.relock(row);
   if(moved<.01)break;
  }
  return {applied:true,log,final:this.residualVector(row)};
 }
 async baseline(row){
  const e=this.engine,l=this.lab;e.reset();e.state.gender=row.gender===0?0:row.gender===1?1:.5;e.state.age=clamp(l.ageToSlider(row.age||30),0,1);e.state.muscle=clamp(row.build??.52,0,1);e.updateBody({normals:false,metrics:false});
  await l.solveCore("height",row.height,"height",0,1);await l.solveCore("weight",row.weight,"weight",0,1);
  for(let p=0;p<3;p++){await this.relock(row);await l.solveCore("height",row.height,"height",0,1);await l.solveCore("weight",row.weight,"weight",0,1)}
  await this.relock(row);
 }
 scoreHarness(row){
  const cur=this.current(),es=[],per={};
  // Use only validation mappings with some individual correspondence.
  for(const k of HIDDEN){
   if(!Number.isFinite(row[k])||!Number.isFinite(cur[k])||trust(k)<=0)continue;
   const err=refFromMesh(k,cur[k])-row[k];per[k]=err;es.push(Math.abs(err));
  }
  return {mae:mae(es),per};
 }
}
