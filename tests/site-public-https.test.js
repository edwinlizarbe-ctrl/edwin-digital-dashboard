import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWebsite,handleSiteCreate} from '../site-registration.js';

const business='00000000-0000-4000-8000-000000000001';
const base='https://crm.example.workers.dev';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon'};
const session={user:{id:'user',role:'client'},access:'mock-access',cookies:[]};
function request(url,type='application/json'){
 return new Request(base+'/api/sites/create',{
  method:'POST',headers:{Origin:base,'Content-Type':type},
  body:JSON.stringify({business_id:business,name:'Sitio de prueba',url})
 });
}
async function noNetwork(fn){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(...args)=>{calls.push(args);throw new Error('No external calls expected');};
 try{await fn(calls);}finally{globalThis.fetch=original;}
}
test('sitios solo permiten HTTPS y normalizan hostname y ruta',()=>{
 assert.equal(validateWebsite(' https://EMPRESA.PE/servicios '),'https://empresa.pe/servicios');
 assert.equal(validateWebsite('https://mañana.pe/'),'https://xn--maana-pta.pe/');
 assert.equal(validateWebsite('http://empresa.pe'),null);
 assert.equal(validateWebsite('ftp://empresa.pe'),null);
});
test('sitios rechazan direcciones IP, localhost y dominios internos',()=>{
 for(const site of [
  'https://127.0.0.1','https://192.168.0.1','https://10.0.0.4',
  'https://[::1]','https://sistema.local','https://erp.internal','https://localhost'
 ])assert.equal(validateWebsite(site),null,site);
});
test('sitios rechazan etiquetas DNS inválidas y hostnames incompletos',()=>{
 for(const site of [
  'https://miempresa','https://a..com','https://-empresa.com',
  'https://empresa-.com','https://empresa.123'
 ])assert.equal(validateWebsite(site),null,site);
});
test('sitios rechazan credenciales, fragmentos y puertos no estándar',()=>{
 for(const site of [
  'https://u:p@empresa.pe','https://empresa.pe/#token',
  'https://empresa.pe:8080','https://empresa.pe:8443'
 ])assert.equal(validateWebsite(site),null,site);
});
test('el endpoint rechaza URL HTTP antes de consultar Supabase',async()=>{
 await noNetwork(async calls=>{
  const r=await handleSiteCreate(request('http://tienda.pe'),env,session);
  assert.equal(r.status,400);assert.equal(calls.length,0);
 });
});
test('el endpoint rechaza MIME application/jsonp antes de acceder a datos',async()=>{
 await noNetwork(async calls=>{
  const r=await handleSiteCreate(request('https://tienda.pe','application/jsonp'),env,session);
  assert.equal(r.status,415);assert.equal(calls.length,0);
 });
});
