import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/utm-builder.js';

const {csvTags,render}=globalThis.edwinUtmBuilder;
const base={url:'https://empresa.pe/landing?token=PRIVATE-SIGNED-URL#contactos',source:'google',medium:'cpc',campaign:'cyber_noviembre',content:'banner_A',term:'plantillas'};

test('C28 creates a BOM-prefixed and Excel-readable CSV from exactly five allowed UTM tags',()=>{
 const csv=csvTags(base);
 assert.ok(csv.startsWith('\uFEFF"Parámetro";"Valor"\r\n'));
 for(const [key,value] of Object.entries(base).filter(([key])=>key!=='url')){
  assert.ok(csv.includes('"utm_'+key+'";"'+value+'"'),key);
 }
 assert.equal(csv.trim().split('\n').length,6);
 assert.doesNotMatch(csv,/PRIVATE-SIGNED-URL|https?:\/\/|contactos/);
 assert.deepEqual(base,{url:'https://empresa.pe/landing?token=PRIVATE-SIGNED-URL#contactos',source:'google',medium:'cpc',campaign:'cyber_noviembre',content:'banner_A',term:'plantillas'});
});

test('C28 neutralizes spreadsheet formula payloads and quotes without removing legitimate values',()=>{
 const csv=csvTags({...base,campaign:' =HYPERLINK("https://evil.test","click")',content:'+SUM(1,2)',term:'@cmd',source:'-12'});
 assert.match(csv,/"utm_campaign";"' =HYPERLINK\(""https:\/\/evil\.test"",""click""\)"/);
 assert.match(csv,/"utm_content";"'\+SUM\(1,2\)"/);
 assert.match(csv,/"utm_term";"'@cmd"/);
 assert.match(csv,/"utm_source";"'-12"/);
 assert.equal(csv.replace(/\r\n/g,'').includes('\n'),false,'all CSV rows use CRLF');
});

test('C28 rejects incomplete or unsafe URLs and omits absent optional parameters',()=>{
 assert.throws(()=>csvTags({...base,url:'javascript:alert(1)'}));
 assert.throws(()=>csvTags({...base,source:''}));
 const csv=csvTags({...base,content:'',term:''});
 assert.doesNotMatch(csv,/utm_content|utm_term/);
 assert.match(csv,/utm_campaign/);
});

test('C28 offers a disabled-until-valid export action with no server-side sending',()=>{
 const markup=render();
 assert.match(markup,/data-ed-utm-export disabled/);
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const src=readFileSync(new URL('../public/utm-builder.js',import.meta.url),'utf8');
 assert.match(index,/utm-builder\.js\?v=growth-c28-20261104/);
 assert.match(index,/utm-builder\.css\?v=growth-c28-20261104/);
 assert.match(src,/URL\.createObjectURL/);
 assert.match(src,/URL\.revokeObjectURL/);
 assert.match(src,/edwin-crm-etiquetas-utm\.csv/);
 assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
});
