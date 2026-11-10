// =============================================================================
// HUD
// Plain HTML on top of the canvas: crosshair + hit marker, health and stamina
// bars, ammo counter, points (+ pop-ups), round counter and banner, reload
// prompt, buy prompt (with hold progress). The menus (title, pause, results receipt) are
// ui/screens.js, created here and exposed as hud.screens.
// =============================================================================

import { feel } from '../config/feel.js';
import { createScreens } from './screens.js';
import { createIncentiveHud } from './incentiveHud.js';
import { createRitualHud } from './ritualHud.js';
import { createOrderFormView } from './orderForm.js';
import { createFittingRoomView } from './fittingRoomPicker.js';
import { createBagMarker } from './bagMarker.js';
import { createBirthCertificate } from './birthCertificate.js';
import { gunLabel } from '../config/workshop.js';
import { createAnnouncements } from './announcements.js';
import { ui } from '../config/ui.js';
import { upgrades } from '../config/upgrades.js';
import { createOutfitRail } from './outfitRail.js';
import { createBossFlashView } from './bossFlash.js';
import { createNoticeHistory } from './noticeHistory.js';

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function createHud() {
  const hud = el('div', 'hud');
  const history = createNoticeHistory();
  const phoneFlash = createBossFlashView();
  hud.append(phoneFlash.element);
  const incentives = createIncentiveHud();
  hud.append(incentives.element);
  const ritualTicket = createRitualHud();
  hud.append(ritualTicket.element);
  const orderFormView = createOrderFormView();
  hud.append(orderFormView.element);
  const fittingRoomView = createFittingRoomView();
  hud.append(fittingRoomView.element);
  const bagMarker = createBagMarker();
  hud.append(bagMarker.element);
  const certificate = createBirthCertificate();
  hud.append(certificate.element);

  // Red glow around the screen edges when hurt (under everything else in the HUD).
  const hurt = el('div', 'hurt');
  hud.append(hurt);
  let lastHurt = -1;

  // Poppy Corn's butter on the screen ('mascotPopBlast' with butter): greasy blobs that fade away.
  const butter = el('div', 'butter-splat');
  hud.append(butter);
  function splatButter(seconds) {
    butter.style.transition = 'none';
    butter.style.opacity = '1';
    void butter.offsetWidth; // (restart the fade)
    butter.style.transition = `opacity ${seconds}s ease-in`;
    butter.style.opacity = '0';
  }

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
  const interactTitle = el('strong', 'interact-title');
  const interactPrice = el('div', 'interact-price');
  const interactOriginal = el('s', 'interact-original');
  const interactCost = el('span', 'cost');
  interactPrice.append(interactOriginal, interactCost);
  const interactDetail = el('div', 'interact-detail');
  const interactAction = el('div', 'interact-action');
  const interactButton = el('kbd');
  const interactHold = el('span'); interactHold.textContent = 'Hold';
  interactAction.append(interactButton, interactHold);
  const interactStatus = el('div', 'interact-status');
  interactText.append(interactAction, interactTitle, interactPrice, interactDetail, interactStatus);
  const interactBar = el('div', 'interact-bar');
  const interactFill = el('div', 'interact-fill');
  interactBar.append(interactFill);
  interact.append(interactText, interactBar);
  hud.append(interact);
  let lastInteractKey = '';
  let lastInteractDetail = '';
  const purchaseStamp = el('div', 'purchase-stamp');
  purchaseStamp.setAttribute('role', 'status');
  hud.append(purchaseStamp);
  let purchaseTimer = null;
  function clearNotices() {
    announcements.clear();
    clearTimeout(purchaseTimer);
    purchaseStamp.classList.remove('show');
    roundBanner.classList.remove('show');
    certificate.hide();
  }

  // Bottom-right, above the ammo: points, with "+60" pop-ups floating up from it.
  const points = el('div', 'points');
  const pointsValue = el('div', 'points-value');
  const pointsLabel = el('span', 'hud-label'); pointsLabel.textContent = 'Store credit';
  // Under it, once you have some: GRAB-A-GUN's prize tickets (game/tickets.js; not points).
  const ticketsValue = el('div', 'points-tickets');
  ticketsValue.hidden = true;
  points.append(pointsLabel, pointsValue, ticketsValue);
  hud.append(points);
  let lastPoints = null;
  let lastTickets = null;

  // Top-left: the round number (flashes during the break between rounds).
  const roundCounter = el('div', 'round-counter');
  const roundLabel = el('span', 'hud-label'); roundLabel.textContent = 'Round';
  const roundValue = el('strong', 'round-value');
  roundCounter.append(roundLabel, roundValue);
  hud.append(roundCounter);
  // Middle of the screen: "ROUND 3" announcement when a round starts.
  const roundBanner = el('div', 'round-banner');
  roundBanner.style.setProperty('--round-seconds', `${ui.roundSeconds}s`);
  roundBanner.addEventListener('animationend', () => roundBanner.classList.remove('show'));
  hud.append(roundBanner);

  const bossBar = el('section', 'boss-bar');
  bossBar.hidden = true;
  const bossKicker = el('div', 'boss-kicker');
  bossKicker.hidden = true;
  const bossWarning = el('span', 'boss-warning');
  bossWarning.textContent = '!';
  bossWarning.setAttribute('aria-hidden', 'true');
  const bossNotice = el('span', 'boss-notice');
  bossKicker.append(bossWarning, bossNotice);
  const bossName = el('strong', 'boss-name');
  const bossTitle = el('span', 'hud-label');
  const bossHealth = el('progress', 'boss-health');
  bossBar.append(bossKicker, bossName, bossTitle, bossHealth);
  hud.append(bossBar);
  let displayedBoss = null;

  // A small intercom unit: permanent station identification above the current message.
  const announceBanner = el('div', 'announce-banner');
  announceBanner.style.animationDuration = `${ui.announcementSeconds}s`;
  const announceSpeaker = el('div', 'pa-speaker');
  announceSpeaker.setAttribute('aria-hidden', 'true');
  const announceDisplay = el('div', 'pa-display');
  const announceHeader = el('div', 'pa-header');
  const announceStation = el('span', 'pa-station');
  announceStation.textContent = 'SG · Public address';
  const announceIndicator = el('span', 'pa-indicator');
  announceIndicator.textContent = ''; // the existing lamp indicates transmission
  announceIndicator.setAttribute('aria-hidden', 'true');
  announceHeader.append(announceStation, announceIndicator);
  const announceKicker = el('div', 'announce-kicker');
  const announceText = el('div', 'announce-text');
  announceDisplay.append(announceHeader, announceKicker, announceText);
  announceBanner.append(announceSpeaker, announceDisplay);
  announceBanner.setAttribute('role', 'status');
  const announcements = createAnnouncements({
    show({ kicker = '', text, flavor = false }, seconds) {
      announceBanner.setAttribute('data-flavor', String(flavor));
      announceKicker.hidden = !kicker || kicker.toLowerCase() === 'galleria public address';
      announceBanner.style.animationDuration = `${seconds}s`;
      announceKicker.textContent = kicker;
      announceText.textContent = text;
      announceBanner.classList.remove('show');
      void announceBanner.offsetWidth;
      announceBanner.classList.add('show');
    },
    hide() { announceBanner.classList.remove('show'); },
  });
  hud.append(announceBanner);

  // Top middle: the Flash Sale running now ("FLASH SALE · Wall guns 30% OFF · 0:32").
  const saleTag = el('div', 'sale-tag');
  hud.append(saleTag);
  let lastSaleKey = '';
  // Under it: where GRAB-A-GUN is while it's open (game/features/clawMachine.js status).
  const clawTag = el('div', 'sale-tag claw-tag');
  hud.append(clawTag);
  let lastClawKey = '';

  // Bottom-right: ammo counter.
  const ammo = el('div', 'ammo');
  ammo.innerHTML = `
    <div class="ammo-count"><span class="ammo-mag"></span><span class="ammo-reserve"></span></div>
    <div class="ammo-name"></div>
    <div class="ammo-tier"></div>
    <div class="ammo-upgrades"></div>
  `;
  const ammoMag = ammo.querySelector('.ammo-mag');
  const ammoReserve = ammo.querySelector('.ammo-reserve');
  const ammoName = ammo.querySelector('.ammo-name');
  const ammoTier = ammo.querySelector('.ammo-tier');
  const ammoUpgrades = ammo.querySelector('.ammo-upgrades');
  let lastUpgradeKey = null;
  let lastTierKey = null;
  hud.append(ammo);
  let lastAmmoKey = '';

  // Bottom-left: health bar on top, stamina (sprint) bar underneath.
  const vitals = el('div', 'vitals');
  const health = el('div', 'health');
  const healthFill = el('div', 'health-fill');
  health.setAttribute('aria-label', 'Health');
  health.setAttribute('role', 'meter');
  health.setAttribute('aria-valuemin', '0'); health.setAttribute('aria-valuemax', '100');
  health.append(healthFill);
  const sprint = el('div', 'sprint');
  const sprintFill = el('div', 'sprint-fill');
  sprint.setAttribute('aria-label', 'Stamina');
  sprint.setAttribute('role', 'meter');
  sprint.setAttribute('aria-valuemin', '0'); sprint.setAttribute('aria-valuemax', '100');
  sprint.append(sprintFill);
  // The outfit rail (ui/outfitRail.js): four price tags over the health bar, empty silhouettes from round 1.
  const outfitRail = createOutfitRail({ variant: 'hud' });
  vitals.append(outfitRail.el, health, sprint);
  hud.append(vitals);

  // FPS counter (Settings > Video), top right.
  const fpsCounter = el('div', 'fps');
  hud.append(fpsCounter);
  let lastFps = -1;

  // Flowing lanes keep growing rewards/PA copy clear of other tickets and bosses.
  const leftStack = el('div', 'hud-left-stack');
  leftStack.append(roundCounter, incentives.element, ritualTicket.element);
  const topStack = el('div', 'hud-top-stack');
  topStack.append(bossBar, roundBanner, bagMarker.element);
  const rightStack = el('div', 'hud-right-stack');
  rightStack.append(saleTag, clawTag, announceBanner, certificate.element);
  hud.append(leftStack, topStack, rightStack);
  // A workshop order starts below any active boss display. Measure its real
  // height, including wrapped names and the player's chosen text size.
  const updateOrderTop = () => hud.style.setProperty('--hud-order-top', `${Math.ceil(topStack.offsetTop + topStack.offsetHeight + 12)}px`);
  if (typeof ResizeObserver === 'function') new ResizeObserver(updateOrderTop).observe(topStack);
  // The menus around a run (title / pause / results receipt): ui/screens.js.
  const screens = createScreens();
  document.body.append(hud);

  let lastHealth = -1;
  let lastFraction = -1;
  let lastExhausted = null;
  let lastFull = null;
  let uiScale = 1, textSize = 1;
  const refreshTextLayout = () => document.documentElement.classList.toggle('ui-expanded', uiScale * textSize > 1.35);

  return {
    // The title / pause / results screens (ui/screens.js): show(), on(action), padNav(), current.
    screens,
    history,

    setUiScale(value) { uiScale = value; document.documentElement.style.setProperty('--ui-scale', value); refreshTextLayout(); },
    setTextSize(value) { textSize = value; document.documentElement.style.setProperty('--ui-text-scale', value); refreshTextLayout(); },

    setBoss(zombie) {
      if (zombie !== displayedBoss) {
        displayedBoss = zombie;
        bossBar.hidden = !zombie;
        bossBar.setAttribute('data-boss', zombie?.type.id ?? '');
        bossBar.classList.toggle('boss-bar-janitor', zombie?.type.id === 'janitor');
        bossKicker.hidden = !zombie?.type.barNotice;
        if (zombie) {
          bossWarning.textContent = zombie.type.barSymbol ?? '!';
          bossNotice.textContent = zombie.type.barNotice ?? '';
          bossName.textContent = zombie.type.name;
          bossTitle.textContent = zombie.type.title;
          bossHealth.setAttribute('aria-label', `${zombie.type.name} health`);
          bossHealth.max = zombie.maxHealth;
        }
      }
      if (zombie) {
        bossHealth.value = Math.max(0, zombie.health);
        if (zombie.followers !== undefined) bossNotice.textContent = `${zombie.type.barNotice}: ${Math.floor(zombie.followers)}%`;
      }
    },

    // Peripheral feedback listens to the existing event bus; no purchase callbacks in gameplay.
    connectEvents(events) {
      phoneFlash.connect(events);
      events.on('purchase', ({ label, kind, id, cost }) => {
        clearTimeout(purchaseTimer);
        purchaseStamp.textContent = kind === 'fittingRoom' ? `Changed into ${label}`
          : kind === 'workshop' || kind === 'ritual' ? label : `${kind === 'attachment' && cost === 0 ? 'Refitted' : 'Purchased'}: ${kind === 'attachment' ? upgrades.attachments[id]?.name ?? label : label}`;
        purchaseStamp.classList.remove('show');
        void purchaseStamp.offsetWidth;
        purchaseStamp.classList.add('show');
        purchaseTimer = setTimeout(() => purchaseStamp.classList.remove('show'), ui.purchaseSeconds * 1000);
      });
      events.on('wardrobeChange', ({ slot, worn }) => outfitRail.setSlot(slot, worn));
      events.on('outfitPulse', ({ slot }) => outfitRail.pulse(slot)); // (game/outfitRail.js: the item just did its job)
      events.on('runReset', () => outfitRail.clear());
      events.on('runReset', clearNotices);
      events.on('runReset', () => { history.clear(); incentives.reset(); });
      events.on('playerDeath', clearNotices);
      events.on('mascotPopBlast', ({ butter: buttered, butterSeconds }) => {
        if (buttered) splatButter(butterSeconds);
      });
    },

    setPowerUps(status) {
      incentives.update(status);
    },

    // Build-A-Blaster's order ticket: null hides it (game/features/workshopRitual.js status).
    setRitual(status) {
      ritualTicket.update(status);
    },

    // Build-A-Blaster's order form: null hides it. labels = button names for the device in use.
    setOrderForm(view, labels) {
      orderFormView.update(view, labels);
      hud.classList.toggle('menu-open', !!view); // (no crosshair over the form)
    },

    // The fitting-room picker: null hides it (game/features/fittingRoomPicker.js view). Same labels as the order form.
    setFittingRoom(view, labels) {
      fittingRoomView.update(view, labels);
      hud.classList.toggle('fitting-open', !!view);
    },

    // A dropped Limited Edition's direction: null hides it (game/features/limitedEditions.js status).
    setLimitedEdition(status) {
      bagMarker.update(status);
    },

    // The Birth Certificate, at collection: { name, gunName, combo, stuffing, heart, quality, kills, round, remark, note }.
    showCertificate(fields) {
      history.addCertificate(fields);
      certificate.show(fields);
    },

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
      if (dimmed) clearNotices();
    },

    // Dead: hide the combat HUD (crosshair, ammo, prompts).
    setDead(dead) {
      hud.classList.toggle('dead', dead);
      if (dead) clearNotices();
    },

    // --- Points ---
    setPoints(value) {
      if (value === lastPoints) return;
      pointsValue.textContent = value.toLocaleString('en-US');
      lastPoints = value;
    },

    // Prize tickets: hidden until you have some (and again at 0).
    setTickets(count) {
      if (count === lastTickets) return;
      lastTickets = count;
      ticketsValue.hidden = !(count > 0);
      ticketsValue.textContent = `${count.toLocaleString('en-US')} ticket${count === 1 ? '' : 's'}`;
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
      roundValue.textContent = n > 0 ? String(n).padStart(2, '0') : '—';
    },

    // A PA-style announcement: { kicker, text, priority? }. Queue/preempt rather than overwrite.
    showAnnouncement(message) {
      history.addMessage(message);
      if (!message.archiveOnly) announcements.push(message);
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
    setVoucher(voucher) {
      let ticket = hud.querySelector('.boss-voucher');
      if (!ticket) {
        ticket = document.createElement('div');
        ticket.className = 'boss-voucher';
        rightStack.insertBefore(ticket, announceBanner);
      }
      ticket.hidden = !voucher;
      ticket.textContent = voucher ? `Voucher: ${voucher.name}` : '';
    },

    setHealth(fraction) {
      const rounded = Math.round(Math.max(0, Math.min(1, fraction)) * 200) / 200;
      if (rounded !== lastHealth) {
        healthFill.style.transform = `scaleX(${rounded})`;
        health.setAttribute('aria-valuenow', String(Math.round(rounded * 100)));
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
      hitMarkerTimeout = setTimeout(() => { hitMarker.className = 'hitmarker'; }, feel.effects.hitMarkerSeconds * 1000);
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
      ammoTier.textContent = tier.name;
      ammoTier.dataset.tier = tier.id; // (Platinum shimmers: retail.css)
      ammoTier.style.color = `#${tier.color.toString(16).padStart(6, '0')}`;
    },

    // The held gun's upgrades as a row of chips under its name, so you never need to inspect it: Warranty Renewals (gold stars), the Build-A-Blaster
    // build (a swatch in the stuffing's colour and its quality) and one pip per attachment slot (lit when fitted). Called every frame; only touches the DOM on a change.
    // info: { renewals, build: { color, label } | null, slots: [{ name, fitted }] }
    // build.accent: the Heart's colour (config/gunStyle.js heart), a second dot after the stuffing's swatch.
    setUpgradeRow(info) {
      const key = info ? `${info.renewals}|${info.build?.color}|${info.build?.accent}|${info.build?.label}|${info.slots.map((x) => (x.fitted ? 1 : 0)).join('')}` : '';
      if (key === lastUpgradeKey) return;
      lastUpgradeKey = key;
      const chips = [];
      const chipOf = (className, text) => { const chip = el('span', className); if (text) chip.textContent = text; return chip; };
      if (info?.renewals) chips.push(chipOf('upgrade-chip upgrade-stars', '★'.repeat(info.renewals)));
      if (info?.build) {
        const chip = chipOf('upgrade-chip upgrade-build', info.build.label);
        chip.style.setProperty('--swatch', `#${info.build.color.toString(16).padStart(6, '0')}`);
        if (info.build.accent !== null) chip.style.setProperty('--accent', `#${info.build.accent.toString(16).padStart(6, '0')}`); // the Heart's badge colour
        chips.push(chip);
      }
      if (info?.slots.some((x) => x.fitted)) {
        const pips = chipOf('upgrade-chip upgrade-pips');
        for (const slot of info.slots) {
          const pip = el('i', slot.fitted ? 'on' : '');
          pip.title = slot.name;
          pips.append(pip);
        }
        chips.push(pips);
      }
      ammoUpgrades.replaceChildren(...chips);
      ammoUpgrades.classList.toggle('show', chips.length > 0);
    },

    // Called every frame with the held weapon; only touches the DOM when something changed.
    // `reloadLabel`: the reload button for the device in use ("R", "X", "□").
    setAmmo(weapon, reloadLabel = 'R') {
      const name = gunLabel(weapon.def);
      const tank = weapon.def.fuel ? (weapon.fuel.locked ? 'dry' : 'tank') : null; // a gun with a fuel tank (the Leaf Blower): its level is the count, no reserve
      const key = `${name}|${weapon.magazine}|${weapon.reserve}|${weapon.isReloading}|${reloadLabel}|${tank}`;
      if (key === lastAmmoKey) return;
      lastAmmoKey = key;
      ammoMag.textContent = weapon.magazine;
      ammoReserve.textContent = tank ? ' fuel' : ` / ${weapon.reserve}`;
      ammoName.textContent = name;
      ammo.classList.toggle('low', weapon.magazine <= feel.effects.lowAmmoThreshold);

      let text = '';
      if (tank) text = tank === 'dry' ? 'Out of fuel' : '';
      else if (weapon.isReloading) text = 'Reloading...';
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

    // GRAB-A-GUN's whereabouts: null (or a closed machine) hides it.
    setClawMachine(status) {
      const text = status?.open ? `GRAB-A-GUN · ${status.area} · ${status.stock} left` : '';
      if (text === lastClawKey) return;
      lastClawKey = text;
      clawTag.classList.toggle('show', !!text);
      clawTag.textContent = text;
    },

    // Buy prompt: null hides it, else { label, verb, cost, canAfford, progress, denied, sale }.
    // (`sale`: true while a Flash Sale has discounted this price: the cost turns green with a SALE mark.)
    // `button` is the interact button for the device in use ("F", "X", "□").
    setInteract(info, button = 'F') {
      const key = info
        ? JSON.stringify([info.blocked, info.title, info.label, info.verb, info.detail, info.kind, info.cost, info.originalCost, info.shortfall, info.canAfford, info.denied, button, info.progress.toFixed(2), !!info.sale])
        : '';
      if (key === lastInteractKey) return;
      lastInteractKey = key;
      interact.classList.toggle('show', !!info);
      if (!info) return;
      interactTitle.textContent = info.title ?? info.label;
      interactCost.textContent = info.priceLabel ?? (info.owned ? 'Owned · Free' : info.cost.toLocaleString('en-US'));
      interactOriginal.hidden = !info.sale || !(info.originalCost > info.cost);
      interactOriginal.textContent = `${(info.originalCost ?? info.cost).toLocaleString('en-US')}`;
      // Ordinary purchases need one line. Keep the terms only where they affect an upgrade decision.
      const detail = ['attachment', 'workshop', 'ritual', 'tier', 'wardrobe', 'fittingRoom', 'claw', 'clawAction', 'prize'].includes(info.kind) ? info.detail ?? '' : '';
      if (detail !== lastInteractDetail) {
        lastInteractDetail = detail;
        // (detailLines: the Wardrobe's generated stat lines, each an upside or a downside)
        const tone = new Map((info.detailLines ?? []).map(({ text, good }) => [text, good ? ' interact-good' : ' interact-bad']));
        interactDetail.replaceChildren(...detail.split(' · ').filter(Boolean).map(term => {
          const line = el('span', `${term.includes('→') ? 'interact-term interact-change' : 'interact-term'}${tone.get(term) ?? ''}`);
          line.textContent = term;
          return line;
        }));
      }
      interactButton.textContent = button;
      interactStatus.textContent = info.blocked ?? (!info.canAfford ? `Need ${(info.shortfall ?? 0).toLocaleString('en-US')} more` : '');
      interact.classList.toggle('cant', !info.canAfford || !!info.blocked);
      interact.classList.toggle('sale', !!info.sale);
      interact.classList.toggle('denied', info.denied);
      interactFill.style.transform = `scaleX(${info.progress})`;
    },

    setSprint(fraction, exhausted, active) {
      const rounded = Math.round(fraction * 200) / 200;
      if (rounded !== lastFraction) {
        sprintFill.style.transform = `scaleX(${rounded})`;
        sprint.setAttribute('aria-valuenow', String(Math.round(rounded * 100)));
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
