// Build-A-Blaster's order ticket: where your gun is, what the room has put in the tank, and how long is left.
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
  element.append(heading, stage, gauge);
  let lastKey = '';
  return {
    element,
    update(status) {
      element.hidden = !status;
      if (!status) {
        lastKey = '';
        return;
      }
      if (status.phase === 'picking') {
        const key = `picking|${status.stuffing}|${status.heart}`;
        if (key === lastKey) return;
        lastKey = key;
        heading.textContent = 'Build-A-Blaster · Your order';
        stage.textContent = `Stuffing: ${status.stuffing ?? 'pick one from the bins'}`;
        gauge.textContent = `Heart: ${status.heart ?? 'pick one from the wall'}`;
        return;
      }
      const { phase, gunName, kills, quality, next, secondsLeft } = status;
      const key = `${phase}|${gunName}|${status.stage}|${kills}|${quality.id}|${Math.ceil(secondsLeft)}`;
      if (key === lastKey) return;
      lastKey = key;
      heading.textContent = `Build-A-Blaster · ${gunName}`;
      if (phase === 'ready') {
        stage.textContent = 'Ready at the Naming Booth';
        gauge.textContent = `${quality.name} · ${kills} in the tank`;
        return;
      }
      stage.textContent = `${status.stage} · ${Math.ceil(secondsLeft)}s`;
      gauge.textContent = next ? `${kills} in the tank · ${next.minKills} for ${next.name}` : `${kills} in the tank · ${quality.name}`;
    },
  };
}
