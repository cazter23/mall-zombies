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
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Debug shortcuts');

  const title = document.createElement('div');
  title.className = 'debug-title';
  root.append(title);

  const live = document.createElement('div');
  live.className = 'debug-live';
  root.append(live);

  const selections = document.createElement('div');
  selections.className = 'debug-selections';
  function statusField(label) {
    const field = document.createElement('div');
    field.className = 'debug-selection';
    const heading = document.createElement('span');
    heading.textContent = label;
    const value = document.createElement('strong');
    field.append(heading, value);
    selections.append(field);
    return value;
  }
  // Each heading names the key from the command table, so a rebind (god mode moved from G to B) can't leave it stale.
  const keyOf = (id) => {
    const c = commands.find((cmd) => cmd.id === id);
    return c ? (c.shift ? 'Shift+' : '') + keyLabel(c.key) : '?';
  };
  const enemy = statusField(`${keyOf('spawn')} spawns`);
  const gun = statusField(`${keyOf('giveGun')} gives next`);
  const god = statusField(`${keyOf('god')} toggles god mode`);
  const boss = statusField('Boss in play');
  const nextBoss = statusField(`${keyOf('summonBoss')} summons`);
  root.append(selections);
  const columns = document.createElement('div');
  columns.className = 'debug-groups';
  root.append(columns);

  const groups = [...new Set(commands.map((c) => c.group))];
  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'debug-group';
    heading.textContent = group;
    const section = document.createElement('section');
    section.append(heading);
    columns.append(section);
    for (const c of commands.filter((cmd) => cmd.group === group)) {
      const row = document.createElement('div');
      row.className = 'debug-row';
      const key = document.createElement('kbd');
      key.textContent = (c.shift ? 'Shift+' : '') + keyLabel(c.key);
      const text = document.createElement('span');
      text.textContent = c.label;
      row.append(key, text);
      section.append(row);
    }
  }
  const last = document.createElement('div');
  last.className = 'debug-last';
  root.append(last);
  const hint = document.createElement('div');
  hint.className = 'debug-hint-line';
  hint.textContent = 'Shortcuts run during play. The panel and benchmark also work while paused.';
  root.append(hint);

  let visible = false;
  let timer = Infinity; // refresh on the first frame it is shown
  function refresh() {
    const s = status();
    title.textContent = `Debug shortcuts · ${keyLabel('Backquote')} to hide`;
    live.textContent =
      `Round ${s.round} · ${s.points} pts · ${s.alive} alive` +
      (s.sale ? ` · SALE ${s.sale}` : '');
    enemy.textContent = s.zombieType;
    gun.textContent = s.nextGun;
    god.textContent = s.god ? 'GOD ON' : 'God off';
    god.classList.toggle('debug-on', s.god);
    boss.textContent = s.boss ?? 'None';
    nextBoss.textContent = s.nextBoss ?? 'None';
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
        root.setAttribute('aria-hidden', String(!open));
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
