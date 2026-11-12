import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js';
import { renderTrack, songEvents, noteNumber, parseChord, trackById, tapeWear } from '../src/audio/mallMusic.js';
import { radio } from '../src/config/music.js';
import { radioTracks } from '../src/config/radioTracks.js';
import { deathMusic } from '../src/config/deathMusic.js';
import { feel } from '../src/config/feel.js';
import { headlessGame } from './helpers/headlessGame.js';
import { audio } from '../src/config/audio.js';
import { createSound } from '../src/audio/sound.js';
import { createAmbience } from '../src/game/ambience.js';
import { createSettings } from '../src/game/settings.js';
import * as THREE from 'three';

test('notes and chord symbols read as expected', () => {
  assert.equal(noteNumber('C4'), 60);
  assert.equal(noteNumber('Bb3'), 58);
  assert.equal(noteNumber('F#5'), 78);
  assert.equal(noteNumber(69), 69);
  assert.deepEqual(parseChord('Ebmaj9'), { root: 3, intervals: [0, 4, 11, 14], bass: 3 });
  assert.equal(parseChord('Bb/F').bass, 5);
  assert.throws(() => parseChord('Cwhatever'));
  assert.throws(() => noteNumber('H2'));
});

test('Galleria FM has six original songs, each parsing into a full form with drums, a melody and a sensible length', () => {
  assert.equal(radioTracks.length, 6);
  assert.equal(new Set(radioTracks.map((t) => t.id)).size, 6);
  for (const track of radioTracks) {
    const events = songEvents(track);
    const seconds = radio.chime.seconds + events.beats * 60 / track.bpm + radio.tailSeconds;
    assert.ok(seconds > 90 && seconds < 170, `${track.id}: ${seconds.toFixed(0)} s`);
    assert.ok(events.drums.length > 100, `${track.id} has drums`);
    assert.ok(events.notes.some((n) => track.sections[track.form[1]].melody?.part === n.part), `${track.id} has a melody early on`);
    for (const note of events.notes) assert.ok(note.midi >= 28 && note.midi <= 96, `${track.id}: note ${note.midi} out of range`);
    assert.ok(track.gain > 0 && track.lowpassHz > 1000 && track.highpassHz > 0);
    assert.equal(trackById(track.id), track);
  }
});

test('every song renders deterministically: stereo, no clipping, headroom, the chime first, and no silent stretch', () => {
  const rate = 4000;
  for (const track of radioTracks) {
    const a = renderTrack(track, { sampleRate: rate }), b = renderTrack(track, { sampleRate: rate });
    assert.deepEqual(a.left, b.left, `${track.id}: two renders are identical`);
    let energy = 0, stereo = 0;
    for (let i = 0; i < a.left.length; i++) {
      for (const v of [a.left[i], a.right[i]]) { assert.ok(Number.isFinite(v) && Math.abs(v) <= radio.peak + 1e-6); energy += v * v; }
      stereo += Math.abs(a.left[i] - a.right[i]);
    }
    assert.ok(stereo / a.left.length > 0.001, `${track.id} is stereo`);
    assert.ok(Math.sqrt(energy / (a.left.length * 2)) < 0.3, `${track.id} leaves headroom for combat`);
    const rms = (from, to) => { let sq = 0; for (let i = Math.floor(from * rate); i < Math.floor(to * rate); i++) sq += a.left[i] ** 2; return Math.sqrt(sq / ((to - from) * rate)); };
    assert.ok(rms(0, 0.8) > 0.02, `${track.id} opens with the station chime`);
    for (let t = a.songStart; t < a.seconds - radio.tailSeconds - 2; t += 2) assert.ok(rms(t, t + 2) > 0.01, `${track.id} is silent at ${t.toFixed(0)} s`);
  }
});

test('the tape wears from its round to full, and not at all with the horror layer off', () => {
  const { fromRound, fullRound } = radio.tapeWear;
  assert.equal(tapeWear(1), 0);
  assert.equal(tapeWear(fromRound), 0);
  assert.ok(tapeWear((fromRound + fullRound) / 2) > 0.4 && tapeWear((fromRound + fullRound) / 2) < 0.6);
  assert.equal(tapeWear(fullRound + 10), 1);
  assert.equal(tapeWear(fullRound, false), 0);
});

function fakeAudio() {
  const nodes = [], sources = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
  const make = kind => {
    const n = { kind, gain: param(), frequency: param(), pan: param(), Q: param(), threshold: param(), ratio: param(),
      attack: param(), release: param(), knee: param(), detune: param(),
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

test('End of Shift schedules once at death, anchors the bell to the receipt, respects music volume, and cancels future notes on restart', () => {
  const f = fakeAudio(), previous = window.AudioContext, volume = audio.musicVolume;
  window.AudioContext = f.AudioContext;
  try {
    const sound = createSound();
    sound.playDeathMusic({ receiptAt: 1.6 });
    assert.equal(f.sources.length, 0, 'locked audio never queues a delayed sting');
    sound.unlock();
    sound.playDeathMusic({ receiptAt: 1.6 });
    const voices = f.sources.slice();
    assert.equal(voices.length, deathMusic.layers.length);
    const bellIndex = deathMusic.layers.findIndex((layer) => layer.anchor === 'receipt');
    assert.equal(voices[bellIndex].started[0], 11.6);
    assert.ok(voices.some((source) => source.started[0] > 14), 'ending chords are scheduled in the future');
    const bus = f.nodes.filter((node) => node.kind === 'gain')[1];
    sound.setMusicVolume(0);
    assert.equal(bus.gain.value, 0);
    sound.setMusicVolume(0.5);
    assert.equal(bus.gain.value, deathMusic.volume * 0.5);
    sound.stopDeathMusic();
    for (const source of voices) assert.equal(source.stopped, 10 + deathMusic.stopFadeSeconds);
    sound.stopDeathMusic(); // harmless if already stopped
    sound.playDeathMusic({ receiptAt: 1.6 });
    const replacementBus = f.nodes.filter((node) => node.kind === 'gain').at(-deathMusic.layers.length - 1);
    voices.forEach((source) => source.onended());
    assert.ok(bus.disconnected);
    assert.equal(replacementBus.disconnected, undefined, 'old callbacks cannot disconnect the replacement');
    sound.stopDeathMusic();
    for (const source of f.sources.slice(voices.length)) source.onended();
    assert.ok(f.nodes.filter((node) => node.kind === 'gain').every((node, i) => i === 0 || node.disconnected));
  } finally { window.AudioContext = previous; audio.musicVolume = volume; }
});

test('a real run plays its sting once on death and stops it when Play again or Main Menu resets the run', () => {
  const calls = [];
  const t = headlessGame({ sound: {
    play() {},
    playDeathMusic: (options) => calls.push(['play', options]),
    stopDeathMusic: () => calls.push(['stop']),
  } });
  t.tick();
  t.g.health.takeDamage(10000);
  t.g.health.takeDamage(10000);
  t.tick(180);
  assert.deepEqual(calls, [['play', { receiptAt: feel.death.resultsDelay }]]);
  t.g.resetRun();
  assert.equal(calls.at(-1)[0], 'stop');
  t.g.resetRun();
  assert.equal(calls.at(-1)[0], 'stop');
});

const pcm = (seconds) => ({ left: new Float32Array(seconds * 16), right: new Float32Array(seconds * 16), sampleRate: 16 });
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the radio renders the song playing and the next one, crossfades at the end, and announces each song once', async () => {
  const f = fakeAudio(), previous = window.AudioContext, volumes = [audio.musicVolume, audio.ambienceVolume];
  window.AudioContext = f.AudioContext;
  const rendered = [], announced = [];
  try {
    audio.musicVolume = 0.45;
    const sound = createSound({ renderMusic: (id) => { rendered.push(id); return pcm(20); }, random: () => 0.5, onTrackChange: (t) => announced.push(t.id) });
    sound.unlock();
    const mix = (id) => [{ id, kind: 'music', gain: 0.8, pan: 0 }, { id: 'vent', kind: 'ventilation', gain: 0.5, pan: 0 }];
    sound.setAmbience(mix('hall'));
    assert.equal(f.sources.length, 1, 'HVAC starts while the first song is prepared');
    await settle();
    assert.equal(rendered.length, 2, 'the song playing and the one after it, no more');
    sound.setAmbience(mix('hall'));
    const first = f.sources.find((s) => s.buffer?.numberOfChannels === 2);
    assert.ok(first.loop);
    assert.deepEqual(first.started, [10, 0]);
    assert.equal(sound.nowPlaying.id, rendered[0]);
    assert.deepEqual(announced, [rendered[0]]);

    // Changing speakers keeps the same song and timeline; pausing remembers where it was.
    f.context().currentTime = 12.5; sound.setAmbience(mix('mart'));
    assert.equal(f.sources.filter((s) => s.buffer?.numberOfChannels === 2).length, 1);
    sound.setAmbience([]);
    f.context().currentTime = 13; sound.setAmbience(mix('mart'));
    assert.deepEqual(f.sources.filter((s) => s.buffer?.numberOfChannels === 2).at(-1).started, [13, 2.5], 'resume keeps its place');
    assert.equal(announced.length, 1, 'resuming is not a new song');

    // Near the end: the next song starts (from its top, with the chime) and the old one fades out.
    const playing = f.sources.filter((s) => s.buffer?.numberOfChannels === 2).at(-1);
    f.context().currentTime = 13 + (20 - 2.5) - radio.crossfadeSeconds + 0.1;
    sound.setAmbience(mix('mart'));
    const next = f.sources.filter((s) => s.buffer?.numberOfChannels === 2).at(-1);
    assert.notEqual(next, playing);
    assert.equal(next.started[1], 0);
    assert.ok(playing.stopped > f.context().currentTime, 'the old song fades out rather than cutting');
    assert.equal(sound.nowPlaying.id, rendered[1]);
    assert.deepEqual(announced, [rendered[0], rendered[1]]);
    await settle();
    assert.equal(rendered.length, 3, 'the one after that is prepared while this one plays');

    // Volume: music alone.
    sound.setMusicVolume(0);
    const musicGain = f.nodes.filter((n) => n.kind === 'gain').at(-2);
    assert.equal(musicGain.gain.value, 0);
    sound.setAmbience([]);
  } finally { window.AudioContext = previous; [audio.musicVolume, audio.ambienceVolume] = volumes; }
});

test('the rotation plays every song once before any repeats, never the same song twice running; a new run moves on', async () => {
  const f = fakeAudio(), previous = window.AudioContext;
  window.AudioContext = f.AudioContext;
  const rendered = [];
  let seed = 3;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  try {
    const sound = createSound({ renderMusic: (id) => { rendered.push(id); return pcm(10); }, random });
    sound.unlock();
    const mix = [{ id: 'hall', kind: 'music', gain: 0.8, pan: 0 }];
    for (let i = 0; i < 20; i++) {
      sound.setAmbience(mix);
      await settle();
      sound.setAmbience([]);
      sound.resetMusic(); // (a new run: the next song)
    }
    const n = radioTracks.length;
    for (let start = 0; start + n <= rendered.length; start += n) {
      assert.equal(new Set(rendered.slice(start, start + n)).size, n, `songs ${start}..${start + n - 1} are all different`);
    }
    for (let i = 1; i < rendered.length; i++) assert.notEqual(rendered[i], rendered[i - 1], 'never the same song twice running');
  } finally { window.AudioContext = previous; }
});

test('tape wear sags the pitch and wobbles it, and the timeline runs at the sagged speed', async () => {
  const f = fakeAudio(), previous = window.AudioContext;
  window.AudioContext = f.AudioContext;
  try {
    const sound = createSound({ renderMusic: () => pcm(60) });
    sound.unlock();
    const mix = [{ id: 'hall', kind: 'music', gain: 0.8, pan: 0 }];
    sound.setAmbience(mix); await settle(); sound.setAmbience(mix);
    const source = f.sources.find((s) => s.buffer?.numberOfChannels === 2);
    assert.equal(source.detune.value, 0);
    sound.setTapeWear(1);
    assert.equal(source.detune.value, radio.tapeWear.detuneCents);
    f.context().currentTime = 20;
    sound.setAmbience([]);
    f.context().currentTime = 21;
    sound.setTapeWear(0);
    sound.setAmbience(mix);
    const resumed = f.sources.filter((s) => s.buffer?.numberOfChannels === 2).at(-1);
    const sagged = 10 * 2 ** (radio.tapeWear.detuneCents / 1200);
    assert.ok(Math.abs(resumed.started[1] - sagged) < 1e-6, 'ten seconds at the sagged speed is a little less than ten seconds of song');
    sound.setAmbience([]);
  } finally { window.AudioContext = previous; }
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

test('the now-playing card shows the station and the song', async () => {
  const { menuDom } = await import('./helpers/menuDom.js');
  menuDom();
  const { createRadioTicker } = await import('../src/ui/radioTicker.js');
  const ticker = createRadioTicker();
  assert.equal(ticker.showing, false);
  ticker.show(trackById('escalatorBossa'));
  assert.equal(ticker.showing, true);
  assert.equal(ticker.title, 'Escalator Bossa');
  assert.ok(ticker.element.textContent.includes(radio.station));
  ticker.show(trackById('foodCourtFunk')); // (a second song restarts the card's timer)
  assert.equal(ticker.title, 'Food Court Funk');
});
