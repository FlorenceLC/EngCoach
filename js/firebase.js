// Accès Firestore (cache hors ligne, écritures groupées). Pas de connexion Google :
// les données sont rangées sous un identifiant = SHA-256 de ton code personnel.
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {initializeFirestore,persistentLocalCache,collection,getDocs,doc,setDoc,deleteDoc,getDoc,writeBatch} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
let app,db,onStatus=()=>{};
export const setStatus=f=>onStatus=f;
// Config Firebase saisie dans l'app, stockée dans le navigateur (jamais dans le dépôt).
export const getConfig=()=>{try{return JSON.parse(localStorage.fbConfig||"null")}catch{return null}};
export const setConfig=c=>localStorage.fbConfig=JSON.stringify(c);
export const clearConfig=()=>localStorage.removeItem("fbConfig");
export function parseConfig(txt){const c={};for(const m of txt.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g))c[m[1]]=m[2];return c.apiKey&&c.projectId&&c.appId?c:null}
export function init(){const c=getConfig();if(!c)return false;
  if(!app){app=initializeApp(c);db=initializeFirestore(app,{localCache:persistentLocalCache()})}return true}
// Code personnel -> identifiant de données (le code lui-même n'est jamais stocké).
export const getUid=()=>localStorage.syncId||null;
export async function setCode(code){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("lexique:"+code));
  localStorage.syncId=[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("")}
export const clearCode=()=>localStorage.removeItem("syncId");
// Les données sont d'abord écrites dans le cache local : rien n'est perdu hors ligne.
async function track(p){onStatus("saving");try{const r=await p;onStatus("ok");return r}catch(e){onStatus("error");throw e}}
const wd=id=>doc(db,`users/${getUid()}/words/${id}`);
export const loadWords=async()=>(await getDocs(collection(db,`users/${getUid()}/words`))).docs.map(d=>d.data());
export const saveWord=w=>track(setDoc(wd(w.id),w));
export const saveMany=async ws=>{for(let i=0;i<ws.length;i+=400){const b=writeBatch(db);ws.slice(i,i+400).forEach(w=>b.set(wd(w.id),w));await track(b.commit())}};
export const deleteWord=id=>track(deleteDoc(wd(id)));
const daily=()=>doc(db,`users/${getUid()}/meta/daily`);
export const loadDaily=async()=>{const s=await getDoc(daily());return s.exists()?s.data():{}};
export const saveDaily=d=>track(setDoc(daily(),d));
