import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { bossTypes, bossVouchers, bossComfort } from '../src/config/bosses.js';
import { maxAliveForRound, zombieHealthFor } from '../src/config/economy.js';
import { chooseFilmingSpot } from '../src/zombies/bosses/filmingSpots.js';
import { castShot } from '../src/weapons/hitscan.js';
import { flashPresentation } from '../src/ui/bossFlash.js';

const cfg=bossTypes.influencer;
function fixture(t) {
  const game=headlessGame(); const {g}=game;
  g.health.invulnerable=true; g.rounds.jumpTo(15);
  const updateRounds=g.rounds.update.bind(g.rounds); g.rounds.update=()=>{};
  g.map.areaUnlocks.openAll(); game.tick(120);
  const boss=g.bosses.summon('influencer'); assert.ok(boss);
  boss.position.set(0,0,9); boss.prevPosition.copy(boss.position); boss.setState('chasing');
  t.after(()=>{g.resetRun();g.map.dispose();});
  return {...game,boss,updateRounds};
}
const fansOf=g=>g.zombies.zombies.filter(z=>z.fanOwner && z.isAlive);
const hit=(g,boss,headshot=false)=>g.events.emit('hit',{target:boss,killed:false,headshot,melee:false});

test('followers cross each threshold once per viral cycle; hits lower the meter; fans respect max alive and half health',t=>{
  const {g,boss,tick}=fixture(t);
  const quota=g.rounds.remainingToSpawn;
  for(const threshold of cfg.followers.thresholds){
    boss.followers=threshold-cfg.followers.perSecond*dt; tick();
  }
  assert.equal(fansOf(g).length,cfg.followers.thresholds.length*cfg.fans.perThreshold);
  for(const fan of fansOf(g)){
    assert.equal(fan.maxHealth,zombieHealthFor(cfg.fans.type,15)*cfg.fans.healthFraction);
    assert.equal(fan.noRewards,true);
  }
  boss.followers=cfg.followers.viral-cfg.followers.perSecond*dt; tick();
  assert.equal(boss.followers,cfg.followers.resetTo);
  assert.ok(g.zombies.aliveCount<=maxAliveForRound(15));
  assert.equal(g.rounds.remainingToSpawn,quota,'fans are the extra budget, not regular wave spawns');
  hit(g,boss); assert.equal(boss.followers,cfg.followers.resetTo-cfg.followers.hit);
  hit(g,boss,true); assert.equal(boss.followers,cfg.followers.resetTo-cfg.followers.hit-cfg.followers.headshot);
  const count=fansOf(g).length;
  boss.followers=50-cfg.followers.perSecond*dt;tick();
  assert.equal(fansOf(g).length,count,'a downward hit does not re-arm earlier thresholds');
});

test('fans pay no hit, headshot, melee or hazard points and give no kill/incentive credit',t=>{
  const {g,boss}=fixture(t);
  const points=g.wallet.points,kills=g.runStats.kills,credit=g.powerUps.progress;
  for(const source of ['gun','melee','build','incentive','hazard']){
    const fan=g.zombies.spawn(cfg.fans.type,new THREE.Vector3(2,0,12),{fanOwner:boss,healthMultiplier:cfg.fans.healthFraction});
    fan.setState('chasing');
    g.events.emit('hit',{target:fan,killed:false,headshot:true,melee:false});
    fan.takeHit({damage:fan.health,part:'head',source,melee:source==='melee'});
    assert.equal(g.wallet.points,points,source);
    assert.equal(g.runStats.kills,kills,source);
    assert.equal(g.powerUps.progress,credit,source);
  }
  assert.equal(g.powerUps.pickup,null);
});

test('fan queue never exceeds the living cap and departures do not emit kills or hold a completed wave',t=>{
  const {g,boss,tick,updateRounds}=fixture(t);
  while(g.zombies.aliveCount<maxAliveForRound(15))g.zombies.spawn('shopper',new THREE.Vector3(3,0,12));
  boss.followers=100; tick(); assert.equal(fansOf(g).length,0);
  const regular=g.zombies.zombies.find(z=>!z.type.boss);
  regular.takeHit({damage:regular.health,part:'body',source:'hazard'}); tick();
  assert.equal(fansOf(g).length,1); assert.equal(g.zombies.aliveCount,maxAliveForRound(15));
  let fanKills=0;g.events.on('kill',({zombie})=>{if(zombie.fanOwner)fanKills++;});
  boss.takeHit({damage:boss.health,part:'body'});
  tick(Math.ceil(cfg.fans.leaveSeconds/dt)+1);
  assert.equal(fansOf(g).length,0); assert.equal(fanKills,0);
  while(g.rounds.remainingToSpawn>0){g.zombies.clear();assert.ok(g.rounds.spawnBackup('shopper'));}
  g.zombies.clear();g.rounds.update=updateRounds;tick();assert.equal(g.rounds.round,16);
});

test('filming spots in every open zone and the workshop are real reachable, shootable grid cells',t=>{
  const {g,boss,tick}=fixture(t); const nav=g.zombies.nav;
  const locations=[...new Set(g.map.spawnPoints.map(p=>p.zone))].map(zone=>g.map.spawnPoints.find(p=>p.zone===zone).position);
  locations.push(g.map.levelTwo.workshop.position);
  for(const at of locations){
    g.player.teleport({position:at,yaw:0});tick();
    const next=chooseFilmingSpot({nav,player:g.player,zombie:boss,colliders:g.colliders,config:cfg.filming});
    assert.ok(next,`spot near ${at.toArray()}`);
    const p=next.position;
    assert.ok(nav.isWalkableAt(p.x,p.z,p.y)); assert.ok(Number.isFinite(nav.distanceToTarget(p.x,p.z,p.y)));
    assert.ok(next.path.length);
    const eye=g.player.position.clone().setY(g.player.position.y+g.player.eyeHeight);
    const direction=p.clone().setY(p.y+cfg.filming.sightHeight).sub(eye),distance=direction.length();
    assert.equal(castShot(eye,direction.normalize(),distance,g.colliders,[]).worldHit,null);
  }
});

test('Skylar uses her own routes through doorways and between floors while the shared horde field stays intact',t=>{
  const {g,boss,tick}=fixture(t);
  const target=g.map.levelTwo.workshop.position;
  g.player.teleport({position:target,yaw:0});tick();
  const before=g.zombies.nav.distanceToTarget(0,12,0);
  assert.ok(Number.isFinite(before));
  let arrived=false;
  for(let i=0;i<60*90 && !arrived;i++){
    const previous=boss.position.clone();tick();
    assert.ok(previous.distanceTo(boss.position)<0.8,'no rescue teleport');
    arrived=Math.abs(boss.position.y-target.y)<0.3 && boss.position.distanceTo(target)<cfg.filming.maxRange;
  }
  assert.ok(arrived,`ended at ${boss.position.toArray()}`);
});

test('phone flash is telegraphed, emits only when facing the phone, and Comfort swaps white for dim',async t=>{
  const {g,boss,tick}=fixture(t);
  boss.speed=0;boss.position.set(0,0,10);g.player.yaw=0;
  const flashes=[];g.events.on('bossFlash',e=>flashes.push(e));
  tick(Math.ceil(cfg.flash.windupSeconds/dt));assert.equal(flashes.length,0);
  tick(2);assert.equal(flashes.length,1);
  const previous=bossComfort.dimPhoneFlash;
  t.after(()=>{bossComfort.dimPhoneFlash=previous;});
  const {settingDefs,settingPresets}=await import('../src/config/settings.js');
  const setting=settingDefs.find(s=>s.id==='dimPhoneFlash');
  setting.apply(true);assert.deepEqual(flashPresentation(flashes[0]),{color:'#000',opacity:cfg.flash.dimOpacity});
  setting.apply(false);assert.deepEqual(flashPresentation(flashes[0]),{color:'#fff',opacity:cfg.flash.opacity});
  assert.equal(settingPresets.Comfort.find(p=>p.label==='Calm').values.dimPhoneFlash,true);
  g.player.yaw=Math.PI;tick(Math.ceil((cfg.flash.cooldownSeconds+cfg.flash.windupSeconds)/dt)+3);
  assert.equal(flashes.length,1,'looking away avoids the flash');
});

test('Discount Code stacks after sale and coupon, caps savings and survives Employee Discount ending',t=>{
  const {g}=fixture(t);
  g.pricing.setVoucher(bossVouchers.discountCode);
  g.pricing.setDiscount('tier',0.5);g.pricing.setCoupon({fraction:0.5,maxSaving:1000});
  assert.equal(g.pricing.priceOf('tier','platinum'),1000,'sale to 3000, coupon (capped at 1000 off) to 2000, then voucher to 1000');
  g.pricing.clearCoupon();g.pricing.setDiscount('tier',0);
  assert.equal(g.pricing.voucher,bossVouchers.discountCode);
  assert.equal(g.pricing.priceOf('tier','platinum'),g.pricing.basePriceOf('tier','platinum')-2000);
  assert.ok(bossVouchers.discountCode.excludedCategories.includes('clawMachine'));
});
