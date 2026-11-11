// The Returns Desk (Customer Service). Three jobs, on two prompts:
//   the desk itself   the Return to Sender quest's counter (game/returnQuest.js): what its prompt says IS the quest's
//                     trail. With the gun in hand it sells the gun's ammo instead (its only ammo source besides drops).
//   the label slot    with the gun in hand and a return label held: fits the next label, free.
// The gun is no longer sold here and the closing checklist no longer gates it: the quest issues it, free.
import * as THREE from 'three';
import { closingTime } from '../../config/closingTime.js';
import { returnQuest as questCfg } from '../../config/returnQuest.js';
import { weapons } from '../../config/weapons.js';

const box = new THREE.BoxGeometry(1, 1, 1);

export function buildReturnsDesk(feature, { scene, map, gun, pricing, interactions, state, sound, returnQuest: quest }) {
  const cfg = closingTime.returnsDesk;
  const words = questCfg.desk;
  const def = weapons[cfg.weaponId];
  const ammo = () => gun.def.id === def.id;
  const open = () => map.zones[feature.zone].open && !state.over;
  let sale = false; // was the last use of the desk an ammo sale?

  // The dented parcel on the tray, once damaged goods have been reported.
  const parcel = new THREE.Group();
  parcel.name = 'returns_desk_parcel';
  parcel.position.copy(feature.position);
  parcel.userData.dynamic = true;
  for (const part of questCfg.parcel.parts) {
    const mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85, flatShading: true }));
    mesh.scale.fromArray(part.size);
    mesh.position.fromArray(part.at);
    if (part.tilt) mesh.rotation.z = part.tilt;
    parcel.add(mesh);
  }
  parcel.visible = false;
  scene?.add(parcel);
  // The label printer on the wall beside it (always there: it is the label slot's prompt).
  const printer = new THREE.Group();
  printer.name = 'returns_desk_label_printer';
  printer.position.copy(feature.position);
  printer.userData.dynamic = true;
  for (const part of questCfg.slot.parts) {
    const mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7, flatShading: true }));
    mesh.scale.fromArray(part.size);
    mesh.position.fromArray(part.at);
    printer.add(mesh);
  }
  scene?.add(printer);

  interactions.add({
    get id() { return ammo() ? 'returnsAmmo' : 'returnsDesk'; },
    // Only the ammo is priced. 'closing' is a price category: the HUD looks up a shelf price for any prompt of that kind
    // (main.js), so the quest's free prompts must not claim it.
    get kind() { return ammo() ? 'closing' : 'returnQuest'; },
    // The bold line of the HUD's prompt: the desk's name while it only has something to say, the action once there is one.
    get title() {
      if (ammo() || gun.owns(def.id)) return cfg.name;
      const stage = quest.stage;
      return stage === 'ticket' ? words.ticket.title : stage === 'collect' || stage === 'done' ? words.collect.title(def.name) : cfg.name;
    },
    get label() {
      if (ammo()) return cfg.ammoName;
      return quest.stage === 'ticket' ? words.ticket.label : def.name;
    },
    get verb() {
      if (ammo()) return cfg.refill;
      return quest.stage === 'ticket' ? words.ticket.verb : words.collect.verb;
    },
    get cost() { return ammo() ? pricing.priceOf('closing', 'returnsAmmo') : 0; },
    get priceLabel() { return ammo() ? null : quest.stage === 'ticket' ? words.ticket.priceLabel : words.collect.priceLabel; },
    // Only the ammo is a purchase. The interaction system reads this AFTER use(), and collecting the gun puts it in hand
    // (so ammo() is already true by then): use() records what it was.
    get quiet() { return !sale; },
    get holdSeconds() { return ammo() ? undefined : words.holdSeconds; },
    get blocked() {
      if (gun.isSwitching) return cfg.busy;
      if (ammo()) return gun.weapon.isFull ? cfg.full : null;
      if (gun.owns(def.id)) return cfg.equip;
      const stage = quest.stage;
      if (stage === 'policy') return words.policy;
      if (stage === 'damaged') return words.damaged;
      if (stage === 'queue') return words.queue(quest.served, questCfg.ticket.number);
      return null; // 'ticket', 'collect', 'done'
    },
    position: feature.position,
    available: open,
    use() {
      sale = ammo();
      if (sale) gun.weapon.refill();
      else if (quest.stage === 'ticket') quest.pullTicket();
      else quest.collect();
    },
  });

  // The label slot, a step along the counter.
  const slot = questCfg.slot;
  const slotPosition = feature.position.clone().add(new THREE.Vector3(...slot.offset));
  interactions.add({
    id: 'returnsLabel',
    kind: 'returnQuest', // (free, never priced: see the desk's own prompt above)
    get title() { return slot.label(quest.labelName(quest.nextLabel)); }, // (the HUD's bold line: what a hold will fit)
    get label() { return slot.label(quest.labelName(quest.nextLabel)); },
    verb: slot.verb,
    cost: 0,
    priceLabel: slot.priceLabel,
    quiet: true,
    holdSeconds: slot.holdSeconds,
    get blocked() { return gun.isSwitching ? cfg.busy : null; },
    position: slotPosition,
    available: () => open() && ammo() && quest.labels.length > 0,
    use() {
      quest.cycleLabel();
      sound?.play(slot.sound);
    },
  });

  return {
    parcel,
    slotPosition,
    update() { parcel.visible = quest.parcel; },
  };
}
