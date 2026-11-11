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

export function createGuideScreen({ save, onBack, createPreview = createGuidePreview }) {
  const element = document.createElement('div');
  element.className = 'screen guide-screen hidden';
  for (const [name, value] of Object.entries(cfg.theme)) element.style.setProperty('--guide-' + name, value);
  element.style.setProperty('--guide-preview', '#' + cfg.preview.background.toString(16).padStart(6, '0'));
  element.innerHTML = `
    <div class="card guide-card">
      <div class="form-number">${cfg.form}</div>
      <div class="kicker">${cfg.kicker}</div><h1>${cfg.title}</h1>
      <div class="guide-layout">
        <nav class="guide-index"></nav>
        <div class="guide-preview"></div>
        <article class="guide-page" aria-live="polite"></article>
      </div>
      <div class="menu-row"><button class="menu-btn guide-back" type="button">${cfg.back}</button></div>
      <p class="pad-hint">${cfg.hint}</p>
    </div>`;
  const index = element.querySelector('.guide-index');
  const previewHost = element.querySelector('.guide-preview');
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

  function showPage(id) {
    if (!open || shown === id) return;
    shown = selected = id;
    const entry = guideEntries.find((candidate) => candidate.id === id);
    const { kills, stage } = standing(entry);
    for (const row of element.querySelectorAll('.guide-entry')) row.setAttribute('aria-pressed', String(row.dataset.entry === id));
    page.replaceChildren();
    previewHost.classList.toggle('unknown', stage === 0);
    preview.show(stage > 0 ? entry.type : null);
    if (stage === 0) {
      add(page, 'h2', '', cfg.unknownName);
      add(page, 'p', 'guide-title', cfg.unknownTitle);
      add(page, 'p', 'guide-locked', cfg.unknownBody);
      return;
    }
    add(page, 'h2', '', entry.name);
    add(page, 'p', 'guide-title', entry.title);
    const facts = add(page, 'dl', 'guide-facts');
    for (const [label, value] of [[cfg.facts.health, cfg.health(entry.health)], [cfg.facts.firstSeen, entry.firstSeen], [cfg.facts.kills, String(kills)]]) {
      add(facts, 'dt', '', label);
      add(facts, 'dd', '', value);
    }
    add(page, 'h3', '', cfg.memoHeading);
    add(page, 'p', 'guide-memo', entry.memo);
    if (stage >= 2) {
      add(page, 'h3', '', cfg.notesHeading);
      const list = add(page, 'ul', 'guide-notes');
      for (const note of entry.notes) add(list, 'li', '', note);
    } else add(page, 'p', 'guide-locked', cfg.locked(cfg.notesHeading, entry.notesAt - kills));
    if (stage >= 3) {
      add(page, 'h3', '', cfg.tipHeading);
      add(page, 'p', 'guide-tip', entry.tip);
    } else add(page, 'p', 'guide-locked', cfg.locked(cfg.tipHeading, entry.tipAt - kills));
  }

  // The index is rebuilt each time the book opens: the record may have changed during a shift.
  function fillIndex() {
    index.replaceChildren();
    for (const section of guideSections) {
      const entries = guideEntries.filter((entry) => entry.section === section.id);
      const group = add(index, 'section', 'guide-section');
      group.setAttribute('data-section', section.id);
      add(group, 'h2', '', section.name);
      add(group, 'p', 'guide-blurb', section.blurb);
      add(group, 'small', 'guide-count', cfg.sectionCount(entries.filter((entry) => standing(entry).stage === 3).length, entries.length));
      for (const entry of entries) {
        const { stage } = standing(entry);
        const row = add(group, 'button', `menu-btn guide-entry${stage === 0 ? ' unknown' : ''}`);
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
