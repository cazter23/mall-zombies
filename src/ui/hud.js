// =============================================================================
// HUD + START OVERLAY
// Plain HTML on top of the canvas: crosshair + hit marker, health and stamina
// bars, ammo counter, points (+ pop-ups), round counter and banner, reload
// prompt, buy prompt (with hold progress), and the click-to-play / paused / results screens.
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

  // Red glow around the screen edges when hurt (under everything else in the HUD).
  const hurt = el('div', 'hurt');
  hud.append(hurt);
  let lastHurt = -1;

  // Cartoon speed lines at the screen edges while sprinting.
  const speedLines = el('div', 'speed-lines');
  hud.append(speedLines);
  let lastSpeed = -1;

  // Crosshair: four lines around a gap that shows the current spread cone,
  // plus a precise dot that fades in while aiming down sights.
  const crosshair = el('div', 'crosshair');
  const crosshairLines = el('div', 'ch-lines');
  for (const side of ['top', 'bottom', 'left', 'right']) crosshairLines.append(el('span', `ch-line ch-${side}`));
  const crosshairDot = el('div', 'ch-dot');
  crosshair.append(crosshairLines, crosshairDot);
  hud.append(crosshair);
  let lastGap = -1;
  let lastAim = -1;

  // Hit marker: four little ticks around the crosshair that flash on a hit.
  const hitMarker = el('div', 'hitmarker');
  for (let i = 0; i < 4; i++) hitMarker.append(el('span'));
  hud.append(hitMarker);
  let hitMarkerTimeout = null;

  // Small prompt under the crosshair ("Reload", "No ammo").
  const prompt = el('div', 'prompt');
  hud.append(prompt);

  // "[Space] Vault": shown when pressing jump now would vault (feel.vault; player/vault.js preview()).
  const vaultPrompt = el('div', 'vault-prompt');
  hud.append(vaultPrompt);
  let lastVaultKey = '';

  // DEBUG (debug.vaultDebug, temporary): why the last vault attempt failed. Remove with the flag.
  const debugLine = el('div', 'debug-line');
  hud.append(debugLine);
  let lastDebugLine = null;

  // Buy prompt below that ("Hold F to open Security Shutter  500"), with a hold-progress bar.
  const interact = el('div', 'interact');
  const interactText = el('div', 'interact-text');
  const interactBar = el('div', 'interact-bar');
  const interactFill = el('div', 'interact-fill');
  interactBar.append(interactFill);
  interact.append(interactText, interactBar);
  hud.append(interact);
  let lastInteractKey = '';

  // Bottom-right, above the ammo: points, with "+60" pop-ups floating up from it.
  const points = el('div', 'points');
  const pointsValue = el('div', 'points-value');
  points.append(pointsValue);
  hud.append(points);
  let lastPoints = null;

  // Top-left: the round number (flashes during the break between rounds).
  const roundCounter = el('div', 'round-counter');
  hud.append(roundCounter);
  // Middle of the screen: "ROUND 3" announcement when a round starts.
  const roundBanner = el('div', 'round-banner');
  hud.append(roundBanner);

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
        <li><kbd>F</kbd> buy (hold)</li>
        <li><kbd>1</kbd> <kbd>2</kbd> / <kbd>Wheel</kbd> switch weapon</li>
        <li><kbd>V</kbd> box cutter</li>
        <li><kbd>Esc</kbd> pause</li>
      </ul>
      <p class="pad-hint">Controller? Press <kbd>A</kbd> / <kbd>✕</kbd> or <kbd>Start</kbd> to play.
        LS move (click to sprint) · RS look · LT aim · RT shoot · A jump · B crouch/slide · X reload (hold X to buy) · Y switch weapon · RB knife</p>
      ${debug.allowShutterToggle ? '<p class="debug-hint">Debug: <kbd>O</kbd> opens the shutter</p>' : ''}
      ${debug.testArena ? '<p class="debug-hint">Debug: <kbd>T</kbd> teleports to the movement test range</p>' : ''}
      ${debug.zombieKeys ? '<p class="debug-hint">Debug: <kbd>Z</kbd> spawns a zombie, <kbd>X</kbd> clears them</p>' : ''}
      ${debug.cheatKeys ? '<p class="debug-hint">Debug: <kbd>N</kbd> next round, <kbd>P</kbd> +5000 points, <kbd>&#39;</kbd> points to 0</p>' : ''}
    </div>
  `;
  const kicker = overlay.querySelector('.kicker');
  const playButton = overlay.querySelector('.play');

  // Results screen, shown when you die.
  const results = el('div', 'overlay results hidden');
  results.innerHTML = `
    <div class="card">
      <div class="kicker">Attention shoppers</div>
      <h1>Clocked<br />Out</h1>
      <p class="tagline">Cleanup on aisle you.</p>
      <dl class="results-stats"></dl>
      <button class="play" type="button">Play again</button>
      <p class="pad-hint">or press <kbd>A</kbd> / <kbd>✕</kbd> on a controller</p>
    </div>
  `;
  const resultsStats = results.querySelector('.results-stats');
  let playAgainHandler = null;
  results.querySelector('.play').addEventListener('click', () => playAgainHandler && playAgainHandler());

  document.body.append(hud, overlay, results);

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

    // `restart`: show the "back to work" wording instead of "paused" (after Play again).
    setPaused(paused, { restart = false } = {}) {
      overlay.classList.toggle('hidden', !paused);
      hud.classList.toggle('dimmed', paused);
      if (!paused) hasStarted = true;
      if (paused && restart) {
        kicker.textContent = 'Back to work';
        playButton.textContent = 'Click to play';
      } else if (paused && hasStarted) {
        kicker.textContent = 'Paused';
        playButton.textContent = 'Click to resume';
      }
    },

    // Dead: hide the combat HUD (crosshair, ammo, prompts).
    setDead(dead) {
      hud.classList.toggle('dead', dead);
    },

    onPlayAgain(fn) {
      playAgainHandler = fn;
    },

    // { timeAlive (s), round, kills, headshotKills, meleeKills, accuracy (0..1) }
    // --- Points ---
    setPoints(value) {
      if (value === lastPoints) return;
      pointsValue.textContent = value.toLocaleString('en-US');
      lastPoints = value;
    },

    // A "+60" (or "-500") that floats up from the points counter and fades out.
    pointsPopup(amount) {
      if (amount === 0) return;
      const pop = el('div', `points-pop ${amount > 0 ? 'gain' : 'spend'}`);
      pop.textContent = `${amount > 0 ? '+' : '-'}${Math.abs(amount)}`;
      pop.style.right = `${Math.round(Math.random() * 40)}px`; // a little scatter so pop-ups don't stack
      points.append(pop);
      pop.addEventListener('animationend', () => pop.remove());
    },

    // --- Rounds ---
    setRound(n) {
      roundCounter.textContent = n > 0 ? String(n) : '';
    },

    showRoundBanner(n) {
      roundBanner.textContent = `Round ${n}`;
      roundBanner.classList.remove('show');
      void roundBanner.offsetWidth; // restart the animation
      roundBanner.classList.add('show');
    },

    // The counter blinks during the break between rounds.
    setRoundFlashing(flashing) {
      roundCounter.classList.toggle('flashing', flashing);
    },

    showResults(r) {
      const minutes = Math.floor(r.timeAlive / 60);
      const seconds = String(Math.floor(r.timeAlive % 60)).padStart(2, '0');
      const rows = [
        ['Time survived', `${minutes}:${seconds}`],
        ['Round reached', r.round],
        ['Points earned', r.pointsEarned.toLocaleString('en-US')],
        ['Zombies killed', r.kills],
        ['Headshot kills', r.headshotKills],
        ['Box cutter kills', r.meleeKills],
        ['Accuracy', `${Math.round(r.accuracy * 100)}%`],
      ];
      resultsStats.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('');
      results.classList.remove('hidden');
    },

    hideResults() {
      results.classList.add('hidden');
    },

    // Called every frame; only touches the DOM when something changed.
    setHealth(fraction) {
      const rounded = Math.round(Math.max(0, Math.min(1, fraction)) * 200) / 200;
      if (rounded !== lastHealth) {
        healthFill.style.transform = `scaleX(${rounded})`;
        lastHealth = rounded;
      }
    },

    // gapPx: distance from screen center to the inner end of each line (the spread cone's edge).
    // aimAmount: 0 = hip (lines), 1 = fully aimed (dot only).
    setCrosshair(gapPx, aimAmount) {
      const gap = Math.round(Math.max(feel.effects.crosshairMinGap, gapPx) * 2) / 2;
      if (gap !== lastGap) {
        crosshair.style.setProperty('--gap', `${gap}px`);
        lastGap = gap;
      }
      const aim = Math.round(aimAmount * 50) / 50;
      if (aim !== lastAim) {
        crosshairLines.style.opacity = String(1 - aim);
        crosshairDot.style.opacity = String(aim);
        lastAim = aim;
      }
    },

    // 0..1 opacity of the sprint speed lines.
    setSpeedLines(opacity) {
      const rounded = Math.round(opacity * 50) / 50;
      if (rounded === lastSpeed) return;
      speedLines.style.opacity = String(rounded);
      speedLines.classList.toggle('active', rounded > 0);
      lastSpeed = rounded;
    },

    // 0..1 strength of the red hurt edges.
    setHurt(strength) {
      const rounded = Math.round(strength * 100) / 100;
      if (rounded === lastHurt) return;
      hurt.style.opacity = String(rounded);
      lastHurt = rounded;
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
    // `reloadLabel`: the reload button for the device in use ("R", "X", "□").
    setAmmo(weapon, reloadLabel = 'R') {
      const key = `${weapon.magazine}|${weapon.reserve}|${weapon.isReloading}|${reloadLabel}`;
      if (key === lastAmmoKey) return;
      lastAmmoKey = key;
      ammoMag.textContent = weapon.magazine;
      ammoReserve.textContent = ` / ${weapon.reserve}`;
      ammoName.textContent = weapon.def.name;
      ammo.classList.toggle('low', weapon.magazine <= feel.effects.lowAmmoThreshold);

      let text = '';
      if (weapon.isReloading) text = 'Reloading...';
      else if (weapon.magazine === 0 && weapon.reserve === 0) text = 'No ammo';
      else if (weapon.magazine === 0) text = `Press ${reloadLabel} to reload`;
      prompt.textContent = text;
    },

    // Vault prompt: shown while `show`; `button` = the jump button for the device ("Space", "A", "✕").
    setVaultPrompt(show, button = 'Space') {
      const key = show ? button : '';
      if (key === lastVaultKey) return;
      lastVaultKey = key;
      vaultPrompt.classList.toggle('show', show);
      if (show) vaultPrompt.innerHTML = `<kbd>${button}</kbd> Vault`;
    },

    // DEBUG (debug.vaultDebug, temporary): a small line of text at the top; null/'' hides it.
    setDebugLine(text) {
      if (text === lastDebugLine) return;
      lastDebugLine = text;
      debugLine.textContent = text || '';
      debugLine.style.display = text ? 'block' : 'none';
    },

    // Buy prompt: null hides it, else { label, verb, cost, canAfford, progress, denied }.
    // `button` is the interact button for the device in use ("F", "X", "□").
    setInteract(info, button = 'F') {
      const key = info
        ? `${info.label}|${info.cost}|${info.canAfford}|${info.denied}|${button}|${info.progress.toFixed(2)}`
        : '';
      if (key === lastInteractKey) return;
      lastInteractKey = key;
      interact.classList.toggle('show', !!info);
      if (!info) return;
      interactText.innerHTML = `Hold <kbd>${button}</kbd> to ${info.verb} ${info.label} <span class="cost">${info.cost}</span>`;
      interact.classList.toggle('cant', !info.canAfford);
      interact.classList.toggle('denied', info.denied);
      interactFill.style.transform = `scaleX(${info.progress})`;
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
