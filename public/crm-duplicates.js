/* Edwin CRM G09 — potential duplicate warnings inside the authorized business only.
 * Pure client-side analysis: no writes, merges, deletes or network requests.
 */
(function(root){
 'use strict';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const phone=v=>{
  const raw=String(v??'').replace(/\D/g,'');
  return raw.length>=9&&raw.length<=15?raw:'';
 };
 const email=v=>{
  const raw=String(v??'').trim().toLowerCase();
  return raw.length<=160&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)?raw:'';
 };
 function analyze(leads,businessId){
  const empty=()=>({flaggedCount:0,groupCount:0,flags:{}});
  if(!uuid.test(String(businessId||''))||!Array.isArray(leads))return empty();
  const own=leads.filter(l=>l&&l.business_id===businessId&&uuid.test(String(l.id||'')));
  const groups=new Map();
  for(const l of own){
   const tags=[];
   const e=email(l.email),p=phone(l.phone);
   if(e)tags.push(['email:'+e,'Correo']);
   if(p)tags.push(['phone:'+p,'Teléfono']);
   for(const [key,kind] of tags){
    if(!groups.has(key))groups.set(key,{kind,ids:new Set()});
    groups.get(key).ids.add(l.id);
   }
  }
  const flags=new Map();let groupCount=0;
  for(const group of groups.values()){
   if(group.ids.size<2)continue;
   groupCount++;
   for(const id of group.ids){
    if(!flags.has(id))flags.set(id,new Set());
    flags.get(id).add(group.kind);
   }
  }
  return {
   flaggedCount:flags.size,
   groupCount,
   flags:Object.fromEntries([...flags].map(([id,reasons])=>[id,[...reasons]]))
  };
 }
 function render(result,{loading=false,partial=false}={}){
  if(loading||!result)return '';
  const count=Number.isSafeInteger(result.flaggedCount)&&result.flaggedCount>0?result.flaggedCount:0;
  if(!count)return '<section class="card ed-duplicates" aria-labelledby="ed-dupes-title"><h2 id="ed-dupes-title">Control de duplicados</h2><p>No se detectaron coincidencias de correo o teléfono entre los contactos cargados'+(partial?' (muestra parcial)':'')+'.</p></section>';
  return '<section class="card ed-duplicates" aria-labelledby="ed-dupes-title">'+
   '<h2 id="ed-dupes-title">Posibles duplicados por revisar</h2>'+
   '<p><strong>'+count+'</strong> contactos presentan coincidencias de correo o teléfono en esta empresa'+(partial?' dentro de la muestra disponible':'')+'.</p>'+
   '<p>Los encontrarás señalados en el listado. Confirma las coincidencias antes de corregir manualmente: no se fusiona ni elimina ningún registro.</p></section>';
 }
 root.edwinCrmDuplicates=Object.freeze({analyze,render});
})(globalThis);
