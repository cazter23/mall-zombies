// ui/orderForm.js: the one line that says what an order does reads as a sentence for every stuffing and heart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { orderSummary } from '../src/ui/orderForm.js';
import { workshopStuffings, workshopHearts } from '../src/config/workshop.js';

test('every stuffing and heart pair makes one readable line', () => {
  for (const stuffing of Object.values(workshopStuffings)) {
    for (const heart of Object.values(workshopHearts)) {
      const line = orderSummary(stuffing, heart);
      assert.match(line, /^[A-Z][^:]*: [a-z0-9].*[^.]\.$/, line);
      assert.ok(!line.includes('..'), line);
      assert.ok(line.length < 120, `too long for one line: ${line}`);
    }
  }
});

test('no line until both are picked', () => {
  assert.equal(orderSummary(null, Object.values(workshopHearts)[0]), '');
});
