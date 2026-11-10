// The words-only rule (config/effectWords.js): players never see what an upgrade does as a number. This guards it: the size bands, and every
// player-facing string that describes an effect (tiers, attachments, wardrobe tickets, stuffing blurbs, incentive hints, sale and boss PA lines, and
// the real prompts the game builds from them) must have no digit followed by %, x, s, m, a degree sign or an arrow, and no spelled-out percentages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headlessGame.js';
import { sizeBands, sizeWord, changeOf, fillSize, describeEffects, hasStatNumber } from '../src/config/effectWords.js';
import { upgrades } from '../src/config/upgrades.js';
import { wardrobeItems } from '../src/config/wardrobe.js';
import { workshopStuffings, workshopHearts, stuffingBlurb } from '../src/config/workshop.js';
import { powerUps } from '../src/config/powerUps.js';
import { economy } from '../src/config/economy.js';
import { bossVouchers, bossTypes } from '../src/config/bosses.js';
import { attachmentCounterItem } from '../src/game/features/attachmentCounter.js';
import { upgradeDeskItem } from '../src/game/features/upgradeDesk.js';
import { TIER_IDS, attachmentLines, tierLines, renewalLines } from '../src/weapons/upgrades.js';
import { ui } from '../src/config/ui.js';
import * as THREE from 'three';
import { clawMachine } from '../src/config/clawMachine.js';
import { weapons } from '../src/config/weapons.js';
import { dt } from './helpers/headlessGame.js';

const clean = (text, where) => {
  assert.ok(!hasStatNumber(text), `${where}: "${text}" shows a stat number`);
  assert.ok(!/\d+\s?%|percent|per cent|\bx\d|\d\s?×|multiplier/i.test(text), `${where}: "${text}" shows a percentage or multiplier`);
};

test('the size bands are fixed, ordered, symmetric, and fill {size} / {Size}', () => {
  assert.deepEqual(sizeBands.map((b) => b.word), ['a little', 'noticeably', 'much']);
  assert.ok(sizeBands.every((b, i) => i === 0 || b.upTo > sizeBands[i - 1].upTo));
  assert.equal(sizeWord(1.05), 'a little');
  assert.equal(sizeWord(1.1), 'a little');
  assert.equal(sizeWord(1.25), 'noticeably');
  assert.equal(sizeWord(1.5), 'much');
  assert.equal(sizeWord(1), 'a little');
  for (const r of [0.9, 0.8, 0.7, 0.5, 0.35, 0.95]) assert.equal(sizeWord(r), sizeWord(1 / r), `${r} and its inverse are the same size`);
  assert.ok(Math.abs(changeOf(0.8) - changeOf(1.25)) < 1e-9);
  assert.equal(fillSize('Reloads {size} faster', 0.85), 'Reloads noticeably faster');
  assert.equal(fillSize('{Size} more damage', 1.65), 'Much more damage');
  assert.equal(fillSize('Run dry? Ammo replaced free', undefined), 'Run dry? Ammo replaced free', 'a line with no token is left alone');
  assert.deepEqual(describeEffects([{ effect: 'damage', text: '{Size} more damage' }, { effect: 'adsTime', good: false, text: 'Aims {size} slower' }, { effect: 'recoil', text: '{Size} less recoil' }], { damage: 1.1, adsTime: 1.1, recoil: 0.65 }),
    [{ text: 'A little more damage', good: true }, { text: 'Much less recoil', good: true }, { text: 'Aims a little slower', good: false }], 'upsides first');
});

test('the detector catches stat numbers and leaves counts and names alone', () => {
  for (const bad of ['Reload 25% faster', 'Damage 1.2x', 'Sprint 4.0 s → 3.2 s', 'Full damage to 10m', 'Kick: 2° → 1.3°', 'Max health 100 → 125', 'Zombie hits 30 % more', 'x1.5 damage']) {
    assert.ok(hasStatNumber(bad) || /\d+\s?%|\bx\d/.test(bad), bad);
  }
  for (const fine of ['Reloads noticeably faster', 'Standard → Deluxe warranty', 'Renewal 2', 'Every 5th kill', 'Round 7', 'Platinum → Renewal 1', 'Magazine slot', '4 shoppers']) {
    assert.ok(!hasStatNumber(fine), fine);
  }
});

test('every effect line in config is words: tiers, renewals, attachments, wardrobe items, stuffings, hearts, incentives, sales and boss vouchers', () => {
  for (const tier of upgrades.tiers) for (const line of tierLines(tier.id)) clean(line.text, `tier ${tier.id}`);
  for (const tier of upgrades.tiers) clean(tier.job ?? '', `tier ${tier.id} job`);
  for (const line of renewalLines()) clean(line.text, 'renewal');
  for (const id of Object.keys(upgrades.attachments)) {
    const lines = attachmentLines(id);
    assert.ok(lines.length >= 1, `${id} says what it does`);
    for (const line of lines) clean(line.text, `attachment ${id}`);
    for (const line of upgrades.attachments[id].lines) assert.ok(line.effect in upgrades.attachments[id].effects || !line.effect, `${id}: a line for an effect it has`);
  }
  for (const [id, item] of Object.entries(wardrobeItems)) {
    clean(item.ticket, `${id} ticket`);
    for (const line of item.lines) clean(line.text.replace('{size}', 'much').replace('{Size}', 'Much'), `wardrobe ${id}`);
  }
  for (const id of Object.keys(workshopStuffings)) clean(stuffingBlurb(id), `stuffing ${id}`);
  for (const [id, heart] of Object.entries(workshopHearts)) clean(heart.blurb, `heart ${id}`);
  for (const [id, type] of Object.entries(powerUps.types)) {
    clean(type.hint ?? '', `incentive ${id} hint`);
    clean(type.pa?.text ?? '', `incentive ${id} PA`);
  }
  for (const group of economy.flashSales.groups) {
    // (a sale is a price, so its line keeps the percentage: {pct}% off. Only the words around it are checked)
    assert.match(group.start.text, /\{pct\}%/, `${group.id}: a sale says its percentage`);
    clean(group.start.text.replace('{pct}%', 'a discount'), `sale ${group.id}`);
    clean(group.end.text, `sale ${group.id} end`);
  }
  clean(bossVouchers.discountCode.pa.text, 'Discount Code PA');
  // every line any boss says (banners, PA, encore lines) is free of percentages and stat numbers
  const strings = (value, out = []) => { if (typeof value === 'string') out.push(value); else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out); return out; };
  for (const text of strings(bossTypes).filter((x) => x.includes(' '))) clean(text, 'boss text');
  for (const text of Object.values(ui.weaponRoles)) clean(text, 'weapon role');
});

test('every real prompt the game builds from them is words: attachment counters, the Customer Service desk, wardrobe tickets', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  game.tick();
  const { g } = game;
  const fixture = { zones: g.map.zones, gun: g.gun, pricing: g.pricing };
  for (const spot of g.map.features.filter((f) => f.kind === 'attachmentCounter')) {
    const item = attachmentCounterItem({ spot, ...fixture });
    clean(item.label, `${spot.attachment} label`);
    clean(item.detail, `${spot.attachment} detail`);
    assert.ok(item.detailLines.length >= 1);
    const terms = item.detail.split(' · ');
    for (const { text } of item.detailLines) assert.ok(terms.includes(text), `${spot.attachment}: "${text}" is on the prompt`);
  }
  const desk = g.map.features.find((f) => f.kind === 'upgradeDesk');
  const offers = [...TIER_IDS.slice(1).map((tier) => ({ kind: 'tier', tier, pricingId: tier })), { kind: 'renewal', count: 2, pricingId: 'renewal' },
    { kind: 'transfer', tier: 'premium', pricingId: 'premium:transfer' }];
  for (const offer of offers) {
    const item = upgradeDeskItem({ desk, zones: g.map.zones, gun: g.gun, pricing: g.pricing, warranty: { offer: () => offer } });
    clean(item.detail, `desk ${offer.kind} ${offer.tier ?? ''} detail`);
    const terms = item.detail.split(' · ');
    for (const { text } of item.detailLines) assert.ok(terms.includes(text), `desk: "${text}" is on the prompt`);
    assert.ok(item.detailLines.length >= 1 || offer.kind === 'transfer', offer.kind);
  }
  for (const id of Object.keys(wardrobeItems)) {
    clean(g.wardrobe.ticketDetail(id), `${id} ticket detail`);
    g.wallet.earn(1e6);
    g.wardrobe.buy(id);
    for (const { text } of g.wardrobe.wornLines(id)) clean(text, `${id} worn`);
  }
  for (const slot of ['head', 'torso', 'feet', 'accessory']) for (const tag of g.outfitRail.snapshot().filter((x) => x.slot === slot)) for (const { text } of tag.lines) clean(text, `rail ${tag.id}`);
});

// --- GRAB-A-GUN (docs/claw-machine-plan.md): everything the claw machine and the Prize Counter SAY is words too. Prices, points, ticket counts,
// "N left" and countdown seconds stay numbers (the clean() check only rejects a digit with %, x, s, m, a degree sign or an arrow, and percentages).
// A Flash Sale keeps its percentage (the claw sale group is checked with the others, above).

test('every claw machine line in config is words: prizes, screens, PA lines, the Prize Counter', () => {
  const strings = (value, out = []) => { if (typeof value === 'string') out.push(value); else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out); return out; };
  const multiplierWords = /\b(half|twice|double|triple|quadruple|times)\b/i; // (a multiplier in words is still a multiplier)
  for (const text of strings([clawMachine.name, clawMachine.capsules, clawMachine.plush, clawMachine.screen, clawMachine.pa])) { clean(text.replace('{price}', 'a price').replace('{area}', 'an area'), 'claw text'); assert.ok(!multiplierWords.test(text), `claw text: "${text}" says a multiplier in words`); }
  for (const prize of clawMachine.prizeCounter.prizes) { clean(prize.name, `${prize.id} name`); clean(prize.blurb, `${prize.id} blurb`); assert.ok(!multiplierWords.test(prize.blurb), `${prize.id} blurb says a multiplier in words`); }
  for (const id of Object.keys(clawMachine.prizes)) clean(weapons[id].name, `${id} name`);
  const claw = economy.flashSales.groups.find((group) => group.id === 'claw');
  assert.match(claw.start.text, /\{pct\}%/, 'the claw sale says its percentage, like every sale');
  clean(claw.start.text.replace('{pct}%', 'a discount'), 'claw sale');
  clean(claw.end.text, 'claw sale end');
});

test('every real prompt the claw machine and the Prize Counter build is words: pay, drop, take (new and Refurbished), each prize card', () => {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(500_000);
  g.map.areaUnlocks.unlock('hallway');
  t.tick(60);
  const realRandom = Math.random;
  process.once("beforeExit", () => { Math.random = realRandom; });
  let a = 11; // (seeded AFTER the map was built: Three.js makes object ids with Math.random)
  Math.random = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 2 ** 32; };
  const stand = (position, normal, floorY = 0, distance = 1.3) => {
    g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * distance, floorY, position.z + normal.z * distance), yaw: Math.atan2(normal.x, normal.z) });
    g.player.pitch = 0;
    t.tick();
  };
  const seen = (what) => { const p = g.interactions.prompt; if (!p) return null; for (const key of ['label', 'title', 'detail', 'priceLabel', 'blocked']) if (p[key]) clean(p[key], `${what} ${key}`); return p; };
  // The prize cards: with no tickets (refused: "Need more tickets"), then rich enough.
  const counter = g.map.features.find((f) => f.kind === 'prizeCounter');
  for (const withTickets of [false, true]) {
    g.tickets.spend(g.tickets.count);
    if (withTickets) g.tickets.add(1000, 'test');
    for (const slot of counter.slots) {
      stand(slot.position, counter.normal, 0, 0.9);
      assert.equal(seen(`prize ${slot.id}`)?.id, slot.id);
    }
  }
  // The machine: carry a gun with a free attachment slot so a Refurbished prize can come up, and grab until one has (or 40 grabs).
  g.gun.give(weapons.nailGun);
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine').instance;
  let refurbished = false;
  for (let grab = 0; grab < 40 && !refurbished; grab++) {
    claw.moveNow(claw.site.id);
    const { position, normal } = claw.site.cabinet;
    stand(position, normal, clawMachine.sites.find((s) => s.id === claw.site.id).floorY);
    assert.equal(seen('pay')?.kind, 'claw');
    t.press('KeyF', 20);
    assert.equal(seen('drop')?.id, 'drop');
    t.tick(Math.floor(Math.random() * 100));
    t.press('KeyF', 1);
    t.tick(Math.ceil(clawMachine.liftSeconds / dt) + 1);
    const take = seen('take');
    if (take?.id === 'take') { refurbished = /^Refurbished/.test(take.detail); t.press('KeyF', 20); }
    else t.tick(Math.ceil(clawMachine.takeSeconds / dt) + 5); // (a plush: the machine closed; wait it out)
  }
  assert.ok(refurbished, 'a Refurbished take prompt came up and was checked');
});
