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
  const heading = document.createElement('div');
  heading.className = 'incentive-heading';
  heading.textContent = 'Employee rewards';
  element.append(heading, label, progress, drop, zone);
  let lastKey = '';
  return {
    element,
    update(status) {
      element.hidden = !status;
      if (!status) return;
      const { pickup, active, available, effects = [] } = status;
      const percent = Math.floor(status.progress * 100);
      const benefitText = effects.map(effect => {
        const def = powerUps.types[effect.id];
        const count = effect.charges != null ? ` · ${effect.charges} LEFT` : effect.healing != null ? ` · ${Math.ceil(effect.healing)} HP LEFT` : '';
        return `${def.name} · ${Math.ceil(effect.remaining)}s${count} · ${def.hint}`;
      }).join('\n');
      const key = `${status.round}|${available}|${percent}|${pickup?.id}|${Math.ceil(pickup?.remaining ?? 0)}|${Math.ceil(active?.remaining ?? 0)}|${benefitText}`;
      if (key === lastKey) return;
      lastKey = key;
      label.textContent = available ? `EMPLOYEE INCENTIVES · ${percent}%`
        : status.round < powerUps.firstRound ? `INCENTIVES BEGIN ROUND ${powerUps.firstRound}` : 'ROUND INCENTIVE ALLOWANCE USED';
      progress.value = status.progress;
      drop.textContent = pickup ? `${powerUps.types[pickup.id].name} · COLLECT · ${Math.ceil(pickup.remaining)}s` : '';
      zone.textContent = [active ? `BLUE LIGHT SPECIAL · ${Math.ceil(active.remaining)}s · DOUBLE KILL CREDIT IN BLUE ZONE` : '', benefitText].filter(Boolean).join('\n');
      zone.setAttribute('style', 'white-space: pre-line');
    },
  };
}
