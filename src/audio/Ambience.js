// City sound bed: traffic hum, distant horns, birds by day, a muffled
// nightlife pulse after dark, rain — and a quieter room tone indoors.

export class Ambience {
  constructor(engine) {
    this.e = engine;
    const c = engine.ctx;
    // traffic hum: looped noise through a low filter
    this.hum = c.createGain();
    this.hum.gain.value = 0;
    const src = c.createBufferSource();
    src.buffer = engine.noise();
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    src.connect(lp).connect(this.hum).connect(engine.ambGain);
    src.start();
    // rain: brighter noise
    this.rain = c.createGain();
    this.rain.gain.value = 0;
    const r = c.createBufferSource();
    r.buffer = engine.noise();
    r.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    r.connect(hp).connect(this.rain).connect(engine.ambGain);
    r.start(0, 0.7);
    this.birdT = 2;
    this.hornT = 12;
    this.beatT = 0;
  }

  update(dt, s) {
    const e = this.e;
    const c = e.ctx;
    const t = c.currentTime;
    const out = s.active && s.outside;
    const day = 1 - s.night;
    this.hum.gain.setTargetAtTime(!s.active ? 0.02 : out ? 0.05 + 0.05 * day + (s.driving ? 0.06 : 0) : 0.012, t, 0.4);
    this.rain.gain.setTargetAtTime(s.active && s.weather === 'storm' ? (out ? 0.11 : 0.03) : s.weather === 'rain' ? (out ? 0.07 : 0.018) : 0, t, 0.8);
    if (!out) return;

    // birds: short chirps in the daytime when it is dry
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 1.5 + Math.random() * 5;
      if (day > 0.6 && s.weather !== 'rain' && s.weather !== 'storm' && s.weather !== 'snow') {
        const n = 2 + Math.floor(Math.random() * 3);
        const base = 2600 + Math.random() * 1800;
        for (let i = 0; i < n; i++) e.tone(e.ambGain, { f: base * (1 + Math.random() * 0.2), f2: base * (0.75 + Math.random() * 0.6), t: i * 0.11, dur: 0.08, gain: 0.035 });
      }
    }
    // a distant horn now and then
    this.hornT -= dt;
    if (this.hornT <= 0) {
      this.hornT = 18 + Math.random() * 40;
      if (day > 0.3) {
        e.tone(e.ambGain, { type: 'triangle', f: 392, dur: 0.45, gain: 0.03, attack: 0.03 });
        e.tone(e.ambGain, { type: 'triangle', f: 494, dur: 0.45, gain: 0.025, attack: 0.03 });
      }
    }
    // nightlife: a club bass line heard through walls
    if (s.night > 0.6) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT = 0.5;
        e.tone(e.ambGain, { f: 70, f2: 44, dur: 0.22, gain: 0.05 });
      }
    }
  }
}
