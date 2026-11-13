import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';

menuDom(); // window mock for module imports
const { createScreens } = await import('../src/ui/screens.js');
const { receiptArtHtml, overtimeCouponHtml } = await import('../src/ui/receiptArt.js');
const { closingTime } = await import('../src/config/closingTime.js');

const summary = { timeAlive: 1500, round: 17, kills: 400, headshotKills: 90, meleeKills: 20, accuracy: 0.4, pointsEarned: 80000,
  pointsRemaining: 3000, shotsFired: 3000, won: true };
const shown = (selector) => !document.querySelector(selector).hidden;

test('the SHIFT COMPLETE receipt gains its art, the return slip and the overtime coupon; a death receipt has none of it', () => {
  document.body.replaceChildren();
  const screens = createScreens();
  const screen = () => document.querySelector('.results-screen');
  screens.show('results', { ...summary, shiftComplete: true });
  assert.ok(shown('.receipt-art') && shown('.receipt-return') && shown('.receipt-coupon'));
  assert.ok(screen().classList.contains('won'), 'the sunset backdrop and the teal stamp');
  assert.match(document.querySelector('.receipt-return').textContent, new RegExp(closingTime.receipt.art.returnValue));

  screens.show('results', { ...summary, shiftComplete: true, clockedOut: true });
  assert.ok(shown('.receipt-art') && shown('.receipt-return'));
  assert.ok(!shown('.receipt-coupon'), 'the choice is made: no coupon');

  screens.show('results', { ...summary, won: false, killedBy: { type: 'zombie', id: 'shopper' } });
  assert.ok(!shown('.receipt-art') && !shown('.receipt-return') && !shown('.receipt-coupon'));
  assert.ok(!screen().classList.contains('won'));
});

test('the coupon states overtime\'s real terms, and the picture is printed in one ink', () => {
  const coupon = overtimeCouponHtml({ killPay: 1.25, healthPerRound: 1.03 });
  assert.match(coupon, /Kills pay 125%/);
  assert.match(coupon, /\+3% health/);
  assert.match(overtimeCouponHtml(), new RegExp(`${Math.round(closingTime.overtime.killPay * 100)}%`));
  const art = receiptArtHtml();
  assert.match(art, /<svg/);
  assert.doesNotMatch(art, /#[0-9a-f]{3,6}\b(?!\))/i, 'no colour but the ink (currentColor) and the paper (its variable)');
});
