// Direction, name and distance for a floor pickup, with time remaining for a shopping bag (game/bagDrops.js).
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
    /** Null hides the marker. Persistent pickups omit seconds. */
    update(status) {
      element.hidden = !status;
      if (!status) {
        lastText = '';
        return;
      }
      arrow.style.transform = `rotate(${status.bearing}rad)`;
      const line = `${status.name} · ${status.meters} m${status.floor ? ` ${status.floor}` : ''}${status.seconds == null ? '' : ` · ${status.seconds}s`}`;
      if (line === lastText) return;
      lastText = line;
      text.textContent = line;
    },
  };
}
