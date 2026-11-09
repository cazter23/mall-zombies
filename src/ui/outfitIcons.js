// =============================================================================
// OUTFIT ICONS: the little SVG pictures on the outfit rail's price tags (no image files). 24 x 24 boxes, drawn in `currentColor`
// (the tag's ink); `iconSvg(id)` takes an item's `icon` id from config/wardrobe.js, `slotSvg(slot)` is the dashed silhouette an
// empty slot shows. Details that should read as cut-outs use `stroke` in the tag's colour (var(--tag)).
// =============================================================================

const cut = 'stroke="var(--tag, #fff)" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';

const icons = {
  // Burger Barn Paper Hat: a folded paper cap with its brim
  hat: `<path d="M4.5 17c0-6 3-10 7.5-10s7.5 4 7.5 10z"/><rect x="2.5" y="17" width="19" height="2.6" rx="1"/><path d="M9 11.5h6" ${cut}/>`,
  // Mirrored Aviators
  aviators: `<path d="M2.5 8.5h19V11c0 3.8-2.6 6-5.6 6-2.4 0-3.4-1.8-3.9-4-.5 2.2-1.5 4-3.9 4-3 0-5.6-2.2-5.6-6z"/><path d="M5.5 10.5l3 -1M15.5 10.5l3 -1" ${cut}/>`,
  // 3D Glasses: two lenses, the cardboard frame
  glasses3d: `<rect x="2" y="7.5" width="20" height="9" rx="1.6"/><rect x="4.2" y="9.4" width="6.2" height="5.2" rx=".8" fill="var(--tag, #fff)" opacity=".85"/><rect x="13.6" y="9.4" width="6.2" height="5.2" rx=".8" fill="var(--tag, #fff)" opacity=".5"/>`,
  // Heirloom Cardigan: sleeves, a placket and buttons
  cardigan: `<path d="M8 3.5l4 2.2 4-2.2 5.5 4.5-2.3 4.2-2.2-1.4V21H7V12.8l-2.2 1.4L2.5 8z"/><path d="M12 6v14.5" ${cut}/><circle cx="14.2" cy="10" r=".9" fill="var(--tag, #fff)"/><circle cx="14.2" cy="14" r=".9" fill="var(--tag, #fff)"/><circle cx="14.2" cy="18" r=".9" fill="var(--tag, #fff)"/>`,
  // EVERYTHING MUST GO Sandwich Board: an A-frame
  board: `<path d="M7 2.5h10l3 19H4z"/><path d="M8.2 8h7.6M7.6 12.2h8.8M7 16.4h10" ${cut}/>`,
  // Hi-Vis Vest: the reflective stripes
  vest: `<path d="M7 3.5h3l2 4 2-4h3l2 17H5z"/><path d="M8 13.5h8M7.6 17h8.8" fill="none" stroke="var(--tag, #fff)" stroke-width="1.8"/>`,
  // Light-Up Sneakers: a sneaker with a glowing sole
  sneaker: `<path d="M2.5 14V9.5l4.5-1 2 3h5.5c3.5 0 6.5 2 7 5v1H2.5z"/><path d="M2.5 17.2h19" ${cut}/><path d="M9 14.2l1.2-1.8M12 14.2l1.2-1.8" ${cut}/>`,
  // Orthopedic Mall Walkers: a sensible shoe with a strap
  walker: `<path d="M3.5 17.5V7h5v4.5c4.5 0 10.5 1 12 5v1z"/><path d="M3.5 15.4h17" ${cut}/><path d="M5.2 8.8h1.6" ${cut}/>`,
  // Wheelie Sneakers: a sneaker on a heel wheel
  wheelie: `<path d="M2.5 13V8.5l4.5-1 2 3h5c3.2 0 6 1.8 6.5 4.5V15H2.5z"/><circle cx="7" cy="18.2" r="2.6"/><circle cx="7" cy="18.2" r=".9" fill="var(--tag, #fff)"/><circle cx="17.5" cy="18.4" r="2.2"/>`,
  // Fanny Pack: the pouch, its zip and strap
  pack: `<path d="M3.5 10c0-2 1.8-3 4-3h9c2.2 0 4 1 4 3v5c0 2-1.8 3.2-4 3.2h-9c-2.2 0-4-1.2-4-3.2z"/><path d="M5 11h14" ${cut}/><rect x="10.6" y="10" width="2.8" height="3" rx=".6" fill="var(--tag, #fff)"/><path d="M1.5 9.2h2M20.5 9.2h2" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  // Giant Foam Finger: a fist with one finger up
  finger: `<path d="M10 2.5h3.2c.6 0 1 .4 1 1V10H19c.8 0 1.5.7 1.5 1.5V19c0 1-.8 1.8-1.8 1.8H8.5c-1 0-1.8-.8-1.8-1.8v-7.5c0-.8.6-1.5 1.5-1.5H9V3.5c0-.6.4-1 1-1z"/><path d="M8.5 14.5h10M8.5 17.5h10" ${cut}/>`,
  // Galleria Gold Card: stripe and chip
  card: `<rect x="2" y="5" width="20" height="14" rx="2.2"/><rect x="2" y="8.4" width="20" height="2.6" fill="var(--tag, #fff)" opacity=".55"/><rect x="4.4" y="13" width="4.4" height="3.2" rx=".7" fill="var(--tag, #fff)"/>`,
};

// The empty-slot silhouettes: outlines only (the rail draws them dashed).
const silhouettes = {
  head: `<path d="M12 4C8.4 4 6 6.8 6 10.5c0 3.8 2.2 6.5 6 6.5s6-2.7 6-6.5C18 6.8 15.6 4 12 4zM9.5 20h5" fill="none"/>`,
  torso: `<path d="M8 3.5l4 2 4-2 5 4-2.2 4.2L17 11v10H7V11l-1.8 .7L3 7.5z" fill="none"/>`,
  feet: `<path d="M3 16.5V9l4-1 2.5 3h5c3.2 0 5.5 1.8 6 4.5v1z" fill="none"/>`,
  accessory: `<path d="M3.5 9.5h17v6h-17zM10.5 9.5v6M13.5 9.5v6" fill="none"/>`,
};

/** An item icon (an `icon` id from config/wardrobe.js) as SVG markup; an unknown id gets a plain tag shape. */
export function iconSvg(id) {
  const body = icons[id] ?? '<rect x="5" y="5" width="14" height="14" rx="2"/>';
  return `<svg class="tag-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${body}</svg>`;
}

/** An empty slot's dashed silhouette. */
export function slotSvg(slot) {
  return `<svg class="tag-icon tag-silhouette" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.6 2.2" stroke-linecap="round" stroke-linejoin="round">${silhouettes[slot] ?? ''}</svg>`;
}

export const ICON_IDS = Object.keys(icons);
