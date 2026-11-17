// =============================================================================
// A TEST RANGE BENCH'S FORM (debug mode: maps/testRange/benchForm.js `view`: the armory bench and the zombie pen's console). The order
// form's paper and keycaps (ui/orderForm.js, retail.css .order-*), like the fitting-room picker: the page names on top, that page's
// columns (each scrolls to its highlighted choice), what is in effect marked in each, the last change's message under them. Only draws;
// the choices are made on the fixed tick.
//
//   const form = createBenchFormView()  (main.js appends form.element)
//   form.update(view | null, labels)    labels: { confirm, back, move, switch } for the device in use
// =============================================================================
import { keycaps } from './orderForm.js';

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

export function createBenchFormView() {
  const element = document.createElement('div');
  element.className = 'order-form fitting-form armory-form';
  element.hidden = true;
  let lastKey = '';

  const el = (tag, className, text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  function column(col) {
    const box = el('div', `order-column${col.active ? ' active' : ''}`);
    const list = el('ul', 'order-list');
    for (const item of col.items) {
      const li = el('li', `order-row${item.selected ? ' selected' : ''}${item.available ? '' : ' unavailable'}`);
      if (item.color != null) li.style.setProperty('--swatch', hex(item.color));
      li.append(el('b', '', item.name), el('span', '', item.current ? 'Current' : item.available ? '' : item.note));
      list.append(li);
    }
    box.append(el('div', 'order-label', col.name), list);
    return box;
  }

  function hint(label, text) {
    const node = el('span', 'order-keyhint');
    node.append(...keycaps(label), el('span', '', text));
    return node;
  }

  return {
    element,
    update(view, labels) {
      element.hidden = !view;
      if (!view) { lastKey = ''; return; }
      const key = JSON.stringify([view, labels]);
      if (key === lastKey) return;
      lastKey = key;
      const head = el('div', 'order-head');
      head.append(el('span', 'order-kicker', view.kicker), el('span', 'order-title', view.title));
      const pages = el('div', 'armory-pages');
      for (const page of view.pages) pages.append(el('span', `armory-page${page.active ? ' active' : ''}`, page.name));
      const columns = el('div', 'order-columns');
      columns.style.setProperty('--armory-columns', String(view.columns.length));
      columns.append(...view.columns.map(column));
      const scroll = el('div', 'order-scroll');
      scroll.append(pages, columns, el('div', 'armory-message', view.message || 'Confirm applies the highlighted choice at once.'));
      const keys = el('div', 'order-keys');
      keys.append(hint(labels.switch, 'Column / page'), hint(labels.move, 'Choice'), hint(labels.confirm, 'Apply'), hint(labels.back, 'Done'));
      const foot = el('div', 'order-foot');
      foot.append(keys);
      element.replaceChildren(head, scroll, foot);
      // A long column (15 guns) scrolls: keep each column's highlighted choice in view.
      for (const list of columns.querySelectorAll('.order-list')) {
        const row = list.querySelector('.order-row.selected');
        if (row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2);
      }
    },
  };
}
