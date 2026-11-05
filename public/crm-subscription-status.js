// C46: illustrative local subscription state explainer. Never reads billing or changes entitlements.
export const SUBSCRIPTION_STATES = Object.freeze({
  trial: Object.freeze({label:'Prueba (ejemplo)', description:'Una prueba puede tener fecha de finalización; verifica las condiciones con el proveedor.', action:'Consultar las condiciones reales de la prueba.'}),
  active: Object.freeze({label:'Activa (ejemplo)', description:'El estado activo ilustrativo no confirma que exista una suscripción o pago.', action:'Verificar la suscripción en el sistema autorizado.'}),
  past_due: Object.freeze({label:'Pago pendiente (ejemplo)', description:'Un pago pendiente requiere verificación en la fuente de facturación autorizada.', action:'Consultar la facturación real; esta vista no cobra.'}),
  canceled: Object.freeze({label:'Cancelada (ejemplo)', description:'La cancelación ilustrativa no modifica acceso ni contratos.', action:'Consultar vigencia y condiciones en el proveedor.'})
});
export function explainSubscriptionState({businessId, selectedBusinessId, state}) {
  if (typeof businessId !== 'string' || !businessId.trim() || businessId !== selectedBusinessId)
    throw new Error('Empresa no autorizada');
  if (typeof state !== 'string' || !Object.hasOwn(SUBSCRIPTION_STATES, state))
    throw new Error('Estado no reconocido');
  const item=SUBSCRIPTION_STATES[state];
  return Object.freeze({business_id:businessId, state, label:item.label, description:item.description,
    action:item.action, illustrative:true, synchronized:false, verified:false, billing:false, enforcement:false});
}
