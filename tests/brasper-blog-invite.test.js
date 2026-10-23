import test from 'node:test';
import assert from 'node:assert/strict';
import {adminInviteBlogEditor} from '../admin-invites.js';
const origin='https://crm.example.workers.dev',business='f2063748-9dff-4250-b4d7-f2aa01108506',user='11111111-1111-4111-8111-111111111111';
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'};
const admin={user:{role:'admin'},cookies:[]};
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function request(value='{}',from=origin){return new Request(origin+'/api/admin/invite-blog-editor',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:value})}
function mockNetwork({existing=false,roleFailure=false,wrongCompany=false}={}){
 const original=globalThis.fetch,calls=[];
 let inserted=false;
 globalThis.fetch=async(url,init={})=>{
  url=String(url);calls.push({url,method:init.method||'GET',body:init.body});
  if(url.includes('businesses?select=id,slug&slug=eq.brasper'))return response([{id:business,slug:wrongCompany?'other':'brasper'}]);
  if(url.includes('profiles?select=id&email='))return response(existing?[{id:user}]:[]);
  if(url.includes('ed_business_lifecycle?'))return response([]);
  if(url.includes('/auth/v1/invite?'))return response({user:{id:user,email:'marketing.brasper@gmail.com'}});
  if(url.includes('/rest/v1/profiles?id=eq.'))return roleFailure?response({error:'not allowed'},403):response([{id:user,role:'blog_editor'}]);
  if(url.includes('business_members?select='))return response(inserted?[{business_id:business}]:[]);
  if(url.endsWith('/rest/v1/business_members')&&init.method==='POST'){
   inserted=true;return response([{business_id:business,user_id:user}],201);
  }
  throw Error('Unexpected backend endpoint: '+url);
 };
 return {calls,restore:()=>{globalThis.fetch=original}};
}
test('Blog invite requires admin, same-origin and an empty JSON object; never takes a browser-controlled email',async()=>{
 const m=mockNetwork();
 try{
  assert.equal((await adminInviteBlogEditor(request(),env,{user:{role:'client'},cookies:[]})).status,403);
  assert.equal((await adminInviteBlogEditor(request('{}','https://evil.example'),env,admin)).status,403);
  assert.equal((await adminInviteBlogEditor(request('{"email":"intruder@example.com"}'),env,admin)).status,400);
  assert.equal(m.calls.length,0);
 }finally{m.restore()}
});
test('valid invitation assigns blog_editor BEFORE Brásper membership and never sends a password',async()=>{
 const m=mockNetwork();
 try{
  const reply=await adminInviteBlogEditor(request(),env,admin),data=await reply.json();
  assert.equal(reply.status,200);assert.equal(data.ok,true);assert.equal(data.scope,'brasper.blog');
  const role=m.calls.findIndex(x=>x.url.includes('/profiles?id=eq.')),
    joined=m.calls.findIndex(x=>x.url.endsWith('/business_members')&&x.method==='POST');
  assert(role>=0&&joined>role,'role must be restricted before membership');
  const invite=m.calls.find(x=>x.url.includes('/auth/v1/invite?'));
  assert.deepEqual(JSON.parse(invite.body),{email:'marketing.brasper@gmail.com'});
  assert(!m.calls.some(x=>String(x.body||'').includes('password')));
 }finally{m.restore()}
});
test('existing account does not get duplicate invitation',async()=>{
 const m=mockNetwork({existing:true});
 try{
  const r=await adminInviteBlogEditor(request(),env,admin);
  assert.equal(r.status,409);
  assert(!m.calls.some(x=>x.url.includes('/auth/v1/invite?')));
 }finally{m.restore()}
});
test('role assignment failure never adds business membership',async()=>{
 const m=mockNetwork({roleFailure:true});
 try{
  const r=await adminInviteBlogEditor(request(),env,admin);
  assert.equal(r.status,502);
  assert(!m.calls.some(x=>x.url.endsWith('/business_members')&&x.method==='POST'));
 }finally{m.restore()}
});
