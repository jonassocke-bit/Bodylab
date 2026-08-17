
export async function probeBootModules(){
 const mods=[
  "./modifier-config.js?v=4.0.3",
  "./body-morphs.js?v=4.0.3",
  "./face-config.js?v=4.0.3",
  "./face-morphs.js?v=4.0.3",
  "./exact-macro-meta.js?v=4.0.3",
  "./rig-data.js?v=4.0.3"
 ];
 for(const u of mods){
  try{await import(u)}
  catch(err){
   const e=new Error("Modul konnte nicht geladen/geparst werden: "+u+"\n"+String(err&&err.stack||err));
   e.cause=err;throw e;
  }
 }
}
