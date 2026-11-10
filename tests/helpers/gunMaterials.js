import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { weapons } from '../../src/config/weapons.js';
import { skins } from '../../src/config/skins.js';
import { buildWeaponModel, buildWeaponDisplay } from '../../src/weapons/models/index.js';

function canvasDocument() {
  return {
    createElement() {
      const commands = [];
      const context = new Proxy({}, {
        get: (target, key) => target[key] ?? ((...args) => commands.push([key, ...args])),
        set(target, key, value) {
          target[key] = value;
          commands.push([key, value]);
          return true;
        },
      });
      return { width: 0, height: 0, commands, getContext: () => context };
    },
  };
}

function geometryHash(geometry) {
  const hash = createHash('sha256');
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    hash.update(name);
    hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
  }
  if (geometry.index) hash.update(Buffer.from(geometry.index.array.buffer));
  return hash.digest('hex');
}

function materialRecord(material) {
  return {
    name: material.name,
    color: material.color?.getHexString() ?? null,
    emissive: material.emissive?.getHexString() ?? null,
    type: material.type,
    roughness: material.roughness ?? null,
    metalness: material.metalness ?? null,
    emissiveIntensity: material.emissiveIntensity ?? null,
    opacity: material.opacity,
    transparent: material.transparent,
    flatShading: material.flatShading ?? null,
    side: material.side,
    texture: material.map ? {
      colorSpace: material.map.colorSpace,
      commands: material.map.image.commands,
    } : null,
  };
}

export function captureGun(root) {
  const nodes = [];
  root.traverse((node) => {
    const record = {
      name: node.name, type: node.type,
      parent: node.parent ? nodes.findIndex((item) => item.object === node.parent) : null,
      position: node.position.toArray(), rotation: node.rotation.toArray(), scale: node.scale.toArray(),
      visible: node.visible,
    };
    if (node.isMesh) {
      record.geometry = geometryHash(node.geometry);
      record.materials = (Array.isArray(node.material) ? node.material : [node.material]).map(materialRecord);
    }
    nodes.push({ object: node, record });
  });
  return nodes.map(({ record }) => record);
}

export function captureGuns({ canvas = false, recolours = {} } = {}) {
  if (canvas) globalThis.document = canvasDocument();
  Object.assign(skins, recolours);
  return Object.fromEntries(Object.entries(weapons).map(([id, def]) => {
    const model = buildWeaponModel(def, recolours[id]?.[0].id);
    return [id, { model: captureGun(model.root), display: captureGun(buildWeaponDisplay(def)) }];
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const request = JSON.parse(readFileSync(0, 'utf8') || '{}');
  process.stdout.write(JSON.stringify(captureGuns(request)));
}
