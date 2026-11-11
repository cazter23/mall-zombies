import test from 'node:test';
import assert from 'node:assert/strict';
import { menuDom } from './helpers/menuDom.js';
import { createSkinSave } from '../src/game/skinSave.js';
import { skins, challengeText, locker as cfg, skinStorage } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { createLocker, createLockerPreview } from '../src/ui/locker.js';

menuDom();
const { createScreens } = await import('../src/ui/screens.js');

function fixture() {
  const dom = menuDom();
  const values = new Map();
  let writes = 0, releases = 0, frames = 0;
  const shown = [];
  const save = createSkinSave({ storage: {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, value); writes++; },
  } });
  save.record('stapleGun', 'night-shift', 212);
  const locker = createLocker({ save, onBack: () => screens.show('title'), createPreview: () => ({
    show: (...args) => shown.push(args), render: () => frames++, dispose: () => releases++,
  }) });
  const screens = createScreens({ locker });
  screens.on('locker', () => screens.show('locker'));
  screens.show('title');
  document.querySelector('[data-action="locker"]').click();
  return { ...dom, save, locker, screens, values, shown,
    get writes() { return writes; }, get releases() { return releases; }, get frames() { return frames; },
    skin: id => locker.element.querySelector(`[data-skin="${id}"]`),
    gun: id => locker.element.querySelector(`[data-gun="${id}"]`),
    pad: code => screens.padNav({ consumePress: key => key === code }),
  };
}

test('locker lists all eleven guns, Default and readable locked challenge/progress from the save', () => {
  const t = fixture();
  assert.equal(t.screens.current, 'locker');
  assert.equal(t.screens.showsFlyover, true);
  assert.deepEqual(t.locker.element.querySelectorAll('.locker-gun').map(row => row.textContent), Object.values(weapons).map(def => def.name));
  const locked = t.skin('night-shift');
  assert.equal(locked.classList.contains('locked'), true);
  assert.equal(locked.getAttribute('aria-disabled'), 'true');
  assert.ok(locked.textContent.includes(challengeText(skins.stapleGun[0].challenge, weapons.stapleGun.name)));
  assert.ok(locked.textContent.includes(`212 / ${skins.stapleGun[0].challenge.count}`));
  locked.click();
  assert.equal(t.writes, 0);
  assert.equal(t.save.equippedFor('stapleGun'), 'default');
  assert.deepEqual(t.shown.at(-1), ['stapleGun', 'night-shift'], 'a locked finish can still be previewed');
  t.screens.show('title');
});

test('unlocked selection equips and writes immediately; Default is always available and durable', () => {
  const t = fixture();
  t.save.record('stapleGun', 'night-shift', 400, true);
  t.screens.show('title'); t.screens.show('locker');
  t.skin('night-shift').click();
  assert.equal(t.writes, 1);
  assert.equal(JSON.parse(t.values.get(skinStorage.key)).equipped.stapleGun, 'night-shift');
  assert.equal(t.skin('night-shift').getAttribute('aria-pressed'), 'true');
  t.skin('default').click();
  assert.equal(t.writes, 2);
  assert.equal(JSON.parse(t.values.get(skinStorage.key)).equipped.stapleGun, 'default');
  t.screens.show('title');
});

for (const back of ['button', 'Escape', 'PadB']) test(`locker returns to title by ${back} and releases the preview exactly once`, () => {
  const t = fixture();
  t.locker.render(1);
  assert.equal(t.frames, 1);
  if (back === 'button') t.locker.element.querySelector('.locker-back').click();
  else if (back === 'Escape') assert.equal(t.key('Escape').defaultPrevented, true);
  else t.pad(back);
  assert.equal(t.screens.current, 'title');
  assert.equal(t.locker.isOpen, false);
  assert.equal(t.releases, 1);
  t.locker.render(1); t.locker.close();
  assert.equal(t.frames, 1, 'closed preview never draws');
  assert.equal(t.releases, 1);
  assert.equal(document.activeElement, document.querySelector('[data-action="locker"]'));
});

test('keyboard and controller can reach guns, preview locked finishes and equip available finishes', () => {
  const t = fixture();
  t.key('ArrowDown');
  assert.equal(document.activeElement.dataset.gun, Object.keys(weapons)[1]);
  t.pad('PadA');
  assert.deepEqual(t.shown.at(-1), [Object.keys(weapons)[1], 'default']);
  t.gun('stapleGun').click();
  t.save.record('stapleGun', 'night-shift', 400, true);
  t.gun('stapleGun').click();
  t.skin('default').focus();
  t.pad('PadDown');
  assert.equal(document.activeElement, t.skin('night-shift'));
  t.pad('PadA');
  assert.equal(t.save.equippedFor('stapleGun'), 'night-shift');
  t.pad('PadB');
  document.querySelector('[data-action="play"]').click();
  assert.equal(t.screens.current, 'runMode', 'the current Play chooser remains intact');
});

test('real preview releases every model geometry, material and label texture on change and close', () => {
  menuDom();
  const host = document.createElement('div');
  let scene, draws = 0, disposed = 0, lost = 0;
  const renderer = {
    domElement: document.createElement('canvas'),
    setPixelRatio() {}, setSize() {},
    render(value) { scene = value; draws++; },
    dispose() { disposed++; }, forceContextLoss() { lost++; },
  };
  const preview = createLockerPreview(host, { makeRenderer: () => renderer });
  function resources() {
    const found = new Set();
    scene.traverse(node => {
      if (node.geometry) found.add(node.geometry);
      for (const material of [].concat(node.material ?? [])) {
        found.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) found.add(value);
      }
    });
    return [...found].map(resource => {
      const record = { resource, calls: 0 };
      resource.addEventListener('dispose', () => record.calls++);
      return record;
    });
  }
  preview.show('stapleGun', skins.stapleGun[0].id); preview.render(1);
  const first = resources();
  assert.ok(first.some(({ resource }) => resource.isTexture), 'brand label is included');
  preview.show('rivetRifle', skins.rivetRifle[0].id); preview.render(1);
  assert.ok(first.every(({ calls }) => calls === 1));
  const second = resources();
  preview.dispose();
  assert.ok(second.every(({ calls }) => calls === 1));
  assert.equal(host.children.length, 0);
  assert.equal(draws, 2); assert.equal(disposed, 1); assert.equal(lost, 1);
});

test('every gun lists Default, its mastery, role and feat skins, each challenge readable with its progress (a feat: its best attempt) from the start', () => {
  const t = fixture();
  t.save.record('nailGun', 'measure-twice', 7);
  for (const [gunId, def] of Object.entries(weapons)) {
    t.gun(gunId).click();
    const rows = t.locker.element.querySelectorAll('.locker-skin');
    assert.deepEqual(rows.map(row => row.dataset.skin), ['default', ...skins[gunId].map(skin => skin.id)], gunId);
    for (const skin of skins[gunId]) {
      const row = t.skin(skin.id);
      assert.equal(row.classList.contains('locked'), true);
      assert.ok(row.textContent.includes(skin.name));
      assert.ok(row.textContent.includes(challengeText(skin.challenge, def.name)), `${gunId}/${skin.id}`);
      const count = gunId === 'stapleGun' && skin.slot === 1 ? 212 : gunId === 'nailGun' && skin.slot === 2 ? 7 : 0;
      const progress = skin.slot >= 3 ? cfg.featProgress(count, skin.challenge.count) : `${count} / ${skin.challenge.count}`;
      assert.ok(row.textContent.includes(progress), `${gunId}/${skin.id}: ${row.textContent}`);
    }
  }
  t.gun('nailGun').click();
  assert.ok(t.skin('measure-twice').textContent.includes('Empty 25 magazines of the Nail Gun (10 nails or more) without a single nail missing.'));
  t.screens.show('title');
});
