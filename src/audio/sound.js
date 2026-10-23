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
import { mallMusic } from '../config/music.js';

function renderMusicInWorker() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./musicWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
    worker.onerror = error => { worker.terminate(); reject(error); };
    worker.postMessage(null);
  });
}

export function createSound({ renderMusic = renderMusicInWorker } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const ambientVoices = new Map();
  let musicBuffer = null, musicLoading = false, musicFailed = false, musicCursor = 0;

  function prepareMusic() {
    if (musicBuffer || musicLoading || musicFailed) return;
    musicLoading = true;
    Promise.resolve().then(renderMusic).then(track => {
      musicBuffer = ctx.createBuffer(2, track.left.length, track.sampleRate);
      musicBuffer.getChannelData(0).set(track.left);
      musicBuffer.getChannelData(1).set(track.right);
      musicLoading = false;
    }).catch(error => {
      musicLoading = false; musicFailed = true;
      console.warn('Mall music could not be prepared:', error);
    });
  }

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
      if (compressor.attack) compressor.attack.value = audio.compressor.attack;
      if (compressor.release) compressor.release.value = audio.compressor.release;
      if (compressor.knee) compressor.knee.value = audio.compressor.kneeDb;
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
    // Every speaker shares one track and timeline; changing rooms only moves its pan/gain.
    const entries = mix.slice(0, cfg.maxVoices).map(v => v.kind === 'music' ? { ...v, id: 'mall_music' } : v);
    const wanted = new Set(entries.map(v => v.id));
    for (const [id, voice] of ambientVoices) {
      if (wanted.has(id)) continue;
      if (voice.kind === 'music') musicCursor = (voice.offset + now - voice.startedAt) % musicBuffer.duration;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, cfg.fadeSeconds / 3);
      voice.source.stop(now + cfg.fadeSeconds);
      voice.source.onended = () => { for (const node of voice.nodes) node.disconnect(); };
      ambientVoices.delete(id);
    }
    for (const item of entries) {
      if (ctx.state !== 'running') break;
      const isMusic = item.kind === 'music';
      const def = isMusic ? mallMusic : cfg.voices[item.kind];
      if (!def) continue;
      if (isMusic && !musicBuffer) { if (audio.musicVolume > 0) prepareMusic(); continue; }
      let voice = ambientVoices.get(item.id);
      if (!voice) {
        const source = (isMusic || def.noise) ? ctx.createBufferSource() : ctx.createOscillator();
        if (isMusic || def.noise) { source.buffer = isMusic ? musicBuffer : noiseBuffer; source.loop = true; }
        else { source.type = def.wave || 'sine'; source.frequency.value = def.frequency; }
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = isMusic ? def.lowpassHz : (def.filterHz ?? def.frequency * 2.5);
        const gain = ctx.createGain(); gain.gain.value = 0;
        const pan = ctx.createStereoPanner();
        source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(master);
        const nodes = [source, filter, gain, pan];
        if (isMusic) {
          source.disconnect();
          const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = def.highpassHz;
          source.connect(highpass); highpass.connect(filter); nodes.push(highpass);
        }
        source.start(now, isMusic ? musicCursor : 0);
        voice = { source, gain, pan, nodes, kind: item.kind, startedAt: now, offset: musicCursor };
        ambientVoices.set(item.id, voice);
      }
      voice.pan.pan.setTargetAtTime(item.pan, now, cfg.fadeSeconds);
      voice.spatialGain = Math.max(0, item.gain);
      voice.gain.gain.setTargetAtTime(voice.spatialGain * def.gain * (isMusic ? audio.musicVolume : audio.ambienceVolume), now, cfg.fadeSeconds);
    }
  }

  return {
    setAmbience,
    resetMusic() { musicCursor = 0; },
    setMusicVolume(volume) {
      audio.musicVolume = volume;
      for (const voice of ambientVoices.values()) if (voice.kind === 'music') {
        voice.gain.gain.setTargetAtTime(voice.spatialGain * mallMusic.gain * volume, ctx.currentTime, atmosphere.ambience.fadeSeconds);
      }
    },
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
