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
import { atmosphere } from '../config/environment.js';

export function createSound() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const ambientVoices = new Map();

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

  function playLayer(layer, start, volume, pitch, destination = master) {
    const gain = ctx.createGain();
    envelope(gain.gain, start, Math.max(0.0001, layer.gain * volume), layer.attack, layer.decay);
    gain.connect(destination);
    const end = start + layer.attack + layer.decay + 0.02;

    let source;
    let filter;
    if (layer.type === 'noise') {
      source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      filter = ctx.createBiquadFilter();
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
    source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    return source;
  }

  // At most a few nearby emitters. Removed sources fade, stop and disconnect;
  // paused/dead games never retain a running soundtrack.
  function setAmbience(mix) {
    if (!ctx) return;
    const now = ctx.currentTime, cfg = atmosphere.ambience;
    const wanted = new Set(mix.slice(0, cfg.maxVoices).map(v => v.id));
    for (const [id, voice] of ambientVoices) {
      if (wanted.has(id)) continue;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, cfg.fadeSeconds / 3);
      voice.source.stop(now + cfg.fadeSeconds);
      voice.source.onended = () => { for (const node of voice.nodes) node.disconnect(); };
      ambientVoices.delete(id);
    }
    for (const item of mix.slice(0, cfg.maxVoices)) {
      if (ctx.state !== 'running') break;
      const def = cfg.voices[item.kind];
      if (!def) continue;
      let voice = ambientVoices.get(item.id);
      if (!voice) {
        const source = def.noise ? ctx.createBufferSource() : ctx.createOscillator();
        if (def.noise) { source.buffer = noiseBuffer; source.loop = true; }
        else { source.type = 'sine'; source.frequency.value = def.frequency; }
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = def.frequency * 2;
        const gain = ctx.createGain(); gain.gain.value = 0;
        const pan = ctx.createStereoPanner();
        source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(master);
        source.start();
        voice = { source, gain, pan, nodes: [source, filter, gain, pan] };
        ambientVoices.set(item.id, voice);
      }
      voice.pan.pan.setTargetAtTime(item.pan, now, cfg.fadeSeconds);
      voice.gain.gain.setTargetAtTime(Math.max(0, item.gain) * def.gain * audio.ambienceVolume, now, cfg.fadeSeconds);
      if (item.kind === 'music') {
        const note = cfg.musicNotes[Math.floor(now / cfg.noteSeconds) % cfg.musicNotes.length];
        voice.source.frequency.setTargetAtTime(note, now, cfg.fadeSeconds);
      }
    }
  }

  return {
    setAmbience,
    playAmbient(name, { volume = 1, pan = 0 } = {}) {
      const def = audio.sounds[name];
      if (!def || !ctx || ctx.state !== 'running') return;
      const panner = ctx.createStereoPanner(); panner.pan.value = pan; panner.connect(master);
      const now = ctx.currentTime;
      let remaining = def.layers.length;
      for (const layer of def.layers) {
        const source = playLayer(layer, now + (layer.delay ?? 0), def.volume * volume * audio.ambienceVolume, 1, panner);
        const cleanup = source.onended;
        source.onended = () => { cleanup(); if (--remaining === 0) panner.disconnect(); };
      }
    },
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
