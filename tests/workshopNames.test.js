// Name and Birth Certificate: what a finished Build-A-Blaster gun is called, where that shows, and "Survived by" on the receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { weapons } from '../src/config/weapons.js';
import { workshopRitual as cfg, workshopNames, buildOf, gunLabel, paLine, certificateSubtitle } from '../src/config/workshop.js';
import { resolveGun } from '../src/weapons/gunStats.js';

const Y = LAYOUT.hallway.height + .3;

function fixture() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.openAll();
  g.health.invulnerable = true;
  g.gun.give(weapons.nailGun); t.tick(50);
  g.wallet.earn(50000);
  const ritual = g.features.list.find(f => f.feature.kind === 'workshop').instance.ritual;
  const bench = g.map.features.find(f => f.kind === 'workshop');
  const stand = (x, z, yaw) => { g.player.teleport({ position: new THREE.Vector3(x, Y, z), yaw }); g.player.pitch = 0; t.tick(); };
  const order = () => { ritual.choose('smoothie', 'headshot'); stand(0, bench.position.z - 1, Math.PI); t.press('KeyF', 20); t.tick(30); };
  const lever = () => { const s = bench.stations.lever; stand(s.x - 1, s.z, -Math.PI / 2); t.press('KeyF', 20); t.tick(); };
  const collect = () => { const s = bench.stations.booth; stand(s.x - 1, s.z, -Math.PI / 2); t.press('KeyF', 20); t.tick(30); };
  const fullRitual = () => { order(); lever(); collect(); };
  const announcements = () => t.hud.calls.filter(c => c[0] === 'showAnnouncement').map(c => c[1].text);
  return { ...t, ritual, bench, order, lever, collect, fullRitual, announcements };
}

test('a finished gun is named from the list, and the Birth Certificate carries the whole order', () => {
  const t = fixture(), { g } = t;
  t.fullRitual();
  const build = buildOf(g.gun.modsFor('nailGun'));
  assert.ok(workshopNames.includes(build.name), build.name);
  const certificates = t.hud.calls.filter(c => c[0] === 'showCertificate');
  assert.equal(certificates.length, 1);
  assert.deepEqual(certificates[0][1], {
    name: build.name, gunName: weapons.nailGun.name, stuffing: 'Smoothie', heart: 'Headshot', quality: 'Understuffed',
    kills: 0, round: g.rounds.round, remark: cfg.remarks.understuffed,
  });
  g.map.dispose();
});

test('the certificate reads properly for every quality', () => {
  const said = cfg.qualities.map(q => certificateSubtitle(q.name, 'Nail Gun'));
  assert.deepEqual(said, ['an Understuffed Nail Gun', 'a Regular Nail Gun', 'an Extra Stuffed Nail Gun', 'an Overstuffed Nail Gun']);
  for (const q of cfg.qualities) assert.ok(cfg.remarks[q.id], `a remark for ${q.id}`);
});

test('no two guns in a run share a name until the list runs out', () => {
  const t = fixture(), { g, ritual } = t;
  const seen = new Set();
  for (let i = 0; i < workshopNames.length; i++) {
    t.fullRitual();
    seen.add(buildOf(g.gun.modsFor('nailGun')).name);
    // Strip the build so the next order counts as a new gun, not a re-stuff.
    g.gun.setMods('nailGun', g.gun.modsFor('nailGun').filter(m => m.id !== 'build'));
  }
  assert.equal(seen.size, workshopNames.length);
  t.fullRitual(); // the list has run out: it starts again rather than failing
  assert.ok(workshopNames.includes(buildOf(g.gun.modsFor('nailGun')).name));
  assert.equal(ritual.phase, 'idle');
  g.map.dispose();
});

test('a re-stuffed gun keeps its name and the PA says so', () => {
  const t = fixture(), { g } = t;
  t.fullRitual();
  const { name } = buildOf(g.gun.modsFor('nailGun'));
  t.fullRitual();
  assert.equal(buildOf(g.gun.modsFor('nailGun')).name, name);
  const said = t.announcements();
  assert.ok(said.includes(paLine(cfg.pa.restuff, { name }).text));
  assert.ok(said.includes(paLine(cfg.pa.readyAgain, { name }).text));
  assert.ok(said.includes(paLine(cfg.pa.collectAgain, { name }).text));
  g.map.dispose();
});

test('the PA follows the order: on the conveyor, each quality as the gauge reaches it, ready, and welcome', () => {
  const t = fixture(), { g, bench } = t;
  t.order();
  const hall = bench.stations.rooms[1];
  for (let i = 0; i < 16; i++) {
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(hall.maxX - 2, 0, hall.maxZ - 1));
    zombie.position.y = Y; zombie.setState('chasing');
    zombie.takeHit({ damage: zombie.health + 1, part: 'body', source: 'hazard' });
  }
  t.lever(); t.collect();
  const { name } = buildOf(g.gun.modsFor('nailGun'));
  assert.deepEqual(t.announcements(), [
    paLine(cfg.pa.start, { gun: weapons.nailGun.name }).text,
    cfg.pa.qualities.regular.text, cfg.pa.qualities.extraStuffed.text, cfg.pa.qualities.overstuffed.text,
    paLine(cfg.pa.ready, { gun: weapons.nailGun.name }).text,
    paLine(cfg.pa.collect, { name }).text,
  ]);
  g.map.dispose();
});

test('the HUD calls a named gun by its name, and a plain gun by its model', () => {
  assert.equal(gunLabel(resolveGun(weapons.nailGun, [])), weapons.nailGun.name);
  const named = resolveGun(weapons.nailGun, [{ id: 'build', build: { name: 'Gerald' } }]);
  assert.equal(gunLabel(named), `Gerald · ${weapons.nailGun.name}`);
});

test('Survived by: the run summary names your guns, even one still at the workshop', () => {
  const t = fixture(), { g } = t;
  t.fullRitual();
  const { name } = buildOf(g.gun.modsFor('nailGun'));
  t.order(); // re-stuffing: Gerald is on the conveyor when you die
  assert.equal(g.gun.owns('nailGun'), false);
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.deepEqual(g.death.summary.survivedBy, [name]);
  g.map.dispose();
});

test('Survived by: nothing named, nothing in the summary', () => {
  const t = fixture(), { g } = t;
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.deepEqual(g.death.summary.survivedBy, []);
  g.map.dispose();
});

test('Play again frees the names', () => {
  const t = fixture(), { g } = t;
  t.fullRitual();
  g.resetRun(); t.tick();
  assert.deepEqual(g.gun.buildNames, []);
  g.map.dispose();
});
