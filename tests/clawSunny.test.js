// Sunny runs away (game/features/clawSunny.js, built by game/features/clawMachine.js; config/clawMachine.js sunny), in the real game:
// the next site is picked at the plush, he walks there from every site through open areas only (or a lap when none is open) and
// climbs in, and the cabinet shakes; the round starting first doesn't stop him; shooting or slashing him pops him for tickets and
// re-picks the site; he is never a zombie (no kill, no +10, no power-up credit) and aim assist and the vault ignore him.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { assistable } from '../src/weapons/aimAssist.js';
import { blocksVault } from '../src/player/vault.js';

const ticks = (seconds) => Math.ceil(seconds / dt) + 1;

function setup({ open = 'all' } = {}) {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.health.invulnerable = true;
  g.wallet.earn(50_000);
  const zones = open === 'all' ? Object.keys(g.map.zones) : open;
  for (const id of zones) g.map.areaUnlocks.unlock(id);
  t.tick(150);
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine').instance;
  return { t, g, claw };
}
function standAtMachine({ t, g, claw }, distance = 1.3) {
  const { position, normal } = claw.site.cabinet;
  const floorY = cfg.sites.find((s) => s.id === claw.site.id).floorY;
  g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * distance, floorY, position.z + normal.z * distance), yaw: Math.atan2(normal.x, normal.z) });
  g.player.pitch = 0;
  t.tick();
}
// Land a grab on the plush at the live machine: the machine closes, and Sunny climbs out.
function landPlush(s) {
  const { t, g, claw } = s;
  standAtMachine(s);
  g.debug.run('clawPlush');
  t.press('KeyF', 20);
  for (let i = 0; i < ticks(cfg.sweep.firstSeconds * 2) && !claw.grab.capsules[claw.lane]?.plush; i++) t.tick();
  t.press('KeyF', 1);
  t.tick(ticks(cfg.liftSeconds));
  assert.equal(claw.phase, 'closed');
  assert.ok(claw.sunny.active, 'Sunny is out');
}
// Tick until Sunny is in; returns where he arrived and whether the cabinet shook.
function waitForArrival(s, limitSeconds = 120) {
  const { t, g, claw } = s;
  let arrived = null;
  const off = g.events.on('sunnyArrived', (e) => { arrived = e.siteId; });
  let shook = false;
  for (let i = 0; i < ticks(limitSeconds) && (claw.sunny.active || claw.sunny.shaking); i++) {
    t.tick();
    if (claw.sites.some((x) => x.cabinet.rig.group.position.lengthSq() > 0)) shook = true;
  }
  off();
  assert.ok(claw.sites.every((x) => x.cabinet.rig.group.position.lengthSq() === 0), 'every cabinet back at rest');
  return { arrived, shook };
}
// Aim the player's view at a point (yaw 0 faces -Z; pitch up is positive).
function aimAt(g, point) {
  const eye = g.player.position.clone().setY(g.player.position.y + g.player.eyeHeight);
  const d = point.clone().sub(eye);
  g.player.yaw = Math.atan2(-d.x, -d.z);
  g.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}

test('from every site: the next site is picked at the plush, Sunny walks there along open floor, climbs in, and it shakes', () => {
  const s = setup(), { g, claw } = s;
  for (const site of cfg.sites) {
    if (claw.site.id !== site.id) assert.ok(claw.moveNow(site.id));
    landPlush(s);
    const to = claw.nextSite;
    assert.ok(to && to !== claw.site, `${site.id}: another site picked at once`);
    assert.equal(claw.sunny.active.to, to, 'he is walking to it');
    assert.ok(claw.sunny.active.path.length > 2, `${site.id} -> ${to.id}: a real route on the zombies' grid, not a straight line`);
    for (const p of claw.sunny.active.path.slice(0, -1)) assert.ok(g.zombies.nav.isWalkableAt(p.x, p.z, p.y), `${site.id} -> ${to.id}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is open floor`);
    const { arrived, shook } = waitForArrival(s);
    assert.equal(arrived, to.id, `${site.id} -> ${to.id}: he got there`);
    assert.ok(shook, 'the cabinet shook as he climbed in');
    assert.equal(claw.sunny.active, null);
    g.events.emit('roundStart', { round: 2 });
    assert.equal(claw.site, to);
  }
});

test('through open areas only: with part of the mall locked his route never crosses a closed shutter', () => {
  const s = setup({ open: ['hallway', 'foodCourt', 'megaMart'] }), { g, claw } = s;
  landPlush(s);
  const to = claw.nextSite;
  assert.ok(['foodCourt', 'megaMart'].includes(to.id));
  const path = claw.sunny.active.path;
  assert.ok(path.length > 2, 'a real route');
  for (const p of path.slice(0, -1)) assert.ok(g.zombies.nav.isWalkableAt(p.x, p.z, p.y));
  assert.equal(waitForArrival(s).arrived, to.id);
});

test('no other site open: he walks a lap round his own machine and climbs back in', () => {
  const s = setup({ open: ['hallway'] }), { claw } = s;
  landPlush(s);
  assert.equal(claw.nextSite, null);
  assert.equal(claw.sunny.active.lap, true);
  assert.equal(claw.sunny.active.to, claw.site);
  assert.equal(waitForArrival(s).arrived, 'hallway');
});

test('the round starts before he arrives: the machine opens there anyway, and he finishes his walk and climbs in', () => {
  const s = setup(), { t, g, claw } = s;
  landPlush(s);
  const to = claw.nextSite;
  t.tick(ticks(cfg.sunny.climbOutSeconds + cfg.sunny.lookSeconds + 1));
  assert.equal(claw.sunny.active.phase, 'walk');
  g.events.emit('roundStart', { round: 2 });
  assert.equal(claw.site, to);
  assert.equal(claw.phase, 'idle');
  assert.ok(claw.sunny.active, 'still walking');
  assert.equal(waitForArrival(s).arrived, to.id);
});

test('shooting him pops him: 25 tickets and a new site (never his), but no kill, no +10, no power-up credit, no kill stats', () => {
  const s = setup(), { t, g, claw } = s;
  landPlush(s);
  const walkingTo = claw.nextSite;
  t.tick(ticks(cfg.sunny.climbOutSeconds) + 2); // (he's looking round, in front of the machine)
  assert.equal(claw.sunny.active.phase, 'look');
  const sunny = claw.sunny.target;
  const { normal } = claw.site.cabinet;
  g.player.teleport({ position: sunny.position.clone().addScaledVector(normal, 3.5), yaw: 0 });
  t.tick();
  aimAt(g, sunny.position.clone().setY(sunny.position.y + 0.3));
  const before = { points: g.wallet.points, earned: g.wallet.totalEarned, tickets: g.tickets.count, progress: g.powerUps.progress, kills: g.runStats.kills };
  const kills = [], popped = [];
  g.events.on('kill', (e) => kills.push(e));
  g.events.on('sunnyPopped', (e) => popped.push(e));
  for (let i = 0; i < 6 && claw.sunny.active; i++) {
    aimAt(g, sunny.position.clone().setY(sunny.position.y + 0.3));
    t.press('Mouse0', 1);
    t.tick(12);
  }
  assert.equal(claw.sunny.active, null, 'popped');
  assert.equal(popped.length, 1);
  assert.equal(g.tickets.count - before.tickets, cfg.tickets.popSunny);
  assert.deepEqual(kills, [], 'not a kill');
  assert.equal(g.wallet.points, before.points, 'no +10, no kill pay');
  assert.equal(g.wallet.totalEarned, before.earned);
  assert.equal(g.powerUps.progress, before.progress, 'no power-up credit');
  assert.equal(g.runStats.kills, before.kills);
  assert.ok(!g.shootables.includes(sunny), 'out of the shootables');
  assert.notEqual(claw.nextSite, walkingTo, 're-picked, not where he was going');
  assert.ok(claw.nextSite && claw.nextSite !== claw.site && g.map.zones[claw.nextSite.zone].open);
});

test('slashing him with the box cutter pops him too', () => {
  const s = setup(), { t, g, claw } = s;
  landPlush(s);
  t.tick(ticks(cfg.sunny.climbOutSeconds) + 2);
  const sunny = claw.sunny.target;
  const { normal } = claw.site.cabinet;
  g.player.teleport({ position: sunny.position.clone().addScaledVector(normal, 1.0), yaw: 0 });
  t.tick();
  aimAt(g, sunny.position.clone().setY(sunny.position.y + 0.3));
  const before = g.tickets.count;
  t.press('KeyV', 1);
  t.tick(30);
  assert.equal(claw.sunny.active, null);
  assert.equal(g.tickets.count - before, cfg.tickets.popSunny);
});

test('aim assist and the vault both ignore him (he is shootable, not a body)', () => {
  const s = setup(), { claw } = s;
  landPlush(s);
  const sunny = claw.sunny.target;
  assert.ok(sunny.isAlive && s.g.shootables.includes(sunny));
  assert.equal(assistable(sunny), false);
  assert.equal(blocksVault(sunny), false);
  const zombieLike = { isAlive: true, state: 'chasing' };
  assert.equal(assistable(zombieLike), true);
  assert.equal(blocksVault(zombieLike), true);
});

test('Play again while he is out: no Sunny, no shake, nothing extra in the shootables; same as a fresh game', () => {
  const fresh = snapshot(headlessGame().g);
  const s = setup(), { t, g, claw } = s;
  landPlush(s);
  t.tick(ticks(3));
  g.health.invulnerable = false;
  g.health.takeDamage(10_000);
  g.resetRun();
  assert.equal(claw.sunny.active, null);
  assert.ok(!g.shootables.includes(claw.sunny.target));
  assert.equal(g.map.group.parent.getObjectByName('sunny'), undefined);
  g.health.invulnerable = false;
  assert.deepEqual(snapshot(g), fresh);
});
