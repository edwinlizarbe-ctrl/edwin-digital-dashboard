import test from 'node:test';
import assert from 'node:assert/strict';
import {handleEmailMarketingApi,renderNewsletter} from '../email-marketing.js';
const origin='https://preview.example.workers.dev';
const id='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const s={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'fake-jwt',cookies:[]};
const env={SUPABASE_URL:'https://fake.supabase.co',SUPABASE_ANON_KEY:'fake-anon',SUPABASE_SERVICE_ROLE_KEY:'fake-service',BRASPER_BUSINESS_ID:id};
const simple=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const draft={title:'Newsletter Brásper',subject:'Hola, {{nombre}}',preheader:'Novedades',language:'es',blocks:[{type:'heading',text:'Hola, {{nombre}}'},{type:'text',text:'Estamos <a> & contigo'},{type:'button',text:'Conoce Brásper',url:'https://brasper.com'}]};
const request=(method='GET',business=id,body=null,originHeader=origin)=>new Request(origin+'/api/email-marketing?business_id='+business,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(originHeader?{Origin:originHeader}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function mock(fn){
 const old=globalThis.fetch,calls=[],rows={ed_email_campaigns:[],ed_email_contacts:[],ed_email_assets:[]};
 globalThis.fetch=async(url,options={})=>{
  const u=String(url);calls.push({u,options});
  if(u.includes('/rest/v1/businesses?'))return simple(u.includes(id)?[{id}]:[]);
  const table=Object.keys(rows).find(t=>u.includes('/rest/v1/'+t));
  if(table){
   const method=options.method||'GET';
   if(method==='POST'){
    const incoming=JSON.parse(options.body),data=Array.isArray(incoming)?incoming:[incoming];
    const inserted=[];
    for(const row of data){
     if(table==='ed_email_contacts'&&rows[table].some(x=>x.email===row.email))continue;
     const item={...row,id:'22222222-2222-4222-8222-'+String(rows[table].length+1).padStart(12,'0')};
     rows[table].push(item);inserted.push(item);
    }
    return simple(inserted,201);
   }
   if(method==='PATCH'){
    const q=new URL(u).searchParams,rec=rows[table].find(x=>x.id===String(q.get('id')).slice(3));
    if(rec){Object.assign(rec,JSON.parse(options.body));return simple([rec]);}
    return simple([]);
   }
   return simple(rows[table]);
  }
  if(u==='https://api.resend.com/emails')return simple({id:'sent-test-id'});
  throw Error('Unexpected mock URL: '+u);
 };
 try{await fn({calls,rows});}finally{globalThis.fetch=old;}
}
test('cannot access other business or admin session',async()=>{
 await mock(async({calls})=>{
  const denied=await handleEmailMarketingApi(request('GET',other),env,s);
  assert.equal(denied.status,403);
  const admin=await handleEmailMarketingApi(request('GET',id),env,{...s,user:{...s.user,role:'admin'}});
  assert.equal(admin.status,403);
  assert.equal(calls.length,0);
 });
});
test('cannot access mailing before BrasPer is configured',async()=>{
 await mock(async({calls})=>{
  const r=await handleEmailMarketingApi(request('GET'),{...env,BRASPER_BUSINESS_ID:''},s);
  assert.equal(r.status,403);assert.equal(calls.length,0);
 });
});
test('preserves drafted campaigns and never provides mass sending',async()=>{
 await mock(async({calls})=>{
  const response=await handleEmailMarketingApi(request('POST',id,{action:'save_campaign',campaign:draft}),env,s);
  assert.equal(response.status,201);
  const document=(await response.json()).campaign;
  assert.equal(document.status,'draft');
  const list=await handleEmailMarketingApi(request(),env,s);
  assert.equal((await list.json()).campaigns.length,1);
  const bulk=await handleEmailMarketingApi(request('POST',id,{action:'send_campaign',campaign_id:document.id}),env,s);
  assert.equal(bulk.status,404);
  assert.equal(calls.some(x=>x.u.includes('resend.com')),false);
 });
});
test('rejects HTML/javascript injection in newsletter blocks and safely escapes text',()=>{
 const rendered=renderNewsletter(draft,{name:'Ana <script>alert(1)</script>',company:'Brásper'});
 assert(!rendered.includes('<script>'));
 assert(rendered.includes('Ana &lt;script&gt;'));
 assert(rendered.includes('&lt;a&gt; &amp; contigo'));
 assert.throws(()=>renderNewsletter({...draft,blocks:[{type:'button',text:'Danger',url:'javascript:alert(1)'}]}));
});
test('imports only explicit consent, deduplicates and does not resurrect existing contacts',async()=>{
 await mock(async({rows})=>{
  const contacts=[{name:'Camila',email:'CAMILA@EXAMPLE.COM',consent:true,language:'pt'},
  {name:'Juan',email:'juan@example.com',consent:false},{name:'Camila',email:'camila@example.com',consent:true}];
  const first=await handleEmailMarketingApi(request('POST',id,{action:'import_contacts',contacts}),env,s);
  assert.equal(first.status,200);
  assert.equal(rows.ed_email_contacts.length,1);
  rows.ed_email_contacts[0].unsubscribed_at='2026-10-15T10:00:00Z';
  await handleEmailMarketingApi(request('POST',id,{action:'import_contacts',contacts}),env,s);
  assert.equal(rows.ed_email_contacts.length,1);
  assert.equal(rows.ed_email_contacts[0].unsubscribed_at,'2026-10-15T10:00:00Z');
 });
});
test('test sending requires an allowlisted address and refuses cross origin',async()=>{
 await mock(async({calls})=>{
  const blocked=await handleEmailMarketingApi(request('POST',id,{action:'test_email',to:'wrong@example.com',campaign:draft}),{...env,RESEND_API_KEY:'fake-key',EMAIL_FROM:'Brásper <news@example.com>',EMAIL_TEST_RECIPIENTS:'ok@example.com'},s);
  assert.equal(blocked.status,403);
  const cross=await handleEmailMarketingApi(request('POST',id,{action:'save_campaign',campaign:draft},'https://attacker.example'),env,s);
  assert.equal(cross.status,403);
  const passed=await handleEmailMarketingApi(request('POST',id,{action:'test_email',to:'ok@example.com',campaign:draft}),{...env,RESEND_API_KEY:'fake-key',EMAIL_FROM:'Brásper <news@example.com>',EMAIL_TEST_RECIPIENTS:'ok@example.com'},s);
  assert.equal(passed.status,200);
  const resends=calls.filter(c=>c.u==='https://api.resend.com/emails');
  assert.equal(resends.length,1);
  assert.deepEqual(JSON.parse(resends[0].options.body).to,['ok@example.com']);
 });
});
test('rejects SVG and invalid media without uploading',async()=>{
 await mock(async({calls})=>{
  const r=await handleEmailMarketingApi(request('POST',id,{action:'upload_image',mime:'image/svg+xml',base64:'PHN2Zz4='}),env,s);
  assert.equal(r.status,400);
  assert.equal(calls.some(x=>x.u.includes('/storage/v1/')),false);
 });
});
