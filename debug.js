
const Q=[
["Start & Stabilität","Lädt das Mannequin zuverlässig und bleibt die App nach dem Laden bedienbar?"],
["Male / Female","Sind männliche und weibliche Grundkörper deutlich unterscheidbar?"],
["Weight","Weight über den gesamten Bereich testen. Wirken Körperform und berechnete kg plausibel?"],
["Muscle","Muscle testen. Verändert sich der Körper zusammenhängend, und reagiert das berechnete Gewicht mit?"],
["Height","Height testen. Stimmen sichtbare Änderung und cm-Anzeige?"],
["Age","Age testen. Zeigt die UI sinnvolle Jahre statt einer linearen Fake-Skala?"],
["Body proportions","Ist zwischen Minimum, Mitte und Maximum eine nachvollziehbare Änderung sichtbar?"],
["Brustparameter","Breast size und firmness getrennt testen."],
["MakeHuman Maße","Taille, Hüfte, Brust, Unterbrust, Oberarm und Oberschenkel testen. Verändern sich die cm-Werte?"],
["Revision inline","Revision aktivieren. Klappt unter jedem Slider die Revisionszeile auf?"],
["UI-Relevanz","Einen Advanced-Parameter auf Hauptansicht und einen auf Feinanpassung setzen. Werden sie korrekt verschoben?"],
["Kalibrierungsmarke","Eine Referenzmarke speichern. Bleibt der Zustand nach Schließen/Wiederöffnen erhalten?"],
["Eigene Presets","Eigenes Preset speichern, Körper verändern und Preset wieder laden."],
["Bottom-Sheet","Sheet frei verschieben und klein machen. Ist trotzdem alles bis ganz unten scrollbar?"],
["3D-Steuerung","Drehen, Verschieben und Zoom auf dem iPhone testen."],
["Performance","Mehrere starke Morphs hintereinander testen. Bleibt Safari stabil?"],
["Rig-Grundlage","Zeigt Pose Lab die Anzahl geladener MakeHuman-Bones?"],
["Gesamteindruck","Gibt es noch Parameter, die prominent sein sollten oder auffällig nichts/falsch tun?"]
];
export function setupDebug(){
 const panel=document.getElementById("debugPanel"),btn=document.getElementById("debugToggle"),key="bodylab_v3_debug";
 let s={i:0,a:Q.map(()=>({status:"",comment:""}))};try{s=JSON.parse(localStorage.getItem(key)||JSON.stringify(s))}catch(e){}
 function save(){localStorage.setItem(key,JSON.stringify(s))}
 function render(){
  const q=Q[s.i],a=s.a[s.i];panel.innerHTML='<div class="debugHead"><div><strong>BODY LAB v3 · GUIDED TEST</strong><small>'+(s.i+1)+' / '+Q.length+'</small></div><button id="dbgClose">Schließen</button></div><h2 class="debugQ">'+q[0]+'</h2><p class="debugText">'+q[1]+'</p><div class="debugStatuses"><button data-s="pass">✓ Pass</button><button data-s="fail">✕ Fail</button><button data-s="skip">→ Skip</button></div><textarea class="debugComment" placeholder="Kommentar …"></textarea><div class="debugNav"><button id="dbgPrev">← Zurück</button><button id="dbgNext">Weiter →</button></div>';
  panel.querySelector(".debugComment").value=a.comment||"";panel.querySelectorAll("[data-s]").forEach(b=>{b.classList.toggle("active",b.dataset.s===a.status);b.onclick=()=>{a.status=b.dataset.s;save();render()}});
  panel.querySelector(".debugComment").oninput=e=>{a.comment=e.target.value;save()};
  panel.querySelector("#dbgClose").onclick=()=>panel.classList.add("hidden");
  panel.querySelector("#dbgPrev").onclick=()=>{s.i=(s.i-1+Q.length)%Q.length;save();render()};
  panel.querySelector("#dbgNext").onclick=()=>{if(s.i<Q.length-1){s.i++;save();render()}else exportReport()};
 }
 function exportReport(){const lines=Q.map((q,i)=>(s.a[i].status||"open").toUpperCase()+" · "+q[0]+(s.a[i].comment?" — "+s.a[i].comment:"")).join("\n"),blob=new Blob([lines],{type:"text/plain"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="Body-Lab-v3-debug.txt";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
 btn.onclick=()=>{panel.classList.remove("hidden");render()};
}
