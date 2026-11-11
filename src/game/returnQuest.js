// THE RETURN: the hidden quest that issues Return to Sender, and the return labels that change what it does.
// Numbers, words and the steps themselves: config/returnQuest.js. One run only: a reset step and a save step in createGame.
//   'returnQuest'  { step, stage, pa? }      a step was completed ('policy' | 'damaged' | 'ticket' | 'called' | 'collect')
//   'returnLabel'  { labelId, fitted?, pa? } a label was issued (by a ticked duty) or fitted at the desk (labelId null = none)
// The signs (game/features/refundSign.js) and the desk (game/features/returnsDesk.js) are the only things that drive it;
// they read `stage`, `signDown`, `served`, `nextLabel` and call `shootSign`, `pullTicket`, `collect`, `cycleLabel`.
import { returnQuest as cfg, returnLabel } from '../config/returnQuest.js';
import { weapons } from '../config/weapons.js';
import { isReturnable } from '../weapons/gunStats.js';
import { returnToSender } from '../weapons/returnToSender.js';

const LABEL_IDS = Object.keys(cfg.labels);

/** `desk`: the Returns Desk's prompt point (a Vector3), or null in a map without one (steps 2 to 4 then never happen). */
export function createReturnQuest({ events, state, player, zombies, gun, wallet, effects, sound, desk = null, random = () => Math.random() }) {
  const def = weapons[cfg.weaponId];
  const signs = new Set(); // sign ids shot down
  let parcel = false; // step 2 done: damaged goods are on the tray
  let ticket = false; // step 3 begun: a number was taken
  let served = 0; // kills near the desk since
  let issued = false; // step 4 done at least once
  const labels = new Set(); // label ids held
  let fitted = null; // the label on the gun, or null
  let applying = false; // a label is returning more zombies: their 'kill' events must not start it again

  const stage = () => (issued ? 'done'
    : ticket && served >= cfg.ticket.number ? 'collect'
      : ticket ? 'queue'
        : parcel ? 'ticket'
          : signs.size >= cfg.signs.length ? 'damaged' : 'policy');
  const done = (step, pa) => events.emit('returnQuest', { step, stage: stage(), ...(pa ? { pa } : {}) });
  const nearDesk = (position, radius) => !!desk && Math.abs(position.y - desk.y) <= cfg.levelTolerance
    && Math.hypot(position.x - desk.x, position.z - desk.z) <= radius;

  // --- Step 3: kills near the desk while a number is held -------------------------------------------------------
  // --- Labels: act on what the gun returns -----------------------------------------------------------------------
  events.on('kill', ({ zombie, weaponId, source }) => {
    if (state.over || !zombie) return;
    if (stage() === 'queue' && !zombie.noRewards && nearDesk(player.position, cfg.ticket.queueRadius)) {
      served += 1;
      if (served >= cfg.ticket.number) done('called', cfg.pa.called(cfg.ticket.number));
    }
    // A fitted label: only a zombie this gun returned directly (not a boss or Mascot it wore down, not a stuffing's burn).
    if (applying || !fitted || weaponId !== cfg.weaponId || source !== 'gun' || zombie.type?.boss || zombie.type?.mascot) return;
    applying = true;
    try { applyLabel(zombie); } finally { applying = false; }
  });

  const kindOf = (zombie) => `${zombie.type?.variant ?? zombie.type?.id}${zombie.type?.gold ? '+gold' : ''}`;
  function nearby(origin, radius, test = () => true) {
    return zombies.zombies
      .filter((z) => z !== origin && z.isAlive && isReturnable(z) && test(z)
        && Math.abs(z.position.y - origin.position.y) <= cfg.levelTolerance
        && Math.hypot(z.position.x - origin.position.x, z.position.z - origin.position.z) <= radius)
      .sort((a, b) => a.position.distanceToSquared(origin.position) - b.position.distanceToSquared(origin.position));
  }
  function alsoReturn(list) {
    for (const zombie of list) {
      const point = zombie.position.clone();
      point.y += zombie.type.height * 0.6;
      returnToSender(zombie, { effects, sound, point });
    }
  }
  function applyLabel(zombie) {
    const label = cfg.labels[fitted];
    if (fitted === 'chain') alsoReturn(nearby(zombie, label.radius).slice(0, label.count));
    else if (fitted === 'recall') {
      const kind = kindOf(zombie);
      alsoReturn(nearby(zombie, label.radius, (z) => kindOf(z) === kind).slice(0, label.count));
    } else if (fitted === 'refund') {
      wallet.earn(label.points);
      const weapon = gun.def.id === cfg.weaponId ? gun.weapon : null;
      if (weapon && random() < label.ammoChance) weapon.reserve = Math.min(weapon.reserveCap, weapon.reserve + 1);
    }
  }

  // A ticked working duty issues its label. (Line 4, leaving, has none.)
  events.on('closingLine', ({ line }) => {
    const id = LABEL_IDS.find((labelId) => cfg.labels[labelId].duty === line);
    if (!id || labels.has(id) || state.over) return;
    labels.add(id);
    events.emit('returnLabel', { labelId: id, pa: cfg.labelPa(cfg.labels[id].name) });
  });

  // What the label slot would fit next: the labels held, in order, then back to none.
  const cycle = () => [null, ...LABEL_IDS.filter((id) => labels.has(id))];
  const nextLabel = () => { const order = cycle(); return order[(order.indexOf(fitted) + 1) % order.length]; };

  return {
    get stage() { return stage(); },
    signDown: (id) => signs.has(id),
    get signsLeft() { return cfg.signs.length - signs.size; },
    get parcel() { return parcel; },
    get served() { return served; },
    get issued() { return issued; },
    get labels() { return LABEL_IDS.filter((id) => labels.has(id)); },
    get fitted() { return fitted; },
    get nextLabel() { return nextLabel(); },
    labelName: (id) => (id ? cfg.labels[id].name : cfg.plainName),

    /** Step 1: a NO REFUNDS sign was shot. True when that is news. */
    shootSign(id) {
      if (state.over || signs.has(id) || !cfg.signs.some((sign) => sign.id === id)) return false;
      signs.add(id);
      if (signs.size === cfg.signs.length) done('policy', cfg.pa.policy);
      return true;
    },
    /** Step 3 begins: take a number at the desk. */
    pullTicket() {
      if (state.over || stage() !== 'ticket') return false;
      ticket = true;
      served = 0;
      done('ticket', cfg.pa.ticket(cfg.ticket.number));
      return true;
    },
    /** Step 4: the gun, free. Once collected it is reissued free whenever you no longer own one. */
    collect() {
      if (state.over || !['collect', 'done'].includes(stage()) || gun.owns(def.id)) return false;
      const first = !issued;
      issued = true;
      gun.give(def);
      if (first) done('collect', cfg.pa.collect);
      return true;
    },
    /** The desk's label slot: fit the next label held (or none). Returns the label now fitted, or null. */
    cycleLabel() {
      if (state.over || !labels.size) return fitted;
      fitted = nextLabel();
      events.emit('returnLabel', { labelId: fitted, fitted: true });
      return fitted;
    },

    // Step 2: a charging zombie crashed near the desk (the Cart Pusher, or Officer Kettle).
    update() {
      if (state.over || stage() !== 'damaged') return;
      if (zombies.zombies.some((z) => z.isAlive && z.state === 'crashed' && nearDesk(z.position, cfg.crash.radius))) {
        parcel = true;
        done('damaged', cfg.pa.damaged);
      }
    },

    serialize() {
      return { signs: [...signs], parcel, ticket, served, issued, labels: [...labels], fitted };
    },
    restore(data) {
      this.reset();
      for (const id of data.signs ?? []) if (cfg.signs.some((sign) => sign.id === id)) signs.add(id);
      parcel = !!data.parcel; ticket = !!data.ticket; served = data.served ?? 0; issued = !!data.issued;
      for (const id of data.labels ?? []) if (returnLabel(id)) labels.add(id);
      fitted = labels.has(data.fitted) ? data.fitted : null;
    },
    reset() {
      signs.clear();
      parcel = ticket = issued = false;
      served = 0;
      labels.clear();
      fitted = null;
    },
    /** Developer shortcut: g.returnQuest.debug('policy' | 'damaged' | 'ticket' | 'called' | 'labels'): jump past a step. */
    debug(step) {
      if (step === 'labels') { for (const id of LABEL_IDS) labels.add(id); return 'Labels: ' + LABEL_IDS.join(', '); }
      const order = ['policy', 'damaged', 'ticket', 'called'];
      const upTo = order.indexOf(step);
      if (upTo < 0) return "Use g.returnQuest.debug('policy' | 'damaged' | 'ticket' | 'called' | 'labels')";
      for (const sign of cfg.signs) signs.add(sign.id);
      if (upTo >= 1) parcel = true;
      if (upTo >= 2) ticket = true;
      if (upTo >= 3) served = cfg.ticket.number;
      return 'Return quest: ' + stage();
    },
  };
}
