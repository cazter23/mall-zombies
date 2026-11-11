// The Staff Survival Guide screen (off the title): every zombie type and boss, one page each, filled in from the
// permanent record (game/guideSave.js). Plain DOM, driven by the main loop like the weapon locker, so the title's idle
// saver also stops the turning model. All words and numbers: config/guide.js.
import * as THREE from 'three';
import { guide as cfg, guideEntries, guideSections, guideStage } from '../config/guide.js';
import { Zombie } from '../zombies/zombie.js';

/**
 * The turning model beside a page: the real zombie (its own model and walk animation), walking on the spot.
 * Renderer injection lets lifecycle tests build every model without WebGL.
 */
export function createGuidePreview(host, { makeRenderer = (options) => new THREE.WebGLRenderer(options) } = {}) {
  const c = cfg.preview;
  const renderer = makeRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, c.pixelRatio));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(c.background);
  scene.add(new THREE.HemisphereLight(c.sky, c.ground, c.ambientIntensity));
  const light = new THREE.DirectionalLight(c.key, c.keyIntensity);
  light.position.fromArray(c.keyPosition);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(c.fov, c.width / c.height, c.near, c.far);
  const pivot = new THREE.Group();
  scene.add(pivot);
  renderer.domElement.setAttribute('aria-label', cfg.previewLabel);
  host.append(renderer.domElement);
  let subject = null; // a Zombie that is never ticked: only its model is posed
  let width = 0, height = 0;
  const bounds = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3();

  function clear() {
    subject?.model.dispose();
    subject = null;
  }
  function pose(dt) {
    // The Mascot's stride is advanced by its fixed tick, which never runs here.
    if (subject.type.mascot) subject.mascotWalkPhase += subject.horizontalSpeed * dt * subject.type.mascot.pose.radiansPerMeter;
    subject.model.update(dt, subject, 1);
  }
  return {
    /** Show this zombie type, or nothing (null: a page not seen yet). */
    show(type) {
      clear();
      if (!type) return;
      subject = new Zombie({ type, health: 1, position: new THREE.Vector3(), yaw: 0 });
      subject.state = 'chasing';
      subject.velocity.set(0, 0, -type.speed); // strolling, so the walk cycle plays
      pivot.add(subject.model.root);
      pivot.rotation.set(0, c.initialYaw, 0);
      pose(0);
      pivot.updateMatrixWorld(true);
      bounds.setFromObject(subject.model.root).getSize(size);
      bounds.getCenter(centre);
      const distance = size.length() * c.framing / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2));
      camera.position.fromArray(c.camera).normalize().multiplyScalar(distance);
      camera.position.y += size.y / 2;
      camera.lookAt(0, size.y / 2, 0);
    },
    get showing() { return subject?.type ?? null; },
    render(dt) {
      const w = host.clientWidth || c.width, h = host.clientHeight || c.height;
      if (w !== width || h !== height) {
        width = w; height = h;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      if (subject) pose(dt);
      pivot.rotation.y += dt * c.rotationSpeed;
      renderer.render(scene, camera);
    },
    dispose() {
      clear();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}

/**
 * The binder. Left: the contents, under a divider tab per section. Right: one printed sheet on the rings, with the
 * subject's photo taped to it, a rubber stamp for how far the page has got, and the survivor's additions on top
 * (pen notes, tally marks, a sticky note). `onTurn` runs whenever a different page is shown (main.js: the paper sound).
 */
export function createGuideScreen({ save, onBack, onTurn = null, createPreview = createGuidePreview }) {
  const element = document.createElement('div');
  element.className = 'screen guide-screen hidden';
  for (const [name, value] of Object.entries(cfg.theme)) element.style.setProperty('--guide-' + name, value);
  element.style.setProperty('--guide-preview', '#' + cfg.preview.background.toString(16).padStart(6, '0'));
  element.innerHTML = `
    <div class="guide-binder">
      <header class="guide-label"><div class="kicker">${cfg.kicker}</div><h1>${cfg.title}</h1></header>
      <div class="guide-layout">
        <nav class="guide-index"></nav>
        <div class="guide-sheet">
          <div class="guide-rings" aria-hidden="true"><i></i><i></i><i></i></div>
          <div class="guide-letterhead"></div>
          <figure class="guide-photo">
            <div class="guide-preview"></div>
            <span class="guide-cctv" aria-hidden="true"></span>
            <figcaption class="guide-caption"></figcaption>
          </figure>
          <div class="guide-stamp" aria-hidden="true"></div>
          <article class="guide-page" aria-live="polite"></article>
        </div>
      </div>
      <div class="menu-row"><button class="menu-btn guide-back" type="button">${cfg.back}</button></div>
      <p class="pad-hint">${cfg.hint}</p>
    </div>`;
  const index = element.querySelector('.guide-index');
  const sheet = element.querySelector('.guide-sheet');
  const letterhead = element.querySelector('.guide-letterhead');
  const previewHost = element.querySelector('.guide-preview');
  const cctv = element.querySelector('.guide-cctv');
  const caption = element.querySelector('.guide-caption');
  const stamp = element.querySelector('.guide-stamp');
  const page = element.querySelector('.guide-page');
  const back = element.querySelector('.guide-back');
  let open = false, preview = null;
  let selected = guideEntries[0].id, shown = null;
  let focus = 0;
  const buttons = () => [...element.querySelectorAll('button')];
  const standing = (entry) => {
    const seen = save.seen(entry.id) || !!entry.alwaysSeen, kills = save.kills(entry.id);
    return { seen, kills, stage: guideStage(entry, { seen, kills }) };
  };
  const add = (parent, tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  };

  // Tally marks in the margin: gates of five, then the loose strokes, then the number once there are too many to draw.
  function tally(parent, kills) {
    const row = add(parent, 'div', 'guide-tally');
    row.setAttribute('aria-label', `${cfg.facts.kills}: ${kills}`);
    const drawn = Math.min(kills, cfg.tallyMax);
    for (let i = 0; i < Math.floor(drawn / 5); i++) add(row, 'span', 'guide-five');
    if (drawn % 5) add(row, 'span', 'guide-strokes').setAttribute('data-strokes', String(drawn % 5));
    if (kills > cfg.tallyMax) add(row, 'span', 'guide-tally-total', cfg.tallyTotal(kills));
  }

  function showPage(id) {
    if (!open || shown === id) return;
    shown = selected = id;
    const at = guideEntries.findIndex((candidate) => candidate.id === id);
    const entry = guideEntries[at];
    const form = cfg.sheets[entry.section];
    const { kills, stage } = standing(entry);
    for (const row of element.querySelectorAll('.guide-entry')) row.setAttribute('aria-pressed', String(row.dataset.entry === id));

    // The sheet: which form it is, how far it has got, and a flick as it turns over.
    sheet.setAttribute('data-section', entry.section);
    sheet.setAttribute('data-stage', String(stage));
    sheet.classList.remove('turning');
    void sheet.offsetWidth; // (restarts the turn animation)
    sheet.classList.add('turning');
    letterhead.replaceChildren();
    add(letterhead, 'span', '', cfg.letterhead);
    add(letterhead, 'b', '', form.heading);
    add(letterhead, 'span', '', `${form.form} · ${cfg.pageOf(at + 1, guideEntries.length)}`);
    stamp.textContent = cfg.stamps[stage];
    cctv.textContent = cfg.cctv(at + 1);
    caption.textContent = stage === 0 ? '' : entry.name;
    preview.show(stage > 0 ? entry.type : null);
    onTurn?.();

    page.replaceChildren();
    if (stage === 0) { // a blank form, waiting for someone to come back and fill it in
      add(page, 'h2', '', cfg.unknownName);
      add(page, 'p', 'guide-title', cfg.unknownTitle);
      const blank = add(page, 'dl', 'guide-blank');
      for (const field of cfg.blankFields) { add(blank, 'dt', '', field); add(blank, 'dd'); }
      add(page, 'p', 'guide-small-print', cfg.unknownBody);
      return;
    }
    // The company's printed page.
    add(page, 'h2', '', entry.name);
    add(page, 'p', 'guide-title', entry.title);
    const facts = add(page, 'dl', 'guide-facts');
    for (const [label, value] of [[cfg.facts.health, cfg.health(entry.health)], [cfg.facts.firstSeen, entry.firstSeen], [cfg.facts.kills, String(kills)], ...(form.status ? [form.status] : [])]) {
      add(facts, 'dt', '', label);
      add(facts, 'dd', '', value);
    }
    add(page, 'h3', '', cfg.memoHeading);
    add(page, 'p', 'guide-memo', entry.memo);
    // The survivor's pen, over the top of it.
    const hand = add(page, 'div', 'guide-hand');
    if (stage >= 2) {
      add(hand, 'h3', '', cfg.notesHeading);
      const list = add(hand, 'ul', 'guide-notes');
      for (const note of entry.notes) add(list, 'li', '', note);
    } else add(hand, 'p', 'guide-pencil', cfg.lockedNotes(entry.notesAt - kills));
    if (kills > 0) tally(hand, kills);
    if (stage >= 3) {
      const sticky = add(page, 'aside', 'guide-tip');
      add(sticky, 'h3', '', cfg.tipHeading);
      add(sticky, 'p', '', entry.tip);
    } else add(page, 'p', 'guide-pencil', cfg.lockedTip(entry.tipAt - kills));
  }

  // The contents are rebuilt each time the binder opens: the record may have changed during a shift.
  function fillIndex() {
    index.replaceChildren();
    for (const section of guideSections) {
      const entries = guideEntries.filter((entry) => entry.section === section.id);
      const group = add(index, 'section', 'guide-section');
      group.setAttribute('data-section', section.id);
      add(group, 'h2', 'guide-tab', section.name);
      add(group, 'p', 'guide-blurb', section.blurb);
      add(group, 'small', 'guide-count', cfg.sectionCount(entries.filter((entry) => standing(entry).stage === 3).length, entries.length));
      for (const entry of entries) {
        const { stage } = standing(entry);
        const row = add(group, 'button', `guide-entry${stage === 0 ? ' unknown' : ''}`);
        row.type = 'button';
        row.setAttribute('data-entry', entry.id);
        row.setAttribute('data-stage', String(stage));
        add(row, 'span', '', stage === 0 ? cfg.unknownName : entry.name);
        add(row, 'small', '', cfg.rowStatus(stage));
        row.addEventListener('click', () => showPage(entry.id));
        row.addEventListener('focus', () => showPage(entry.id));
        row.addEventListener('mouseenter', () => showPage(entry.id));
      }
    }
  }
  back.addEventListener('click', () => onBack());
  function move(step) {
    const list = buttons();
    const active = list.indexOf(document.activeElement);
    focus = ((active >= 0 ? active : focus) + step + list.length) % list.length;
    list.forEach((row, at) => row.classList.toggle('focused', at === focus));
    list[focus].focus();
    list[focus].scrollIntoView?.({ block: 'nearest' });
    if (list[focus].dataset.entry) showPage(list[focus].dataset.entry); // (a pad has no focus event of its own in tests)
  }
  const onKey = (event) => {
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
      preview = createPreview(previewHost);
      document.addEventListener('keydown', onKey);
      fillIndex();
      shown = null;
      showPage(selected);
      focus = guideEntries.findIndex((entry) => entry.id === selected);
      buttons()[focus].focus();
    },
    close() {
      if (!open) return;
      open = false;
      document.removeEventListener('keydown', onKey);
      preview.dispose(); preview = null;
      element.classList.add('hidden');
      shown = null;
    },
    render(dt) { if (open) preview.render(dt); },
    padNav(input) {
      if (!open) return;
      if (input.consumePress('PadB')) return onBack();
      const step = (input.consumePress('PadDown') || input.consumePress('PadRight') ? 1 : 0)
        - (input.consumePress('PadUp') || input.consumePress('PadLeft') ? 1 : 0);
      if (step) move(step);
      if (input.consumePress('PadA')) (buttons().includes(document.activeElement) ? document.activeElement : buttons()[focus]).click();
    },
  };
}
