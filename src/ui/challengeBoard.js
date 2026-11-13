// The title screen's Challenges tab: every challenge (game/challengeCatalog.js) with its progress, and a pin on each. Up to
// config/challengeBoard.js maxPins pins; the challenge tracker (ui/challengeTracker.js) shows them in a run when it is turned on.
// Plain DOM, built like the locker (ui/locker.js): a list of groups on the left (a heading per category), the chosen group's challenges
// on the right; keyboard and pad move through every button, Enter / A presses one.
import { challengeCatalog } from '../game/challengeCatalog.js';
import { challengeBoard as cfg } from '../config/challengeBoard.js';
import { padBook } from './menuFocus.js';
import { hintHtml } from './glyphs.js';

export function createChallengeBoard({ save, pins, onBack, trackerEnabled = () => true, getChallenges = () => null, guideSave = null }) {
  const element = document.createElement('div');
  element.className = 'screen locker-screen challenge-board hidden';
  for (const [name, value] of Object.entries(cfg.theme)) element.style.setProperty('--locker-' + name, value);
  element.innerHTML = `
    <div class="card locker-card">
      <div class="form-number">${cfg.form}</div>
      <div class="kicker">${cfg.kicker}</div><h1>${cfg.title}</h1>
      <p class="challenge-pins" aria-live="polite"></p>
      <p class="challenge-note" hidden></p>
      <div class="locker-layout">
        <section class="locker-equipment challenge-groups"></section>
        <section class="locker-finishes"><h2 class="challenge-group-title"></h2><div class="locker-skins challenge-list"></div></section>
      </div>
      <div class="menu-row"><button class="menu-btn locker-back" type="button">${cfg.back}</button></div>
      <p class="pad-hint" data-hint="challenges">${hintHtml('challenges')}</p>
    </div>`;
  const groupList = element.querySelector('.challenge-groups');
  const list = element.querySelector('.challenge-list');
  const groupTitle = element.querySelector('.challenge-group-title');
  const pinLine = element.querySelector('.challenge-pins');
  const note = element.querySelector('.challenge-note');
  const back = element.querySelector('.locker-back');
  const catalog = challengeCatalog();
  let open = false;
  let selected = catalog[0].groups[0];
  let focus = 0;
  const buttons = () => [...element.querySelectorAll('button')];
  const ctx = () => ({ save, challenges: getChallenges(), guideSave });

  function fillHeader(message = null) {
    pinLine.textContent = message ?? cfg.pinCount(pins.ids.length, cfg.maxPins);
    pinLine.classList.toggle('full', !!message);
    note.textContent = cfg.trackerOff;
    note.hidden = trackerEnabled();
  }

  function fillList() {
    list.replaceChildren();
    groupTitle.textContent = selected.label;
    for (const entry of selected.entries) {
      const pinned = pins.has(entry.id), done = entry.done(ctx());
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `locker-skin challenge-row${done ? ' done' : ''}${pinned ? ' pinned' : ''}`;
      row.setAttribute('data-challenge', entry.id);
      row.setAttribute('aria-pressed', String(pinned));
      const name = document.createElement('b');
      name.textContent = entry.name;
      const tag = document.createElement('em');
      tag.className = 'challenge-tag';
      tag.textContent = entry.tag;
      const text = document.createElement('span');
      text.textContent = entry.text;
      const status = document.createElement('small');
      status.textContent = [entry.progress(ctx()), done ? cfg.done : null, pinned ? cfg.pinned : cfg.pin].filter(Boolean).join(' · ');
      row.append(name, tag, text, status);
      row.addEventListener('click', () => {
        const result = pins.toggle(entry.id);
        const index = buttons().indexOf(row);
        fillList();
        fillHeader(result === null ? cfg.full(cfg.maxPins) : null);
        focus = index;
        buttons()[focus]?.focus();
      });
      list.append(row);
    }
  }

  for (const category of catalog) {
    const heading = document.createElement('h2');
    heading.textContent = category.label;
    groupList.append(heading);
    const groups = document.createElement('div');
    groups.className = 'locker-guns';
    for (const group of category.groups) {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'menu-btn locker-gun';
      row.setAttribute('data-group', group.id);
      row.textContent = group.label;
      row.addEventListener('click', () => {
        selected = group;
        for (const button of groupList.querySelectorAll('[data-group]')) button.setAttribute('aria-pressed', String(button === row));
        fillList();
      });
      groups.append(row);
    }
    groupList.append(groups);
  }
  back.addEventListener('click', () => onBack());

  const at = () => {
    const active = buttons().indexOf(document.activeElement);
    return active >= 0 ? active : focus;
  };
  function move(step) {
    const all = buttons();
    focusAt((at() + step + all.length) % all.length);
  }
  // LB / RB: the previous / next group, picked (its challenges listed), the cursor on it.
  function nextGroup(dir) {
    const rows = [...groupList.querySelectorAll('[data-group]')];
    const here = rows.findIndex((row) => row.dataset.group === selected.id);
    const row = rows[(Math.max(0, here) + dir + rows.length) % rows.length];
    row?.click();
    if (row) focusAt(buttons().indexOf(row));
  }
  function focusAt(index) {
    const all = buttons();
    focus = index;
    all.forEach((row, i) => row.classList.toggle('focused', i === focus));
    all[focus].focus();
    all[focus].scrollIntoView?.({ block: 'nearest' });
  }
  const onKey = event => {
    if (!open) return;
    if (event.code === 'Escape') { event.preventDefault(); onBack(); }
    else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.code)) {
      event.preventDefault();
      move(event.code === 'ArrowDown' || event.code === 'ArrowRight' ? 1 : -1);
    }
  };

  return {
    element,
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      element.classList.remove('hidden');
      document.addEventListener('keydown', onKey);
      for (const button of groupList.querySelectorAll('[data-group]')) button.setAttribute('aria-pressed', String(button.dataset.group === selected.id));
      fillHeader();
      fillList();
      focus = buttons().findIndex(button => button.dataset.group === selected.id);
      buttons()[focus]?.focus();
    },
    close() {
      if (!open) return;
      open = false;
      document.removeEventListener('keydown', onKey);
      element.classList.add('hidden');
    },
    render() {},
    // Controller (ui/menuFocus.js padBook): move between groups and challenges, LB / RB the previous / next group, A pins.
    padNav(input) {
      if (!open) return;
      padBook(input, { list: buttons, at, focusAt, back: onBack, tab: nextGroup, scrollHost: element });
    },
  };
}
