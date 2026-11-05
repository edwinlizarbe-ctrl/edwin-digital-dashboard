// C38: comparación ilustrativa de cohortes con muestras suficientes. Sin API ni métricas reales.
export function compareCohorts({businessId,selectedBusinessId,current,previous,minSample=20}) {
  if(typeof businessId!=='string'||!businessId||businessId!==selectedBusinessId) throw new Error('Empresa no autorizada');
  if(!Number.isSafeInteger(minSample)||minSample<2||minSample>10000) throw new Error('Umbral inválido');
  for(const group of [current,previous]){
    if(!group||!Number.isSafeInteger(group.total)||!Number.isSafeInteger(group.completed)||group.total<0||group.completed<0||group.completed>group.total) throw new Error('Conteos inválidos');
  }
  const sufficient=current.total>=minSample&&previous.total>=minSample;
  const result={businessId,sufficient,threshold:minSample,currentTotal:current.total,previousTotal:previous.total,
    message:sufficient?'Muestras suficientes para una comparación descriptiva; no implica causalidad.':'Muestra insuficiente: no se muestra comparación de tasas.'};
  if(sufficient){
    result.currentRate=Number((100*current.completed/current.total).toFixed(1));
    result.previousRate=Number((100*previous.completed/previous.total).toFixed(1));
    result.differencePoints=Number((result.currentRate-result.previousRate).toFixed(1));
  }
  return Object.freeze(result);
}
