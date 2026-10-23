import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js';
import { renderMallMusic } from '../src/audio/mallMusic.js';
import { mallMusic } from '../src/config/music.js';
import { audio } from '../src/config/audio.js';
import { createSound } from '../src/audio/sound.js';
import { createAmbience } from '../src/game/ambience.js';
import { createSettings } from '../src/game/settings.js';
import * as THREE from 'three';

test('original track has deterministic stereo audio, a seamless loop, useful dynamics and no clipping/silent bars', () => {
  const a = renderMallMusic(), b = renderMallMusic();
  assert.deepEqual(a, b, 'independent renders are identical and use no gameplay randomness');
  assert.equal(a.left.length, Math.round(mallMusic.bars * mallMusic.beatsPerBar * 60 / mallMusic.bpm * a.sampleRate));
  let stereo = 0, energy = 0;
  for (const ch of [a.left, a.right]) {
    assert.ok(Math.abs(ch[0] - ch.at(-1)) < 1e-6, 'no discontinuity at loop seam');
    for (const v of ch) { assert.ok(Number.isFinite(v) && Math.abs(v) <= mallMusic.peak); energy += v * v; }
    for (let bar = 0; bar < mallMusic.bars; bar++) {
      let square = 0;
      const start = Math.floor(bar * ch.length / mallMusic.bars), end = Math.floor((bar + 1) * ch.length / mallMusic.bars);
      for (let i = start; i < end; i++) square += ch[i] ** 2;
      assert.ok(Math.sqrt(square / (end - start)) > 0.02, `bar ${bar} has audible material`);
    }
  }
  for (let i = 0; i < a.left.length; i++) stereo += Math.abs(a.left[i] - a.right[i]);
  assert.ok(stereo / a.left.length > 0.001);
  assert.ok(Math.sqrt(energy / (a.left.length * 2)) < 0.3, 'headroom remains for combat');
});

function fakeAudio() {
  const nodes = [], sources = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
  const make = kind => {
    const n = { kind, gain: param(), frequency: param(), pan: param(), Q: param(), threshold: param(), ratio: param(),
      connect() {}, disconnect() { this.disconnected = true; }, start(...args) { this.started = args; },
      stop(at) { this.stopped = at; } };
    nodes.push(n); if (kind === 'source' || kind === 'oscillator') sources.push(n); return n;
  };
  let ctx;
  class AudioContext {
    constructor() { ctx = this; this.state = 'running'; this.currentTime = 10; this.sampleRate = 16; this.destination = {}; }
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { duration: length / rate, numberOfChannels: channels, getChannelData: n => data[n] };
    }
    createDynamicsCompressor() { return make('compressor'); }
    createGain() { return make('gain'); }
    createBiquadFilter() { return make('filter'); }
    createStereoPanner() { return make('pan'); }
    createBufferSource() { return make('source'); }
    createOscillator() { return make('oscillator'); }
  }
  return { AudioContext, nodes, sources, context: () => ctx };
}

test('music loads once asynchronously, stays in sync between speakers, resumes after pause, resets and mutes independently', async () => {
  const f = fakeAudio(), previous = window.AudioContext, volumes = [audio.musicVolume, audio.ambienceVolume];
  window.AudioContext = f.AudioContext;
  let renders = 0, ready;
  const rendered = new Promise(resolve => { ready = resolve; });
  try {
    audio.musicVolume = 0.45;
    const sound = createSound({ renderMusic: () => { renders++; return rendered; } }); sound.unlock();
    const mix = id => [{ id, kind: 'music', gain: 0.8, pan: 0 }, { id: 'vent', kind: 'ventilation', gain: 0.5, pan: 0 }];
    sound.setAmbience(mix('hall')); sound.setAmbience(mix('hall'));
    await Promise.resolve(); assert.equal(renders, 1);
    assert.equal(f.sources.length, 1, 'HVAC starts while music is being prepared');
    ready({ left: new Float32Array(160), right: new Float32Array(160), sampleRate: 16 });
    await new Promise(resolve => setImmediate(resolve));
    sound.setAmbience(mix('hall'));
    const music = f.sources.find(s => s.buffer?.numberOfChannels === 2);
    assert.ok(music.loop); assert.deepEqual(music.started, [10, 0]);
    f.context().currentTime = 12.5; sound.setAmbience(mix('mart'));
    assert.equal(f.sources.length, 2, 'changing speakers reuses the existing track');
    const gains = f.nodes.filter(n => n.kind === 'gain'), ventGain = gains[1].gain.value;
    sound.setMusicVolume(0); assert.equal(gains[2].gain.value, 0); assert.equal(gains[1].gain.value, ventGain);
    sound.setMusicVolume(0.5); assert.ok(gains[2].gain.value > 0);
    sound.setAmbience([]);
    assert.ok(music.stopped > 12.5); music.onended(); assert.ok(music.disconnected);
    f.context().currentTime = 13; sound.setAmbience(mix('mart'));
    assert.deepEqual(f.sources.at(-2).started, [13, 2.5], 'resume retains musical position');
    sound.setAmbience([]); sound.resetMusic(); sound.setAmbience(mix('start'));
    assert.equal(f.sources.at(-2).started[1], 0, 'a new run starts at the beginning');
    sound.setAmbience([]);
  } finally { window.AudioContext = previous; [audio.musicVolume, audio.ambienceVolume] = volumes; }
});

test('one strongest music speaker leaves space for mechanical ambience; reset rewinds the soundtrack', () => {
  let mix, resets = 0;
  const emit = (id, kind, x) => ({ id, kind, zone: 'room', position: [x, 1.6, 0], range: 10 });
  const a = createAmbience({
    map: { zones: { room: { open: true } }, ambience: [emit('speaker1', 'music', 1), emit('speaker2', 'music', 2),
      emit('speaker3', 'music', 3), emit('vent', 'ventilation', 4), emit('fridge', 'refrigerator', 5)] },
    player: { position: new THREE.Vector3(), height: 2, yaw: 0 }, colliders: [],
    sound: { setAmbience(v) { mix = v; }, resetMusic() { resets++; } },
  });
  a.update(1 / 60, true);
  assert.deepEqual(mix.map(v => v.id), ['speaker1', 'vent', 'fridge']);
  a.reset(); assert.deepEqual(mix, []); assert.equal(resets, 1);
});

test('music volume is saved/restored and independent of master and environmental sound', () => {
  const savedStorage = globalThis.localStorage, volumes = [audio.masterVolume, audio.ambienceVolume, audio.musicVolume];
  const saved = {};
  globalThis.localStorage = { getItem: key => saved[key] ?? null, setItem: (key, value) => { saved[key] = value; } };
  const ctx = { renderer: { setPixelRatio() {} }, hud: { setFpsVisible() {} }, sound: { setMasterVolume() {}, setMusicVolume() {} } };
  try {
    const s = createSettings(ctx), master = s.get('masterVolume'), ambience = s.get('ambienceVolume');
    s.set('musicVolume', 0); assert.equal(audio.musicVolume, 0);
    assert.equal(s.get('masterVolume'), master); assert.equal(s.get('ambienceVolume'), ambience);
    assert.equal(createSettings(ctx).get('musicVolume'), 0);
    s.reset('Audio'); assert.equal(s.get('musicVolume'), s.defs.find(d => d.id === 'musicVolume').default);
  } finally {
    globalThis.localStorage = savedStorage;
    [audio.masterVolume, audio.ambienceVolume, audio.musicVolume] = volumes;
  }
});
