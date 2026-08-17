
export async function probeBootModules(){
 const mods=[
  "./modifier-config.js?v=3.29.1",
  "./body-morphs.js?v=3.29.1",
  "./face-config.js?v=3.29.1",
  "./face-morphs.js?v=3.29.1",
  "./exact-macro-meta.js?v=3.29.1",
  "./rig-data.js?v=3.29.1"
 ];
 for(const u of mods){
  try{await import(u)}
  catch(err){
   const e=new Error("Modul konnte nicht geladen/geparst werden: "+u+"\n"+String(err&&err.stack||err));
   e.cause=err;throw e;
  }
 }
}
