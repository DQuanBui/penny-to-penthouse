// Small pure helpers shared by engine and simulation code (no DOM / three.js here,
// so the headless balance simulation can import this file in Node).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing. */
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Shortest-path angle interpolation (radians). */
export function dampAngle(a, b, lambda, dt) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/** Deterministic PRNG (mulberry32). Returns a function producing [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
export const rand = (rng, a, b) => a + (b - a) * rng();
export const randInt = (rng, a, b) => Math.floor(rand(rng, a, b + 1));

export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** $1,234 / -$1,234 / $1.2M style money formatting. */
export function fmtMoney(n, opts = {}) {
  const neg = n < 0;
  const v = Math.abs(n);
  let s;
  if (opts.compact && v >= 1e9) s = (v / 1e9).toFixed(2) + 'B';
  else if (opts.compact && v >= 1e6) s = (v / 1e6).toFixed(2) + 'M';
  else if (opts.compact && v >= 1e4) s = (v / 1e3).toFixed(1) + 'K';
  else s = Math.round(v).toLocaleString('en-US');
  return (neg ? '-$' : '$') + s;
}

export function fmtNum(n) {
  const v = Math.abs(n);
  if (v >= 1e6) return (n / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M';
  if (v >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('en-US');
}

export const uid = () => Math.random().toString(36).slice(2, 10);
