// Keyboard + mouse state. Polled by controllers each frame; one-shot presses
// are consumed through pressed(). Typing in form fields never leaks into gameplay.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttons = 0;
    this.locked = false;
    this.cameraMode = 'hold'; // 'hold' = hold right mouse, 'lock' = pointer lock
    this.gameplay = false; // true only while the 3D world accepts input

    const typing = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };

    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code === 'F1') e.preventDefault();
      if (!e.repeat) this.justPressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.buttons = 0;
    });

    canvas.addEventListener('mousedown', (e) => {
      this.buttons |= 1 << e.button;
      if (this.cameraMode === 'lock' && this.gameplay && !this.locked) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', (e) => {
      this.buttons &= ~(1 << e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      const orbiting = this.locked || (this.cameraMode === 'hold' && this.buttons & 0b110) || (this.cameraMode === 'hold' && this.buttons & 1);
      if (orbiting && this.gameplay) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.gameplay) this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  isDown(code) {
    return this.down.has(code);
  }
  /** True once per key press. */
  pressed(code) {
    return this.justPressed.has(code);
  }
  releaseLock() {
    if (this.locked) document.exitPointerLock?.();
  }
  /** Call at the end of every frame. */
  endFrame() {
    this.justPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
