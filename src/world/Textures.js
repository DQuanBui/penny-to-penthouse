// Procedural canvas textures (no image files needed).
import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

const cache = new Map();

function make(key, size, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function noise(g, s, base, spread, count, seed = 1, alpha = 0.5) {
  const r = mulberry32(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < count; i++) {
    const v = Math.floor(128 + (r() - 0.5) * spread);
    g.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    const w = 1 + r() * 3;
    g.fillRect(r() * s, r() * s, w, w);
  }
}

export const Tex = {
  asphalt: () => make('asphalt', 256, (g, s) => noise(g, s, '#4a4d57', 110, 5000, 3, 0.3)),
  sidewalk: () =>
    make('sidewalk', 256, (g, s) => {
      noise(g, s, '#a9a8a4', 70, 2500, 5, 0.3);
      g.strokeStyle = 'rgba(60,60,60,0.35)';
      g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo((i * s) / 4, 0);
        g.lineTo((i * s) / 4, s);
        g.moveTo(0, (i * s) / 4);
        g.lineTo(s, (i * s) / 4);
        g.stroke();
      }
    }),
  grass: () => make('grass', 256, (g, s) => noise(g, s, '#5a8f46', 120, 7000, 9, 0.45)),
  sand: () => make('sand', 256, (g, s) => noise(g, s, '#e6d3a3', 60, 5000, 11, 0.4)),
  wood: () =>
    make('wood', 256, (g, s) => {
      g.fillStyle = '#b98a5a';
      g.fillRect(0, 0, s, s);
      const r = mulberry32(21);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `rgba(${90 + r() * 40},${60 + r() * 30},${30 + r() * 20},0.25)`;
        g.fillRect(0, (i * s) / 8, s, s / 8 - 2);
        g.fillStyle = 'rgba(40,25,10,0.5)';
        g.fillRect(0, (i * s) / 8, s, 2);
        g.fillRect(r() * s, (i * s) / 8, 2, s / 8);
      }
    }),
  tile: () =>
    make('tile', 256, (g, s) => {
      g.fillStyle = '#e9e7e1';
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(120,120,120,0.5)';
      g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo((i * s) / 4, 0);
        g.lineTo((i * s) / 4, s);
        g.moveTo(0, (i * s) / 4);
        g.lineTo(s, (i * s) / 4);
        g.stroke();
      }
    }),
  carpet: () => make('carpet', 128, (g, s) => noise(g, s, '#8b8f9c', 90, 5000, 31, 0.5)),
  concrete: () => make('concrete', 256, (g, s) => noise(g, s, '#8f9094', 80, 4000, 41, 0.35)),
  /** White dashed lane line with transparent gaps (tile along V). */
  dashes: () =>
    make('dashes', 64, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.fillStyle = '#f2f2ea';
      g.fillRect(0, 0, s, s * 0.5);
    }),
  crosswalk: () =>
    make('crosswalk', 128, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.fillStyle = '#eeeee6';
      for (let i = 0; i < 4; i++) g.fillRect(i * (s / 4) + 4, 0, s / 4 - 12, s);
    }),
  /** Soft radial glow used for lamp light pools, blob shadows, markers. */
  glow: () =>
    make(
      'glow',
      128,
      (g, s) => {
        const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
      },
      { repeat: false },
    ),
  cloud: () =>
    make(
      'cloud',
      256,
      (g, s) => {
        const r = mulberry32(77);
        for (let i = 0; i < 26; i++) {
          const x = s * (0.2 + r() * 0.6);
          const y = s * (0.35 + r() * 0.3);
          const rad = s * (0.08 + r() * 0.16);
          const grd = g.createRadialGradient(x, y, 0, x, y, rad);
          grd.addColorStop(0, 'rgba(255,255,255,0.55)');
          grd.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grd;
          g.fillRect(0, 0, s, s);
        }
      },
      { repeat: false },
    ),
};

/** Text/emoji label rendered to a texture (shop signs, markers). */
export function labelTexture(text, { icon = '', bg = '#1c2233', fg = '#ffffff', accent = '#ffb347', w = 512, h = 128 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, h, 22);
  g.fill();
  g.fillStyle = accent;
  g.fillRect(0, h - 10, w, 10);
  g.textBaseline = 'middle';
  let x = 26;
  if (icon) {
    g.font = `${h * 0.56}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
    g.fillText(icon, x, h * 0.48);
    x += h * 0.78;
  }
  g.fillStyle = fg;
  let size = h * 0.42;
  g.font = `700 ${size}px Outfit,"Segoe UI",system-ui,sans-serif`;
  while (g.measureText(text).width > w - x - 20 && size > 14) {
    size -= 2;
    g.font = `700 ${size}px Outfit,"Segoe UI",system-ui,sans-serif`;
  }
  g.fillText(text, x, h * 0.48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Round emoji badge used for floating place markers. */
export function iconTexture(icon, color = '#ffb347') {
  const key = 'icon:' + icon + color;
  if (cache.has(key)) return cache.get(key);
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,20,34,0.88)';
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = color;
  g.stroke();
  g.font = `${s * 0.5}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, s / 2, s / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
