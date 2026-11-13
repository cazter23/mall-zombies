// Plain DOM, driven by the main loop so the title idle saver also stops the preview.
import * as THREE from 'three';
import { skins, gunSkin, challengeText, locker as cfg } from '../config/skins.js';
import { weapons } from '../config/weapons.js';
import { buildWeaponDisplay } from '../weapons/models/index.js';
import { padBook } from './menuFocus.js';
import { hintHtml } from './glyphs.js';

function release(root) {
  if (!root) return;
  const owned = new Set();
  root.traverse(node => {
    if (node.geometry) owned.add(node.geometry);
    for (const material of [].concat(node.material ?? [])) {
      owned.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData?.sharedSkinPattern) owned.add(value); // (a skin's print is shared)
    }
  });
  root.removeFromParent();
  for (const resource of owned) resource.dispose();
}

/** Renderer injection lets lifecycle tests exercise the real models without WebGL. */
export function createLockerPreview(host, { makeRenderer = options => new THREE.WebGLRenderer(options) } = {}) {
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
  let model = null;
  let width = 0, height = 0;
  let time = 0; // (a feat skin's glow runs on it)
  return {
    show(gunId, skinId) {
      release(model);
      model = buildWeaponDisplay(weapons[gunId], skinId);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      model.position.sub(bounds.getCenter(new THREE.Vector3()));
      pivot.add(model);
      pivot.rotation.set(c.pitch, c.initialYaw, 0);
      const distance = size.length() * c.framing / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov) / 2));
      camera.position.fromArray(c.camera).normalize().multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
    },
    render(dt) {
      const w = host.clientWidth || c.width, h = host.clientHeight || c.height;
      if (w !== width || h !== height) {
        width = w; height = h;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      pivot.rotation.y += dt * c.rotationSpeed;
      time += dt;
      model?.userData.skinTreatment?.animate(time);
      renderer.render(scene, camera);
    },
    dispose() {
      release(model);
      model = null;
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}

export function createLocker({ save, onBack, createPreview = createLockerPreview }) {
  const element = document.createElement('div');
  element.className = 'screen locker-screen hidden';
  for (const [name, value] of Object.entries(cfg.theme)) element.style.setProperty('--locker-' + name, value);
  element.style.setProperty('--locker-preview', '#' + cfg.preview.background.toString(16).padStart(6, '0'));
  element.innerHTML = `
    <div class="card locker-card">
      <div class="form-number">${cfg.form}</div>
      <div class="kicker">${cfg.kicker}</div><h1>${cfg.title}</h1>
      <div class="locker-layout">
        <section class="locker-equipment"><h2>${cfg.guns}</h2><div class="locker-guns"></div></section>
        <section class="locker-finishes"><div class="locker-preview"></div>
          <div class="locker-preview-caption" aria-live="polite"></div>
          <h2>${cfg.skins}</h2><div class="locker-skins"></div>
        </section>
      </div>
      <div class="menu-row"><button class="menu-btn locker-back" type="button">${cfg.back}</button></div>
      <p class="pad-hint" data-hint="locker">${hintHtml('locker')}</p>
    </div>`;
  const gunList = element.querySelector('.locker-guns');
  const skinList = element.querySelector('.locker-skins');
  const previewHost = element.querySelector('.locker-preview');
  const caption = element.querySelector('.locker-preview-caption');
  const back = element.querySelector('.locker-back');
  let open = false, preview = null;
  let selectedGun = Object.keys(weapons)[0], highlighted = null;
  let focus = 0;
  const buttons = () => [...element.querySelectorAll('button')];

  function highlight(skinId) {
    if (!open || highlighted === skinId) return;
    highlighted = skinId;
    const skin = gunSkin(selectedGun, skinId);
    caption.textContent = `${weapons[selectedGun].name} · ${skin?.name ?? cfg.defaultName}`;
    preview.show(selectedGun, skinId);
    for (const row of skinList.children) row.classList.toggle('highlighted', row.dataset.skin === skinId);
  }
  function fillSkins() {
    highlighted = null;
    skinList.replaceChildren();
    const def = weapons[selectedGun];
    const equipped = save.equippedFor(selectedGun);
    for (const skin of [{ id: 'default', name: cfg.defaultName }, ...skins[selectedGun]]) {
      const unlocked = skin.id === 'default' || save.unlocked(selectedGun, skin.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `locker-skin${unlocked ? '' : ' locked'}`;
      row.setAttribute('data-skin', skin.id);
      row.setAttribute('aria-disabled', String(!unlocked)); // locked rows remain focusable so their preview and challenge are available
      row.setAttribute('aria-pressed', String(equipped === skin.id));
      const name = document.createElement('b');
      name.textContent = skin.name;
      const description = document.createElement('span');
      description.textContent = skin.challenge ? challengeText(skin.challenge, def.name) : cfg.defaultDescription;
      const status = document.createElement('small');
      const shown = skin.slot >= 3 ? cfg.featProgress : cfg.progress; // (a feat's progress is its best attempt; a Closing Time reward: done or not yet)
      const progress = skin.challenge ? shown(save.progress(selectedGun, skin.id), skin.challenge.count) : '';
      status.textContent = [progress, equipped === skin.id ? cfg.equipped : unlocked ? cfg.available : cfg.locked].filter(Boolean).join(' · ');
      row.append(name, description, status);
      row.addEventListener('mouseenter', () => highlight(skin.id));
      row.addEventListener('focus', () => highlight(skin.id));
      row.addEventListener('click', () => {
        highlight(skin.id);
        if (!unlocked || !save.equip(selectedGun, skin.id)) return;
        const index = buttons().indexOf(row);
        fillSkins();
        focus = index;
        buttons()[focus]?.focus();
      });
      skinList.append(row);
    }
    highlight(equipped);
  }
  for (const [gunId, def] of Object.entries(weapons)) {
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'menu-btn locker-gun';
    row.setAttribute('data-gun', gunId);
    row.textContent = def.name;
    row.addEventListener('click', () => {
      selectedGun = gunId;
      for (const button of gunList.children) button.setAttribute('aria-pressed', String(button === row));
      fillSkins();
    });
    gunList.append(row);
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
  // LB / RB: the previous / next gun, picked (its skins listed), the cursor on it.
  function nextGun(dir) {
    const ids = Object.keys(weapons);
    const id = ids[(ids.indexOf(selectedGun) + dir + ids.length) % ids.length];
    const row = gunList.querySelector(`[data-gun="${id}"]`);
    row?.click();
    if (row) focusAt(buttons().indexOf(row));
  }
  function focusAt(index) {
    const list = buttons();
    focus = index;
    list.forEach((row, i) => row.classList.toggle('focused', i === focus));
    list[focus].focus();
    list[focus].scrollIntoView?.({ block: 'nearest' });
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
      preview = createPreview(previewHost);
      document.addEventListener('keydown', onKey);
      for (const button of gunList.children) button.setAttribute('aria-pressed', String(button.dataset.gun === selectedGun));
      fillSkins();
      focus = Object.keys(weapons).indexOf(selectedGun);
      buttons()[focus].focus();
    },
    close() {
      if (!open) return;
      open = false;
      document.removeEventListener('keydown', onKey);
      preview.dispose(); preview = null;
      element.classList.add('hidden');
      highlighted = null;
    },
    render(dt) { if (open) preview.render(dt); },
    // Controller (ui/menuFocus.js padBook): move between guns and skins, LB / RB the previous / next gun, A equips.
    padNav(input) {
      if (!open) return;
      padBook(input, { list: buttons, at, focusAt, back: onBack, tab: nextGun, scrollHost: element });
    },
  };
}
