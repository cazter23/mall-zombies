// The fitting-room picker, drawn from the game's view of it (game/features/fittingRoomPicker.js). Only draws: the choices are made on the
// fixed tick from actions, so the mouse stays locked and the game keeps running behind it. It borrows the order form's paper, rows and
// keycaps (ui/orderForm.js, retail.css .order-*): four slot columns, the one you are in highlighted, and under them what the highlighted
// item would change, upsides in green and downsides in red.
import { keycaps } from './orderForm.js';

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

export function createFittingRoomView() {
  const element = document.createElement('div');
  element.className = 'order-form fitting-form';
  element.hidden = true;
  element.innerHTML = `
    <div class="order-head"><span class="order-kicker">Fitting room · Free</span><span class="order-title"></span></div>
    <div class="order-scroll">
      <div class="order-columns"></div>
      <div class="order-summary"><span class="order-summary-label"></span><span class="fitting-joke"></span><div class="fitting-lines"></div></div>
    </div>
    <div class="order-foot">
      <div class="order-keys">
        <span class="order-keyhint" data-hint="switch"></span>
        <span class="order-keyhint" data-hint="move"></span>
        <span class="order-keyhint" data-hint="back"></span>
      </div>
      <div class="order-action">
        <div class="order-button"><span class="order-button-keys"></span><span class="order-button-text"></span></div>
      </div>
    </div>`;
  const $ = (selector) => element.querySelector(selector);
  const title = $('.order-title');
  const columns = $('.order-columns');
  const summaryLabel = $('.order-summary-label');
  const joke = $('.fitting-joke');
  const lines = $('.fitting-lines');
  const buttonKeys = $('.order-button-keys');
  const buttonText = $('.order-button-text');
  let lastKey = '';

  function hint(name, label, text) {
    const words = document.createElement('span');
    words.textContent = text;
    $(`[data-hint="${name}"]`).replaceChildren(...keycaps(label), words);
  }

  function column(slot) {
    const box = document.createElement('div');
    box.className = `order-column${slot.active ? ' active' : ''}`;
    const label = document.createElement('div');
    label.className = 'order-label';
    label.textContent = slot.name;
    const list = document.createElement('ul');
    list.className = 'order-list';
    for (const item of slot.items) {
      const li = document.createElement('li');
      li.className = `order-row${item.selected ? ' selected' : ''}`;
      li.dataset.icon = item.icon;
      li.style.setProperty('--swatch', hex(item.color));
      const name = document.createElement('b');
      name.textContent = item.name;
      const state = document.createElement('span');
      state.textContent = item.worn ? 'Wearing' : '';
      li.append(name, state);
      list.append(li);
    }
    if (!slot.items.length) {
      const empty = document.createElement('div');
      empty.className = 'fitting-empty';
      empty.textContent = 'Nothing yet';
      list.append(empty);
    }
    box.append(label, list);
    return box;
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
      columns.replaceChildren(...view.slots.map(column));
      summaryLabel.textContent = view.wearing ? 'You are wearing this' : view.replaces;
      joke.textContent = view.ticket;
      lines.replaceChildren(...view.lines.map((line) => {
        const row = document.createElement('span');
        row.className = `fitting-line ${line.good ? 'good' : 'bad'}`;
        row.textContent = line.text;
        return row;
      }));
      hint('switch', labels.switch, 'Slot');
      hint('move', labels.move, 'Item');
      hint('back', labels.back, 'Done');
      buttonKeys.replaceChildren(...keycaps(labels.confirm));
      buttonText.textContent = view.wearing ? 'Wearing' : 'Wear';
      element.classList.toggle('cant', view.wearing);
    },
  };
}
