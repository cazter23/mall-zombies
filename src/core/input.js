// =============================================================================
// INPUT
// Tracks held keys, one-shot key presses, mouse movement, and pointer lock.
// Uses KeyboardEvent.code (physical key position), so WASD works on any layout.
// Controller buttons arrive here too (as 'PadA' etc., from core/gamepad.js), and
// gameplay asks for ACTIONS ("jump", "fire") mapped in config/controls.js, so
// keyboard/mouse and controller work through the same calls.
// =============================================================================

import { bindings } from '../config/controls.js';

// Keys whose default browser behaviour (scrolling, etc.) we block while playing.
const GAME_KEYS = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR', 'KeyV', 'Tab']);

// Chrome occasionally reports a huge mouse jump right after locking; ignore those.
const MAX_MOUSE_DELTA = 400;

export class Input {
  constructor(lockTarget) {
    this.lockTarget = lockTarget;
    this.held = new Set(); // keys currently held down
    this.pressed = new Set(); // keys pressed since the last game tick
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.lockListeners = [];

    // Controller sticks (filled in by core/gamepad.js): x = right, y = forward / up, -1..1.
    this.padMove = { x: 0, y: 0 };
    this.padLook = { x: 0, y: 0 };
    // Last device used: 'keyboard' (keyboard + mouse) or 'gamepad'. Drives prompts and aim assist.
    this.device = 'keyboard';

    window.addEventListener('keydown', (e) => {
      if (this.locked && GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
      this.device = 'keyboard';
    });

    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });

    // Mouse buttons are tracked like keys: 'Mouse0' = left, 'Mouse1' = middle, 'Mouse2' = right.
    // Only while locked, so the click that starts the game doesn't also fire a shot.
    document.addEventListener('mousedown', (e) => {
      // Middle click is the Tactical throw: never let it start the browser's autoscroll (or paste), locked or not.
      if (e.button === 1) e.preventDefault();
      if (!this.locked) return;
      const code = `Mouse${e.button}`;
      this.pressed.add(code);
      this.held.add(code);
      this.device = 'keyboard';
    });
    document.addEventListener('mouseup', (e) => {
      this.held.delete(`Mouse${e.button}`);
    });
    // Mouse wheel: each notch is a one-shot press 'WheelUp' / 'WheelDown' (weapon switching).
    document.addEventListener(
      'wheel',
      (e) => {
        if (!this.locked || e.deltaY === 0) return;
        this.pressed.add(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
        this.device = 'keyboard';
      },
      { passive: true },
    );
    document.addEventListener('contextmenu', (e) => {
      if (this.locked) e.preventDefault();
    });

    // Losing focus (alt-tab) would otherwise leave keys "stuck" down.
    window.addEventListener('blur', () => this.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.device = 'keyboard';
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.lockTarget;
      this.clear();
      for (const fn of this.lockListeners) fn(this.locked);
    });
  }

  // Must be called from a user gesture (click). Browsers refuse otherwise, and
  // Chrome also refuses for ~1s right after pressing Esc; the player just clicks again.
  requestLock() {
    try {
      const result = this.lockTarget.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* ignored: user can click again */
    }
  }

  onLockChange(fn) {
    this.lockListeners.push(fn);
  }

  isDown(code) {
    return this.held.has(code);
  }

  // True once per physical key press (consumed by the first tick that asks).
  consumePress(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  // True if the key was pressed this tick, WITHOUT consuming it (other systems can still see it).
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // --- Actions (see config/controls.js) ---

  // Is any key/button bound to this action held?
  actionDown(action) {
    for (const code of bindings[action]) if (this.held.has(code)) return true;
    return false;
  }

  // Was it pressed this tick? Consumes the press (for every code bound to the action).
  consumeAction(action) {
    let hit = false;
    for (const code of bindings[action]) if (this.pressed.delete(code)) hit = true;
    return hit;
  }

  // Was it pressed this tick? Does NOT consume, so other systems still see it.
  actionPressed(action) {
    for (const code of bindings[action]) if (this.pressed.has(code)) return true;
    return false;
  }

  // Movement intent, combining WASD and the left stick: x = right, y = forward.
  // Length is at most 1 (a half-pushed stick gives about half).
  moveAxis() {
    let x = (this.actionDown('right') ? 1 : 0) - (this.actionDown('left') ? 1 : 0) + this.padMove.x;
    let y = (this.actionDown('forward') ? 1 : 0) - (this.actionDown('back') ? 1 : 0) + this.padMove.y;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  // Called after every game tick so a press is only seen by one tick.
  endTick() {
    this.pressed.clear();
  }

  // Mouse movement accumulated since the last call (read once per rendered frame).
  consumeMouse() {
    const delta = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
