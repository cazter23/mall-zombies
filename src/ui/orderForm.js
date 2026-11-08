// Build-A-Blaster's order form, drawn from the game's view of it (game/features/workshopOrderForm.js). Only draws: the choices are made on
// the fixed tick from actions, so the mouse stays locked and the game keeps running behind it.
const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

export function createOrderFormView() {
  const element = document.createElement('div');
  element.className = 'order-form';
  element.hidden = true;
  element.innerHTML = `
    <div class="order-head"><span class="order-kicker">Build-A-Blaster · Order form</span><span class="order-title"></span></div>
    <div class="order-columns">
      <div class="order-column" data-column="0"><div class="order-label">Stuffing</div><ul class="order-list" data-list="stuffings"></ul></div>
      <div class="order-column" data-column="1"><div class="order-label">Heart</div><ul class="order-list" data-list="hearts"></ul></div>
    </div>
    <div class="order-foot"><span class="order-keys"></span><span class="order-price"></span></div>`;
  const title = element.querySelector('.order-title');
  const lists = { stuffings: element.querySelector('[data-list="stuffings"]'), hearts: element.querySelector('[data-list="hearts"]') };
  const columns = [...element.querySelectorAll('.order-column')];
  const keys = element.querySelector('.order-keys');
  const price = element.querySelector('.order-price');
  let lastKey = '';

  function row(item, selected) {
    const li = document.createElement('li');
    li.className = `order-row${selected ? ' selected' : ''}${item.available === false ? ' out' : ''}`;
    if (item.color !== undefined) li.style.setProperty('--swatch', hex(item.color));
    const name = document.createElement('b');
    name.textContent = item.name;
    const blurb = document.createElement('span');
    blurb.textContent = item.note ?? item.blurb;
    li.append(name, blurb);
    return li;
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
      lists.stuffings.replaceChildren(...view.stuffings.map((s) => row(s, s.selected)));
      lists.hearts.replaceChildren(...view.hearts.map((h) => row(h, h.selected)));
      columns.forEach((c, i) => c.classList.toggle('active', i === view.column));
      keys.textContent = `${labels.move} choose · ${labels.switch} stuffing / heart · ${labels.confirm} order · ${labels.back} cancel`;
      price.textContent = view.canAfford ? view.cost.toLocaleString('en-US') : `Need ${view.shortfall.toLocaleString('en-US')} more`;
      element.classList.toggle('cant', !view.canAfford);
      element.classList.toggle('denied', view.denied);
    },
  };
}
