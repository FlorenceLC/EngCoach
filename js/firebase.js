// Accès Firebase : Auth Google + Firestore (cache hors ligne, écritures groupées).
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,collection,getDocs,doc,setDoc,deleteDoc,getDoc,writeBatch} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
let app,auth,db,uid=null,onStatus=()=>{};
// La config Firebase est saisie dans l'app et stockée dans le navigateur (jamais dans le dépôt).
export const getConfig=()=>{try{return JSON.parse(localStorage.fbConfig||"null")}catch{return null}};
export const setConfig=c=>localStorage.fbConfig=JSON.stringify(c);
export const clearConfig=()=>localStorage.removeItem("fbConfig");
export function parseConfig(txt){const c={};for(const m of txt.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g))c[m[1]]=m[2];return c.apiKey&&c.projectId&&c.appId?c:null}
export function init(){const c=getConfig();if(!c)return false;
  if(!app){app=initializeApp(c);auth=getAuth(app);db=initializeFirestore(app,{localCache:persistentLocalCache()})}return true}
export const setStatus=f=>onStatus=f;
export const onUser=cb=>onAuthStateChanged(auth,u=>{uid=u?.uid||null;cb(u)});
export const login=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
// Les données sont d'abord écrites dans le cache local : rien n'est perdu hors ligne.
async function track(p){onStatus("saving");try{const r=await p;onStatus("ok");return r}catch(e){onStatus("error");throw e}}
const wd=id=>doc(db,`users/${uid}/words/${id}`), dd=doc=>doc;
export const loadWords=async()=>(await getDocs(collection(db,`users/${uid}/words`))).docs.map(d=>d.data());
export const saveWord=w=>track(setDoc(wd(w.id),w));
export const saveMany=async ws=>{for(let i=0;i<ws.length;i+=400){const b=writeBatch(db);ws.slice(i,i+400).forEach(w=>b.set(wd(w.id),w));await track(b.commit())}};
export const deleteWord=id=>track(deleteDoc(wd(id)));
const daily=()=>doc(db,`users/${uid}/meta/daily`);
export const loadDaily=async()=>{const s=await getDoc(daily());return s.exists()?s.data():{}};
export const saveDaily=d=>track(setDoc(daily(),d));
