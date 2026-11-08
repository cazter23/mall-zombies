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
//   title/detail optional shelf-ticket heading and explanation (strings or getters); label remains the purchase-event text
//   priceLabel   optional text instead of the number on the ticket (a free action: "Free")
//   quiet        optional: use() isn't a purchase (it opens a menu): no 'purchase' sound or event
//   blocked      optional text (string or getter): shown on the ticket instead of being bought, and refused like too few points
//   position     THREE.Vector3 the player interacts with (distance + facing are measured to it)
//   seeThrough   optional [Box3]: solids that don't block the line of sight to it (a door's own shutter)
//   available()  false once it can't be used any more (an opened door)
//   use()        do the thing (points are already spent)
//   kind, id     optional, for the 'purchase' event ('door' / 'weapon' / 'ammo' / 'ammoCache', the thing's id);
//                read BEFORE use(), like the label (buying a gun turns its prompt into "<Gun> ammo")
//
// Reaching it takes: within feel.interact.range of the player's EYE in 3D (so a floor above or below
// is out of reach), roughly facing it, and a clear line from the eye to it (no wall or ceiling in the
// way, so a gun on the far side of a wall can't be bought through it).
//
// Controller X is both interact and reload (COD): near a buyable, holding it buys,
// a quick tap still reloads. Any button bound to both is handled that way.
// =============================================================================

import { feel } from '../config/feel.js';
import { bindings } from '../config/controls.js';
import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;
const eye = new THREE.Vector3();
const toItem = new THREE.Vector3();
const sightRay = new THREE.Ray();
const sightHit = new THREE.Vector3();

export function createInteractions({ input, player, wallet, sound = null, onReloadTap = null, onPurchase = null, colliders = [] }) {
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

  // Is there nothing solid between the player's eye and the item? (Low counters etc. count: only
  // boxes the ray really crosses. Invisible walk-blockers that bullets ignore don't.)
  function hasClearLine(item) {
    toItem.subVectors(item.position, eye);
    const d = toItem.length();
    if (d < 1e-6) return true;
    sightRay.set(eye, toItem.divideScalar(d));
    for (const box of colliders) {
      if (box.ignoreShots || item.seeThrough?.includes(box)) continue;
      if (box.containsPoint(eye)) continue; // a box the eye is inside (a floor slab's edge) isn't in the way
      if (sightRay.intersectBox(box, sightHit) && sightHit.distanceTo(eye) < d - 0.05) return false;
    }
    return true;
  }

  // Is this item within reach, roughly in front of the player, and in plain sight?
  function canReach(item) {
    eye.set(player.position.x, player.position.y + (player.eyeHeight ?? feel.player.eyeHeight), player.position.z);
    if (eye.distanceTo(item.position) > cfg.range) return false;
    const dx = item.position.x - player.position.x;
    const dz = item.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d >= cfg.facingFreeDistance) {
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      if ((dx * fx + dz * fz) / d < Math.cos(cfg.maxAngleDegrees * DEG_TO_RAD)) return false;
    }
    return hasClearLine(item);
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
    if (item.blocked) {
      deniedTimer = cfg.deniedSeconds;
      if (sound) sound.play('denied');
      return;
    }
    // What is being bought, as it is NOW (use() can change it: a bought gun's prompt becomes its ammo).
    const purchase = { label: item.label, cost: item.cost, kind: item.kind ?? 'other', id: item.id ?? null };
    const pricingId = item.pricingId ?? purchase.id;
    if (wallet.spend(purchase.cost)) {
      const result = item.use();
      if (result?.areaId) {
        purchase.areaId = result.areaId;
        purchase.openedDoorIds = result.openedDoorIds;
      }
      if (!item.quiet && sound) sound.play('purchase');
      if (!item.quiet && onPurchase) onPurchase(purchase, pricingId);
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

    // HUD ticket: null, or label/title/detail, kind/id, live cost/shortfall, canAfford, progress 0..1, denied.
    get prompt() {
      // Buying or switching guns can invalidate focus after this tick's interaction update.
      // Recheck before reading dynamic prices (the final tier has no next price).
      if (!focused || !focused.available()) return null;
      return {
        label: focused.label,
        title: focused.title ?? focused.label,
        verb: focused.verb,
        kind: focused.kind ?? 'other', // 'door' | 'weapon' | ... (a pricing category when it is one)
        id: focused.id ?? null,
        pricingId: focused.pricingId ?? focused.id ?? null,
        detail: focused.detail ?? '',
        owned: focused.owned ?? false,
        priceLabel: focused.priceLabel ?? null, // shown instead of the number ("Free")
        blocked: focused.blocked ?? null,
        shortfall: Math.max(0, focused.cost - wallet.points),
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
