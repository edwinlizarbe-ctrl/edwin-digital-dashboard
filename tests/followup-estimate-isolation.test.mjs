import test from 'node:test';
import assert from 'node:assert/strict';
import { followupEstimate } from '../public/crm-followup-estimate.js';

// Regression: the public simulator must be a pure calculation over supplied
// synthetic inputs, never a shared CRM state or a source of real sales metrics.
test('independent scenarios cannot contaminate each other', () => {
  const a = followupEstimate({ leads: 100, notContactedPercent: 25 });
  const b = followupEstimate({ leads: 7, notContactedPercent: 100 });
  assert.deepEqual([a.contacted, a.notContacted], [75, 25]);
  assert.deepEqual([b.contacted, b.notContacted], [0, 7]);
  assert.deepEqual(followupEstimate({ leads: 100, notContactedPercent: 25 }), a);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(b));
  assert.equal(a.fictionalEstimate, true);
  assert.equal(b.fictionalEstimate, true);
});

test('invalid scenario after valid calculation cannot corrupt later result', () => {
  const before = followupEstimate({ leads: 12, notContactedPercent: 50 });
  for (const input of [
    { leads: '12', notContactedPercent: 50 },
    { leads: 12, notContactedPercent: 101 },
    { leads: Number.MAX_SAFE_INTEGER, notContactedPercent: 1 },
    { leads: 12, notContactedPercent: NaN },
    {},
  ]) {
    assert.throws(() => followupEstimate(input), RangeError);
  }
  assert.deepEqual(followupEstimate({ leads: 12, notContactedPercent: 50 }), before);
});

test('rounding preserves conservation of prospects at boundaries', () => {
  for (const leads of [0, 1, 3, 99999, 100000]) {
    for (const pct of [0, 1, 33, 50, 67, 99, 100]) {
      const result = followupEstimate({ leads, notContactedPercent: pct });
      assert.equal(result.contacted + result.notContacted, leads);
      assert.ok(result.contacted >= 0 && result.notContacted >= 0);
      assert.ok(result.contacted <= leads && result.notContacted <= leads);
      assert.match(result.caution, /No mide ventas/);
    }
  }
});
