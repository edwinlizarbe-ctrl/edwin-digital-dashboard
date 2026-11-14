/* G04: local-only follow-up ordering. Caller must pass only leads from the authorized tenant. */
const stages = new Set(['new','contacted','qualified','won','lost']);
const weight = {qualified:0,contacted:1,new:2,won:3,lost:4};
const dateValue = value => {
 const n = typeof value === 'string' ? Date.parse(value) : NaN;
 return Number.isFinite(n) ? n : 0;
};
/**
 * Sort a previously authorized company's leads without sending messages.
 * Tenant filtering is mandatory, even if the caller accidentally passes mixed records.
 * No cross-tenant counts or PII are returned in the summary.
 */
export function prioritizeFollowups(leads, businessId, now = Date.now()) {
 if (!Array.isArray(leads) || typeof businessId !== 'string' || !businessId) return {items:[], summary:{total:0,pending:0}};
 const current = Number.isFinite(now) ? now : Date.now();
 const items = leads.filter(lead => lead && lead.business_id === businessId && stages.has(lead.stage))
  .map(lead => {
   const last = dateValue(lead.updated_at) || dateValue(lead.created_at);
   const pending = !['won','lost'].includes(lead.stage) && last > 0 && last <= current - 48 * 60 * 60 * 1000;
   return {...lead, followup_pending:pending};
  }).sort((a,b) => Number(b.followup_pending)-Number(a.followup_pending)
   || weight[a.stage]-weight[b.stage]
   || dateValue(a.updated_at || a.created_at)-dateValue(b.updated_at || b.created_at)
   || String(a.id || '').localeCompare(String(b.id || '')));
 return {items,summary:{total:items.length,pending:items.filter(item=>item.followup_pending).length}};
}
