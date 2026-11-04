const test=require('node:test');
const assert=require('node:assert/strict');
const lib=require('../public/crm-response-library.js');
test('G10 offers ES and PT editable drafts without contact details',()=>{
  for(const locale of ['es','pt']){
    const items=lib.list(locale);
    assert.equal(items.length,3);
    assert.ok(items.every(x=>!/@|\\+\\d{8}/.test(x.body)));
    assert.equal(lib.draft(locale,'first'),items[0].body);
    assert.equal(lib.draft(locale,'first','Texto personalizado'),'Texto personalizado');
    items[0].body='changed';
    assert.notEqual(lib.draft(locale,'first'),'changed');
  }
});
test('G10 rejects unsupported locales, unknown ids and oversized edits',()=>{
  assert.deepEqual(lib.list('xx'),[]);
  assert.equal(lib.draft('xx','first'),null);
  assert.equal(lib.draft('es','missing'),null);
  assert.equal(lib.draft('es','first','x'.repeat(4001)),null);
  assert.equal(lib.draft('pt','first',{}),null);
});
test('G10 has no network, storage or automatic sending side effects',()=>{
  const source=require('node:fs').readFileSync(require.resolve('../public/crm-response-library.js'),'utf8');
  assert.doesNotMatch(source,/fetch\\s*\\(|XMLHttpRequest|localStorage|sendBeacon|navigator\\.clipboard/);
});
