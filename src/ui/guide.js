// The Staff Survival Guide screen (off the title): every zombie type and boss, one page each, filled in from the
// permanent record (game/guideSave.js), then the lost property that has been logged and the summary it unlocks. Plain DOM, driven by the main loop like the weapon locker, so the title's idle
// saver also stops the turning model. All words and numbers: config/guide.js.
import * as THREE from 'three';
import { guide as cfg, guideEntries, guideSections, guideStage, incentiveEntries } from '../config/guide.js';
import { powerUps } from '../config/powerUps.js';
import { Zombie } from '../zombies/zombie.js';
import { lostFound } from '../config/lostFound.js';
import { lostFoundProgress } from '../game/lostFound.js';
import { buildLostPropertyModel } from '../game/features/lostProperty.js';
import { buildIncentiveModel } from '../fx/powerUpView.js';
import { incentiveIconSvg } from './incentiveHud.js';
import { padBook } from './menuFocus.js';
import { hintHtml } from './glyphs.js';

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
  let prop = null; // or a piece of lost property: { item, group, materials }
  let width = 0, height = 0;
  const bounds = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3();

  function clear() {
    subject?.model.dispose();
    subject = null;
    if (prop) {
      prop.group.removeFromParent();
      for (const material of prop.materials) material.dispose();
      prop = null;
    }
  }
  function pose(dt) {
    // The Mascot's stride is advanced by its fixed tick, which never runs here.
    if (subject.type.mascot) subject.mascotWalkPhase += subject.horizontalSpeed * dt * subject.type.mascot.pose.radiansPerMeter;
    subject.model.update(dt, subject, 1);
  }
  return {
    /** Show a zombie type, a piece of lost property (an item of config/lostFound.js), or nothing (null: not seen yet). */
    show(type) {
      clear();
      if (!type) return;
      let root;
      if (type.parts) { // lost property: its own small model, turning, nothing to animate
        prop = { item: type, ...buildLostPropertyModel(type) };
        root = prop.group;
      } else if (type.incentiveId) { // incentive pickup: shared model (disposing clears group, never shared assets)
        prop = { item: type, ...buildIncentiveModel(type.incentiveId) };
        root = prop.group;
      } else {
        subject = new Zombie({ type, health: 1, position: new THREE.Vector3(), yaw: 0 });
        subject.state = 'chasing';
        subject.velocity.set(0, 0, -type.speed); // strolling, so the walk cycle plays
        root = subject.model.root;
      }
      pivot.add(root);
      pivot.rotation.set(0, c.initialYaw, 0);
      if (subject) pose(0);
      pivot.updateMatrixWorld(true);
      bounds.setFromObject(root).getSize(size);
      bounds.getCenter(centre);
      const distance = size.length() * (prop ? c.propFraming : c.framing) / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2));
      camera.position.fromArray(c.camera).normalize().multiplyScalar(distance);
      camera.position.y += centre.y;
      camera.lookAt(0, centre.y, 0);
    },
    get showing() { return subject?.type ?? prop?.item ?? null; },
    render(dt) {
      const w = host.clientWidth || c.width, h = host.clientHeight || c.height;
      if (w !== width || h !== height) {
        width = w; height = h;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      if (subject) pose(dt);
      if (prop?.group?.userData?.halo) prop.group.userData.halo.rotation.z += dt * powerUps.visual.jackpotHaloSpinSpeed;
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
 * Three kinds of page: a zombie or boss ('entry'), a piece of lost property ('item', id 'lost:<id>') and the incident
 * summary that opens once every item is logged ('report', id 'lost:report').
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
      <p class="pad-hint" data-hint="guide">${hintHtml('guide')}</p>
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
  // Every page of the binder, in section order.
  const pages = [
    ...guideEntries.map((entry) => ({ id: entry.id, section: entry.section, kind: 'entry', entry })),
    ...incentiveEntries.map((incentive) => ({ id: 'incentive:' + incentive.id, section: 'incentives', kind: 'incentive', incentive })),
    ...lostFound.items.map((item, at) => ({ id: 'lost:' + item.id, section: 'lostFound', kind: 'item', item, number: at + 1 })),
    { id: 'lost:report', section: 'lostFound', kind: 'report' },
  ];
  let open = false, preview = null;
  let selected = pages[0].id, shown = null;
  let focus = 0;
  const buttons = () => [...element.querySelectorAll('button')];
  const standing = (entry) => {
    const seen = save.seen(entry.id) || !!entry.alwaysSeen, kills = save.kills(entry.id);
    return { seen, kills, stage: guideStage(entry, { seen, kills }) };
  };
  // How far a page has got, 0..3, whatever its kind (the contents' ticks and the complete count read this).
  const stageOf = (leaf) => leaf.kind === 'entry' ? standing(leaf.entry).stage
    : leaf.kind === 'incentive' ? (save.discovered(leaf.incentive.id) ? 3 : 0)
      : leaf.kind === 'item' ? (save.found(leaf.item.id) ? 3 : 0)
        : (lostFoundProgress(save).complete ? 3 : 0);
  const titleOf = (leaf) => leaf.kind === 'entry' ? (stageOf(leaf) ? leaf.entry.name : cfg.unknownName)
    : leaf.kind === 'incentive' ? (stageOf(leaf) ? leaf.incentive.name : cfg.incentives.unknownName)
      : leaf.kind === 'item' ? (stageOf(leaf) ? leaf.item.name : cfg.lost.unknownName)
        : (stageOf(leaf) ? lostFound.report.title : cfg.lost.sealedName);
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
  function facts(rows) {
    const list = add(page, 'dl', 'guide-facts');
    for (const [label, value] of rows) { add(list, 'dt', '', label); add(list, 'dd', '', value); }
  }

  // A zombie or a boss.
  function entryPage(entry, stage, kills, form) {
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
    facts([[cfg.facts.health, cfg.health(entry.health)], [cfg.facts.firstSeen, entry.firstSeen], [cfg.facts.kills, String(kills)], ...(form.status ? [form.status] : [])]);
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
  // An employee incentive: locked as ??? until first actual pickup, then icon, summary and PA flavour.
  function incentivePage({ incentive }, found) {
    const total = incentiveEntries.length;
    if (!found) {
      add(page, 'h2', '', cfg.incentives.unknownName);
      add(page, 'p', 'guide-title', cfg.incentives.unknownTitle);
      const blank = add(page, 'dl', 'guide-blank');
      for (const field of cfg.incentives.blankFields) { add(blank, 'dt', '', field); add(blank, 'dd'); }
      add(page, 'p', 'guide-small-print', cfg.incentives.unknownBody);
      return;
    }
    const headingRow = add(page, 'div', 'guide-incentive-head');
    const iconBadge = add(headingRow, 'span', 'guide-incentive-icon');
    iconBadge.style.setProperty('--incentive-color', '#' + incentive.color.toString(16).padStart(6, '0'));
    iconBadge.innerHTML = incentiveIconSvg(incentive.id);
    add(headingRow, 'h2', '', incentive.name);
    add(page, 'p', 'guide-title', cfg.incentives.itemOf(incentive.number, total));
    const minRound = incentive.tier === 'jackpot' ? powerUps.jackpot.firstRound : powerUps.firstRound;
    facts([[cfg.incentives.tierLabel, incentive.tierLabel], [cfg.incentives.firstRoundLabel, `Round ${minRound}+`]]);
    add(page, 'h3', '', cfg.incentives.effectHeading);
    add(page, 'p', 'guide-incentive-summary', incentive.summary);
    if (incentive.paText) {
      const note = add(page, 'aside', 'guide-tip guide-incentive-pa');
      add(note, 'h3', '', `${cfg.incentives.paHeading} · ${incentive.paKicker}`);
      add(note, 'p', 'guide-memo', incentive.paText);
    }
  }
  // A piece of lost property: the log entry, and its yellow property tag once it has been handed in. No hint before.
  function itemPage({ item, number }, found) {
    const total = lostFound.items.length;
    if (!found) {
      add(page, 'h2', '', cfg.lost.unknownName);
      add(page, 'p', 'guide-title', cfg.lost.itemOf(number, total));
      const blank = add(page, 'dl', 'guide-blank');
      for (const field of cfg.lost.blankFields) { add(blank, 'dt', '', field); add(blank, 'dd'); }
      add(page, 'p', 'guide-small-print', cfg.lost.unknownBody);
      return;
    }
    add(page, 'h2', '', item.name);
    add(page, 'p', 'guide-title', cfg.lost.itemOf(number, total));
    facts([[cfg.lost.facts.area, item.area], [cfg.lost.facts.owner, cfg.lost.noOwner]]);
    const tag = add(page, 'aside', 'guide-tip guide-proptag');
    add(tag, 'h3', '', cfg.lost.tagHeading);
    add(tag, 'p', '', item.tag);
  }
  // The incident summary: sealed until every item is logged.
  function reportPage(complete) {
    const { found, total } = lostFoundProgress(save);
    const report = lostFound.report;
    if (!complete) {
      add(page, 'h2', '', cfg.lost.sealedName);
      add(page, 'p', 'guide-title', cfg.lost.sealedTitle);
      add(page, 'p', 'guide-small-print', cfg.lost.sealedBody(found, total));
      return;
    }
    add(page, 'h2', '', report.title);
    add(page, 'p', 'guide-title', report.subtitle);
    const body = add(page, 'div', 'guide-report');
    for (const line of report.lines) add(body, 'p', '', line);
    add(body, 'p', 'guide-report-conclusion', report.conclusion);
    add(body, 'p', 'guide-report-signed', report.signed);
  }

  function showPage(id) {
    if (!open || shown === id) return;
    shown = selected = id;
    const at = pages.findIndex((candidate) => candidate.id === id);
    const leaf = pages[at];
    const form = cfg.sheets[leaf.section];
    const stage = stageOf(leaf);
    for (const row of element.querySelectorAll('.guide-entry')) row.setAttribute('aria-pressed', String(row.dataset.entry === id));

    // The sheet: which form it is, how far it has got, and a flick as it turns over.
    sheet.setAttribute('data-section', leaf.section);
    sheet.setAttribute('data-kind', leaf.kind);
    sheet.setAttribute('data-stage', String(stage));
    sheet.classList.remove('turning');
    void sheet.offsetWidth; // (restarts the turn animation)
    sheet.classList.add('turning');
    letterhead.replaceChildren();
    add(letterhead, 'span', '', cfg.letterhead);
    add(letterhead, 'b', '', form.heading);
    add(letterhead, 'span', '', `${form.form} · ${cfg.pageOf(at + 1, pages.length)}`);
    stamp.textContent = leaf.kind === 'entry' ? cfg.stamps[stage]
      : leaf.kind === 'incentive' ? cfg.incentives.stamps[stage ? 1 : 0]
        : leaf.kind === 'item' ? cfg.lost.stamps[stage ? 1 : 0]
          : cfg.lost.reportStamps[stage ? 1 : 0];
    cctv.textContent = leaf.kind === 'entry' ? cfg.cctv(at + 1)
      : leaf.kind === 'incentive' ? cfg.incentives.exhibit(leaf.incentive.number)
        : cfg.lost.exhibit(leaf.number ?? 0);
    caption.textContent = stage === 0 || leaf.kind === 'report' ? '' : titleOf(leaf);
    preview.show(stage === 0 ? null : leaf.kind === 'entry' ? leaf.entry.type : leaf.kind === 'incentive' ? leaf.incentive : leaf.kind === 'item' ? leaf.item : null);
    onTurn?.();

    page.replaceChildren();
    if (leaf.kind === 'entry') entryPage(leaf.entry, stage, save.kills(leaf.entry.id), form);
    else if (leaf.kind === 'incentive') incentivePage(leaf, stage > 0);
    else if (leaf.kind === 'item') itemPage(leaf, stage > 0);
    else reportPage(stage > 0);
  }

  // The contents are rebuilt each time the binder opens: the record may have changed during a shift.
  function fillIndex() {
    index.replaceChildren();
    for (const section of guideSections) {
      const leaves = pages.filter((leaf) => leaf.section === section.id);
      const group = add(index, 'section', 'guide-section');
      group.setAttribute('data-section', section.id);
      add(group, 'h2', 'guide-tab', section.name);
      add(group, 'p', 'guide-blurb', section.blurb);
      const counted = leaves.filter((leaf) => leaf.kind !== 'report'); // (the summary is the prize, not one of the things to find)
      const done = counted.filter((leaf) => stageOf(leaf) === 3).length;
      const countText = section.id === 'lostFound' ? cfg.lost.sectionCount(done, counted.length)
        : section.id === 'incentives' ? cfg.incentives.sectionCount(done, counted.length)
          : cfg.sectionCount(done, counted.length);
      add(group, 'small', 'guide-count', countText);
      for (const leaf of leaves) {
        const stage = stageOf(leaf);
        const row = add(group, 'button', `guide-entry${stage === 0 ? ' unknown' : ''}`);
        row.type = 'button';
        row.setAttribute('data-entry', leaf.id);
        row.setAttribute('data-stage', String(stage));
        const nameWrap = add(row, 'span', 'guide-entry-label');
        if (leaf.kind === 'incentive' && stage > 0) {
          const icon = add(nameWrap, 'span', 'guide-entry-icon');
          icon.innerHTML = incentiveIconSvg(leaf.incentive.id);
        }
        add(nameWrap, 'span', '', titleOf(leaf));
        add(row, 'small', '', leaf.kind === 'entry' ? cfg.rowStatus(stage) : stage ? cfg.rowStatus(1) : '');
        row.addEventListener('click', () => showPage(leaf.id));
        row.addEventListener('focus', () => showPage(leaf.id));
        row.addEventListener('mouseenter', () => showPage(leaf.id));
      }
    }
  }
  back.addEventListener('click', () => onBack());
  const at = () => {
    const active = buttons().indexOf(document.activeElement);
    return active >= 0 ? active : focus;
  };
  function move(step) {
    const list = buttons();
    focusAt((at() + step + list.length) % list.length);
  }
  // LB / RB: the first entry of the next / previous section of the index.
  function jumpSection(dir) {
    const sections = [...element.querySelectorAll('.guide-section')];
    const here = sections.findIndex((section) => section.contains(buttons()[at()]));
    const next = sections[(Math.max(0, here) + dir + sections.length) % sections.length];
    const first = next?.querySelector('[data-entry]');
    if (first) focusAt(buttons().indexOf(first));
  }
  function focusAt(index) {
    const list = buttons();
    focus = index;
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
      focus = pages.findIndex((leaf) => leaf.id === selected);
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
    // Controller (ui/menuFocus.js padBook): move between entries, LB / RB jump a section, the right stick scrolls the page.
    padNav(input) {
      if (!open) return;
      padBook(input, { list: buttons, at, focusAt, back: onBack, tab: jumpSection, scrollHost: element });
    },
  };
}
