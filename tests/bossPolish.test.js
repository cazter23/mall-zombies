import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame,dt } from './helpers/headlessGame.js';
import { bossTypes,bossVouchers,bossSpectacle } from '../src/config/bosses.js';
import { audio } from '../src/config/audio.js';
import { seededRandom } from '../src/world/textures.js';
import { weapons } from '../src/config/weapons.js';

function fixture(t) {
  const game=headlessGame();const {g}=game;
  g.health.invulnerable=true;g.rounds.jumpTo(6);g.rounds.update=()=>{};
  t.after(()=>{g.resetRun();g.map.dispose();});
  return game;
}

test('Manager and Guard travel from every open zone, and from below into the workshop, without rescue',t=>{
  const {g,tick}=fixture(t);
  t.mock.method(Math,'random',seededRandom(733));
  g.map.areaUnlocks.openAll();tick(120);
  const zones=[...new Set(g.map.spawnPoints.map(p=>p.zone))];
  const destination=new THREE.Vector3(0,0,12);
  for(const id of ['manager','guard']) {
    for(const zone of [...zones,'workshop']) {
      const target=zone==='workshop'?g.map.levelTwo.workshop.position:destination;
      const source=zone==='workshop'?new THREE.Vector3(target.x,0,target.z):g.map.spawnPoints.find(p=>p.zone===zone).position;
      g.player.teleport({position:target,yaw:0});tick();
      const boss=g.bosses.summon(id);assert.ok(boss);
      boss.position.copy(source);boss.prevPosition.copy(source);boss.setState('chasing');
      let arrived=false;
      for(let i=0;i<60*85 && !arrived;i++) {
        const previous=boss.position.clone();tick();
        assert.ok(previous.distanceTo(boss.position)<0.8,`${id}/${zone}: no rescue teleport`);
        arrived=boss.position.distanceTo(target)<1.6 && Math.abs(boss.position.y-target.y)<0.15;
      }
      assert.ok(arrived,`${id}/${zone}: ${boss.position.toArray()}`);
      g.bosses.reset();g.zombies.clear();
    }
  }
});

test('distinct boss stings, costume props and non-gore deaths preserve one kill payout',t=>{
  const {g,tick,hud}=fixture(t);g.map.areaUnlocks.openAll();tick(120);
  const names=new Set();
  for(const [id,type] of Object.entries(bossTypes)) {
    assert.ok(audio.sounds[type.introSound]?.layers.length);names.add(type.introSound);
    const z=g.bosses.summon(id);assert.ok(z);
    const before=g.effects.counts.particles;
    let kills=0;const off=g.events.on('kill',({zombie})=>{if(zombie===z)kills++;});
    z.takeHit({damage:z.health,part:'body',source:'hazard'});off();
    assert.equal(kills,1);assert.ok(g.effects.counts.particles>=Math.min(before+bossSpectacle.death.count,100));
    assert.ok(hud.calls.some(([name,line])=>name==='showAnnouncement' && line.text===type.defeatBanner.text));
    g.bosses.reset();g.zombies.clear();tick();
  }
  assert.equal(names.size,Object.values(bossTypes).filter(({firstRounds})=>firstRounds?.length).length, 'debut bosses have distinct stings; the booked finale reuses one');
});

test('order-form purchases consume Discount Code, quiet menu opening does not, and fans cannot feed the ritual',t=>{
  const {g,tick,press}=fixture(t);
  g.map.areaUnlocks.openAll();g.gun.give(weapons.nailGun);g.wallet.earn(10000);tick(120);
  const bench=g.map.features.find(f=>f.kind==='workshop');
  const ritual=g.features.list.find(f=>f.feature===bench).instance.ritual;
  ritual.choose('smoothie','headshot');
  g.player.teleport({position:new THREE.Vector3(bench.position.x,g.map.levelTwo.workshop.position.y,bench.position.z-1),yaw:Math.PI});
  g.pricing.setVoucher(bossVouchers.discountCode);tick();
  press('KeyF',20);assert.ok(ritual.form);assert.equal(g.pricing.voucher,bossVouchers.discountCode);
  const cost=g.pricing.priceOf('workshop','ritual'),points=g.wallet.points;
  press('KeyF');assert.equal(ritual.phase,'running');assert.equal(g.wallet.points,points-cost);assert.equal(g.pricing.voucher,null);
  const boss=g.bosses.summon('influencer');assert.ok(boss);
  const fan=g.zombies.spawn('mallWalker',g.player.position,{fanOwner:boss,healthMultiplier:0.5});fan.setState('chasing');
  const kills=ritual.status.kills;
  fan.takeHit({damage:fan.health,part:'head',source:'gun'});
  assert.equal(ritual.status.kills,kills);
});

test('vouchers survive the real Employee Discount expiring, and death/reset clear them without a conversion payout',t=>{
  const {g,tick}=fixture(t);tick();
  g.pricing.setVoucher(bossVouchers.signedApproval);
  assert.ok(g.powerUps.debugDrop('employeeDiscount'));g.powerUps.update(dt);
  const effect=g.powerUps.effects.find(e=>e.id==='employeeDiscount');assert.ok(effect);
  g.powerUps.update(effect.remaining+dt);assert.equal(g.pricing.voucher,bossVouchers.signedApproval);
  const points=g.wallet.points;g.health.invulnerable=false;g.health.takeDamage(g.stats.maxHealth);
  assert.equal(g.pricing.voucher,null);assert.equal(g.wallet.points,points);
  g.resetRun();assert.equal(g.pricing.voucher,null);
});

test('each boss is selectable in the debug overlay and summonable by explicit id',t=>{
  const {g,tick}=fixture(t);g.map.areaUnlocks.openAll();tick(120);
  for(const id of Object.keys(bossTypes)) {
    assert.match(g.debug.run('summonBoss',id),/Summoned/);
    assert.equal(g.bosses.active.type.id,id);
    g.bosses.reset();g.zombies.clear();
  }
  assert.equal(g.debug.resolve('KeyJ',true).id,'cycleBoss');
});
