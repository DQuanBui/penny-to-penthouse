// A light generative lo-fi loop. Each city sets its mood with a root note,
// scale and tempo (data/cities/*.js -> music). Notes are scheduled a little
// ahead of the audio clock so timing stays tight at any frame rate.

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
// chord roots as scale degrees
const PROGRESSIONS = { major: [0, 5, 3, 4], minor: [0, 5, 2, 6] };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class Music {
  constructor(engine) {
    this.e = engine;
    const c = engine.ctx;
    // everything goes through a soft low-pass for the "tape" feel
    this.bus = c.createBiquadFilter();
    this.bus.type = 'lowpass';
    this.bus.frequency.value = 2400;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.bus.connect(this.out).connect(engine.musicGain);
    this.step = 0;
    this.next = 0;
    this.cfg = { root: 60, scale: 'major', bpm: 80 };
    this.file = null;
  }

  setCity(cfg) {
    this.cfg = { root: 60, scale: 'major', bpm: 80, ...(cfg?.music || {}) };
    // a music file for this city (or a generic one) replaces the generated loop
    const buf = this.e.buffers['music_' + cfg?.id] || this.e.buffers.music;
    if (buf && this.fileBuf !== buf) {
      this.file?.stop();
      this.fileBuf = buf;
      this.file = this.e.ctx.createBufferSource();
      this.file.buffer = buf;
      this.file.loop = true;
      this.file.connect(this.out);
      this.file.start();
    }
  }

  note(midi, t, dur, gain, type = 'triangle') {
    const c = this.e.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  drum(kind, t) {
    const e = this.e;
    const dt = t - e.ctx.currentTime;
    if (kind === 'kick') e.tone(this.bus, { f: 110, f2: 45, t: dt, dur: 0.2, gain: 0.32 });
    else if (kind === 'snare') e.burst(this.bus, { type: 'bandpass', f: 1700, q: 0.8, t: dt, dur: 0.12, gain: 0.1 });
    else e.burst(this.bus, { type: 'highpass', f: 6000, t: dt, dur: 0.03, gain: 0.03 });
  }

  /** Schedule one 8th-note step. */
  schedule(step, t, beat) {
    const { root, scale } = this.cfg;
    const sc = SCALES[scale] || SCALES.major;
    const prog = PROGRESSIONS[scale] || PROGRESSIONS.major;
    const bar = Math.floor(step / 8);
    const s = step % 8;
    const deg = prog[bar % prog.length];
    const tone = (d, oct = 0) => root + sc[(deg + d) % 7] + 12 * (Math.floor((deg + d) / 7) + oct);
    if (s === 0) {
      // seventh chord pad for the whole bar + bass
      for (const d of [0, 2, 4, 6]) this.note(tone(d), t, beat * 3.8, 0.045);
      this.note(tone(0, -2), t, beat * 1.6, 0.16, 'sine');
    }
    if (s === 4) this.note(tone(0, -2), t, beat * 1.2, 0.12, 'sine');
    if (s === 6 && bar % 2) this.note(tone(4, -2), t, beat * 0.9, 0.1, 'sine');
    // drums with a lazy swing on the off-beats
    if (s === 0 || s === 5) this.drum('kick', t);
    if (s === 2 || s === 6) this.drum('snare', t);
    this.drum('hat', t);
    // a sparse pentatonic melody
    if ((s === 0 || s === 3 || s === 6) && Math.random() < 0.38) {
      const pent = [0, 2, 4, 7, 9];
      const d = pent[Math.floor(Math.random() * pent.length)];
      this.note(root + 12 + d + (scale === 'minor' && (d === 4 || d === 9) ? -1 : 0), t, beat * (0.6 + Math.random()), 0.07, 'sine');
    }
  }

  update(dt, s) {
    const c = this.e.ctx;
    if (s.cityCfg && s.cityCfg !== this._city) {
      this._city = s.cityCfg;
      this.setCity(s.cityCfg);
    }
    // quieter indoors conversation, off when the game is not in the foreground
    this.out.gain.setTargetAtTime(s.musicOn ? (s.outside ? 0.9 : 0.75) : 0, c.currentTime, 0.6);
    if (this.file || !s.musicOn) {
      this.next = 0;
      return;
    }
    const beat = 60 / this.cfg.bpm;
    const eighth = beat / 2;
    if (!this.next || this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.1;
    while (this.next < c.currentTime + 0.25) {
      const swing = this.step % 2 ? eighth * 0.16 : 0;
      this.schedule(this.step, this.next + swing, beat);
      this.next += eighth;
      this.step++;
    }
  }
}
