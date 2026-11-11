// Kiosk Kevin's balance bar (docs/kiosk-kevin-plan.md, phase 7 "Done when"), read from the same maths `npm run kiosk` prints
// (tools/kioskBalance.js), and the report itself still runs. The Bubble Wrap maths is checked against the real game's health.
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { headlessGame } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { kiosk } from '../src/config/kiosk.js';
import { zombieTypes } from '../src/config/zombies.js';
import {
  ROUND_INCOME, priceShare, damagePerPoint, ammoDamagePerPoint, sodaBomb, hitsToDeath, wrapShare, maxLayers, layerStrength, equipmentPower,
} from '../tools/kioskBalance.js';

const SELLING = Object.keys(economy.kiosk);
const DAMAGING = ['sodaBomb', 'sparklerCake', 'sentry'];

test('no product is a must-buy at round 2: each costs at least 40% of what the round pays, and none kills cheaper than ammo', () => {
  assert.deepEqual([...SELLING].sort(),[...Object.keys(kiosk.products), 'bubbleWrap'].sort(), 'every product has a price');
  for (const id of SELLING) {
    assert.ok(priceShare(id, 2) >= 0.4, `${id}: ${Math.round(priceShare(id, 2) * 100)}% of round 2's ${ROUND_INCOME[2]}`);
  }
  // Thrown into a crowd every time, a pocket still deals less per point than the Price Gun's own wall ammo with every shot landing,
  // at every round: equipment buys area and no aiming, never cheaper killing.
  const ammo = ammoDamagePerPoint('priceGun');
  for (let round = 2; round <= 30; round++) {
    for (const id of DAMAGING) assert.ok(damagePerPoint(id, round) < ammo, `${id} at round ${round}: ${damagePerPoint(id, round).toFixed(1)} a point against ${ammo.toFixed(1)}`);
  }
});

test('the Soda Bomb is still worth its price at round 25: weaker, not useless, and small change against the round', () => {
  const late = sodaBomb(25);
  assert.ok(late.share >= 0.4 && late.share <= 0.6, `the centre takes ${Math.round(late.share * 100)}% of a Shopper`);
  assert.ok(late.crowdZombies >= 1, `a crowd gives up ${late.crowdZombies.toFixed(2)} Shoppers' worth`);
  assert.ok(sodaBomb(10).share >= 1, 'it still kills what it lands on at round 10');
  assert.ok(priceShare('sodaBomb', 25) <= 0.05, `a pocket is ${Math.round(priceShare('sodaBomb', 25) * 100)}% of round 25's income`);
  // The fade (exponent 0.37): power keeps rising, far slower than zombie health.
  for (let round = 2; round <= 30; round++) assert.ok(equipmentPower(round) > equipmentPower(round - 1));
});

test('Bubble Wrap does not double survival by itself, and the hits-to-death maths is the game\'s', () => {
  assert.ok(wrapShare() < 1, `a full wrap absorbs ${Math.round(wrapShare() * 100)}% of the player's health`);
  const shopper = zombieTypes.shopper.attack.damage;
  assert.ok(hitsToDeath(shopper, maxLayers()) < 2 * hitsToDeath(shopper, 0), 'Shopper hits to death, full wrap against none');
  for (const layers of [0, maxLayers()]) {
    const { g } = headlessGame();
    g.health.addArmour(layers);
    let hits = 0;
    while (!g.state.over && hits < 20) { g.events.emit('playerHit', { damage: shopper }); hits += 1; }
    assert.equal(hits, hitsToDeath(shopper, layers), `${layers} layers of ${layerStrength()}`);
  }
});

test('npm run kiosk prints every section', () => {
  const run = spawnSync(process.execPath, ['tools/kioskReport.mjs'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  for (const section of ['SODA BOMB', 'SPARKLER CAKE', 'SPIN-O-MATIC SENTRY', 'BUBBLE WRAP', 'DAMAGE PER POINT', 'PRICES IN ROUNDS OF INCOME']) {
    assert.ok(run.stdout.includes(section), section);
  }
});
