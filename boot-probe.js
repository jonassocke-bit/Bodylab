
export async function probeBootModules(){
 const mods=[
  "./modifier-config.js?v=3.27.0",
  "./body-morphs.js?v=3.27.0",
  "./face-config.js?v=3.27.0",
  "./face-morphs.js?v=3.27.0",
  "./exact-macro-meta.js?v=3.27.0",
  "./rig-data.js?v=3.27.0"
 ];
 for(const u of mods){
  try{await import(u)}
  catch(err){
   const e=new Error("Modul konnte nicht geladen/geparst werden: "+u+"\n"+String(err&&err.stack||err));
   e.cause=err;throw e;
  }
 }
}
