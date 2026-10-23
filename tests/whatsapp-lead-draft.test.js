import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/whatsapp-lead-draft.js';
const {build,usable}=globalThis.edwinWhatsAppLeadDraft;
const biz='00000000-0000-4000-8000-000000000001';

test('propone nombre visible, origen whatsapp y teléfono vacío', () => {
 const d=build({id:'c1',participantName:'  Ana Pérez ',participantId:'51999111222@c.us'},biz);
 assert.equal(d.name,'Ana Pérez');
 assert.equal(d.source,'whatsapp');
 assert.equal(d.phone,'');
 assert.equal(d.businessId,biz);
});

test('un ID técnico nunca se usa como nombre ni teléfono', () => {
 const d=build({id:'c1',participantId:'abc123xyz'},biz);
 assert.equal(d.name,'');
 assert.equal(d.phone,'');
 assert.ok(!JSON.stringify(d).includes('abc123xyz'));
});

test('sin conversación o empresa no hay borrador', () => {
 assert.equal(build(null,biz),null);
 assert.equal(build({participantName:'Ana'},''),null);
});

test('el borrador no es utilizable en otra empresa', () => {
 const d=build({participantName:'Ana'},biz);
 assert.equal(usable(d,biz),true);
 assert.equal(usable(d,'00000000-0000-4000-8000-000000000002'),false);
 assert.equal(usable(null,biz),false);
});
