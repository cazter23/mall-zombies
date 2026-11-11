import { BoxGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { closingTime } from '../config/closingTime.js';

export function createClosingKeyView(scene) {
  const { visual } = closingTime;
  const root = new Group();
  root.name = 'closingKeys';
  root.userData.dynamic = true;
  scene.add(root);
  const gold = new MeshStandardMaterial({
    color: visual.color, emissive: visual.color, emissiveIntensity: visual.emissiveIntensity,
  });
  const ink = new MeshStandardMaterial({ color: visual.signature.inkColor });
  const { radius, tube, radialSegments, tubularSegments } = visual.ring;
  const ring = new TorusGeometry(radius, tube, radialSegments, tubularSegments);
  const box = new BoxGeometry();
  function part({ size, at }, material = gold) {
    const mesh = new Mesh(box, material);
    mesh.scale.set(...size);
    mesh.position.set(...at);
    return mesh;
  }
  const props = new Map();
  for (const id of Object.keys(closingTime.lines)) {
    const prop = new Group();
    prop.name = id;
    prop.visible = false;
    if (id === 'manager') {
      prop.add(part(visual.signature.paper), part(visual.signature.ink, ink));
    } else {
      prop.add(new Mesh(ring, gold), part(visual.shaft), ...visual.teeth.map((tooth) => part(tooth)));
    }
    root.add(prop);
    props.set(id, prop);
  }

  return {
    drop(id, position) {
      const prop = props.get(id);
      prop.position.copy(position);
      prop.position.y += visual.hover;
      prop.rotation.y = 0;
      prop.visible = true;
    },
    remove(id) {
      props.get(id).visible = false;
    },
    update(dt) {
      for (const prop of props.values()) {
        if (prop.visible) prop.rotation.y += dt * visual.spinSpeed;
      }
    },
  };
}
