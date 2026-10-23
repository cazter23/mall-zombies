// =============================================================================
// DEBUG WINDOW: a small read-only overlay listing every debug key (config/debug.js `commands`, by group) with live
// numbers and the last result. Shown/hidden by the `panel` command (the ` key); it never takes clicks, so you can keep
// playing with it open. Plain DOM, refreshed a few times a second (debug.panel.refreshSeconds) only while visible.
//
//   const panel = createDebugPanel({ commands, status })   status() -> game/debugCommands.js status()
//   panel.update(frameTime)   call every rendered frame
//   panel.element, panel.visible
// =============================================================================

import { debug, keyLabel } from '../config/debug.js';

export function createDebugPanel({ commands = debug.commands, status, config = debug.panel }) {
  const root = document.createElement('div');
  root.className = 'debug-panel';
  root.setAttribute('aria-hidden', 'true');

  const title = document.createElement('div');
  title.className = 'debug-title';
  root.append(title);

  const live = document.createElement('div');
  live.className = 'debug-live';
  root.append(live);

  const groups = [...new Set(commands.map((c) => c.group))];
  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'debug-group';
    heading.textContent = group;
    root.append(heading);
    for (const c of commands.filter((cmd) => cmd.group === group)) {
      const row = document.createElement('div');
      row.className = 'debug-row';
      const key = document.createElement('kbd');
      key.textContent = (c.shift ? 'Shift+' : '') + keyLabel(c.key);
      const text = document.createElement('span');
      text.textContent = c.label;
      row.append(key, text);
      root.append(row);
    }
  }
  const last = document.createElement('div');
  last.className = 'debug-last';
  root.append(last);

  let visible = false;
  let timer = Infinity; // refresh on the first frame it is shown
  function refresh() {
    const s = status();
    title.textContent = `DEBUG  (${keyLabel('Backquote')} hides)`;
    live.textContent =
      `Round ${s.round} · ${s.points} pts · ${s.alive} zombies · spawn: ${s.zombieType}` +
      (s.god ? ' · GOD' : '') + (s.sale ? ` · SALE ${s.sale}` : '');
    last.textContent = s.last ? `> ${s.last}` : '';
  }

  return {
    element: root,
    get visible() {
      return visible;
    },
    // Show/hide to match the game's state (debug.panelOpen) and refresh the numbers a few times a second.
    update(frameTime) {
      const open = status().panelOpen;
      if (open !== visible) {
        visible = open;
        root.classList.toggle('show', open);
        timer = Infinity;
      }
      if (!visible) return;
      timer += frameTime;
      if (timer >= config.refreshSeconds) {
        timer = 0;
        refresh();
      }
    },
  };
}
