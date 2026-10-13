// =============================================================================
// INTERACTIONS (buying things)
// Anything the player can buy or use by holding the interact button (F / X):
// doors now, wall buys next. Each tick it picks the buyable the player is near
// and facing, shows its prompt, and buys it once the button has been held for
// feel.interact.holdSeconds (COD-style "Hold F"). Not enough points: a red
// prompt and a "denied" buzz, nothing spent.
//
// An interactable is a plain object:
//   label        'Security Shutter'
//   verb         'open' (shown in the prompt)
//   cost         points (number)
//   position     THREE.Vector3 the player interacts with (distance + facing are measured to it)
//   available()  false once it can't be used any more (an opened door)
//   use()        do the thing (points are already spent)
//
// Controller X is both interact and reload (COD): near a buyable, holding it buys,
// a quick tap still reloads. Any button bound to both is handled that way.
// =============================================================================

import { feel } from '../config/feel.js';
import { bindings } from '../config/controls.js';

const DEG_TO_RAD = Math.PI / 180;

export function createInteractions({ input, player, wallet, sound = null, onReloadTap = null }) {
  const cfg = feel.interact;
  const items = [];
  // Buttons bound to both interact and reload (controller X): tap = reload, hold = buy.
  const sharedCodes = bindings.interact.filter((code) => bindings.reload.includes(code));

  let focused = null; // the interactable the prompt is about, or null
  let holdTime = 0; // seconds the button has been held for the focused item
  let armed = false; // the hold started while looking at it (walking up while holding doesn't buy)
  let sharedHeld = false; // a shared (interact + reload) button press is being watched
  let sharedUsed = false; // ...and it already bought (or tried to buy) something
  let deniedTimer = 0; // > 0: show the "not enough points" state

  // Is this item within reach and roughly in front of the player?
  function canReach(item) {
    const dx = item.position.x - player.position.x;
    const dz = item.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d > cfg.range) return false;
    if (d < cfg.facingFreeDistance) return true; // right next to it: any direction counts
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    return (dx * fx + dz * fz) / d >= Math.cos(cfg.maxAngleDegrees * DEG_TO_RAD);
  }

  // Nearest reachable, still-available item.
  function findFocus() {
    let best = null;
    let bestD = Infinity;
    for (const item of items) {
      if (!item.available() || !canReach(item)) continue;
      const d = Math.hypot(item.position.x - player.position.x, item.position.z - player.position.z);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  function tryBuy(item) {
    if (wallet.spend(item.cost)) {
      item.use();
      if (sound) sound.play('purchase');
    } else {
      deniedTimer = cfg.deniedSeconds;
      if (sound) sound.play('denied');
    }
  }

  return {
    add(item) {
      items.push(item);
      return item;
    },

    // What the HUD shows: null, or { label, verb, cost, canAfford, progress 0..1, denied }.
    get prompt() {
      if (!focused) return null;
      return {
        label: focused.label,
        verb: focused.verb,
        cost: focused.cost,
        canAfford: wallet.canAfford(focused.cost),
        progress: armed ? Math.min(1, holdTime / cfg.holdSeconds) : 0,
        denied: deniedTimer > 0,
      };
    },

    // Fixed tick, after the player moves and before the gun (it may swallow a shared reload press).
    update(dt) {
      deniedTimer = Math.max(0, deniedTimer - dt);
      const next = findFocus();
      if (next !== focused) {
        focused = next;
        holdTime = 0;
        armed = false;
      }

      // A shared button (controller X) pressed near a buyable: hide the press from the gun for now.
      // If it's let go before a purchase goes through, it was a reload tap after all.
      let sharedPressedNow = false;
      if (focused && sharedCodes.some((code) => input.pressed.has(code))) {
        for (const code of sharedCodes) input.pressed.delete(code);
        sharedHeld = true;
        sharedUsed = false;
        sharedPressedNow = true;
      }
      if (sharedHeld && !sharedCodes.some((code) => input.isDown(code))) {
        sharedHeld = false;
        if (!sharedUsed && onReloadTap) onReloadTap();
      }

      // Nothing to buy: leave the presses alone (controller X must still reach the gun as reload).
      if (!focused) return;

      if (input.consumeAction('interact') || sharedPressedNow) armed = true;
      if (armed && input.actionDown('interact')) {
        holdTime += dt;
        if (holdTime >= cfg.holdSeconds) {
          tryBuy(focused);
          if (sharedHeld) sharedUsed = true; // this press bought something: no reload on release
          armed = false; // let go and press again to retry
          holdTime = 0;
        }
      } else {
        armed = false;
        holdTime = 0;
      }
    },

    reset() {
      focused = null;
      holdTime = 0;
      armed = false;
      sharedHeld = false;
      sharedUsed = false;
      deniedTimer = 0;
    },
  };
}
