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
  const taught = new Set();
  let activeIds = new Set(), teaching = new Set();
  let hasMeterProgress = false;
  return {
    element,
    reset() { taught.clear(); activeIds.clear(); teaching.clear(); lastKey = ''; hasMeterProgress = false; element.hidden = true; },
    update(status) {
      element.hidden = !status;
      if (!status) return;
      const { pickup, active, available, effects = [] } = status;
      const ids = new Set(effects.map(effect => effect.id));
      if (active) ids.add('blueLightSpecial');
      for (const id of ids) if (!activeIds.has(id)) {
        if (!taught.has(id)) { teaching.add(id); taught.add(id); } else teaching.delete(id);
      }
      for (const id of activeIds) if (!ids.has(id)) teaching.delete(id);
      activeIds = ids;
      if (status.progress > 0) hasMeterProgress = true;
      const showProgress = available && status.round >= powerUps.firstRound && hasMeterProgress;
      element.hidden = !showProgress && !pickup && !active && !effects.length;
      heading.hidden = !showProgress;
      label.hidden = !showProgress;
      progress.hidden = !showProgress;
      const percent = Math.floor(status.progress * 100);
      const benefitText = effects.map(effect => {
        const def = powerUps.types[effect.id];
        const count = effect.charges != null ? ` · ${effect.charges} LEFT` : effect.healing != null ? ` · ${Math.ceil(effect.healing)} HP LEFT` : '';
        return `${def.name} · ${Math.ceil(effect.remaining)}s${count} · ${def.hint}`;
      }).join('\n');
      const key = `${status.round}|${available}|${percent}|${pickup?.id}|${Math.ceil(pickup?.remaining ?? 0)}|${Math.ceil(active?.remaining ?? 0)}|${benefitText}`;
      if (key === lastKey) return;
      lastKey = key;
      label.textContent = available ? `PROGRESS · ${percent}%`
        : status.round < powerUps.firstRound ? `BEGINS ROUND ${powerUps.firstRound}` : 'ROUND ALLOWANCE USED';
      progress.value = status.progress;
      drop.textContent = pickup ? `${powerUps.types[pickup.id].name} · COLLECT · ${Math.ceil(pickup.remaining)}s` : '';
      const rows = effects.map(effect => {
        const def = powerUps.types[effect.id];
        const count = effect.charges != null ? ` · ${effect.charges} LEFT` : effect.healing != null ? ` · ${Math.ceil(effect.healing)} HP LEFT` : '';
        return { title: `${def.name} · ${Math.ceil(effect.remaining)}s${count}`, hint: def.hint, teach: teaching.has(effect.id) };
      });
      if (active) rows.unshift({ title: `BLUE LIGHT SPECIAL · ${Math.ceil(active.remaining)}s`, hint: 'BONUS KILL CREDIT IN BLUE ZONE', teach: teaching.has('blueLightSpecial') });
      zone.replaceChildren(...rows.map(({ title, hint, teach }) => {
        const row = document.createElement('div'); row.className = 'incentive-effect';
        const name = document.createElement('strong'); name.textContent = title;
        const detail = document.createElement('span'); detail.textContent = hint; detail.hidden = !teach;
        row.append(name, detail);
        return row;
      }));
    },
  };
}
