// A controller as the menus see it (core/menuNav.js reads ACTIONS): the buttons pressed this tick, by their standard
// codes ('PadA', 'PadDown'...), each read through the actions bound to it in config/controls.js. A press is consumed once.
//   padInput('PadDown', 'PadA')            two presses in the same tick
//   padInput({ held: ['PadDown'], move: { x: 0, y: -1 } })   buttons held down / sticks (for the repeat and stick tests)
import { bindings } from '../../src/config/controls.js';

export function padInput(...args) {
  const options = typeof args[0] === 'object' ? args.shift() : {};
  const pressed = new Set(args);
  const held = new Set(options.held ?? []);
  return {
    device: options.device ?? 'gamepad',
    padMove: options.move ?? { x: 0, y: 0 },
    padLook: options.look ?? { x: 0, y: 0 },
    pressed,
    held,
    consumeAction(action) {
      let hit = false;
      for (const code of bindings[action] ?? []) if (pressed.delete(code)) hit = true;
      return hit;
    },
    actionDown: (action) => (bindings[action] ?? []).some((code) => held.has(code)),
  };
}
