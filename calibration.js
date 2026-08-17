import {GuidedMeshFitV321} from "./guided-mesh-fit-v321.js?v=3.30.0";

import {FinalCalibrationWorkflowV320} from "./final-calibration-v320.js?v=3.30.0";

export class CalibrationLab{
 constructor(engine,ui,batchLab,solverV37,solverV312,finalSolverV316,measurementLab=null){
  this.engine=engine;this.ui=ui;this.batch=batchLab;
  this.panel=document.getElementById("calibrationPanel");
  this.button=document.getElementById("calibrationToggle");
  this.workflow=new FinalCalibrationWorkflowV320(engine,ui,null,batchLab,finalSolverV316);
  this.meshFit=new GuidedMeshFitV321(engine,ui,measurementLab,batchLab,this);
  this.button.disabled=false;
  this.button.onclick=()=>{this.panel.classList.remove("hidden");this.workflow.sync();this.stampVersion()};
  this.stampVersion();
 }
 stampVersion(){
  const v=window.BODYLAB_VERSION||"unknown";
  this.panel.querySelectorAll("[data-cal-version]").forEach(e=>e.textContent=`V${v}`);
  for(const e of this.panel.querySelectorAll(".generatorSectionTitle")){
   if(/MESH FIT/i.test(e.textContent))e.textContent=`MESH FIT · V${v}`;
  }
 }
 }
