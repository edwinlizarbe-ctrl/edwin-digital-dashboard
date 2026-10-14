import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGoogleAdsApi } from '../google-ads.js';

const env={
 SUPABASE_URL:'https://example.supabase.co',
 SUPABASE_ANON_KEY:'fake-anon-key',
};
const client={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'test-session',cookies:[]};
const manager={...client,user:{...client.user,role:'admin'}};
const origin='https://example.workers.dev';

test('denies access with malformed business ID before any upstream request', async()=>{
 const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/status?business_id=bad'),env,client);
 assert.equal(r.status,403);
 assert.match((await r.json()).error,/No tienes acceso/);
});
test('superadministrator cannot reuse a customer business session',async()=>{
 const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/status?business_id=00000000-0000-4000-8000-000000000001'),env,manager);
 assert.equal(r.status,403);
});
test('rejects selecting accounts without a valid tenant context',async()=>{
 const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/select?business_id=invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"customer_id":"1234"}'}),env,client);
 assert.equal(r.status,403);
});
