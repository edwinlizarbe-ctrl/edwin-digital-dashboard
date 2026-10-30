import test from 'node:test';
import assert from 'node:assert/strict';
import { handleZernioApi } from '../zernio.js';

const businessId='11111111-1111-4111-8111-111111111111';
const profileId='66a1f0c2a4b9d3e8f1a2b3c4';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',ZERNIO_API_KEY:'private-key'};
const session={access:'customer-token',cookies:[]};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const request=(path,init)=>new Request('https://crm.example/api/zernio/'+path,init);

function installFetch(t,handler){
  const old=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,opts={})=>{
    const uri=String(url),method=opts.method||'GET';
    calls.push({uri,method});
    if(uri.includes('/rest/v1/businesses?'))return response([{id:businessId,name:'Empresa autorizada'}]);
    if(uri.startsWith('https://zernio.com/api/v1'))return handler(uri,opts);
    throw Error('Unexpected request: '+uri);
  };
  t.after(()=>{globalThis.fetch=old;});
  return calls;
}

test('GET inbox with no provider profile never provisions an external connection',async t=>{
  const calls=installFetch(t,(uri)=>{
    assert.match(uri,/\/profiles\?/);
    return response({profiles:[]});
  });
  const result=await handleZernioApi(request('inbox?business_id='+businessId),env,session);
  assert.equal(result.status,409);
  assert.match((await result.json()).error,/Conecta WhatsApp/);
  assert.equal(calls.filter(c=>c.uri.includes('zernio.com')&&c.method!=='GET').length,0);
});

test('GET inbox reads existing profile and filters non-WhatsApp threads',async t=>{
  const calls=installFetch(t,(uri)=>{
    if(uri.includes('/profiles?'))return response({profiles:[{_id:profileId,name:'EdwinCRM-'+businessId}]});
    if(uri.includes('/inbox/conversations?'))return response({data:[
      {id:'thread-wa',accountId:'wa-acct',platform:'whatsapp'},
      {id:'thread-other',accountId:'fb-acct',platform:'facebook'},
      {id:'thread-no-account',platform:'whatsapp'}
    ],pagination:{hasMore:false}});
    throw Error('Unexpected Zernio endpoint '+uri);
  });
  const result=await handleZernioApi(request('inbox?business_id='+businessId),env,session);
  assert.equal(result.status,200);
  const data=await result.json();
  assert.deepEqual(data.conversations.map(c=>c.id),['thread-wa']);
  assert.equal(calls.filter(c=>c.uri.includes('zernio.com')&&c.method!=='GET').length,0);
});

test('POST send reuses connected profile and sends only to a thread of the selected business',async t=>{
  const calls=installFetch(t,(uri,opts)=>{
    if(uri.includes('/profiles?'))return response({profiles:[{_id:profileId,name:'EdwinCRM-'+businessId}]});
    if(uri.includes('/inbox/conversations?'))return response({data:[
      {id:'thread-wa',accountId:'wa-acct',platform:'whatsapp'}
    ]});
    if(uri.endsWith('/inbox/conversations/thread-wa/messages')&&opts.method==='POST')
      return response({data:{messageId:'msg-123'}});
    throw Error('Unexpected Zernio endpoint '+uri);
  });
  const result=await handleZernioApi(request('messages',{
    method:'POST',headers:{'Content-Type':'application/json','Origin':'https://crm.example'},
    body:JSON.stringify({business_id:businessId,conversation_id:'thread-wa',message:'Hola',
      idempotency_key:'b6e67275-7d31-412c-ae8c-caf56c79909e'})
  }),env,session);
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{success:true,reference:'msg-123'});
  assert.equal(calls.filter(c=>c.uri.endsWith('/profiles')&&c.method==='POST').length,0);
  assert.equal(calls.filter(c=>c.method==='POST').length,1);
});

test('POST connect remains the only action that provisions a Zernio profile',async t=>{
  const calls=installFetch(t,(uri,opts)=>{
    if(uri.endsWith('/profiles')&&opts.method==='POST')
      return response({profile:{_id:profileId}});
    if(uri.includes('/connect/whatsapp?'))
      return response({authUrl:'https://zernio.com/connect/approved'});
    throw Error('Unexpected Zernio endpoint '+uri);
  });
  const result=await handleZernioApi(request('connect',{
    method:'POST',headers:{'Content-Type':'application/json','Origin':'https://crm.example'},
    body:JSON.stringify({business_id:businessId})
  }),env,session);
  assert.equal(result.status,200);
  assert.match((await result.json()).authUrl,/zernio\.com/);
  assert.equal(calls.filter(c=>c.uri.endsWith('/profiles')&&c.method==='POST').length,1);
});

test('unavailable business is rejected before contacting Zernio',async t=>{
  const old=globalThis.fetch;
  let providerCalled=false;
  globalThis.fetch=async url=>{
    if(String(url).includes('/rest/v1/businesses?'))return response([]);
    providerCalled=true;throw Error('Should not contact provider');
  };
  t.after(()=>{globalThis.fetch=old;});
  const result=await handleZernioApi(request('inbox?business_id='+businessId),env,session);
  assert.equal(result.status,403);
  assert.equal(providerCalled,false);
});
