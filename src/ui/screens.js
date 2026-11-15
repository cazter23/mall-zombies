// =============================================================================
// SCREENS: the menus around a run (plain DOM over the canvas).
//   'title'    the main menu: logo + Play / Statistics / Settings / Controls over a live 3D flyover of the mall
//              (main.js renders it with ui/titleCamera.js while this screen is up)
//   'runMode' Directed / Classic choice over the title flyover (config/closingTime.js modes). The remembered mode is focused
//              (setRunMode). A mode button emits 'startRun' and the chooser STAYS UP until play really starts: `startRequested`
//              is true from that press until the next show() (ui/runStart.js). Its third choice, Extra Modes, opens:
//   'arenaMode' the arenas (config/arenas.js): one button each with its line and best round (setArenaBests); an arena button
//              emits 'startRun' with { arena } like a mode button. Back (button, B, Esc) returns to 'runMode' on Extra Modes.
//              The last arena chosen (setArenaChoice) makes Extra Modes the focused choice, and that arena inside it.
//   'pause'    PAUSED + this run so far (round, points, time, kills): Resume / Restart run / Settings /
//              Controls / Quit to title. Restart and Quit ask twice ("click again to confirm"): they end the run.
//              show('pause', { fresh: true }) = "Back to work" (after Play again, if the mouse lock was refused)
//              Save & quit (asks twice) shows with data.canSave ({ ok, reason }: greyed with the reason when it can't save).
//              The title shows "Continue · Round N" above Play while a save exists: setContinue({ round } | null).
//   'help'     How to play: the core loop on one page (numbers read from config, so it never goes stale); Back
//              returns to the screen it was opened from
//   'stats'    persistent employee record: career totals, personal bests and recent completed runs
//   'results'  death: a store RECEIPT of the run (time, round, kills, headshots, box cutter kills, accuracy,
//              total points), stamped CLOCKED OUT: Play again / Main menu
// One at a time: show(name, data) (null hides them all), `current`.
// Buttons emit ACTIONS: on(action, fn) with fn({ pad }) where pad = true when a controller pressed it (main.js
// then plays with the controller instead of asking for the mouse lock).
//   'startRun' also carries { mode, arena } (one of them null). 'play' opens the chooser here.
//   actions: 'startRun' 'continue' 'resume' 'restart' 'saveQuit' 'quit' 'settings' 'controls' 'stats' 'clearStats' 'statsBack'
//            'playAgain' 'mainMenu' ('help' / 'back' are handled here)
// padNav(input): the shared controller model (core/menuNav.js + ui/menuFocus.js): D-pad / left stick moves to the nearest
// button that way (skipping hidden and greyed ones), A presses, B backs (Resume on the pause screen), the right stick or a
// held trigger scrolls the screen (the receipt), Start = Resume on the pause screen and Play (or Continue, with a save) on
// the title, Y = Settings and X = Controls on the title and pause screens. With a controller in use the cursor shows at once.
// The hint lines are data-hint (ui/glyphs.js): the buttons of the device used last.
// setFade(0..1): a black fade over the title flyover (between camera shots).
// =============================================================================

import { economy } from '../config/economy.js';
import { gunSkin, locker as lockerCfg } from '../config/skins.js';
import { challengeBoard as boardCfg } from '../config/challengeBoard.js';
import { guide as guideCfg } from '../config/guide.js';
import { closingTime } from '../config/closingTime.js';
import { arenas, arenaById } from '../config/arenas.js';
import { receiptArtHtml, returnSlipHtml, overtimeCouponHtml } from './receiptArt.js';
import { createOutfitRail } from './outfitRail.js';
import { outfitRail as outfitCfg } from '../config/wardrobe.js';
import { menuFeel } from '../config/settings.js';
import { survivorLine } from '../config/workshop.js';
import { getDeathReport } from '../config/deathReports.js';
import { createFocusList, menuNav, scrollPage, TICK } from './menuFocus.js';
import { hintHtml, glyphHtml } from './glyphs.js';

export { getDeathReport };

const hintLine = (id) => `<p class="pad-hint" data-hint="${id}">${hintHtml(id)}</p>`;

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

const pad2 = (n) => String(n).padStart(2, '0');
const clock = (seconds) => `${Math.floor(seconds / 60)}:${pad2(Math.floor(seconds % 60))}`;

/** The lines above the receipt's total: [label, value]. "Survived by" only appears if you named a gun at Build-A-Blaster. */
export function receiptLinesFor(r) {
  const lines = [
    ['Shift length', clock(r.timeAlive)],
    ['Rounds survived', r.round],
    ['Zombies cleared', r.kills],
    ['  Headshots', r.headshotKills],
    ['  Box cutter', r.meleeKills],
    ['Bosses defeated', r.bossesDefeated ?? 0],
    ['Accuracy', `${Math.round(r.accuracy * 100)}%`],
  ];
  if (arenaById(r.arena)) lines.unshift([arenas.receiptLabel, arenaById(r.arena).name]); // (arena survival: first, it names the arena)
  if (r.closingDone != null) lines.push([closingTime.title, closingTime.receiptProgress(r.closingDone, Object.keys(closingTime.lines).length)]);
  if (r.won && !r.shiftComplete) {
    lines.push([closingTime.receipt.clockedOut, `Round ${r.winRound} · ${clock(r.winTime)}`]);
    lines.push([closingTime.receipt.overtimeRounds, r.overtimeRounds ?? 0]);
  }
  if (r.survivedBy?.length) lines.push(['Survived by', r.survivedBy.map(survivorLine).join(' and ')]);
  if (r.skinsUnlocked?.length) lines.push([lockerCfg.receiptLabel, lockerCfg.receiptNames(r.skinsUnlocked.map(({ gunId, skinId }) => gunSkin(gunId, skinId)?.name).filter(Boolean))]);
  if (r.secondChanceUsed) lines.push(['Second Chance', 'Used']);
  // GRAB-A-GUN (game/tickets.js): tickets aren't points, so they're a line of their own, never in the totals.
  if (r.ticketsWon > 0) lines.push(['Prize tickets won', r.ticketsWon]);
  if (r.keychains > 0) lines.push(['Sunny keychains', `${r.keychains} (non-refundable)`]);
  return lines;
}

export function evaluatePerformance(r = {}) {
  const round = r.round ?? 1;
  const timeAlive = r.timeAlive ?? 0;
  const kills = r.kills ?? 0;
  const headshotKills = r.headshotKills ?? 0;
  const meleeKills = r.meleeKills ?? 0;
  const accuracy = r.accuracy ?? 0;
  const pointsRemaining = r.pointsRemaining ?? 0;
  const shotsFired = r.shotsFired ?? 0;

  if (round >= 8 || timeAlive >= 480) {
    return {
      title: 'UNAUTHORIZED OVERTIME',
      rating: 'CODE: OT-99 // VIOLATION',
      comment: 'Shift exceeded scheduled operational hours. Overtime wages denied per corporate policy.',
    };
  }

  if (round >= 6 && kills >= 45 && accuracy >= 0.5) {
    return {
      title: 'EMPLOYEE OF THE MONTH',
      rating: 'RATING: EXCEEDS EXPECTATIONS (A+)',
      comment: 'Exemplary floor coverage. Designated parking spot awarded posthumously.',
    };
  }

  if (meleeKills >= 8 || (kills >= 6 && meleeKills / Math.max(1, kills) >= 0.35)) {
    return {
      title: 'BOX CUTTER ENTHUSIAST',
      rating: 'RATING: LOSS PREVENTION HERO',
      comment: 'Severe stock clearance using manual utility blade. Janitorial staff notified.',
    };
  }

  if (kills >= 8 && accuracy >= 0.55 && (headshotKills / Math.max(1, kills)) >= 0.6) {
    return {
      title: 'MARKDOWN SPECIALIST',
      rating: 'RATING: PRECISION TAGGER',
      comment: 'Exceptional staple economy. Corporate commends surgical head-level markdowns.',
    };
  }

  if (pointsRemaining >= 2500) {
    return {
      title: 'WINDOW SHOPPER',
      rating: 'CODE: UNCLAIMED STIPEND',
      comment: 'Retained excessive store credit without reinvesting in survival. Budget revoked.',
    };
  }

  if (shotsFired >= 40 && accuracy < 0.25) {
    return {
      title: 'CANVASSING SPECIALIST',
      rating: 'CODE: EXCESS SHRINKAGE',
      comment: 'Significant drywall collateral reported. Restocking fees deducted from final check.',
    };
  }

  if (shotsFired >= 250) {
    return {
      title: 'BULK CONSUMER',
      rating: 'CODE: SUPPLY DEPLETION',
      comment: 'Exhausted entire store ammunition requisition. Restock warehouse backlog pending.',
    };
  }

  if (round <= 2 && timeAlive < 90) {
    return {
      title: 'FAILED PROBATION',
      rating: 'STATUS: IMMEDIATE TERMINATION',
      comment: 'Failed 90-second orientation period. Vest and nametag must be returned to HR.',
    };
  }

  return {
    title: 'GENERAL CASUALTY',
    rating: 'STATUS: SHIFT CONCLUDED',
    comment: 'Standard associate casualty. Replacement cashier position posted to regional bulletin.',
  };
}

export function createScreens({ locker = null, guide = null, challenges = null, now = () => performance.now() } = {}) {
  const books = { locker, guide, challenges }; // screens that own their DOM, preview and pad navigation (ui/locker.js, ui/guide.js, ui/challengeBoard.js)
  const handlers = {};
  const emit = (action, pad = false) => handlers[action]?.({ pad });

  // --- Title -----------------------------------------------------------------------
  const title = el('div', 'screen title-screen hidden', `
    <div class="title-fade"></div>
    <div class="title-shade"></div>
    <div class="title-panel">
      <div class="directory-brand" aria-hidden="true">
        <svg class="directory-sun" viewBox="0 0 120 80"><defs><clipPath id="sun-disc"><circle cx="60" cy="39" r="35" /></clipPath></defs><g clip-path="url(#sun-disc)" fill="currentColor"><path d="M20 0h80v40H20zM20 45h80v6H20zM20 56h80v5H20zM20 66h80v4H20zM20 75h80v3H20z" /></g></svg>
        <span>Shopping · Dining · Eternal employment</span>
      </div>
      <div class="kicker">Welcome to your forever mall</div>
      <h1 class="title-logo">Sunset<br />Galleria</h1>
      <p class="tagline">The mall is closed. The shoppers didn't get the memo.</p>
      <p class="tagline title-note" hidden></p>
      <div class="directory-heading">Galleria directory <span>You are here ↓</span></div>
      <div class="menu-list directory-list">
        <button class="menu-btn primary save-continue" data-action="continue" type="button">Continue</button>
        <button class="menu-btn primary" data-action="play" type="button">Play</button>
        <button class="menu-btn" data-action="help" type="button">How to play</button>
        <button class="menu-btn" data-action="stats" type="button">Statistics</button>
        <button class="menu-btn" data-action="locker" type="button">${lockerCfg.menu}</button>
        ${challenges ? `<button class="menu-btn" data-action="challenges" type="button">${boardCfg.menu}</button>` : ''}
        <button class="menu-btn" data-action="guide" type="button">${guideCfg.menu}</button>
        <button class="menu-btn" data-action="settings" type="button">Settings</button>
        <button class="menu-btn" data-action="controls" type="button">Controls</button>
      </div>
      ${hintLine('title')}
    </div>
    <div class="title-footer"><b>OPEN UNTIL FURTHER NOTICE</b><span>Notice will not be provided. · Now hiring · Must provide own staples</span></div>
  `);
  const modeCfg = closingTime.modes;
  const modeIds = modeCfg.list.map(({ id }) => id);
  const arenaCfg = arenas.menu;
  let preferredMode = modeCfg.default; // focused on the chooser and drawn as its primary button (setRunMode: the remembered choice)
  let preferredArena = null; // the arena chosen last (setArenaChoice): Extra Modes is focused instead, and this arena inside it
  let startRequested = false; // a mode was confirmed and play has not started yet (the mouse lock can be refused)
  const runMode = el('div', 'screen title-screen hidden', `
    <div class="title-fade"></div>
    <div class="title-shade"></div>
    <div class="title-panel">
      <div class="kicker">${modeCfg.kicker}</div>
      <h1>${modeCfg.title}</h1>
      <div class="menu-list">${modeCfg.list.map(({ id, label, description }) => `
        <button class="menu-btn" data-action="${id}" aria-describedby="${id}-description" type="button">${label}</button>
        <p id="${id}-description">${description}</p>`).join('')}
        <button class="menu-btn" data-action="extraModes" aria-describedby="extraModes-description" type="button">${arenaCfg.label}</button>
        <p id="extraModes-description">${arenaCfg.description}</p>
        <button class="menu-btn" data-action="modeBack" type="button">${modeCfg.back}</button>
      </div>
      ${hintLine('runMode')}
    </div>
  `);
  // EXTRA MODES (config/arenas.js): arena survival, one button per arena with its line and the best round filed in it.
  const arenaMode = el('div', 'screen title-screen hidden', `
    <div class="title-fade"></div>
    <div class="title-shade"></div>
    <div class="title-panel">
      <div class="kicker">${arenaCfg.kicker}</div>
      <h1>${arenaCfg.title}</h1>
      <div class="menu-list">${arenas.list.map(({ id, name, description }) => `
        <button class="menu-btn" data-action="arena" data-arena="${id}" aria-describedby="arena-${id}-description" type="button">${name}</button>
        <p id="arena-${id}-description">${description}<br /><small class="arena-best" data-arena-best="${id}">${arenaCfg.noBest}</small></p>`).join('')}
        <button class="menu-btn" data-action="arenaBack" type="button">${arenaCfg.back}</button>
      </div>
      ${hintLine('runMode')}
    </div>
  `);
  const arenaButtons = [...arenaMode.querySelectorAll('[data-action="arena"]')];
  function markPreferredMode() {
    for (const id of modeIds) runMode.querySelector(`[data-action="${id}"]`).classList.toggle('primary', !preferredArena && id === preferredMode);
    runMode.querySelector('[data-action="extraModes"]').classList.toggle('primary', !!preferredArena);
    for (const button of arenaButtons) button.classList.toggle('primary', button.dataset.arena === preferredArena);
  }
  markPreferredMode();
  const fades = [title, runMode, arenaMode].map((screen) => screen.querySelector('.title-fade'));
  function backFromMode() {
    api.show('title');
    buttonsOf('title')[0].focus({ preventScroll: true });
  }
  // Back from the arena list: the run-mode screen, its cursor on Extra Modes.
  function backFromArena() {
    api.show('runMode');
    const buttons = buttonsOf('runMode');
    const index = buttons.findIndex((b) => b.dataset.action === 'extraModes');
    cursor.set(index, { show: cursor.shown });
    buttons[index].focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (event) => {
    if ((current !== 'runMode' && current !== 'arenaMode') || event.code !== 'Escape') return;
    event.preventDefault();
    if (current === 'arenaMode') backFromArena();
    else backFromMode();
  });

  // --- Pause -----------------------------------------------------------------------
  const pause = el('div', 'screen pause-screen hidden', `
    <div class="card pause-card">
      <div class="form-number">SG / PERSONNEL · FORM 02-B</div>
      <div class="kicker pause-kicker">Paused</div>
      <h1 class="pause-title">On break</h1>
      <div class="pause-stats"></div>
      <div class="pause-outfit"><div class="outfit-head">ON YOU</div></div>
      <section class="pause-closing">
        <h2 class="outfit-head">${closingTime.title}</h2>
        <ul class="closing-list"></ul>
      </section>
      <p class="paper-note">Your absence has been noted. Please return to the sales floor.</p>
      <div class="menu-list">
        <button class="menu-btn primary" data-action="resume" type="button">Resume</button>
        <button class="menu-btn" data-action="restart" data-confirm="Restart? Press again" type="button">Restart run</button>
        <button class="menu-btn" data-action="notices" type="button">Notices &amp; certificates</button>
        <button class="menu-btn" data-action="settings" type="button">Settings</button>
        <button class="menu-btn" data-action="controls" type="button">Controls</button>
        <button class="menu-btn save-quit" data-action="saveQuit" data-confirm="Save &amp; quit? Press again" type="button">Save &amp; quit</button>
        <button class="menu-btn danger" data-action="quit" data-confirm="Quit? Press again" type="button">Quit to title</button>
      </div>
      <p class="paper-note save-note">Saves your shift as it was when this round began. One save; it is used up when you continue.</p>
      ${hintLine('pause')}
    </div>
  `);
  const pauseKicker = pause.querySelector('.pause-kicker');
  const pauseTitle = pause.querySelector('.pause-title');
  const pauseStats = pause.querySelector('.pause-stats');
  const pauseOutfit = pause.querySelector('.pause-outfit');
  const pauseClosing = pause.querySelector('.pause-closing');
  const closingList = pause.querySelector('.closing-list');
  const pauseRail = createOutfitRail({ variant: 'pause' });
  pauseOutfit.append(pauseRail.el);
  const resumeButton = pause.querySelector('[data-action="resume"]');
  const saveQuitButton = pause.querySelector('[data-action="saveQuit"]');
  const saveNote = pause.querySelector('.save-note');
  const continueButton = title.querySelector('[data-action="continue"]');
  continueButton.hidden = true; // (until setContinue finds a save)
  const playButton = title.querySelector('[data-action="play"]');
  const titleNote = title.querySelector('.title-note');

  // --- Results (the receipt) ---------------------------------------------------------
  const deathThanks = 'Thank you for shopping with us<br />All sales final · No refunds · No respawns';
  const results = el('div', 'screen results-screen hidden', `
    <div class="receipt-wrap">
      <div class="receipt">
        <div class="receipt-store">SUNSET GALLERIA</div>
        <div class="receipt-sub">Store #013 · Register 4</div>
        <div class="receipt-sub receipt-date"></div>
        <div class="receipt-art" hidden="hidden">${receiptArtHtml()}</div>
        <h1 class="receipt-shift-heading" hidden="hidden">${closingTime.receipt.shiftComplete}</h1>
        <div class="receipt-sub receipt-cashier">Cashier: YOU (deceased)</div>
        <div class="receipt-return" hidden="hidden">${returnSlipHtml()}</div>
        <div class="receipt-rule"></div>
        <div class="receipt-lines"></div>
        <div class="receipt-wearing"><div class="receipt-wearing-head"></div></div>
        <div class="receipt-rule"></div>
        <div class="receipt-total"><span>Points earned</span><span class="receipt-total-value"></span></div>
        <div class="receipt-rule receipt-death-rule"></div>
        <div class="receipt-review">
          <div class="receipt-eval-header">*** PERFORMANCE REVIEW ***</div>
          <div class="receipt-eval-title"></div>
          <div class="receipt-eval-rating"></div>
          <div class="receipt-eval-comment"></div>
        </div>
        <div class="receipt-rule receipt-death-rule"></div>
        <div class="receipt-incident">
          <div class="receipt-incident-header">*** INCIDENT REPORT / FORM 109-C ***</div>
          <div class="receipt-incident-block">
            <div class="receipt-incident-label">CAUSE OF TERMINATION:</div>
            <div class="receipt-incident-cause"></div>
          </div>
          <div class="receipt-incident-block">
            <div class="receipt-incident-label">LOSS PREVENTION TIP:</div>
            <div class="receipt-incident-tip"></div>
          </div>
        </div>
        <div class="receipt-career"></div>
        <div class="receipt-rule"></div>
        <div class="receipt-validation">
          <div class="receipt-barcode"></div>
          <div class="receipt-stamp">Clocked out</div>
        </div>
        <div class="receipt-coupon" hidden="hidden">${overtimeCouponHtml()}</div>
        <div class="receipt-thanks">${deathThanks}</div>
      </div>
      <div class="menu-list menu-row">
        <button class="menu-btn primary" data-action="clockOut" type="button">Clock out</button>
        <button class="menu-btn" data-action="overtime" type="button">Stay for overtime</button>
        <button class="menu-btn primary" data-action="playAgain" type="button">Play again</button>
        <button class="menu-btn" data-action="notices" type="button">Notices &amp; certificates</button>
        <button class="menu-btn" data-action="mainMenu" type="button">Main menu</button>
      </div>
      ${hintLine('results')}
    </div>
  `);
  const shiftHeading = results.querySelector('.receipt-shift-heading');
  const cashier = results.querySelector('.receipt-cashier');
  const receiptStamp = results.querySelector('.receipt-stamp');
  const receiptThanks = results.querySelector('.receipt-thanks');
  const winArt = results.querySelectorAll('.receipt-art, .receipt-return'); // (ui/receiptArt.js: only on a win)
  const overtimeCoupon = results.querySelector('.receipt-coupon');
  const deathSections = results.querySelectorAll('.receipt-review, .receipt-incident, .receipt-death-rule');
  const resultButtons = [...results.querySelectorAll('[data-action]')];
  const receiptDate = results.querySelector('.receipt-date');
  const receiptLines = results.querySelector('.receipt-lines');
  const receiptWearing = results.querySelector('.receipt-wearing');
  const wearingRail = createOutfitRail({ variant: 'receipt' });
  receiptWearing.append(wearingRail.el);
  receiptWearing.querySelector('.receipt-wearing-head').textContent = outfitCfg.diedWearing;
  const receiptTotal = results.querySelector('.receipt-total-value');
  const barcode = results.querySelector('.receipt-barcode');
  const evalTitle = results.querySelector('.receipt-eval-title');
  const evalRating = results.querySelector('.receipt-eval-rating');
  const evalComment = results.querySelector('.receipt-eval-comment');
  const incidentCause = results.querySelector('.receipt-incident-cause');
  const incidentTip = results.querySelector('.receipt-incident-tip');
  const receiptCareer = results.querySelector('.receipt-career');

  // --- How to play ---------------------------------------------------------------------
  const pay = economy.payouts;
  const kill = economy.killValues.shopper;
  const help = el('div', 'screen help-screen hidden', `
    <div class="card help-card">
      <div class="form-number">ORIENTATION · RETAIN FOR YOUR ENTIRE EMPLOYMENT</div>
      <div class="kicker">Employee handbook</div>
      <h1 class="help-title">How to play</h1>
      <div class="help-grid">
        <div><b>Survive</b><p>Zombies come in rounds. Every round brings more of them, and tougher. You have one life.</p></div>
        <div><b>Earn</b><p>+${pay.nonLethalHit} for every hit, +${kill} for a kill. Headshot kills +${pay.headshotKillBonus} more, box cutter kills +${pay.meleeKillBonus}.</p></div>
        <div><b>Spend</b><p>Hold ${glyphHtml('interact')} to buy: shutters open new parts of the mall, guns hang on the walls, the RESTOCK-O-MATIC refills ammo.</p></div>
        <div><b>Upgrade</b><p>Buy more damage with an Extended Warranty at Customer Service. Fit attachments at the Food Court stores.</p><p>At Build-A-Blaster on the Promenade, choose a Stuffing and a Heart. Hand over your gun, then fight in the room to fill its tank.</p></div>
        <div><b>Listen</b><p>The PA warns before Flash Sales begin: discounts appear on the directory and over each deal. Watch for rare Doorbusters: one item nearby, steeply cut. Buying it draws a rush of shoppers.</p></div>
        <div><b>Move</b><p>Sprint and tap ${glyphHtml('crouch')} to slide. Jump with ${glyphHtml('jump')} to vault counters. Slash with the box cutter (${glyphHtml('melee')}).</p><p>${glyphHtml('prone')} goes prone; ${glyphHtml('jump')} stands up. Keep moving to avoid being surrounded.</p></div>
      </div>
      <div class="menu-list menu-row">
        <button class="menu-btn primary" data-action="back" type="button">Back</button>
      </div>
      ${hintLine('help')}
    </div>
  `);

  // --- Statistics ------------------------------------------------------------------
  const stats = el('div', 'screen stats-screen hidden', `
    <div class="card stats-card">
      <div class="file-tab">Personnel / 013</div>
      <div class="kicker">Human resources · Permanent file</div>
      <h1 class="stats-title">Employee record</h1>
      <div class="stats-empty">No completed shifts yet. Try not to make that permanent.</div>
      <div class="stats-content">
        <section>
          <h2>Employment record</h2>
          <div class="stats-grid stats-totals"></div>
        </section>
        <section>
          <h2>Best shifts</h2>
          <div class="stats-grid stats-bests"></div>
        </section>
        <section>
          <h2>${arenas.statsTitle}</h2>
          <div class="stats-grid stats-arenas"></div>
        </section>
        <section>
          <h2>Recent shifts</h2>
          <div class="ledger-scroll"><table class="shift-ledger"><thead><tr><th scope="col">Filed</th><th scope="col">Round</th><th scope="col">Shift length</th><th scope="col">Cleared</th><th scope="col">Accuracy</th></tr></thead><tbody class="stats-recent"></tbody></table></div>
        </section>
      </div>
      <div class="menu-list menu-row">
        <button class="menu-btn danger" data-action="clearStats" data-confirm="Clear records? Press again" type="button">Clear records</button>
        <button class="menu-btn primary" data-action="statsBack" type="button">Back</button>
      </div>
      ${hintLine('stats')}
    </div>
  `);
  const statsEmpty = stats.querySelector('.stats-empty');
  const statsContent = stats.querySelector('.stats-content');
  const statsTotals = stats.querySelector('.stats-totals');
  const statsBests = stats.querySelector('.stats-bests');
  const statsRecent = stats.querySelector('.stats-recent');
  const statsArenas = stats.querySelector('.stats-arenas');

  const screens = { title, runMode, arenaMode, pause, results, help, stats, ...(locker ? { locker: locker.element } : {}), ...(guide ? { guide: guide.element } : {}),
    ...(challenges ? { challenges: challenges.element } : {}) };
  for (const node of Object.values(screens)) document.body.append(node);
  let current = null;
  let helpReturn = 'title'; // where Back on the help page goes

  // Buttons: click (or A) runs the action. A "confirm" button needs a second press within a few seconds.
  const armed = new Map(); // button -> timeout id
  let receiptGuardUntil = 0; // (config/settings.js menuFeel.receiptGuardSeconds)
  // `keyed`: a key pressed the focused button (the browser's click with no mouse behind it).
  function press(button, pad, keyed = false) {
    if (button.disabled || button.hidden) return;
    if (current === 'results' && (pad || keyed) && now() < receiptGuardUntil) return; // (a stray press from the fight)
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
    if (action === 'play') return api.show('runMode');
    if (action === 'modeBack') return backFromMode();
    if (action === 'extraModes') return api.show('arenaMode');
    if (action === 'arenaBack') return backFromArena();
    if (modeIds.includes(action)) {
      startRequested = true; // (stays true while the chooser waits for play to start; any show() clears it)
      return handlers.startRun?.({ mode: action, arena: null, pad });
    }
    if (action === 'arena') {
      startRequested = true; // (as above: the arena list stays up until play starts)
      return handlers.startRun?.({ mode: null, arena: button.dataset.arena, pad });
    }
    if (action === 'help') return api.show('help', { from: current });
    if (action === 'back') return api.show(helpReturn);
    emit(action, pad);
  }
  for (const node of Object.values(screens)) {
    node.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      press(button, false, event.detail === 0);
    }));
  }

  const buttonsOf = (name) => [...screens[name].querySelectorAll('[data-action]')].filter((b) => !b.hidden && !b.disabled);
  // The controller cursor (ui/menuFocus.js) over the current screen's buttons (the books keep their own).
  const cursor = createFocusList({ items: () => (current && !books[current] ? buttonsOf(current) : []) });

  const percent = (value) => `${Math.round((value ?? 0) * 100)}%`;
  const statCards = (items) => items.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');

  function fillPause({ fresh = false, round = 0, points = 0, time = 0, kills = 0, outfit = [], canSave = null, closing = [], arena = null } = {}) {
    pauseClosing.hidden = closing === null;
    closingList.innerHTML = closing === null ? '' : Object.values(closingTime.lines).map(({ duty, key }, index) => {
      const { done, count, needed } = closing[index] ?? {};
      const progress = count == null ? '' : ` ${closingTime.lineProgress(count, needed)}`;
      return `<li><span>${done ? '✓' : '□'} ${duty}${progress}</span><small>${key}</small></li>`;
    }).join('');
    pauseOutfit.hidden = fresh;
    // Save & quit (game/saveGame.js): hidden on a fresh shift; greyed out, with the reason, when it can't save now.
    saveQuitButton.hidden = fresh || !canSave;
    saveNote.hidden = saveQuitButton.hidden;
    saveQuitButton.disabled = !canSave?.ok;
    saveQuitButton.textContent = canSave?.ok ? 'Save & quit' : `Save & quit · ${canSave?.reason ?? ''}`;
    pauseRail.set(outfit);
    pauseKicker.textContent = (fresh ? 'Fresh shift' : 'Paused') + (arena ? ` · ${arena}` : ''); // (an arena run names its arena)
    pauseTitle.textContent = fresh ? 'Back to work' : 'On break';
    resumeButton.textContent = fresh ? 'Start shift' : 'Resume';
    pauseStats.innerHTML = fresh ? '' : [
      ['Round', round], ['Points', points.toLocaleString('en-US')], ['Time', clock(time)], ['Kills', kills],
    ].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
  }

  function fillResults(r) {
    const shiftComplete = Boolean(r.shiftComplete);
    shiftHeading.hidden = !shiftComplete;
    const words = closingTime.receipt;
    cashier.textContent = shiftComplete ? words.cashier : 'Cashier: YOU (deceased)';
    receiptStamp.textContent = shiftComplete && !r.clockedOut ? words.stampComplete : 'Clocked out';
    receiptThanks.innerHTML = shiftComplete ? words.thanks : deathThanks;
    receiptWearing.querySelector('.receipt-wearing-head').textContent = shiftComplete ? words.woreOnShift : outfitCfg.diedWearing;
    for (const section of deathSections) section.hidden = shiftComplete;
    for (const section of winArt) section.hidden = !shiftComplete;
    overtimeCoupon.hidden = !(shiftComplete && !r.clockedOut);
    results.classList.toggle('won', shiftComplete);
    for (const button of resultButtons) {
      const choice = button.dataset.action === 'clockOut' || button.dataset.action === 'overtime';
      button.hidden = choice !== (shiftComplete && !r.clockedOut);
    }
    const now = new Date();
    receiptDate.textContent = `${now.toLocaleDateString('en-US')} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const lines = receiptLinesFor(r);
    receiptLines.innerHTML = lines
      .map(([label, value]) => `<div class="receipt-line"><span>${label.replace(/^ {2}/, '&nbsp;&nbsp;')}</span><i></i><span>${value}</span></div>`)
      .join('');
    receiptWearing.hidden = !r.wearing; // (older summaries have none)
    wearingRail.set(Object.entries(r.wearing ?? {}).map(([slot, id]) => ({ slot, id })));
    receiptTotal.textContent = r.pointsEarned.toLocaleString('en-US');
    const review = evaluatePerformance(r);
    evalTitle.textContent = review.title;
    evalRating.textContent = review.rating;
    evalComment.textContent = review.comment;
    const incident = getDeathReport(r.killedBy);
    incidentCause.textContent = incident.cause;
    incidentTip.textContent = incident.tip;
    if (!careerResult) {
      receiptCareer.textContent = '';
      receiptCareer.classList.remove('show');
    } else {
      receiptCareer.classList.add('show');
      if (!careerResult.saved) {
        receiptCareer.textContent = 'DEBUG RUN · RECORDS NOT SAVED';
      } else if (careerResult.newRecords.length) {
        receiptCareer.textContent = `NEW RECORD · ${careerResult.newRecords.join(' · ').toUpperCase()}`;
      } else {
        const totals = careerResult.snapshot.totals;
        receiptCareer.textContent = `CAREER SHIFT #${totals.runs} · ${totals.kills.toLocaleString('en-US')} TOTAL KILLS`;
      }
    }
    // A barcode: bars of random widths (different every receipt).
    let bars = '';
    for (let i = 0; i < 46; i++) bars += `<span style="width:${1 + Math.floor(Math.random() * 3)}px;margin-right:${1 + Math.floor(Math.random() * 2)}px"></span>`;
    barcode.innerHTML = bars;
  }

  function fillStats(data = {}) {
    const totals = data.totals ?? {};
    const bests = data.bests ?? {};
    const recent = data.recentRuns ?? [];
    const empty = !(totals.runs > 0);
    statsEmpty.classList.toggle('hidden', !empty);
    statsContent.classList.toggle('hidden', empty);
    if (empty) return;
    statsTotals.innerHTML = statCards([
      ['Shifts worked', totals.runs.toLocaleString('en-US')],
      [closingTime.stats.wins, (totals.wins ?? 0).toLocaleString('en-US')],
      ['Time employed', clock(totals.timeAlive)],
      ['Zombies cleared', totals.kills.toLocaleString('en-US')],
      ['Headshots', totals.headshotKills.toLocaleString('en-US')],
      ['Box cutter', totals.meleeKills.toLocaleString('en-US')],
      ['Lifetime accuracy', percent(totals.accuracy)],
      ['Points earned', totals.pointsEarned.toLocaleString('en-US')],
      ['Points spent', totals.pointsSpent.toLocaleString('en-US')],
    ]);
    statsBests.innerHTML = statCards([
      ['Highest round', bests.round],
      ['Longest shift', clock(bests.timeAlive)],
      ['Most kills', bests.kills],
      ['Most headshots', bests.headshotKills],
      ['Most points', bests.pointsEarned.toLocaleString('en-US')],
      ['Best accuracy', bests.accuracy === null ? '—' : percent(bests.accuracy)],
      [closingTime.stats.fastestWin, bests.fastestWin == null ? closingTime.stats.noWin : clock(bests.fastestWin)],
    ]);
    // Arena survival: each arena's best round (an arena run's round is never in the whole mall's bests above), and an arena run's
    // name beside its round in the recent list.
    statsArenas.innerHTML = statCards(arenas.list.map(({ id, name }) => {
      const best = data.arenas?.[id]?.best ?? 0;
      return [name, best > 0 ? arenas.menu.best(best) : arenas.menu.noBest];
    }));
    const arenaMark = (run) => (arenaById(run.arena) ? ` <span class="stats-arena">${arenaById(run.arena).name}</span>` : '');
    statsRecent.innerHTML = recent.map((run) => {
      const date = run.endedAt ? new Date(run.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown';
      // A won shift carries a mark beside its round (and the row a class, for the style).
      const won = run.won ? ` <span class="stats-won" title="${closingTime.stats.wonTitle}">${closingTime.stats.wonMark}</span>` : '';
      return `<tr class="stats-run${run.won ? ' won' : ''}"><td>${date}</td><td><b>${run.round}</b>${won}${arenaMark(run)}</td><td>${clock(run.timeAlive)}</td><td>${run.kills}</td><td>${percent(run.accuracy)}</td></tr>`;
    }).join('');
  }

  let careerResult = null;

  const api = {
    get current() {
      return current;
    },

    // Should the title flyover be drawn behind? (the title itself, or How to play opened from it)
    get showsFlyover() {
      return current === 'title' || current === 'runMode' || current === 'arenaMode' || current === 'stats' || current === 'locker' || current === 'guide' || current === 'challenges'
        || (current === 'help' && helpReturn === 'title');
    },

    on(action, fn) {
      handlers[action] = fn;
    },

    show(name, data) {
      const leaving = books[current] && name !== current ? current : null;
      if (leaving) books[leaving].close();
      for (const [key, node] of Object.entries(screens)) node.classList.toggle('hidden', key !== name);
      for (const [button, timer] of armed) {
        clearTimeout(timer);
        button.textContent = button.dataset.label;
        button.classList.remove('armed');
      }
      armed.clear();
      current = name ?? null;
      startRequested = false;
      cursor.set(0, { show: false });
      if (name === 'runMode' || name === 'arenaMode') {
        const buttons = buttonsOf(name);
        const focus = Math.max(0, name === 'arenaMode'
          ? buttons.findIndex((b) => b.dataset.arena === preferredArena)
          : buttons.findIndex((b) => (preferredArena ? b.dataset.action === 'extraModes' : b.dataset.action === preferredMode)));
        cursor.set(focus, { show: false });
        buttons[focus].focus({ preventScroll: true });
      }
      if (name === 'pause') fillPause(data);
      if (name === 'results') {
        fillResults(data);
        results.scrollTop = 0;
        receiptGuardUntil = now() + menuFeel.receiptGuardSeconds * 1000;
        buttonsOf(name)[0]?.focus?.({ preventScroll: true });
      }
      if (name === 'help') helpReturn = data?.from ?? 'title';
      if (name === 'stats') fillStats(data);
      if (books[name]) books[name].open();
      if (leaving && name === 'title') {
        const back = title.querySelector(`[data-action="${leaving}"]`);
        back.focus();
        cursor.set(Math.max(0, buttonsOf('title').indexOf(back)), { show: false }); // (the pad cursor comes back to it too)
      }
    },

    // A mode was confirmed on the chooser and play has not started yet (ui/runStart.js lets that pointer lock through).
    get startRequested() {
      return startRequested;
    },

    // The mode the chooser focuses: the one chosen last time (unknown ids are ignored).
    setRunMode(mode) {
      if (modeIds.includes(mode)) preferredMode = mode;
      markPreferredMode();
    },

    // The arena chosen last (an id from config/arenas.js), or null when the last run was Directed / Classic: the chooser then
    // focuses Extra Modes, and the arena list this arena. Unknown ids count as none.
    setArenaChoice(id) {
      preferredArena = arenaById(id) ? id : null;
      markPreferredMode();
    },
    get arenaChoice() {
      return preferredArena;
    },

    // The best round filed in each arena (game/careerStats.js snapshot().arenas: { [id]: { best } }, or { [id]: round }): shown
    // under each arena's line.
    setArenaBests(bests = {}) {
      for (const node of arenaMode.querySelectorAll('[data-arena-best]')) {
        const entry = bests[node.dataset.arenaBest];
        const round = typeof entry === 'number' ? entry : entry?.best;
        node.textContent = round > 0 ? arenaCfg.best(round) : arenaCfg.noBest;
      }
    },

    setFade(opacity) {
      for (const fade of fades) fade.style.opacity = String(opacity);
    },

    // Save & Quit's slot on the title (game/saveGame.js peek()): { round } shows "Continue · Round N" and makes Play ask
    // twice (it discards the save); null hides it.
    /** A line under the title's menu (the save slot's notice: game/saveGame.js takeNotice); null hides it. */
    setTitleNote(text) {
      titleNote.hidden = !text;
      titleNote.textContent = text ?? '';
    },

    setContinue(saved) {
      continueButton.hidden = !saved;
      const arenaName = arenaById(saved?.arena)?.name; // (a saved arena run says which arena)
      continueButton.textContent = saved ? `Continue · Round ${saved.round}${arenaName ? ` · ${arenaName}` : ''}` : 'Continue';
      playButton.classList.toggle('primary', !saved);
      if (saved) playButton.dataset.confirm = 'New shift? Your save is discarded';
      else delete playButton.dataset.confirm;
    },

    setCareerResult(result) {
      careerResult = result;
    },

    // The controller, once per tick while a screen is up (main.js). Reads the ui* ACTIONS through core/menuNav.js.
    padNav(input) {
      if (!current) return;
      if (books[current]) return books[current].padNav(input);
      const nav = menuNav.read(input, TICK);
      // A controller in use: the cursor shows straight away (where it is; the receipt isn't scrolled to the buttons).
      if (input.device === 'gamepad' && !cursor.shown) cursor.set(cursor.index, { show: true, scroll: false });
      if (nav.x || nav.y) cursor.move(nav.x, nav.y);
      scrollPage(screens[current], nav.scroll); // (the receipt, a long pause card, the record)
      const shortcuts = current === 'title' || current === 'pause';
      if (nav.back) {
        if (current === 'runMode') return backFromMode();
        if (current === 'arenaMode') return backFromArena();
        if (current === 'help') return api.show(helpReturn);
        if (current === 'stats') return emit('statsBack', true);
        if (current === 'pause') return emit('resume', true);
      }
      if (nav.start) {
        if (current === 'pause') return emit('resume', true);
        if (current === 'title') return continueButton.hidden ? api.show('runMode') : emit('continue', true);
      }
      if (shortcuts && nav.option) return emit('settings', true);
      if (shortcuts && nav.option2) return emit('controls', true);
      if (nav.confirm && cursor.current) {
        cursor.show();
        press(cursor.current, true);
      }
    },
  };
  return api;
}
