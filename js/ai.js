// Fournisseurs IA : ajouter un fournisseur = ajouter une entrée dans PROVIDERS.
// Les clés restent en localStorage sur l'appareil (jamais dans Firestore ni GitHub).
export const PROVIDERS={
  gemini:{label:"Gemini",req:(k,m,p)=>({url:`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,headers:{"x-goog-api-key":k},body:{contents:[{parts:[{text:p}]}]}}),out:j=>j.candidates[0].content.parts[0].text},
  openai:{label:"OpenAI",req:(k,m,p)=>({url:"https://api.openai.com/v1/chat/completions",headers:{Authorization:"Bearer "+k},body:{model:m,messages:[{role:"user",content:p}]}}),out:j=>j.choices[0].message.content},
  mistral:{label:"Mistral",req:(k,m,p)=>({url:"https://api.mistral.ai/v1/chat/completions",headers:{Authorization:"Bearer "+k},body:{model:m,messages:[{role:"user",content:p}]}}),out:j=>j.choices[0].message.content},
  anthropic:{label:"Anthropic (Claude)",req:(k,m,p)=>({url:"https://api.anthropic.com/v1/messages",headers:{"x-api-key":k,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:{model:m,max_tokens:4000,messages:[{role:"user",content:p}]}}),out:j=>j.content[0].text}
};
export const cfg=()=>{try{return JSON.parse(localStorage.ai||"{}")}catch{return{}}};
export const setCfg=c=>localStorage.ai=JSON.stringify(c);
export const ready=()=>{const c=cfg();return !!(c.key&&c.model&&PROVIDERS[c.provider])};
export async function ask(prompt){
  if(!ready()) throw new Error("IA non configurée : renseigne-la dans Paramètres.");
  const c=cfg(),P=PROVIDERS[c.provider],r=P.req(c.key,c.model,prompt);
  let res;try{res=await fetch(r.url,{method:"POST",headers:{"Content-Type":"application/json",...r.headers},body:JSON.stringify(r.body)})}
  catch{throw new Error("Connexion impossible (réseau ou CORS).")}
  const j=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(`Erreur ${res.status} : ${j.error?.message||j.error||res.statusText}`);
  return P.out(j);
}
export async function askJSON(prompt){
  const m=(await ask(prompt)).match(/\[[\s\S]*\]/);
  if(!m) throw new Error("Réponse de l'IA illisible, réessaie.");
  return JSON.parse(m[0]);
}
