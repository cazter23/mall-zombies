import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Weapon } from '../src/weapons/weapon.js';
import { createPlayerGun } from '../src/weapons/playerGun.js';
import { withTier } from '../src/weapons/upgrades.js';
import { damageFalloff as pelletDamageFalloff } from '../src/weapons/gunStats.js';
import { pelletSpreadDegrees } from '../src/weapons/aim.js';
import { weapons } from '../src/config/weapons.js';
import { audio } from '../src/config/audio.js';
import { feel } from '../src/config/feel.js';
import { economy, zombieHealthForRound } from '../src/config/economy.js';
import { createPlayerStats } from '../src/player/stats.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { createRunStats } from '../src/game/runStats.js';
import { pointsForHit, createWallet } from '../src/game/wallet.js';
import { createInteractions } from '../src/game/interactions.js';
import { featuresOf } from '../src/game/features/index.js';
import { createEffects } from '../src/fx/effects.js';

const dt = 1 / feel.simulation.tickRate;
const tick = (w, input = {}) => w.update(dt, { triggerPressed: false, reloadPressed: false, ...input });
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

test('burst: one held press gives three darts at the configured cadence and individual ammo', () => {
  const w = new Weapon(weapons.foamDartBlaster, createPlayerStats());
  const times = [];
  for (let i = 0; i < 120; i++) if (tick(w, { triggerPressed: i === 0, triggerHeld: true }) === 'fire') times.push(i * dt);
  assert.equal(times.length, 3);
  assert.equal(w.magazine, 27);
  times.forEach((time, i) => assert.ok(Math.abs(time - i * 0.07) <= dt));
});

test('burst: a buffered press starts the next burst after the last dart cooldown, with no tick rounding drift', () => {
  const w = new Weapon(weapons.foamDartBlaster, createPlayerStats());
  w.reserve = 0; // observe one magazine without an automatic reload starting an eleventh burst
  const times = [];
  let last = -Infinity;
  for (let i = 0; i < 300; i++) {
    // Press just before ready, once the burst itself has ended.
    const press = i === 0 || (!w.isBursting && w.cooldown < 0.08 && i - last > 10);
    if (press) last = i;
    if (tick(w, { triggerPressed: press }) === 'fire') times.push(i * dt);
  }
  // Ten bursts in the 30-dart magazine. Starts follow the configured burst cycle.
  assert.equal(times.length, 30);
  const cycle = w.def.burst.interval * (w.def.burst.count - 1) + w.def.fireInterval;
  for (let burst = 0; burst < 10; burst++) {
    assert.ok(Math.abs(times[burst * 3] - burst * cycle) < dt + 1e-9);
  }
});

test('burst: an almost-empty magazine stops silently; the next press dry-clicks and reloads', () => {
  const w = new Weapon(weapons.foamDartBlaster, createPlayerStats()); w.magazine = 2;
  const events = [];
  for (let i = 0; i < 60; i++) { const event = tick(w, { triggerPressed: i === 0, triggerHeld: true }); if (event) events.push(event); }
  assert.deepEqual(events, ['fire', 'fire']);
  assert.equal(w.magazine, 0); assert.equal(w.isBursting, false); assert.equal(w.isReloading, false);
  assert.equal(tick(w, { triggerPressed: true }), 'empty'); assert.equal(w.isReloading, true);
});

test('burst: reload waits until the last dart, and a direct reload request also queues', () => {
  for (const direct of [false, true]) {
    const w = new Weapon(weapons.foamDartBlaster, createPlayerStats());
    assert.equal(tick(w, { triggerPressed: true }), 'fire');
    if (direct) w.startReload();
    const events = [];
    for (let i = 0; i < 20; i++) {
      const event = tick(w, { reloadPressed: !direct && i === 0 }); if (event) events.push(event);
      if (w.isBursting) assert.equal(w.isReloading, false);
    }
    assert.deepEqual(events, ['fire', 'fire']); assert.equal(w.isReloading, true);
    for (let i = 0; i < 120; i++) tick(w);
    assert.equal(w.magazine, 30); assert.equal(w.reserve, 141);
  }
});

test('burst: blocking, reset and ammo refill clear pending darts and reload requests', () => {
  for (const interrupt of [(w) => tick(w, { blocked: true }), (w) => w.reset(), (w) => w.refill()]) {
    const w = new Weapon(weapons.foamDartBlaster, createPlayerStats());
    tick(w, { triggerPressed: true }); w.startReload(); interrupt(w);
    assert.equal(w.isBursting, false); assert.equal(w.reloadQueued, false);
    for (let i = 0; i < 120; i++) assert.equal(tick(w), null);
  }
});

function fixture(def, shootables = [], colliders = []) {
  const held = new Set(), pressed = new Set();
  const input = { pressed, held, device: 'keyboard', moveAxis: () => ({ x: 0, y: 0 }),
    consumeAction(a) { const v = pressed.has(a); pressed.delete(a); return v; },
    actionDown: (a) => held.has(a), actionPressed: (a) => pressed.has(a) };
  const stats = createPlayerStats();
  let recoils = 0, flashes = 0, markers = 0, puffs = 0, splats = 0;
  const tracers = [], hits = [], sounds = [], runStats = createRunStats();
  const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), stats, grounded: true,
    isSprinting: false, sprintAmount: 0, blockSprint() {},
    getAim(o, d) { o.set(0, 1.6, 0); d.set(0, 0, -1); }, addRecoil() { recoils++; } };
  const gun = createPlayerGun({ def, stats, player, input, colliders, shootables,
    effects: { tracer(a,b,c) { tracers.push({ end: b.clone(), color: c }); }, splat() { splats++; }, puff() { puffs++; } },
    viewmodel: { fire() { flashes++; }, dryFire() {}, jolt() {}, getMuzzleWorldPosition: (out) => out.set(0,1.6,0) },
    hud: { showHitMarker() { markers++; } }, sound: { play(n) { sounds.push(n); } },
    onHit: (hit) => hits.push(hit), onShot: (shot) => runStats.recordShot(shot),
  });
  return { gun, player, input, hits, tracers, sounds, runStats,
    counts: () => ({ recoils, flashes, markers, puffs, splats }),
    fire() { pressed.add('fire'); gun.update(dt); return gun.lastShot; } };
}

test('burst integration: each dart recoils, blooms, flashes, sounds and records a shot', () => {
  const f = fixture(weapons.foamDartBlaster);
  f.input.held.add('fire'); f.fire();
  for (let i = 0; i < 12; i++) f.gun.update(dt);
  assert.equal(f.gun.weapon.magazine, 27); assert.equal(f.counts().recoils, 3); assert.equal(f.counts().flashes, 3);
  assert.equal(f.sounds.filter((s) => s === 'foamShot').length, 3); assert.equal(f.runStats.shotsFired, 3);
  assert.ok(f.gun.aim.spreadDegrees > weapons.foamDartBlaster.spread.base + 1);
});

test('burst integration: switching away and back never resumes an abandoned burst', () => {
  const f = fixture(weapons.foamDartBlaster);
  f.gun.give(weapons.priceGun); for (let i = 0; i < 40; i++) f.gun.update(dt);
  f.input.pressed.add('weapon1'); for (let i = 0; i < 40; i++) f.gun.update(dt);
  f.fire(); f.input.pressed.add('switchWeapon'); f.gun.update(dt);
  const burstGun = f.gun.weaponFor('foamDartBlaster');
  assert.equal(burstGun.isBursting, false);
  for (let i = 0; i < 40; i++) f.gun.update(dt);
  f.input.pressed.add('weapon1'); for (let i = 0; i < 100; i++) f.gun.update(dt);
  assert.equal(burstGun.magazine, weapons.foamDartBlaster.magazineSize - 1); assert.equal(f.runStats.shotsFired, 1);
});

test('burst integration: melee/vault blocking stops darts, including a replaced loadout slot', () => {
  for (const paused of [false, true]) {
    const f = fixture(weapons.foamDartBlaster); f.fire(); f.gun.update(dt, true, paused);
    for (let i = 0; i < 100; i++) f.gun.update(dt);
    assert.equal(f.runStats.shotsFired, 1); assert.equal(f.gun.weapon.magazine, weapons.foamDartBlaster.magazineSize - 1);
  }
  const f = fixture(weapons.foamDartBlaster);
  f.gun.give(weapons.priceGun); for (let i = 0; i < 40; i++) f.gun.update(dt);
  f.input.pressed.add('weapon1'); for (let i = 0; i < 40; i++) f.gun.update(dt);
  f.fire(); f.gun.give(weapons.confettiCannon); for (let i = 0; i < 100; i++) f.gun.update(dt);
  assert.equal(f.runStats.shotsFired, 1); assert.equal(f.gun.owns('foamDartBlaster'), false);
});

function target(distance, health = 1000, part = 'body', minX = -2, maxX = 2) {
  return { type: { id: 'shopper' }, health, isAlive: true, splatColors: [0x55ff55], damages: [],
    hitboxes: [{ part, box: box(minX, 0, -distance-0.2, maxX, 3, -distance) }],
    takeHit({ damage, part: hitPart }) { this.damages.push(damage); this.health -= damage;
      const killed = this.health <= 0; this.isAlive = !killed; if (killed) this.killedByHeadshot = hitPart === 'head'; return { killed }; } };
}

test('pellets: one ray per pellet, one ammo, recoil, flash, hit marker, splat and points callback', (t) => {
  t.mock.method(Math, 'random', () => 0); const zombie = target(2);
  const n = weapons.confettiCannon.pellets.count;
  const f = fixture(weapons.confettiCannon, [zombie]); const shot = f.fire();
  assert.equal(shot.pellets.length, n); assert.equal(f.tracers.length, n); assert.equal(zombie.damages.length, n);
  assert.equal(zombie.health, 1000 - n * weapons.confettiCannon.damage); assert.equal(f.gun.weapon.magazine, 5);
  assert.deepEqual(f.counts(), { recoils: 1, flashes: 1, markers: 1, puffs: 0, splats: 1 });
  assert.equal(f.hits.length, 1); assert.equal(pointsForHit(f.hits[0]), 10);
  assert.equal(f.runStats.shotsFired, 1); assert.equal(f.runStats.shotsHit, 1);
});

test('pellets: damage falls linearly with distance and includes headshots and player stats', (t) => {
  t.mock.method(Math, 'random', () => 0); const falloff = weapons.confettiCannon.falloff;
  const { start, end, minMultiplier: min } = falloff, mid = (start + end) / 2;
  for (const [distance, expected] of [[2,1], [start,1], [mid,(1 + min) / 2], [end,min], [30,min]]) {
    assert.ok(Math.abs(pelletDamageFalloff(distance, falloff) - expected) < 1e-9);
    const zombie = target(distance, 10000, 'head'); const f = fixture(weapons.confettiCannon, [zombie]);
    f.player.stats.damageMultiplier = 1.5; f.fire();
    assert.equal(zombie.damages.length, weapons.confettiCannon.pellets.count);
    for (const damage of zombie.damages) assert.ok(Math.abs(damage - weapons.confettiCannon.damage*weapons.confettiCannon.headshotMultiplier*1.5*expected) < 1e-8);
  }
});

test('pellets: a wall blocks all damage and limits dust to four puffs', (t) => {
  t.mock.method(Math, 'random', () => 0); const zombie = target(4);
  const f = fixture(weapons.confettiCannon, [zombie], [box(-3,0,-2,3,4,-1.8)]); f.fire();
  assert.equal(zombie.health, 1000); assert.equal(f.hits.length, 0); assert.equal(f.counts().puffs, 4);
  assert.equal(f.counts().markers, 0); assert.equal(f.runStats.shotsHit, 0);
});

test('pellets: one kill bonus for the front zombie, and the pellets carry on into the one behind at half damage', (t) => {
  t.mock.method(Math, 'random', () => 0); const front = target(2, 150), back = target(3, 1000);
  const f = fixture(weapons.confettiCannon, [front,back]); f.fire();
  const d = weapons.confettiCannon, half = d.damage * d.pierce.damageFalloff[1], n = d.pellets.count;
  assert.equal(front.isAlive, false); assert.equal(front.damages.length, Math.ceil(150 / d.damage), 'dead zombies stop taking damage');
  assert.equal(back.damages.length, n, 'every pellet carried through to the second zombie');
  for (const damage of back.damages) assert.equal(damage, half);
  assert.equal(back.health, 1000 - n * half);
  assert.equal(f.hits.length, 2); assert.equal(f.counts().splats, 2);
  const front_ = f.hits.find((h) => h.target === front), back_ = f.hits.find((h) => h.target === back);
  assert.equal(front_.killed, true); assert.equal(pointsForHit(front_), 60);
  assert.equal(back_.killed, false); assert.equal(pointsForHit(back_), 10, 'one hit payout per zombie, not per pellet');
});

test('pellets: they go through two zombies and no further, and a wall still stops them', (t) => {
  t.mock.method(Math, 'random', () => 0);
  const a = target(2), b = target(3), c = target(4);
  const f = fixture(weapons.confettiCannon, [a, b, c]); f.fire();
  const n = weapons.confettiCannon.pellets.count;
  assert.equal(a.damages.length, n); assert.equal(b.damages.length, n); assert.equal(c.damages.length, 0);
  const wall = box(-3, 0, -2.5, 3, 4, -2.3), x = target(2), y = target(4);
  const g = fixture(weapons.confettiCannon, [x, y], [wall]); g.fire();
  assert.equal(x.damages.length, n); assert.equal(y.damages.length, 0, 'the wall behind the first zombie stops them');
});

test('pellets: a headshot killing pellet pays the head bonus once', (t) => {
  t.mock.method(Math, 'random', () => 0); const zombie = target(2,150,'head');
  const f = fixture(weapons.confettiCannon,[zombie]); f.fire();
  assert.equal(zombie.damages.length, Math.ceil(150 / (weapons.confettiCannon.damage * weapons.confettiCannon.headshotMultiplier))); assert.equal(f.hits.length,1);
  assert.equal(f.hits[0].headshot,true); assert.equal(pointsForHit(f.hits[0]),100);
});

test('pellets: an earlier head hit does not award the head bonus when a body pellet kills', (t) => {
  // First ray goes right into the head, other rays go centrally into the body of the SAME target.
  let randomCall=0; t.mock.method(Math,'random',()=>randomCall++===0 ? 0.9 : 0);
  const d=structuredClone(weapons.confettiCannon); d.spread.base=0;
  const zombie=target(2,d.damage*d.headshotMultiplier+d.damage*.5); zombie.hitboxes=[
    {part:'head',box:box(0.15,1.3,-2.2,0.3,2,-2)},
    {part:'body',box:box(-0.08,1.3,-2.2,0.08,2,-2)},
  ];
  const f=fixture(d,[zombie]); f.fire();
  assert.deepEqual(zombie.damages,[d.damage*d.headshotMultiplier,d.damage]); assert.equal(f.hits[0].headshot,false);
  assert.equal(pointsForHit(f.hits[0]),60); assert.equal(zombie.killedByHeadshot,false);
});

test('pellets: two zombies are paid separately and a later pellet still counts for accuracy', (t) => {
  let n=0; t.mock.method(Math,'random',()=>[1,0.25,0.9,0,0.9,0.5][n++%6]);
  const d=structuredClone(weapons.confettiCannon); d.spread.base=0; d.pellets.count=3;
  const a=target(2,1000,'body',0.15,0.3), b=target(2,1000,'body',-0.3,-0.15);
  const f=fixture(d,[a,b]); f.fire();
  assert.equal(f.gun.lastShot.pellets[0].target,null); assert.equal(f.runStats.shotsHit,1);
  assert.equal(f.hits.length,2); assert.equal(f.hits.reduce((n,h)=>n+pointsForHit(h),0),20);
  assert.equal(f.counts().splats,2); assert.equal(f.counts().markers,1);
});

test('pellet ADS cone tightens continuously; pellets and pierce can be combined', () => {
  const p=weapons.confettiCannon.pellets, close=(a,b)=>Math.abs(a-b)<1e-9;
  assert.ok(close(pelletSpreadDegrees(weapons.confettiCannon,0),p.spreadDegrees));
  assert.ok(close(pelletSpreadDegrees(weapons.confettiCannon,1),p.spreadDegrees*p.adsMultiplier));
  assert.ok(close(pelletSpreadDegrees(weapons.confettiCannon,0.5),p.spreadDegrees*(1+p.adsMultiplier)/2));
  assert.equal(pelletSpreadDegrees(weapons.nailGun,1),0);
  assert.doesNotThrow(()=>new Weapon(weapons.confettiCannon,createPlayerStats()));
  assert.equal(weapons.confettiCannon.pierce.maxTargets,2);
});

test('burst darts and cannon blasts meet their early, middle and later round damage targets', () => {
  const table=[
    [1,2,1,1,1,2], [8,8,5,1,1,9], [15,13,8,2,2,14],
  ];
  for(const [round,bodyDarts,headDarts,bodyBlasts,headBlasts,farBlasts] of table){
    const hp=zombieHealthForRound(round), foam=weapons.foamDartBlaster, confetti=weapons.confettiCannon;
    assert.equal(Math.ceil(hp/foam.damage),bodyDarts);
    assert.equal(Math.ceil(hp/(foam.damage*foam.headshotMultiplier)),headDarts);
    assert.equal(Math.ceil(hp/(confetti.damage*confetti.pellets.count)),bodyBlasts);
    assert.equal(Math.ceil(hp/(confetti.damage*confetti.pellets.count*confetti.headshotMultiplier)),headBlasts);
    assert.equal(Math.ceil(hp/(confetti.damage*confetti.pellets.count*pelletDamageFalloff(12,confetti.falloff))),farBlasts);
  }
});

test('every gun builds a model/display and refers to real sounds; wall guns have prices', () => {
  for(const d of Object.values(weapons)){
    const model=buildWeaponModel(d), display=buildWeaponDisplay(d);
    assert.ok(model.root.isObject3D && model.muzzle.isObject3D && display.isObject3D);
    for(const name of [d.sounds.fire,d.sounds.dryFire,...d.viewmodel.reload.events.filter(e=>e.sound).map(e=>e.sound)]) assert.ok(audio.sounds[name],name); // (an event may be a bump with no sound)
    if(d.id!=='stapleGun' && !d.debugOnly && !d.clawOnly) assert.ok(economy.wallBuys[d.id]);
    if(d.clawOnly) assert.equal(economy.wallBuys[d.id], undefined, d.id + ' is never sold on a wall');
    for(const progress of [0,0.2,0.45,0.6,0.8,1]) model.animate({sinceFire:Infinity,reloadProgress:progress,reloadWeight:1});
    model.animate({sinceFire:0.01,reloadProgress:0.4,reloadWeight:0});
    model.root.traverse(o=>assert.ok([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite)));
  }
});

test('tracer pool preserves all eight pellet tracers and clears safely',()=>{
  const scene=new THREE.Scene(),fx=createEffects(scene);
  for(let i=0;i<8;i++)fx.tracer(new THREE.Vector3(),new THREE.Vector3(i*0.1,0,-3),0xff62bb);
  assert.equal(scene.children.filter(o=>o.visible && !o.isInstancedMesh).length,8);
  fx.clear(); assert.equal(scene.children.filter(o=>o.visible && !o.isInstancedMesh).length,0);
});

test('real mall: new wall buys require their zones, buy/refill into the loadout, and reject the far side',async()=>{
  const ctx=new Proxy({}, {get:(t,k)=>(k in t?t[k]:(t[k]=()=>ctx)),set:(t,k,v)=>(t[k]=v,true)});
  globalThis.document??={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
  const {buildMall}=await import('../src/maps/mall/mall.js');
  for(const [id,doorId] of [['foamDartBlaster','megaMart'],['confettiCannon','serviceCorridor']]){
    const colliders=[],map=buildMall(new THREE.Scene(),colliders),wb=featuresOf(map,'wallBuy').find(w=>w.weapon===id);
    assert.ok(wb,id+' marker reserved');
    const f=fixture(weapons.stapleGun),wallet=createWallet();wallet.earn(10000);
    const player={position:wb.position.clone().addScaledVector(wb.normal,1.2),yaw:Math.atan2(wb.normal.x,wb.normal.z),eyeHeight:feel.player.eyeHeight};player.position.y=0;
    const input={pressed:new Set(),isDown:()=>false,actionDown:()=>true,consumeAction:()=>true};
    const interactions=createInteractions({input,player,wallet,colliders});
    const owned=()=>f.gun.owns(id);
    interactions.add({label:id,position:wb.position,verb:'buy',get cost(){return owned()?economy.wallBuys[id].ammo:economy.wallBuys[id].weapon;},
      available:()=>map.zones[wb.zone].open && !(owned() && f.gun.weaponFor(id).isFull),use:()=>f.gun.give(weapons[id])});
    const hold=()=>{interactions.reset();for(let i=0;i<30;i++)interactions.update(dt);};
    hold();assert.equal(owned(),false);
    for(const door of map.doors.filter(d=>d.id==='startShutter'||d.id===doorId))door.open();
    for(let i=0;i<100;i++)map.update(dt);
    const before=wallet.points;hold();assert.equal(owned(),true);assert.equal(wallet.points,before-economy.wallBuys[id].weapon);
    f.gun.weaponFor(id).magazine=0;f.gun.weaponFor(id).reserve=0;
    const ammoBefore=wallet.points;hold();assert.equal(f.gun.weaponFor(id).isFull,true);assert.equal(wallet.points,ammoBefore-economy.wallBuys[id].ammo);
    f.gun.weaponFor(id).magazine=0;
    player.position.copy(wb.position).addScaledVector(wb.normal,-0.6);player.position.y=0;player.yaw+=Math.PI;
    const behindBefore=wallet.points;hold();assert.equal(wallet.points,behindBefore,'wall blocks purchase');
    map.dispose();
  }
});


test('existing nail piercing retains per-target falloff, scoring and wall stopping', (t)=>{
  t.mock.method(Math,'random',()=>0);
  const targets=[target(2),target(3),target(4),target(5)];
  const f=fixture(weapons.nailGun,targets);f.fire();
  assert.deepEqual(targets.map(z=>z.health),
    weapons.nailGun.pierce.damageFalloff.map(scale=>1000-weapons.nailGun.damage*scale).concat(1000));
  assert.equal(f.hits.length,3);assert.equal(f.tracers.length,1);assert.equal(f.counts().splats,3);
  assert.equal(f.runStats.shotsFired,1);
  const blockedTargets=[target(2),target(4)];
  const blocked=fixture(weapons.nailGun,blockedTargets,[box(-3,0,-3.2,3,4,-3)]);blocked.fire();
  assert.deepEqual(blockedTargets.map(z=>z.health),[1000-weapons.nailGun.damage,1000]);assert.equal(blocked.counts().puffs,1);
});

test('existing semi and auto modes retain trigger, reload and ammo behavior',()=>{
  const semi=new Weapon(weapons.stapleGun,createPlayerStats());
  let semiShots=0;for(let i=0;i<60;i++)if(tick(semi,{triggerPressed:i===0,triggerHeld:true})==='fire')semiShots++;
  assert.equal(semiShots,1);assert.equal(semi.magazine,11);
  const auto=new Weapon(weapons.priceGun,createPlayerStats());let autoShots=0;
  for(let i=0;i<60;i++)if(tick(auto,{triggerPressed:i===0,triggerHeld:true})==='fire')autoShots++;
  assert.equal(autoShots,12);assert.equal(auto.magazine,weapons.priceGun.magazineSize-12);
  auto.magazine=1;auto.cooldown=0;tick(auto,{triggerHeld:true});tick(auto,{triggerHeld:true});
  assert.equal(auto.isReloading,true);
});

test('crosshair displays the same ADS pellet cone that shots use',()=>{
  const f=fixture(weapons.confettiCannon);
  const c=weapons.confettiCannon;
  assert.ok(Math.abs(f.gun.spreadDegreesForDisplay(0)-(c.spread.base+c.pellets.spreadDegrees))<1e-9);
  f.input.held.add('aim');for(let i=0;i<20;i++)f.gun.update(dt);
  assert.ok(Math.abs(f.gun.spreadDegreesForDisplay(1)-(c.spread.base*c.spread.adsMultiplier+c.pellets.spreadDegrees*c.pellets.adsMultiplier))<1e-9);
  const standard=fixture(weapons.stapleGun);
  assert.equal(standard.gun.spreadDegreesForDisplay(0),standard.gun.aim.spreadDegrees);
});

// --- Confetti Cannon: six-shell tube, shell-by-shell reload, pass-through ---

test('confetti cannon numbers are deliberate (six shells, 12 x 70 pellets, full damage to 4m, 10% at 12m)', () => {
  const d = weapons.confettiCannon;
  assert.equal(d.magazineSize, 6); assert.equal(d.startingReserve, 24); assert.equal(d.damage, 70); assert.equal(d.pellets.count, 12);
  assert.equal(d.falloff.start, 4); assert.equal(d.falloff.end, 12); assert.equal(d.falloff.minMultiplier, 0.1);
  assert.equal(d.damage * d.pellets.count, 840, 'a point-blank blast');
  const sr = d.shellReload;
  assert.deepEqual([sr.progress.start[1], sr.progress.shell[0], sr.progress.shell[1], sr.progress.end[0]], [0.3, 0.3, 0.7, 0.7], 'phase windows join up');
  assert.equal(sr.progress.start[0], 0); assert.equal(sr.progress.end[1], 1);
});

const shellGun = (magazine, reserve = 30, stats = createPlayerStats()) => {
  const w = new Weapon(weapons.confettiCannon, stats); w.magazine = magazine; w.reserve = reserve; return w;
};

test('shell reload: opens, loads ONE shell per cycle, closes; total time from empty', () => {
  const sr = weapons.confettiCannon.shellReload, w = shellGun(0);
  tick(w, { reloadPressed: true });
  assert.equal(w.isReloading, true); assert.equal(w.reloadPhase, 'start');
  let t = 0; const loadedAt = []; let last = 0; const phases = new Set();
  while (w.isReloading && t < 10) {
    tick(w); t += dt; if (w.isReloading) phases.add(w.reloadPhase);
    if (w.magazine !== last) { loadedAt.push(+t.toFixed(2)); last = w.magazine; }
  }
  assert.equal(w.magazine, 6); assert.equal(w.reserve, 24); assert.equal(w.reloadPhase, null);
  assert.deepEqual([...phases].sort(), ['end', 'shell', 'start']);
  assert.equal(loadedAt.length, 6, 'six separate shells');
  const total = sr.startSeconds + 6 * sr.shellSeconds + sr.endSeconds;
  assert.ok(Math.abs(t - total) < 3 * dt, `about ${total}s, took ${t.toFixed(2)}s`);
  for (let i = 1; i < loadedAt.length; i++) assert.ok(Math.abs(loadedAt[i] - loadedAt[i - 1] - sr.shellSeconds) < 2 * dt, 'one shell every cycle');
});

test('shell reload: a top-up only loads what is missing, and stops when the reserve runs out', () => {
  const a = shellGun(5); tick(a, { reloadPressed: true }); while (a.isReloading) tick(a);
  assert.equal(a.magazine, 6); assert.equal(a.reserve, 29);
  const b = shellGun(2, 1); tick(b, { reloadPressed: true }); while (b.isReloading) tick(b);
  assert.equal(b.magazine, 3); assert.equal(b.reserve, 0);
  const full = shellGun(6); tick(full, { reloadPressed: true }); assert.equal(full.isReloading, false, 'nothing to load');
});

test('shell reload: progress plays the start window, repeats the shell window per shell, then the end window', () => {
  const sr = weapons.confettiCannon.shellReload, w = shellGun(3);
  tick(w, { reloadPressed: true });
  const seen = { start: [], shell: [], end: [] }; let wraps = 0, prev = -1;
  while (w.isReloading) {
    const p = w.reloadProgress; seen[w.reloadPhase].push(p);
    if (w.reloadPhase === 'shell' && prev > p) wraps += 1;
    prev = p; tick(w);
  }
  for (const phase of ['start', 'shell', 'end']) {
    const [a, b] = sr.progress[phase];
    assert.ok(seen[phase].length > 0 && seen[phase].every((p) => p >= a - 1e-9 && p <= b + 1e-9), phase);
  }
  assert.equal(wraps, 2, 'three shells = the shell window plays three times (wraps twice)');
});

test('shell reload: firing interrupts it once a shell is in; shells already loaded stay', () => {
  const sr = weapons.confettiCannon.shellReload, w = shellGun(0);
  tick(w, { reloadPressed: true });
  // Mid-reload with an empty gun: the trigger does nothing (and does not cancel the reload).
  let ev = 'none'; for (let i = 0; i < 10; i++) ev = tick(w, { triggerPressed: i === 0 });
  assert.notEqual(ev, 'fire'); assert.equal(w.isReloading, true); assert.equal(w.magazine, 0);
  // Wait for the first two shells, then fire.
  while (w.magazine < 2) tick(w);
  assert.equal(w.isReloading, true);
  let fired = null; for (let i = 0; i < 3 && fired !== 'fire'; i++) fired = tick(w, { triggerPressed: i === 0 });
  assert.equal(fired, 'fire'); assert.equal(w.magazine, 1, 'two loaded, one fired');
  assert.equal(w.isReloading, false); assert.equal(w.reloadPhase, null);
  assert.equal(w.reserve, 28, 'only the two loaded shells came out of the reserve');
  // Interrupt during the closing phase too.
  const e = shellGun(5); tick(e, { reloadPressed: true });
  while (e.reloadPhase !== 'end') tick(e);
  assert.equal(tick(e, { triggerPressed: true }), 'fire'); assert.equal(e.magazine, 5);
});

test('other guns still cannot fire mid-reload', () => {
  const w = new Weapon(weapons.stapleGun, createPlayerStats()); w.magazine = 3;
  tick(w, { reloadPressed: true }); assert.equal(w.isReloading, true);
  for (let i = 0; i < 10; i++) assert.notEqual(tick(w, { triggerPressed: i === 0 }), 'fire');
  assert.equal(w.magazine, 3);
});

test('shell reload: cancel (switching) keeps loaded shells; refill resets the phase; reload speed scales every phase', () => {
  const w = shellGun(0); tick(w, { reloadPressed: true }); while (w.magazine < 2) tick(w);
  w.cancelReload(); assert.equal(w.isReloading, false); assert.equal(w.reloadPhase, null); assert.equal(w.magazine, 2);
  const r = shellGun(1); tick(r, { reloadPressed: true }); r.refill();
  assert.equal(r.isReloading, false); assert.equal(r.reloadPhase, null); assert.equal(r.magazine, 6);
  const stats = createPlayerStats(); stats.reloadSpeed = 2; const fast = shellGun(0, 30, stats);
  tick(fast, { reloadPressed: true }); let t = 0; while (fast.isReloading) { tick(fast); t += dt; }
  const sr = weapons.confettiCannon.shellReload;
  assert.ok(Math.abs(t - (sr.startSeconds + 6 * sr.shellSeconds + sr.endSeconds) / 2) < 3 * dt);
});

test('shell reload integration: one load sound per shell, and a blast can interrupt through the real gun', () => {
  const f = fixture(weapons.confettiCannon);
  const w = f.gun.weapon; w.magazine = 0;
  f.input.pressed.add('reload'); f.gun.update(dt);
  for (let i = 0; i < 400 && w.isReloading; i++) f.gun.update(dt);
  assert.equal(w.magazine, 6);
  assert.equal(f.sounds.filter((s) => s === 'confettiReloadIn').length, 6, 'a shell sound per shell');
  assert.equal(f.sounds.filter((s) => s === 'confettiReloadOut').length, 1);
  assert.equal(f.sounds.filter((s) => s === 'confettiReloadReady').length, 1);
  // Mid-reload interrupt through the real gun.
  w.magazine = 1; f.input.pressed.add('reload'); f.gun.update(dt);
  for (let i = 0; i < 90; i++) f.gun.update(dt); // past the first new shell
  const before = w.magazine; assert.ok(before >= 2 && w.isReloading);
  f.input.pressed.add('fire'); f.gun.update(dt);
  assert.equal(w.magazine, before - 1); assert.equal(w.isReloading, false);
});

// --- Upgrades on a carried gun (gunStats.js resolveGun via playerGun.setMods: the Build-A-Blaster hook) ---

test('upgrades: a mod changes what the gun in hand actually does; the config entry stays untouched', (t) => {
  t.mock.method(Math, 'random', () => 0);
  const before = structuredClone(weapons.stapleGun);
  const zombie = target(5);
  const f = fixture(weapons.stapleGun, [zombie]);
  f.fire(); for (let i = 0; i < 30; i++) f.gun.update(dt);
  assert.equal(zombie.damages[0], weapons.stapleGun.damage);
  assert.equal(f.gun.setMods('stapleGun', [{ id: 'hot', modifiers: [{ stat: 'damage', op: 'mul', value: 2 }] }]), true);
  f.fire();
  assert.equal(zombie.damages[1], weapons.stapleGun.damage * 2, 'the upgraded gun hits twice as hard');
  assert.deepEqual(f.gun.modsFor('stapleGun').map((m) => m.id), ['hot']);
  assert.equal(f.gun.def.base, weapons.stapleGun); assert.deepEqual(weapons.stapleGun, before);
  assert.equal(f.gun.setMods('nailGun', []), false, 'not carried');
});

test('upgrades: magazine / spread mods reach the ammo and aim state; ammo carries over, clipped', () => {
  const f = fixture(weapons.priceGun);
  const w = f.gun.weapon; w.magazine = 20; w.reserve = 100;
  f.gun.setMods('priceGun', [{ id: 'bigMag', modifiers: [{ stat: 'magazineSize', op: 'add', value: 16 }, { stat: 'spread.base', op: 'mul', value: 0 }] }]);
  assert.equal(w.magazine, 20, 'kept'); assert.equal(w.def.magazineSize, weapons.priceGun.magazineSize + 16);
  assert.equal(f.gun.aim.spreadDegrees, 0, 'the aim reads the upgraded spread');
  w.startReload(); for (let i = 0; i < 200 && w.isReloading; i++) w.update(dt, {});
  assert.equal(w.magazine, weapons.priceGun.magazineSize + 16, 'reloads to the bigger magazine');
  f.gun.setMods('priceGun', [{ id: 'smallMag', modifiers: [{ stat: 'magazineSize', op: 'set', value: 10 }] }]);
  assert.equal(w.magazine, 10, 'clipped to the new maximum');
});

test('an upgrade that makes the magazine bigger fills a FULL magazine to the new size, free; a part-empty one is left as it was', () => {
  const f = fixture(weapons.rivetRifle);
  const w = f.gun.weapon, before = weapons.rivetRifle.magazineSize;
  assert.equal(w.magazine, before, 'the scenario: a full magazine');
  const reserve = w.reserve;
  f.gun.setMods('rivetRifle', withTier(weapons.rivetRifle, [], 'deluxe'));
  assert.ok(w.def.magazineSize > before, `the scenario: Deluxe makes it bigger (${before} -> ${w.def.magazineSize})`);
  assert.equal(w.magazine, w.def.magazineSize, 'full before, full after: no reload needed to use the bigger magazine');
  assert.equal(w.reserve, reserve, 'the extra rounds are free: the reserve is untouched');
  const g = fixture(weapons.rivetRifle), v = g.gun.weapon;
  v.magazine = 20;
  const spare = v.reserve;
  g.gun.setMods('rivetRifle', withTier(weapons.rivetRifle, [], 'deluxe'));
  assert.deepEqual([v.magazine, v.reserve], [20, spare], 'not full: kept as it was (reload to fill the bigger magazine)');
  // Rounds a smaller magazine sent back to the reserve are taken back first, so a free refit to a smaller and back to a
  // bigger magazine never makes ammo.
  const h = fixture(weapons.rivetRifle), u = h.gun.weapon;
  h.gun.setMods('rivetRifle', [{ id: 'small', modifiers: [{ stat: 'magazineSize', op: 'add', value: -10 }] }]);
  const held = u.magazine + u.reserve;
  h.gun.setMods('rivetRifle', []);
  assert.deepEqual([u.magazine, u.magazine + u.reserve], [before, held], 'back to its own size: the 10 came back out of the reserve');
});

test('upgrades stay through an ammo buy, and go with the gun (replaced) or the run (reset)', () => {
  const f = fixture(weapons.stapleGun);
  const hot = [{ id: 'hot', modifiers: [{ stat: 'damage', op: 'add', value: 10 }] }];
  f.gun.setMods('stapleGun', hot);
  f.gun.weapon.magazine = 1; f.gun.give(weapons.stapleGun); // ammo buy
  assert.equal(f.gun.def.damage, weapons.stapleGun.damage + 10); assert.equal(f.gun.weapon.magazine, weapons.stapleGun.magazineSize);
  f.gun.give(weapons.priceGun); for (let i = 0; i < 60; i++) f.gun.update(dt);
  f.gun.give(weapons.nailGun); for (let i = 0; i < 60; i++) f.gun.update(dt); // both slots full: replaces the Price Gun in hand
  assert.deepEqual(f.gun.modsFor('stapleGun').map((m) => m.id), ['hot']);
  f.gun.setMods('nailGun', hot); f.input.pressed.add('weapon1'); for (let i = 0; i < 60; i++) f.gun.update(dt);
  f.gun.give(weapons.foamDartBlaster); // replaces the (upgraded) Staple Gun in hand
  assert.equal(f.gun.modsFor('stapleGun'), null);
  f.gun.reset();
  assert.deepEqual(f.gun.modsFor('stapleGun'), [], 'new run: no upgrades');
  assert.equal(f.gun.def.damage, weapons.stapleGun.damage);
});
