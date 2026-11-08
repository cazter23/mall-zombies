// Build-A-Blaster's order form, drawn from the game's view of it (game/features/workshopOrderForm.js). Only draws: the choices are made on
// the fixed tick from actions, so the mouse stays locked and the game keeps running behind it.
// It is read mid-fight, so: sizes follow the screen height (retail.css), the column you are moving in is the one with a solid highlight,
// stuffings you can't pick fold into one short list, one line says what the order does, and the buttons are drawn as keycaps.
const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

/** 'W/S' -> two keys, '◀ ▶' -> two keys, 'D-pad' -> one. */
export function keycaps(label) {
  const parts = String(label).split(/\/|\s+(?=\S)/).filter(Boolean);
  return parts.map((part) => {
    const key = document.createElement('kbd');
    key.className = 'order-key';
    key.textContent = part;
    return key;
  });
}

/** One line on what the order does: "Fires on a headshot: slows everything round the hit". */
export function orderSummary(stuffing, heart) {
  if (!stuffing || !heart) return '';
  return `${heart.blurb.replace(/\.$/, '')}: ${lowerFirst(stuffing.blurb).replace(/\.$/, '')}.`;
}

export function createOrderFormView() {
  const element = document.createElement('div');
  element.className = 'order-form';
  element.hidden = true;
  element.innerHTML = `
    <div class="order-head"><span class="order-kicker">Build-A-Blaster · Order form</span><span class="order-title"></span></div>
    <div class="order-columns">
      <div class="order-column" data-column="0"><div class="order-label">Stuffing <span class="order-hint" data-hint="move"></span></div><ul class="order-list" data-list="stuffings"></ul><div class="order-out"></div></div>
      <div class="order-column" data-column="1"><div class="order-label">Heart <span class="order-hint" data-hint="move"></span></div><ul class="order-list" data-list="hearts"></ul></div>
    </div>
    <div class="order-summary"><span class="order-summary-label">Your blaster</span><span class="order-summary-text"></span></div>
    <div class="order-foot">
      <div class="order-keys">
        <span class="order-keyhint" data-hint="switch"></span>
        <span class="order-keyhint" data-hint="back"></span>
      </div>
      <div class="order-action">
        <div class="order-button"><span class="order-button-keys"></span><span class="order-button-text">Order</span><span class="order-price"></span></div>
        <div class="order-need"></div>
      </div>
    </div>`;
  const $ = (selector) => element.querySelector(selector);
  const title = $('.order-title');
  const lists = { stuffings: $('[data-list="stuffings"]'), hearts: $('[data-list="hearts"]') };
  const columns = [...element.querySelectorAll('.order-column')];
  const out = $('.order-out');
  const summary = $('.order-summary-text');
  const switchHint = $('[data-hint="switch"]');
  const backHint = $('[data-hint="back"]');
  const moveHints = [...element.querySelectorAll('.order-label [data-hint="move"]')];
  const buttonKeys = $('.order-button-keys');
  const price = $('.order-price');
  const need = $('.order-need');
  let lastKey = '';

  function row(item) {
    const li = document.createElement('li');
    li.className = `order-row${item.selected ? ' selected' : ''}`;
    if (item.color !== undefined) li.style.setProperty('--swatch', hex(item.color));
    const name = document.createElement('b');
    name.textContent = item.name;
    const blurb = document.createElement('span');
    blurb.textContent = item.blurb;
    li.append(name, blurb);
    return li;
  }

  /** The stuffings you can't pick yet, one short line each, under the list. */
  function outOfStock(items) {
    out.replaceChildren();
    out.hidden = !items.length;
    if (!items.length) return;
    const heading = document.createElement('div');
    heading.className = 'order-out-heading';
    heading.textContent = 'Not in stock';
    out.append(heading);
    for (const item of items) {
      const line = document.createElement('div');
      line.className = 'order-out-row';
      if (item.color !== undefined) line.style.setProperty('--swatch', hex(item.color));
      const name = document.createElement('b');
      name.textContent = item.name;
      const note = document.createElement('span');
      note.textContent = item.note ?? '';
      line.append(name, note);
      out.append(line);
    }
  }

  function hint(target, label, text) {
    const words = document.createElement('span');
    words.textContent = text;
    target.replaceChildren(...keycaps(label), words);
  }

  return {
    element,
    /** view: null hides it. labels: { confirm, back, move, switch } button names for the device in use. */
    update(view, labels) {
      element.hidden = !view;
      if (!view) {
        lastKey = '';
        return;
      }
      const key = JSON.stringify([view, labels]);
      if (key === lastKey) return;
      lastKey = key;
      title.textContent = view.title;
      lists.stuffings.replaceChildren(...view.stuffings.filter((s) => s.available !== false).map(row));
      outOfStock(view.stuffings.filter((s) => s.available === false));
      lists.hearts.replaceChildren(...view.hearts.map(row));
      columns.forEach((c, i) => c.classList.toggle('active', i === view.column));
      // The up/down keys show on the column you are in.
      moveHints.forEach((h, i) => (i === view.column ? h.replaceChildren(...keycaps(labels.move)) : h.replaceChildren()));
      hint(switchHint, labels.switch, view.column === 0 ? 'Heart' : 'Stuffing');
      hint(backHint, labels.back, 'Cancel');
      buttonKeys.replaceChildren(...keycaps(labels.confirm));
      summary.textContent = orderSummary(view.stuffings.find((s) => s.selected), view.hearts.find((h) => h.selected));
      price.textContent = view.cost.toLocaleString('en-US');
      need.textContent = view.canAfford ? '' : `Need ${view.shortfall.toLocaleString('en-US')} more points`;
      need.hidden = view.canAfford;
      element.classList.toggle('cant', !view.canAfford);
      element.classList.toggle('denied', view.denied);
    },
  };
}
