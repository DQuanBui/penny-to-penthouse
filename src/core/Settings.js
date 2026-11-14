// User settings, persisted in localStorage independently of save slots.

const KEY = 'p2p.settings.v1';

export const DEFAULT_SETTINGS = {
  graphics: 'medium', // low | medium | high
  autoQuality: true, // auto-downgrade when FPS stays low
  showFps: false,
  sensitivity: 1,
  invertY: false,
  cameraMode: 'hold', // hold (drag mouse) | lock (pointer lock)
  timeSpeed: 1, // multiplier on the in-game clock
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  uiScale: 1,
  autosave: true,
};

export class Settings {
  constructor(events) {
    this.events = events;
    this.values = { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch {
      /* storage unavailable: keep defaults */
    }
  }
  get(k) {
    return this.values[k];
  }
  set(k, v) {
    if (this.values[k] === v) return;
    this.values[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      /* ignore */
    }
    this.events?.emit('settings', { key: k, value: v });
  }
}
