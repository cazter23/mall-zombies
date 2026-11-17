// =============================================================================
// THE MOVEMENT READOUT (debug mode: maps/testRange/moveTracker.js `view`, while you are in the test range's main hall). Speed now and
// the best of the last second, the stance, and what the last jump / drop, slide and vault did. The shooting gallery's panel style
// (style.css .range-readout). Only draws; redraws when the numbers change.
//
//   const readout = createMovementReadout()   (main.js appends readout.element)
//   readout.update(view | null)                null hides it
// =============================================================================

const m = (n) => `${n.toFixed(2)} m`;

export function createMovementReadout() {
  const element = document.createElement('div');
  element.className = 'range-readout movement-readout';
  element.hidden = true;
  let lastKey = '';

  const line = (label, value) => {
    const tr = document.createElement('tr');
    for (const text of [label, value]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    return tr;
  };

  return {
    element,
    update(view) {
      element.hidden = !view;
      if (!view) { lastKey = ''; return; }
      const shown = { ...view, speed: Math.round(view.speed * 10), topSpeed: Math.round(view.topSpeed * 10) };
      const key = JSON.stringify(shown);
      if (key === lastKey) return;
      lastKey = key;
      const title = document.createElement('div');
      title.className = 'range-title';
      title.textContent = 'Movement course';
      const table = document.createElement('table');
      const { air, fall, slide, vault } = view;
      table.append(
        line('Speed', `${view.speed.toFixed(1)} m/s (best ${view.topSpeed.toFixed(1)})`),
        line('Stance', view.stance),
        line('Last jump / drop', air ? `rose ${m(air.rise)} · ${m(air.distance)} far · dropped ${m(Math.max(0, air.drop))}` : '-'),
        line('Fall damage', fall ? `${Math.round(fall.damage)} (a ${m(fall.drop)} fall)` : air ? 'none' : '-'),
        line('Last slide', slide ? `${m(slide.distance)} in ${slide.seconds.toFixed(2)} s` : '-'),
        line('Last vault', vault ? m(vault.distance) : '-'),
      );
      const hint = document.createElement('div');
      hint.className = 'range-hint';
      hint.textContent = 'Signs on each station give the rule it shows.';
      element.replaceChildren(title, table, hint);
    },
  };
}
