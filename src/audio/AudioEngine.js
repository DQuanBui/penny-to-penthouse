// Procedural audio with Web Audio: UI and world sound effects are synthesised
// on the fly, with Ambience.js (city sound bed) and Music.js (lo-fi loop).
// Optional files in public/audio override the synth:
//   <sfx name>.mp3|ogg|wav   e.g. click, cash, notify, success, error, door, step, swoosh
//   music.mp3 or music_<cityId>.mp3   replaces the generated music loop
import { Ambience } from './Ambience.js';
import { Music } from './Music.js';
import { loadAssetManifest } from '../core/Assets.js';

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.buffers = {};
    this._noise = null;
    // browsers only allow audio after a user gesture
    const unlock = () => this.init();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
    game.events.on('settings', () => this.setVolumes());
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.musicGain = c.createGain();
    this.musicGain.connect(this.master);
    this.ambGain = c.createGain();
    this.ambGain.connect(this.master);
    this.setVolumes();
    this.ambience = new Ambience(this);
    this.music = new Music(this);
    this.loadFiles();
  }

  setVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.get('master'), t, 0.05);
    this.sfx.gain.setTargetAtTime(s.get('sfx'), t, 0.05);
    this.ambGain.gain.setTargetAtTime(s.get('sfx') * 0.8, t, 0.05);
    this.musicGain.gain.setTargetAtTime(s.get('music') * 0.55, t, 0.05);
  }

  async loadFiles() {
    const m = await loadAssetManifest();
    for (const f of m.audio) {
      try {
        const data = await (await fetch('./audio/' + f)).arrayBuffer();
        this.buffers[f.replace(/\.[^.]+$/, '').toLowerCase()] = await this.ctx.decodeAudioData(data);
      } catch {
        /* unreadable file: keep the synth */
      }
    }
  }

  /** Shared white-noise buffer (2 s). */
  noise() {
    if (this._noise) return this._noise;
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = b);
  }

  /** One enveloped oscillator note. */
  tone(dest, { type = 'sine', f = 440, f2 = null, t = 0, dur = 0.15, gain = 0.2, attack = 0.005 }) {
    const c = this.ctx;
    const t0 = c.currentTime + t;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  /** A filtered burst of noise. */
  burst(dest, { t = 0, dur = 0.1, gain = 0.2, type = 'lowpass', f = 800, f2 = null, q = 0.7 }) {
    const c = this.ctx;
    const t0 = c.currentTime + t;
    const src = c.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(g).connect(dest);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.02);
  }

  /** A plucked string (busker guitar). */
  pluck(f, gain = 0.1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.tone(this.sfx, { type: 'triangle', f, dur: 0.9, gain, attack: 0.003 });
    this.tone(this.sfx, { type: 'sine', f: f * 2, dur: 0.5, gain: gain * 0.35, attack: 0.003 });
  }

  /** Play a named sound effect. Unknown names are ignored. */
  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const d = this.sfx;
    const buf = this.buffers[name];
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(d);
      s.start();
      return;
    }
    switch (name) {
      case 'click':
        this.tone(d, { f: 900, f2: 620, dur: 0.05, gain: 0.12 });
        break;
      case 'swoosh':
        this.burst(d, { type: 'bandpass', f: 380, f2: 2400, dur: 0.2, gain: 0.16, q: 1.2 });
        break;
      case 'cash':
        this.burst(d, { type: 'highpass', f: 3000, dur: 0.05, gain: 0.12 });
        this.tone(d, { type: 'triangle', f: 1318, t: 0.03, dur: 0.3, gain: 0.16 });
        this.tone(d, { type: 'triangle', f: 1760, t: 0.11, dur: 0.38, gain: 0.16 });
        break;
      case 'notify':
        this.tone(d, { f: 880, dur: 0.14, gain: 0.13 });
        this.tone(d, { f: 1320, t: 0.11, dur: 0.22, gain: 0.13 });
        break;
      case 'success':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(d, { type: 'triangle', f, t: i * 0.075, dur: 0.24, gain: 0.14 }));
        break;
      case 'error':
        this.tone(d, { type: 'sawtooth', f: 190, f2: 130, dur: 0.2, gain: 0.09 });
        break;
      case 'door':
        this.tone(d, { f: 120, f2: 62, dur: 0.14, gain: 0.3 });
        this.burst(d, { f: 1400, dur: 0.05, gain: 0.08 });
        break;
      case 'flap':
        for (let i = 0; i < 7; i++) this.burst(d, { type: 'bandpass', f: 900 + Math.random() * 600, q: 1.5, t: i * 0.055, dur: 0.05, gain: 0.07 });
        break;
      case 'bark':
        // two short woofs
        for (const t of [0, 0.2]) {
          this.tone(d, { type: 'sawtooth', f: 340, f2: 190, t, dur: 0.11, gain: 0.12 });
          this.burst(d, { type: 'bandpass', f: 700, q: 2, t, dur: 0.09, gain: 0.12 });
        }
        break;
      case 'shutter':
        this.burst(d, { type: 'highpass', f: 2500, dur: 0.03, gain: 0.25 });
        this.burst(d, { type: 'bandpass', f: 1200, t: 0.07, dur: 0.05, gain: 0.18 });
        break;
      case 'throw':
        this.burst(d, { type: 'bandpass', f: 1400, f2: 500, q: 1, dur: 0.22, gain: 0.08 });
        break;
      case 'bump':
        this.tone(d, { f: 90, f2: 40, dur: 0.25, gain: 0.35 });
        this.burst(d, { f: 900, dur: 0.18, gain: 0.18 });
        break;
      case 'step':
        this.burst(d, { f: 500 + Math.random() * 250, dur: 0.06, gain: 0.07 });
        break;
      case 'stepIn':
        this.burst(d, { f: 900 + Math.random() * 300, dur: 0.045, gain: 0.05 });
        break;
      default:
    }
  }

  /**
   * @param s { active, outside, night 0..1, weather, cityCfg, driving }
   */
  update(dt, s) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.ambience.update(dt, s);
    this.music.update(dt, s);
  }
}
