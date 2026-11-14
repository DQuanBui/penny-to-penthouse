// requestAnimationFrame loop with clamped delta time and a smoothed FPS meter.

export class Loop {
  constructor(update) {
    this.update = update;
    this.running = false;
    this.last = 0;
    this.fps = 60;
    this.elapsed = 0;
    this._tick = this._tick.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }
  stop() {
    this.running = false;
  }
  _tick(now) {
    if (!this.running) return;
    const raw = (now - this.last) / 1000;
    this.last = now;
    // Clamp so a background tab or a long hitch never explodes the simulation.
    const dt = Math.min(Math.max(raw, 0), 0.1);
    if (raw > 0) this.fps += (1 / raw - this.fps) * 0.05;
    this.elapsed += dt;
    this.update(dt, this.elapsed);
    requestAnimationFrame(this._tick);
  }
}
