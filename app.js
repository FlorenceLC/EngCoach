// Interface : routage par #hash, vues Accueil / Réviser / Bibliothèque / Ajouter / Paramètres.
import * as F from "./firebase.js";
import * as S from "./srs.js";
import {ask,askJSON,cfg,setCfg,ready,PROVIDERS} from "./ai.js";
const $=s=>document.querySelector(s), view=$("#view");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const CATS=["Business English","Data & Artificial Intelligence","Defence & Military Technology","Meetings & Presentations","Communication & Negotiation","Everyday English","Travel & Holidays","Sports & Hobbies","Idioms & Expressions","Grammar & Sentence Structures"];
const LABEL={new:"Nouveau",learning:"En cours",consolidate:"À consolider",mastered:"Maîtrisé"};
const norm=s=>String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu,"").replace(/\s+/g," ").replace(/^to /,"").trim();
const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
let words=[],daily={};

F.setStatus(s=>$("#sync").textContent={saving:"Enregistrement…",ok:"✓ Sauvegardé",error:"⚠ Échec de sauvegarde"}[s]);
const hasCfg=F.init();
if(!hasCfg){$("#login").hidden=false;$("#loginBtn").hidden=true;$("#setup").hidden=false}
$("#saveCfg").onclick=()=>{const c=F.parseConfig($("#cfgTxt").value);if(!c)return alert("Configuration illisible : colle le bloc complet (apiKey, projectId, appId…).");F.setConfig(c);location.reload()};
if(hasCfg)F.onUser(async u=>{
  $("#app").hidden=!u;$("#login").hidden=!!u;
  if(!u)return;
  try{[words,daily]=await Promise.all([F.loadWords(),F.loadDaily()])}
  catch(e){view.innerHTML=`<p class=bad>Chargement impossible : ${esc(e.message)}. Vérifie la configuration Firebase (Paramètres) et les règles Firestore.</p>`;return}
  route();
});
$("#loginBtn").onclick=()=>F.login().catch(e=>alert("Connexion échouée : "+e.message));
$("#logout").onclick=F.logout;
addEventListener("hashchange",route);
const routes={"":dash,review,library,add,settings};
function route(){const k=location.hash.slice(2);
  document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("on",a.getAttribute("href")==="#/"+k));
  (routes[k]||dash)();}

// ---------- Accueil / statistiques ----------
function dash(){
  const t=S.today(),due=words.filter(w=>w.due<=t).length,c=s=>words.filter(w=>w.status===s).length;
  const days=[...Array(14)].map((_,i)=>S.addDays(t,i-13));
  const tot=Object.values(daily).reduce((a,d)=>({n:a.n+d.n,ok:a.ok+d.ok,sec:a.sec+d.sec}),{n:0,ok:0,sec:0});
  let streak=0,d=daily[t]?t:S.addDays(t,-1);while(daily[d]){streak++;d=S.addDays(d,-1)}
  const max=Math.max(1,...days.map(x=>daily[x]?.n||0));
  const hard=words.filter(w=>w.lapses>0).sort((a,b)=>b.lapses-a.lapses).slice(0,5);
  const card=(l,v)=>`<div class=card><b>${v}</b><span>${l}</span></div>`;
  const byCat=CATS.concat([...new Set(words.map(w=>w.cat))].filter(x=>!CATS.includes(x))).map(k=>[k,words.filter(w=>w.cat===k).length]).filter(x=>x[1]);
  view.innerHTML=`<h1>Accueil</h1>
  ${words.length?`<a class=btn href="#/review">Réviser maintenant (${due} mot${due>1?"s":""} à revoir)</a>`:`<a class=btn href="#/add">Ajouter tes premiers mots</a>`}
  <div class=grid>${card("Mots enregistrés",words.length)}${card("Nouveaux",c("new"))}${card("En cours",c("learning")+c("consolidate"))}${card("Maîtrisés",c("mastered"))}
  ${card("Révisions",tot.n)}${card("Réussite",tot.n?Math.round(100*tot.ok/tot.n)+" %":"–")}${card("Jours consécutifs",streak)}${card("Temps de révision",Math.round(tot.sec/60)+" min")}</div>
  <h2>Révisions des 14 derniers jours</h2><div class=chart>${days.map(x=>`<i title="${x} : ${daily[x]?.n||0}" style="height:${(daily[x]?.n||0)/max*100}%"></i>`).join("")}</div>
  <h2>Mots qui te posent problème</h2>${hard.map(w=>`<p>${esc(w.en)} <span class=mut>— ${w.lapses} oubli${w.lapses>1?"s":""}</span></p>`).join("")||"<p class=mut>Aucun pour l'instant.</p>"}
  <h2>Par catégorie</h2>${byCat.map(([k,n])=>`<p>${esc(k)} <span class=mut>— ${n}</span></p>`).join("")||"<p class=mut>Aucune entrée.</p>"}`;
}

// ---------- Révisions ----------
function review(){
  const n=+localStorage.sessN||10,t=S.today();
  const q=words.filter(w=>w.due<=t).sort((a,b)=>b.lapses-a.lapses||a.due.localeCompare(b.due)).slice(0,n);
  if(!q.length){view.innerHTML=`<h1>Révisions</h1><p>Rien à réviser aujourd'hui.</p><a class=btn href="#/add">Ajouter des mots</a>`;return}
  let i=0,ok=0,total=0;
  const step=()=>{if(i>=q.length)return end();ask1(q[i])};
  function end(){view.innerHTML=`<h1>Session terminée</h1><p>${ok} bonne${ok>1?"s":""} réponse${ok>1?"s":""} sur ${total}.</p><a class=btn href="#/">Retour à l'accueil</a>`}
  function ask1(w){
    const others=words.filter(x=>x.id!==w.id&&x.fr), re=new RegExp(rx(w.en),"i");
    let type=w.reviews<2?"qcm":["fr","fr","cloze","qcm"][Math.random()*4|0];
    if(type==="qcm"&&others.length<3)type="fr";
    if(type==="cloze"&&!(w.ex&&re.test(w.ex)))type="fr";
    const t0=Date.now();let html=`<p class=mut>${i+1} / ${q.length}</p>`;
    if(type==="qcm"){
      const opts=shuffle([w.fr,...shuffle([...new Set(others.map(x=>x.fr))].filter(f=>f!==w.fr)).slice(0,3)]);
      html+=`<div class=q>${esc(w.en)} <small class=mut>${esc(w.ipa)}</small></div><div class=opts>${opts.map(o=>`<button class=alt data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
    }else{
      html+=`<div class=q>${type==="fr"?`Comment dit-on en anglais : <b>${esc(w.fr)}</b> ?`:`${esc(w.ex.replace(re,"_____"))}<br><small class=mut>${esc(w.exFr||w.fr)}</small>`}</div>
      <input id=ans autocomplete=off autocapitalize=off><button id=ok>Valider</button>`;
    }
    view.innerHTML=`<h1>Révisions</h1>${html}<div id=fb></div>`;
    const check=(good,prod)=>{
      const sec=(Date.now()-t0)/1000,g=!good?"again":sec<8?"good":"hard";
      S.grade(w,g,prod&&good);total++;if(good)ok++;
      const day=daily[t]||(daily[t]={n:0,ok:0,sec:0});day.n++;day.ok+=good?1:0;day.sec+=Math.round(sec);
      F.saveWord(w).catch(()=>{});F.saveDaily(daily).catch(()=>{});
      if(!good&&!w._rq){w._rq=1;q.push(w)}
      view.querySelectorAll("button,input").forEach(b=>b.disabled=true);
      $("#fb").innerHTML=`<p class="${good?"good":"bad"}">${good?"✓ Correct":"✗ Incorrect"} — <b>${esc(w.en)}</b> : ${esc(w.fr)}</p>
        <p class=mut>${esc(w.def)}<br><i>${esc(w.ex)}</i></p>
        <div class=row><button id=nx>Suivant</button>${!good&&ready()?`<button id=ex class=alt>Expliquer l'erreur</button>`:""}</div><p id=exp></p>`;
      $("#nx").focus();$("#nx").onclick=()=>{i++;step()};
      if($("#ex"))$("#ex").onclick=async()=>{$("#exp").textContent="…";try{$("#exp").textContent=await ask(`Explique en français, en 2 phrases, pourquoi la réponse "${$("#ans")?.value||"?"}" est fausse pour "${w.fr}" (réponse attendue : "${w.en}"). Propose si utile une formulation plus naturelle.`)}catch(e){$("#exp").textContent=e.message}};
    };
    if(type==="qcm")view.querySelectorAll("[data-o]").forEach(b=>b.onclick=()=>check(b.dataset.o===w.fr,false));
    else{const go=()=>check(norm($("#ans").value)===norm(w.en),true);$("#ok").onclick=go;$("#ans").onkeydown=e=>e.key==="Enter"&&go();$("#ans").focus()}
  }
  step();
}

// ---------- Bibliothèque ----------
function library(){
  view.innerHTML=`<h1>Bibliothèque</h1><div class=row><input id=s placeholder="Rechercher"><select id=fc><option value="">Toutes catégories</option>${CATS.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
  <select id=fs><option value="">Tous statuts</option>${Object.entries(LABEL).map(([k,v])=>`<option value=${k}>${v}</option>`).join("")}</select></div><div id=list></div>`;
  const draw=()=>{const s=$("#s").value.toLowerCase(),c=$("#fc").value,st=$("#fs").value;
    const L=words.filter(w=>(!s||(w.en+w.fr).toLowerCase().includes(s))&&(!c||w.cat===c)&&(!st||w.status===st)).sort((a,b)=>a.en.localeCompare(b.en));
    $("#list").innerHTML=L.map(w=>`<div class=word><b>${esc(w.en)}</b> <small>${esc(w.ipa)}</small><span class=tag>${LABEL[w.status]}</span><span class=tag>${esc(w.cat)}</span>
      <div>${esc(w.fr)}</div><small class=mut>${esc(w.def)}</small><div><i>${esc(w.ex)}</i></div><small class=mut>${esc(w.exFr)}</small>
      <div><small class=mut>Prochaine révision : ${w.due}</small> <button class="link" data-del="${w.id}">Supprimer</button></div></div>`).join("")||"<p class=mut>Aucun résultat.</p>";
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{const w=words.find(x=>x.id===b.dataset.del);
      if(!confirm(`Supprimer « ${w.en} » ?`))return;await F.deleteWord(w.id).catch(e=>alert(e.message));words=words.filter(x=>x!==w);draw()});};
  ["s","fc","fs"].forEach(id=>$("#"+id).oninput=draw);draw();
}

// ---------- Ajouter / importer ----------
function add(){
  view.innerHTML=`<h1>Ajouter du vocabulaire</h1><p class=mut>Colle une liste dans n'importe quel format (ChatGPT, Claude, notes…). L'IA extrait les mots et complète les informations manquantes. Sans IA : une ligne par entrée, « anglais - français ».</p>
  <textarea id=txt rows=8></textarea><label>Catégorie par défaut<select id=cat>${CATS.map(c=>`<option>${esc(c)}</option>`).join("")}</select></label>
  <button id=go>Analyser</button><p id=msg></p><div id=prev></div>`;
  $("#go").onclick=async()=>{
    const txt=$("#txt").value.trim();if(!txt)return;$("#msg").textContent="Analyse en cours…";
    try{
      let items;
      if(ready())items=await askJSON(`Tu es professeur d'anglais. Extrait tous les mots et expressions anglais du texte ci-dessous et complète les informations manquantes. Réponds UNIQUEMENT par un tableau JSON d'objets avec les clés : en, fr (traduction française), ipa (API entre /…/), def (définition simple en anglais), ex (phrase d'exemple naturelle contenant exactement "en"), exFr (traduction de l'exemple), cat (parmi : ${CATS.join(" | ")}), level ("B2" ou "C1").\n\nTexte :\n${txt}`);
      else items=txt.split("\n").map(l=>l.split(/\s+[-–—:]\s+|\t/)).filter(p=>p[0].trim()).map(p=>({en:p[0].trim(),fr:(p[1]||"").trim()}));
      preview(items.map(o=>S.newWord({cat:$("#cat").value,...o})));$("#msg").textContent="";
    }catch(e){$("#msg").innerHTML=`<span class=bad>${esc(e.message)}</span>`}
  };
}
function preview(items){
  const seen=new Set(words.map(w=>w.en.toLowerCase()));
  $("#prev").innerHTML=`<h2>Aperçu — vérifie et corrige</h2>${items.map((w,k)=>{const dup=seen.has(w.en.toLowerCase());
    return `<div class=word><label><input type=checkbox data-k=${k} ${dup?"":"checked"} style="width:auto"> ${dup?"<span class=bad>Déjà présent</span>":"Ajouter"}</label>
    <input data-f=en data-k=${k} value="${esc(w.en)}"><input data-f=fr data-k=${k} value="${esc(w.fr)}"><input data-f=ex data-k=${k} value="${esc(w.ex)}" placeholder="Exemple"></div>`}).join("")}<button id=save>Enregistrer la sélection</button>`;
  document.querySelectorAll("[data-f]").forEach(el=>el.oninput=()=>items[el.dataset.k][el.dataset.f]=el.value);
  $("#save").onclick=async()=>{
    const keep=items.filter((_,k)=>document.querySelector(`[type=checkbox][data-k="${k}"]`).checked&&items[k].en.trim());
    const fresh=keep.filter(w=>!seen.has(w.en.toLowerCase()));
    try{await F.saveMany(fresh);words.push(...fresh);location.hash="#/library"}catch(e){alert("Sauvegarde échouée : "+e.message+" (les données restent dans le cache local)")}
  };
}

// ---------- Paramètres ----------
function settings(){
  const c=cfg();
  view.innerHTML=`<h1>Paramètres</h1><h2>Fournisseur IA</h2>
  <label>Fournisseur<select id=p>${Object.entries(PROVIDERS).map(([k,v])=>`<option value=${k} ${c.provider===k?"selected":""}>${v.label}</option>`).join("")}</select></label>
  <label>Clé API<input id=k type=password value="${esc(c.key||"")}" autocomplete=off></label>
  <label>Nom exact du modèle<input id=m value="${esc(c.model||"")}"></label>
  <div class=row><button id=sv>Enregistrer</button><button id=ts class=alt>Tester la connexion</button></div><p id=tm></p>
  <p class=mut>La clé reste uniquement dans ce navigateur (localStorage) et n'est jamais envoyée à Firestore. Elle est à saisir sur chaque appareil.</p>
  <h2>Firebase</h2><p class=mut>Projet actuel : <b>${esc(F.getConfig()?.projectId)}</b></p>
  <textarea id=cfg2 rows=5 placeholder="Colle une nouvelle configuration pour remplacer l'actuelle"></textarea>
  <div class=row><button id=cfgSave class=alt>Remplacer la configuration</button><button id=cfgClear class=alt>Effacer la configuration</button></div>
  <h2>Révisions</h2><label>Questions par session<input id=n type=number min=3 max=50 value="${+localStorage.sessN||10}"></label>
  <h2>Sauvegarde</h2><div class=row><button id=ex class=alt>Exporter en JSON</button><button id=im class=alt>Importer un JSON</button><input id=f type=file accept=.json hidden></div><p id=bm></p>`;
  const read=()=>({provider:$("#p").value,key:$("#k").value.trim(),model:$("#m").value.trim()});
  $("#sv").onclick=()=>{setCfg(read());localStorage.sessN=$("#n").value;$("#tm").textContent="Enregistré."};
  $("#ts").onclick=async()=>{setCfg(read());$("#tm").textContent="Test…";try{await ask("Reply with: OK");$("#tm").innerHTML=`<span class=good>✓ Connexion valide — modèle : ${esc(read().model)}</span>`}catch(e){$("#tm").innerHTML=`<span class=bad>${esc(e.message)}</span>`}};
  $("#ex").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,words,daily},null,1)],{type:"application/json"}));a.download=`lexique-${S.today()}.json`;a.click()};
  $("#cfgSave").onclick=()=>{const c=F.parseConfig($("#cfg2").value);if(!c)return alert("Configuration illisible.");F.setConfig(c);location.reload()};
  $("#cfgClear").onclick=()=>{if(confirm("Effacer la configuration Firebase de cet appareil ? Tes données restent dans Firestore.")){F.clearConfig();location.reload()}};
  $("#im").onclick=()=>$("#f").click();
  $("#f").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());const have=new Set(words.map(w=>w.en.toLowerCase()));
    const fresh=(d.words||[]).filter(w=>w.en&&!have.has(w.en.toLowerCase())).map(w=>S.newWord(w));
    await F.saveMany(fresh);words.push(...fresh);$("#bm").textContent=`${fresh.length} entrée(s) restaurée(s), ${(d.words||[]).length-fresh.length} doublon(s) ignoré(s).`}catch(err){$("#bm").innerHTML=`<span class=bad>Import impossible : ${esc(err.message)}</span>`}};
}
