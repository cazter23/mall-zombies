// A small employee punch card, plus the incentive currently on the floor / active benefits.
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
  burst: '<path d="M12 2l2.1 5.6L20 6.5l-3.6 4.7L22 14l-5.7 1.8L17.5 22 12 18.4 6.5 22l1.2-6.2L2 14l5.6-2.8L4 6.5l5.9 1.1z"/>',
  ticket: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z"/>',
  eye: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6zm10 3.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>',
  spill: '<path d="M12 3s-5 5.6-5 9.2a5 5 0 0 0 10 0C17 8.6 12 3 12 3zM5 19h14v2H5z"/>',
  clearance: '<path d="M12 2c2.8 0 4.5 2.1 4.5 4.8V11l2.8 2.8v2.2h-4.6L16 20H8l1.3-4H4.7v-2.2L7.5 11V6.8C7.5 4.1 9.2 2 12 2z"/>',
  commission: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.5v11M9.2 9.5h5.2M9.2 14.5h5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  blackFriday: '<path d="M4.5 3.5h8.2l7.8 7.8-7.7 7.7L5 11.2V3.5zm3.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
  stockroom: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9zm9 4.5 9-4.5M12 12v9M12 12 3 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  cross: '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5V4z"/>',
};

function incentiveIconSvg(id) {
  const def = powerUps.types[id];
  const iconKey = def?.icon ?? (id === 'stockroomDelivery' ? 'stockroom' : 'ticket');
  const body = icons[iconKey] ?? icons.ticket;
  return `<svg class="incentive-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${body}</svg>`;
}

export function createIncentiveHud() {
  const element = document.createElement('div');
  element.className = 'incentive-hud';
  const label = document.createElement('div');
  label.className = 'incentive-label';
  const progress = document.createElement('progress');
  progress.className = 'incentive-progress';
  progress.max = 1;
  progress.value = 0;
  progress.setAttribute('aria-label', 'Employee incentive progress');
  const drop = document.createElement('div');
  drop.className = 'incentive-drop';
  const zone = document.createElement('div');
  zone.className = 'incentive-zone';
  const heading = document.createElement('div');
  heading.className = 'incentive-heading';
  heading.textContent = 'Employee rewards';
  element.append(heading, label, progress, drop, zone);
  let lastKey = '';
  const taught = new Set();
  let activeIds = new Set(), teaching = new Set();
  let hasMeterProgress = false;
  return {
    element,
    reset() { taught.clear(); activeIds.clear(); teaching.clear(); lastKey = ''; hasMeterProgress = false; element.hidden = true; },
    update(status) {
      element.hidden = !status;
      if (!status) return;
      const { pickup, available, effects = [] } = status;
      const ids = new Set(effects.map(effect => effect.id));
      for (const id of ids) if (!activeIds.has(id)) {
        if (!taught.has(id)) { teaching.add(id); taught.add(id); } else teaching.delete(id);
      }
      for (const id of activeIds) if (!ids.has(id)) teaching.delete(id);
      activeIds = ids;
      if (status.progress > 0) hasMeterProgress = true;
      const showProgress = available && status.round >= powerUps.firstRound && hasMeterProgress;
      element.hidden = !showProgress && !pickup && !effects.length;
      heading.hidden = !showProgress;
      label.hidden = !showProgress;
      progress.hidden = !showProgress;
      const percent = Math.floor(status.progress * 100);
      const benefitText = effects.map(effect => {
        const def = powerUps.types[effect.id];
        const count = effect.charges != null ? ` · ${effect.charges} LEFT`
          : effect.healing != null ? ` · ${Math.ceil(effect.healing)} HP LEFT` : '';
        return `${def.name} · ${Math.ceil(effect.remaining)}s${count} · ${def.hint}`;
      }).join('\n');
      const key = `${status.round}|${available}|${percent}|${pickup?.id}|${Math.ceil(pickup?.remaining ?? 0)}|${benefitText}`;
      if (key === lastKey) return;
      lastKey = key;
      label.textContent = available ? `PROGRESS · ${percent}%`
        : status.round < powerUps.firstRound ? `BEGINS ROUND ${powerUps.firstRound}` : 'ROUND ALLOWANCE USED';
      progress.value = status.progress;
      drop.classList.toggle('jackpot', Boolean(pickup && powerUps.types[pickup.id]?.tier === 'jackpot'));
      drop.textContent = '';
      if (pickup) {
        drop.innerHTML = `${incentiveIconSvg(pickup.id)}${escapeHtml(`${pickupName(pickup.id)} · COLLECT · ${Math.ceil(pickup.remaining)}s`)}`;
      }
      const rows = effects.map(effect => {
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
    },
  };
}
