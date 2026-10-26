import { atriumDetails } from '../../config/atrium.js';
import { parkingLot } from '../../config/parkingLot.js';

// An opaque outer shell closes the Atrium's shop backs and upper floor when viewed
// from customer parking. Interior room culling can then hide the contents safely.
export function buildMallExterior(kit, layout) {
  const E = parkingLot.exterior, A = layout.atrium.rect, T = E.thickness;
  const upperY = layout.hallway.height + .3;
  const height = upperY + layout.atrium.upperHeight + .3;
  const east = A.maxX + atriumDetails.shopInterior.depth + E.clearance;
  const west = A.minX - atriumDetails.shopInterior.depth - E.clearance;
  const north = A.maxZ + atriumDetails.shopInterior.depth + E.clearance;
  const south = parkingLot.rect.maxZ;
  const wall = kit.mat(E.wall), trim = kit.mat(E.trim), cap = kit.mat(0xb7aaa6);
  function piece(name, x0, y0, z0, x1, y1, z1, material) {
    const mesh = kit.box(x0, y0, z0, x1, y1, z1, material, { collide: false, name: `mall_exterior_${name}` });
    mesh.userData.alwaysVisible = true;
    return mesh;
  }
  piece('atrium_east', east, 0, south + .02, east + T, height, north, wall);
  piece('atrium_north', west, 0, north, east, height, north + T, wall);
  piece('atrium_west', west - T, 0, A.minZ, west, height, north + T, wall);
  // Above Mega Mart's roof, a return closes the upper building's exposed end.
  piece('atrium_south_return', A.maxX, layout.megaMart.height + .32, south + .02,
    east, height, south + .02 + T, wall);
  piece('atrium_corner', parkingLot.rect.minX + .14, 0, south - T,
    east, layout.megaMart.height + .31, south, wall);
  piece('atrium_roof', west - T, height + .025, A.minZ, east + T, height + .17, north + T, cap);
  for (const y of [1.1, upperY, height - .4]) {
    piece('east_band', east + T + .025, y, south + .04, east + T + .075, y + .16, north - .04, trim);
    piece('north_band', west + .04, y, north + T + .025, east - .04, y + .16, north + T + .075, trim);
  }
  for (let z = south + 1.5; z < north - .5; z += E.panelSpacing) {
    piece('east_pilaster', east + T + .015, .1, z, east + T + .11, height - .6, z + .16, cap);
  }
  const sign = kit.sign('SUNSET GALLERIA', { x: east + T + .12, y: height - 1.5, z: (north + south) / 2,
    width: 10, height: .8, facing: 'x+', background: '#486e70', color: '#f4dcac' });
  sign.name = 'mall_exterior_atrium_sign'; sign.userData.alwaysVisible = true;
}
