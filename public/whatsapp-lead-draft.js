/* Borrador de oportunidad desde WhatsApp: lógica pura, sin red ni almacenamiento. */
(()=>{
 'use strict';
 const clip=(v,max)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
 // Solo nombres visibles. participantId es un identificador técnico: nunca se usa como nombre ni teléfono.
 function build(conversation,businessId){
  if(!conversation||typeof conversation!=='object'||!businessId)return null;
  const name=clip(conversation.participantName||conversation.whatsappUsername,120);
  // El proveedor no garantiza un teléfono verificable en la conversación; el equipo lo completa manualmente.
  return {businessId:String(businessId),name:name.length>=2?name:'',phone:'',email:'',source:'whatsapp',campaign:'',notes:'Creada desde una conversación de WhatsApp.'};
 }
 const usable=(draft,businessId)=>!!draft&&!!businessId&&draft.businessId===businessId&&draft.source==='whatsapp';
 globalThis.edwinWhatsAppLeadDraft={build,usable};
})();
