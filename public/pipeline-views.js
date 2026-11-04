// G06: local, per-user/per-business saved pipeline views. No lead data is persisted.
const stages = new Set(['new','contacted','qualified','proposal','won','lost']);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')));
export function normalizePipelineFilter(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Filtro inválido');
  const stage = String(input.stage || '').trim().toLowerCase();
  const source = String(input.source || '').trim().toLowerCase();
  const from = String(input.from || '');
  const to = String(input.to || '');
  if (stage && !stages.has(stage)) throw new TypeError('Etapa inválida');
  if (source.length > 80 || /[<>\x00-\x1f]/.test(source)) throw new TypeError('Origen inválido');
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) throw new TypeError('Fechas inválidas');
  return { stage, source, from, to };
}
export function pipelineViewStore(storage, userId, businessId) {
  if (!safeId(userId) || !safeId(businessId)) throw new TypeError('Contexto requerido');
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new TypeError('Almacenamiento requerido');
  const key = 'ed-crm-pipeline-views-v1:'+userId+':'+businessId;
  const list = () => {
    try {
      const data = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(data) ? data.filter(v => v && safeId(v.id) && typeof v.name === 'string').slice(0,20).flatMap(v => {
        try { return [{ id:v.id, name:v.name.slice(0,60), filter:normalizePipelineFilter(v.filter) }]; } catch { return []; }
      }) : [];
    } catch { return []; }
  };
  const save = (id, name, filter) => {
    if (!safeId(id) || typeof name !== 'string' || !name.trim() || name.length > 60 || /[<>\x00-\x1f]/.test(name)) throw new TypeError('Nombre inválido');
    const item = { id, name:name.trim(), filter:normalizePipelineFilter(filter) };
    const existing = list().filter(v => v.id !== id);
    if (existing.length >= 20) throw new RangeError('Máximo de 20 vistas');
    storage.setItem(key, JSON.stringify([...existing,item]));
    return item;
  };
  const remove = id => { if (!safeId(id)) throw new TypeError('ID inválido'); storage.setItem(key,JSON.stringify(list().filter(v=>v.id!==id))); };
  return { list, save, remove };
}
export function filterPipelineRows(rows, filter) {
  const f = normalizePipelineFilter(filter);
  return (Array.isArray(rows) ? rows : []).filter(row => {
    if (!row || typeof row !== 'object') return false;
    const date = String(row.created_at || '').slice(0,10);
    return (!f.stage || String(row.stage || '').toLowerCase() === f.stage)
      && (!f.source || String(row.source || '').toLowerCase() === f.source)
      && (!f.from || date >= f.from) && (!f.to || date <= f.to);
  });
}
