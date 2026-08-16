import {probeBootModules} from "./boot-probe.js?v=3.21.7";

import {BodyEngine} from "./engine.js?v=3.21.7";
import {BodyUI} from "./ui.js?v=3.21.7";
import {setupDebug} from "./debug.js?v=3.21.7";
import {MeasurementLab} from "./generator.js?v=3.21.7";
import {BatchLab} from "./batch.js?v=3.21.7";
import {CalibrationLab} from "./calibration.js?v=3.21.7";
import {CalibratedSolverV37} from "./solver-v37.js?v=3.21.7";
import {SolverV312} from "./solver-v312.js?v=3.21.7";
import {FrozenSolverV311} from "./solver-v311-frozen.js?v=3.21.7";
import {FinalValidationV315} from "./final-validation.js?v=3.21.7";
import {SolverV316} from "./solver-v316.js?v=3.21.7";
import {MeasureReviewLab} from "./measure-review.js?v=3.21.7";

const title=document.getElementById("loadTitle"),detail=document.getElementById("loadDetail"),card=document.getElementById("loadCard");
const APP_VERSION=document.querySelector('meta[name="bodylab-version"]')?.content||"unknown";
window.BODYLAB_VERSION=APP_VERSION;
document.title=`Harness Body Lab v${APP_VERSION}`;
document.querySelectorAll("[data-version-label]").forEach(el=>el.textContent=`BODY LAB · v${APP_VERSION}`);

function progress(a,b){title.textContent=a;detail.textContent=b||""}

async function boot(){
 await probeBootModules();
 const engine=new BodyEngine(document.getElementById("viewport"),progress);
 const ui=new BodyUI(engine);
 setupDebug();

 await engine.loadBase();
 progress("Körper sichtbar","Grundmodell bereit");
 await new Promise(r=>setTimeout(r,60));

 await engine.loadMacroStack();
 engine.updateBody();

 await engine.loadAdvancedData();
 ui.buildAdvanced();
 ui.sync();

 const bones=await engine.loadRig();
 document.getElementById("rigStatus").textContent=bones+" Bones geladen";

 const measurementLab=new MeasurementLab(engine,ui);
 const batchLab=new BatchLab(engine,ui,measurementLab);
 const solverV37=new CalibratedSolverV37(engine,ui,measurementLab,batchLab);
 const solverV312=new SolverV312(engine,ui,measurementLab,batchLab);
 const frozenSolverV311=new FrozenSolverV311(engine,ui,measurementLab,batchLab);
 const finalSolverV316=new SolverV316(engine,ui,measurementLab,batchLab);
 const calibrationLab=new CalibrationLab(engine,ui,batchLab,solverV37,solverV312,finalSolverV316,measurementLab);
 const finalValidationV315=new FinalValidationV315(engine,ui,measurementLab,batchLab,frozenSolverV311,finalSolverV316);
 const measureReviewLab=new MeasureReviewLab(engine);
 engine.computeMetrics();
 progress("Body Lab bereit","MakeHuman · Maße · Revision geladen");
 setTimeout(()=>card.classList.add("hidden"),500);

 window.BodyLab={version:APP_VERSION,engine,ui,measurementLab,batchLab,calibrationLab,solverV37,solverV312,frozenSolverV311,finalSolverV316,finalValidationV315,measureReviewLab};
}
boot().catch(err=>{
 console.error(err);
 title.textContent="Ladefehler";
 detail.textContent=String(err&&err.message||err);
 const box=document.getElementById("bootError");
 box.classList.remove("hidden");
 box.style.whiteSpace="pre-wrap";
 box.textContent="BOOT CATCH\n"+String(err&&err.stack||err);
});
