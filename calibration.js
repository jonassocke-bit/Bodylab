
import {FinalCalibrationWorkflowV320} from "./final-calibration-v320.js";

export class CalibrationLab{
 constructor(engine,ui,batchLab,solverV37,solverV312,finalSolverV316){
  this.engine=engine;this.ui=ui;this.batch=batchLab;
  this.panel=document.getElementById("calibrationPanel");
  this.button=document.getElementById("calibrationToggle");
  this.workflow=new FinalCalibrationWorkflowV320(engine,ui,null,batchLab,finalSolverV316);
  this.button.disabled=false;
  this.button.onclick=()=>{this.panel.classList.remove("hidden");this.workflow.sync()};
 }
}
