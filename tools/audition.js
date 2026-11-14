// =============================================================================
// AUDITION (dev only: tools/audition.html under npm run dev)
// Every gun's sounds through the REAL engine (audio/sound.js): fire, rapid fire at the gun's real rate (the game's own
// Weapon class decides when each shot goes off, scheduled ahead so the timing is exact), dry fire, each reload step and
// the whole reload at its real timing, impacts, the hit feedback, every tier/renewal/build and low ammo, in any room,
// against the OLD recipes (tools/auditionLegacy.js, through an engine with no reverb).
// Measure renders every sound offline (OfflineAudioContext) and prints peak, loudness, length, brightness and the
// pairs of guns that sound most alike, plus a stress render of the fastest gun.
// =============================================================================

import { createSound } from '../src/audio/sound.js';
import { audio } from '../src/config/audio.js';
import { weapons, melee } from '../src/config/weapons.js';
import { workshopStuffings, workshopBuilds } from '../src/config/workshop.js';
import { Weapon } from '../src/weapons/weapon.js';
import { legacySounds } from './auditionLegacy.js';
import { gunSounds as gunSoundsTable } from '../src/config/gunSounds.js';
// The new engine's table (a page-only recipe can be added here to compare by ear, as the punch takes were).
const newTable = { ...audio.sounds };

const TICK = 1 / 60;
const $ = (id) => document.getElementById(id);
const oldTable = { ...audio.sounds, ...legacySounds };
// Names the old recipes never had: what the old game played instead.
const OLD_ALIAS = { sentryShot: 'stapleShot', partyTrapBlast: 'confettiShot' };
const oldName = (name) => (legacySounds[name] ? name : OLD_ALIAS[name] ?? (/Dry$/.test(name) ? 'dryClick' : name));

let ctx = null, engines = null, mode = 'new';
function start() {
  if (ctx) { ctx.resume(); return; }
  ctx = new AudioContext();
  engines = { new: createSound({ context: ctx, recipes: newTable }), old: createSound({ context: ctx, recipes: oldTable, reverb: false }) };
  engines.new.unlock(); engines.old.unlock();
  setVolume(); setRoom();
  $('unlock').textContent = 'Audio on';
}
const engine = () => engines?.[mode];
function setVolume() { if (engines) for (const e of Object.values(engines)) e.setMasterVolume(Number($('volume').value)); }
function setRoom() { engines?.new.setRoom($('room').value === 'front' ? null : $('room').value, { now: true }); }

function variant() {
  const tier = $('tier').value;
  return { tier: tier === 'platinum5' ? 'platinum' : tier, renewals: tier === 'platinum5' ? 5 : 0, stuffing: $('stuffing').value || null, lowAmmo: $('lowAmmo').checked };
}
/** Play now or `delay` seconds from now, through the engine the toggle picks. */
function play(name, { delay = 0, upgrade = false, ...opts } = {}) {
  if (!ctx) start();
  const n = mode === 'old' ? oldName(name) : name;
  return engine().play(n, { ...opts, at: ctx.currentTime + 0.03 + delay, variant: upgrade && mode === 'new' ? variant() : null });
}

// ---- The game's own timing: a Weapon run tick by tick, its shots scheduled ahead -------------------------------------
const stats = { reloadSpeed: 1, reserveMultiplier: 1 };
/** Hold the trigger for `seconds`: [{ t, kind: 'fire' | 'empty' | 'charge', magazine }] */
function simulateFire(def, seconds = 2) {
  const w = new Weapon(def, stats), out = [];
  for (let i = 0, t = 0; t < seconds; i++, t += TICK) {
    const semi = def.fireMode !== 'auto' && def.fireMode !== 'charge';
    const r = w.update(TICK, { triggerPressed: semi || i === 0, triggerHeld: true, reloadPressed: false });
    if (w.justStartedCharging) out.push({ t, kind: 'charge' });
    if (r === 'fire') out.push({ t, kind: 'fire', magazine: w.magazine });
    else if (r === 'empty') out.push({ t, kind: 'empty' });
  }
  return out;
}
/** A reload from empty: [{ t, sound }] as playerGun.runReloadEvents fires them. */
function simulateReload(def) {
  const w = new Weapon(def, stats), out = [], events = def.viewmodel?.reload?.events ?? [];
  w.magazine = 0;
  let last = null;
  for (let i = 0, t = 0; t < 12; i++, t += TICK) {
    w.update(TICK, { triggerPressed: false, reloadPressed: i === 0 });
    const p = w.reloadProgress;
    if (p !== null) for (const e of events) if (e.sound && e.at > (last ?? -1) && e.at <= p) out.push({ t, sound: e.sound });
    last = p;
    if (i > 0 && !w.isReloading) break;
  }
  return out;
}
function playShot(def, { delay = 0, magazine = def.magazineSize, side = null } = {}) {
  const low = !def.fuel && def.magazineSize > 5 && magazine <= 3;
  if (mode === 'new') {
    const v = variant();
    engine().play(def.sounds.fire, { at: ctx.currentTime + 0.03 + delay, variant: { ...v, lowAmmo: v.lowAmmo || low }, side });
  } else play(def.sounds.fire, { delay });
  if (def.sounds.beep) play(def.sounds.beep, { delay });
  impactsAfter(def, delay);
}
function impactsAfter(def, delay) {
  if (def.projectile?.bounceSound) [0.35, 0.6, 0.8, 1.0].forEach((d, i) => play(def.projectile.bounceSound, { delay: delay + d, step: i }));
  if (def.sounds.burst) play(def.sounds.burst, { delay: delay + (def.id === 'bottleRocket' ? 0.55 : 0.7) });
  if (def.id === 'returnToSender') [0.12, 0.2, 0.31].forEach((d) => play('returnStamp', { delay: delay + d }));
}
function rapid(def) {
  if (!ctx) start();
  let shot = 0;
  for (const e of simulateFire(def, 2)) {
    // (an akimbo gun: both triggers held, so the guns take turns)
    if (e.kind === 'fire') playShot(def, { delay: e.t, magazine: e.magazine, side: def.akimbo ? (shot++ % 2 ? 'right' : 'left') : null });
    else if (e.kind === 'empty') play(def.sounds.dryFire, { delay: e.t });
    else if (e.kind === 'charge' && def.charge?.sound) play(def.charge.sound, { delay: e.t });
  }
}
function singleShot(def) {
  if (!ctx) start();
  if (def.charge?.sound) { play(def.charge.sound); playShot(def, { delay: def.charge.seconds }); }
  else playShot(def);
}

// ---- The page ----------------------------------------------------------------------------------------------------
function button(row, label, fn) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; row.append(b); return b; }
function row(card, label) { const r = document.createElement('div'); r.className = 'row'; if (label) r.innerHTML = `<span class="label">${label}</span>`; card.append(r); return r; }
function card(title, what) {
  const c = document.createElement('section'); c.className = 'card';
  c.innerHTML = `<h2>${title}</h2><div class="what">${what}</div>`;
  $('cards').append(c); return c;
}
const rate = (d) => (d.burst ? `burst of ${d.burst.count}` : `${(1 / d.fireInterval).toFixed(1)}/s`);
for (const def of Object.values(weapons)) {
  const c = card(def.name, `${def.id} · ${def.fireMode ?? 'semi'} · ${rate(def)} · mag ${def.magazineSize}`);
  const r1 = row(c);
  button(r1, 'Fire', () => singleShot(def));
  button(r1, 'Rapid 2 s', () => rapid(def));
  button(r1, 'Dry fire', () => play(def.sounds.dryFire));
  const events = (def.viewmodel?.reload?.events ?? []).filter((e) => e.sound);
  if (events.length) {
    const r2 = row(c, 'Reload');
    button(r2, 'Whole reload', () => { if (!ctx) start(); for (const e of simulateReload(def)) play(e.sound, { delay: e.t }); });
    for (const name of [...new Set(events.map((e) => e.sound))]) button(r2, name.replace(/^.*Reload/, ''), () => play(name));
  }
  const extras = [];
  if (def.projectile?.bounceSound) extras.push(['Bounce chain', () => [0, 0.25, 0.45, 0.62, 0.78].forEach((d, i) => play(def.projectile.bounceSound, { delay: d, step: i }))]);
  if (def.sounds.burst) extras.push([def.sounds.burst, () => play(def.sounds.burst)]);
  if (def.sounds.beep) extras.push(['Beep', () => play(def.sounds.beep)]);
  if (def.charge?.sound) extras.push(['Scan, let go early', () => { const v = play(def.charge.sound); setTimeout(() => v?.stop(), 200); }]);
  if (def.id === 'returnToSender') extras.push(['Stamp', () => play('returnStamp')]);
  if (def.id === 'confettiCannon') extras.push(['Party Trap', () => play(workshopBuilds.partyTrap.sound)]);
  if (def.id === 'priceGun') extras.push(['Clearance Rack', () => play('clearanceStamp')]);
  if (extras.length) { const r3 = row(c, 'Impacts and extras'); for (const [l, fn] of extras) button(r3, l, fn); }
  const r4 = row(c, 'Every tier (ignores the Tier menu)');
  for (const [label, tier, renewals] of [['Std', 'standard', 0], ['Deluxe', 'deluxe', 0], ['Premium', 'premium', 0], ['Platinum', 'platinum', 0], ['+5', 'platinum', 5]])
    button(r4, label, () => { if (!ctx) start(); (mode === 'new' ? engine().play(def.sounds.fire, { variant: { tier, renewals } }) : play(def.sounds.fire)); });
  const r5 = row(c, 'Every build');
  for (const id of Object.keys(workshopStuffings)) button(r5, id, () => { if (!ctx) start(); engine().play(def.sounds.fire, { variant: { stuffing: id } }); });
}
{
  const c = card('Box Cutter', 'melee · the swing, then what a hit plays');
  const r = row(c);
  button(r, 'Swing', () => play(melee.boxCutter.sounds.swing));
  button(r, 'Swing + hit', () => { play(melee.boxCutter.sounds.swing); play('hitBody', { delay: 0.15 }); });
  button(r, 'Swing + kill', () => { play(melee.boxCutter.sounds.swing); play('hitBody', { delay: 0.15 }); play('killConfirm', { delay: 0.15 }); });
}
{
  const c = card('Kiosk Sentry', 'SPIN-O-MATIC staple turret · 5/s · played at 0.55 in the game');
  const r = row(c);
  button(r, 'Fire', () => play('sentryShot', { volume: 0.55 }));
  button(r, 'Rapid 2 s', () => { for (let t = 0; t < 2; t += 0.2) play('sentryShot', { volume: 0.55, delay: t }); });
  button(r, 'Break', () => play('sentryBreak'));
}
{
  const c = card('Hit feedback', 'hit tick · headshot ding · kill cha-ching (dry: no room)');
  const r = row(c);
  button(r, 'Hit', () => play('hitBody'));
  button(r, 'Headshot', () => play('hitHead'));
  button(r, 'Kill', () => play('killConfirm'));
  button(r, 'Headshot kill', () => { play('hitHead'); play('killConfirm'); });
  button(r, 'In a firefight', () => {
    if (!ctx) start();
    const def = weapons.rivetRifle;
    for (const e of simulateFire(def, 2)) if (e.kind === 'fire') { playShot(def, { delay: e.t }); play('hitBody', { delay: e.t + 0.01 }); }
    [0.5, 1.1, 1.7].forEach((d) => { play('hitHead', { delay: d }); play('killConfirm', { delay: d }); });
  });
  const r2 = row(c, 'Reference: what the guns must not bury');
  for (const name of ['walkerSqueak', 'mannequinStep', 'cartSqueak']) button(r2, name, () => play(name, { volume: 0.5 }));
}

// Header controls.
for (const id of Object.keys(workshopStuffings)) $('stuffing').insertAdjacentHTML('beforeend', `<option value="${id}">${id}</option>`);
for (const id of ['front', ...Object.keys(audio.roomOf).filter((r) => r !== 'front')]) $('room').insertAdjacentHTML('beforeend', `<option value="${id}">${id} (${audio.roomOf[id] ?? audio.reverb.defaultRoom})</option>`);
$('room').onchange = setRoom;
$('volume').oninput = setVolume;
$('unlock').onclick = start;
for (const b of $('engine').querySelectorAll('button')) b.onclick = () => {
  mode = b.dataset.v;
  for (const o of $('engine').querySelectorAll('button')) o.classList.toggle('on', o === b);
};

// ---- Measure ------------------------------------------------------------------------------------------------------
const RATE = 48000;
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** Render one sound offline through a fresh engine (new or old), in a room (null = the hallway). */
async function render(name, { old = false, room = null, seconds = 2.5, at = 0.02, schedule = null } = {}) {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const e = createSound({ context: off, recipes: old ? oldTable : newTable, reverb: !old });
  e.unlock();
  e.setMasterVolume(audio.masterVolume);
  e.setRoom(room);
  if (schedule) schedule(e); else e.play(name, { at });
  const t0 = performance.now();
  const buffer = await off.startRendering();
  return { buffer, ms: performance.now() - t0 };
}

function fft(re, im) { // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Peak, loudest 50 ms, length to -60 dB of the peak, spectral centroid and a band/envelope fingerprint. */
function analyse(buffer) {
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1), n = L.length;
  const mono = new Float32Array(n);
  let peak = 0, nan = false;
  for (let i = 0; i < n; i++) {
    const v = (L[i] + R[i]) / 2; mono[i] = v;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) nan = true;
  }
  const win = Math.round(0.05 * RATE);
  let sum = 0, maxRms = 0;
  for (let i = 0; i < n; i++) {
    sum += mono[i] * mono[i]; if (i >= win) sum -= mono[i - win] * mono[i - win];
    if (i >= win - 1) maxRms = Math.max(maxRms, Math.sqrt(Math.max(0, sum) / win));
  }
  let first = -1, last = 0;
  for (let i = 0; i < n; i++) if (Math.abs(mono[i]) > peak * 0.001) { if (first < 0) first = i; last = i; }
  // Spectrum of the first 170 ms after the onset (the shot itself, not the room).
  const size = 8192, re = new Float32Array(size), im = new Float32Array(size);
  for (let i = 0; i < size && first + i < n; i++) re[i] = mono[first + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / size));
  fft(re, im);
  let num = 0, den = 0;
  const bands = new Float32Array(24);
  for (let k = 1; k < size / 2; k++) {
    const f = k * RATE / size, mag = Math.hypot(re[k], im[k]);
    num += f * mag * mag; den += mag * mag;
    const b = Math.floor(Math.log2(f / 40) * 3); // third-octave-ish bands from 40 Hz
    if (b >= 0 && b < 24) bands[b] += mag * mag;
  }
  const bandDb = Array.from(bands, (e) => 10 * Math.log10(e + 1e-12));
  // The envelope: RMS per 10 ms over the first 400 ms.
  const env = [];
  for (let s = 0; s < 40; s++) {
    let e = 0; const a = first + s * 480;
    for (let i = a; i < a + 480 && i < n; i++) e += mono[i] * mono[i];
    env.push(10 * Math.log10(e / 480 + 1e-12));
  }
  return { peak: db(peak), rms: db(maxRms), length: (last - Math.max(0, first)) / RATE, centroid: den ? num / den : 0, bandDb, env, nan };
}

/** How alike two fingerprints are, 0..1 (1 = the same): spectral shape and envelope, each as a correlation. */
function alike(a, b) {
  const corr = (x, y) => {
    const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  };
  const centroidGap = Math.abs(Math.log2(a.centroid / b.centroid)); // octaves apart in brightness
  return Math.max(0, 0.55 * corr(a.bandDb, b.bandDb) + 0.45 * corr(a.env, b.env) - 0.25 * centroidGap);
}

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-inf');
async function measure() {
  $('status').textContent = 'Measuring…';
  const report = [];
  const rows = [];
  const guns = Object.values(weapons);
  const entries = [
    ...guns.map((d) => ({ label: d.name, name: d.sounds.fire, gun: true })),
    { label: 'Kiosk Sentry (x0.55)', name: 'sentryShot', volume: 0.55, gun: true },
    { label: 'Box Cutter swing', name: 'meleeSwing' },
    { label: 'Bottle Rocket burst', name: 'bottleRocketBurst' }, { label: 'Balloon pop', name: 'balloonPop' },
    { label: 'Tennis bounce', name: 'tennisBounce' }, { label: 'Party Trap blast', name: 'partyTrapBlast' },
    { label: 'hitBody', name: 'hitBody' }, { label: 'hitHead', name: 'hitHead' }, { label: 'killConfirm', name: 'killConfirm' },
    { label: 'ref: walkerSqueak (x0.5)', name: 'walkerSqueak', volume: 0.5 }, { label: 'ref: mannequinStep (x0.5)', name: 'mannequinStep', volume: 0.5 },
  ];
  for (const e of entries) {
    const opts = { schedule: (eng) => eng.play(e.name, { at: 0.02, volume: e.volume ?? 1 }) };
    const dryNew = analyse((await render(e.name, { ...opts, room: 'parkingLot' })).buffer);
    const hall = analyse((await render(e.name, opts)).buffer);
    const oldN = oldName(e.name);
    const old = analyse((await render(oldN, { old: true, schedule: (eng) => eng.play(oldN, { at: 0.02, volume: e.volume ?? 1 }) })).buffer);
    rows.push({ ...e, dryNew, hall, old });
    $('status').textContent = `Measuring… ${rows.length}/${entries.length}`;
  }
  report.push('Every sound rendered offline at 48 kHz through the real engine, master volume ' + audio.masterVolume + '.');
  report.push('Dry = the parking lot (nearly no room); Hall = the main hallway. Peak and RMS in dBFS (RMS = the loudest 50 ms),');
  report.push('length in s to -60 dB of the peak (in the hallway, with its tail), centroid = brightness of the first 170 ms in Hz.');
  report.push('');
  report.push(`| ${pad('Sound', 26)} | ${pad('peak', 6)} | ${pad('RMS', 6)} | ${pad('RMS hall', 8)} | ${pad('length', 6)} | ${pad('centroid', 8)} | ${pad('old RMS', 7)} | ${pad('old centroid', 12)} |`);
  report.push(`|${'-'.repeat(28)}|--------|--------|----------|--------|----------|---------|--------------|`);
  const byLoud = [...rows].filter((r) => r.gun).sort((a, b) => a.dryNew.rms - b.dryNew.rms);
  for (const r of rows) {
    report.push(`| ${pad(r.label, 26)} | ${pad(num(r.dryNew.peak), 6)} | ${pad(num(r.dryNew.rms), 6)} | ${pad(num(r.hall.rms), 8)} | ${pad(num(r.hall.length, 2), 6)} | ${pad(Math.round(r.dryNew.centroid), 8)} | ${pad(num(r.old.rms), 7)} | ${pad(Math.round(r.old.centroid), 12)} |`);
  }
  report.push('');
  report.push('Gun loudness, quietest first (dry RMS): ' + byLoud.map((r) => `${r.label} ${num(r.dryNew.rms)}`).join(' < '));
  // The most alike pairs of gun shots.
  const pairs = [];
  const gunRows = rows.filter((r) => r.gun);
  for (let i = 0; i < gunRows.length; i++) for (let j = i + 1; j < gunRows.length; j++) pairs.push([alike(gunRows[i].dryNew, gunRows[j].dryNew), gunRows[i].label, gunRows[j].label]);
  pairs.sort((a, b) => b[0] - a[0]);
  report.push('');
  report.push('Most alike gun shots (1 = identical; over 0.9 = worth a listen):');
  for (const [s, a, b] of pairs.slice(0, 8)) report.push(`  ${s.toFixed(2)}  ${a} / ${b}`);
  const rc = pairs.find(([, a, b]) => [a, b].includes(weapons.rivetRifle.name) && [a, b].includes(weapons.coilNailer.name));
  report.push(`  Rivet Rifle / Heavy Coil Nailer: ${rc[0].toFixed(2)}`);

  // Stress: the fastest gun, Platinum + a build, with hit and kill sounds, in the Atrium, for 3 s.
  const bogo = weapons.bogo;
  const shots = simulateFire({ ...bogo, magazineSize: 999 }, 3).filter((e) => e.kind === 'fire');
  const stress = await render(null, { room: 'atrium', seconds: 3.6, schedule: (eng) => {
    shots.forEach((s, i) => {
      eng.play(bogo.sounds.fire, { at: 0.02 + s.t, variant: { tier: 'platinum', renewals: 5, stuffing: 'glitter' } });
      eng.play('hitBody', { at: 0.03 + s.t });
      if (i % 5 === 4) eng.play('killConfirm', { at: 0.03 + s.t });
      if (i % 9 === 8) eng.play('hitHead', { at: 0.03 + s.t });
    });
  } });
  const sa = analyse(stress.buffer);
  // Silence gaps: any 20 ms window under -70 dBFS between the first and last shot.
  const L = stress.buffer.getChannelData(0); let gaps = 0;
  for (let a = Math.round(0.05 * RATE); a < Math.round(3 * RATE); a += 960) {
    let m = 0; for (let i = a; i < a + 960; i++) m = Math.max(m, Math.abs(L[i]));
    if (db(m) < -70) gaps++;
  }
  report.push('');
  report.push(`Stress: BOGO ${shots.length} shots in 3 s (${(shots.length / 3).toFixed(1)}/s), Platinum +5 + glitter, a hit on every shot, a kill every 5th, Atrium:`);
  report.push(`  peak ${num(sa.peak, 2)} dBFS, loudest 50 ms ${num(sa.rms)} dBFS, NaN: ${sa.nan ? 'YES' : 'no'}, silent gaps: ${gaps},`);
  report.push(`  rendered 3.6 s in ${stress.ms.toFixed(0)} ms = ${(3600 / stress.ms).toFixed(1)}x real time.`);
  $('report').textContent = report.join('\n');
  $('status').textContent = 'Measured.';
  window.__auditionReport = { rows, pairs, stress: { ...sa, ms: stress.ms, gaps, shots: shots.length } };
}
$('measure').onclick = () => measure().catch((err) => { $('status').textContent = 'Measure failed: ' + err.message; console.error(err); });
/** Every gun recipe's loudest 50 ms, new (in the parking lot: nearly dry) vs what the old game played for it. */
async function calibrate(names = Object.keys(gunSoundsTable)) {
  const out = {};
  for (const name of names) {
    const n = analyse((await render(name, { room: 'parkingLot' })).buffer);
    const o = analyse((await render(oldName(name), { old: true })).buffer);
    out[name] = { rms: +n.rms.toFixed(1), old: +o.rms.toFixed(1), peak: +n.peak.toFixed(1), centroid: Math.round(n.centroid) };
  }
  return out;
}
/**
 * How the volumes in config/gunSounds.js were set: measure each sound (nearly dry) and propose the volume that brings its
 * loudest 50 ms to a target: LEVEL_TARGETS for the shots and hit sounds (the loudness ranking), and for the rest (dry fire,
 * reload steps) the loudness of what the old game played, kept within -42..-26 dBFS. Run twice: the compressor bends it.
 */
export const LEVEL_TARGETS = {
  stapleShot: -24, sentryShot: -22, priceShot: -23, foamShot: -22.5, bogoShot: -23, leafBlowerPuff: -21.5, nailShot: -19.5,
  rivetShot: -17.5, balloonLaunch: -20, tennisLaunch: -18.5, scannerShot: -17, coilShot: -16.5, confettiShot: -13.5,
  stargazerShot: -13.5, bottleRocketLaunch: -15.5, returnBeam: -12.5,
  bottleRocketBurst: -12, partyTrapBlast: -15, balloonPop: -22, tennisBounce: -30, returnStamp: -26, clearanceStamp: -33,
  meleeSwing: -29, scannerCharge: -20, scannerBeep: -28,
  hitBody: -31, hitHead: -28, killConfirm: -25.5,
};
async function level(names = Object.keys(gunSoundsTable)) {
  const out = {};
  for (const name of names) {
    const n = analyse((await render(name, { room: 'parkingLot' })).buffer);
    let target = LEVEL_TARGETS[name];
    if (target === undefined) {
      if (/Dry$/.test(name)) target = -37;
      else target = Math.max(-42, Math.min(-26, analyse((await render(oldName(name), { old: true })).buffer).rms));
    }
    const volume = newTable[name].volume * 10 ** ((target - n.rms) / 20);
    out[name] = Math.round(volume * 100) / 100;
  }
  return out;
}
/** What the stress render costs with parts of it switched off (ms to render 3.6 s). */
async function cost() {
  const bogo = weapons.bogo;
  const shots = simulateFire({ ...bogo, magazineSize: 999 }, 3).filter((e) => e.kind === 'fire');
  const run = async (room, variant, hits) => (await render(null, { room, seconds: 3.6, schedule: (eng) => {
    if (!room) eng.setReverbEnabled(false);
    shots.forEach((s, i) => {
      eng.play(bogo.sounds.fire, { at: 0.02 + s.t, variant });
      if (hits) { eng.play('hitBody', { at: 0.03 + s.t }); if (i % 5 === 4) eng.play('killConfirm', { at: 0.03 + s.t }); }
    });
  } })).ms;
  const full = { tier: 'platinum', renewals: 5, stuffing: 'glitter' };
  return { silent: (await render(null, { seconds: 3.6, schedule: () => {} })).ms, plainNoRoom: await run(null, null, false), plainAtrium: await run('atrium', null, false),
    fullNoRoom: await run(null, full, true), fullAtrium: await run('atrium', full, true) };
}
window.__audition = { measure, calibrate, level, cost, render, analyse, play, simulateFire, simulateReload, get voices() { return engines?.new.voiceCount ?? 0; }, get ctx() { return ctx; } };
