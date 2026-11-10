import * as THREE from 'three';
import { wardrobeLook } from '../config/wardrobe.js';

// The wool tile is generated once per viewmodel. A wavy braid and fine ribs read as cable knit at the wrist.
function knitTile() {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = Math.sin(y / size * Math.PI * 2) * 2.3;
      const braid = Math.max(0, Math.cos((x + wave) * Math.PI / 4), Math.cos((x - wave + 2) * Math.PI / 4));
      const shade = Math.round(150 + 65 * braid + 24 * Math.cos((x + y) * Math.PI / 2));
      const offset = (y * size + x) * 4;
      pixels.set([shade, shade, shade, 255], offset);
    }
  }
  const tile = new THREE.DataTexture(pixels, size, size);
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  tile.repeat.set(4, 3);
  tile.magFilter = THREE.LinearFilter;
  tile.minFilter = THREE.LinearMipmapLinearFilter;
  tile.generateMipmaps = true;
  tile.needsUpdate = true;
  return tile;
}

export function createSleeveStyler(rig) {
  const tagged = [];
  rig.traverse((part) => {
    if (part.userData.sleevePart) tagged.push({ part, material: part.material, visible: part.visible });
  });
  const wool = knitTile();
  const cloth = (color, options) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...options });
  const knit = cloth(wardrobeLook.knit.wool, { map: wool });
  const trim = cloth(wardrobeLook.knit.trim);
  const cuff = cloth(wardrobeLook.knit.cuff, { map: wool });
  const vest = cloth(wardrobeLook.vest.cloth);
  const tape = cloth(wardrobeLook.vest.tape, { emissive: wardrobeLook.vest.tape, emissiveIntensity: 0.25 });
  const styles = {
    cardigan: { sleeve: knit, forearm: knit, cuff, stripe: trim, gold: cuff, badge: false },
    hiVisVest: { sleeve: vest, cuff: vest, stripe: tape, gold: vest, tape },
  };
  return (item) => {
    const style = styles[item];
    for (const { part, material, visible } of tagged) {
      const look = style?.[part.userData.sleevePart];
      if (part.isMesh) part.material = look || material;
      part.visible = look === false ? false : visible || !!look;
    }
  };
}

/** Browser-owned geometry follows the same events as the outfit rail. */
export function connectWardrobeAppearance(events, { body, viewmodel }) {
  function wear({ slot, worn }) {
    if (slot === 'torso') viewmodel.setSleeves(worn);
    if (slot === 'feet') body.setShoes(worn);
    if (slot === 'accessory') viewmodel.setMeleeWear(worn);
    body.setClothes(slot, worn);
  }
  events.on('wardrobeChange', wear);
  events.on('runReset', () => {
    for (const slot of ['torso', 'feet', 'accessory']) wear({ slot, worn: null });
  });
}
