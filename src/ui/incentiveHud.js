// A small employee punch card, plus the incentive currently on the floor / active zone.
import { powerUps } from '../config/powerUps.js';

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
  element.append(label, progress, drop, zone);
  let lastKey = '';
  return {
    element,
    update(status) {
      element.hidden = !status;
      if (!status) return;
      const { pickup, active, available } = status;
      const percent = Math.floor(status.progress * 100);
      const key = `${status.round}|${available}|${percent}|${pickup?.id}|${Math.ceil(pickup?.remaining ?? 0)}|${Math.ceil(active?.remaining ?? 0)}`;
      if (key === lastKey) return;
      lastKey = key;
      label.textContent = available ? `EMPLOYEE INCENTIVES · ${percent}%`
        : status.round < powerUps.firstRound ? `INCENTIVES BEGIN ROUND ${powerUps.firstRound}` : 'ROUND INCENTIVE ALLOWANCE USED';
      progress.value = status.progress;
      drop.textContent = pickup ? `${powerUps.types[pickup.id].name} · COLLECT · ${Math.ceil(pickup.remaining)}s` : '';
      zone.textContent = active ? `BLUE LIGHT SPECIAL · ${Math.ceil(active.remaining)}s · DOUBLE KILL CREDIT IN BLUE ZONE` : '';
    },
  };
}
