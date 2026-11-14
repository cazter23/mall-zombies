// =============================================================================
// SOUND
// Plays the synthesized sounds from config/audio.js with the Web Audio API.
// Each play() builds its layers on the fly (noise bursts, tones, clicks, metallic
// partials, FM), so there are no audio files and no loading. The recipe format is
// at the top of config/audio.js; audio/recipes.js reads it.
//
// The graph: every play is one VOICE (its layers -> its parts -> optional drive ->
// its volume -> optional pan) going dry to the master bus and, by its `send`, into
// the shared room reverb (two convolvers, crossfaded when the room changes; their
// impulses come from audio/roomImpulse.js). Master -> compressor -> limiter ->
// soft clip -> speakers. Voices are capped per sound and in total: the oldest is
// stolen (a short fade), so rapid fire never piles up tails.
//
// Browsers only allow audio after the player clicks or presses a key, so the
// audio context is created/resumed on the first such input. Sounds played before
// that are silently skipped.
// =============================================================================

import { audio } from '../config/audio.js';
import { soundUpgrades } from '../config/gunSounds.js';
import { normalizeRecipe, resolveVariant, variantKey, driveCurve, driveMakeup, softClipCurve } from './recipes.js';
import { roomImpulse } from './roomImpulse.js';
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
 * @param context       an AudioContext / OfflineAudioContext to play into instead of making one (tools/audition.html)
 * @param recipes       the recipe table (default audio.sounds; the audition page passes the old one for its Old/New toggle)
 * @param reverb        false = no room reverb at all (the audition's "old" engine)
 */
export function createSound({ renderMusic = renderMusicInWorker, random = Math.random, onTrackChange = null,
  context = null, recipes = audio.sounds, reverb: reverbAllowed = true } = {}) {
  let ctx = null;
  let master = null;
  let world = null; // (the ducked bus: see unlock)
  let noiseBuffer = null;
  const isOffline = () => typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const canPlay = () => !!ctx && (ctx.state === 'running' || isOffline());
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
  function makeCompressor({ thresholdDb, ratio, attack, release, kneeDb }) {
    const node = ctx.createDynamicsCompressor();
    node.threshold.value = thresholdDb;
    node.ratio.value = ratio;
    if (node.attack) node.attack.value = attack;
    if (node.release) node.release.value = release;
    if (node.knee) node.knee.value = kneeDb;
    return node;
  }

  function unlock() {
    if (!ctx) {
      if (context) ctx = context;
      else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        ctx = new AudioContextClass();
      }
      // A gentle compressor on the master bus keeps rapid fire from clipping; a fast limiter after it catches what the
      // compressor lets through, and a soft clip (where the browser has WaveShaper) keeps the very last peak under 0 dBFS.
      const compressor = makeCompressor(audio.compressor);
      const limiter = makeCompressor(audio.limiter);
      master = ctx.createGain();
      master.gain.value = audio.masterVolume;
      master.connect(compressor);
      // Everything plays through `world`, which a big shot dips for a moment (a recipe's `duck`); the ducking shot itself
      // and the hit sounds (`duckExempt`) go straight to master, so they stand out against the dip.
      world = ctx.createGain();
      world.connect(master);
      compressor.connect(limiter);
      if (ctx.createWaveShaper) {
        const clip = ctx.createWaveShaper();
        clip.curve = softClipCurve(audio.softClip);
        limiter.connect(clip);
        clip.connect(ctx.destination);
      } else limiter.connect(ctx.destination);
      noiseBuffer = makeNoiseBuffer();
    }
    if (ctx.state === 'suspended' && !isOffline()) ctx.resume();
  }
  if (typeof window !== 'undefined' && window.addEventListener) for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock);

  // Volume envelope: quick rise to `peak`, then an exponential fade to silence.
  function envelope(param, start, peak, attack, decay) {
    param.setValueAtTime(0.0001, start);
    param.linearRampToValueAtTime(peak, start + attack);
    param.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  function playLayer(layer, start, volume, pitch, destination = world) {
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

  // ---- Voices: one play of a recipe (play, playAmbient) -----------------------------------------------------------

  const voicesByKey = new Map(); // sound name -> its live voices, oldest first
  const liveVoices = []; // every live voice, oldest first
  const resolved = new Map(); // name + variant -> resolved recipe
  const flavourCount = new Map(); // name -> plays with a stuffing so far (flavourEvery)
  const clickBuffers = new Map();
  const shaperMakeup = (amount) => driveMakeup(amount);

  // A few ms of shaped noise (a crack) or a near-impulse (a tick), reused by every click layer: four of each, one picked
  // per play, so a held trigger never repeats the same crack.
  function clickBuffer(shape, ms) {
    const key = `${shape}:${ms}:${Math.floor(Math.random() * 4)}`;
    if (clickBuffers.has(key)) return clickBuffers.get(key);
    const length = Math.max(2, Math.round(ctx.sampleRate * ms / 1000));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (shape === 'impulse') { data[0] = 1; data[1] = -0.4 - Math.random() * 0.3; data[2] = Math.random() * 0.3; }
    else {
      const rise = Math.max(1, Math.round(length * 0.06));
      for (let i = 0; i < length; i++) {
        const fall = (1 - i / length) ** 2.2;
        data[i] = (Math.random() * 2 - 1) * fall * Math.min(1, (i + 1) / rise);
      }
    }
    clickBuffers.set(key, buffer);
    return buffer;
  }

  function makeShaper(amount, nodes) {
    if (!(amount > 0) || !ctx.createWaveShaper) return null;
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(amount);
    nodes.push(shaper);
    return shaper;
  }

  const jitter = (amount) => (amount ? 1 + (Math.random() * 2 - 1) * amount : 1);

  /** Schedules one layer of a voice into `dest`. Returns when it ends (seconds, context time). */
  function startLayer(layer, start, pitch, dest, voice, fallbackVary) {
    const v = layer.vary ?? fallbackVary;
    const p = pitch * jitter(v?.pitch);
    const peak = Math.max(0.0001, layer.gain * jitter(v?.gain));
    const decay = Math.max(0.001, layer.decay * jitter(v?.decay));
    const fq = jitter(v?.freq);
    const s = start + layer.delay * jitter(v?.delay);
    const attack = layer.attack;
    const end = s + attack + decay + 0.02;
    const { nodes } = voice;
    const track = (source) => { voice.sources.push(source); source.onended = () => voice.ended(); };

    // The layer's level (and its own drive, if any) into the part.
    const gain = ctx.createGain();
    nodes.push(gain);
    const shaper = makeShaper(layer.drive, nodes);
    if (shaper) {
      const makeup = ctx.createGain(); nodes.push(makeup);
      makeup.gain.value = shaperMakeup(layer.drive);
      gain.connect(shaper); shaper.connect(makeup); makeup.connect(dest);
    } else gain.connect(dest);

    if (layer.type === 'click') {
      gain.gain.value = peak;
      const source = ctx.createBufferSource();
      source.buffer = clickBuffer(layer.shape, layer.ms);
      nodes.push(source);
      if (layer.filter) {
        const filter = ctx.createBiquadFilter(); nodes.push(filter);
        filter.type = layer.filter; filter.frequency.value = layer.freq * p * fq; filter.Q.value = layer.q ?? 1;
        source.connect(filter); filter.connect(gain);
      } else source.connect(gain);
      source.start(s);
      source.stop(s + layer.ms / 1000 + 0.01);
      track(source);
      return s + layer.ms / 1000 + 0.01;
    }

    envelope(gain.gain, s, peak, attack, decay);
    // (freqTime: the sweep reaches its end in that long, then holds there: a kick's fast drop then its low thud)
    const sweepEnd = s + (layer.freqTime ?? attack + decay);
    const sweepTo = (param, from, to) => {
      param.setValueAtTime(from, s);
      if (to) param.exponentialRampToValueAtTime(to, sweepEnd);
    };

    if (layer.type === 'noise') {
      const source = ctx.createBufferSource(); nodes.push(source);
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter(); nodes.push(filter);
      filter.type = layer.filter;
      if (layer.freqEnd) sweepTo(filter.frequency, layer.freq * p * fq, layer.freqEnd * p * fq);
      else filter.frequency.value = layer.freq * p * fq;
      filter.Q.value = layer.q ?? 1;
      source.connect(filter); filter.connect(gain);
      source.start(s, Math.random() * 0.5); // (somewhere random in the noise, so repeats aren't identical)
      source.stop(end);
      track(source);
    } else if (layer.type === 'tone') {
      const source = ctx.createOscillator(); nodes.push(source);
      source.type = layer.wave;
      sweepTo(source.frequency, layer.freq * p, layer.freqEnd && layer.freqEnd * p);
      source.connect(gain);
      source.start(s); source.stop(end);
      track(source);
    } else if (layer.type === 'metal') {
      // Inharmonic partials (a spring, a struck bolt, a bell): each its own oscillator with a fade that shortens up the series.
      const ratios = layer.ratios, sweep = layer.freqEnd ? layer.freqEnd / layer.freq : null;
      for (let i = 0; i < ratios.length; i++) {
        const osc = ctx.createOscillator(); nodes.push(osc);
        osc.type = layer.wave ?? 'sine';
        const f = layer.freq * ratios[i] * p;
        sweepTo(osc.frequency, f, sweep && f * sweep);
        if (layer.detune && osc.detune) osc.detune.value = layer.detune * (i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.25);
        const pg = ctx.createGain(); nodes.push(pg);
        const partialDecay = decay * (layer.partialDecay ?? 0.8) ** i;
        envelope(pg.gain, s, (layer.gains?.[i] ?? 1) / ratios.length, attack, partialDecay);
        osc.connect(pg); pg.connect(gain);
        osc.start(s); osc.stop(end);
        track(osc);
      }
    } else if (layer.type === 'fm') {
      // FM: a modulator wobbling the carrier's frequency; a falling index = a twang or a boing, a high one = a rattle or a buzz.
      const carrier = ctx.createOscillator(); nodes.push(carrier);
      carrier.type = layer.wave ?? 'sine';
      const f = layer.freq * p, fEnd = layer.freqEnd && layer.freqEnd * p;
      sweepTo(carrier.frequency, f, fEnd);
      const mod = ctx.createOscillator(); nodes.push(mod);
      mod.type = layer.modWave ?? 'sine';
      sweepTo(mod.frequency, f * layer.ratio, fEnd && fEnd * layer.ratio);
      const depth = ctx.createGain(); nodes.push(depth);
      depth.gain.setValueAtTime(layer.index * f * layer.ratio, s);
      if (layer.indexEnd !== undefined) depth.gain.linearRampToValueAtTime(layer.indexEnd * f * layer.ratio, s + attack + decay);
      mod.connect(depth); depth.connect(carrier.frequency);
      carrier.connect(gain);
      mod.start(s); carrier.start(s); mod.stop(end); carrier.stop(end);
      track(carrier); track(mod);
    }
    return end;
  }

  function forget(voice) {
    const list = voicesByKey.get(voice.key);
    if (list) { const i = list.indexOf(voice); if (i !== -1) list.splice(i, 1); }
    const j = liveVoices.indexOf(voice); if (j !== -1) liveVoices.splice(j, 1);
  }

  // Stealing: a quick fade, then every source stops (ones not started yet never play).
  function steal(voice, when = ctx.currentTime) {
    if (voice.stolen) return;
    voice.stolen = true;
    forget(voice);
    const fade = audio.voices.stealFadeSeconds;
    voice.out.gain.cancelScheduledValues(when);
    voice.out.gain.setTargetAtTime(0, when, fade / 3);
    for (const source of voice.sources) source.stop(when + fade * 2);
  }

  /**
   * One play of a recipe: its parts, drive, volume, pan, and its send into the room.
   * Returns { stop() } (or null when audio can't play).
   */
  function playRecipe(key, recipe, { volume = 1, pan = 0, panned = false, side = null, at = null, pitch: pitchScale = 1, step = 0, destination = world, send = true } = {}) {
    const start = Math.max(at ?? ctx.currentTime, ctx.currentTime);
    const cap = recipe.maxVoices ?? audio.voices.perSound;
    let list = voicesByKey.get(key);
    if (!list) voicesByKey.set(key, (list = []));
    while (list.length >= cap) steal(list[0], start);
    while (liveVoices.length >= audio.voices.total) steal(liveVoices[0], start);

    const variation = recipe.pitchVariation ?? audio.pitchVariation;
    const pitch = (1 + (Math.random() * 2 - 1) * variation) * pitchScale * (1 + recipe.pitchStep) ** step;
    // (sidePan: a play from the left or right gun of a pair sits that far over: BOGO's two guns)
    if (recipe.sidePan && side) pan += (side === 'left' ? -1 : 1) * recipe.sidePan;
    const nodes = [];
    const voice = { key, nodes, sources: [], out: null, stolen: false, remaining: 0, ended: null };
    const out = ctx.createGain(); nodes.push(out);
    voice.out = out;
    out.gain.value = recipe.volume * volume * (recipe.drive > 0 && ctx.createWaveShaper ? shaperMakeup(recipe.drive) : 1);
    // Whole-sound drive sits before the volume, so a distant (quieter) shot crunches the same as a close one.
    const shaper = makeShaper(recipe.drive, nodes);
    const input = shaper ?? out;
    if (shaper) shaper.connect(out);
    let tail = out;
    if ((pan || panned) && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner(); nodes.push(panner);
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(panner); tail = panner;
    }
    const exempt = recipe.duck || recipe.duckExempt;
    tail.connect(exempt && destination === world ? master : destination);
    if (recipe.duck && world) duck(recipe.duck, start);
    const room = send && recipe.send > 0 ? ensureReverb() : null;
    if (room) {
      const sendGain = ctx.createGain(); nodes.push(sendGain);
      sendGain.gain.value = recipe.send;
      tail.connect(sendGain); sendGain.connect(room);
    }

    for (const part of recipe.parts) {
      let dest = input;
      if (part.gain !== 1 || part.drive > 0) {
        const partGain = ctx.createGain(); nodes.push(partGain);
        const partShaper = makeShaper(part.drive, nodes);
        partGain.gain.value = part.gain * (partShaper ? shaperMakeup(part.drive) : 1);
        if (partShaper) { partShaper.connect(partGain); dest = partShaper; } else dest = partGain;
        partGain.connect(input);
      }
      for (const layer of part.layers) startLayer(layer, start, pitch, dest, voice, recipe.vary);
    }
    voice.remaining = voice.sources.length;
    voice.ended = () => {
      if (--voice.remaining > 0) return;
      for (const node of nodes) node.disconnect();
      forget(voice);
    };
    if (voice.remaining === 0) { for (const node of nodes) node.disconnect(); return null; }
    list.push(voice);
    liveVoices.push(voice);
    return { stop: () => { if (!voice.stolen && voice.remaining > 0) steal(voice); } };
  }

  /** A big shot's dip of everything else: down by `db` in a few ms, back over `seconds`. A newer duck replaces an older one. */
  function duck({ db, seconds }, start) {
    const g = world.gain;
    g.cancelScheduledValues(start);
    g.setTargetAtTime(10 ** (-db / 20), start, 0.003);
    g.setTargetAtTime(1, start + 0.02, seconds / 3);
  }

  /** The recipe a sound name plays with a variant (upgrade tier, stuffing, low ammo), cached. */
  function recipeFor(name, variant) {
    const def = recipes[name];
    if (!def) return null;
    const vKey = variantKey(variant);
    const key = vKey ? `${name}#${vKey}` : name;
    let recipe = resolved.get(key);
    if (!recipe) {
      recipe = resolveVariant(normalizeRecipe(def), variant, soundUpgrades);
      resolved.set(key, recipe);
    }
    return recipe;
  }

  // ---- The room: one shared reverb, two convolvers crossfaded on a room change ----------------------------------

  const reverb = { input: null, slots: [], active: -1, room: null, wanted: audio.reverb.defaultRoom, enabled: audio.reverb.enabled !== false, switchedAt: -Infinity };
  const impulses = new Map();
  function impulseFor(roomId) {
    if (impulses.has(roomId)) return impulses.get(roomId);
    const pcm = roomImpulse(audio.rooms[roomId], ctx.sampleRate);
    const buffer = ctx.createBuffer(2, pcm.left.length, ctx.sampleRate);
    buffer.getChannelData(0).set(pcm.left);
    buffer.getChannelData(1).set(pcm.right);
    impulses.set(roomId, buffer);
    return buffer;
  }
  function ensureReverb() {
    if (!reverbAllowed || !reverb.enabled || !ctx?.createConvolver) return null;
    if (!reverb.input) {
      reverb.input = ctx.createGain();
      for (let i = 0; i < 2; i++) {
        const conv = ctx.createConvolver();
        conv.normalize = false;
        const out = ctx.createGain();
        out.gain.value = 0;
        conv.connect(out);
        out.connect(world);
        reverb.slots.push({ conv, out, room: null, fed: false });
      }
      switchRoom(true);
    }
    return reverb.input;
  }
  function switchRoom(instant = false) {
    const roomId = reverb.wanted;
    if (roomId === reverb.room || !reverb.input) return;
    const now = ctx.currentTime, fade = instant ? 0.005 : audio.reverb.crossfadeSeconds;
    const old = reverb.slots[reverb.active];
    const next = reverb.slots[reverb.active === 0 ? 1 : 0];
    if (next.room !== roomId) { next.conv.buffer = impulseFor(roomId); next.room = roomId; }
    if (!next.fed) { reverb.input.connect(next.conv); next.fed = true; }
    next.out.gain.cancelScheduledValues(now);
    next.out.gain.setTargetAtTime(audio.rooms[roomId].wet, now, fade / 3);
    if (old) {
      old.out.gain.cancelScheduledValues(now);
      old.out.gain.setTargetAtTime(0, now, fade / 3);
      // Once it has faded, stop feeding it (a silent convolver still costs CPU).
      const unfeed = () => { if (reverb.slots[reverb.active] !== old && old.fed) { reverb.input.disconnect(old.conv); old.fed = false; } };
      if (instant || isOffline()) unfeed(); else setTimeout(unfeed, fade * 2000);
    }
    reverb.active = reverb.slots.indexOf(next);
    reverb.room = roomId;
    reverb.switchedAt = now;
  }
  /** The room the player is in (a grade-zone id: map.gradeZones, or null for the hallway). Cheap to call every frame. */
  function setRoom(zoneId, { now = false } = {}) {
    reverb.wanted = audio.roomOf[zoneId] ?? audio.reverb.defaultRoom;
    if (now) { if (ctx && reverb.input) switchRoom(true); return; } // (the audition page: switch at once)
    // (A switch waits for the previous crossfade to finish, so a quick back-and-forth never swaps a buffer that is still audible.)
    if (ctx && reverb.input && reverb.wanted !== reverb.room && ctx.currentTime - reverb.switchedAt > audio.reverb.crossfadeSeconds * 2) switchRoom();
  }
  /** Settings > Audio > Room echo. Off: no sends, and the convolvers go silent and unfed. */
  function setReverbEnabled(on) {
    reverb.enabled = !!on;
    if (!reverb.input) return;
    const now = ctx.currentTime;
    for (const slot of reverb.slots) {
      slot.out.gain.cancelScheduledValues(now);
      slot.out.gain.setTargetAtTime(on && slot === reverb.slots[reverb.active] ? audio.rooms[reverb.room].wet : 0, now, 0.05);
      if (!on && slot.fed) { reverb.input.disconnect(slot.conv); slot.fed = false; }
    }
    if (on) { const slot = reverb.slots[reverb.active]; if (slot && !slot.fed) { reverb.input.connect(slot.conv); slot.fed = true; } }
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
        source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(world);
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
    gain.connect(world);
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
    gain.connect(world);
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
      chord.connect(world);
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
    /** A positional world sound (game/ambience.js): panned, at the ambience volume, no pitch wobble. */
    playAmbient(name, { volume = 1, pan = 0 } = {}) {
      const recipe = recipeFor(name);
      if (!recipe || !canPlay()) return null;
      return playRecipe(name, { ...recipe, pitchVariation: 0 }, { volume: volume * audio.ambienceVolume, pan, panned: true });
    },
    /**
     * Play a sound by name (see config/audio.js).
     * @param volume  scales it (0..1+)
     * @param pan     -1..1
     * @param side    'left' | 'right': which gun of a pair fired (the recipe's sidePan places it)
     * @param pitch   a pitch multiplier on top of the recipe
     * @param step    how far along a chain this play is (the Tennis Ball's bounces): pitch x (1 + recipe.pitchStep) ^ step
     * @param variant { tier, renewals, stuffing, lowAmmo } (config/gunSounds.js soundUpgrades), for a gun's shot
     * @param at      context time to start (offline renders); default now
     * @returns { stop() } so a sound can be cut short (the scanner's whine on a released scan), or null
     */
    play(name, { volume = 1, pan = 0, side = null, pitch = 1, step = 0, variant = null, at = null } = {}) {
      // (flavourEvery: an automatic gun's build flavour rides on every Nth shot, not all of them: clearer, and cheaper)
      if (variant?.stuffing && recipes[name]) {
        const every = normalizeRecipe(recipes[name]).flavourEvery;
        if (every > 1) {
          const n = (flavourCount.get(name) ?? 0) + 1;
          flavourCount.set(name, n);
          if (n % every) variant = { ...variant, stuffing: null };
        }
      }
      const recipe = recipeFor(name, variant);
      if (!recipe || !canPlay()) return null;
      return playRecipe(name, recipe, { volume, pan, side, pitch, step, at });
    },
    setRoom,
    setReverbEnabled,
    /** The room preset the reverb is in now (config/audio.js rooms), or the one it will start in. */
    get room() { return reverb.room ?? reverb.wanted; },
    /** How many voices are playing (the audition page and the tests watch it). */
    get voiceCount() { return liveVoices.length; },
    /** The context once unlocked (the audition page renders through it). */
    get context() { return ctx; },

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
