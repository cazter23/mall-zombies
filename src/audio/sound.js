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
import { radio } from '../config/music.js';
import { radioTracks } from '../config/radioTracks.js';
import { deathMusic } from '../config/deathMusic.js';
import { closingMusic } from '../config/closingMusic.js';
import { makeAmbientPulse } from './ambientPulse.js';

function renderMusicInWorker(id) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./musicWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
    worker.onerror = error => { worker.terminate(); reject(error); };
    worker.postMessage({ id });
  });
}

/**
 * @param renderMusic   (trackId) => Promise<{ left, right, sampleRate }>: a song's PCM (default: rendered in a worker)
 * @param random        the shuffle (default Math.random: the radio is not gameplay)
 * @param onTrackChange (track) => void when a song starts from its beginning where you can hear it (the now-playing card)
 */
export function createSound({ renderMusic = renderMusicInWorker, random = Math.random, onTrackChange = null } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const ambientVoices = new Map();
  const ambientPulseBuffers = new Map();
  let deathVoice = null;

  // ---- Galleria FM: the opener (After Closing), then a shuffled rotation (every song once before any repeats, never the same
  // song twice running). Only the song playing and the one after it are held; the next is rendered while the current plays.
  // The speakers share one timeline, which moves only while one is audible (so the radio waits for you while you are out of earshot).
  const station = { order: [], at: 0, last: null, current: null, next: null, loading: false, failed: false, cursor: 0, wear: 0 };
  const byId = new Map(radioTracks.map(t => [t.id, t]));
  function nextTrackId() {
    if (station.at >= station.order.length) {
      const ids = radioTracks.map(t => t.id);
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      if (ids.length > 1 && ids[0] === station.last) [ids[0], ids[1]] = [ids[1], ids[0]];
      // The session's first shuffle opens with the mall's theme.
      if (!station.last && ids.includes(radio.opener)) ids.unshift(...ids.splice(ids.indexOf(radio.opener), 1));
      station.order = ids; station.at = 0;
    }
    return (station.last = station.order[station.at++]);
  }
  function prepareMusic() {
    if (station.loading || station.failed || (station.current && station.next)) return;
    const id = nextTrackId();
    station.loading = true;
    Promise.resolve().then(() => renderMusic(id)).then(pcm => {
      const buffer = ctx.createBuffer(2, pcm.left.length, pcm.sampleRate);
      buffer.getChannelData(0).set(pcm.left);
      buffer.getChannelData(1).set(pcm.right);
      const song = { track: byId.get(id), buffer };
      if (!station.current) station.current = song; else station.next = song;
      station.loading = false;
      prepareMusic(); // (the one after it, while this one plays)
    }).catch(error => {
      station.loading = false; station.failed = true;
      console.warn('Galleria FM could not prepare a song:', error);
    });
  }
  const wearCents = () => (station.wear ? station.wear * radio.tapeWear.detuneCents : 0);
  const positionOf = (voice, now) => voice.offset + (now - voice.startedAt) * voice.rate;
  function fadeOut(voice, now, seconds) {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, seconds / 3);
    for (const node of voice.nodes) if (node.stop) node.stop(now + seconds);
    voice.source.onended = () => { for (const node of voice.nodes) node.disconnect(); };
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
    if (score.wanted && !score.voice) playScore(); // (wanted before the audio could start it, or before it was rendered)
    const now = ctx.currentTime, cfg = atmosphere.ambience;
    // Every speaker shares one track and timeline; changing rooms only moves its pan/gain.
    const entries = mix.slice(0, cfg.maxVoices).map(v => v.kind === 'music' ? { ...v, id: 'mall_music' } : v);
    const wanted = new Set(entries.map(v => v.id));
    for (const [id, voice] of ambientVoices) {
      if (wanted.has(id)) continue;
      if (voice.kind === 'music') station.cursor = positionOf(voice, now) % voice.source.buffer.duration;
      fadeOut(voice, now, cfg.fadeSeconds);
      ambientVoices.delete(id);
    }
    for (const item of entries) {
      if (ctx.state !== 'running') break;
      const isMusic = item.kind === 'music';
      if (isMusic && !station.current) { if (audio.musicVolume > 0) prepareMusic(); continue; }
      let voice = ambientVoices.get(item.id);
      // The song is ending and the next one is ready: crossfade (the next one opens with the station chime).
      let fadeIn = cfg.fadeSeconds;
      if (isMusic && voice && station.next && positionOf(voice, now) >= voice.source.buffer.duration - radio.crossfadeSeconds) {
        fadeOut(voice, now, radio.crossfadeSeconds);
        ambientVoices.delete(item.id);
        station.current = station.next; station.next = null; station.cursor = 0;
        voice = null; fadeIn = radio.crossfadeSeconds;
      }
      if (isMusic && !station.next) prepareMusic();
      const def = isMusic ? station.current.track : cfg.voices[item.kind];
      if (!def) continue;
      if (!voice) {
        const source = (isMusic || def.noise) ? ctx.createBufferSource() : ctx.createOscillator();
        if (isMusic || def.noise) {
          if (def.clickEverySeconds && !ambientPulseBuffers.has(item.kind)) ambientPulseBuffers.set(item.kind, makeAmbientPulse(ctx, noiseBuffer, def));
          source.buffer = isMusic ? station.current.buffer : def.clickEverySeconds ? ambientPulseBuffers.get(item.kind) : noiseBuffer;
          source.loop = true;
        }
        else { source.type = def.wave || 'sine'; source.frequency.value = def.frequency; }
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = isMusic ? def.lowpassHz : (def.filterHz ?? def.frequency * 2.5);
        const gain = ctx.createGain(); gain.gain.value = 0;
        const pan = ctx.createStereoPanner();
        source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(master);
        const nodes = [source, filter, gain, pan];
        let rate = 1;
        if (isMusic) {
          source.disconnect();
          const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = def.highpassHz;
          source.connect(highpass); highpass.connect(filter); nodes.push(highpass);
          // Tape wear (later rounds): the pitch sags and wobbles; the timeline runs at the sagged speed.
          const wobble = ctx.createOscillator(); wobble.frequency.value = radio.tapeWear.wobbleHz;
          const depth = ctx.createGain(); depth.gain.value = station.wear * radio.tapeWear.wobbleCents;
          wobble.connect(depth);
          if (source.detune) { depth.connect(source.detune); source.detune.value = wearCents(); }
          wobble.start(now);
          nodes.push(wobble, depth);
          rate = 2 ** (wearCents() / 1200);
          if (station.cursor < 0.05) onTrackChange?.(def);
        }
        source.start(now, isMusic ? station.cursor : def.clickEverySeconds ? now % def.clickEverySeconds : 0);
        voice = { source, gain, pan, nodes, kind: item.kind, startedAt: now, offset: isMusic ? station.cursor : 0, rate, def };
        ambientVoices.set(item.id, voice);
      }
      voice.pan.pan.setTargetAtTime(item.pan, now, cfg.fadeSeconds);
      voice.spatialGain = Math.max(0, item.gain);
      voice.gain.gain.setTargetAtTime(voice.spatialGain * def.gain * (isMusic ? audio.musicVolume * score.duck : audio.ambienceVolume), now, fadeIn);
    }
  }

  function stopDeathMusic() {
    if (!deathVoice) return;
    const voice = deathVoice;
    deathVoice = null;
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, deathMusic.stopFadeSeconds / 3);
    for (const source of voice.sources) source.stop(now + deathMusic.stopFadeSeconds);
    // A suspended context cannot advance the fade; disconnect so resuming cannot leak the old sting.
    if (ctx.state !== 'running') voice.gain.disconnect();
  }

  function playDeathMusic({ receiptAt } = {}) {
    stopDeathMusic();
    if (!ctx || ctx.state !== 'running') return;
    const gain = ctx.createGain();
    gain.gain.value = deathMusic.volume * audio.musicVolume;
    gain.connect(master);
    const voice = { gain, sources: [], remaining: deathMusic.layers.length };
    deathVoice = voice;
    const now = ctx.currentTime;
    for (const layer of deathMusic.layers) {
      const delay = (layer.delay ?? 0) + (layer.anchor === 'receipt' ? (receiptAt ?? 0) : 0);
      const source = playLayer(layer, now + delay, 1, 1, gain);
      voice.sources.push(source);
      const cleanup = source.onended;
      source.onended = () => {
        cleanup();
        if (--voice.remaining === 0) {
          gain.disconnect();
          if (deathVoice === voice) deathVoice = null;
        }
      };
    }
  }

  // ---- Last Call (config/closingMusic.js): the Closing Time round's music, straight to you (not through the speakers), looped.
  // Rendered once, when first wanted. While it is wanted the radio is ducked (score.duck, read by setAmbience).
  const score = { buffer: null, loading: false, wanted: false, voice: null, duck: 1 };
  function startScore() {
    if (!score.wanted || score.voice || !score.buffer || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(closingMusic.volume * audio.musicVolume, now, closingMusic.fadeInSeconds / 3);
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = score.buffer;
    source.loop = true;
    source.connect(gain);
    source.start(now);
    score.voice = { source, gain };
  }
  function playScore() {
    score.wanted = true;
    score.duck = closingMusic.radioDuck;
    if (!ctx) return;
    if (score.buffer) { startScore(); return; }
    if (score.loading) return;
    score.loading = true;
    Promise.resolve().then(() => renderMusic(closingMusic.track.id)).then(pcm => {
      const buffer = ctx.createBuffer(2, pcm.left.length, pcm.sampleRate);
      buffer.getChannelData(0).set(pcm.left);
      buffer.getChannelData(1).set(pcm.right);
      score.buffer = buffer;
      score.loading = false;
      startScore();
    }).catch(error => { score.loading = false; console.warn('Last Call could not be prepared:', error); });
  }
  /** Ends the score: faded out, or (resolve) cut short under a resolving chord on the same bus. */
  function stopScore({ resolve = false } = {}) {
    score.wanted = false;
    score.duck = 1;
    const voice = score.voice;
    score.voice = null;
    if (!voice) return;
    const now = ctx.currentTime;
    const seconds = resolve ? closingMusic.resolveFadeSeconds : closingMusic.fadeOutSeconds;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, seconds / 3);
    voice.source.stop(now + seconds);
    voice.source.onended = () => { voice.source.disconnect(); voice.gain.disconnect(); };
    if (resolve && ctx.state === 'running') {
      const chord = ctx.createGain();
      chord.gain.value = closingMusic.volume * audio.musicVolume;
      chord.connect(master);
      let remaining = closingMusic.resolve.length;
      for (const layer of closingMusic.resolve) {
        const source = playLayer(layer, now + (layer.delay ?? 0), 1, 1, chord);
        const cleanup = source.onended;
        source.onended = () => { cleanup(); if (--remaining === 0) chord.disconnect(); };
      }
    }
  }

  return {
    playDeathMusic,
    stopDeathMusic,
    playScore,
    stopScore,
    get scorePlaying() { return score.wanted; },
    setAmbience,
    // A new run: the next song in the rotation if it is ready (else this one again), from the top.
    resetMusic() {
      if (station.next) { station.current = station.next; station.next = null; }
      station.cursor = 0;
    },
    /** The song on the radio now: { id, title } or null. */
    get nowPlaying() { return station.current && { id: station.current.track.id, title: station.current.track.title }; },
    /** 0..1: how worn the tape sounds (main.js, from the round and the horror setting: audio/mallMusic.js tapeWear). */
    setTapeWear(amount) {
      const wear = Math.max(0, Math.min(1, amount));
      if (wear === station.wear) return;
      station.wear = wear;
      if (!ctx) return;
      const now = ctx.currentTime, voice = ambientVoices.get('mall_music');
      if (!voice) return;
      voice.offset = positionOf(voice, now); voice.startedAt = now; voice.rate = 2 ** (wearCents() / 1200);
      if (voice.source.detune) voice.source.detune.value = wearCents();
      voice.nodes.at(-1).gain.value = wear * radio.tapeWear.wobbleCents;
    },
    // The idle saver (core/idleSaver.js): the whole audio graph stops while nobody is there, and carries on from the same spot.
    setSleeping(sleeping) {
      if (!ctx) return;
      if (sleeping) ctx.suspend();
      else if (ctx.state === 'suspended') ctx.resume();
    },
    setMusicVolume(volume) {
      audio.musicVolume = volume;
      if (deathVoice) deathVoice.gain.gain.value = deathMusic.volume * volume;
      for (const voice of ambientVoices.values()) if (voice.kind === 'music') {
        voice.gain.gain.setTargetAtTime(voice.spatialGain * voice.def.gain * volume * score.duck, ctx.currentTime, atmosphere.ambience.fadeSeconds);
      }
      if (score.voice) score.voice.gain.gain.setTargetAtTime(closingMusic.volume * volume, ctx.currentTime, 0.05);
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
