// =============================================================================
// HUD
// Plain HTML on top of the canvas: crosshair + hit marker, health and stamina
// bars, ammo counter, points (+ pop-ups), round counter and banner, reload
// prompt, buy prompt (with hold progress). The menus (title, pause, results receipt) are
// ui/screens.js, created here and exposed as hud.screens.
// =============================================================================

import { feel } from '../config/feel.js';
import { createScreens } from './screens.js';

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

  // PA-style announcement under it ("Attention shoppers / Mall Walkers have entered the building").
  const announceBanner = el('div', 'announce-banner');
  const announceKicker = el('div', 'announce-kicker');
  const announceText = el('div', 'announce-text');
  announceBanner.append(announceKicker, announceText);
  hud.append(announceBanner);

  // Top middle: the Flash Sale running now ("FLASH SALE · Wall guns 30% OFF · 0:32").
  const saleTag = el('div', 'sale-tag');
  hud.append(saleTag);
  let lastSaleKey = '';

  // Bottom-right: ammo counter.
  const ammo = el('div', 'ammo');
  ammo.innerHTML = `
    <div class="ammo-count"><span class="ammo-mag"></span><span class="ammo-reserve"></span></div>
    <div class="ammo-name"></div>
    <div class="ammo-tier"></div>
  `;
  const ammoMag = ammo.querySelector('.ammo-mag');
  const ammoReserve = ammo.querySelector('.ammo-reserve');
  const ammoName = ammo.querySelector('.ammo-name');
  const ammoTier = ammo.querySelector('.ammo-tier');
  let lastTierKey = null;
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

  // FPS counter (Settings > Video), top right.
  const fpsCounter = el('div', 'fps');
  hud.append(fpsCounter);
  let lastFps = -1;

  // The menus around a run (title / pause / results receipt): ui/screens.js.
  const screens = createScreens();
  document.body.append(hud);

  let lastHealth = -1;
  let lastFraction = -1;
  let lastExhausted = null;
  let lastFull = null;

  return {
    // The title / pause / results screens (ui/screens.js): show(), on(action), padNav(), current.
    screens,

    setFpsVisible(visible) {
      fpsCounter.classList.toggle('show', visible);
    },

    // Whole frames per second; only touches the DOM when the number changes.
    setFps(fps) {
      if (fps === lastFps) return;
      lastFps = fps;
      fpsCounter.textContent = `${fps} FPS`;
    },

    // While a menu is up the combat HUD fades out.
    setDimmed(dimmed) {
      hud.classList.toggle('dimmed', dimmed);
    },

    // Dead: hide the combat HUD (crosshair, ammo, prompts).
    setDead(dead) {
      hud.classList.toggle('dead', dead);
    },

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

    // A PA-style announcement: { kicker, text }. Restarts the animation if one is already showing.
    showAnnouncement({ kicker = '', text }) {
      announceKicker.textContent = kicker;
      announceText.textContent = text;
      announceBanner.classList.remove('show');
      void announceBanner.offsetWidth; // restart the animation
      announceBanner.classList.add('show');
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

    // Death: the run's receipt ({ timeAlive (s), round, pointsEarned, kills, headshotKills, meleeKills, accuracy 0..1 }).
    showResults(r) {
      hud.classList.add('dimmed');
      screens.show('results', r);
    },

    hideResults() {
      if (screens.current === 'results') screens.show(null);
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

    // The held gun's Extended Warranty tier under its name ({ id, name, color } from config/upgrades.js),
    // in the tier's color. Standard shows nothing. Called every frame; only touches the DOM on a change.
    setAmmoTier(tier) {
      const key = tier ? tier.id : '';
      if (key === lastTierKey) return;
      lastTierKey = key;
      const show = !!tier && tier.id !== 'standard';
      ammoTier.classList.toggle('show', show);
      if (!show) return;
      ammoTier.textContent = `${tier.name} warranty`;
      ammoTier.style.color = `#${tier.color.toString(16).padStart(6, '0')}`;
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

    // The running Flash Sale ({ label, discount 0..1, remaining seconds }) or null. Only touches the DOM when the text changes.
    setFlashSale(sale) {
      const text = sale ? `Flash sale · ${sale.label} ${Math.round(sale.discount * 100)}% off · ${Math.ceil(sale.remaining)}s` : '';
      if (text === lastSaleKey) return;
      lastSaleKey = text;
      saleTag.classList.toggle('show', !!sale);
      saleTag.textContent = text;
    },

    // Buy prompt: null hides it, else { label, verb, cost, canAfford, progress, denied, sale }.
    // (`sale`: true while a Flash Sale has discounted this price: the cost turns green with a SALE mark.)
    // `button` is the interact button for the device in use ("F", "X", "□").
    setInteract(info, button = 'F') {
      const key = info
        ? `${info.label}|${info.cost}|${info.canAfford}|${info.denied}|${button}|${info.progress.toFixed(2)}|${!!info.sale}`
        : '';
      if (key === lastInteractKey) return;
      lastInteractKey = key;
      interact.classList.toggle('show', !!info);
      if (!info) return;
      interactText.innerHTML = `Hold <kbd>${button}</kbd> to ${info.verb} ${info.label} <span class="cost">${info.cost}</span>`;
      interact.classList.toggle('cant', !info.canAfford);
      interact.classList.toggle('sale', !!info.sale);
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
