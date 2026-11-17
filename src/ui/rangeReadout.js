// =============================================================================
// THE SHOOTING GALLERY'S READOUT (debug mode only): draws maps/testRange/gallery.js `view` while you stand in the gallery.
// The target round and health, the gun in hand, the latest hits (damage, head or body, distance, the share of damage the distance
// left, a kill), and per target: your hit rate and its last kill (hit shots, seconds). Only draws; redraws when the view changes.
//
//   const readout = createRangeReadout()   (main.js appends readout.element)
//   readout.update(view | null)            null hides it
// =============================================================================

const pct = (n) => `${Math.round(n * 100)}%`;
const num = (n) => Math.round(n).toLocaleString('en-US');

export function createRangeReadout() {
  const element = document.createElement('div');
  element.className = 'range-readout';
  element.hidden = true;
  let lastKey = '';

  const cell = (tag, text, className = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const row = (cells, className = '') => {
    const tr = document.createElement('tr');
    if (className) tr.className = className;
    for (const c of cells) tr.append(cell('td', c));
    return tr;
  };

  return {
    element,
    update(view) {
      element.hidden = !view;
      if (!view) { lastKey = ''; return; }
      const key = JSON.stringify(view);
      if (key === lastKey) return;
      lastKey = key;

      const hits = document.createElement('table');
      hits.append(row(['Target', 'Damage', 'Where', 'Distance', 'Range left'], 'range-head'));
      if (!view.hits.length) hits.append(row(['No hits yet', '', '', '', '']));
      for (const h of view.hits) {
        hits.append(row([`${h.target} m`, num(h.damage) + (h.killed ? ' KILL' : ''), h.part === 'head' ? 'Head' : 'Body',
          h.distance == null ? '-' : `${h.distance.toFixed(1)} m`, h.falloff == null ? '-' : pct(h.falloff)], h.killed ? 'range-kill' : ''));
      }

      const lanes = document.createElement('table');
      lanes.append(row(['Target', 'Hit rate', 'Last kill'], 'range-head'));
      for (const l of view.lanes) {
        lanes.append(row([`${l.distance} m`, l.rate == null ? '-' : `${pct(l.rate)} (${l.hitShots}/${l.shots})`,
          l.lastKill ? `${l.lastKill.hits} hit${l.lastKill.hits === 1 ? '' : 's'} · ${l.lastKill.seconds.toFixed(2)} s` : '-']));
      }

      element.replaceChildren(
        cell('div', `Shooting gallery · Round ${view.round} · ${num(view.health)} health`, 'range-title'),
        cell('div', view.gun ? `In hand: ${view.gun}` : '', 'range-gun'),
        cell('div', 'Latest hits', 'range-section'), hits,
        cell('div', 'By distance', 'range-section'), lanes,
        cell('div', 'F at the counter: easier / harder targets (clears the numbers)', 'range-hint'),
      );
    },
  };
}
