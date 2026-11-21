import test from 'node:test';
import assert from 'node:assert/strict';
import {readLimitedBody} from '../read-limited-body.js';

test('bounded reader accepts valid JSON and empty bodies',async()=>{
 const req=new Request('https://crm.example/api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"ok":true}'});
 assert.equal(await readLimitedBody(req,11),'{"ok":true}');
 const empty=new Request('https://crm.example/api',{method:'POST'});
 assert.equal(await readLimitedBody(empty,0),'');
});

test('bounded reader rejects a forged oversized Content-Length',async()=>{
 const req=new Request('https://crm.example/api',{method:'POST',headers:{'Content-Length':'999999'},body:'{}'});
 await assert.rejects(readLimitedBody(req,100),e=>e.code==='BODY_TOO_LARGE');
});

test('bounded reader handles multibyte UTF-8 split across stream chunks',async()=>{
 const bytes=new TextEncoder().encode('{"text":"á"}');
 const stream=new ReadableStream({start(controller){
  controller.enqueue(bytes.subarray(0,10));
  controller.enqueue(bytes.subarray(10,11));
  controller.enqueue(bytes.subarray(11));
  controller.close();
 }});
 const req=new Request('https://crm.example/api',{method:'POST',body:stream,duplex:'half'});
 assert.equal(await readLimitedBody(req,bytes.length),'{"text":"á"}');
});


test('bounded reader enforces actual streamed bytes despite a smaller declared length',async()=>{
 const bytes=new TextEncoder().encode('{"payload":"too large"}');
 let cancelled=false;
 const stream=new ReadableStream({
  start(controller){controller.enqueue(bytes);},
  cancel(){cancelled=true;}
 });
 const req=new Request('https://crm.example/api',{method:'POST',headers:{'Content-Length':'2'},body:stream,duplex:'half'});
 await assert.rejects(readLimitedBody(req,10),e=>e.code==='BODY_TOO_LARGE');
 assert.equal(cancelled,true);
});

test('bounded reader accepts exactly the limit and rejects one byte over',async()=>{
 const payload='{"ok":true}';
 const exact=new Request('https://crm.example/api',{method:'POST',body:payload});
 assert.equal(await readLimitedBody(exact,new TextEncoder().encode(payload).length),payload);
 const oversized=new Request('https://crm.example/api',{method:'POST',body:payload});
 await assert.rejects(readLimitedBody(oversized,new TextEncoder().encode(payload).length-1),e=>e.code==='BODY_TOO_LARGE');
});

test('bounded reader rejects malformed declared lengths and invalid limits',async()=>{
 for(const length of ['-1','1.5','12x']){
  const req=new Request('https://crm.example/api',{method:'POST',headers:{'Content-Length':length},body:'{}'});
  await assert.rejects(readLimitedBody(req,100),e=>e.code==='BODY_TOO_LARGE');
 }
 const req=new Request('https://crm.example/api',{method:'POST',body:'{}'});
 await assert.rejects(readLimitedBody(req,-1),TypeError);
});
