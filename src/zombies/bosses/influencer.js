import { feel } from '../../config/feel.js';
import * as THREE from 'three';
import { moveAndCollide } from '../../world/collision.js';
import { maxAliveForRound } from '../../config/economy.js';
import { chooseFilmingSpot } from './filmingSpots.js';

export function createInfluencerBehavior({ zombie, zombies, rounds, player, colliders, events, onPhase }) {
  const { filming: cfg, followers, fans, flash } = zombie.type;
  const nav = zombies.nav;
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  let moveIn = 0, spot = null, path = [], waypoint = 0, pending = 0, flashIn = 0, windup = null;
  let triggered = new Set();
  zombie.followers = 0;
  function request(count, phase) { pending = Math.min(fans.maxPending,pending+count); onPhase(phase); }
  zombie.control = (dt, ctx) => {
    // Advance close waypoints, then look ahead only across clear cells on the same floor.
    while (waypoint < path.length && Math.hypot(path[waypoint].x-zombie.position.x,path[waypoint].z-zombie.position.z) <= cfg.arriveMeters
      && Math.abs(path[waypoint].y-zombie.position.y) <= cfg.floorTolerance) waypoint++;
    let target = path[waypoint];
    if (target && !nav.rampAt(zombie.position.x,zombie.position.y,zombie.position.z)) {
      for (let i=waypoint+1;i<Math.min(path.length,waypoint+cfg.lookAhead);i++) {
        if (Math.abs(path[i].y-zombie.position.y)>cfg.floorTolerance || !nav.clearLine(zombie.position.x,zombie.position.z,path[i].x,path[i].z,zombie.position.y)) break;
        target=path[i]; waypoint=i;
      }
    }
    zombie.controlled = !target && !!spot;
    if (!target) zombie.standStill(dt,ctx);
    else {
      const dx=target.x-zombie.position.x,dz=target.z-zombie.position.z,d=Math.hypot(dx,dz);
      const speed=Math.min(zombie.speed*zombie.slowFraction,d/dt);
      zombie.velocity.x=d>0?dx/d*speed:0; zombie.velocity.z=d>0?dz/d*speed:0;
      zombie.velocity.y=Math.max(zombie.velocity.y-feel.movement.gravity*dt,-feel.movement.maxFallSpeed);
      moveAndCollide(zombie.position,zombie.velocity,dt,zombie.type.radius,zombie.type.height,colliders,feel.movement.stepTolerance);
    }
    zombie.faceToward(player.position,dt);
    return true; // filming replaces the ordinary chase/attack loop entirely
  };
  return {
    get spot() { return spot; },
    onHit({ headshot }) { zombie.followers=Math.max(0,zombie.followers-(headshot?followers.headshot:followers.hit)); },
    update(dt) {
      if (zombie.state==='spawning') return;
      zombie.followers+=followers.perSecond*dt;
      for (const threshold of followers.thresholds) if (zombie.followers>=threshold && !triggered.has(threshold)) {
        triggered.add(threshold); request(fans.perThreshold,'followers');
      }
      if (zombie.followers>=followers.viral) {
        zombie.followers=followers.resetTo;
        triggered=new Set(followers.thresholds.filter(t=>t<=followers.resetTo));
        request(fans.viralCount,'viral');
      }
      while (pending>0 && zombies.aliveCount<maxAliveForRound(rounds.round)) {
        if (!zombies.spawn(fans.type,null,{ fanOwner:zombie, healthMultiplier:fans.healthFraction })) break;
        pending--;
      }
      moveIn-=dt;
      const reachable=spot && nav.isWalkableAt(spot.x,spot.z,spot.y) && nav.distanceToTarget(spot.x,spot.z,spot.y)<Infinity;
      if ((!spot || !reachable || moveIn<=0) && !nav.rampAt(zombie.position.x,zombie.position.y,zombie.position.z)) {
        const next=chooseFilmingSpot({nav,player,zombie,colliders,config:cfg});
        spot=next?.position??null; path=next?.path??[]; waypoint=0;
        zombie.filmingSpot=spot;
        moveIn=cfg.relocateSeconds;
      }
      flashIn=Math.max(0,flashIn-dt);
      if (windup!==null) {
        windup-=dt;
        if (windup<=1e-9) {
          windup=null; flashIn=flash.cooldownSeconds;
          player.getAim(eye,aim);
          const dx=zombie.position.x-eye.x,dz=zombie.position.z-eye.z;
          if (zombie.distanceTo(player)<=flash.range && !zombie.wallBetween(player,colliders)
            && dx*aim.x+dz*aim.z>0) events.emit('bossFlash',{zombie,...flash});
        }
      } else if (flashIn===0 && zombie.distanceTo(player)<=flash.range && !zombie.wallBetween(player,colliders)) {
        windup=flash.windupSeconds; onPhase('flashWindup');
      }
    },
    dispose(reason) {
      pending=0; zombie.control=null; zombie.controlled=false; zombie.filmingSpot=null;
      zombies.dismissFans(zombie,reason==='defeated'?fans.leaveSeconds:0);
    },
  };
}
