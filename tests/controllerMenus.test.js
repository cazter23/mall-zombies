// Controller menus: the one navigation model (core/menuNav.js), the cursor (ui/menuFocus.js), the button names prompts show
// for the device used last (ui/glyphs.js), and the screens driven by them with only a pad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { padInput } from './helpers/padInput.js';
import { createMenuNav, spatialStep, UI_ACTIONS, GAME_MENU_ACTIONS } from '../src/core/menuNav.js';
import { bindings, buttonLabels, menuHints, menuNav as navCfg, controlsHelp } from '../src/config/controls.js';

menuDom(); // (config/settings reads the display density once when imported; the screens build DOM)
const { promptDevice, buttonLabel, hintParts, hintHtml, glyphHtml, setPromptDevice } = await import('../src/ui/glyphs.js');
const { createScreens } = await import('../src/ui/screens.js');
const { menuFeel } = await import('../src/config/settings.js');

const DT = 1 / 60;
const ticks = (seconds) => Math.round(seconds / DT);

// Run `n` ticks of a held pad (fresh input objects each tick, as the game's presses last one tick).
function hold(nav, n, options) {
  let steps = 0;
  for (let i = 0; i < n; i++) steps += nav.read(padInput(options), DT).y;
  return steps;
}

test('every ui* action is controller-only and bound; the in-run menu actions keep their keys', () => {
  for (const action of Object.values(UI_ACTIONS)) {
    assert.ok(bindings[action]?.length, `${action} is bound`);
    assert.ok(bindings[action].every((code) => code.startsWith('Pad')), `${action}: a key here would press a web-page button twice`);
  }
  for (const action of Object.values(GAME_MENU_ACTIONS)) {
    assert.ok(bindings[action].some((code) => code.startsWith('Pad')), `${action} on the pad`);
    assert.ok(bindings[action].some((code) => code.startsWith('Key')), `${action} on the keyboard`);
  }
  assert.ok(controlsHelp.gamepadMenus.length >= 5, 'the Controls screen lists how menus work on a pad');
});

test('a D-pad press steps once; held, it waits repeatDelay, then steps every repeatEvery; letting go stops it', () => {
  const nav = createMenuNav();
  assert.equal(nav.read(padInput({ held: ['PadDown'] }, 'PadDown'), DT).y, 1, 'the press');
  const waitTicks = ticks(navCfg.repeatDelay) - 2;
  assert.equal(hold(nav, waitTicks, { held: ['PadDown'] }), 0, 'nothing more before the delay');
  const repeatTicks = ticks(navCfg.repeatEvery * 5) + 4;
  const repeats = hold(nav, repeatTicks, { held: ['PadDown'] });
  assert.ok(repeats >= 4 && repeats <= 6, `about five repeats, got ${repeats}`);
  assert.equal(hold(nav, 5), 0, 'let go: nothing');
  assert.equal(nav.read(padInput('PadUp'), DT).y, -1, 'up is -1 (y +1 = down the screen)');
  assert.equal(nav.read(padInput('PadUp'), DT).y, -1, 'two presses on two ticks are two steps, even with no gap reported');
});

test('the left stick steps once per push with hysteresis, and repeats while held like the D-pad', () => {
  const nav = createMenuNav();
  const down = { move: { x: 0, y: -1 } }; // (pulled toward you: down the screen)
  assert.equal(nav.read(padInput(down), DT).y, 1);
  assert.equal(nav.read(padInput({ move: { x: 0, y: -(navCfg.stickOff + navCfg.stickOn) / 2 } }), DT).y, 0, 'half-way back: still the same push');
  assert.equal(nav.read(padInput({ move: { x: 0, y: 0 } }), DT).y, 0, 'centred');
  assert.equal(nav.read(padInput(down), DT).y, 1, 'a second push');
  assert.ok(hold(nav, ticks(navCfg.repeatDelay + navCfg.repeatEvery * 3), down) >= 3, 'held: repeats');
  assert.equal(nav.read(padInput({ move: { x: 1, y: 0 } }), DT).x, 1, 'sideways is x');
  assert.equal(nav.read(padInput({ move: { x: (navCfg.stickOn + navCfg.stickOff) / 2, y: 0 } }), DT).x, 0, 'under stickOn is no push');
});

test('prime: a stick or key held when a menu opens never steps or repeats until it is let go', () => {
  const nav = createMenuNav({ actions: GAME_MENU_ACTIONS });
  const walking = { held: ['PadDown'], move: { x: 0, y: -1 } };
  nav.prime(padInput(walking));
  assert.equal(hold(nav, ticks(navCfg.repeatDelay * 3), walking), 0);
  assert.equal(hold(nav, 2), 0, 'let go');
  assert.equal(nav.read(padInput({ move: { x: 0, y: -1 } }), DT).y, 1, 'then a push counts');
});

test('A, B, LB / RB, Y, X and Start; the right stick and the triggers scroll (pixels this tick, + = down)', () => {
  const nav = createMenuNav();
  const read = (...args) => nav.read(padInput(...args), DT);
  assert.equal(read('PadA').confirm, true);
  assert.equal(read('PadB').back, true);
  assert.equal(read('PadRB').tab, 1);
  assert.equal(read('PadLB').tab, -1);
  assert.equal(read('PadY').option, true);
  assert.equal(read('PadX').option2, true);
  assert.equal(read('PadStart').start, true);
  const full = navCfg.scrollPixelsPerSecond * DT;
  assert.ok(Math.abs(read({ look: { x: 0, y: -1 } }).scroll - full) < 1e-9, 'right stick pulled down scrolls down');
  assert.ok(Math.abs(read({ look: { x: 0, y: 0.5 } }).scroll + full / 2) < 1e-9, 'half up: half speed up');
  assert.ok(Math.abs(read({ held: ['PadRT'] }).scroll - full) < 1e-9, 'RT held: down');
  assert.ok(Math.abs(read({ held: ['PadLT'] }).scroll + full) < 1e-9, 'LT held: up');
  assert.equal(read({ held: ['PadRT'], look: { x: 0, y: -1 } }).scroll, full, 'never faster than full');
  const quiet = read();
  assert.deepEqual([quiet.x, quiet.y, quiet.confirm, quiet.back, quiet.tab, quiet.scroll], [0, 0, false, false, 0, 0]);
});

test('spatialStep: the nearest item that way; with none (or no boxes yet) the next in order, wrapping', () => {
  const box = (left, top) => ({ left, top, width: 100, height: 40 });
  // A column of three, and a second column beside the middle one.
  const rects = [box(0, 0), box(0, 50), box(0, 100), box(200, 50)];
  assert.equal(spatialStep(rects, 0, 0, 1), 1, 'down the column');
  assert.equal(spatialStep(rects, 1, 1, 0), 3, 'right: the item level with it');
  assert.equal(spatialStep(rects, 3, -1, 0), 1, 'and back');
  assert.equal(spatialStep(rects, 3, 0, 1), 2, 'down from the side column: the nearest lower one');
  assert.equal(spatialStep(rects, 2, 0, 1), 3, 'nothing below the end: the next in order');
  assert.equal(spatialStep(rects, 0, 0, -1), 3, 'nothing above the top: wraps to the last');
  const row = [box(0, 0), box(120, 0), box(240, 0)];
  assert.equal(spatialStep(row, 0, 1, 0), 1, 'a row of buttons (the receipt): right is the next');
  assert.equal(spatialStep(row, 2, 1, 0), 0, 'and wraps');
  assert.equal(spatialStep([{}, {}, {}], 1, 0, 1), 2, 'no layout: in order');
  assert.equal(spatialStep(rects, -1, 0, 1), 0);
  assert.equal(spatialStep([], 0, 0, 1), -1);
});

test('prompts name the buttons of the device used last; every menu hint has a name for each of them', () => {
  assert.equal(promptDevice({ device: 'keyboard' }, { type: 'playstation' }), 'keyboard');
  assert.equal(promptDevice({ device: 'gamepad' }, { type: 'playstation' }), 'playstation');
  assert.equal(promptDevice({ device: 'gamepad' }, { type: 'switch-pro' }), 'xbox', 'an unknown pad: Xbox names');
  assert.equal(buttonLabel('interact', 'keyboard'), 'F');
  assert.equal(buttonLabel('interact', 'xbox'), 'X');
  assert.equal(buttonLabel('interact', 'playstation'), '□');
  assert.equal(buttonLabel('uiConfirm', 'keyboard'), undefined, 'the keyboard has no ui* names');
  for (const [id, spec] of Object.entries(menuHints)) {
    for (const device of ['xbox', 'playstation']) {
      for (const [key] of spec.pad) assert.ok(buttonLabels[device][key], `${id}: ${key} on ${device}`);
      assert.equal(hintParts(id, device).parts.length, spec.pad.length, `${id} on ${device}`);
    }
    const keyboard = hintParts(id, 'keyboard');
    if (spec.keyboard) assert.equal(keyboard.text, spec.keyboard);
    else assert.equal(keyboard.prefix, 'Controller: ', `${id}: the keyboard line advertises the controller`);
  }
  assert.match(hintHtml('pause', 'playstation'), /<kbd>○<\/kbd> resume/);
  assert.match(hintHtml('pause', 'xbox'), /<kbd>B<\/kbd> resume/);
  assert.match(hintHtml('pause', 'keyboard'), /^Controller: <kbd>D-pad<\/kbd> move/);
  for (const action of ['interact', 'crouch', 'prone', 'jump', 'melee']) {
    for (const device of ['keyboard', 'xbox', 'playstation']) assert.ok(buttonLabel(action, device), `How to play names ${action} on ${device}`);
  }
  assert.equal(glyphHtml('interact', 'xbox'), '<kbd data-glyph="interact">X</kbd>');
});

test('switching device rewrites every hint line and How to play keycap once, and marks <body data-input>', () => {
  const { document } = menuDom();
  createScreens();
  const hints = () => document.querySelectorAll('[data-hint]');
  const kbd = () => document.querySelector('[data-glyph="interact"]');
  assert.ok(hints().length >= 6, 'title, run mode, pause, results, help, stats');
  assert.equal(setPromptDevice('playstation', document), true);
  assert.equal(document.body.dataset.input, 'playstation');
  const pause = hints().find((node) => node.dataset.hint === 'pause');
  const caps = () => pause.querySelectorAll('kbd').map((node) => node.textContent);
  assert.deepEqual(caps(), ['D-pad', '✕', '○', '△', '□']);
  assert.equal(kbd().textContent, '□');
  assert.equal(setPromptDevice('playstation', document), false, 'no change: nothing rewritten');
  setPromptDevice('keyboard', document);
  assert.equal(kbd().textContent, 'F');
  assert.deepEqual(caps(), ['D-pad', 'A', 'B', 'Y', 'X'], 'the keyboard line advertises the controller, Xbox names');
});

test('with only a pad: the cursor shows at once, Y / X open Settings / Controls, the receipt scrolls, its row is walked', () => {
  const { document } = menuDom();
  let clock = 0; // ms (the receipt ignores keys and buttons for a moment after it appears)
  const screens = createScreens({ now: () => clock });
  const fired = [];
  for (const action of ['settings', 'controls', 'playAgain', 'notices', 'mainMenu', 'resume', 'continue']) screens.on(action, ({ pad }) => fired.push([action, pad]));
  const button = (action) => document.querySelector(`[data-action="${action}"]`);

  screens.show('title');
  screens.padNav(padInput());
  assert.ok(button('play').classList.contains('focused'), 'a controller in use: the cursor is on Play before any move');
  screens.padNav(padInput('PadY'));
  screens.padNav(padInput('PadX'));
  assert.deepEqual(fired.splice(0), [['settings', true], ['controls', true]]);
  screens.padNav(padInput('PadStart'));
  assert.equal(screens.current, 'runMode', 'Start plays (no save: the mode chooser)');
  screens.padNav(padInput('PadB'));
  assert.equal(screens.current, 'title');

  screens.show('pause', {});
  screens.padNav(padInput('PadB'));
  assert.deepEqual(fired.splice(0), [['resume', true]], 'B resumes');

  screens.show('results', { round: 3, timeAlive: 90, kills: 10, headshotKills: 2, meleeKills: 1, accuracy: 0.5, pointsEarned: 900 });
  const receipt = document.body.children.find((node) => node.classList.contains('results-screen'));
  // It came up by itself with Play again focused: a press still coming from the fight does nothing...
  screens.padNav(padInput('PadA'));
  const keyed = new Event('click');
  keyed.detail = 0; // (a key on the focused button: the browser's click with no mouse behind it)
  button('playAgain').dispatchEvent(keyed);
  assert.deepEqual(fired.splice(0), [], 'A or a key right as the receipt appears: nothing (no accidental Play again)');
  button('notices').click(); // ...a mouse click is deliberate and always counts
  assert.deepEqual(fired.splice(0), [['notices', false]]);
  clock += menuFeel.receiptGuardSeconds * 1000 + 1;
  button('mainMenu').dispatchEvent(keyed);
  assert.deepEqual(fired.splice(0), [['mainMenu', false]], 'a moment later keys work');
  receipt.scrollTop = 0;
  for (let i = 0; i < 10; i++) screens.padNav(padInput({ look: { x: 0, y: -1 } }));
  assert.ok(receipt.scrollTop > 100, `the right stick scrolls the receipt (${receipt.scrollTop}px)`);
  screens.padNav(padInput('PadRight'));
  screens.padNav(padInput('PadA'));
  assert.deepEqual(fired.splice(0), [['notices', true]], 'Play again, then right: Notices');
  screens.padNav(padInput('PadLeft'));
  screens.padNav(padInput('PadA'));
  assert.deepEqual(fired.splice(0), [['playAgain', true]]);
});
