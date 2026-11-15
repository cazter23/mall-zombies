// Shopping bags (game/bagDrops.js; numbers config/kiosk.js bagDrops): a zombie with a shopping bag sometimes drops it, with one thing from
// Kiosk Kevin's cart inside, only ever something you have room for. Walk over it to take it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { kiosk, productOf } from '../src/config/kiosk.js';

const cfg = kiosk.bagDrops;

function fixture({ round = cfg.fromRound } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  g.rounds.jumpTo(round);
  g.rounds.update = () => {};
  const bags = g.bagDrops;
  const kill = ({ bag = true, at = [6, 0, 12] } = {}) => {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(at[0], at[1], at[2]));
    zombie.model.hasBag = bag;
    zombie.setState('chasing');
    zombie.takeHit({ damage: zombie.health + 1, part: 'body', source: 'gun' });
    return zombie;
  };
  const walkTo = (position) => { g.player.teleport({ position: position.clone(), yaw: 0 }); t.tick(2); };
  return { ...t, bags, kill, walkTo };
}
const alwaysDrop = (ctx) => ctx.mock.method(Math, 'random', () => 0); // (0 also picks the first thing in `contents` there is room for)
const neverDrop = (ctx) => ctx.mock.method(Math, 'random', () => 0.999);
const full = (g, id) => g.equipment.refill(id, productOf(id).charges); // (a full pocket, as Kevin sells it)

test('a bag holds one of Kevin\'s items: walking over it puts one charge in its pocket, with a PA line each way', (ctx) => {
  const t = fixture(), { g, bags } = t;
  alwaysDrop(ctx);
  const dropped = [], taken = [];
  g.events.on('bagDrop', (e) => dropped.push(e));
  g.events.on('bagTaken', (e) => taken.push(e));
  t.kill();
  assert.equal(bags.bag?.id, 'sodaBomb');
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].pa.text, /Soda Bomb/);
  assert.equal(bags.status.name, productOf('sodaBomb').name);
  t.walkTo(bags.bag.position);
  assert.equal(bags.bag, null);
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sodaBomb', count: 1 });
  assert.equal(taken.length, 1);
  assert.ok(taken[0].pa.text.length > 0 && !taken[0].pa.text.includes('!'), 'a deadpan PA line');
  g.map.dispose();
});

test('only what you have room for: never replaces what you carry, never past a full pocket, never the Sentry', (ctx) => {
  const t = fixture(), { g, bags } = t;
  alwaysDrop(ctx);
  assert.equal(cfg.contents.sentry, undefined, 'the Sentry stays on the cart');
  g.equipment.give('sparklerCake', 1); // the lethal pocket holds another product: no Soda Bomb, but more Sparkler Cake fits
  t.kill();
  assert.equal(bags.bag.id, 'sparklerCake');
  bags.reset();
  full(g, 'sparklerCake'); full(g, 'glitterBomb'); // both pockets full
  t.kill();
  assert.equal(bags.bag.id, 'bubbleWrap', 'only the wrap has room');
  t.walkTo(bags.bag.position);
  assert.equal(g.health.armour.length, 1, 'one layer');
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sparklerCake', count: productOf('sparklerCake').charges }, 'the pocket untouched');
  g.health.addArmour(g.health.maxArmourLayers);
  t.kill();
  assert.equal(bags.bag, null, 'nothing has room: no bag at all');
  g.map.dispose();
});

test('no bag, no drop: only a bag-carrying zombie, from the right round, on a won roll, one bag at a time', (ctx) => {
  let t = fixture(), { g, bags } = t;
  const random = neverDrop(ctx);
  t.kill();
  assert.equal(bags.bag, null, 'a failed roll');
  random.mock.restore();
  alwaysDrop(ctx);
  t.kill({ bag: false });
  assert.equal(bags.bag, null, 'no bag on that zombie');
  t.kill();
  const first = bags.bag;
  assert.ok(first);
  t.kill();
  assert.equal(bags.bag, first, 'one bag at a time');
  g.map.dispose();
  t = fixture({ round: cfg.fromRound - 1 }); ({ g, bags } = t);
  t.kill();
  assert.equal(bags.bag, null, 'too early in the run');
  g.map.dispose();
});

test('a bag you no longer have room for waits on the floor until it runs out; Play again takes it away', (ctx) => {
  const t = fixture(), { g, bags } = t;
  alwaysDrop(ctx);
  t.kill();
  assert.equal(bags.bag.id, 'sodaBomb');
  const position = bags.bag.position.clone();
  full(g, 'sparklerCake'); // filled the lethal pocket with something else after it dropped
  t.walkTo(position);
  assert.equal(bags.bag?.id, 'sodaBomb', 'still on the floor');
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sparklerCake', count: productOf('sparklerCake').charges });
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 });
  t.tick(Math.ceil(cfg.lifetimeSeconds * 60) + 2);
  assert.equal(bags.bag, null, 'gone when its time runs out');
  t.kill();
  assert.ok(bags.bag);
  g.resetRun();
  assert.equal(bags.bag, null);
  assert.equal(bags.status, null);
  g.map.dispose();
});
