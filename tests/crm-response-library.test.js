import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-response-library.js';

const lib=globalThis.edwinResponseLibrary;
test('G10 offers ES and PT editable drafts without contact details',()=>{
 for(const locale of ['es','pt']){
  const items=lib.list(locale);
  assert.equal(items.length,3);
  assert.ok(items.every(x=>!x.body.includes('@')));
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
test('G10 makes an editable and accessible response panel with manual copy',()=>{
 const html=lib.render();
 assert.match(html,/Biblioteca de mensajes comerciales/);
 assert.match(html,/id="ed-response-locale"/);
 assert.match(html,/id="ed-response-template"/);
 assert.match(html,/id="ed-response-text"/);
 assert.match(html,/data-ed-response-copy/);
 assert.match(html,/no envía mensajes automáticamente/);
});
test('G10 has no network, persistence or automatic sending side effects',()=>{
 const src=readFileSync(new URL('../public/crm-response-library.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|localStorage|sendBeacon/);
 assert.match(src,/navigator\?\.clipboard\?\.writeText/);
});
test('G10 assets render inside the commercial opportunity dashboard',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(index,/crm-response-library\.js\?v=growth-g10-20261104/);
 assert.match(index,/crm-response-library\.css\?v=growth-g10-20261104/);
 assert.ok(index.indexOf('crm-response-library.js')<index.indexOf('/app.js'));
 assert.match(app,/edwinResponseLibrary\?\.render\(\{businessId:state\.businessId,userId:state\.user\?\.id\}\)/);
});

test('G10 binds draft state to user and business instead of sharing across clients',()=>{
 const module=readFileSync(new URL('../public/crm-response-library.js',import.meta.url),'utf8');
 assert.match(module,/nextContext!==activeContext/);
 assert.match(module,/edited=null/);
 assert.match(lib.render({businessId:'company-A',userId:'member-1'}),/Biblioteca de mensajes/);
 assert.match(lib.render({businessId:'company-B',userId:'member-1'}),/id="ed-response-locale"/);
});
