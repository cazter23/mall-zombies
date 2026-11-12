import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/headlessGame.js'; // (a window for the sound service)
import { renderTrack, songEvents, trackById } from '../src/audio/mallMusic.js';
import { closingMusic } from '../src/config/closingMusic.js';
import { radioTracks } from '../src/config/radioTracks.js';
import { radio } from '../src/config/music.js';
import { audio } from '../src/config/audio.js';
import { createSound } from '../src/audio/sound.js';

const track = closingMusic.track;

test('Last Call is a full song off the radio: drums, a melody from the top, notes in range, a loop of under a minute and a half', () => {
  assert.ok(!radioTracks.includes(track), 'never in the rotation');
  assert.equal(trackById(track.id), track, 'the music worker can find it');
  const events = songEvents(track);
  const seconds = events.beats * 60 / track.bpm;
  assert.ok(seconds > 30 && seconds < 90, `${seconds.toFixed(0)} s`);
  assert.ok(events.drums.length > 100);
  assert.ok(events.notes.some((n) => n.part === 'lead' && n.start < track.beatsPerBar), 'the lead from the first bar');
  for (const note of events.notes) assert.ok(note.midi >= 28 && note.midi <= 96, `note ${note.midi}`);
});

test('it renders as a seamless loop: no chime, exactly its form long, sound at both ends, mastered to the radio\'s peak', () => {
  const rate = 4000;
  const pcm = renderTrack(track, { sampleRate: rate });
  assert.equal(renderTrack(track, { sampleRate: rate }).left[1234], pcm.left[1234], 'deterministic');
  assert.equal(pcm.songStart, 0, 'no station chime');
  const length = Math.round(songEvents(track).beats * 60 / track.bpm * rate);
  assert.equal(pcm.left.length, length);
  let peak = 0, start = 0, end = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(pcm.left[i]), Math.abs(pcm.right[i]));
  for (let i = 0; i < rate / 10; i++) { start = Math.max(start, Math.abs(pcm.left[i])); end = Math.max(end, Math.abs(pcm.left[length - 1 - i])); }
  assert.ok(Math.abs(peak - radio.peak) < 1e-3);
  assert.ok(start > 0.05 && end > 0.05, 'no fade at either end of the loop');
});

function fakeAudio() {
  const nodes = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } });
  const make = (kind) => {
    const n = { kind, gain: param(), frequency: param(), pan: param(), Q: param(), threshold: param(), ratio: param(),
      attack: param(), release: param(), knee: param(), detune: param(),
      connect() {}, disconnect() { this.disconnected = true; }, start(...args) { this.started = args; }, stop(at) { this.stopped = at; } };
    nodes.push(n);
    return n;
  };
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 10; this.destination = {}; }
    createBuffer(channels, length, rate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { duration: length / rate, numberOfChannels: channels, getChannelData: (n) => data[n] };
    }
    createDynamicsCompressor() { return make('compressor'); }
    createGain() { return make('gain'); }
    createBiquadFilter() { return make('filter'); }
    createStereoPanner() { return make('pan'); }
    createBufferSource() { return make('source'); }
    createOscillator() { return make('oscillator'); }
  }
  return { AudioContext, nodes };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const pcm = () => ({ left: new Float32Array(160), right: new Float32Array(160), sampleRate: 16 });

test('the sound service plays it looped at the music volume, ducks the radio, and ends it faded or under a resolving chord', async () => {
  const f = fakeAudio(), previous = window.AudioContext, volume = audio.musicVolume;
  window.AudioContext = f.AudioContext;
  const rendered = [];
  try {
    audio.musicVolume = 0.5;
    const sound = createSound({ renderMusic: (id) => { rendered.push(id); return pcm(); } });
    sound.playScore();
    sound.stopScore(); // locked audio: nothing to start or stop
    assert.equal(rendered.length, 0);
    sound.unlock();
    sound.playScore();
    await settle();
    assert.deepEqual(rendered, [track.id], 'rendered once, when first wanted');
    const loop = f.nodes.find((n) => n.kind === 'source' && n.buffer?.numberOfChannels === 2);
    assert.ok(loop?.loop && loop.started, 'a looping voice');
    const bus = f.nodes.filter((n) => n.kind === 'gain').at(-1);
    assert.equal(bus.gain.value, closingMusic.volume * 0.5);
    sound.setMusicVolume(0.2);
    assert.equal(bus.gain.value, closingMusic.volume * 0.2);

    // The radio under it: the music speaker's gain is ducked while it plays, and comes back after.
    const mix = [{ id: 'hall', kind: 'music', gain: 1, pan: 0 }];
    sound.setAmbience(mix);
    await settle();
    sound.setAmbience(mix);
    const radioSource = f.nodes.filter((n) => n.kind === 'source' && n.buffer?.numberOfChannels === 2).at(-1);
    const radioGain = f.nodes[f.nodes.indexOf(radioSource) + 2]; // (source, low-pass, gain: audio/sound.js setAmbience)
    assert.notEqual(radioSource, loop);
    const radioDef = radioTracks.find((t) => t.id === radio.opener);
    assert.ok(Math.abs(radioGain.gain.value - radioDef.gain * 0.2 * closingMusic.radioDuck) < 1e-9);

    // Returned: the loop stops fast and the chord rings on its own bus.
    const before = f.nodes.length;
    sound.stopScore({ resolve: true });
    assert.equal(loop.stopped, 10 + closingMusic.resolveFadeSeconds);
    const chordVoices = f.nodes.slice(before).filter((n) => n.kind === 'oscillator' || n.kind === 'source');
    assert.equal(chordVoices.length, closingMusic.resolve.length);
    sound.setAmbience(mix);
    assert.ok(Math.abs(radioGain.gain.value - radioDef.gain * 0.2) < 1e-9, 'the radio back to its volume');
    sound.stopScore(); // harmless when already stopped

    // Again (a later run): the same buffer, a fade-out without the chord.
    sound.playScore();
    assert.equal(rendered.filter((id) => id === track.id).length, 1, 'rendered once a session');
    const again = f.nodes.filter((n) => n.kind === 'source' && n.buffer?.numberOfChannels === 2).at(-1);
    assert.notEqual(again, loop);
    const count = f.nodes.length;
    sound.stopScore();
    assert.equal(again.stopped, 10 + closingMusic.fadeOutSeconds);
    assert.equal(f.nodes.length, count, 'no chord');
  } finally { window.AudioContext = previous; audio.musicVolume = volume; }
});
