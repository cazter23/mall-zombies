// Wardrobe scenery uses a local frame facing the aisle. Prompts are built separately.
import { BoxGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three';

const ink = 0x2e2332;
const cream = 0xffedca;
const gold = 0xc49549;
const steel = 0x758891;

// Height is measured from the zone floor. Depth is measured outward from the fixture face.
const mounts = {
  paperHat: { height: 1.44, depth: -0.18 },
  aviators: { height: 1.71, depth: 0.13 },
  glasses: { height: 1.64, depth: 0.15 },
  cardigan: { height: 1.24, depth: -0.20, post: true },
  sandwichBoard: { height: 1.39, depth: -0.64, lateral: 0.66, supportY: 1.006 },
  hiVisVest: { height: 1.59, depth: 0.10 },
  lightUpSneakers: { height: 2.43, depth: 0.12 },
  orthopedicWalkers: { height: 1.59, depth: 0.13 },
  wheelieSneakers: { height: 1.64, depth: 0.11 },
  foamFinger: { height: 1.61, depth: 0.13 },
  fannyPack: { height: 1.40, depth: -0.91, lateral: -0.20, supportY: 1.006 },
  goldCard: { height: 1.48, depth: -0.23, post: true },
  hoffmans: { height: 2.13, depth: 0.22 },
  shoePerSale: { height: 1.97, depth: 0.13 },
  staffLockers: { height: 1.62, depth: 0.17 },
};

function displayTools(kit, name, anchor, facing, normal, floorY, mount) {
  const root = new Group();
  root.name = name;
  kit.group.add(root);
  const yaw = Math.atan2(normal.x, normal.z);
  const right = new Vector3(normal.z, 0, -normal.x);
  const origin = anchor.clone().setY(floorY + mount.height)
    .addScaledVector(normal, mount.depth).addScaledVector(right, mount.lateral ?? 0);
  const at = (x, y, z) => origin.clone().addScaledVector(right, x).addScaledVector(normal, z).add(new Vector3(0, y, 0));
  const add = (geometry, color, x, y, z, options = {}) => {
    const { tilt = 0, roll = 0, ...material } = options;
    const mesh = new Mesh(geometry, kit.mat(color, material));
    mesh.name = name + '_detail';
    mesh.position.copy(at(x, y, z));
    mesh.rotation.set(tilt, yaw, roll, 'YXZ');
    root.add(mesh);
    return mesh;
  };
  const box = (x, y, z, width, height, depth, color, options) =>
    add(new BoxGeometry(width, height, depth), color, x, y, z, options);
  const drum = (x, y, z, radius, depth, color, options = {}) =>
    add(new CylinderGeometry(radius, radius, depth, 10), color, x, y, z, { tilt: Math.PI / 2, ...options });
  const sign = (label, x, y, z, width, height, background, color = '#ffedca') => {
    const position = at(x, y, z);
    const face = kit.sign(label, { ...position, facing, width, height, background, color });
    face.name = name + '_sign';
    root.add(face);
    return face;
  };
  const ticket = (label, z = 0.20) => {
    box(0, 0, (z - 0.05) / 2, 0.15, 0.11, z - 0.032, steel);
    box(0, 0, z - 0.032, 0.79, 0.19, 0.045, ink);
    return sign(label, 0, 0, z, 0.75, 0.15, '#402641');
  };
  if (mount.post || mount.supportY) {
    const rise = mount.height - (mount.supportY ?? 0);
    box(0, (0.052 - rise) / 2, -0.035, 0.075, rise - 0.052, 0.075, steel);
    box(0, 0.026 - rise, -0.035, 0.39, 0.052, 0.29, ink);
  }
  return { box, drum, sign, ticket };
}

const glow = color => ({ emissive: color, emissiveIntensity: 0.65 });
const chrome = { metalness: 0.65, roughness: 0.28 };

function shoe({ box }, color, sole, { roll = 0, y = 0.43 } = {}) {
  box(0, y - 0.10, 0.06, 0.80, 0.115, 0.27, sole, { roll });
  box(-0.04, y + 0.025, 0.055, 0.70, 0.15, 0.23, color, { roll });
  box(-0.19, y + 0.15, 0.049, 0.37, 0.17, 0.19, color, { roll });
  for (const x of [-0.25, -0.16, -0.07]) box(x, y + 0.11, 0.171, 0.035, 0.10, 0.025, cream, { roll: -0.22 + roll });
}

const displays = {
  paperHat({ box, sign }) {
    box(0, 0.18, 0, 1.02, 0.54, 0.30, 0xb83239);
    sign('SHIFT MEAL SPECIAL', 0, 0.30, 0.162, 0.94, 0.18, '#ad2934');
    box(0, 0.47, 0.04, 0.87, 0.12, 0.31, cream);
    box(-0.17, 0.60, 0.04, 0.49, 0.075, 0.26, cream, { roll: 0.53 });
    box(0.17, 0.61, 0.04, 0.49, 0.075, 0.26, 0xffdfaa, { roll: -0.53 });
  },
  aviators({ box, drum }) {
    box(0, 0.32, -0.015, 1.04, 0.73, 0.14, 0x187c80);
    box(0, 0.48, 0.09, 0.37, 0.065, 0.048, gold);
    for (const x of [-0.25, 0.25]) {
      drum(x, 0.51, 0.092, 0.235, 0.055, gold, chrome);
      drum(x, 0.51, 0.127, 0.194, 0.032, 0x99d5df, chrome);
      box(x, 0.23, 0.09, 0.21, 0.042, 0.16, ink);
      drum(x, 0.29, 0.13, 0.05, 0.027, 0x436583, chrome);
    }
  },
  glasses({ box, drum }) {
    box(0, 0.35, -0.015, 1.04, 0.79, 0.19, 0x573451);
    box(0, 0.51, 0.103, 0.82, 0.30, 0.05, cream);
    box(0, 0.20, 0.103, 0.59, 0.08, 0.05, ink);
    for (const [x, color] of [[-0.21, 0xe74751], [0.21, 0x37d4dc]]) drum(x, 0.51, 0.15, 0.15, 0.04, color, glow(color));
    for (const x of [-0.43, -0.22, 0, 0.22, 0.43]) drum(x, 0.73, 0.085, 0.035, 0.033, gold, glow(gold));
  },
  cardigan({ box, drum, sign }) {
    box(0, 0.13, -0.04, 0.64, 0.12, 0.29, gold);
    box(0, 0.49, 0, 0.52, 0.59, 0.24, 0x88484f);
    box(0, 0.80, -0.014, 0.23, 0.15, 0.20, gold, chrome);
    for (const x of [-0.33, 0.33]) box(x, 0.45, 0, 0.17, 0.55, 0.20, 0xa75b5e, { roll: x < 0 ? -0.16 : 0.16 });
    box(0, 0.47, 0.137, 0.065, 0.52, 0.036, 0xb97571);
    for (const y of [0.30, 0.43, 0.56]) drum(0, y, 0.167, 0.025, 0.027, gold);
    sign('MARKDOWN', 0.36, 0.35, 0.19, 0.31, 0.14, '#8d2f38');
  },
  sandwichBoard({ box, sign }) {
    box(0, 0.39, -0.10, 0.96, 0.70, 0.075, 0xad6c21, { tilt: 0.25 });
    box(0, 0.39, 0.085, 0.97, 0.73, 0.10, 0xf9bd36);
    sign('EVERYTHING MUST GO', 0, 0.46, 0.146, 0.91, 0.31, '#f9bd36', '#432a22');
    box(0, 0.16, 0.147, 0.64, 0.06, 0.04, 0xad3d38);
  },
  hiVisVest({ box, drum }) {
    box(0, 0.31, -0.035, 0.69, 0.76, 0.105, 0x47665e);
    box(-0.39, 0.33, 0.01, 0.14, 0.71, 0.13, steel);
    box(0, 0.38, 0.06, 0.42, 0.43, 0.088, 0xe89d25);
    for (const x of [-0.127, 0.127]) box(x, 0.45, 0.114, 0.051, 0.31, 0.018, cream);
    box(0, 0.27, 0.122, 0.43, 0.056, 0.019, cream);
    drum(0, 0.77, 0, 0.087, 0.14, 0xff912e, { tilt: 0, ...glow(0xff912e) });
  },
  lightUpSneakers(d) {
    d.box(0, 0.17, 0, 0.95, 0.26, 0.29, 0x322758);
    shoe(d, 0x2c9fa8, 0xffc658);
    for (const [i, color] of [0xff627d, 0xffcb61, 0x66dcce, 0xad8fff, 0xff627d].entries()) {
      d.drum(i * 0.15 - 0.30, 0.20, 0.163, 0.038, 0.032, color, glow(color));
    }
  },
  orthopedicWalkers(d) {
    d.box(0, 0.18, 0, 0.97, 0.30, 0.29, 0x50736e);
    d.box(0, 0.32, 0.015, 0.92, 0.10, 0.27, 0xaebca1);
    shoe(d, 0x875f4e, cream, { y: 0.49 });
    d.box(0, 0.90, -0.035, 1.10, 0.23, 0.11, 0x435e57);
    d.sign('COMFORT CENTER', 0, 0.90, 0.032, 1.04, 0.17, '#435e57');
  },
  wheelieSneakers(d) {
    d.box(0, 0.22, 0.016, 0.98, 0.15, 0.26, 0xe88c35, { roll: 0.22 });
    shoe(d, 0x7755aa, 0xe1d3af, { roll: 0.22, y: 0.48 });
    d.drum(0.23, 0.34, 0.156, 0.081, 0.054, ink);
    d.drum(0.23, 0.34, 0.19, 0.040, 0.019, cream);
  },
  foamFinger({ box, sign }) {
    box(0, 0.19, -0.008, 0.76, 0.24, 0.24, 0x334677);
    box(0.08, 0.45, 0.017, 0.47, 0.38, 0.18, 0xbb314d);
    box(-0.079, 0.71, 0.018, 0.155, 0.54, 0.17, 0xc93d56, { roll: 0.09 });
    box(0.27, 0.56, 0.022, 0.14, 0.16, 0.17, 0xc93d56, { roll: -0.23 });
    sign('#1', 0.102, 0.48, 0.12, 0.28, 0.23, '#bb314d');
  },
  fannyPack({ box }) {
    box(0, 0.24, -0.035, 1.03, 0.16, 0.13, ink);
    box(0, 0.36, 0.016, 0.82, 0.46, 0.29, 0x606e42);
    box(-0.18, 0.30, 0.18, 0.34, 0.23, 0.14, 0x8c8b54);
    box(0.19, 0.31, 0.19, 0.29, 0.24, 0.12, 0x7d8150);
    box(0, 0.49, 0.174, 0.74, 0.035, 0.044, gold);
    box(0.23, 0.45, 0.206, 0.055, 0.09, 0.039, gold);
  },
  goldCard({ box, drum, sign }) {
    box(0, 0.33, 0, 0.87, 0.71, 0.22, 0x354148);
    drum(0, 0.35, 0.126, 0.31, 0.055, steel, chrome);
    drum(0, 0.35, 0.165, 0.254, 0.034, 0x23323c);
    box(0, 0.36, 0.201, 0.40, 0.23, 0.036, 0xe3b54f, { ...chrome, roll: -0.08 });
    sign('GALLERIA GOLD', 0, 0.358, 0.23, 0.34, 0.125, '#d4a846', '#3b2930');
  },
};

export function buildWardrobeDisplay(kit, { kind, item, name, position, normal }, facing, floorY, title) {
  const d = displayTools(kit, name, position, facing, normal, floorY, mounts[item]);
  if (kind === 'fittingRoom') {
    d.box(0, 0, -0.042, 0.87, 0.26, 0.09, ink);
    for (const x of [-0.36, 0.36]) d.drum(x, 0, 0.014, 0.047, 0.026, 0xffc872, glow(0xffc872));
    d.sign('TRY ON', 0, 0, 0.015, 0.58, 0.18, '#523057');
  } else {
    displays[item](d);
    d.ticket(title, item === 'fannyPack' ? 0.27 : 0.22);
  }
}
