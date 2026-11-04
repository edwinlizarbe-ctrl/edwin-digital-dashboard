import test from 'node:test';
import assert from 'node:assert/strict';
import {adminInvite,acceptInvite,adminInviteBlogEditor} from '../admin-invites.js';

const base='https://crm.example.workers.dev';
const admin={user:{id:'11111111-1111-4111-8111-111111111111',role:'admin'},cookies:[]};
const actions=[
 ['admin invite',req=>adminInvite(req,{},admin)],
 ['accept invite',req=>acceptInvite(req,{})],
 ['blog editor invite',req=>adminInviteBlogEditor(req,{},admin)]
];

test('all invitation endpoints reject and cancel huge streaming bodies before accessing credentials',async()=>{
 for(const [label,run] of actions){
  let produced=0,cancelled=false;
  const stream=new ReadableStream({
   pull(controller){
    produced++;
    controller.enqueue(new Uint8Array(1024));
    if(produced>=100)controller.close();
   },
   cancel(){cancelled=true;}
  });
  const req=new Request(base+'/api/admin/invite',{
   method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:stream,duplex:'half'
  });
  const response=await run(req);
  assert.equal(response.status,400,label);
  assert.equal(cancelled,true,label+' must cancel the body stream');
  assert.ok(produced<100,label+' must not buffer the whole request');
 }
});
