// Where a dropped Limited Edition is: an arrow, its name, how far and how long is left. Bags only last a moment, and one dropped behind you is easy to miss.
export function createBagMarker() {
  const element = document.createElement('div');
  element.className = 'bag-marker';
  element.hidden = true;
  const arrow = document.createElement('span');
  arrow.className = 'bag-arrow';
  const text = document.createElement('span');
  element.append(arrow, text);
  let lastText = '';
  return {
    element,
    /** status: game/features/limitedEditions.js drops.status, or null to hide it. */
    update(status) {
      element.hidden = !status;
      if (!status) {
        lastText = '';
        return;
      }
      arrow.style.transform = `rotate(${status.bearing}rad)`;
      const line = `${status.name} · ${status.meters} m${status.floor ? ` ${status.floor}` : ''} · ${status.seconds}s`;
      if (line === lastText) return;
      lastText = line;
      text.textContent = line;
    },
  };
}
