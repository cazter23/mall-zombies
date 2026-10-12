// =============================================================================
// HUD + START OVERLAY
// Plain HTML on top of the canvas: crosshair, sprint bar, and the
// click-to-play / paused screen.
// =============================================================================

import { debug } from '../config/debug.js';

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function createHud() {
  const hud = el('div', 'hud');

  const crosshair = el('div', 'crosshair');
  hud.append(crosshair);

  const sprint = el('div', 'sprint');
  const sprintFill = el('div', 'sprint-fill');
  sprint.append(sprintFill);
  hud.append(sprint);

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
        <li><kbd>Mouse</kbd> look</li>
        <li><kbd>Esc</kbd> pause</li>
      </ul>
      ${debug.allowShutterToggle ? '<p class="debug-hint">Debug: <kbd>O</kbd> opens the shutter</p>' : ''}
    </div>
  `;
  const kicker = overlay.querySelector('.kicker');
  const playButton = overlay.querySelector('.play');

  document.body.append(hud, overlay);

  let startHandler = null;
  overlay.addEventListener('click', () => startHandler && startHandler());

  let hasStarted = false;
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
