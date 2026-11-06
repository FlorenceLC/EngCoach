// Répétition espacée. Intervalles (jours) par palier ; modifiables ici.
export const STEPS=[1,2,4,7,14,30];
export const today=()=>new Date().toLocaleDateString("sv");
export const addDays=(d,n)=>{const x=new Date(d+"T12:00");x.setDate(x.getDate()+n);return x.toLocaleDateString("sv")};
export const newWord=o=>({id:crypto.randomUUID(),en:"",fr:"",ipa:"",def:"",ex:"",exFr:"",cat:"Everyday English",level:"B2",
  added:today(),step:0,due:today(),lapses:0,reviews:0,prod:0,hist:[],status:"new",...o});
// Statut : "maîtrisé" exige palier max ET au moins 2 productions réussies (réutilisation active).
export function status(w){
  if(!w.reviews) return "new";
  if(w.step>=5&&w.prod>=2) return "mastered";
  if(w.hist.slice(-3).some(h=>h.g==="again")) return "consolidate";
  return "learning";
}
// g : "again" (faux) | "hard" (juste mais lent) | "good" (juste et rapide). prod : réponse produite (saisie).
export function grade(w,g,prod){
  w.reviews++;
  if(g==="again"){w.lapses++;w.step=0;w.prod=Math.max(0,w.prod-1);w.due=addDays(today(),1)}
  else{if(g==="good")w.step=Math.min(w.step+1,5);if(prod)w.prod++;w.due=addDays(today(),STEPS[w.step])}
  w.hist=[...w.hist,{d:today(),g}].slice(-20);
  w.status=status(w);return w;
}
