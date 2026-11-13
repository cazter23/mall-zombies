// The Staff Survival Guide screen (ui/guide.js): what a page shows at each stage, navigation, and the turning model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { createGuideSave } from '../src/game/guideSave.js';
import { guide as cfg, guideEntries, guideEntry, guideSections, incentiveEntries, incentiveEntry } from '../src/config/guide.js';
import { powerUps } from '../src/config/powerUps.js';
import { lostFound, lostItem } from '../src/config/lostFound.js';

const PAGES = guideEntries.length + incentiveEntries.length + lostFound.items.length + 1; // zombies/bosses, incentives, lost property, summary
import { createGuideScreen, createGuidePreview } from '../src/ui/guide.js';

menuDom();
const { createScreens } = await import('../src/ui/screens.js');

function fixture(prepare = () => {}) {
  const dom = menuDom();
  const values = new Map();
  let writes = 0, releases = 0, frames = 0, turns = 0;
  const shown = [];
  const save = createGuideSave({ storage: {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { values.set(key, value); writes++; },
  } });
  prepare(save);
  const guide = createGuideScreen({ save, onBack: () => screens.show('title'), onTurn: () => turns++, createPreview: () => ({
    show: (type) => shown.push(type), render: () => frames++, dispose: () => releases++,
  }) });
  const screens = createScreens({ guide });
  screens.on('guide', () => screens.show('guide'));
  screens.show('title');
  document.querySelector('[data-action="guide"]').click();
  return { ...dom, save, guide, screens, shown,
    get writes() { return writes; }, get releases() { return releases; }, get frames() { return frames; }, get turns() { return turns; },
    sheet: () => guide.element.querySelector('.guide-sheet'),
    stamp: () => guide.element.querySelector('.guide-stamp').textContent,
    row: (id) => guide.element.querySelector(`[data-entry="${id}"]`),
    page: () => guide.element.querySelector('.guide-page').textContent,
    pad: (code) => screens.padNav({ consumePress: (key) => key === code }),
  };
}

test('the title opens the guide: every page is listed by section, unseen ones as ??? with no model', () => {
  const t = fixture();
  assert.equal(t.screens.current, 'guide');
  assert.equal(t.screens.showsFlyover, true);
  assert.equal(t.guide.element.querySelectorAll('.guide-entry').length, PAGES);
  assert.deepEqual(t.guide.element.querySelectorAll('.guide-section').map((node) => node.getAttribute('data-section')), guideSections.map((section) => section.id));
  // A new employee knows the Shopper and nothing else.
  assert.ok(t.row('shopper').textContent.includes('Shopper'));
  assert.equal(t.row('shopper').getAttribute('aria-pressed'), 'true');
  assert.equal(t.shown.at(-1), guideEntry('shopper').type);
  for (const entry of guideEntries.filter((candidate) => candidate.id !== 'shopper')) {
    assert.ok(t.row(entry.id).textContent.includes(cfg.unknownName), entry.id);
    assert.ok(!t.row(entry.id).textContent.includes(entry.name), entry.id + ' keeps its name to itself');
    assert.equal(t.row(entry.id).classList.contains('unknown'), true);
  }
  t.row('janitor').click();
  assert.equal(t.shown.at(-1), null, 'no model for a page not seen yet');
  assert.ok(t.page().includes(cfg.unknownTitle));
  assert.ok(!t.page().includes('Murray'));
  assert.equal(t.writes, 0, 'reading the book writes nothing');
  t.screens.show('title');
});

test('a page shows its memo, then its field notes, then its tip, and says how many more it wants', () => {
  const walker = guideEntry('mallWalker');
  const stages = [
    [(save) => save.see('mallWalker'), { memo: true, notes: false, tip: false }],
    [(save) => save.add('mallWalker', walker.notesAt), { memo: true, notes: true, tip: false }],
    [(save) => save.add('mallWalker', walker.tipAt), { memo: true, notes: true, tip: true }],
  ];
  for (const [prepare, expected] of stages) {
    const t = fixture(prepare);
    t.row('mallWalker').click();
    const text = t.page();
    assert.equal(t.shown.at(-1), walker.type);
    assert.ok(text.includes(walker.name) && text.includes(walker.title) && text.includes(walker.firstSeen));
    assert.equal(text.includes(walker.memo), expected.memo);
    assert.equal(text.includes(walker.notes[0]), expected.notes);
    assert.equal(text.includes(walker.tip), expected.tip);
    const kills = t.save.kills('mallWalker');
    assert.equal(text.includes(cfg.lockedNotes(walker.notesAt - kills)), !expected.notes);
    assert.equal(text.includes(cfg.lockedTip(walker.tipAt - kills)), !expected.tip);
    // The sheet says how far it has got: a stamp, and the survivor's layers arriving one at a time.
    const stage = 1 + Number(expected.notes) + Number(expected.tip);
    assert.equal(t.sheet().getAttribute('data-stage'), String(stage));
    assert.equal(t.stamp(), cfg.stamps[stage]);
    assert.equal(t.guide.element.querySelectorAll('.guide-notes').length, expected.notes ? 1 : 0);
    assert.equal(t.guide.element.querySelectorAll('.guide-tip').length, expected.tip ? 1 : 0, 'the sticky note is the last thing on the page');
    t.screens.show('title');
  }
});

test('the index counts complete pages per section and is rebuilt when the book is reopened', () => {
  const t = fixture((save) => save.add('janitor', guideEntry('janitor').tipAt));
  const count = (section) => t.guide.element.querySelector(`[data-section="${section}"]`).querySelector('.guide-count').textContent;
  const bosses = guideEntries.filter((entry) => entry.section === 'management').length;
  assert.equal(count('management'), cfg.sectionCount(1, bosses));
  assert.equal(t.row('janitor').getAttribute('data-stage'), '3');
  t.screens.show('title');
  t.save.add('guard', guideEntry('guard').tipAt); // (a shift happened)
  t.screens.show('guide');
  assert.equal(count('management'), cfg.sectionCount(2, bosses));
  assert.ok(t.row('guard').textContent.includes(guideEntry('guard').name));
  t.screens.show('title');
});

for (const back of ['button', 'Escape', 'PadB']) test(`the guide returns to the title by ${back} and releases its preview exactly once`, () => {
  const t = fixture();
  t.guide.render(1);
  assert.equal(t.frames, 1);
  if (back === 'button') t.guide.element.querySelector('.guide-back').click();
  else if (back === 'Escape') assert.equal(t.key('Escape').defaultPrevented, true);
  else t.pad(back);
  assert.equal(t.screens.current, 'title');
  assert.equal(t.guide.isOpen, false);
  assert.equal(t.releases, 1);
  t.guide.render(1); t.guide.close();
  assert.equal(t.frames, 1, 'a closed book never draws');
  assert.equal(t.releases, 1);
  assert.equal(document.activeElement, document.querySelector('[data-action="guide"]'));
});

test('keyboard and controller walk the index, turning the page as they go', () => {
  const t = fixture((save) => save.see('shoplifter'));
  assert.equal(document.activeElement, t.row('shopper'));
  t.key('ArrowDown');
  assert.equal(document.activeElement, t.row('shoplifter'));
  assert.ok(t.page().includes(guideEntry('shoplifter').memo));
  t.pad('PadDown');
  assert.equal(document.activeElement, t.row('mallWalker'));
  assert.ok(t.page().includes(cfg.unknownTitle));
  t.pad('PadUp'); t.pad('PadUp'); t.pad('PadUp');
  assert.equal(document.activeElement, t.guide.element.querySelector('.guide-back'), 'it wraps to Back');
  t.pad('PadA');
  assert.equal(t.screens.current, 'title');
  // The book reopens on the last page looked at (the Shopper, passed on the way up to Back).
  t.screens.show('guide');
  assert.equal(t.row('shopper').getAttribute('aria-pressed'), 'true');
  t.screens.show('title');
});

test('the real preview builds, poses and frees every subject in the book', () => {
  menuDom();
  const host = document.createElement('div');
  let scene, draws = 0, disposed = 0;
  const renderer = {
    domElement: document.createElement('canvas'),
    setPixelRatio() {}, setSize() {},
    render(value) { scene = value; draws++; },
    dispose() { disposed++; }, forceContextLoss() {},
  };
  const preview = createGuidePreview(host, { makeRenderer: () => renderer });
  const meshes = () => { let n = 0; scene.traverse((node) => { if (node.isMesh) n++; }); return n; };
  preview.render(1 / 60);
  assert.equal(meshes(), 0);
  for (const entry of guideEntries) {
    preview.show(entry.type);
    for (let i = 0; i < 30; i++) preview.render(1 / 60); // (half a second of its walk)
    assert.equal(preview.showing, entry.type);
    assert.ok(meshes() > 3, entry.id + ' has a body');
  }
  const last = [];
  scene.traverse((node) => { for (const material of [].concat(node.material ?? [])) last.push(material); });
  let freed = 0;
  for (const material of new Set(last)) material.addEventListener('dispose', () => freed++);
  preview.show(null);
  preview.render(1 / 60);
  assert.equal(meshes(), 0, 'the previous subject left the scene');
  assert.ok(freed > 0, 'and its materials were freed');
  preview.dispose();
  assert.equal(host.children.length, 0);
  assert.equal(disposed, 1);
});

test('the sheet is the right form for its section, stamped, with the photo captioned and a blank form for the unseen', () => {
  const t = fixture((save) => { save.add('janitor', 1); });
  assert.equal(t.sheet().getAttribute('data-section'), 'customers');
  const letterhead = () => t.guide.element.querySelector('.guide-letterhead').textContent;
  assert.ok(letterhead().includes(cfg.sheets.customers.heading) && letterhead().includes(cfg.pageOf(1, PAGES)));
  assert.equal(t.guide.element.querySelector('.guide-caption').textContent, 'Shopper');
  assert.equal(t.guide.element.querySelector('.guide-cctv').textContent, cfg.cctv(1));

  t.row('janitor').click(); // a boss is a personnel file, with one more line on it
  assert.equal(t.sheet().getAttribute('data-section'), 'management');
  assert.ok(letterhead().includes(cfg.sheets.management.heading));
  assert.ok(t.page().includes(cfg.sheets.management.status[1]));
  assert.equal(t.stamp(), cfg.stamps[2]);

  t.row('guard').click(); // never seen: a blank form, no name anywhere, no photo caption
  assert.equal(t.sheet().getAttribute('data-stage'), '0');
  assert.equal(t.stamp(), cfg.stamps[0]);
  assert.equal(t.guide.element.querySelector('.guide-caption').textContent, '');
  assert.equal(t.guide.element.querySelectorAll('.guide-blank').length, 1);
  for (const field of cfg.blankFields) assert.ok(t.page().includes(field));
  assert.ok(!t.page().includes('Kettle'));
  assert.equal(t.guide.element.querySelectorAll('.guide-tally').length, 0);
  t.screens.show('title');
});

test('kills are tallied in fives in the margin, and past the cap the number is written out', () => {
  const marks = (kills) => {
    const t = fixture((save) => { if (kills) save.add('shopper', kills); });
    const result = {
      rows: t.guide.element.querySelectorAll('.guide-tally').length,
      fives: t.guide.element.querySelectorAll('.guide-five').length,
      loose: t.guide.element.querySelector('.guide-strokes')?.getAttribute('data-strokes') ?? null,
      total: t.guide.element.querySelector('.guide-tally-total')?.textContent ?? null,
    };
    t.screens.show('title');
    return result;
  };
  assert.deepEqual(marks(0), { rows: 0, fives: 0, loose: null, total: null });
  assert.deepEqual(marks(3), { rows: 1, fives: 0, loose: '3', total: null });
  assert.deepEqual(marks(12), { rows: 1, fives: 2, loose: '2', total: null });
  assert.deepEqual(marks(cfg.tallyMax), { rows: 1, fives: cfg.tallyMax / 5, loose: null, total: null });
  assert.deepEqual(marks(212), { rows: 1, fives: cfg.tallyMax / 5, loose: null, total: cfg.tallyTotal(212) });
});

test('a page turn is announced once per different page (the paper sound), never for the page already open', () => {
  const t = fixture((save) => save.see('shoplifter'));
  assert.equal(t.turns, 1, 'opening the binder');
  t.row('shopper').click();
  assert.equal(t.turns, 1);
  t.row('shoplifter').click();
  t.row('shoplifter').click();
  assert.equal(t.turns, 2);
  assert.equal(t.sheet().classList.contains('turning'), true);
  t.pad('PadDown'); t.pad('PadDown'); // (focus was on the Shopper: the first step lands on the page already open)
  assert.equal(t.turns, 3);
  t.screens.show('title');
});

// --- Lost & Found ------------------------------------------------------------------------------------------------------

test('lost property: an item not yet found gives nothing away; a found one shows its tag, its area and its model', () => {
  const t = fixture((save) => save.find('badge'));
  const count = () => t.guide.element.querySelector('[data-section="lostFound"]').querySelector('.guide-count').textContent;
  assert.equal(count(), cfg.lost.sectionCount(1, lostFound.items.length));

  const coin = lostItem('coin');
  assert.ok(t.row('lost:coin').textContent.includes(cfg.lost.unknownName));
  t.row('lost:coin').click();
  assert.equal(t.sheet().getAttribute('data-section'), 'lostFound');
  assert.equal(t.sheet().getAttribute('data-stage'), '0');
  assert.equal(t.shown.at(-1), null, 'no model');
  assert.equal(t.stamp(), cfg.lost.stamps[0]);
  for (const secret of [coin.name, coin.tag, coin.area]) assert.ok(!t.page().includes(secret), 'no hint: ' + secret);
  assert.ok(t.page().includes(cfg.lost.itemOf(lostFound.items.indexOf(coin) + 1, lostFound.items.length)));

  const badge = lostItem('badge');
  assert.ok(t.row('lost:badge').textContent.includes(badge.name));
  t.row('lost:badge').click();
  assert.equal(t.sheet().getAttribute('data-stage'), '3');
  assert.equal(t.shown.at(-1), badge, 'the item itself is in the photo');
  assert.equal(t.stamp(), cfg.lost.stamps[1]);
  assert.equal(t.guide.element.querySelector('.guide-caption').textContent, badge.name);
  for (const shown of [badge.name, badge.tag, badge.area]) assert.ok(t.page().includes(shown));
  assert.equal(t.guide.element.querySelectorAll('.guide-proptag').length, 1);
  assert.equal(t.writes, 0);
  t.screens.show('title');
});

test('the incident summary stays sealed, counting what is left, until every item is logged', () => {
  const report = lostFound.report;
  const sealed = fixture((save) => { for (const item of lostFound.items.slice(1)) save.find(item.id); });
  sealed.row('lost:report').click();
  assert.equal(sealed.sheet().getAttribute('data-kind'), 'report');
  assert.equal(sealed.stamp(), cfg.lost.reportStamps[0]);
  assert.ok(sealed.page().includes(cfg.lost.sealedBody(lostFound.items.length - 1, lostFound.items.length)));
  assert.ok(!sealed.page().includes(report.conclusion) && !sealed.page().includes(report.lines[0]));
  assert.ok(sealed.row('lost:report').textContent.includes(cfg.lost.sealedName));
  sealed.screens.show('title');

  const done = fixture((save) => { for (const item of lostFound.items) save.find(item.id); });
  assert.ok(done.row('lost:report').textContent.includes(report.title));
  done.row('lost:report').click();
  assert.equal(done.stamp(), cfg.lost.reportStamps[1]);
  for (const line of [...report.lines, report.conclusion, report.signed]) assert.ok(done.page().includes(line));
  assert.equal(done.shown.at(-1), null, 'a typed page, no photo');
  // The summary is the prize, not a twelfth thing to find.
  assert.equal(done.guide.element.querySelector('[data-section="lostFound"]').querySelector('.guide-count').textContent, cfg.lost.sectionCount(lostFound.items.length, lostFound.items.length));
  done.screens.show('title');
});

test('the real preview shows and frees a piece of lost property like any other subject', () => {
  menuDom();
  const host = document.createElement('div');
  let scene;
  const renderer = { domElement: document.createElement('canvas'), setPixelRatio() {}, setSize() {}, render(value) { scene = value; }, dispose() {}, forceContextLoss() {} };
  const preview = createGuidePreview(host, { makeRenderer: () => renderer });
  const meshes = () => { let n = 0; scene.traverse((node) => { if (node.isMesh) n++; }); return n; };
  for (const item of lostFound.items) {
    preview.show(item);
    preview.render(1 / 60);
    assert.equal(preview.showing, item);
    assert.equal(meshes(), item.parts.length + 2, item.id + ': its parts, the tag and its string');
  }
  preview.show(guideEntry('shopper').type);
  preview.render(1 / 60);
  assert.equal(preview.showing, guideEntry('shopper').type, 'and back to a zombie, with the item gone');
  preview.show(null);
  preview.render(1 / 60);
  assert.equal(meshes(), 0);
  preview.dispose();
});

// --- Employee Incentives -----------------------------------------------------------------------------------------------

test('incentives section locks entries as ??? until discovered, then shows icon, summary, PA quote and counts found/total', () => {
  const commission = incentiveEntry('commissionDay');
  const t = fixture((save) => save.discover('commissionDay'));
  const count = () => t.guide.element.querySelector('[data-section="incentives"]').querySelector('.guide-count').textContent;
  assert.equal(count(), cfg.incentives.sectionCount(1, incentiveEntries.length));

  // Locked incentive gives nothing away
  assert.ok(t.row('incentive:blackFriday').textContent.includes(cfg.incentives.unknownName));
  t.row('incentive:blackFriday').click();
  assert.equal(t.sheet().getAttribute('data-section'), 'incentives');
  assert.equal(t.sheet().getAttribute('data-stage'), '0');
  assert.equal(t.shown.at(-1), null, 'no model for locked incentive');
  assert.equal(t.stamp(), cfg.incentives.stamps[0]);
  const lockedDef = powerUps.types.blackFriday;
  for (const secret of [lockedDef.name, lockedDef.summary, lockedDef.pa.text]) assert.ok(!t.page().includes(secret), 'no leak: ' + secret);

  // Discovered incentive shows icon, name, summary, PA quote and preview entry
  assert.ok(t.row('incentive:commissionDay').textContent.includes(commission.name));
  assert.ok(t.row('incentive:commissionDay').querySelector('svg'), 'discovered row shows incentive icon');
  t.row('incentive:commissionDay').click();
  assert.equal(t.sheet().getAttribute('data-stage'), '3');
  assert.equal(t.shown.at(-1), commission);
  assert.equal(t.stamp(), cfg.incentives.stamps[1]);
  assert.equal(t.guide.element.querySelector('.guide-caption').textContent, commission.name);
  assert.ok(t.guide.element.querySelector('.guide-incentive-icon').querySelector('svg'), 'detail page renders incentive icon');
  for (const shown of [commission.name, commission.summary, commission.paText]) assert.ok(t.page().includes(shown));
  t.screens.show('title');
});

test('the real Guide preview renders every incentive 3D model safely without disposing shared powerUpView assets', () => {
  menuDom();
  const host = document.createElement('div');
  let scene;
  const renderer = { domElement: document.createElement('canvas'), setPixelRatio() {}, setSize() {}, render(value) { scene = value; }, dispose() {}, forceContextLoss() {} };
  const preview = createGuidePreview(host, { makeRenderer: () => renderer });
  const sharedResources = new Set();
  const collectShared = () => {
    scene.traverse((node) => {
      if (node.geometry?.userData?.shared) sharedResources.add(node.geometry);
      for (const m of [].concat(node.material ?? [])) if (m?.userData?.shared) sharedResources.add(m);
    });
  };
  let sharedDisposed = 0;
  for (const entry of incentiveEntries) {
    preview.show(entry);
    preview.render(1 / 60);
    collectShared();
    assert.equal(preview.showing, entry);
  }
  for (const resource of sharedResources) resource.addEventListener('dispose', () => { sharedDisposed += 1; });
  assert.ok(sharedResources.size >= incentiveEntries.length, 'collected shared incentive geometries/materials');
  preview.show(guideEntry('shopper').type);
  preview.show(null);
  preview.dispose();
  assert.equal(sharedDisposed, 0, 'Guide preview never disposes shared incentive GPU assets');
});
