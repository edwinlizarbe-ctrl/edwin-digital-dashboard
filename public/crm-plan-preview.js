// C47: independent, read-only plan limit preview. No billing or entitlement changes.
export const PLAN_LIMITS = Object.freeze({
  inicial: Object.freeze({label:'Inicial (ejemplo)', contacts:100, users:1, opportunities:50}),
  equipo: Object.freeze({label:'Equipo (ejemplo)', contacts:1000, users:5, opportunities:500}),
  escala: Object.freeze({label:'Escala (ejemplo)', contacts:5000, users:20, opportunities:2500})
});
export function previewPlanLimits({businessId, selectedBusinessId, plan, usage}) {
  if (typeof businessId !== 'string' || !businessId.trim() || businessId !== selectedBusinessId)
    throw new Error('Empresa no autorizada para esta vista previa');
  if (!Object.hasOwn(PLAN_LIMITS, plan)) throw new Error('Plan desconocido');
  if (!usage || typeof usage !== 'object') throw new Error('Uso inválido');
  const limits = PLAN_LIMITS[plan];
  const metrics = {};
  for (const key of ['contacts','users','opportunities']) {
    const value = usage[key];
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Uso inválido: '+key);
    metrics[key] = Object.freeze({used:value, limit:limits[key], remaining:Math.max(0,limits[key]-value), exceeds:value>limits[key]});
  }
  return Object.freeze({business_id:businessId, plan, illustrative:true, synchronized:false,
    enforcement:false, billing:false, metrics:Object.freeze(metrics)});
}
