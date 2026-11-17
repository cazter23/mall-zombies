<p align="center">
  <img src="src/icons/icon-64.png" alt="Sunset Galleria" width="96" />
</p>

<h1 align="center">Sunset Galleria</h1>

<p align="center">
  <em>A campy wave-survival zombie shooter set in a dying 1986 shopping mall.</em><br />
  Solo, one life, stylized low-poly, cartoon splatter. Runs in the browser.
</p>

---

The mall is in its final week. The shoppers never left. Survive wave after wave, earn points for every hit and kill,
and spend them on the mall itself: open shutters into new wings, buy guns off the wall, upgrade them at Customer
Service, try your luck at the claw machine, and listen to the PA cheerfully announce flash sales while the lights go out.

Inspired by the round-based zombies modes of the *Call of Duty* series, with its own mall-themed systems.

## Features

- **A two-storey mall** with nine areas to buy into: the Main Hallway, Food Court, Mega Mart, Grand Atrium, HOFFMAN'S
  department store, the Sunset Promenade, the Sunset Cinema, the Service Corridor and the Customer Parking lot.
  Escalators, stairs and balcony rails you can vault.
- **Wall guns** with their own feel: the Staple Gun you start with, the Price Gun, Nail Gun, Foam Dart Blaster,
  Confetti Cannon, Rivet Rifle, Heavy Coil Nailer and Barcode Scanner, each with COD-style damage falloff by range.
- **GRAB-A-GUN**, a claw machine mystery box with wonder weapons (a leaf blower, a tennis ball launcher, a bottle
  rocket bazooka...), and **Build-A-Blaster**, where your gun comes back upgraded and named.
- **A roster of zombies:** Shoppers, Shoplifters who steal your points, Cart Pushers who charge, Mannequins that only
  move when you're not looking, and Mascots in costume. Plus **bosses** (the janitor, the security guard, the mall
  manager, the influencer) with health bars and rewards.
- **Kiosk Kevin**, a vendor with rotating stock: throwables, armor and a turret.
- **Employee incentives** (power-ups), **Flash Sales** announced over the mall PA, pay-to-trigger **hazards**
  (an electrified fountain, a fryer blast, sprinklers), a **wardrobe** of perks, weapon skins and challenges.
- **Closing Time**, the run's ending, and **Galleria FM**, the in-mall radio.
- **Save & Quit**, a minimap and mall directory, full **controller support**, and graphics presets down to "Potato".

## Play it

You need [Node.js](https://nodejs.org/) (version 20 or newer).

```bash
git clone https://github.com/cazter23/mall-zombies.git
cd mall-zombies
npm install
npm run play
```

`npm run play` builds the whole game into one file, `dist-single/sunset-galleria.html`, and opens it. After that the
file runs by itself: no server, no internet, just double-click it. On Windows, `play.cmd` does the same by double-click
and only rebuilds when the code has changed.

To work on the game with hot reload instead, run `npm run dev` and open the address it prints.

**Debug mode** (cheat keys, and a test range with a shooting gallery that reads out damage and falloff) is off when you play. It is on
with `npm run dev`, when the address ends in `?debug`, or after switching on Settings > Debug > Debug mode and reopening the game.
The backquote key lists the debug keys and T goes to the test range. A run that uses a debug key is not recorded.

## Controls

| Action | Keyboard & mouse | Controller (Xbox names) |
|---|---|---|
| Move / sprint | WASD / Shift | Left stick / click left stick |
| Jump | Space | A |
| Crouch (tap while sprinting: slide) | C | B |
| Prone | Ctrl | LB |
| Fire / aim | Left mouse / right mouse | RT / LT |
| Reload | R | X (tap) |
| Buy / interact (hold) | F | X (hold) |
| Switch weapon | Mouse wheel, 1 / 2 | Y |
| Melee (box cutter) | V | R3 |
| Lethal / tactical | G / middle mouse | RB / D-pad right |
| Minimap (hold: mall directory) | Tab | Back |
| Pause | Esc | Start |

Everything can be rebound in the Controls menu.

## Tech

- [Three.js](https://threejs.org/) for rendering and [Vite](https://vitejs.dev/) for building; plain JavaScript (ES modules).
- No physics engine, and no models, textures or audio files: the mall, the zombies and the guns are built from code out
  of simple shapes, signs are painted on canvases, and every sound and the radio's music are synthesised at runtime.
  The only files besides code are the bundled fonts and the icon.
- Game logic runs on a fixed 60 Hz step, separate from rendering, and has no browser dependencies, so the real game
  runs headless in the tests.
- Every tunable number (damage, prices, round scaling, colours) lives in `src/config/`.
- Systems talk over an event bus: they announce what happened, and features listen.

## Development

```bash
npm run dev           # dev server with hot reload
npm run build         # production build into dist/
npm run build:single  # the whole game in one html file (dist-single/)
npm run test:quick    # the tests your change touches, plus a fast core set
npm test              # the full suite (about 1,950 tests; it takes a while)
npm run balance       # gun balance report: damage by range, shots to kill by round
```

There are more reports and simulations (economy, claw machine odds, Kiosk Kevin, Build-A-Blaster): see the commands
list in [`CLAUDE.md`](CLAUDE.md).

### Where things are

```
src/main.js      the browser side: renderer, input, HUD, sound, menus, the loop
src/game/        all gameplay rules (no DOM, runs headless): createGame.js builds and ticks every system
src/config/      every tunable number
src/maps/mall/   the mall, one module per area
src/weapons/     guns, damage maths (gunStats.js), viewmodels
src/zombies/     zombies, bosses, navigation
src/world/       shared building blocks: walls, doors, collision, signs, neon
src/fx/  src/ui/  src/audio/  effects, HUD and menus, synthesised sound
tests/           node:test files, one per system or area
docs/            design notes, the map, balance reports, history
```

The best starting points are [`docs/folder-structure.md`](docs/folder-structure.md) (every module, and how the pieces
connect), [`docs/map.md`](docs/map.md) (the layout and coordinates) and [`docs/history.md`](docs/history.md) (how and
why things were built).

## How it was made

Sunset Galleria was designed and directed by one person and written almost entirely by AI coding agents (mostly
[Claude Code](https://claude.com/claude-code)), working in parallel on separate git worktrees. [`CLAUDE.md`](CLAUDE.md)
is the rulebook those agents follow, and the large test suite is what keeps their work honest.

## License

[MIT](LICENSE). The bundled fonts in `src/fonts/` keep their own open licenses (SIL Open Font License or Apache 2.0; each is listed in [docs/typefaces-ledger.md](docs/typefaces-ledger.md)).
