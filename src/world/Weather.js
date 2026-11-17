// Weather per city and season: clear, cloudy, rain, snow (snowy-winter cities)
// and heat haze (humid cities in summer). Deterministic per day so the sim
// and the visuals always agree. Particles follow the camera.
import * as THREE from 'three';
import { mulberry32, hashStr, damp } from '../core/utils.js';
import { calendar } from '../core/Clock.js';
import { Tex } from './Textures.js';

const RAIN = 1500;
const SNOW = 1100;
const BOX = 34; // particles live in a box this wide around the camera

export const WEATHER_INFO = {
  clear: { icon: '☀️', label: 'Clear', overcast: 0, fog: 0, crowd: 1 },
  cloudy: { icon: '⛅', label: 'Cloudy', overcast: 0.45, fog: 0.05, crowd: 1 },
  rain: { icon: '🌧️', label: 'Rain', overcast: 0.85, fog: 0.4, crowd: 0.55 },
  snow: { icon: '🌨️', label: 'Snow', overcast: 0.7, fog: 0.55, crowd: 0.5 },
  haze: { icon: '🥵', label: 'Heat haze', overcast: 0.1, fog: 0.35, crowd: 0.85 },
};

/** Weather kind for a city at a given time (changes in 6-hour blocks). */
export function weatherAt(cityCfg, total) {
  const cal = calendar(total);
  const block = Math.floor((total % 1440) / 360);
  const r = mulberry32(hashStr(`${cityCfg.id}:${cal.day}:${block}`))();
  const w = cityCfg.weather || {};
  const winter = cal.seasonId === 'winter';
  const summer = cal.seasonId === 'summer';
  let p = 0;
  if (winter && w.snowInWinter) {
    p += w.snowInWinter;
    if (r < p) return 'snow';
  }
  p += (w.rain || 0) * (summer && w.haze ? 1.3 : 1) * (winter && w.snowInWinter ? 0.3 : 1);
  if (r < p) return 'rain';
  if ((summer || cal.seasonId === 'spring') && w.haze) {
    p += w.haze * (summer ? 1.2 : 0.4);
    if (r < p && block >= 1 && block <= 2) return 'haze';
  }
  return r > 1 - (1 - (w.sunny ?? 0.5)) * 0.6 ? 'cloudy' : 'clear';
}

export class Weather {
  constructor(scene, sky) {
    this.sky = sky;
    this.kind = 'clear';
    this.rainAmt = 0;
    this.snowAmt = 0;
    this.hazeAmt = 0;
    this._tint = new THREE.Color('#ffffff');
    this._haze = new THREE.Color('#ffe2b8');
    this._white = new THREE.Color('#ffffff');

    // rain: short line streaks
    this.rainPos = new Float32Array(RAIN * 6);
    this.rainSeed = new Float32Array(RAIN * 3);
    for (let i = 0; i < RAIN * 3; i++) this.rainSeed[i] = Math.random();
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b9d2ee', transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;

    // snow: soft points
    this.snowPos = new Float32Array(SNOW * 3);
    this.snowSeed = new Float32Array(SNOW * 3);
    for (let i = 0; i < SNOW * 3; i++) this.snowSeed[i] = Math.random();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.3, map: Tex.glow(), transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.rain, this.snow);
    this.t = 0;
  }

  get info() {
    return WEATHER_INFO[this.kind];
  }

  /**
   * @param cam     camera position (particles follow it)
   * @param outside false while indoors: particles hidden, sky still updated
   */
  update(dt, cityCfg, total, cam, outside) {
    this.kind = weatherAt(cityCfg, total);
    const info = WEATHER_INFO[this.kind];
    this.t += dt;
    const sky = this.sky;
    sky.overcast = damp(sky.overcast, info.overcast, 0.5, dt);
    sky.fogBoost = damp(sky.fogBoost, info.fog, 0.5, dt);
    this.rainAmt = damp(this.rainAmt, this.kind === 'rain' ? 1 : 0, 0.8, dt);
    this.snowAmt = damp(this.snowAmt, this.kind === 'snow' ? 1 : 0, 0.8, dt);
    this.hazeAmt = damp(this.hazeAmt, this.kind === 'haze' ? 1 : 0, 0.5, dt);
    sky.tint.copy(this._white).lerp(this._haze, this.hazeAmt * 0.6);

    const showRain = outside && this.rainAmt > 0.02;
    this.rain.visible = showRain;
    if (showRain) {
      this.rain.material.opacity = 0.5 * this.rainAmt;
      const p = this.rainPos;
      const s = this.rainSeed;
      const fall = this.t * 24;
      for (let i = 0; i < RAIN; i++) {
        const x = cam.x + (s[i * 3] - 0.5) * BOX;
        const z = cam.z + (s[i * 3 + 2] - 0.5) * BOX;
        // wrap each drop inside a 22 m tall column around the camera height
        const y = cam.y + 12 - ((s[i * 3 + 1] * 22 + fall) % 22);
        const o = i * 6;
        p[o] = x;
        p[o + 1] = y;
        p[o + 2] = z;
        p[o + 3] = x + 0.06;
        p[o + 4] = y - 0.7;
        p[o + 5] = z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    const showSnow = outside && this.snowAmt > 0.02;
    this.snow.visible = showSnow;
    if (showSnow) {
      this.snow.material.opacity = 0.9 * this.snowAmt;
      const p = this.snowPos;
      const s = this.snowSeed;
      const fall = this.t * 1.6;
      for (let i = 0; i < SNOW; i++) {
        const o = i * 3;
        p[o] = cam.x + (s[o] - 0.5) * BOX + Math.sin(this.t * 0.7 + s[o + 1] * 40) * 0.6;
        p[o + 1] = cam.y + 9 - ((s[o + 1] * 18 + fall) % 18);
        p[o + 2] = cam.z + (s[o + 2] - 0.5) * BOX + Math.cos(this.t * 0.5 + s[o] * 40) * 0.6;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}
