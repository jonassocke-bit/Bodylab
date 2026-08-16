
import {BodyEngine} from "./engine.js";
import {BodyUI} from "./ui.js";
import {setupDebug} from "./debug.js";
import {MeasurementLab} from "./generator.js";
import {BatchLab} from "./batch.js";
import {CalibrationLab} from "./calibration.js";
import {CalibratedSolverV37} from "./solver-v37.js";
import {SolverV312} from "./solver-v312.js";
import {FrozenSolverV311} from "./solver-v311-frozen.js";
import {FinalValidationV315} from "./final-validation.js";
import {SolverV316} from "./solver-v316.js";
import {MeasureReviewLab} from "./measure-review.js";

const title=document.getElementById("loadTitle"),detail=document.getElementById("loadDetail"),card=document.getElementById("loadCard");
function progress(a,b){title.textContent=a;detail.textContent=b||""}

async function boot(){
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
 const calibrationLab=new CalibrationLab(engine,ui,batchLab,solverV37,solverV312);
 const finalValidationV315=new FinalValidationV315(engine,ui,measurementLab,batchLab,frozenSolverV311,finalSolverV316);
 const measureReviewLab=new MeasureReviewLab(engine);
 engine.computeMetrics();
 progress("Body Lab bereit","MakeHuman · Maße · Revision geladen");
 setTimeout(()=>card.classList.add("hidden"),500);

 window.BodyLab={engine,ui,measurementLab,batchLab,calibrationLab,solverV37,solverV312,frozenSolverV311,finalSolverV316,finalValidationV315,measureReviewLab};
}
boot().catch(err=>{
 console.error(err);
 title.textContent="Ladefehler";
 detail.textContent=String(err&&err.message||err);
 document.getElementById("bootError").classList.remove("hidden");
 document.getElementById("bootError").textContent=String(err&&err.stack||err);
});
