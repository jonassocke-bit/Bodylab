
import {V310_CALIBRATION as CAL} from "./v310-calibration-profile.js";
import {V310_SENSITIVITY as SENS} from "./v310-sensitivity-profile.js";

const STORE="bodylab_v311_hidden_model";
const HIDDEN=["shoulder","torso","chestBreadth","chestDepth","waistBreadth","waistDepth","hipBreadth","neckBase"];
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

export class SolverV315{
 constructor(engine,ui,lab,batch){
  this.engine=engine;this.ui=ui;this.lab=lab;this.batch=batch;this.model=null;
  try{this.model=JSON.parse(localStorage.getItem("bodylab_v315_crosssection_model")||"null")}catch(e){}
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
  try{localStorage.setItem("bodylab_v315_crosssection_model",JSON.stringify(this.model))}catch(e){}
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

 crossState(){
  const h=this.engine.harnessBlindMetrics();
  return {
   chest:this.engine.getMeasureCm("measure-bust-circ"),
   chestBreadth:h.chestBreadth,chestDepth:h.chestDepth,
   waist:this.engine.getMeasureCm("measure-waist-circ"),
   waistBreadth:h.waistBreadth,waistDepth:h.waistDepth,
   hip:this.engine.getMeasureCm("measure-hips-circ"),
   hipBreadth:h.hipBreadth,
   shoulder:this.engine.shoulderBreadthCm(),torso:this.engine.shoulderToCrotchCm(),
   neckBase:h.neckBase
  };
 }

 async relockInputCircumferences(row){
  await this.lab.solveDirect("measure-bust-circ",row.chest);
  await this.lab.solveDirect("measure-waist-circ",row.waist);
  await this.lab.solveDirect("measure-hips-circ",row.hip);
 }

 sectionTargets(row){
  return {
   chest:{
    circumference:row.chest,
    breadth:this.hiddenTarget(row,"chestBreadth"),
    depth:this.hiddenTarget(row,"chestDepth")
   },
   waist:{
    circumference:row.waist,
    breadth:this.hiddenTarget(row,"waistBreadth"),
    depth:this.hiddenTarget(row,"waistDepth")
   },
   hip:{
    circumference:row.hip,
    breadth:this.hiddenTarget(row,"hipBreadth")
   }
  };
 }

 sectionObjective(row,state,protectedState){
  const t=this.sectionTargets(row);
  let loss=0,weightSum=0;
  const add=(actual,target,w,scale=1)=>{
   if(!Number.isFinite(actual)||!Number.isFinite(target)||w<=0)return;
   const e=(actual-target)/Math.max(scale,1);
   loss+=w*e*e;weightSum+=w;
  };

  // Circumferences are direct user inputs and therefore hard anchors.
  add(state.chest,t.chest.circumference,6,Math.max(20,t.chest.circumference));
  add(state.waist,t.waist.circumference,7,Math.max(20,t.waist.circumference));
  add(state.hip,t.hip.circumference,6,Math.max(20,t.hip.circumference));

  // Hidden shape targets are learned from ANSUR. Confidence follows calibration R².
  add(refFromMesh("chestBreadth",state.chestBreadth),t.chest.breadth,trust("chestBreadth"),Math.max(10,t.chest.breadth));
  add(refFromMesh("chestDepth",state.chestDepth),t.chest.depth,trust("chestDepth"),Math.max(10,t.chest.depth));
  add(refFromMesh("waistBreadth",state.waistBreadth),t.waist.breadth,trust("waistBreadth"),Math.max(10,t.waist.breadth));
  add(refFromMesh("waistDepth",state.waistDepth),t.waist.depth,trust("waistDepth"),Math.max(10,t.waist.depth));
  add(refFromMesh("hipBreadth",state.hipBreadth),t.hip.breadth,trust("hipBreadth"),Math.max(10,t.hip.breadth));

  // Preserve V3.11's already-successful non-cross-section improvements.
  if(protectedState){
   for(const k of ["shoulder","torso","neckBase"]){
    if(Number.isFinite(state[k])&&Number.isFinite(protectedState[k])){
     const d=state[k]-protectedState[k];
     loss+=2.5*(d/Math.max(10,Math.abs(protectedState[k])))**2;
     weightSum+=2.5;
    }
   }
  }
  return weightSum?loss/weightSum:Infinity;
 }

 crossSectionCandidates(){
  const eligibleGroups=new Set(["measure","torso","hip","breast","stomach","buttocks","pelvis"]);
  const arr=[];
  for(const m of SENS.morphs){
   if(!eligibleGroups.has(m.group)||!(m.id in this.engine.directState))continue;
   const step=m.step||.1;
   const sectionEffect=[
    "chest","chestBreadth","chestDepth",
    "waist","waistBreadth","waistDepth",
    "hip","hipBreadth"
   ].reduce((s,k)=>s+Math.abs(Number(m.all[k]||0))/step,0);
   if(sectionEffect<.15)continue;

   const collateral=["shoulder","torso","neckBase"].reduce((s,k)=>s+Math.abs(Number(m.all[k]||0))/step,0);
   arr.push({...m,sectionEffect,collateral,selectivity:sectionEffect/(.35+collateral)});
  }
  arr.sort((a,b)=>b.selectivity-a.selectivity);
  return arr.slice(0,16);
 }

 async optimizeCrossSections(row){
  const protectedState=this.crossState();
  let best=this.sectionObjective(row,protectedState,protectedState);
  const candidates=this.crossSectionCandidates(),log=[];

  // True mesh-based coordinate search. Circumference is re-locked after every trial,
  // so the remaining morph freedom is used primarily to distribute that circumference
  // into breadth vs depth rather than changing perimeter.
  for(const step of [.08,.04,.02]){
   let passMoved=false;
   for(const m of candidates){
    const id=m.id,cur=Number(this.engine.directState[id]||0);
    let bestV=cur,localBest=best;

    for(const dir of [-1,1]){
     let v=Math.max(-1.25,Math.min(1.25,cur+dir*step));
     if(m.oneWay)v=Math.max(0,v);
     if(Math.abs(v-cur)<1e-6)continue;

     this.engine.directState[id]=v;
     this.engine.updateBody({normals:false,metrics:false});
     await this.relockInputCircumferences(row);
     const st=this.crossState();

     // Hard safety guard for the three V3.11 non-cross-section wins.
     const safe=["shoulder","torso","neckBase"].every(k=>
       !Number.isFinite(st[k])||!Number.isFinite(protectedState[k])||Math.abs(st[k]-protectedState[k])<=.30
     );
     if(!safe)continue;

     const q=this.sectionObjective(row,st,protectedState);
     if(q<localBest-1e-6){localBest=q;bestV=v}
    }

    this.engine.directState[id]=bestV;
    this.engine.updateBody({normals:false,metrics:false});
    await this.relockInputCircumferences(row);

    if(Math.abs(bestV-cur)>.0001){
     passMoved=true;best=localBest;log.push({id,target:m.target,from:cur,to:bestV});
    }else{
     this.engine.directState[id]=cur;
     this.engine.updateBody({normals:false,metrics:false});
     await this.relockInputCircumferences(row);
    }
   }
   if(!passMoved)break;
  }
  return {applied:log.length>0,log,state:this.crossState(),objective:best};
 }

 async finalCorrect(row){
  const v311=await this.correct(row);
  const crossSections=await this.optimizeCrossSections(row);
  return {v311,crossSections};
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
