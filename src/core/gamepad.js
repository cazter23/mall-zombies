// =============================================================================
// GAMEPAD
// Reads the first connected controller (browser Gamepad API, standard layout)
// once per game tick and feeds it into Input:
//   - buttons become held/pressed codes like 'PadA' (see config/controls.js),
//     so gameplay code treats them exactly like keys
//   - sticks become input.padMove / input.padLook (deadzones + response curve)
//   - left stick click latches sprint until you stop pushing forward (COD-style)
// Also tracks the controller type (Xbox / PlayStation) for button prompts.
// =============================================================================

import { gamepad as cfg } from '../config/controls.js';

const DEG_TO_RAD = Math.PI / 180;

// Standard Gamepad API button order.
const BUTTON_CODES = [
  'PadA', 'PadB', 'PadX', 'PadY', 'PadLB', 'PadRB', 'PadLT', 'PadRT',
  'PadBack', 'PadStart', 'PadL3', 'PadR3', 'PadUp', 'PadDown', 'PadLeft', 'PadRight',
];
const LT = 6;
const RT = 7;
const L3 = 10;

// Radial deadzone: returns the stick rescaled so it starts at 0 just past `inner`
// and reaches 1 at `outer`. Writes { x, y, magnitude } into out.
function applyDeadzone(x, y, inner, outer, out) {
  const m = Math.hypot(x, y);
  if (m <= inner) {
    out.x = 0;
    out.y = 0;
    out.magnitude = 0;
    return out;
  }
  const scaled = Math.min(1, (m - inner) / (outer - inner));
  out.x = (x / m) * scaled;
  out.y = (y / m) * scaled;
  out.magnitude = scaled;
  return out;
}

export function createGamepad(input) {
  const wasDown = new Array(BUTTON_CODES.length).fill(false);
  const move = { x: 0, y: 0, magnitude: 0 };
  const look = { x: 0, y: 0, magnitude: 0 };
  let sprintLatched = false;
  let rampTime = 0; // seconds the look stick has been held fully sideways

  function releaseAll() {
    for (let i = 0; i < BUTTON_CODES.length; i++) {
      input.held.delete(BUTTON_CODES[i]);
      wasDown[i] = false;
    }
    input.held.delete('PadSprint');
    sprintLatched = false;
    input.padMove.x = input.padMove.y = 0;
    input.padLook.x = input.padLook.y = 0;
  }

  const state = {
    connected: false,
    type: 'xbox', // 'xbox' | 'playstation' (for prompts)

    // Call once per game tick, before anything reads input.
    poll() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (const p of pads) {
        if (p && p.connected) {
          pad = p;
          break;
        }
      }
      if (!pad) {
        if (state.connected) releaseAll();
        state.connected = false;
        return;
      }
      state.connected = true;
      state.type = /054c|sony|playstation|dualsense|dualshock/i.test(pad.id) ? 'playstation' : 'xbox';

      let active = false;

      // Buttons -> held / pressed codes (edges tracked here, so Input.clear() can't fake a press).
      for (let i = 0; i < BUTTON_CODES.length; i++) {
        const b = pad.buttons[i];
        const down = b ? (i === LT || i === RT ? b.value > cfg.triggerThreshold : b.pressed) : false;
        const code = BUTTON_CODES[i];
        if (down && !wasDown[i]) {
          input.pressed.add(code);
          active = true;
        }
        if (down) input.held.add(code);
        else input.held.delete(code);
        wasDown[i] = down;
      }

      // Sticks. Stick "up" is a negative axis value, so flip Y: +y = forward / look up.
      const axes = pad.axes;
      applyDeadzone(axes[0] || 0, axes[1] || 0, cfg.moveDeadzone, cfg.outerDeadzone, move);
      input.padMove.x = move.x;
      input.padMove.y = -move.y;

      applyDeadzone(axes[2] || 0, axes[3] || 0, cfg.lookDeadzone, cfg.outerDeadzone, look);
      // Response curve on the magnitude (keeps direction): fine near center, fast at the edge.
      const curved = Math.pow(look.magnitude, cfg.lookCurve);
      const k = look.magnitude > 0 ? curved / look.magnitude : 0;
      input.padLook.x = look.x * k;
      input.padLook.y = -look.y * k;

      if (move.magnitude > 0 || look.magnitude > 0) active = true;

      // Click-to-sprint: L3 latches it; letting the stick come back (or aiming / crouching) ends it.
      const l3Pressed = input.pressed.has('PadL3');
      if (l3Pressed) {
        sprintLatched = true;
        input.pressed.add('PadSprint');
      }
      if (input.padMove.y < cfg.sprintReleaseForward && !l3Pressed) sprintLatched = false;
      // A fresh aim or crouch press ends the sprint. (Only a fresh press: clicking sprint while
      // already holding aim drops ADS and sprints, the COD way; see weapons/aim.js.)
      if (!l3Pressed && (input.actionPressed('aim') || input.actionPressed('crouch'))) sprintLatched = false;
      if (sprintLatched) input.held.add('PadSprint');
      else input.held.delete('PadSprint');

      if (active) input.device = 'gamepad';
    },

    // Look turn rate this frame (radians per second), including the turn ramp.
    // Writes { yaw, pitch } into out: +yaw = turn right, +pitch = look up.
    lookRate(frameTime, out) {
      const x = input.padLook.x;
      const y = input.padLook.y;
      const r = cfg.ramp;
      if (Math.abs(x) >= r.threshold) rampTime += frameTime;
      else rampTime = 0;
      const ramp = 1 + r.extra * Math.max(0, Math.min(1, (rampTime - r.delaySeconds) / r.rampSeconds));
      out.yaw = x * cfg.yawDegreesPerSecond * DEG_TO_RAD * ramp;
      out.pitch = y * cfg.pitchDegreesPerSecond * DEG_TO_RAD * (cfg.invertY ? -1 : 1);
      return out;
    },
  };
  return state;
}
