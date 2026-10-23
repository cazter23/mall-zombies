// =============================================================================
// SCREENS: the menus around a run (plain DOM over the canvas).
//   'title'    the main menu: logo + Play / Settings / Controls over a live 3D flyover of the mall
//              (main.js renders it with ui/titleCamera.js while this screen is up)
//   'pause'    PAUSED + this run so far (round, points, time, kills): Resume / Restart run / Settings /
//              Controls / Quit to title. Restart and Quit ask twice ("click again to confirm"): they end the run.
//              show('pause', { fresh: true }) = "Back to work" (after Play again, if the mouse lock was refused)
//   'help'     How to play: the core loop on one page (numbers read from config, so it never goes stale); Back
//              returns to the screen it was opened from
//   'results'  death: a store RECEIPT of the run (time, round, kills, headshots, box cutter kills, accuracy,
//              total points), stamped CLOCKED OUT: Play again / Main menu
// One at a time: show(name, data) (null hides them all), `current`.
// Buttons emit ACTIONS: on(action, fn) with fn({ pad }) where pad = true when a controller pressed it (main.js
// then plays with the controller instead of asking for the mouse lock).
//   actions: 'play' 'resume' 'restart' 'quit' 'settings' 'controls' 'playAgain' 'mainMenu' ('help' / 'back' are handled here)
// padNav(input): D-pad up/down moves, A presses, B / Start = Resume on the pause screen, Start = Play on the
// title, Y = Settings and X = Controls on the title and pause screens.
// setFade(0..1): a black fade over the title flyover (between camera shots).
// =============================================================================

import { economy } from '../config/economy.js';
import { menuFeel } from '../config/settings.js';

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function createScreens() {
  const handlers = {};
  const emit = (action, pad = false) => handlers[action]?.({ pad });

  // --- Title -----------------------------------------------------------------------
  const title = el('div', 'screen title-screen hidden', `
    <div class="title-fade"></div>
    <div class="title-shade"></div>
    <div class="title-panel">
      <div class="kicker">Attention shoppers</div>
      <h1 class="title-logo">Mall<br />Zombies</h1>
      <p class="tagline">The mall is closed. The shoppers didn't get the memo.</p>
      <div class="menu-list">
        <button class="menu-btn primary" data-action="play" type="button">Play</button>
        <button class="menu-btn" data-action="help" type="button">How to play</button>
        <button class="menu-btn" data-action="settings" type="button">Settings</button>
        <button class="menu-btn" data-action="controls" type="button">Controls</button>
      </div>
      <p class="pad-hint">Controller: D-pad + <kbd>A</kbd> · <kbd>Start</kbd> to play · <kbd>Y</kbd> settings · <kbd>X</kbd> controls</p>
    </div>
    <div class="title-footer">Now hiring · No experience necessary · Must provide own staples</div>
  `);
  const fade = title.querySelector('.title-fade');

  // --- Pause -----------------------------------------------------------------------
  const pause = el('div', 'screen pause-screen hidden', `
    <div class="card pause-card">
      <div class="kicker pause-kicker">Paused</div>
      <h1 class="pause-title">On break</h1>
      <div class="pause-stats"></div>
      <div class="menu-list">
        <button class="menu-btn primary" data-action="resume" type="button">Resume</button>
        <button class="menu-btn" data-action="restart" data-confirm="Restart? Click again" type="button">Restart run</button>
        <button class="menu-btn" data-action="settings" type="button">Settings</button>
        <button class="menu-btn" data-action="controls" type="button">Controls</button>
        <button class="menu-btn danger" data-action="quit" data-confirm="Quit? Click again" type="button">Quit to title</button>
      </div>
      <p class="pad-hint">Controller: D-pad + <kbd>A</kbd> · <kbd>B</kbd> / <kbd>Start</kbd> resume · <kbd>Y</kbd> settings · <kbd>X</kbd> controls</p>
    </div>
  `);
  const pauseKicker = pause.querySelector('.pause-kicker');
  const pauseTitle = pause.querySelector('.pause-title');
  const pauseStats = pause.querySelector('.pause-stats');
  const resumeButton = pause.querySelector('[data-action="resume"]');

  // --- Results (the receipt) ---------------------------------------------------------
  const results = el('div', 'screen results-screen hidden', `
    <div class="receipt-wrap">
      <div class="receipt">
        <div class="receipt-store">MALL ZOMBIES</div>
        <div class="receipt-sub">Store #013 · Register 4</div>
        <div class="receipt-sub receipt-date"></div>
        <div class="receipt-sub">Cashier: YOU (deceased)</div>
        <div class="receipt-rule"></div>
        <div class="receipt-lines"></div>
        <div class="receipt-rule"></div>
        <div class="receipt-total"><span>Points earned</span><span class="receipt-total-value"></span></div>
        <div class="receipt-rule"></div>
        <div class="receipt-barcode"></div>
        <div class="receipt-thanks">Thank you for shopping with us<br />All sales final · No refunds · No respawns</div>
        <div class="receipt-stamp">Clocked out</div>
      </div>
      <div class="menu-list menu-row">
        <button class="menu-btn primary" data-action="playAgain" type="button">Play again</button>
        <button class="menu-btn" data-action="mainMenu" type="button">Main menu</button>
      </div>
      <p class="pad-hint">Controller: D-pad + <kbd>A</kbd></p>
    </div>
  `);
  const receiptDate = results.querySelector('.receipt-date');
  const receiptLines = results.querySelector('.receipt-lines');
  const receiptTotal = results.querySelector('.receipt-total-value');
  const barcode = results.querySelector('.receipt-barcode');

  // --- How to play ---------------------------------------------------------------------
  const pay = economy.payouts;
  const kill = economy.killValues.shopper;
  const help = el('div', 'screen help-screen hidden', `
    <div class="card help-card">
      <div class="kicker">Employee handbook</div>
      <h1 class="help-title">How to play</h1>
      <div class="help-grid">
        <div><b>Survive</b><p>Zombies come in rounds. Every round brings more of them, and tougher. You have one life.</p></div>
        <div><b>Earn</b><p>+${pay.nonLethalHit} for every hit, +${kill} for a kill. Headshot kills +${pay.headshotKillBonus} more, box cutter kills +${pay.meleeKillBonus}.</p></div>
        <div><b>Spend</b><p>Hold <kbd>F</kbd> / <kbd>X</kbd> to buy: shutters open new parts of the mall, guns hang on the walls, the RESTOCK-O-MATIC refills ammo.</p></div>
        <div><b>Upgrade</b><p>Customer Service sells Extended Warranties (more damage). The Food Court stores fit attachments to the gun in your hand.</p></div>
        <div><b>Listen</b><p>The PA announces Flash Sales: one kind of item gets 25-50% cheaper for a short time.</p></div>
        <div><b>Move</b><p>Sprint, slide (<kbd>C</kbd>), vault counters (<kbd>Space</kbd>), go prone (<kbd>Ctrl</kbd> / <kbd>LB</kbd>), slash with the box cutter (<kbd>V</kbd>). Space / A gets you up from prone. Stand still and they surround you.</p></div>
      </div>
      <div class="menu-list menu-row">
        <button class="menu-btn primary" data-action="back" type="button">Back</button>
      </div>
      <p class="pad-hint">Controller: <kbd>A</kbd> / <kbd>B</kbd> back</p>
    </div>
  `);

  const screens = { title, pause, results, help };
  for (const node of Object.values(screens)) document.body.append(node);
  let current = null;
  let focus = 0;
  let helpReturn = 'title'; // where Back on the help page goes

  // Buttons: click (or A) runs the action. A "confirm" button needs a second press within a few seconds.
  const armed = new Map(); // button -> timeout id
  function press(button, pad) {
    const confirmText = button.dataset.confirm;
    if (confirmText && !armed.has(button)) {
      const label = button.textContent;
      button.textContent = confirmText;
      button.classList.add('armed');
      armed.set(button, setTimeout(() => {
        button.textContent = label;
        button.classList.remove('armed');
        armed.delete(button);
      }, menuFeel.confirmSeconds * 1000));
      button.dataset.label = label;
      return;
    }
    if (armed.has(button)) {
      clearTimeout(armed.get(button));
      armed.delete(button);
      button.textContent = button.dataset.label;
      button.classList.remove('armed');
    }
    const action = button.dataset.action;
    if (action === 'help') return api.show('help', { from: current });
    if (action === 'back') return api.show(helpReturn);
    emit(action, pad);
  }
  for (const node of Object.values(screens)) {
    node.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      press(button, false);
    }));
  }

  const buttonsOf = (name) => [...screens[name].querySelectorAll('[data-action]')];
  function markFocus(show) {
    if (!current) return;
    buttonsOf(current).forEach((b, i) => b.classList.toggle('focused', show && i === focus));
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const clock = (seconds) => `${Math.floor(seconds / 60)}:${pad2(Math.floor(seconds % 60))}`;

  function fillPause({ fresh = false, round = 0, points = 0, time = 0, kills = 0 } = {}) {
    pauseKicker.textContent = fresh ? 'Fresh shift' : 'Paused';
    pauseTitle.textContent = fresh ? 'Back to work' : 'On break';
    resumeButton.textContent = fresh ? 'Start shift' : 'Resume';
    pauseStats.innerHTML = fresh ? '' : [
      ['Round', round], ['Points', points.toLocaleString('en-US')], ['Time', clock(time)], ['Kills', kills],
    ].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
  }

  function fillResults(r) {
    const now = new Date();
    receiptDate.textContent = `${now.toLocaleDateString('en-US')} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const lines = [
      ['Shift length', clock(r.timeAlive)],
      ['Rounds survived', r.round],
      ['Zombies cleared', r.kills],
      ['  Headshots', r.headshotKills],
      ['  Box cutter', r.meleeKills],
      ['Accuracy', `${Math.round(r.accuracy * 100)}%`],
    ];
    receiptLines.innerHTML = lines
      .map(([label, value]) => `<div class="receipt-line"><span>${label.replace(/^ {2}/, '&nbsp;&nbsp;')}</span><i></i><span>${value}</span></div>`)
      .join('');
    receiptTotal.textContent = r.pointsEarned.toLocaleString('en-US');
    // A barcode: bars of random widths (different every receipt).
    let bars = '';
    for (let i = 0; i < 46; i++) bars += `<span style="width:${1 + Math.floor(Math.random() * 3)}px;margin-right:${1 + Math.floor(Math.random() * 2)}px"></span>`;
    barcode.innerHTML = bars;
  }

  const api = {
    get current() {
      return current;
    },

    // Should the title flyover be drawn behind? (the title itself, or How to play opened from it)
    get showsFlyover() {
      return current === 'title' || (current === 'help' && helpReturn === 'title');
    },

    on(action, fn) {
      handlers[action] = fn;
    },

    show(name, data) {
      for (const [key, node] of Object.entries(screens)) node.classList.toggle('hidden', key !== name);
      for (const [button, timer] of armed) {
        clearTimeout(timer);
        button.textContent = button.dataset.label;
        button.classList.remove('armed');
      }
      armed.clear();
      current = name ?? null;
      focus = 0;
      if (name === 'pause') fillPause(data);
      if (name === 'results') fillResults(data);
      if (name === 'help') helpReturn = data?.from ?? 'title';
      markFocus(false);
    },

    setFade(opacity) {
      fade.style.opacity = String(opacity);
    },

    padNav(input) {
      if (!current) return;
      const buttons = buttonsOf(current);
      const step = (input.consumePress('PadDown') || input.consumePress('PadRight') ? 1 : 0)
        - (input.consumePress('PadUp') || input.consumePress('PadLeft') ? 1 : 0);
      if (step) {
        focus = (focus + step + buttons.length) % buttons.length;
        markFocus(true);
      }
      if (current === 'help' && input.consumePress('PadB')) return api.show(helpReturn);
      if (current === 'pause' && (input.consumePress('PadB') || input.consumePress('PadStart'))) return emit('resume', true);
      if (current === 'title' && input.consumePress('PadStart')) return emit('play', true);
      if ((current === 'title' || current === 'pause') && input.consumePress('PadY')) return emit('settings', true);
      if ((current === 'title' || current === 'pause') && input.consumePress('PadX')) return emit('controls', true);
      if (input.consumePress('PadA')) {
        markFocus(true);
        press(buttons[focus], true);
      }
    },
  };
  return api;
}
