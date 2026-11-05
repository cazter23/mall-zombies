// =============================================================================
// RITUAL MODE: what the Build-A-Blaster room does while a ritual runs (built by game/features/workshop.js). Everything here is show:
// it listens to the 'ritual*' events and moves the room's dynamic parts, and it changes nothing the game plays by.
//   The tank fills with the stuffing's colour as the gauge climbs; a kill in the room flies into it.
//   The hall's two lamps cycle party colours (no new lights, so the light pool is unaffected), the bulb string chases round the walls,
//   the conveyor runs, the arm carries the gun to the booth, the chute's flap swings, the jingle plays over the fighting.
// DOM-free. reset() puts every part back.
//   Room parts come from the map feature's stations (maps/mall/workshopRoom.js): tank, belt, arm, leverHandle, flap, bulbs, lamps.
// =============================================================================

import * as THREE from 'three';
import { workshopRitual as cfg } from '../../config/workshop.js';

const color = new THREE.Color();

export function createWorkshopSpectacle({ bench, ritual, events, zombies, player, sound }) {
  const { stations } = bench;
  const { tank, belt, arm, flap, leverHandle, bulbs, lamps = [] } = stations;
  const show = cfg.spectacle;
  const topKills = cfg.qualities.at(-1).minKills;
  const idleBulb = new THREE.Color();
  bulbs.getColorAt(0, idleBulb);
  const homeLampColors = lamps.map((lamp) => lamp.color.clone());
  const { up: leverUp, down: leverDown } = stations.leverAngles;

  let party = false;
  let kills = 0, shownFill = 0;
  let partyTimer = 0, partyIndex = 0;
  let bulbTimer = 0, bulbStep = 0;
  let jingleTimer = 0;
  let flapAngle = 0;
  let leverTarget = leverUp;

  function setFill(fraction) {
    tank.fill.scale.y = Math.max(.02, fraction * tank.height);
    tank.fluff.count = Math.round(fraction * tank.fluffCount);
  }

  function paintBulbs() {
    for (let i = 0; i < bulbs.count; i++) {
      if (party) color.setHex(show.partyColors[(i + bulbStep) % show.partyColors.length]);
      bulbs.setColorAt(i, party ? color : idleBulb);
    }
    bulbs.instanceColor.needsUpdate = true;
  }

  function setParty(on) {
    if (on === party) return;
    party = on;
    partyTimer = bulbTimer = jingleTimer = 0;
    if (!on) lamps.forEach((lamp, i) => lamp.color.copy(homeLampColors[i]));
    paintBulbs();
  }

  function clearTank() {
    kills = 0;
    shownFill = 0;
    setFill(0);
  }

  function placeArm() {
    const gunAt = ritual.gunPosition;
    const x = gunAt ? Math.max(arm.minX, Math.min(arm.maxX, gunAt.x)) : arm.minX;
    arm.group.position.x = x;
    // The cable reaches the gun once it has come off the belt; otherwise the claw waits at the top of the post.
    const reach = gunAt && gunAt.x >= arm.minX - .01 && gunAt.y > tankClearY() ? arm.railY - gunAt.y : .4;
    arm.cable.scale.y = Math.max(.1, reach - .1);
    arm.cable.position.y = -arm.cable.scale.y / 2 - .1;
    arm.claw.position.y = -reach;
  }
  // (Above the belt: the gun has been lifted.)
  const tankClearY = () => stations.path[3].y + .05;

  events.on('ritualStart', () => {
    clearTank();
    tank.fill.material.color.setHex(ritual.stuffingColor);
    setParty(true);
  });
  events.on('ritualKill', ({ zombie, kills: count }) => {
    kills = count;
    zombies.playTankDeath(zombie, tank.mouth);
    sound?.play('tankGulp');
  });
  events.on('ritualReady', ({ reason }) => {
    setParty(false);
    if (reason === 'lever') {
      leverTarget = leverDown;
      sound?.play('leverClunk');
    }
  });
  events.on('ritualCollect', () => {
    clearTank();
    leverTarget = leverUp;
  });
  events.on('chuteDrop', () => {
    flapAngle = show.flapOpenAngle * 1.4; // knocked open as it falls through
    sound?.play('chuteThunk');
  });

  return {
    get party() { return party; },

    update(dt) {
      shownFill += (Math.min(1, kills / topKills) - shownFill) * Math.min(1, dt / show.fillSeconds);
      if (ritual.phase !== 'idle') {
        setFill(shownFill);
        tank.fluff.rotation.y += show.fluffTurnSpeed * dt;
      }
      const flapTarget = ritual.steering ? show.flapOpenAngle : 0;
      flapAngle += (flapTarget - flapAngle) * Math.min(1, dt / show.flapSeconds);
      flap.rotation.x = flapAngle;
      leverHandle.rotation.z += (leverTarget - leverHandle.rotation.z) * Math.min(1, dt / show.leverSeconds);
      placeArm();
      if (!party) return;

      belt.offset.x -= show.beltSpeed * dt;
      partyTimer -= dt;
      if (partyTimer <= 0) {
        partyTimer = show.partySeconds;
        partyIndex = (partyIndex + 1) % show.partyColors.length;
        lamps.forEach((lamp, i) => lamp.color.setHex(show.partyColors[(partyIndex + i) % show.partyColors.length]));
      }
      bulbTimer -= dt;
      if (bulbTimer <= 0) {
        bulbTimer = show.bulbSeconds;
        bulbStep = (bulbStep + 1) % show.partyColors.length;
        paintBulbs();
      }
      jingleTimer -= dt;
      if (jingleTimer <= 0) {
        jingleTimer = show.jingleSeconds;
        const volume = Math.max(0, 1 - player.position.distanceTo(tank.mouth) / show.jingleRange);
        if (volume > 0) sound?.play('ritualJingle', { volume });
      }
    },

    reset() {
      setParty(false);
      clearTank();
      flapAngle = 0;
      flap.rotation.x = 0;
      leverTarget = leverUp;
      leverHandle.rotation.z = leverUp;
      belt.offset.x = 0;
      tank.fluff.rotation.y = 0;
      placeArm();
    },
  };
}
