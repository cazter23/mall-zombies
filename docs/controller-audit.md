# Controller audit (13 November 2026, `claude/controller`)

Goal: everything in Sunset Galleria playable and navigable with only a controller. `core/gamepad.js` had not changed since late
October; this checks every feature added since, fixes what a pad couldn't do, and puts every menu on one navigation model.

How it was checked: reading the code (every `keydown` / `click` / `wheel` / `mouseenter` listener under `src/`, every raw `Pad*` read,
every prompt and hint string), headless tests (`tests/controllerMenus.test.js`, `tests/haptics.test.js`, the menu tests), and a browser
walkthrough with a fake standard-mapping pad (`navigator.getGamepads` overridden in the page, buttons and sticks driven from the console;
see "Browser walkthrough" below). No real controller was used: the last section lists what to try by hand.

## The model now (one for every menu)

| Control | In every menu |
|---|---|
| D-pad / left stick | move to the nearest item that way (`core/menuNav.js` `spatialStep`); held, it repeats after 0.4 s, then every 0.11 s |
| left / right on a setting | change it (a slider keeps sliding while held) |
| A | select / press (a "press again" button asks twice) |
| B | back (Resume on the pause screen) |
| LB / RB | tabs (Settings, Controls), sections (Survival Guide), guns (locker), groups (Challenges) |
| Right stick, or LT / RT held | scroll a long page (the receipt, the guide page, notices, the record, Controls) |
| Start | Play / Continue on the title, Resume on the pause screen, closes Settings and Controls |
| Y / X | Settings / Controls on the title and pause screens; Diagram or List in Controls |

The DOM menus read the pad-only `ui*` actions (`config/controls.js`); the in-run menus (order form, fitting room) read the `menu*` actions,
which keys share. Both go through `createMenuNav` (`core/menuNav.js`), whose feel numbers are `config/controls.js` `menuNav`. With a
controller in use the cursor shows as soon as a screen opens. Hint lines and How to play's keycaps name the buttons of the device used
last (`ui/glyphs.js`; Xbox or PlayStation names; with a keyboard the lines still advertise the controller, in Xbox names).

## Audit table

"Before" is whether a pad could do it before this branch.

| Feature | How it's used | Before | Fix |
|---|---|---|---|
| Move, look, sprint, jump, crouch / slide, prone | actions; sticks through `core/gamepad.js` (deadzones, curve, turn ramp, L3 sprint latch) | yes | none |
| Shoot, aim, reload, swap, box cutter | RT, LT, X (tap), Y, R3 | yes | none |
| Buying (doors, wall buys, RESTOCK-O-MATIC, Customer Service, attachments, Night Safe, Lost and Found logging, prize counter, escape van) | hold X near it (`game/interactions.js`: tap X = reload, hold = buy) | yes | none |
| Kiosk Kevin | not a menu: three buy spots on his cart (hold X), Lethal on RB, Tactical on D-pad right | yes | Soda Bomb burst and Air Horn now rumble |
| GRAB-A-GUN claw machine | hold X to pay; the drop is a single press (instant: never turns into a reload); hold X to take the prize | yes | a jackpot rumble when you take the prize (and on prize tickets) |
| Build-A-Blaster order form | in-run menu: D-pad / left stick, A order, B cancel | partly: one step per push, no hold-to-repeat; its stick numbers hard-coded | shared `createMenuNav` (held D-pad, stick or key repeats; a direction held when it opens never counts); numbers in `config/controls.js` |
| Fitting room picker (Wardrobe) | in-run menu, as above | partly (same) | same |
| Barcode Scanner (charge) | hold RT to scan (trigger past 0.3 counts as held), let go to fire | yes, but no feel of the wind-up on the pad | a hum that grows as the scan fills (`config/haptics.js` charge) |
| Stargazer (scope) | LT to scope in; look speed follows the zoom; ADS snap and slowdown apply | yes | none (aim assist stops at 25 m: long shots are skill, as intended) |
| Tennis Ball Launcher, Bottle Rocket Bazooka, Balloon Launcher | RT; projectiles | yes; rocket / balloon bursts had no rumble | burst rumble (`gunBlast`) |
| Aim assist on the new guns | gun-agnostic: slowdown, rotational, ADS snap at the chest, alive and visible targets, 25 m | yes | none; projectiles aren't lead-corrected (assist only slows and follows): see "By hand" |
| Flash Sales / Doorbusters | SALE mark on the shelf ticket; buy with the interact button | yes | Doorbuster start rumbles (plain Flash Sales don't: they're common) |
| Bosses | health bar, voucher | yes; no rumble | spawn and defeat rumble |
| Clock in | hold D-pad down in the break (prompt shows ▼) | yes | none |
| Mall directory / minimap | tap / hold Back | yes | none |
| Pause / resume | Start; B or Start resumes | yes | none |
| Controller unplugged mid-run | pauses | yes | none |
| Title menu, run mode chooser | D-pad + A, Start plays, Y settings, X controls | partly: up/down only, no stick, no hold, cursor hidden until the first press, raw `Pad*` codes | shared model; cursor shows at once; `ui*` actions |
| Save & Quit | pause screen button, press twice | yes; said "Click again" | "Press again" (Restart, Quit, Reset everything too) |
| Results screen (receipt) | Play again / Notices / Main menu (or Clock out / Overtime) | partly: the receipt couldn't be scrolled; its button row walked with up/down | right stick / triggers scroll it; left / right walk the row |
| Statistics | Clear records / Back | partly: no scrolling | scroll |
| How to play | Back | yes; text named F / C / Space / V / Ctrl with an Xbox X / LB mixed in | keycaps follow the device (`data-glyph`) |
| Settings | rows, tabs, footer | partly: a slider moved one step per press; the footer only by up/down; raw codes | hold to keep changing; left / right walk the footer; `ui*` actions |
| Controls | Keyboard / Controller tabs, Diagram / List | yes (read-only) | opens on the Controller page when a pad opened it; an "In menus" list under it; stick / trigger scroll |
| Rebinding | none in the game: the Controls screen is a reference | n/a | not built (a feature, not a fix); bindings live in `config/controls.js` |
| Notices & certificates | scroll, back | partly: page jumps only | stick / trigger scroll |
| Staff Survival Guide | index of entries, a page each, long pages | partly: a straight walk through every entry; long pages couldn't be scrolled | nearest-that-way moves, LB / RB jump a section, right stick scrolls the page |
| Weapon locker (skins) | guns column, skins column, equip | partly: a straight walk through 14 guns to reach the skins | LB / RB change gun; left / right cross the columns |
| Challenges board | groups, challenges, pin | partly: the same; a focused challenge row had no cursor style | LB / RB change group; `.locker-skin.focused` style |
| Menu hint lines | under each screen | partly: always Xbox names after "Controller:", even on a PlayStation pad; three screens mixed keyboard and pad in one line | `data-hint` lines from `config/controls.js` menuHints, per device |
| In-run prompts (buy, reload, throws, vault, clock in, order form, fitting room) | button names per device | yes (`buttonLabels`) | the helper moved to `ui/glyphs.js` |
| Raw key / mouse listeners outside `main.js` | `keydown` (Escape, arrows, Tab) in screens, locker, guide, Challenges, modal; `click` on buttons; `mouseenter` on guide and locker rows | keyboard / mouse only by design | none needed: each has a pad path (the hover preview follows the pad cursor through focus) |
| Debug panel and keys | keyboard | n/a | debug only |

## Browser walkthrough

The built game (`npm run build`, `vite preview`), one tab, a fake pad: `navigator.getGamepads` returns one standard-mapping pad whose
`buttons[i].pressed/value` and `axes` are set from the console and `__mall.step(n)` advances the game; its `vibrationActuator.playEffect`
calls are logged. Everything below was done with the pad alone (no clicks, no keys):

| Step | Result |
|---|---|
| Title | the pad's first press shows the cursor and the hint line switches to pad buttons; D-pad walks the directory |
| Survival Guide | opens with A; D-pad walks entries; RB jumps to the next section; right stick scrolled the page 360 px; B back to the title, cursor back on "Survival guide" |
| Weapon locker | RB picks the next gun (Price Gun); right crosses into its skins (Default focused, outlined) |
| Challenges | RB next group; right into its challenges (the row shows the cursor) |
| Settings (Y) | RB walks the tabs; on Controller > Look speed, holding right slid 1.00 -> 1.375 (5 steps), holding left back to 1.00 |
| Controls (X) | opens on the Controller page; Y toggles Diagram / List; the right stick scrolls to the new "In menus" list |
| Start a run | Start -> mode chooser -> A: a pad run (no pointer lock) |
| Buy a door | at the start shutter the prompt reads "X Hold ... 500"; holding X 1 s opened the Main Hallway |
| Die, results, Play again | a Shopper killed me (the live loop runs between console calls); the receipt showed the cursor on Play again, the right stick scrolled it 450 px, left / right walked its row; A started a fresh run |
| Barcode Scanner | bought off its wall by holding X; RT held: the scan ring fills, the pad hums (0.04 -> 0.17 strong motor), the shot pulse (115 ms) on release |
| Stargazer | LT scopes in (scope overlay, aim 1.0), RT fires (150 ms rumble) |
| Tennis Ball Launcher, Bottle Rocket | fire on RT; the rocket gives its 200 ms shot then the 220 ms blast |
| GRAB-A-GUN | hold X pays; one X press drops the claw (no reload); hold X takes the prize (a jackpot rumble) |
| Kiosk Kevin | (round 2) holding X bought Kevin's Pick Soda Bomb; RB threw it; the burst rumbled (220 ms) |
| Order form | holding X at the bench opens it; D-pad down steps, held it repeats; right switches to the Heart column; A orders (1,500 spent) |
| Pause | Start pauses (cursor on Resume); Notices opens with A and closes with B; Save & quit asks "Press again", then the title shows "Continue · Round 2", focused; Start continues on the pad |
| Unplug | a disconnected pad pauses the run; B resumes once it is back |
| Boss | a summoned boss rumbles on arrival (450 ms); a category Flash Sale stays quiet (by design) |

## By hand (needs a real pad)

- Rumble strengths and feel: every new effect (blast, air horn, boss spawn / defeat, jackpot, Doorbuster, the scan hum) was checked only
  as calls to `playEffect`; how strong each feels on a real motor is a matter of taste (`config/haptics.js`).
- Aim assist with the projectile guns (Tennis Ball Launcher, Bottle Rocket, Balloon Launcher): assist aims at the chest with no lead or drop.
- Trigger feel for the Barcode Scanner: the trigger counts as held past 30% (`gamepad.triggerThreshold`).
- Stick repeat timings in menus (`config/controls.js` menuNav: 0.4 s, then every 0.11 s) and the stick's push threshold (0.6).
- A PlayStation pad's id detection (`/054c|sony|playstation|dualsense|dualshock/`), which switches every prompt to ✕ ○ △ □.
- Pointer: with a pad the mouse cursor stays visible over the game (the pane can't lock it anyway).
