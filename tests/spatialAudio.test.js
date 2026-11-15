// 3D zombie sound (config/spatialAudio.js, audio/spatial.js, audio/sound.js positional voices, game/soundStage.js): a zombie's
// sound reaches its panner where the zombie is (left is left, behind is behind, upstairs is up) and follows it; walls and floors
// muffle it by the room-culling areas and portals; the voice cap holds in a crowd (a cue still gets through), the rest is the
// crowd bed; steps change with the floor; a sound rings in the room it is in; the 3D sound settings save. (How it SOUNDS is for
// the ear: tools/audition.html, the 3D zombie sound card.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { spatialAudio } from '../src/config/spatialAudio.js';
import { zombieTypes, zombieSoundCues } from '../src/config/zombies.js';
import { audio } from '../src/config/audio.js';
import { toListener, distanceGain, segmentHitsBox } from '../src/audio/spatial.js';
import { crowdBedPcm } from '../src/audio/crowdBed.js';
import { createSound } from '../src/audio/sound.js';
import { createSoundStage } from '../src/game/soundStage.js';

const DEG = Math.PI / 180;

// A fake Web Audio context that records nodes (panners with position params, convolvers with buffers).
function fakeAudio() {
  const nodes = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
    cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
  let ctx;
  const make = (kind) => {
    const n = { kind, out: [], gain: param(), frequency: param(), pan: param(), Q: param(), threshold: param(), ratio: param(),
      attack: param(), release: param(), knee: param(), detune: param(), positionX: param(), positionY: param(), positionZ: param(),
      connect(to) { this.out.push(to); return to; }, disconnect() { this.disconnected = true; }, start(...a) { this.started = a; },
      stop(at) { this.stopped = at; } };
    nodes.push(n);
    return n;
  };
  class AudioContext {
    constructor() { ctx = this; this.state = 'running'; this.currentTime = 5; this.sampleRate = 8000; this.destination = { kind: 'destination' }; }
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { duration: length / rate, numberOfChannels: channels, getChannelData: (i) => data[i] };
    }
    createDynamicsCompressor() { return make('compressor'); }
    createGain() { return make('gain'); }
    createBiquadFilter() { return make('filter'); }
    createStereoPanner() { return make('stereo'); }
    createPanner() { return make('panner'); }
    createBufferSource() { return make('source'); }
    createOscillator() { return make('oscillator'); }
    createWaveShaper() { return make('shaper'); }
    createConvolver() { return make('convolver'); }
  }
  return { AudioContext, nodes, context: () => ctx };
}

/** Runs fn(sound, fake) with a fresh engine on a fake context; config/spatialAudio.js is put back after. */
function withEngine(fn) {
  const f = fakeAudio(), previous = window.AudioContext, saved = { mode: spatialAudio.mode, quality: spatialAudio.quality };
  window.AudioContext = f.AudioContext;
  try {
    const sound = createSound({ renderMusic: () => new Promise(() => {}) }); // (no radio here)
    sound.unlock();
    return fn(sound, f);
  } finally {
    window.AudioContext = previous;
    Object.assign(spatialAudio, saved);
  }
}

/** A positional play at a fixed listener-space spot (what game/soundStage.js hands the engine). */
const at = (x, y, z, { gain = 1, priority = 1, room = null } = {}) => ({
  priority, place: (out) => Object.assign(out, { x, y, z, gain, cutoffHz: 20000, sendScale: 1, room }),
});

test('listener space: yaw 0 faces -Z; a zombie on the left is -x, behind is +z, upstairs is +y; turning turns the world', () => {
  const me = { x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0 };
  const left = toListener(me, { x: -5, y: 1.6, z: 0 });
  assert.ok(left.x < -4.9 && Math.abs(left.z) < 1e-9, 'left');
  const behind = toListener(me, { x: 0, y: 1.6, z: 5 });
  assert.ok(behind.z > 4.9 && Math.abs(behind.x) < 1e-9, 'behind');
  assert.ok(toListener(me, { x: 0, y: 1.6, z: -5 }).z < -4.9, 'ahead');
  const up = toListener(me, { x: 0, y: 7.9, z: -3 });
  assert.ok(Math.abs(up.y - 6.3 * spatialAudio.elevationScale) < 1e-9, 'upstairs is up (steepened by elevationScale)');
  // Turned 90 degrees left (yaw +90: facing -X), the zombie that was on the left is now ahead, and the one behind is on the left.
  const turned = { ...me, yaw: 90 * DEG };
  assert.ok(toListener(turned, { x: -5, y: 1.6, z: 0 }).z < -4.9, 'now ahead');
  assert.ok(toListener(turned, { x: 0, y: 1.6, z: 5 }).x < -4.9, 'now on the left');
  // Distance: full up close, falling off, silent past the edge; a cue never fades below its floor inside its range.
  const { step, voice, cue } = spatialAudio.profiles;
  assert.equal(distanceGain(1, step), 1);
  assert.ok(distanceGain(8, step) < distanceGain(4, step) && distanceGain(step.max, step) === 0);
  assert.ok(voice.max > step.max && distanceGain(12, voice) > distanceGain(12, step), 'a groan carries further than a footstep');
  assert.ok(distanceGain(cue.max * 0.95, cue) >= cue.minGain);
  assert.ok(segmentHitsBox({ x: 0, y: 1, z: 2 }, { x: 0, y: 1, z: -8 }, { minX: -1, maxX: 1, minY: 0, maxY: 3, minZ: -2.3, maxZ: -2 }));
  assert.ok(!segmentHitsBox({ x: 0, y: 1, z: 2 }, { x: 9, y: 1, z: -8 }, { minX: -1, maxX: 1, minY: 0, maxY: 3, minZ: -2.3, maxZ: -2 }));
});

test('a zombie sound reaches its panner where the zombie is, follows it while it plays, and HRTF / stereo follow the setting', () => {
  withEngine((sound, f) => {
    const t = headlessGame({ sound });
    const { g } = t;
    t.standAt(0, 2, 0); // the Hallway, facing north (-Z)
    const zombie = { position: new THREE.Vector3(-6, 0, 2), type: zombieTypes.shopper };
    assert.ok(g.soundStage.play('shopperGroan', { emitter: zombie, def: zombieTypes.shopper.sounds.groan }), 'it plays');
    let [v] = sound.positionalVoices;
    assert.ok(v.at.x < -5.9 && Math.abs(v.at.z) < 1e-6, `a zombie on the left pans left: ${JSON.stringify(v.at)}`);
    assert.equal(v.model, 'HRTF', 'headphones by default: HRTF');
    // It walks round behind you: the voice follows it.
    zombie.position.set(0, 0, 8);
    sound.updateSpatial();
    [v] = sound.positionalVoices;
    assert.ok(v.at.z > 5.9 && Math.abs(v.at.x) < 1e-6, `behind is behind: ${JSON.stringify(v.at)}`);
    // You turn round to face it: now it is ahead.
    g.player.yaw = 180 * DEG;
    sound.updateSpatial();
    assert.ok(sound.positionalVoices[0].at.z < -5.9, 'turning turns it');
    // The panner itself got those numbers.
    const panner = f.nodes.find((n) => n.kind === 'panner');
    assert.ok(panner.positionZ.value < -5.9 && panner.rolloffFactor === 0, 'the distance is ours, not the panner\'s');
    // Speakers: plain stereo, live panners switch too.
    spatialAudio.mode = 'speakers';
    sound.setSpatial();
    assert.equal(sound.positionalVoices[0].model, 'equalpower');
    assert.equal(sound.spatialStats.hrtf, false);
    // The player's own sounds are never positional.
    sound.play('stapleShot');
    sound.play('hitBody');
    assert.equal(sound.spatialStats.voices, 1);
  });
});

test('walls and floors: same area clear, through an open doorway clear, the next area muffled a little, further and through shutters more, the other floor muffled', () => {
  const t = headlessGame(), { g } = t;
  const stage = g.soundStage;
  const level = (x, y, z) => stage.levelAt({ x, y, z });
  // In the start room, its shutter closed: the hallway is only through the shutter.
  t.standAt(0, 12, 0);
  assert.equal(level(2, 1.4, 14), 'clear', 'the same room');
  assert.equal(level(10, 1.4, 2), 'closed', 'behind the closed start shutter');
  g.debug.run('doors');
  t.tick();
  assert.equal(level(0, 1.4, 2), 'clear', 'straight out through the open shutter');
  assert.equal(level(15, 1.4, 1), 'neighbour', 'round the corner in the hallway');
  assert.equal(level(18, 1.4, -12), 'far', 'two rooms away (the Food Court)');
  // In the Hallway: the Food Court through its doorway, and off to the side of it.
  t.standAt(0, 2, 0);
  assert.equal(level(0, 1.4, -10), 'clear', 'in a line through the doorway');
  assert.equal(level(18, 1.4, -12), 'neighbour', 'off to the side of the doorway');
  assert.equal(level(18, 7.4, -3.5), 'far', 'up on the Promenade, through the floor');
  // The Atrium is open to both floors: a zombie up on the ring is clear, and above you.
  t.standAt(20, 18, 0);
  assert.equal(level(20, 7.7, 28), 'clear');
  const placed = stage.place({ x: 20, y: 7.7, z: 28 }, spatialAudio.profiles.voice);
  assert.ok(placed.y > 5 && placed.z > 0, 'above, and behind (you face north, it is south)');
  // The levels get quieter and darker in order.
  const { clear, neighbour, far, closed } = spatialAudio.occlusion;
  assert.ok(clear.gain > neighbour.gain && neighbour.gain > far.gain && far.gain > closed.gain);
  assert.ok(clear.cutoffHz > neighbour.cutoffHz && neighbour.cutoffHz > far.cutoffHz && far.cutoffHz > closed.cutoffHz);
  // And they reach the sound: the same groan at the same distance, clear vs behind the closed shutter.
  const fresh = headlessGame();
  fresh.standAt(0, 12, 0);
  const inRoom = fresh.g.soundStage.place({ x: 0, y: 1.4, z: 7 }, spatialAudio.profiles.voice);
  const shut = fresh.g.soundStage.place({ x: 0, y: 1.4, z: 3 }, spatialAudio.profiles.voice); // (closer, but behind the shutter)
  assert.equal(shut.level, 'closed');
  assert.ok(shut.gain < inRoom.gain && shut.cutoffHz < inRoom.cutoffHz, 'muffled and quieter, not silent');
  assert.ok(shut.gain > 0);
});

test('the voice cap holds in a crowd: the quietest footsteps are dropped, a cue still gets through; Fewer halves it', () => {
  withEngine((sound) => {
    const cap = spatialAudio.voices.full;
    for (let i = 0; i < 60; i++) sound.play('shopperShuffle', { spatial: at(Math.sin(i) * 9, 0, Math.cos(i) * 9, { gain: 0.1 + (i % 7) * 0.05, priority: 1 }) });
    assert.equal(sound.spatialStats.voices, cap, 'never more than the cap');
    assert.ok(sound.spatialStats.dropped > 0);
    // A charge telegraph from behind, while every voice is taken: it steals the weakest.
    const cart = sound.play('cartRattle', { spatial: at(0, 0, 8, { gain: 0.3, priority: spatialAudio.profiles.cue.priority }) });
    assert.ok(cart, 'the cue is never the one dropped');
    assert.equal(sound.spatialStats.voices, cap);
    assert.ok(sound.positionalVoices.some((v) => v.key === 'cartRattle'));
    // A step quieter than everything playing gets no voice.
    assert.equal(sound.play('shopperShuffle', { spatial: at(1, 0, 1, { gain: 0.01 }) }), null);
    // Potato (Graphics > Zombie sound voices: Fewer): half the voices, plain stereo whatever the Audio tab says.
    spatialAudio.quality = 'fewer';
    sound.setSpatial();
    assert.ok(sound.spatialStats.voices <= spatialAudio.voices.fewer && spatialAudio.voices.fewer < cap);
    assert.equal(sound.spatialStats.hrtf, false);
    assert.ok(sound.positionalVoices.some((v) => v.key === 'cartRattle'), 'the cue outlives the cut');
    // The limiter stays last: the master chain still ends compressor -> limiter -> clip -> speakers.
    assert.ok(sound.voiceCount <= audio.voices.total);
  });
});

test('a sound rings in the room it is IN: a groan in the Cinema feeds the Cinema reverb while you stand in the Hallway', () => {
  withEngine((sound, f) => {
    sound.setRoom(null, { now: true }); // you: the hallway
    sound.play('shopperGroan', { spatial: at(-20, 6, -5, { gain: 0.5, room: 'cinema' }) });
    assert.deepEqual(sound.spatialStats.rooms, ['cinema']);
    assert.ok(f.nodes.some((n) => n.kind === 'convolver' && n.buffer), 'its own convolver');
    // A sound in your own room uses your room's reverb (no extra convolver fed).
    sound.play('shopperGroan', { spatial: at(2, 0, -3, { gain: 0.8, room: 'hall' }) });
    assert.deepEqual(sound.spatialStats.rooms, ['cinema']);
    // Potato: no extra rooms (the room you're in does it all).
    spatialAudio.quality = 'fewer';
    sound.setSpatial();
    sound.play('shopperGroan', { spatial: at(30, 0, 0, { gain: 0.5, room: 'warehouse' }) });
    assert.ok(!sound.spatialStats.rooms.includes('warehouse'));
  });
});

test('the crowd bed: silent for a few zombies, louder with the horde, from where the horde is, and quieter behind a shutter', () => {
  const t = headlessGame(), { g } = t;
  t.standAt(0, 12, 0); // the start room, shutter closed
  const beds = [];
  const fake = { play: () => null, setCrowd: (c) => beds.push({ ...c }) };
  const horde = [];
  const stage = createSoundStage({ map: g.map, player: g.player, sound: fake, zombies: () => horde });
  const crowd = (list) => { horde.length = 0; horde.push(...list); stage.update(1); return beds.at(-1); };
  const zombie = (x, z) => ({ position: new THREE.Vector3(x, 0, z), type: zombieTypes.shopper, isAlive: true, removed: false });
  assert.equal(crowd([]).gain, 0);
  assert.equal(crowd([zombie(-3, 12), zombie(-3, 13), zombie(-2, 11)]).gain, 0, 'below minZombies: just their own voices');
  const left = Array.from({ length: 20 }, (_, i) => zombie(-4 + (i % 2) * 0.5, 9 + (i % 7)));
  const bed = crowd(left);
  assert.ok(bed.gain > 0 && bed.gain <= spatialAudio.crowd.maxGain, `a horde murmurs: ${bed.gain}`);
  assert.ok(bed.x < 0, 'from the left, where they are');
  const many = crowd([...left, ...left]);
  assert.ok(many.gain >= bed.gain, 'more of them, louder (up to its ceiling)');
  // The same horde out in the hallway, behind the closed shutter: muffled and quieter.
  const outside = crowd(Array.from({ length: 20 }, (_, i) => zombie(-4 + (i % 2) * 0.5, 2 + (i % 4))));
  assert.ok(outside.gain < bed.gain && outside.cutoffHz < bed.cutoffHz);
  // Dead or removed zombies, or a run that's over, are silent.
  assert.equal(crowd(left.map((z) => ({ ...z, isAlive: false }))).gain, 0);
  horde.push(...left); stage.update(1, false);
  assert.equal(beds.at(-1).gain, 0);
  // The loop itself: finite, never clipping, and the same at both ends of the seam (it repeats without a click).
  const pcm = crowdBedPcm(8000, { seconds: 2, voices: 4 });
  assert.ok(pcm.every(Number.isFinite) && Math.max(...pcm.map(Math.abs)) <= 0.9 + 1e-6);
  assert.ok(Math.abs(pcm[0] - pcm[pcm.length - 1]) < 0.15, 'no seam');
});

test('zombies sound from themselves: a swing winding up within reach plays the lunge cue, steps change with the floor', () => {
  const t = headlessGame(), { g } = t;
  const played = [];
  const original = g.soundStage.play;
  g.soundStage.play = (name, opts) => { played.push({ name, emitter: opts?.emitter, def: opts?.def }); return original(name, opts); };
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.debug.run('doors');
  t.tick(5);
  g.player.teleport({ position: new THREE.Vector3(0, 0, 3), yaw: 0 });
  const shopper = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 0.8));
  for (let i = 0; i < 400 && !played.some((p) => p.name === zombieSoundCues.windup.name); i++) t.tick();
  const lunge = played.find((p) => p.name === zombieSoundCues.windup.name);
  assert.ok(lunge, 'the wind-up cue played');
  assert.equal(lunge.emitter, shopper, 'from the zombie that swung');
  assert.equal(lunge.def.profile, 'cue');
  assert.ok(t.sounds.includes('zombieLunge'));
  // The floor underfoot: a shuffle on HOFFMAN'S carpet is the carpet recipe, on the car park's asphalt the asphalt one.
  const step = zombieTypes.shopper.sounds.shuffle;
  t.standAt(-12, 14, 0);
  t.sounds.length = 0;
  g.soundStage.play(step.name, { emitter: { position: new THREE.Vector3(-12, 0, 11), type: zombieTypes.shopper }, def: step });
  assert.deepEqual(t.sounds, ['shopperShuffle@carpet']);
  t.standAt(45, -5, 0);
  g.soundStage.play(step.name, { emitter: { position: new THREE.Vector3(45, 0, -8), type: zombieTypes.shopper }, def: step });
  assert.equal(t.sounds.at(-1), 'shopperShuffle@asphalt');
  // Past its range nothing starts at all.
  g.soundStage.play(step.name, { emitter: { position: new THREE.Vector3(45, 0, -8 - step.maxDistance - 1), type: zombieTypes.shopper }, def: step });
  assert.equal(t.sounds.length, 2);
  // Every zombie sound config names exists, and has a profile the stage knows.
  for (const type of Object.values(zombieTypes)) for (const [slot, def] of Object.entries(type.sounds ?? {})) {
    assert.ok(audio.sounds[def.name], `${type.id}.sounds.${slot}: ${def.name}`);
    assert.ok(spatialAudio.profiles[def.profile], `${type.id}.sounds.${slot} has a profile`);
  }
  for (const def of Object.values(zombieSoundCues)) assert.ok(audio.sounds[def.name] && spatialAudio.profiles[def.profile]);
});

test('the 3D sound settings save and apply: Headphones / Speakers on the Audio tab, Zombie sound voices on Graphics (Potato: Fewer)', async () => {
  const { createSettings } = await import('../src/game/settings.js');
  const { settingPresets, settingDefs } = await import('../src/config/settings.js');
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const saved = { mode: spatialAudio.mode, quality: spatialAudio.quality };
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined }); // (any property, any call)
  let applied = 0;
  const ctx = { renderer: noop, hud: noop, postProcessing: noop, lightPool: noop, haptics: noop, sound: new Proxy({ setSpatial: () => { applied++; } }, { get: (t, k) => t[k] ?? (() => {}) }) };
  try {
    assert.equal(settingDefs.find((d) => d.id === 'spatialMode').tab, 'Audio');
    assert.equal(settingDefs.find((d) => d.id === 'soundVoices').tab, 'Graphics');
    const settings = createSettings(ctx);
    applied = 0;
    settings.set('spatialMode', 'speakers');
    assert.equal(spatialAudio.mode, 'speakers');
    assert.equal(applied, 1, 'the engine re-reads it');
    assert.equal(JSON.parse(store.get('mallZombies.settings')).spatialMode, 'speakers', 'saved');
    spatialAudio.mode = 'headphones';
    createSettings(ctx);
    assert.equal(spatialAudio.mode, 'speakers', 'loaded back on the next launch');
    const potato = settingPresets.Graphics.find((p) => p.label === 'Potato');
    assert.equal(potato.values.soundVoices, 'fewer');
    for (const p of settingPresets.Graphics) if (p.label !== 'Potato') assert.equal(p.values.soundVoices, 'full', p.label);
  } finally {
    globalThis.localStorage = previous;
    Object.assign(spatialAudio, saved);
  }
});
