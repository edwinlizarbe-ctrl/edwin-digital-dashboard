import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../public/crm-activation-milestones.html',import.meta.url),'utf8');
test('positive: both scope identifiers invalidate an open checklist',()=>{
 assert.match(page,/business\.addEventListener\('input',invalidateScope\)/);
 assert.match(page,/user\.addEventListener\('input',invalidateScope\)/);
});
test('negative: changing identifiers clears the old scope and disables editing',()=>{
 const body=page.match(/function invalidateScope\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
 assert.match(body,/scope=null/);
 assert.match(body,/list\.hidden=true/);
 assert.match(body,/list\.disabled=true/);
});
test('isolation: previous checkboxes and progress are cleared without storage writes',()=>{
 const body=page.match(/function invalidateScope\(\)\{([\s\S]*?)\n\}/)?.[1]||'';
 assert.match(body,/list\.replaceChildren\(\)/);
 assert.match(body,/progress\.textContent=''/);
 assert.doesNotMatch(body,/localStorage|setMilestone|fetch\(|XMLHttpRequest/);
});
