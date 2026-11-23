import test from 'node:test';
import assert from 'node:assert/strict';
import {noTracking} from '../scripts/launch-audit.mjs';

test('allows local links and local metadata without outbound requests',()=>{
  assert.equal(noTracking('<link rel="preload" href="/app.css"><meta http-equiv="refresh" content="0;url=/edwin-crm.html">'),true);
});
test('rejects remote preconnect and DNS prefetch, regardless of attribute order',()=>{
  for(const tag of [
    '<link rel="preconnect" href="https://tracker.example">',
    '<link href="//tracker.example" rel="dns-prefetch">',
    '<link rel="stylesheet preconnect" href="https://tracker.example">'
  ]) assert.equal(noTracking(tag),false,tag);
});
test('rejects external meta refresh but not harmless local redirects',()=>{
  assert.equal(noTracking('<meta http-equiv="refresh" content="0;url=https://tracker.example">'),false);
  assert.equal(noTracking('<meta content="0;URL=//tracker.example" http-equiv="refresh">'),false);
  assert.equal(noTracking('<meta http-equiv="refresh" content="0;url=/crm-demo.html">'),true);
});
test('isolation: noTracking does not mutate source markup or retain state',()=>{
  const clean='<link rel="preload" href="/crm-demo.html">';
  const hostile='<link rel="dns-prefetch" href="//tracker.example">';
  assert.equal(noTracking(clean),true);
  assert.equal(noTracking(hostile),false);
  assert.equal(noTracking(clean),true);
});
