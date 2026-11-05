// C35: synthetic demonstration only. Never read live CRM state, APIs, cookies or storage.
export const DEMO_BUSINESS_ID = 'demo-fictional-only';
const scenarios = Object.freeze({
  inicio: Object.freeze({label:'Inicio', leads:12, contacted:8, qualified:4, won:1}),
  crecimiento: Object.freeze({label:'Crecimiento', leads:60, contacted:42, qualified:20, won:7}),
  seguimiento: Object.freeze({label:'Seguimiento', leads:30, contacted:27, qualified:15, won:6})
});
export function demoSnapshot(businessId, scenarioId) {
  if (businessId !== DEMO_BUSINESS_ID) throw new Error('Demo aislada: empresa no autorizada');
  if (!Object.hasOwn(scenarios, scenarioId)) throw new Error('Escenario ficticio desconocido');
  const row = scenarios[scenarioId];
  return Object.freeze({
    business_id: DEMO_BUSINESS_ID, fictional: true, label: row.label,
    leads: row.leads, contacted: row.contacted, qualified: row.qualified, won: row.won,
    contactRate: Math.round(row.contacted / row.leads * 100),
    winRate: Math.round(row.won / row.leads * 100),
    attribution: 'Ninguna: números simulados, sin ingresos ni campañas reales'
  });
}
