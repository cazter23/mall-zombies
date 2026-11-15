// Gun sounds and the sound engine: every sound a weapon (or the box cutter, the Kiosk, Build-A-Blaster) names exists and
// parses, automatic guns cap their voices, every area has a room, upgrades change the shot, and the engine steals voices
// and ends in its limiter. (Loudness and how the guns differ are measured in the browser: tools/audition.html, Measure.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs <canvas>)
import { audio } from '../src/config/audio.js';
import { gunSounds, soundUpgrades } from '../src/config/gunSounds.js';
import { weapons, melee } from '../src/config/weapons.js';
import { kiosk } from '../src/config/kiosk.js';
import { upgrades } from '../src/config/upgrades.js';
import { workshopStuffings } from '../src/config/workshop.js';
import { normalizeRecipe, validateRecipe, resolveVariant, variantKey, driveCurve, softClipCurve } from '../src/audio/recipes.js';
import { roomImpulse } from '../src/audio/roomImpulse.js';
import { soundVariantOf } from '../src/weapons/upgrades.js';
import { createSound } from '../src/audio/sound.js';

const guns = Object.values(weapons);

/** Every sound name config uses for a weapon, the melee, the Kiosk products and Build-A-Blaster. */
function namedSounds() {
  const names = [];
  for (const w of guns) {
    for (const [slot, name] of Object.entries(w.sounds ?? {})) names.push([`${w.id}.sounds.${slot}`, name]);
    if (w.charge?.sound) names.push([`${w.id}.charge.sound`, w.charge.sound]);
    if (w.projectile?.bounceSound) names.push([`${w.id}.projectile.bounceSound`, w.projectile.bounceSound]);
    for (const e of w.viewmodel?.reload?.events ?? []) if (e.sound) names.push([`${w.id} reload event ${e.at}`, e.sound]);
  }
  for (const [slot, name] of Object.entries(melee.boxCutter.sounds)) names.push([`boxCutter.sounds.${slot}`, name]);
  const walk = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (value.sounds && typeof value.sounds === 'object') for (const [k, v] of Object.entries(value.sounds)) if (typeof v === 'string') names.push([`${path}.sounds.${k}`, v]);
    for (const [k, v] of Object.entries(value)) if (k !== 'sounds') walk(v, `${path}.${k}`);
  };
  walk(kiosk, 'kiosk');
  for (const [id, s] of Object.entries(workshopStuffings)) if (s.sound) names.push([`stuffing ${id}`, s.sound]);
  return names;
}

test('every sound a weapon, the box cutter, the Kiosk or Build-A-Blaster names exists', () => {
  const names = namedSounds();
  assert.ok(names.length > 80);
  for (const [where, name] of names) assert.ok(audio.sounds[name], `${where}: "${name}" is not in config/audio.js`);
});

test('every recipe parses with the format (config/audio.js header), the new gun recipes too', () => {
  const problems = Object.entries(audio.sounds).flatMap(([name, def]) => validateRecipe(def, name));
  assert.deepEqual(problems, []);
  for (const name of Object.keys(gunSounds)) assert.equal(audio.sounds[name], gunSounds[name], `${name} comes from gunSounds.js`);
  // (and the validator does catch mistakes)
  assert.ok(validateRecipe({ volume: 1, parts: { body: [{ type: 'tone', wave: 'sine', freq: 100, gain: 1, decay: 0 }] } }).length > 0);
  assert.ok(validateRecipe({ volume: 1, layers: [{ type: 'metal', freq: 100, gain: 1, decay: 0.1 }] }).length > 0);
  assert.ok(validateRecipe({ volume: 1, layers: [{ type: 'buzz', freq: 100, gain: 1, decay: 0.1 }] }).length > 0);
  assert.ok(validateRecipe({ volume: 1, layers: [{ type: 'tone', wave: 'sine', freq: 200, freqEnd: 60, freqTime: 0, gain: 1, decay: 0.1 }] }).length > 0);
  assert.ok(validateRecipe({ volume: 1, duck: { db: 40, seconds: 0.2 }, layers: [{ type: 'tone', wave: 'sine', freq: 100, gain: 1, decay: 0.1 }] }).length > 0);
});

test('each gun has its own fire and dry-fire sounds, built from parts upgrades can work on', () => {
  const fires = new Map();
  for (const w of guns) {
    assert.ok(!fires.has(w.sounds.fire), `${w.id} shares ${w.sounds.fire} with ${fires.get(w.sounds.fire)}`);
    fires.set(w.sounds.fire, w.id);
    assert.notEqual(w.sounds.dryFire, 'dryClick', `${w.id} has its own dry fire`);
    const recipe = normalizeRecipe(audio.sounds[w.sounds.fire]);
    assert.ok(recipe.parts.some((p) => p.name === 'body'), `${w.id}'s shot has a body (the tiers scale it)`);
    assert.ok(recipe.parts.some((p) => p.name === 'mech' || p.name === 'crack'), `${w.id}'s shot has a crack or a mechanism`);
  }
});

test('automatic and burst guns cap their fire sound at 4 voices or fewer; hit sounds are capped and dry', () => {
  for (const w of guns) {
    if (w.fireMode !== 'auto' && !w.burst) continue;
    const cap = audio.sounds[w.sounds.fire].maxVoices;
    assert.ok(Number.isInteger(cap) && cap <= 4, `${w.id}: ${w.sounds.fire} maxVoices ${cap}`);
  }
  for (const name of ['hitBody', 'hitHead', 'killConfirm']) {
    assert.ok(audio.sounds[name].maxVoices <= 4, `${name} capped`);
    assert.ok(!audio.sounds[name].send, `${name} is dry (no room), so it cuts through`);
  }
});

test('every area of the mall has a room, and every room impulse is finite, unit energy and dies away', async () => {
  const { buildMall } = await import('../src/maps/mall/mall.js');
  const map = buildMall(new THREE.Scene(), []);
  const ids = new Set([...map.gradeZones.map((z) => z.grade), 'front']);
  for (const id of ids) assert.ok(audio.rooms[audio.roomOf[id]], `grade zone ${id} maps to a room`);
  assert.ok(audio.rooms[audio.reverb.defaultRoom]);
  for (const [id, room] of Object.entries(audio.rooms)) {
    const ir = roomImpulse(room, 16000);
    for (const ch of [ir.left, ir.right]) {
      let energy = 0, head = 0, tail = 0;
      const n = ch.length, pre = Math.round((room.preDelay ?? 0) * 16000), tenth = Math.floor((n - pre) / 10);
      for (let i = 0; i < n; i++) {
        assert.ok(Number.isFinite(ch[i]), `${id} is finite`);
        energy += ch[i] ** 2;
        if (i >= pre && i < pre + tenth) head += ch[i] ** 2; else if (i >= n - tenth) tail += ch[i] ** 2;
      }
      assert.ok(Math.abs(energy - 1) < 1e-3, `${id} has unit energy`);
      assert.ok(10 * Math.log10(tail / head) < -30, `${id}'s tail has died away`);
    }
    assert.ok(room.wet > 0 && room.wet < 0.5, `${id} wet level`);
  }
  assert.ok(audio.rooms.parking.wet < audio.rooms.atrium.wet && audio.rooms.corridor.seconds < audio.rooms.atrium.seconds, 'the lot is dry, the corridor tight');
});

test('every tier and stuffing has a sound, and upgrades make a shot heavier; low ammo lightens the mechanism', () => {
  for (const t of upgrades.tiers) if (t.id !== 'standard') assert.ok(soundUpgrades.tiers[t.id], `tier ${t.id}`);
  for (const id of Object.keys(workshopStuffings)) assert.ok(soundUpgrades.stuffings[id], `stuffing ${id}`);
  const base = normalizeRecipe(audio.sounds.nailShot);
  const bodyGain = (r) => r.parts.find((p) => p.name === 'body').layers.reduce((sum, l) => sum + l.gain, 0);
  const layerCount = (r) => r.parts.reduce((n, p) => n + p.layers.length, 0);
  const deluxe = resolveVariant(base, { tier: 'deluxe' }, soundUpgrades);
  const platinum = resolveVariant(base, { tier: 'platinum' }, soundUpgrades);
  const renewed = resolveVariant(base, { tier: 'platinum', renewals: 5 }, soundUpgrades);
  assert.ok(bodyGain(base) < bodyGain(deluxe) && bodyGain(deluxe) < bodyGain(platinum) && bodyGain(platinum) < bodyGain(renewed));
  assert.ok(layerCount(platinum) > layerCount(base) && platinum.drive > base.drive && platinum.volume > base.volume);
  assert.ok(resolveVariant(base, { tier: 'platinum' }, soundUpgrades).parts.find((p) => p.name === 'body').layers[0].freq < base.parts.find((p) => p.name === 'body').layers[0].freq, 'deeper');
  for (const id of Object.keys(workshopStuffings)) {
    const built = resolveVariant(base, { stuffing: id }, soundUpgrades);
    assert.ok(built.parts.some((p) => p.name === 'flavour'), `${id} adds its flavour`);
  }
  const mechGain = (r) => r.parts.find((p) => p.name === 'mech').layers.reduce((sum, l) => sum + l.gain, 0);
  const low = resolveVariant(base, { lowAmmo: true }, soundUpgrades);
  assert.ok(mechGain(low) < mechGain(base) && low.parts.some((p) => p.name === 'tick'));
  assert.equal(base.parts.length, normalizeRecipe(audio.sounds.nailShot).parts.length, 'the config recipe is never edited');
  assert.equal(variantKey({ tier: 'standard', renewals: 0, stuffing: null, lowAmmo: false }), '');
  // The variant a gun's mods give (weapons/upgrades.js).
  assert.deepEqual(soundVariantOf([{ id: 'tier', tier: 'premium' }, { id: 'renewal', count: 2 }, { id: 'build', build: { stuffing: 'glitter' } }]),
    { tier: 'premium', renewals: 2, stuffing: 'glitter' });
  assert.deepEqual(soundVariantOf(), { tier: 'standard', renewals: 0, stuffing: null });
});

test('drive and the final soft clip stay bounded', () => {
  const clip = softClipCurve(audio.softClip);
  assert.ok(Math.max(...clip.map(Math.abs)) <= audio.softClip.ceiling + 1e-6 && audio.softClip.ceiling < 1, 'the last stage never reaches 0 dBFS');
  assert.ok(Math.abs(clip[Math.round((clip.length - 1) * 0.75)] - 0.5) < 0.01, 'unity below the knee');
  const curve = driveCurve(0.5);
  assert.ok(curve.every(Number.isFinite) && Math.max(...curve.map(Math.abs)) < 1.2);
});

// A fake Web Audio context that records nodes and connections.
function fakeAudio() {
  const nodes = [], sources = [];
  const param = () => ({ value: 0, targets: [], setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
    cancelScheduledValues() {}, setTargetAtTime(v, at) { this.value = v; this.targets.push([v, at]); } });
  let ctx;
  const make = (kind) => {
    const n = { kind, out: [], gain: param(), frequency: param(), pan: param(), Q: param(), threshold: param(), ratio: param(),
      attack: param(), release: param(), knee: param(), detune: param(),
      connect(to) { this.out.push(to); return to; }, disconnect() { this.disconnected = true; }, start(...a) { this.started = a; }, stop(at) { this.stopped = at; } };
    nodes.push(n);
    if (kind === 'source' || kind === 'oscillator') sources.push(n);
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
    createStereoPanner() { return make('pan'); }
    createBufferSource() { return make('source'); }
    createOscillator() { return make('oscillator'); }
    createWaveShaper() { return make('shaper'); }
    createConvolver() { return make('convolver'); }
  }
  return { AudioContext, nodes, sources, context: () => ctx };
}

test('the engine: voices are capped and the oldest stolen, a stop() cuts a sound, rooms crossfade, and the chain ends in limiter + clip', () => {
  const f = fakeAudio(), previous = window.AudioContext;
  window.AudioContext = f.AudioContext;
  try {
    const sound = createSound();
    sound.unlock();
    // The master chain: compressor -> limiter -> soft clip -> speakers.
    const clip = f.nodes.find((n) => n.kind === 'shaper' && n.out.includes(f.context().destination));
    assert.ok(clip, 'a soft clip feeds the speakers');
    const limiter = f.nodes.find((n) => n.kind === 'compressor' && n.out.includes(clip));
    assert.ok(limiter && limiter.threshold.value === audio.limiter.thresholdDb && limiter.ratio.value === audio.limiter.ratio);
    assert.ok(f.nodes.some((n) => n.kind === 'compressor' && n.out.includes(limiter)), 'the compressor feeds the limiter');

    // Rapid fire: BOGO at its cap.
    const cap = audio.sounds.bogoShot.maxVoices;
    for (let i = 0; i < 20; i++) sound.play('bogoShot');
    assert.equal(sound.voiceCount, cap);
    const stolen = f.sources.filter((s) => s.stopped !== undefined && s.stopped < f.context().currentTime + 0.1);
    assert.ok(stolen.length > 0, 'stolen voices stop within a few ms');
    // The total cap holds across sounds.
    for (const name of ['nailShot', 'rivetShot', 'coilShot', 'priceShot', 'foamShot', 'stapleShot', 'hitBody', 'hitHead', 'killConfirm', 'tennisBounce', 'balloonPop', 'returnStamp'])
      for (let i = 0; i < 8; i++) sound.play(name);
    assert.ok(sound.voiceCount <= audio.voices.total);

    // A charge whine can be stopped.
    const whine = sound.play('scannerCharge');
    assert.ok(whine && typeof whine.stop === 'function');
    const before = sound.voiceCount;
    whine.stop();
    assert.equal(sound.voiceCount, before - 1);

    // Rooms: the reverb was built on the first send; setRoom switches presets (after the previous crossfade).
    assert.equal(f.nodes.filter((n) => n.kind === 'convolver').length, 2);
    sound.setRoom('atrium');
    f.context().currentTime += 5;
    sound.setRoom('atrium');
    assert.equal(sound.room, 'atrium');
    sound.setRoom(null);
    f.context().currentTime += 5;
    sound.setRoom(null);
    assert.equal(sound.room, audio.reverb.defaultRoom);
    sound.setRoom('parkingLot'); f.context().currentTime += 5; sound.setRoom('parkingLot');
    assert.equal(sound.room, 'parking');

    // Every source of a finished voice releases its nodes.
    const startCount = f.nodes.length;
    sound.play('stapleShot');
    const fresh = f.nodes.slice(startCount);
    for (const n of fresh) if (n.kind === 'source' || n.kind === 'oscillator') n.onended();
    assert.ok(fresh.every((n) => n.disconnected), 'a finished shot disconnects everything it made');

    // BOGO: a shot sits on the side of the gun that fired it (not alternating), and a gun without sides stays centred.
    const pans = (opts) => { const n0 = f.nodes.length; sound.play('bogoShot', opts); return f.nodes.slice(n0).filter((n) => n.kind === 'pan').map((n) => n.pan.value); };
    assert.deepEqual(pans({ side: 'left' }), [-audio.sounds.bogoShot.sidePan]);
    assert.deepEqual(pans({ side: 'left' }), [-audio.sounds.bogoShot.sidePan], 'the left gun twice stays left');
    assert.deepEqual(pans({ side: 'right' }), [audio.sounds.bogoShot.sidePan]);
    assert.deepEqual(pans({}), []);

    // Ducking: a big shot dips the world bus (everything else) and comes back; it and the hit sounds skip the dip.
    const compressor = f.nodes.find((n) => n.kind === 'compressor');
    const master = f.nodes.find((n) => n.kind === 'gain' && n.out.includes(compressor));
    const world = f.nodes.find((n) => n.kind === 'gain' && n.out.includes(master));
    assert.ok(master && world, 'master and the world bus');
    const outOf = (name) => { const n0 = f.nodes.length; sound.play(name); return f.nodes[n0]; }; // (a voice's first node is its output)
    world.gain.targets.length = 0;
    const big = outOf('confettiShot');
    const { db } = audio.sounds.confettiShot.duck;
    assert.ok(Math.abs(world.gain.targets[0][0] - 10 ** (-db / 20)) < 1e-9 && world.gain.targets.at(-1)[0] === 1, 'dips, then recovers');
    assert.ok(big.out.includes(master) && !big.out.includes(world), 'the ducking shot itself skips the dip');
    assert.ok(outOf('hitBody').out.includes(master), 'hit sounds are exempt');
    assert.ok(outOf('stapleShot').out.includes(world), 'an ordinary shot is in the world bus');
    for (const name of ['confettiShot', 'stargazerShot', 'returnBeam', 'bottleRocketBurst']) assert.ok(audio.sounds[name].duck, `${name} ducks`);
    for (const w of guns) if (w.fireMode === 'auto' || w.burst) assert.ok(!audio.sounds[w.sounds.fire].duck, `${w.id} (automatic) never ducks: it would pump`);

    // Old-format recipes still play (the simple `layers` form).
    const n0 = f.sources.length;
    sound.play('paChime');
    assert.ok(f.sources.length > n0);
  } finally { window.AudioContext = previous; }
});
