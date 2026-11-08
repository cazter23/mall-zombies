// Build-A-Blaster's order ticket: one bar for how far along it is, what the room has put in the tank, and how long is left.
export function createRitualHud() {
  const element = document.createElement('div');
  element.className = 'ritual-hud';
  element.hidden = true;
  const heading = document.createElement('div');
  heading.className = 'ritual-heading';
  const stage = document.createElement('div');
  stage.className = 'ritual-stage';
  const gauge = document.createElement('div');
  gauge.className = 'ritual-gauge';
  const bar = document.createElement('div');
  bar.className = 'ritual-bar';
  const fill = document.createElement('i');
  bar.append(fill);
  element.append(heading, stage, bar, gauge);
  let lastKey = '';
  return {
    element,
    update(status) {
      element.hidden = !status;
      if (!status) {
        lastKey = '';
        return;
      }
      const { phase, gunName, kills, quality, next, secondsLeft } = status;
      const key = `${phase}|${gunName}|${status.stage}|${kills}|${quality.id}|${Math.ceil(secondsLeft)}|${status.waiting}|${Math.round(status.progress * 100)}`;
      if (key === lastKey) return;
      lastKey = key;
      heading.textContent = gunName;
      // One bar: how far along it is. Kills in the room push it on, and fill the tank.
      fill.style.transform = `scaleX(${status.progress})`;
      element.classList.toggle('ritual-done', phase === 'ready');
      if (phase === 'ready') {
        stage.textContent = status.waiting ? `At the Naming Booth · it would replace your ${status.waiting}` : 'Done · coming back to you';
        gauge.textContent = `${quality.name} · ${kills} in the tank`;
        return;
      }
      stage.textContent = `${Math.ceil(secondsLeft)}s remaining`;
      gauge.textContent = next ? `${quality.name} · ${kills}/${next.minKills} → ${next.name}` : `${kills} in the tank · ${quality.name}`;
    },
  };
}
