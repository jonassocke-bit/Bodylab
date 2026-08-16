
const DB_NAME="BodyLabLocal",DB_VERSION=1,STORE="state",KEY="lastCompleteBatch";
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function put(key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function get(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function del(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function hashRows(rows){let h=2166136261>>>0;const mix=s=>{s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}};for(const r of rows){mix(r.sourceRow);mix(r.gender);mix(r.height);mix(r.weight);mix(r.chest);mix(r.waist);mix(r.hip)}return h.toString(16).padStart(8,"0").toUpperCase()}
export class BatchPersistence{
 constructor(batch){this.batch=batch;this.meta=null}
 async restore(){const x=await get(KEY);if(!x?.rows?.length)return null;this.batch.rows=x.rows;this.batch.results=x.results||null;this.meta=x.meta||null;return x}
 async save({rows,results=null,name="Datensatz",limit=0,mode="ladder"}){const id=`BL-${hashRows(rows)}-${rows.length}`;const value={schema:1,rows,results,meta:{id,name,rows:rows.length,limit,mode,savedAt:new Date().toISOString(),complete:!!results}};await put(KEY,value);this.meta=value.meta;return value.meta}
 async updateResults(results,settings={}){const old=await get(KEY);const rows=old?.rows?.length?old.rows:this.batch.rows;return this.save({rows,results,name:old?.meta?.name||"Datensatz",limit:settings.limit??old?.meta?.limit??0,mode:settings.mode||old?.meta?.mode||"ladder"})}
 async clear(){await del(KEY);this.meta=null}
 async export(){const x=await get(KEY);if(!x)return null;const blob=new Blob([JSON.stringify(x,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`BodyLab-Saved-Batch-${x.meta?.id||"export"}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return x}
 async importFile(file){const x=JSON.parse(await file.text());if(!Array.isArray(x?.rows)||!x.rows.length)throw new Error("Keine gespeicherten Batch-Zeilen gefunden.");x.meta=x.meta||{};x.meta.id=x.meta.id||`BL-${hashRows(x.rows)}-${x.rows.length}`;x.meta.savedAt=new Date().toISOString();await put(KEY,x);this.meta=x.meta;this.batch.rows=x.rows;this.batch.results=x.results||null;return x}
}
