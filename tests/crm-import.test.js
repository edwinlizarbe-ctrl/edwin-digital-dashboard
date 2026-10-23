import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { handleLeadsApi } from '../leads.js';

const ctx={};
runInNewContext(readFileSync(new URL('../public/crm-import.js',import.meta.url),'utf8'),ctx);
const parse=ctx.edwinCsvImport.parseLeadsCsv;
const base='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'jwt-test',cookies:[]};
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const valid={name:'Ana Torres',email:'ana@example.com',phone:'+51999999999',source:'other',stage:'new',amount:null,currency:'PEN',campaign:'Otoño',notes:''};
const request=(rows,{id=business,origin=base,type='application/json',raw}={})=>new Request(base+'/api/crm/leads/import?business_id='+id,{
 method:'POST',headers:{Origin:origin,'Content-Type':type},
 body:raw??JSON.stringify({rows})
});
async function server(fn){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(u,opts={})=>{
  const url=String(u),method=opts.method||'GET';calls.push({url,method,headers:opts.headers,body:opts.body});
  if(url.includes('/rest/v1/businesses?'))return json(url.includes('id=eq.'+business)?[{id:business}]:[]);
  if(url.includes('/rest/v1/ed_crm_leads')&&method==='POST'){
    const body=JSON.parse(opts.body);
    return json(body.map((r,i)=>({...r,id:String(i)})),201);
  }
  throw new Error('unexpected request');
 };
 try{await fn(calls);}finally{globalThis.fetch=original;}
}
test('CSV: reconoce Excel en español con ;, acentos y comillas',()=>{
 const r=parse('\uFEFFNombre;Correo electrónico;Teléfono;Campaña;Importe;Moneda\r\n"María ""Luz"" Pérez";maria@correo.pe;999123456;"Campaña, verano";120,50;PEN\r\n');
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].name,'María "Luz" Pérez');
 assert.equal(r.rows[0].amount,120.5);
 assert.equal(r.rows[0].campaign,'Campaña, verano');
 assert.equal(r.skipped,0);
});
test('CSV: combina nombre y apellido, soporta tabulador y mapea etapa',()=>{
 const r=parse('First Name\tLast Name\tE-mail\tStage\nJoão\tSilva\tjoao@example.com\tWon\n');
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].name,'João Silva');
 assert.equal(r.rows[0].stage,'won');
});
test('CSV: omite datos inválidos y duplicados exactos sin atribuir automáticamente',()=>{
 const r=parse('Nombre,Correo,Teléfono\nAna Torres,ana@example.com,12345\nAna Torres,ana@example.com,12345\nX,bad-email,9999\n');
 assert.equal(r.rows.length,1);
 assert.equal(r.skipped,2);
 assert.ok(!('source' in r.rows[0]));
});
test('CSV: rechaza sin nombre, comillas abiertas y archivos enormes',()=>{
 assert.throws(()=>parse('Email,Phone\na@example.com,123'),/nombre/i);
 assert.throws(()=>parse('Name,Email\n"not closed,x@y.com'),/comillas/i);
 assert.throws(()=>parse('x'.repeat(2_000_001)),/grande/i);
});
test('importación: no permite mezclar empresas o suplantar identidad del creador',async()=>{
 await server(async calls=>{
  const res=await handleLeadsApi(request([{...valid,business_id:other,created_by:other}]),env,session);
  assert.equal(res.status,201);
  const insert=calls.find(x=>x.url.includes('/rest/v1/ed_crm_leads'));
  assert.ok(insert);
  const stored=JSON.parse(insert.body);
  assert.equal(stored[0].business_id,business);
  assert.equal(stored[0].created_by,session.user.id);
  assert.equal(stored[0].source,'other');
  assert.equal((await res.json()).inserted,1);
 });
});
test('importación: bloquea empresa ajena y superadministrador',async()=>{
 await server(async calls=>{
  assert.equal((await handleLeadsApi(request([valid],{id:other}),env,session)).status,403);
  assert.equal((await handleLeadsApi(request([valid]),env,{...session,user:{...session.user,role:'admin'}})).status,403);
  assert.equal(calls.filter(c=>c.url.includes('ed_crm_leads')).length,0);
 });
});
test('importación: rechaza origen externo, tipo erróneo, JSON inválido y más de 50',async()=>{
 await server(async calls=>{
  assert.equal((await handleLeadsApi(request([valid],{origin:'https://evil.com'}),env,session)).status,403);
  assert.equal((await handleLeadsApi(request([valid],{type:'text/plain'}),env,session)).status,415);
  assert.equal((await handleLeadsApi(request(null,{raw:'{invalid'}),env,session)).status,400);
  assert.equal((await handleLeadsApi(request(Array.from({length:51},()=>valid)),env,session)).status,400);
  assert.equal((await handleLeadsApi(request([valid],{raw:JSON.stringify({rows:[valid],extra:'a'.repeat(96000)})}),env,session)).status,413);
  assert.equal(calls.filter(c=>c.url.includes('ed_crm_leads')).length,0);
 });
});
test('importación: valida todas las filas antes de un solo INSERT',async()=>{
 await server(async calls=>{
  const res=await handleLeadsApi(request([valid,{...valid,name:'X'}]),env,session);
  assert.equal(res.status,400);
  assert.match((await res.json()).error,/Fila 2/);
  assert.equal(calls.filter(c=>c.url.includes('ed_crm_leads')).length,0);
 });
});
test('UI y Worker: importador accesible sin modificar login ni autenticación',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.ok(index.includes('/crm-import.js?'));
 assert.ok(index.indexOf('/crm-import.js')<index.indexOf('/app.js'));
 for(const marker of ['id="crm-import-file"','id="crm-import-source"','data-act="crm-import-run"','function crmImportPanel()','/api/crm/leads/import?business_id=','globalThis.edwinCsvImport.parseLeadsCsv','state.crmImportRows=state.crmImportRows.slice(chunk.length)','Ir al importador CSV'])assert.ok(app.includes(marker),marker);
 assert.ok(worker.includes("path === '/api/crm/leads/import'"));
 assert.ok(app.includes('id="login-form"'));
});
