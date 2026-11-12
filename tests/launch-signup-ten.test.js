import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSignup, handleOnboardingBusiness, validateBusinessName} from '../signup.js';
const base='https://crm.example.workers.dev';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test-anon'};
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'test-jwt',cookies:[]};
const good={email:'hello@example.com',password:'segura123456',confirm:'segura123456'};
const req=(path,body,{method='POST',type='application/json',origin=base,raw}={})=>new Request(base+path,{
 method,headers:{'Content-Type':type,Origin:origin},...(method==='GET'?{}:{body:raw??JSON.stringify(body)})
});
const withoutFetch=async fn=>{const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('No debe consultar otro servicio');};try{return await fn();}finally{globalThis.fetch=old;}};
test('A41: onboarding sin sesión responde 403 sin excepción ni red',async()=>{
 await withoutFetch(async()=>{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Mi Tienda'}),env,null);assert.equal(r.status,403);});
});
test('A42: GET anónimo al onboarding responde 405 sin excepción',async()=>{
 await withoutFetch(async()=>{const r=await handleOnboardingBusiness(req('/api/onboarding/business',null,{method:'GET'}),env,undefined);assert.equal(r.status,405);});
});
test('A43: Origin extranjero sin sesión responde 403',async()=>{
 await withoutFetch(async()=>{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Mi Tienda'},{origin:'https://evil.example'}),env,null);assert.equal(r.status,403);});
});
test('A44: cookies malformadas no se reflejan ni provocan error',async()=>{
 await withoutFetch(async()=>{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Mi Tienda'}),env,{user:session.user,access:'',cookies:'token-falso'});assert.equal(r.status,403);assert.equal(r.headers.get('set-cookie'),null);});
});
test('A45: con sesión válida las cookies existentes se respetan en errores',async()=>{
 await withoutFetch(async()=>{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'<script>'}),env,{...session,cookies:['test=1; Path=/']});assert.equal(r.status,400);assert.match(r.headers.get('set-cookie'),/test=1/);});
});
test('A46: Content-Type falsamente parecido a JSON se rechaza',async()=>{
 await withoutFetch(async()=>{const r=await handleSignup(req('/api/auth/signup',good,{type:'application/jsonp'}),env);assert.equal(r.status,415);});
});
test('A47: JSON con charset es aceptado para registro auténtico',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({id:'user'}),{status:200,headers:{'Content-Type':'application/json'}});
 try{const r=await handleSignup(req('/api/auth/signup',good,{type:'application/json; charset=utf-8'}),env);assert.equal(r.status,200);}finally{globalThis.fetch=old;}
});
test('A48: el registro siempre responde sin cachear ni permitir MIME sniffing',async()=>{
 await withoutFetch(async()=>{const r=await handleSignup(req('/api/auth/signup',null,{raw:'{}'}),env);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('referrer-policy'),'no-referrer');});
});
test('A49: una sesión sin JWT de acceso no puede llamar al RPC',async()=>{
 await withoutFetch(async()=>{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Mi Tienda'}),env,{...session,access:null});assert.equal(r.status,403);});
});
test('A50: una carga UTF-8 excesiva se rechaza por bytes aunque no por caracteres',async()=>{
 const body={...good,email:'é'.repeat(2100)};
 await withoutFetch(async()=>{const r=await handleSignup(req('/api/auth/signup',body),env);assert.equal(r.status,413);});
});

// No deben confundirse empresas por caracteres invisibles o inversión de dirección.
test('onboarding acepta nombres legítimos con tildes y espacios normalizados',()=>{
 assert.deepEqual(validateBusinessName({name:'  Clínica   Perú  '}),{name:'Clínica Perú'});
});
test('onboarding rechaza marcas zero-width y controles bidi invisibles',()=>{
 for(const name of ['Mi\u200bEmpresa','Mi\u200dEmpresa','Mi\u202eEmpresa','Mi\u2066Empresa','Mi\ufeffEmpresa']){
  assert.match(validateBusinessName({name}).error,/caracteres no permitidos/);
 }
});
test('onboarding no envía nombres engañosos a Supabase ni revela cookies ajenas',async()=>{
 await withoutFetch(async()=>{
  const response=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Empresa\u202eXYZ'}),env,{...session,cookies:[]});
  assert.equal(response.status,400);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(response.headers.get('cache-control'),'no-store');
 });
});

test('Auth signup disables automatic upstream redirects while preserving successful registration',async()=>{
 const old=globalThis.fetch;let options;
 globalThis.fetch=async (_url,opts)=>{options=opts;return new Response(JSON.stringify({id:'synthetic-user'}),{status:201});};
 try{const r=await handleSignup(req('/api/auth/signup',good),env);assert.equal(r.status,200);assert.equal(options.redirect,'error');assert.equal(r.headers.get('set-cookie'),null);}
 finally{globalThis.fetch=old;}
});
test('Auth signup fails closed if upstream attempts a redirect',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async (_url,opts)=>{calls++;assert.equal(opts.redirect,'error');throw new TypeError('redirect rejected');};
 try{const r=await handleSignup(req('/api/auth/signup',good),env);assert.equal(r.status,502);assert.equal(calls,1);assert.equal(r.headers.get('set-cookie'),null);}
 finally{globalThis.fetch=old;}
});
test('Auth onboarding disables upstream redirects for bearer tokens',async()=>{
 const old=globalThis.fetch;let options;
 globalThis.fetch=async (_url,opts)=>{options=opts;return new Response(JSON.stringify({id:'business-1',name:'Mi Tienda',slug:'mi-tienda',created:true}),{status:200});};
 try{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Mi Tienda'}),env,session);assert.equal(r.status,200);assert.equal(options.redirect,'error');}
 finally{globalThis.fetch=old;}
});
test('Auth onboarding rejects upstream redirects without exposing session',async()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async (_url,opts)=>{calls++;assert.equal(opts.redirect,'error');throw new TypeError('redirect rejected');};
 try{const r=await handleOnboardingBusiness(req('/api/onboarding/business',{name:'Mi Tienda'}),env,session);assert.equal(r.status,502);assert.equal(calls,1);assert.doesNotMatch(await r.text(),/test-jwt/);}
 finally{globalThis.fetch=old;}
});
test('Foreign origin cannot reach upstream Auth even with redirect protection',async()=>{
 await withoutFetch(async()=>{const r=await handleSignup(req('/api/auth/signup',good,{origin:'https://foreign.example'}),env);assert.equal(r.status,403);});
});
