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


/**
 * Métricas pedagógicas derivadas solo de escenarios sintéticos.
 * No se conecta a leads, ingresos, campañas, cookies ni APIs.
 */
export function demoInsights(businessId, scenarioId) {
  const x = demoSnapshot(businessId, scenarioId);
  const notContacted = x.leads - x.contacted;
  const notQualified = x.contacted - x.qualified;
  const qualifiedNotWon = x.qualified - x.won;
  const safeRate = (part, whole) => whole > 0 ? Math.round((part / whole) * 100) : 0;
  return Object.freeze({
    fictional: true,
    business_id: DEMO_BUSINESS_ID,
    label: x.label,
    leads: x.leads,
    contacted: x.contacted,
    qualified: x.qualified,
    won: x.won,
    notContacted,
    notQualified,
    qualifiedNotWon,
    contactRate: x.contactRate,
    winRate: x.winRate,
    qualificationRate: safeRate(x.qualified, x.contacted),
    closeRate: safeRate(x.won, x.qualified),
    stages: Object.freeze([
      Object.freeze({label: 'Registrados', value: x.leads, percent: 100}),
      Object.freeze({label: 'Contactados', value: x.contacted, percent: x.contactRate}),
      Object.freeze({label: 'Calificados', value: x.qualified, percent: safeRate(x.qualified, x.leads)}),
      Object.freeze({label: 'Ganados', value: x.won, percent: x.winRate})
    ]),
    nextAction: notContacted > 0
      ? 'Ejemplo: revisar prospectos aún no contactados antes de buscar más.'
      : 'Ejemplo: revisar las oportunidades calificadas que siguen abiertas.',
    disclaimer: 'Datos ficticios. Estos valores no representan ventas recuperadas ni resultados reales.'
  });
}
