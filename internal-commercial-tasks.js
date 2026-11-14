// G05: pure, tenant-scoped internal reminders. No persistence or external delivery.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = value => typeof value === 'string' && UUID.test(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function createInternalTask({ businessId, actorBusinessId, userId, leadId, title, dueAt, id }) {
  if (!validId(businessId) || businessId !== actorBusinessId) throw new Error('FORBIDDEN');
  if (![userId, leadId, id].every(validId)) throw new Error('INVALID_ID');
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 160 || /[\u0000-\u001f]/.test(title)) throw new Error('INVALID_TITLE');
  if (!validDate(dueAt)) throw new Error('INVALID_DATE');
  return Object.freeze({ id, businessId, userId, leadId, title: title.trim(), dueAt: new Date(dueAt).toISOString(), completedAt: null });
}
export function completeInternalTask(task, { actorBusinessId, actorUserId, now }) {
  if (!task || !validId(actorBusinessId) || task.businessId !== actorBusinessId || task.userId !== actorUserId) throw new Error('FORBIDDEN');
  if (!validDate(now)) throw new Error('INVALID_DATE');
  if (task.completedAt) return task; // idempotent
  return Object.freeze({ ...task, completedAt: new Date(now).toISOString() });
}
export function summarizeInternalTasks(tasks, actorBusinessId, now) {
  if (!validId(actorBusinessId) || !validDate(now) || !Array.isArray(tasks)) throw new Error('INVALID_INPUT');
  const own = tasks.filter(task => task.businessId === actorBusinessId);
  return { total: own.length, open: own.filter(task => !task.completedAt).length, overdue: own.filter(task => !task.completedAt && Date.parse(task.dueAt) < Date.parse(now)).length };
}
