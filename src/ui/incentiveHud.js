// A small employee punch card ("Employee of the hour"), plus the incentive currently on the floor / active benefits.
import { powerUps } from '../config/powerUps.js';
import { bossVouchers } from '../config/bosses.js';

// What is lying on the floor: an incentive, or a boss's voucher (Master Key, Signed Approval, Discount Code), which
// is not in powerUps.types. An id neither knows is shown as itself rather than throwing inside render (a throw there
// stops the frame loop for good: core/loop.js).
const pickupName = (id) => (powerUps.types[id] ?? bossVouchers[id])?.name ?? id;

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const icons = {
  shift: '<path d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V3l3.5 2.5L12 8V4z"/><path d="M12 8v4l2.8 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  shield: '<path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.7 7.5 10 4.3-1.3 7.5-5.4 7.5-10v-6L12 2.5zm0 4.5v10m-3.5-6.5 3.5-2.5 3.5 2.5"/>',
  burst: '<path fill-rule="evenodd" d="M8.5 7V5.2a3.5 3.5 0 0 1 7 0V7H19l1.2 13H3.8L5 7h3.5zm2 0h3V5.2a1.5 1.5 0 0 0-3 0V7zM12 9.2l1.1 2.4 2.6-.4-1.6 2 1.8 1.9-2.5.7.5 2.5L12 16.7l-1.9 1.6.5-2.5-2.5-.7 1.8-1.9-1.6-2 2.6.4L12 9.2z"/>',
  ticket: '<path fill-rule="evenodd" d="M4.5 5h9l6.5 6.5-6.5 6.5L5 9.5V5zm3.2 2.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/>',
  eye: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6zm10 3.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>',
  spill: '<path d="M5 10h11l-1.4 9H6.4L5 10zm11-7 2 1.2-5 8.8-2-1.1L16 3zM3 20.5h18V22H3z"/>',
  clearance: '<path d="M12 2c2.8 0 4.5 2.1 4.5 4.8V11l2.8 2.8v2.2h-4.6L16 20H8l1.3-4H4.7v-2.2L7.5 11V6.8C7.5 4.1 9.2 2 12 2z"/>',
  commission: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.5v11M9.2 9.5h5.2M9.2 14.5h5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  blackFriday: '<path d="M4.5 3.5h8.2l7.8 7.8-7.7 7.7L5 11.2V3.5zm3.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
  stockroom: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9zm9 4.5 9-4.5M12 12v9M12 12 3 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  cross: '<path fill-rule="evenodd" d="M8.5 4h7V6H20a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 6h4.5V4zm2 2h3v1.5h-3V6zm.2 4h2.6v2.2h2.2v2.6h-2.2V17h-2.6v-2.2H8.5v-2.6h2.2V10z"/>',
  door: '<path fill-rule="evenodd" d="M7.5 15a4.5 4.5 0 1 1 3.9-6.7H21v3.4h-2.2v2.3h-2.4v-2.3h-5A4.5 4.5 0 0 1 7.5 15zm0-2.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z"/>',
};

/** Shared inline SVG icon for both the HUD pickup card and the Survival Guide. */
export function incentiveIconSvg(id, className = 'incentive-icon') {
  const def = powerUps.types[id] ?? bossVouchers[id];
  const iconKey = def?.icon ?? (id === 'stockroomDelivery' ? 'stockroom' : 'ticket');
  const body = icons[iconKey] ?? icons.ticket;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${body}</svg>`;
}

const DEFAULT_METER = () => ({
  round: 0,
  unlocked: false,
  available: false,
  capped: false,
  nearFull: false,
  progress: 0,
  dropped: 0,
  maxPerRound: powerUps.maxPerRound,
});

function meterFromStatus(status) {
  const round = status.round ?? powerUps.firstRound;
  const unlocked = status.unlocked ?? (round >= powerUps.firstRound);
  const available = status.available ?? false;
  const capped = status.capped ?? (unlocked && !available);
  const progress = Math.max(0, Math.min(1, status.progress ?? 0));
  const nearFull = status.nearFull ?? (available && progress >= powerUps.meter.nearFullFraction);
  return {
    round,
    unlocked,
    available,
    capped,
    nearFull,
    progress,
    dropped: status.dropped ?? 0,
    maxPerRound: status.maxPerRound ?? powerUps.maxPerRound,
  };
}

export function createIncentiveHud({ onNearFull = null } = {}) {
  const element = document.createElement('div');
  element.className = 'incentive-hud';
  const heading = document.createElement('div');
  heading.className = 'incentive-heading';
  heading.textContent = powerUps.meter.heading;
  const meterBox = document.createElement('div');
  meterBox.className = 'incentive-meter';
  const label = document.createElement('div');
  label.className = 'incentive-label';
  const progress = document.createElement('progress');
  progress.className = 'incentive-progress';
  progress.max = 1;
  progress.value = 0;
  progress.setAttribute('aria-label', `${powerUps.meter.heading} progress`);
  meterBox.append(label, progress);
  const drop = document.createElement('div');
  drop.className = 'incentive-drop';
  const zone = document.createElement('div');
  zone.className = 'incentive-zone';
  element.append(heading, meterBox, drop, zone);

  let enabled = true;
  let busMeter = null;
  let lastStatus = null;
  let deadHidden = false;
  let lastKey = '';
  let wasNearFull = false;
  const taught = new Set();
  let activeIds = new Set(), teaching = new Set();

  function render() {
    if (deadHidden || (lastStatus === null && !busMeter)) {
      element.hidden = true;
      return;
    }
    const status = lastStatus ?? {};
    const { pickup = null, effects = [] } = status;
    const meter = busMeter ?? (('progress' in status || 'round' in status || 'available' in status || 'unlocked' in status)
      ? meterFromStatus(status)
      : DEFAULT_METER());

    const ids = new Set(effects.map((effect) => effect.id));
    for (const id of ids) if (!activeIds.has(id)) {
      if (!taught.has(id)) { teaching.add(id); taught.add(id); } else teaching.delete(id);
    }
    for (const id of activeIds) if (!ids.has(id)) teaching.delete(id);
    activeIds = ids;

    const showMeter = enabled && meter.unlocked;
    const nearFullGlow = showMeter && meter.nearFull && !meter.capped;
    const showCapped = showMeter && meter.capped;
    const percent = Math.floor(meter.progress * 100);
    const benefitText = effects.map((effect) => {
      const def = powerUps.types[effect.id];
      const count = effect.charges != null ? ` · ${effect.charges} LEFT`
        : effect.healing != null ? ` · ${Math.ceil(effect.healing)} HP LEFT` : '';
      return `${def.name} · ${Math.ceil(effect.remaining)}s${count} · ${def.hint}`;
    }).join('\n');

    element.hidden = !showMeter && !pickup && !effects.length;
    heading.hidden = !showMeter;
    meterBox.hidden = !showMeter;
    label.hidden = !showMeter;
    progress.hidden = !showMeter;
    element.classList.toggle('is-near-full', nearFullGlow);
    element.classList.toggle('is-capped', showCapped);
    meterBox.classList.toggle('is-near-full', nearFullGlow);
    meterBox.classList.toggle('is-capped', showCapped);

    const key = `${showMeter}|${meter.round}|${meter.available}|${showCapped}|${nearFullGlow}|${percent}|${pickup?.id}|${Math.ceil(pickup?.remaining ?? 0)}|${benefitText}`;
    if (key === lastKey) return;
    lastKey = key;

    label.textContent = showCapped ? powerUps.meter.cappedLabel
      : nearFullGlow ? `${powerUps.meter.readyLabel} · ${percent}%`
        : meter.unlocked ? `PROGRESS · ${percent}%`
          : `BEGINS ROUND ${powerUps.firstRound}`;
    progress.value = showCapped ? 1 : meter.progress;

    drop.classList.toggle('jackpot', Boolean(pickup && powerUps.types[pickup.id]?.tier === 'jackpot'));
    drop.textContent = '';
    if (pickup) {
      drop.innerHTML = `${incentiveIconSvg(pickup.id)}${escapeHtml(`${pickupName(pickup.id)} · COLLECT · ${Math.ceil(pickup.remaining)}s`)}`;
    }
    const rows = effects.map((effect) => {
      const def = powerUps.types[effect.id];
      const count = effect.charges != null ? ` · ${effect.charges} LEFT`
        : effect.healing != null ? ` · ${Math.ceil(effect.healing)} HP LEFT` : '';
      return {
        id: effect.id,
        jackpot: def.tier === 'jackpot',
        title: `${def.name} · ${Math.ceil(effect.remaining)}s${count}`,
        hint: def.hint,
        teach: teaching.has(effect.id),
      };
    });
    zone.replaceChildren(...rows.map(({ id, jackpot, title, hint, teach }) => {
      const row = document.createElement('div');
      row.className = jackpot ? 'incentive-effect jackpot' : 'incentive-effect';
      const name = document.createElement('strong');
      name.innerHTML = `${incentiveIconSvg(id)}${escapeHtml(title)}`;
      const detail = document.createElement('span');
      detail.textContent = hint;
      detail.hidden = !teach;
      row.append(name, detail);
      return row;
    }));
  }

  return {
    element,
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      if (!enabled) wasNearFull = false;
      lastKey = '';
      render();
    },
    setMeter(meter) {
      if (!meter) {
        busMeter = null;
        wasNearFull = false;
      } else {
        busMeter = meterFromStatus(meter);
        const nowNear = busMeter.unlocked && !busMeter.capped && busMeter.nearFull;
        if (enabled && nowNear && !meter.silent && !wasNearFull) onNearFull?.();
        wasNearFull = nowNear;
      }
      render();
    },
    reset() {
      taught.clear();
      activeIds.clear();
      teaching.clear();
      busMeter = null;
      lastStatus = null;
      deadHidden = false;
      lastKey = '';
      wasNearFull = false;
      element.classList.remove('is-near-full', 'is-capped');
      meterBox.classList.remove('is-near-full', 'is-capped');
      element.hidden = true;
    },
    update(status) {
      lastStatus = status;
      if (!status) {
        deadHidden = true;
        element.hidden = true;
        return;
      }
      deadHidden = false;
      if (!busMeter && ('progress' in status || 'round' in status || 'available' in status || 'unlocked' in status)) {
        const synthetic = meterFromStatus(status);
        const nowNear = synthetic.unlocked && !synthetic.capped && synthetic.nearFull;
        if (enabled && nowNear && !wasNearFull) onNearFull?.();
        wasNearFull = nowNear;
      }
      render();
    },
  };
}
