import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOrigin, smokePublicRoutes} from '../scripts/smoke-public-routes.mjs';
test('positive: four public routes return HTML 200', async()=>{
 const calls=[];
 const results=await smokePublicRoutes('https://crm.example.org', async (url,opts)=>{
   calls.push({url,opts}); return {status:200,headers:new Map([['content-type','text/html; charset=utf-8']])};
 });
 assert.equal(results.length,4);assert.ok(results.every(x=>x.ok));
 assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/','/edwin-crm.html','/crm-demo.html','/crm-followup-simulator.html']);
 assert.ok(calls.every(x=>x.opts.method==='GET'&&x.opts.credentials==='omit'&&x.opts.redirect==='manual'));
});
test('negative: redirects, errors and non-HTML are failures',async()=>{
 let i=0;const responses=[{status:302,type:'text/html'},{status:404,type:'text/html'},{status:200,type:'application/json'}];
 const result=await smokePublicRoutes('https://crm.example.org',async()=>{
   const r=responses[i++];if(!r)throw new Error('network');return {status:r.status,headers:new Map([['content-type',r.type]])};
 });
 assert.equal(result.filter(x=>x.ok).length,0);
});
test('positive: public DNS names remain accepted without changing the requested origin',()=>{
 assert.equal(validateOrigin('https://crm.example.org'),'https://crm.example.org');
 assert.equal(validateOrigin('https://crm.example.org/'),'https://crm.example.org');
});
test('isolation: reject IP literals, local suffixes and internal names before any fetch',async()=>{
 for(const origin of ['https://10.0.0.1','https://192.168.1.10','https://169.254.169.254','https://8.8.8.8','https://[::1]','https://[fd00::1]','https://service.internal','https://portal.localhost','https://host.local']){
  assert.throws(()=>validateOrigin(origin),origin);
  let calls=0;
  await assert.rejects(()=>smokePublicRoutes(origin,()=>{calls++;throw Error('must not call')}));
  assert.equal(calls,0,origin);
 }
});
test('isolation: reject credentials, non-HTTPS, paths, query, local targets and custom ports before network',async()=>{
 for(const origin of ['http://crm.example.org','https://user:pass@crm.example.org','https://crm.example.org/login','https://crm.example.org/?token=abc','https://localhost','https://127.0.0.1','https://crm.example.org:8443']){
  assert.throws(()=>validateOrigin(origin));
  let calls=0;await assert.rejects(()=>smokePublicRoutes(origin,()=>{calls++;throw Error('must not call')}));
  assert.equal(calls,0);
 }
});

test('positive: each public route receives its own bounded abort signal',async()=>{
 const signals=[];
 const results=await smokePublicRoutes('https://crm.example.org',async (_url,opts)=>{
  assert.ok(opts.signal instanceof AbortSignal);
  assert.equal(opts.signal.aborted,false);
  signals.push(opts.signal);
  return {status:200,headers:new Map([['content-type','text/html']])};
 });
 assert.equal(signals.length,4);
 assert.equal(new Set(signals).size,4);
 assert.ok(results.every(r=>r.ok));
});
test('negative: aborted request fails closed without stopping later route checks',async()=>{
 let calls=0;
 const results=await smokePublicRoutes('https://crm.example.org',async (_url,opts)=>{
  calls++;
  assert.ok(opts.signal instanceof AbortSignal);
  if(calls===1)throw new DOMException('aborted','AbortError');
  return {status:200,headers:new Map([['content-type','text/html']])};
 });
 assert.equal(calls,4);
 assert.equal(results[0].ok,false);
 assert.equal(results[0].status,null);
 assert.ok(results.slice(1).every(r=>r.ok));
});
test('isolation: invalid origins never allocate a network request',async()=>{
 let calls=0;
 await assert.rejects(()=>smokePublicRoutes('https://127.0.0.1',()=>{calls++;throw Error('network')}));
 assert.equal(calls,0);
});

test('positive: HTML MIME type is case-insensitive and permits parameters',async()=>{
 const results=await smokePublicRoutes('https://crm.example.org',async()=>({status:200,headers:new Map([['content-type',' Text/HTML ; charset=utf-8']])}));
 assert.ok(results.every(r=>r.ok));
});
test('negative: HTML-looking but invalid MIME types fail closed',async()=>{
 for(const type of ['application/xhtml+xml','application/json; note=text/html','text/html-malicious','application/text/html','text/htmlish']){
  const results=await smokePublicRoutes('https://crm.example.org',async()=>({status:200,headers:new Map([['content-type',type]])}));
  assert.ok(results.every(r=>!r.ok),type);
 }
});
test('isolation: MIME validation never changes safe read-only request options',async()=>{
 const calls=[];
 await smokePublicRoutes('https://crm.example.org',async(url,opts)=>{calls.push({url,opts});return {status:200,headers:new Map([['content-type','text/htmlish']])};});
 assert.equal(calls.length,4);
 assert.ok(calls.every(c=>c.opts.method==='GET'&&c.opts.credentials==='omit'&&c.opts.redirect==='manual'&&c.opts.cache==='no-store'));
 assert.ok(calls.every(c=>new URL(c.url).hostname==='crm.example.org'));
});


test('positive: HTML without Content-Length or with a nonzero length remains valid',async()=>{
 for(const headers of [new Map([['content-type','text/html']]),new Map([['content-type','text/html'],['content-length','42']])]){
  const results=await smokePublicRoutes('https://crm.example.org',async()=>({status:200,headers}));
  assert.ok(results.every(r=>r.ok));
 }
});
test('negative: explicitly empty HTML responses fail the public-route smoke check',async()=>{
 const results=await smokePublicRoutes('https://crm.example.org',async()=>({status:200,headers:new Map([['content-type','text/html'],['content-length','0']])}));
 assert.equal(results.length,4);
 assert.ok(results.every(r=>!r.ok));
});
test('isolation: zero-length detection never changes GET safety options or makes extra requests',async()=>{
 const calls=[];
 await smokePublicRoutes('https://crm.example.org',async(url,opts)=>{
  calls.push({url,opts});
  return {status:200,headers:new Map([['content-type','text/html'],['content-length','0']])};
 });
 assert.equal(calls.length,4);
 assert.ok(calls.every(({url,opts})=>new URL(url).hostname==='crm.example.org'&&opts.method==='GET'&&opts.credentials==='omit'&&opts.redirect==='manual'));
});

test('negative: malformed, negative and zero declared lengths are never treated as valid HTML',async()=>{
 for(const length of ['0',' 0 ','-1','NaN','1oops','1, 2','']) {
  const results=await smokePublicRoutes('https://crm.example.org',async()=>({status:200,headers:new Map([['content-type','text/html'],['content-length',length]])}));
  assert.ok(results.every(r=>!r.ok),JSON.stringify(length));
 }
});
test('positive: a valid positive Content-Length remains accepted',async()=>{
 const results=await smokePublicRoutes('https://crm.example.org',async()=>({status:200,headers:new Map([['content-type','text/html'],['content-length','1024']])}));
 assert.ok(results.every(r=>r.ok));
});
test('isolation: rejected length does not alter safe GET options or cause extra requests',async()=>{
 const calls=[];
 const results=await smokePublicRoutes('https://crm.example.org',async(url,opts)=>{
  calls.push({url,opts});
  return {status:200,headers:new Map([['content-type','text/html'],['content-length','-5']])};
 });
 assert.equal(calls.length,4);
 assert.ok(results.every(r=>!r.ok));
 assert.ok(calls.every(({url,opts})=>new URL(url).hostname==='crm.example.org'&&opts.method==='GET'&&opts.credentials==='omit'&&opts.redirect==='manual'&&opts.cache==='no-store'));
});
