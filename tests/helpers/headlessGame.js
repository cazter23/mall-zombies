// A REAL game (game/createGame.js) running in Node: real input, map, player, guns, zombies, rounds,
// points and buyables. Only the browser parts are stand-ins: the HUD and sound record what they were
// asked to do, the viewmodel (the gun drawn in your hands) does nothing, and <canvas> is a no-op.
//
//   const t = headlessGame()
//   t.g            the game (createGame's return value)
//   t.tick(n)      n fixed ticks
//   t.press(code, ticks)  hold a key/button for `ticks` ticks (a fresh press, like a real one)
//   t.standAt(x, z, yawDeg, pitch)  put the player somewhere, looking somewhere
//   t.hud.calls    [name, ...args] for every HUD call; t.sounds = sound names played
import * as THREE from 'three';
import { feel } from '../../src/config/feel.js';

// Browser globals the game touches: <canvas> (map textures) and event listeners (core/input.js).
const noop = () => {};
const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= {};
globalThis.document.createElement ??= () => ({ width: 0, height: 0, getContext: () => ctx });
globalThis.document.addEventListener ??= noop;
globalThis.window ??= { addEventListener: noop };

const { createGame } = await import('../../src/game/createGame.js');
const { PRICE_CATEGORIES } = await import('../../src/game/pricing.js');
const { Input } = await import('../../src/core/input.js');

export const dt = 1 / feel.simulation.tickRate;

// Records every call; every method exists and returns undefined.
function recorder() {
  const calls = [];
  const proxy = new Proxy({}, { get: (t, name) => (name === 'calls' ? calls : (...args) => { calls.push([name, ...args]); }) });
  return proxy;
}

export function headlessGame(options = {}) {
  const hud = recorder();
  const sounds = [];
  const sound = { play: (name) => sounds.push(name), unlock: noop };
  const viewmodel = {
    fire: noop, dryFire: noop, jolt: noop, reset: noop,
    getMuzzleWorldPosition: (out) => out.set(0, 1.5, 0),
  };
  const input = new Input({});
  const g = createGame({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    input,
    hud,
    sound,
    viewmodel,
    ...options,
  });
  g.state.forceRun = true; // play without pointer lock
  const tick = (n = 1) => { for (let i = 0; i < n; i++) g.update(dt); };
  return {
    g,
    hud,
    sounds,
    input,
    tick,
    press(code, ticks = 1) {
      input.pressed.add(code);
      input.held.add(code);
      tick(ticks);
      input.held.delete(code);
    },
    standAt(x, z, yawDeg = 0, pitch = 0) {
      g.player.teleport({ position: new THREE.Vector3(x, 0, z), yaw: (yawDeg * Math.PI) / 180 });
      g.player.pitch = pitch;
      tick(1);
    },
  };
}

/** What a run "is": everything Play again must put back. Two equal snapshots = the same game state. */
export function snapshot(g) {
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    over: g.state.over,
    death: { ...g.death },
    points: g.wallet.points,
    totalEarned: g.wallet.totalEarned,
    totalSpent: g.wallet.totalSpent,
    powerUps: {
      progress: round(g.powerUps.progress), drops: g.powerUps.dropsThisRound,
      pickup: g.powerUps.pickup?.id ?? null, active: g.powerUps.active?.id ?? null,
    },
    round: g.rounds.round,
    started: g.rounds.started,
    zones: Object.fromEntries(Object.entries(g.map.zones).map(([id, z]) => [id, z.open])),
    doors: g.map.doors.map((d) => [d.id, d.isOpen]),
    guns: g.gun.slots,
    inHand: g.gun.def.id,
    mods: g.gun.slots.map((id) => g.gun.modsFor(id).map((m) => m.id)),
    ammo: [g.gun.weapon.magazine, g.gun.weapon.reserve],
    health: round(g.health.fraction),
    // Every field of the stats object (a stray one left by a perk would show up here too).
    stats: Object.fromEntries(Object.entries(g.stats).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v])),
    runStats: {
      kills: g.runStats.kills, headshotKills: g.runStats.headshotKills, meleeKills: g.runStats.meleeKills,
      shots: g.runStats.shotsFired, hits: g.runStats.shotsHit, time: round(g.runStats.timeAlive),
    },
    zombies: g.shootables.length,
    zombiesInWorld: g.zombies.zombies.length,
    features: g.features.list.map(({ feature }) => feature.name),
    interactPrompt: g.interactions.prompt,
    reloading: g.gun.weapon.isReloading,
    discounts: PRICE_CATEGORIES.map((c) => g.pricing.discountOf(c)),
    position: g.player.position.toArray().map(round),
    yaw: round(g.player.yaw),
  };
}
