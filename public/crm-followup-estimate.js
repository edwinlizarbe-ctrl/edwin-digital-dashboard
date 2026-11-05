// Simulación local basada solo en cifras suministradas por la persona.
// No utiliza contactos, campañas ni cuentas del CRM.
export function followupEstimate({leads, notContactedPercent}={}) {
  if (!Number.isSafeInteger(leads) || leads<0 || leads>100000) {
    throw new RangeError('Introduce entre 0 y 100.000 prospectos.');
  }
  if (!Number.isSafeInteger(notContactedPercent) || notContactedPercent<0 || notContactedPercent>100) {
    throw new RangeError('Indica un porcentaje entero de 0 a 100.');
  }
  const notContacted = Math.round(leads*notContactedPercent/100);
  const contacted = leads-notContacted;
  return Object.freeze({
    leads,
    notContactedPercent,
    notContacted,
    contacted,
    fictionalEstimate: true,
    caution: 'Estimación basada exclusivamente en los datos introducidos. No mide ventas ni demuestra recuperación de ingresos.'
  });
}
