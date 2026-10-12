// =============================================================================
// HUD + START OVERLAY
// Plain HTML on top of the canvas: crosshair + hit marker, health and stamina
// bars, ammo counter, reload prompt, and the click-to-play / paused screen.
// =============================================================================

import { debug } from '../config/debug.js';
import { feel } from '../config/feel.js';

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function createHud() {
  const hud = el('div', 'hud');

  const crosshair = el('div', 'crosshair');
  hud.append(crosshair);

  // Hit marker: four little ticks around the crosshair that flash on a hit.
  const hitMarker = el('div', 'hitmarker');
  for (let i = 0; i < 4; i++) hitMarker.append(el('span'));
  hud.append(hitMarker);
  let hitMarkerTimeout = null;

  // Small prompt under the crosshair ("Reload", "No ammo").
  const prompt = el('div', 'prompt');
  hud.append(prompt);

  // Bottom-right: ammo counter.
  const ammo = el('div', 'ammo');
  ammo.innerHTML = `
    <div class="ammo-count"><span class="ammo-mag"></span><span class="ammo-reserve"></span></div>
    <div class="ammo-name"></div>
  `;
  const ammoMag = ammo.querySelector('.ammo-mag');
  const ammoReserve = ammo.querySelector('.ammo-reserve');
  const ammoName = ammo.querySelector('.ammo-name');
  hud.append(ammo);
  let lastAmmoKey = '';

  // Bottom-left: health bar on top, stamina (sprint) bar underneath.
  const vitals = el('div', 'vitals');
  const health = el('div', 'health');
  const healthFill = el('div', 'health-fill');
  health.append(healthFill);
  const sprint = el('div', 'sprint');
  const sprintFill = el('div', 'sprint-fill');
  sprint.append(sprintFill);
  vitals.append(health, sprint);
  hud.append(vitals);

  const overlay = el('div', 'overlay');
  overlay.innerHTML = `
    <div class="card">
      <div class="kicker">Attention shoppers</div>
      <h1>Mall<br />Zombies</h1>
      <p class="tagline">The mall is closed. The shoppers didn't get the memo.</p>
      <button class="play" type="button">Click to play</button>
      <ul class="controls">
        <li><kbd>WASD</kbd> move</li>
        <li><kbd>Space</kbd> jump</li>
        <li><kbd>Shift</kbd> sprint</li>
        <li><kbd>C</kbd> crouch (hold) / slide (tap while sprinting)</li>
        <li><kbd>Mouse</kbd> look</li>
        <li><kbd>Click</kbd> shoot</li>
        <li><kbd>R</kbd> reload</li>
        <li><kbd>Esc</kbd> pause</li>
      </ul>
      ${debug.allowShutterToggle ? '<p class="debug-hint">Debug: <kbd>O</kbd> opens the shutter</p>' : ''}
      ${debug.testArena ? '<p class="debug-hint">Debug: <kbd>T</kbd> teleports to the movement test range</p>' : ''}
    </div>
  `;
  const kicker = overlay.querySelector('.kicker');
  const playButton = overlay.querySelector('.play');

  document.body.append(hud, overlay);

  let startHandler = null;
  overlay.addEventListener('click', () => startHandler && startHandler());

  let hasStarted = false;
  let lastHealth = -1;
  let lastFraction = -1;
  let lastExhausted = null;
  let lastFull = null;

  return {
    onStart(fn) {
      startHandler = fn;
    },

    setPaused(paused) {
      overlay.classList.toggle('hidden', !paused);
      hud.classList.toggle('dimmed', paused);
      if (!paused) hasStarted = true;
      if (paused && hasStarted) {
        kicker.textContent = 'Paused';
        playButton.textContent = 'Click to resume';
      }
    },

    // Called every frame; only touches the DOM when something changed.
    setHealth(fraction) {
      const rounded = Math.round(Math.max(0, Math.min(1, fraction)) * 200) / 200;
      if (rounded !== lastHealth) {
        healthFill.style.transform = `scaleX(${rounded})`;
        lastHealth = rounded;
      }
    },

    // A shot connected. Headshots get a bigger yellow marker; kills get a red one.
    showHitMarker({ headshot, killed }) {
      hitMarker.className = 'hitmarker';
      void hitMarker.offsetWidth; // force a reflow so rapid hits re-trigger cleanly
      hitMarker.classList.add('show');
      if (headshot) hitMarker.classList.add('head');
      if (killed) hitMarker.classList.add('kill');
      clearTimeout(hitMarkerTimeout);
      hitMarkerTimeout = setTimeout(() => hitMarker.classList.remove('show'), feel.effects.hitMarkerSeconds * 1000);
    },

    // Called every frame with the held weapon; only touches the DOM when something changed.
    setAmmo(weapon) {
      const key = `${weapon.magazine}|${weapon.reserve}|${weapon.isReloading}`;
      if (key === lastAmmoKey) return;
      lastAmmoKey = key;
      ammoMag.textContent = weapon.magazine;
      ammoReserve.textContent = ` / ${weapon.reserve}`;
      ammoName.textContent = weapon.def.name;
      ammo.classList.toggle('low', weapon.magazine <= feel.effects.lowAmmoThreshold);

      let text = '';
      if (weapon.isReloading) text = 'Reloading...';
      else if (weapon.magazine === 0 && weapon.reserve === 0) text = 'No ammo';
      else if (weapon.magazine === 0) text = 'Press R to reload';
      prompt.textContent = text;
    },

    setSprint(fraction, exhausted, active) {
      const rounded = Math.round(fraction * 200) / 200;
      if (rounded !== lastFraction) {
        sprintFill.style.transform = `scaleX(${rounded})`;
        lastFraction = rounded;
      }
      if (exhausted !== lastExhausted) {
        sprint.classList.toggle('exhausted', exhausted);
        lastExhausted = exhausted;
      }
      const full = fraction >= 1 && !active;
      if (full !== lastFull) {
        sprint.classList.toggle('full', full);
        lastFull = full;
      }
    },
  };
}
