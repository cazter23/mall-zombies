// =============================================================================
// AUDITION: 3D ZOMBIE SOUND (the top card of tools/audition.html). A top-down mini map with you in the middle (the arrow,
// facing up = ahead): drag the zombie round you and hear it move, through the REAL engine's positional voices
// (audio/sound.js, play with `spatial`) and the same maths the game uses (audio/spatial.js, config/spatialAudio.js).
// Toggles put it behind a wall, behind a closed shutter or upstairs; the floor menu changes what a footstep is on; Loop
// replays the sound at its own interval; Walk a circle carries it round you; Crowd adds the horde's murmur where it is.
// Measure 3D cost renders a busy round offline and prints how much of one core the audio takes.
// =============================================================================

import { spatialAudio } from '../src/config/spatialAudio.js';
import { zombieTypes, zombieSoundCues } from '../src/config/zombies.js';
import { bossTypes } from '../src/config/bosses.js';
import { audio } from '../src/config/audio.js';
import { toListener, distanceGain, occlusionOf, worseLevel } from '../src/audio/spatial.js';
import { createSound } from '../src/audio/sound.js';

const cfg = spatialAudio;
const EAR = 1.6; // your ears, m above the floor
const UPSTAIRS = 6.3; // the second floor

/** Every zombie sound the game places: [{ label, def }] (a type's sounds, the shared cues). */
function zombieSounds() {
  const out = [], seen = new Set();
  const add = (who, slot, def) => {
    const key = `${def.name}:${def.profile}`;
    if (!def?.name || seen.has(key)) return;
    seen.add(key); out.push({ label: `${who} · ${slot} (${def.name})`, def });
  };
  for (const type of Object.values(zombieTypes)) for (const [slot, def] of Object.entries(type.sounds ?? {})) add(type.id, slot, def);
  for (const [slot, def] of Object.entries(zombieSoundCues)) add('every zombie', slot, def);
  for (const type of Object.values(bossTypes)) for (const [slot, def] of Object.entries(type.sounds ?? {})) add(type.id, slot, def);
  return out;
}

export function mountSpatialAudition({ ensure, mount }) {
  const sounds = zombieSounds();
  const card = document.createElement('section');
  card.className = 'card wide';
  card.innerHTML = `
    <h2>3D zombie sound</h2>
    <div class="what headphones">🎧 <b>Use headphones.</b> You are the arrow (facing up = ahead). Drag the zombie (the dot) round you.
      Behind you, above you and to each side should be clear with your eyes shut.</div>
    <div class="spatial">
      <canvas id="sp-map" width="360" height="360"></canvas>
      <div class="sp-controls">
        <label>Sound <select id="sp-sound"></select></label>
        <div class="row"><button id="sp-play" class="primary">Play</button><button id="sp-loop">Loop</button>
          <button id="sp-orbit">Walk a circle</button><button id="sp-crowd">Crowd</button></div>
        <div class="row"><label><input type="checkbox" id="sp-wall"> Behind a wall</label>
          <label><input type="checkbox" id="sp-shutter"> Behind a closed shutter</label>
          <label><input type="checkbox" id="sp-up"> Upstairs</label></div>
        <div class="row"><label>Floor <select id="sp-floor"></select></label>
          <label>Crowd of <input type="range" id="sp-crowdN" min="4" max="40" step="1" value="16"> <span id="sp-crowdNv">16</span></label></div>
        <div class="row"><span class="seg" id="sp-mode"><button data-v="headphones" class="on">Headphones (HRTF)</button><button data-v="speakers">Speakers</button></span>
          <span class="seg" id="sp-quality"><button data-v="full" class="on">Full voices</button><button data-v="fewer">Fewer (Potato)</button></span></div>
        <div class="row"><button id="sp-measure">Measure 3D cost</button></div>
        <pre id="sp-readout"></pre>
        <pre id="sp-cost">Measure 3D cost renders 8 s of a busy round offline, four ways, and prints the cost here.</pre>
      </div>
    </div>`;
  mount.prepend(card);
  const $ = (id) => card.querySelector('#' + id);
  for (const [i, s] of sounds.entries()) $('sp-sound').insertAdjacentHTML('beforeend', `<option value="${i}">${s.label}</option>`);
  for (const id of Object.keys(cfg.surfaces)) $('sp-floor').insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);

  // ---- State: the zombie's spot (metres: x right, z down the screen = behind you) ----------------------------------
  const state = { x: -4, z: -3, loop: null, orbit: false, orbitAt: 0, crowd: false };
  const pick = () => sounds[Number($('sp-sound').value)];
  const profileOf = (def) => ({ ...(cfg.profiles[def.profile] ?? cfg.profiles.body), ...(def.maxDistance ? { max: def.maxDistance } : {}) });
  const isStep = (def) => def.profile === 'step' || def.profile === 'heavy';
  const listener = { x: 0, y: EAR, z: 0, yaw: 0, pitch: 0 };
  function level() {
    let l = $('sp-shutter').checked ? 'closed' : $('sp-wall').checked ? 'far' : 'clear';
    if ($('sp-up').checked && l !== 'clear') l = worseLevel(l, 'far'); // (the other floor, in another area: as the game does)
    return l;
  }
  function point(def) {
    const floor = $('sp-up').checked ? UPSTAIRS : 0;
    return { x: state.x, y: floor + (isStep(def) ? 0.1 : 1.45), z: state.z };
  }
  /** What the game's stage would hand the engine for this sound now (game/soundStage.js place). */
  function placeFor(def, out = {}) {
    const p = point(def), profile = profileOf(def);
    toListener(listener, p, out);
    const d = Math.hypot(p.x - listener.x, p.y - listener.y, p.z - listener.z);
    const dg = distanceGain(d, profile), lvl = level(), occ = occlusionOf(lvl);
    const surf = isStep(def) ? cfg.surfaces[$('sp-floor').value] : null;
    out.gain = dg * occ.gain * (surf?.gain ?? 1);
    out.cutoffHz = Math.min(occ.cutoffHz, surf?.cutoffHz ?? 20000);
    out.sendScale = occ.gain * dg ** cfg.sendDistanceExponent;
    out.room = null; out.level = lvl; out.distance = d;
    return out;
  }

  function playOnce() {
    const { engine } = ensure();
    const s = pick(), def = s.def;
    const surface = $('sp-floor').value;
    const name = isStep(def) && audio.sounds[`${def.name}@${surface}`] ? `${def.name}@${surface}` : def.name;
    const profile = profileOf(def);
    engine.play(name, { pitch: isStep(def) ? cfg.surfaces[surface].pitch : 1, spatial: { priority: profile.priority, place: (out) => placeFor(def, out) } });
  }
  $('sp-play').onclick = playOnce;
  $('sp-loop').onclick = () => {
    if (state.loop) { clearInterval(state.loop); state.loop = null; } else {
      playOnce();
      state.loop = setInterval(playOnce, 1000 * (pick().def.interval ?? cfg.audition.loopSeconds));
    }
    $('sp-loop').classList.toggle('on', !!state.loop);
  };
  $('sp-sound').onchange = () => { if (state.loop) { $('sp-loop').onclick(); $('sp-loop').onclick(); } };
  $('sp-orbit').onclick = () => { state.orbit = !state.orbit; state.orbitAt = Math.atan2(state.z, state.x); $('sp-orbit').classList.toggle('on', state.orbit); };
  $('sp-crowd').onclick = () => { state.crowd = !state.crowd; $('sp-crowd').classList.toggle('on', state.crowd); };
  $('sp-crowdN').oninput = () => { $('sp-crowdNv').textContent = $('sp-crowdN').value; };
  for (const [seg, key] of [['sp-mode', 'mode'], ['sp-quality', 'quality']]) for (const b of $(seg).querySelectorAll('button')) b.onclick = () => {
    cfg[key] = b.dataset.v;
    for (const o of $(seg).querySelectorAll('button')) o.classList.toggle('on', o === b);
    ensure().engine.setSpatial();
  };

  // ---- The map: drag the dot ----------------------------------------------------------------------------------------
  const canvas = $('sp-map'), g = canvas.getContext('2d');
  const scale = () => canvas.width / cfg.audition.mapMeters; // px per metre
  const toWorld = (ev) => {
    const r = canvas.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (canvas.width / r.width), py = (ev.clientY - r.top) * (canvas.height / r.height);
    return { x: (px - canvas.width / 2) / scale(), z: (py - canvas.height / 2) / scale() };
  };
  let dragging = false;
  canvas.onpointerdown = (ev) => { dragging = true; canvas.setPointerCapture(ev.pointerId); Object.assign(state, toWorld(ev)); state.orbit = false; $('sp-orbit').classList.remove('on'); };
  canvas.onpointermove = (ev) => { if (dragging) Object.assign(state, toWorld(ev)); };
  canvas.onpointerup = () => { dragging = false; };

  function draw() {
    const w = canvas.width, c = w / 2, k = scale();
    g.fillStyle = '#0f0c12'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#2c2436'; g.lineWidth = 1;
    for (let r = 5; r * k < w; r += 5) { g.beginPath(); g.arc(c, c, r * k, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#6f6480'; g.font = '11px system-ui';
    for (let r = 5; r * k < c; r += 5) g.fillText(`${r} m`, c + 3, c - r * k - 3);
    g.fillText('ahead', c - 14, 12); g.fillText('behind', c - 17, w - 5); g.fillText('left', 4, c - 4); g.fillText('right', w - 28, c - 4);
    // The selected sound's range (silent past it).
    const def = pick().def, profile = profileOf(def);
    g.setLineDash([4, 4]); g.strokeStyle = '#ff8f5a66'; g.beginPath(); g.arc(c, c, profile.max * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // A wall or shutter between you and it.
    const zx = c + state.x * k, zy = c + state.z * k;
    if ($('sp-wall').checked || $('sp-shutter').checked) {
      const mx = (c + zx) / 2, my = (c + zy) / 2, ang = Math.atan2(zy - c, zx - c) + Math.PI / 2;
      g.strokeStyle = $('sp-shutter').checked ? '#c9ccd1' : '#8a7f95'; g.lineWidth = $('sp-shutter').checked ? 5 : 4;
      g.beginPath(); g.moveTo(mx - Math.cos(ang) * 40, my - Math.sin(ang) * 40); g.lineTo(mx + Math.cos(ang) * 40, my + Math.sin(ang) * 40); g.stroke();
    }
    // You.
    g.fillStyle = '#ffcf5a'; g.beginPath(); g.moveTo(c, c - 12); g.lineTo(c - 8, c + 8); g.lineTo(c, c + 4); g.lineTo(c + 8, c + 8); g.closePath(); g.fill();
    // It (hollow when upstairs).
    g.lineWidth = 3; g.strokeStyle = g.fillStyle = '#ff4f6a';
    g.beginPath(); g.arc(zx, zy, 9, 0, Math.PI * 2);
    if ($('sp-up').checked) { g.stroke(); g.fillText('↑ upstairs', zx + 12, zy + 4); } else g.fill();
  }

  function readout() {
    const def = pick().def, p = placeFor(def);
    const side = Math.abs(p.x) < 0.05 ? 'centre' : `${Math.abs(p.x).toFixed(1)} m ${p.x < 0 ? 'left' : 'right'}`;
    const front = `${Math.abs(p.z).toFixed(1)} m ${p.z > 0 ? 'behind' : 'ahead'}`;
    const db = p.gain > 0 ? `${(20 * Math.log10(p.gain)).toFixed(1)} dB` : 'silent (out of range)';
    const stats = ensure.started?.() ? ensure().engine.spatialStats : null;
    $('sp-readout').textContent = `${side}, ${front}${$('sp-up').checked ? ', above' : ''} · ${p.distance.toFixed(1)} m · level ${db} · ${p.level}`
      + ` · muffle ${Math.round(p.cutoffHz)} Hz\nprofile ${def.profile} (max ${profileOf(def).max} m, priority ${profileOf(def).priority})`
      + (stats ? ` · voices ${stats.voices}/${stats.max} · ${stats.hrtf ? 'HRTF' : 'stereo'}` : '');
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (state.orbit) {
      state.orbitAt += (dt * Math.PI * 2) / cfg.audition.orbitSeconds;
      state.x = Math.cos(state.orbitAt) * cfg.audition.orbitMeters; state.z = Math.sin(state.orbitAt) * cfg.audition.orbitMeters;
    }
    if (ensure.started?.()) {
      const { engine } = ensure();
      engine.updateSpatial();
      // The horde where the dot is: as game/soundStage.js builds it (N zombies there, after walls).
      const c = cfg.crowd, n = Number($('sp-crowdN').value);
      if (state.crowd) {
        const p = placeFor({ profile: 'voice', maxDistance: c.range });
        const len = Math.hypot(p.x, p.y, p.z) || 1;
        engine.setCrowd({ gain: c.maxGain * (1 - Math.exp(-(n * p.gain) / c.knee)), x: (p.x / len) * c.distance, y: (p.y / len) * c.distance, z: (p.z / len) * c.distance, cutoffHz: p.cutoffHz });
      } else engine.setCrowd({ gain: 0 });
    }
    draw(); readout();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- Measure 3D cost: a busy round rendered offline -----------------------------------------------------------------
  // Every 0.12 s a zombie sound somewhere round you (shuffles, groans, thumps, lunges, in three rooms), the voice cap working,
  // the crowd bed on, positions moving. OfflineAudioContext renders as fast as it can on one thread: N x real time means the
  // audio takes about 1/N of one core. Compared with the same plays not positional at all, and with plain stereo.
  async function renderBusy({ positional, hrtf, quality = 'full', seconds = 8 }) {
    const RATE = 48000, off = new OfflineAudioContext(2, seconds * RATE, RATE);
    const saved = { mode: cfg.mode, quality: cfg.quality };
    cfg.mode = hrtf ? 'headphones' : 'speakers'; cfg.quality = quality;
    const eng = createSound({ context: off });
    eng.unlock(); eng.setMasterVolume(audio.masterVolume); eng.setRoom('atrium', { now: true });
    Object.assign(cfg, saved);
    const mix = [['shopperShuffle', 'step'], ['shopperGroan', 'voice'], ['mascotThump', 'heavy'], ['shopperShuffle', 'step'], ['zombieLunge', 'cue'], ['cartSqueak', 'step']];
    const rooms = ['atrium', 'cinema', 'store'];
    let i = 0;
    const step = 0.25;
    for (let t = 0; t < seconds - step; t += step) {
      off.suspend(t).then(() => {
        for (let k = 0; k < step / 0.12; k++) {
          const [name, prof] = mix[i % mix.length], a = i * 2.4, r = 2 + (i % 9) * 2.2, room = rooms[i % 3];
          i++;
          const spot = { x: Math.cos(a) * r, y: (i % 5 === 0 ? 6 : 0) - EAR + 1.4, z: Math.sin(a) * r };
          const g0 = distanceGain(r, cfg.profiles[prof]);
          if (positional) eng.play(name, { at: t + k * 0.12, spatial: { priority: cfg.profiles[prof].priority, place: (o) => Object.assign(o, spot, { gain: g0, cutoffHz: i % 4 ? 20000 : 1300, sendScale: 0.8, room }) } });
          else eng.play(name, { at: t + k * 0.12, volume: g0 });
        }
        if (positional) { eng.updateSpatial(); eng.setCrowd({ gain: 0.25, x: Math.cos(t) * 3, y: 0, z: Math.sin(t) * 3, cutoffHz: 4000 }); }
        off.resume();
      });
    }
    const t0 = performance.now();
    await off.startRendering();
    const ms = performance.now() - t0;
    return { ms, realtime: (seconds * 1000) / ms, stats: positional ? eng.spatialStats : null };
  }
  $('sp-measure').onclick = async () => {
    $('sp-cost').textContent = 'Measuring (8 s of a busy round, four ways)…';
    const plain = await renderBusy({ positional: false });
    const fewer = await renderBusy({ positional: true, hrtf: false, quality: 'fewer' });
    const stereo = await renderBusy({ positional: true, hrtf: false });
    const hrtf = await renderBusy({ positional: true, hrtf: true });
    const line = (label, r) => `${label.padEnd(34)} ${r.ms.toFixed(0).padStart(5)} ms = ${r.realtime.toFixed(1)}x real time (~${(100 / r.realtime).toFixed(1)}% of one core)`;
    const text = [line('not positional (the old way)', plain), line('positional, Fewer (Potato)', fewer),
      line('positional, Full, Speakers', stereo), line('positional, Full, Headphones (HRTF)', hrtf),
      `voices at the end: ${hrtf.stats.voices}/${hrtf.stats.max}, dropped ${hrtf.stats.dropped}, extra rooms ${hrtf.stats.rooms.join(', ') || 'none'}`].join('\n');
    $('sp-cost').textContent = text;
    window.__spatialCost = { plain, fewer, stereo, hrtf };
  };
  window.__spatialRender = renderBusy; // (repeat a case from the console: timings in a hidden or busy tab are noisy)
}
