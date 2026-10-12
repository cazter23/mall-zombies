// =============================================================================
// INPUT
// Tracks held keys, one-shot key presses, mouse movement, and pointer lock.
// Uses KeyboardEvent.code (physical key position), so WASD works on any layout.
// =============================================================================

// Keys whose default browser behaviour (scrolling, etc.) we block while playing.
const GAME_KEYS = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR']);

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

    window.addEventListener('keydown', (e) => {
      if (this.locked && GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });

    // Mouse buttons are tracked like keys: 'Mouse0' = left, 'Mouse1' = middle, 'Mouse2' = right.
    // Only while locked, so the click that starts the game doesn't also fire a shot.
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const code = `Mouse${e.button}`;
      this.pressed.add(code);
      this.held.add(code);
    });
    document.addEventListener('mouseup', (e) => {
      this.held.delete(`Mouse${e.button}`);
    });
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
