// =============================================================================
// SOUND
// Plays the synthesized sounds from config/audio.js with the Web Audio API.
// Each play() builds its layers on the fly (noise bursts and tones with an
// attack + fade), so there are no audio files and no loading.
//
// Browsers only allow audio after the player clicks or presses a key, so the
// audio context is created/resumed on the first such input. Sounds played before
// that are silently skipped.
// =============================================================================

import { audio } from '../config/audio.js';

export function createSound() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  // One second of white noise, reused by every noise layer.
  function makeNoiseBuffer() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Create (or wake up) the audio context. Must happen during a user gesture.
  function unlock() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      ctx = new AudioContextClass();
      // A gentle compressor on the master bus keeps rapid fire from clipping.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = audio.compressor.thresholdDb;
      compressor.ratio.value = audio.compressor.ratio;
      master = ctx.createGain();
      master.gain.value = audio.masterVolume;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      noiseBuffer = makeNoiseBuffer();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock);

  // Volume envelope: quick rise to `peak`, then an exponential fade to silence.
  function envelope(param, start, peak, attack, decay) {
    param.setValueAtTime(0.0001, start);
    param.linearRampToValueAtTime(peak, start + attack);
    param.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  function playLayer(layer, start, volume, pitch) {
    const gain = ctx.createGain();
    envelope(gain.gain, start, Math.max(0.0001, layer.gain * volume), layer.attack, layer.decay);
    gain.connect(master);
    const end = start + layer.attack + layer.decay + 0.02;

    let source;
    if (layer.type === 'noise') {
      source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.frequency.value = layer.freq * pitch;
      filter.Q.value = layer.q ?? 1;
      source.connect(filter);
      filter.connect(gain);
      // Start somewhere random in the noise so repeats aren't identical.
      source.start(start, Math.random() * 0.5);
    } else {
      source = ctx.createOscillator();
      source.type = layer.wave;
      source.frequency.setValueAtTime(layer.freq * pitch, start);
      if (layer.freqEnd) {
        source.frequency.exponentialRampToValueAtTime(layer.freqEnd * pitch, start + layer.attack + layer.decay);
      }
      source.connect(gain);
      source.start(start);
    }
    source.stop(end);
  }

  return {
    /** Play a sound by name (see config/audio.js). `volume` scales it (0..1+). */
    play(name, { volume = 1 } = {}) {
      const def = audio.sounds[name];
      if (!def || !ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const pitch = 1 + (Math.random() * 2 - 1) * audio.pitchVariation;
      for (const layer of def.layers) playLayer(layer, now + (layer.delay ?? 0), def.volume * volume, pitch);
    },

    unlock, // also called when the game starts (a click), just in case

    // Settings > Audio. Safe before the audio context exists (unlock() then starts at audio.masterVolume).
    setMasterVolume(volume) {
      if (master) master.gain.value = volume;
    },

    get ready() {
      return !!ctx && ctx.state === 'running';
    },
  };
}
