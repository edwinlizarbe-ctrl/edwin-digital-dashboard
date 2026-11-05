// C36: hitos locales declarativos. No API, PII ni métricas de producción.
export const MILESTONES = Object.freeze([
  Object.freeze({id:'perfil',label:'Revisé el perfil del negocio'}),
  Object.freeze({id:'fuentes',label:'Revisé las fuentes disponibles'}),
  Object.freeze({id:'embudo',label:'Revisé el embudo comercial'}),
  Object.freeze({id:'siguiente',label:'Definí una siguiente acción'})
]);
export function validScope(businessId, userId) {
  return typeof businessId==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(businessId)
    && typeof userId==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(userId);
}
export function storageKey(businessId,userId) {
  if(!validScope(businessId,userId)) throw new Error('Identificadores de ámbito inválidos');
  return 'edwin-c36-local-v1:'+businessId.length+':'+businessId+':'+userId.length+':'+userId;
}
export function normalizeMilestones(value) {
  if(!Array.isArray(value)) return [];
  const allowed=new Set(MILESTONES.map(x=>x.id));
  return [...new Set(value.filter(x=>typeof x==='string'&&allowed.has(x)))];
}
export function readMilestones(store,businessId,userId) {
  const key=storageKey(businessId,userId);
  try {return normalizeMilestones(JSON.parse(store.getItem(key)||'[]'));}
  catch{return [];}
}
export function setMilestone(store,businessId,userId,id,checked) {
  if(!MILESTONES.some(x=>x.id===id)||typeof checked!=='boolean') throw new Error('Hito inválido');
  const key=storageKey(businessId,userId);
  const current=readMilestones(store,businessId,userId);
  const next=checked?[...new Set([...current,id])]:current.filter(x=>x!==id);
  store.setItem(key,JSON.stringify(next));
  return Object.freeze({completed:next.length,total:MILESTONES.length,ids:Object.freeze([...next])});
}
