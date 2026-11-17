// Day/night cycle: gradient sky dome with sun/moon glow and stars, drifting
// clouds, fog, and the sun + hemisphere lights (with a shadow frustum that
// follows the player).
import * as THREE from 'three';
import { Tex } from './Textures.js';
import { worldUniforms } from './Buildings.js';
import { smoothstep, mulberry32 } from '../core/utils.js';

// hour, sky top, horizon, sun colour, sun intensity, hemisphere intensity
const KEYS = [
  [0, '#050816', '#0e1328', '#8fa6ff', 0.7, 1.9],
  [4.6, '#0a1030', '#1d2042', '#8fa6ff', 0.65, 1.9],
  [5.9, '#27407a', '#e8845a', '#ff9a66', 1.0, 1.5],
  [7.0, '#3d7fd6', '#ffd2a0', '#ffd9b0', 2.6, 2.1],
  [9.5, '#3a8ee6', '#c4e2f8', '#fff3de', 3.6, 2.6],
  [15.5, '#3a8ee6', '#c4e2f8', '#fff3de', 3.6, 2.6],
  [17.8, '#3c7fd4', '#ffd08a', '#ffd49a', 3.3, 2.4],
  [19.2, '#2b4590', '#ff8a4f', '#ff9450', 2.2, 2.4],
  [20.2, '#141c4a', '#a8506e', '#ff8060', 0.6, 2.1],
  [21.4, '#070b20', '#151b38', '#8fa6ff', 0.7, 1.9],
  [24, '#050816', '#0e1328', '#8fa6ff', 0.7, 1.9],
].map((k) => ({ h: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), sunI: k[4], hemiI: k[5] }));

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.night = 0;
    this.top = new THREE.Color();
    this.horizon = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    // Weather can dim the light and thicken the fog (set by Weather.js).
    this.overcast = 0;
    this.fogBoost = 0;
    this.tint = new THREE.Color('#ffffff');
    this._grey = new THREE.Color('#8a93a3');
    this._tmp = new THREE.Color();

    this.uniforms = {
      uTop: { value: this.top },
      uHorizon: { value: this.horizon },
      uSunDir: { value: this.sunDir },
      uSunColor: { value: this.sunColor },
      uStars: { value: 0 },
      uTime: worldUniforms.uTime,
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.uniforms,
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`,
        fragmentShader: `
          uniform vec3 uTop, uHorizon, uSunDir, uSunColor; uniform float uStars, uTime; varying vec3 vDir;
          float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
          void main(){
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            vec3 col = mix(uHorizon, uTop, pow(h, 0.5));
            if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.55, clamp(-d.y * 5.0, 0.0, 1.0));
            float s = max(dot(d, uSunDir), 0.0);
            col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 14.0) * 0.28 + pow(s, 3.0) * 0.08);
            if (uStars > 0.01 && d.y > 0.0) {
              vec3 sd = d * 190.0; vec3 c = floor(sd);
              float r = h13(c);
              float star = step(0.9975, r) * smoothstep(0.42, 0.0, length(fract(sd) - 0.5));
              col += vec3(0.9, 0.95, 1.0) * star * uStars * (0.6 + 0.4 * sin(uTime * 2.0 + r * 90.0)) * smoothstep(0.0, 0.25, d.y);
            }
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.dome = dome;
    this.group.add(dome);

    // Clouds: a handful of big soft sheets drifting overhead.
    this.clouds = [];
    const rng = mulberry32(99);
    const cmat = new THREE.MeshBasicMaterial({ map: Tex.cloud(), transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    this.cloudMat = cmat;
    const cgeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(cgeo, cmat);
      m.rotation.x = Math.PI / 2;
      const s = 260 + rng() * 320;
      m.scale.set(s, s * 0.6, 1);
      m.position.set((rng() - 0.5) * 2200, 300 + rng() * 120, (rng() - 0.5) * 2200);
      m.renderOrder = -9;
      this.clouds.push(m);
      this.group.add(m);
    }

    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -70;
    sc.right = sc.top = 70;
    sc.near = 10;
    sc.far = 420;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#bcd8ff', '#6b5f55', 1);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog('#c4e2f8', 120, 1100);
  }

  /** quality: 'low' | 'medium' | 'high' */
  setQuality(q) {
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    for (const c of this.clouds) c.visible = q !== 'low';
  }

  /**
   * @param hour  0..24 time of day
   * @param focus Vector3 the shadow frustum and sky dome follow
   */
  update(hour, dt, focus) {
    let i = 0;
    while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = (hour - a.h) / (b.h - a.h);
    this.top.copy(a.top).lerp(b.top, t);
    this.horizon.copy(a.hor).lerp(b.hor, t);
    this.sunColor.copy(a.sun).lerp(b.sun, t);
    let sunI = a.sunI + (b.sunI - a.sunI) * t;
    let hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;

    // night: 1 = deep night, 0 = full day
    const night = 1 - smoothstep(5.2, 6.8, hour) * (1 - smoothstep(19.3, 20.8, hour));
    this.night = night;
    worldUniforms.uNight.value = night;
    this.uniforms.uStars.value = night * (1 - this.overcast);

    // Overcast weather greys the sky and softens the sun.
    if (this.overcast > 0) {
      const g = this._tmp.copy(this._grey).multiplyScalar(1 - night * 0.85);
      this.top.lerp(g, this.overcast * 0.8);
      this.horizon.lerp(g, this.overcast * 0.7);
      sunI *= 1 - this.overcast * 0.65;
      hemiI *= 1 - this.overcast * 0.15;
    }
    this.horizon.multiply(this.tint);

    // Sun arc by day (6h -> 20h), moon arc by night.
    const day = hour >= 6 && hour < 20;
    const arc = day ? (hour - 6) / 14 : ((hour + 4) % 24) / 10;
    const th = arc * Math.PI;
    this.sunDir.set(Math.cos(th), Math.max(Math.sin(th) * 0.92, 0.05), 0.38).normalize();
    // Fade the light out around the horizon so the sun/moon swap is invisible.
    const horizonFade = smoothstep(0.02, 0.2, Math.sin(th));
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = sunI * horizonFade;

    const fx = Math.round(focus.x / 4) * 4;
    const fz = Math.round(focus.z / 4) * 4;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.sunDir.x * 200, this.sunDir.y * 200, fz + this.sunDir.z * 200);
    this.sun.target.updateMatrixWorld();

    // Ambient never goes fully black: nights are a readable deep blue.
    this.hemi.color.copy(this.top).lerp(this.horizon, 0.45).lerp(this._tmp.set('#6a7cb8'), night * 0.85);
    this.hemi.groundColor.copy(this.horizon).multiplyScalar(0.5).lerp(this._tmp.set('#3a4468'), night * 0.85);
    this.hemi.intensity = hemiI;

    const fog = this.scene.fog;
    fog.color.copy(this.horizon);
    fog.near = 120 - this.fogBoost * 100;
    fog.far = 1100 - this.fogBoost * 780;

    this.group.position.set(focus.x, 0, focus.z);
    this.cloudMat.color.copy(this.horizon).lerp(this._tmp.set('#ffffff'), (1 - night) * 0.75).multiplyScalar(1 - night * 0.7);
    this.cloudMat.opacity = 0.55 + this.overcast * 0.4;
    for (const c of this.clouds) {
      c.position.x += dt * 2.2;
      if (c.position.x > 1100) c.position.x = -1100;
    }
  }
}
