// =============================================================================
// OUTFIT RAIL (the drawing half; game/outfitRail.js decides what pulses): a little chrome hanger rail with four price tags, one per
// slot (head, torso, feet, accessory). A worn item's tag is in the item's signature colour with its icon and short name; an EMPTY slot
// is a dashed silhouette with the slot's name, so the rail says from round 1 that there is more to buy.
//
//   const rail = createOutfitRail({ variant })   variant: 'hud' (the corner of the screen), 'pause' (large, with each item's stat
//                                                lines), 'receipt' (the death receipt's DIED WEARING row)
//   rail.el                                      the element to put somewhere
//   rail.setSlot(slot, id, lines = [])           dress one slot (id null = empty); lines = [{ text, good }] (pause only)
//   rail.set([{ slot, id, lines }])              dress several
//   rail.clear()                                 every slot empty
//   rail.pulse(slot)                             swing and flash that tag (restarts if it is already swinging)
// Colours come from config/wardrobe.js (`color`), the swing and flash from retail.css (.outfit-tag.pulse).
// =============================================================================
import { wardrobeItems, wardrobeSlots, outfitRail as cfg } from '../config/wardrobe.js';
import { iconSvg, slotSvg } from './outfitIcons.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
// Dark ink on a light tag, light ink on a dark one (relative luminance of the item's colour).
const inkFor = (n) => {
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#1c1220' : '#fff8ec';
};

export function createOutfitRail({ variant = 'hud' } = {}) {
  const el = document.createElement('div');
  el.className = `outfit-rail outfit-${variant}`;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', variant === 'receipt' ? 'Outfit worn at death' : 'Equipped wardrobe');
  if (variant !== 'receipt') {
    const bar = document.createElement('div');
    bar.className = 'outfit-bar';
    el.append(bar);
  }
  const tags = {};
  for (const [slot, label] of Object.entries(wardrobeSlots)) {
    const tag = document.createElement('div');
    tag.className = 'outfit-tag empty';
    tag.dataset.slot = slot;
    tag.title = `${label}: Empty`;
    el.append(tag);
    tags[slot] = tag;
  }

  function setSlot(slot, id, lines = []) {
    const tag = tags[slot];
    const item = id ? wardrobeItems[id] : null;
    tag.classList.toggle('empty', !item);
    tag.title = `${wardrobeSlots[slot]}: ${item?.name ?? 'Empty'}`;
    if (item) {
      tag.style.setProperty('--tag', hex(item.color));
      tag.style.setProperty('--ink', inkFor(item.color));
    } else {
      tag.style.removeProperty('--tag');
      tag.style.removeProperty('--ink');
    }
    const lineHtml = variant === 'pause' && lines.length
      ? `<ul class="tag-lines">${lines.map(({ text, good }) => `<li class="${good ? 'good' : 'bad'}">${text}</li>`).join('')}</ul>` : '';
    tag.innerHTML = `<i class="tag-hook"></i><div class="tag-body">${item ? iconSvg(item.icon) : slotSvg(slot)}`
      + `<span class="tag-name">${item ? item.shortName : cfg.emptyLabels[slot]}</span></div>${lineHtml}`;
  }
  const clear = () => { for (const slot of Object.keys(tags)) setSlot(slot, null); };
  clear();

  return {
    el,
    setSlot,
    set(entries) { for (const { slot, id, lines } of entries) setSlot(slot, id, lines); },
    clear,
    pulse(slot) {
      const tag = tags[slot];
      if (!tag || tag.classList.contains('empty')) return;
      tag.classList.remove('pulse');
      void tag.offsetWidth; // (restart the animation)
      tag.classList.add('pulse');
      clearTimeout(tag._pulseTimer);
      tag._pulseTimer = setTimeout(() => tag.classList.remove('pulse'), cfg.pulseSeconds * 1000);
    },
  };
}
