// =============================================================================
// RECEIPT ART: what the SHIFT COMPLETE receipt gains over the death receipt (ui/screens.js fills it; styles in
// ui/receiptArt.css; words in config/closingTime.js receipt.art).
//   receiptArtHtml()           the printed picture: Skylar's van leaving the lot into a striped sunset, drawn in one ink
//                              colour (currentColor) and the paper's colour, as a thermal printer would
//   returnSlipHtml()           the return slip for the Last Customer
//   overtimeCouponHtml(terms)  the coupon stating overtime's terms (config/closingTime.js overtime), while the choice is open
// =============================================================================

import { closingTime } from '../config/closingTime.js';

const words = closingTime.receipt.art;
const PAPER = 'var(--receipt-paper, #fbf8f1)';

// Left: the mall with its pylon sign; right: the parking deck, a lamp post and the fence. Paper-coloured windows.
const scenery = `
  <rect x="8" y="50" width="84" height="20" />
  <rect x="58" y="26" width="8" height="24" />
  <rect x="46" y="18" width="32" height="12" rx="2" />
  <rect x="49" y="21" width="26" height="6" fill="${PAPER}" />
  ${[16, 30, 44, 72].map((x) => `<rect x="${x}" y="56" width="8" height="5" fill="${PAPER}" />`).join('')}
  <rect x="170" y="55" width="82" height="15" />
  ${[176, 192, 208, 224, 240].map((x) => `<rect x="${x}" y="59" width="7" height="4" fill="${PAPER}" />`).join('')}
  <rect x="234" y="34" width="2" height="21" />
  <rect x="226" y="33" width="12" height="3" />
  ${Array.from({ length: 12 }, (_, i) => `<rect x="${166 + i * 8}" y="64" width="1.4" height="6" fill="${PAPER}" />`).join('')}`;

// The van from behind, driving off down the middle of the road, with a puff of exhaust.
const van = `
  <rect x="116" y="73" width="28" height="17" rx="2" />
  <rect x="119" y="75.5" width="22" height="6" rx="1" fill="${PAPER}" />
  <rect x="117.5" y="84" width="3.5" height="3" fill="${PAPER}" />
  <rect x="139" y="84" width="3.5" height="3" fill="${PAPER}" />
  <rect x="126" y="84.5" width="8" height="2.5" fill="${PAPER}" />
  <rect x="114.5" y="89" width="31" height="2.5" />
  <rect x="117" y="91" width="5" height="4" />
  <rect x="138" y="91" width="5" height="4" />
  <circle cx="111" cy="92" r="2.4" fill="none" stroke="currentColor" stroke-width="1.1" />
  <circle cx="104.5" cy="94.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.1" />
  <circle cx="97" cy="96" r="2" fill="none" stroke="currentColor" stroke-width="1" />`;

export function receiptArtHtml() {
  return `
    <svg class="receipt-art-picture" viewBox="0 0 260 100" role="img" aria-label="${words.caption}" fill="currentColor">
      <defs>
        <pattern id="receipt-art-dots" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.95" />
        </pattern>
      </defs>
      <circle cx="130" cy="70" r="40" fill="url(#receipt-art-dots)" />
      <circle cx="130" cy="70" r="40" fill="none" stroke="currentColor" stroke-width="1.4" />
      ${[[47, 2], [54, 3], [61, 4]].map(([y, h]) => `<rect x="88" y="${y}" width="84" height="${h}" fill="${PAPER}" />`).join('')}
      ${scenery}
      <rect x="0" y="70" width="260" height="30" fill="${PAPER}" />
      <rect x="0" y="69.3" width="260" height="1.5" />
      <path d="M126 70 L58 100 M134 70 L202 100" stroke="currentColor" stroke-width="1.3" fill="none" />
      <path d="M130 71 L130 100" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3" fill="none" />
      ${van}
    </svg>
    <div class="receipt-art-caption">${words.caption}</div>`;
}

export function returnSlipHtml() {
  return `
    <div class="receipt-return-head">${words.returnHead}</div>
    <div class="receipt-line"><span>${words.returnItem}</span><i></i><span>${words.returnValue}</span></div>
    <div class="receipt-return-note">${words.returnNote}</div>`;
}

export function overtimeCouponHtml(terms = closingTime.overtime) {
  return `
    <div class="receipt-coupon-head">${words.couponHead}</div>
    ${words.couponLines(terms).map((line) => `<div class="receipt-coupon-line">${line}</div>`).join('')}
    <div class="receipt-coupon-fine">${words.couponFine}</div>`;
}
