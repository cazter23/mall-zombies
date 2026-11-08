import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { createIncentiveHud } from '../src/ui/incentiveHud.js';
import { createRitualHud } from '../src/ui/ritualHud.js';

test('exhausted rewards disappear, but active benefits and timed drops remain', () => {
  menuDom(); const view = createIncentiveHud();
  const status = { round: 4, progress: .4, available: false, effects: [] };
  view.update(status); assert.equal(view.element.hidden, true);
  view.update({ ...status, pickup: { id: 'employeeDiscount', remaining: 10 } });
  assert.equal(view.element.hidden, false);
  assert.equal(view.element.querySelector('.incentive-progress').hidden, true);
  assert.match(view.element.querySelector('.incentive-drop').textContent, /10s/);
  view.update({ ...status, available: true });
  assert.equal(view.element.querySelector('.incentive-progress').hidden, false);
});

test('benefit hints teach the first activation, retain live counters thereafter, and reset with the run', () => {
  menuDom(); const view = createIncentiveHud();
  const status = { round: 4, progress: .4, available: false, effects: [{ id: 'lossPrevention', remaining: 20, charges: 3 }] };
  view.update(status);
  const hint = () => view.element.querySelector('.incentive-effect').children[1];
  assert.equal(hint().hidden, false);
  view.update({ ...status, effects: [] });
  view.update({ ...status, effects: [{ id: 'lossPrevention', remaining: 19, charges: 2 }] });
  assert.equal(hint().hidden, true);
  assert.match(view.element.querySelector('.incentive-effect').children[0].textContent, /19s.*2 LEFT/);
  view.reset(); view.update(status);
  assert.equal(hint().hidden, false);
});

test('workshop ticket leads with remaining time and current/next quality', () => {
  menuDom(); const view = createRitualHud();
  view.element.children[2].children[0].style = {};
  view.update({ phase: 'working', gunName: 'Price Gun', stage: 'Being stitched up', kills: 7, quality: { id: 'regular', name: 'Regular' }, next: { minKills: 9, name: 'Extra Stuffed' }, secondsLeft: 11.3, progress: .6 });
  assert.equal(view.element.querySelector('.ritual-stage').textContent, '12s remaining');
  assert.match(view.element.querySelector('.ritual-gauge').textContent, /Regular.*7\/9.*Extra Stuffed/);
});
