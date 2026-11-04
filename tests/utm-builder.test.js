import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/utm-builder.js';

const {build,render}=globalThis.edwinUtmBuilder;
const base={url:'https://empresa.pe/landing?ref=socio#precios',source:'meta',medium:'paid_social',campaign:'cyber_noviembre'};

test('G11 creates a valid campaign URL while preserving existing parameters and fragment',()=>{
 const link=new URL(build(base));
 assert.equal(link.protocol,'https:');
 assert.equal(link.hostname,'empresa.pe');
 assert.equal(link.pathname,'/landing');
 assert.equal(link.searchParams.get('ref'),'socio');
 assert.equal(link.hash,'#precios');
 assert.deepEqual(['utm_source','utm_medium','utm_campaign'].map(x=>link.searchParams.get(x)),['meta','paid_social','cyber_noviembre']);
 assert.equal(Object.keys(base).length,4,'input object must not be mutated');
});

test('G11 safely replaces stale UTM parameters and removes omitted optional values',()=>{
 const link=new URL(build({...base,url:'https://empresa.pe/?utm_source=old&utm_content=banner&utm_term=outdated#contacto',
  source:'newsletter',medium:'email',campaign:'promocion peru',content:'video A'}));
 assert.deepEqual(link.searchParams.getAll('utm_source'),['newsletter']);
 assert.equal(link.searchParams.get('utm_term'),null);
 assert.equal(link.searchParams.get('utm_content'),'video A');
 assert.equal(link.searchParams.get('utm_campaign'),'promocion peru');
 assert.equal(link.hash,'#contacto');
});

test('G11 rejects unsafe protocols, userinfo, invalid URL and missing mandatory campaign tags',()=>{
 for(const url of ['javascript:alert(1)','http://empresa.pe','data:text/html,hi','https://user:pass@empresa.pe','no-es-url']){
  assert.throws(()=>build({...base,url}));
 }
 for(const field of ['source','medium','campaign'])assert.throws(()=>build({...base,[field]:'  '}));
});

test('G11 enforces bounded values and never puts raw unescaped HTML into builder form',()=>{
 assert.throws(()=>build({...base,source:'x'.repeat(101)}));
 assert.throws(()=>build({...base,url:'https://empresa.pe/'+ 'a'.repeat(1800)}));
 assert.throws(()=>build({...base,campaign:'prueba\nmaliciosa'}));
 const page=render();
 assert.match(page,/id="ed-utm-builder"/);
 assert.match(page,/name="source"/);
 assert.match(page,/name="campaign"/);
 assert.match(page,/data-ed-utm-copy disabled/);
 assert.match(page,/Enlace generado/);
});

test('G11 is actually mounted on the UTM page and never sends data to third parties',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const module=readFileSync(new URL('../public/utm-builder.js',import.meta.url),'utf8');
 assert.match(index,/utm-builder\.js\?v=growth-g11-20261104/);
 assert.match(index,/utm-builder\.css\?v=growth-g11-20261104/);
 assert.ok(index.indexOf('utm-builder.js')<index.indexOf('/app.js'));
 assert.match(app,/window\.edwinUtmBuilder\?\.render\(\)/);
 assert.match(module,/navigator\.clipboard\.writeText/);
 assert.doesNotMatch(module,/\bfetch\s*\(/);
});

test('C23 source presets are bounded, safe and usable in the campaign form',()=>{
 const {presetSource,sourcePresets}=globalThis.edwinUtmBuilder;
 assert.deepEqual(Object.keys(sourcePresets),['google','meta','newsletter','linkedin','referral']);
 for(const key of Object.keys(sourcePresets)){
  assert.equal(presetSource(key),key);
  assert.equal(new URL(build({...base,source:presetSource(key)})).searchParams.get('utm_source'),key);
  assert.match(render(),new RegExp('data-ed-utm-source="'+key+'"'));
 }
 for(const invalid of ['__proto__','constructor','<script>','',null,{},'x'.repeat(101)]){
  assert.throws(()=>presetSource(invalid),/predefinido no válido/);
 }
 assert.match(render(),/role="group" aria-label="Orígenes sugeridos"/);
 assert.match(render(),/no se publica ni se envía nada/);
 assert.equal(base.source,'meta','preset generation must not mutate source record');
});
