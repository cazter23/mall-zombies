// =============================================================================
// DEBUG COMMANDS: the developer shortcuts (spawn a zombie, skip a round, god mode, give a gun...), as plain
// functions on the real game's systems so they run in Node tests like everything else. The KEYS for them are
// a table in config/debug.js (`debug.commands`); main.js turns a key press into run(id) and ui/debugPanel.js lists
// them in a small window. A new command = one table entry there + one function with the same id here.
//
//   const dbg = createDebugCommands({ map, zombies, rounds, wallet, gun, health, player, arena, flashSales })
//   dbg.run(id)       do it; returns a short message ("Spawned Cart Pusher") that the window shows as the last result
//   dbg.resolve(code, shift)   the command bound to this key (and Shift state), or null
//   dbg.status()      live numbers for the window: { round, points, alive, zombieType, god, panelOpen, last }
//   dbg.state         { panelOpen, zombieIndex, gunIndex, last }; god mode lives on health.invulnerable
//
// Debug state is not part of a run: Play again does not reset it (god mode and the window stay as you left them).
// Kills made here count as 'hazard' kills, so they pay and count like any non-player kill.
// =============================================================================

import { debug } from '../config/debug.js';
import { weapons } from '../config/weapons.js';
import { zombieTypes } from '../config/zombies.js';
import { toggleDoors } from '../world/door.js';
import { nextTier, withTier, tierById } from '../weapons/upgrades.js';

const ZOMBIE_IDS = Object.keys(zombieTypes);
const WALL_GUN_IDS = Object.keys(weapons).filter((id) => id !== 'stapleGun');
const nameOf = (id) => id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function createDebugCommands({ map, zombies, rounds, wallet, gun, health, player, arena, flashSales, bosses, commands = debug.commands, onUse = null }) {
  const state = { panelOpen: debug.panel.startOpen, zombieIndex: 0, gunIndex: 0, last: '' };
  const selectedZombie = () => ZOMBIE_IDS[state.zombieIndex];

  const run = {
    spawn() {
      const id = selectedZombie();
      return zombies.spawn(id) ? `Spawned ${nameOf(id)}` : 'No safe spawn point right now';
    },
    summonBoss(id) {
      if (!rounds.started) rounds.start();
      const zombie = bosses.summon(id);
      return zombie ? `Summoned ${zombie.type.name}` : 'Boss unavailable this round or no safe spawn point';
    },
    cycleZombie() {
      state.zombieIndex = (state.zombieIndex + 1) % ZOMBIE_IDS.length;
      return `Spawn type: ${nameOf(selectedZombie())}`;
    },
    clearZombies() {
      const n = zombies.aliveCount;
      zombies.clear();
      return `Removed ${n} zombie${n === 1 ? '' : 's'}`;
    },
    killZombies() {
      let n = 0;
      for (const z of [...zombies.zombies]) {
        if (!z.isAlive) continue;
        z.takeHit({ damage: z.health + 1, part: 'body', source: 'hazard' });
        n += 1;
      }
      return `Killed ${n} zombie${n === 1 ? '' : 's'}`;
    },

    nextRound() {
      rounds.skipRound();
      return `Round ${rounds.round}`;
    },
    jumpRounds() {
      rounds.jumpTo(Math.max(1, rounds.round) + debug.jumpRounds);
      return `Jumped to round ${rounds.round}`;
    },
    flashSale() {
      if (flashSales.active) return 'A Flash Sale is already running';
      return flashSales.startNow() ? `Flash Sale: ${flashSales.active.label}` : 'Nothing worth putting on sale right now';
    },

    addPoints() {
      wallet.earn(debug.addPointsAmount);
      return `+${debug.addPointsAmount} points`;
    },
    zeroPoints() {
      wallet.spend(wallet.points);
      return 'Points set to 0';
    },

    god() {
      health.invulnerable = !health.invulnerable;
      return `God mode ${health.invulnerable ? 'on' : 'off'}`;
    },
    giveGun() {
      const id = WALL_GUN_IDS[state.gunIndex % WALL_GUN_IDS.length];
      state.gunIndex += 1;
      const owned = gun.owns(id);
      gun.give(weapons[id]);
      return owned ? `Refilled the ${weapons[id].name}` : `Gave the ${weapons[id].name}`;
    },
    upgradeGun() {
      const id = gun.def.id;
      const next = nextTier(gun.modsFor(id));
      if (!next) return `The ${gun.def.name} is already ${tierById('platinum').name}`;
      gun.setMods(id, withTier(weapons[id], gun.modsFor(id), next));
      return `${gun.def.name}: ${tierById(next).name}`;
    },

    doors() {
      toggleDoors(map.doors);
      return map.doors.every((d) => d.isOpen) ? 'Every door open' : 'Doors closed';
    },
    arena() {
      if (!arena) return 'The test range is switched off (debug.testArena)';
      const inside = arena.contains(player.position);
      player.teleport(inside ? map.playerSpawn : arena.playerSpawn);
      return inside ? 'Back in the mall' : 'In the test range';
    },

    upstairs() {
      const spots = map.levelTwo;
      if (!spots) return 'This map has no second floor';
      if (player.position.y > spots.minY) {
        player.teleport(spots.below);
        return 'Back downstairs';
      }
      spots.repair.open(); // (free, like the doors key: the way up has to be open)
      player.teleport(spots.arrival);
      return 'On Level 2';
    },

    workshop() {
      const spots = map.levelTwo;
      if (!spots?.workshop) return 'This map has no workshop';
      spots.repair.open();
      player.teleport(spots.workshop);
      return 'At the Build-A-Blaster bench';
    },

    // The benchmark itself is browser-side (fx/benchmark.js, run by main.js on Shift+B); headless it only says so.
    benchmark() {
      return 'The benchmark runs in the browser: on the title or pause screen, press Shift+B';
    },

    panel() {
      state.panelOpen = !state.panelOpen;
      return state.panelOpen ? 'Debug window shown' : 'Debug window hidden';
    },
  };

  return {
    state,
    commands,
    /** Run a command by id; the returned message is also kept as the "last result" for the window. */
    run(id, ...args) {
      if (!Object.hasOwn(run, id)) throw new Error(`debug: unknown command "${id}"`);
      if (onUse) onUse(id);
      state.last = run[id](...args);
      return state.last;
    },
    /** The command bound to this key code and Shift state (an exact match), or null. */
    resolve(code, shift = false) {
      return commands.find((c) => c.key === code && !!c.shift === !!shift) ?? null;
    },
    status() {
      return {
        round: rounds.round,
        points: wallet.points,
        alive: zombies.aliveCount,
        zombieType: nameOf(selectedZombie()),
        nextGun: weapons[WALL_GUN_IDS[state.gunIndex % WALL_GUN_IDS.length]].name,
        boss: bosses?.active?.type.name ?? null,
        god: health.invulnerable,
        panelOpen: state.panelOpen,
        last: state.last,
        sale: flashSales.active ? `${flashSales.active.label} -${Math.round(flashSales.active.discount * 100)}%` : '',
      };
    },
    ids: Object.keys(run),
  };
}
