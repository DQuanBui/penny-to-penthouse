// Top-level orchestrator: owns the renderer, the city scene, the player and
// camera, and steps everything each frame.
import * as THREE from 'three';
import { Events } from './Events.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { Settings } from './Settings.js';
import { hourOf, fmtClock, fmtDate, calendar } from './Clock.js';
import { Sky } from '../world/Sky.js';
import { worldUniforms } from '../world/Buildings.js';
import { generateCity } from '../world/CityGenerator.js';
import { getCity } from '../data/cities/index.js';
import { createRig } from '../characters/CharacterFactory.js';
import { loadGLBCharacters } from '../characters/GLBCharacters.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { defaultAppearance } from '../characters/Customization.js';
import { PlayerController } from '../characters/PlayerController.js';
import { ThirdPersonCamera } from '../characters/ThirdPersonCamera.js';
import { h } from '../ui/dom.js';

const PIXEL_RATIO = { low: 0.8, medium: 1.25, high: 2 };

export class Game {
  constructor() {
    this.events = new Events();
    this.settings = new Settings(this.events);
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.fadeEl = document.getElementById('fade');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.15, 3200);
    this.sky = new Sky(this.scene);
    this.input = new Input(this.canvas);
    this.player = new PlayerController();
    this.cam = new ThirdPersonCamera(this.camera);

    // Three real lights hop between the street lamps nearest the player.
    this.lampLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffc37a', 0, 26, 1.6);
      this.scene.add(l);
      this.lampLights.push(l);
    }
    this._lampTimer = 0;

    this.city = null;
    this.timeTotal = 8 * 60; // minutes since Day 1 00:00 (replaced by sim state in phase 3)
    this.lowFpsTime = 0;

    this.fpsEl = h('div.fps.hidden');
    this.ui.append(this.fpsEl);

    this.applySettings();
    this.events.on('settings', () => this.applySettings());
    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.loop = new Loop((dt, t) => this.update(dt, t));
  }

  get quality() {
    return this.settings.get('graphics');
  }

  applySettings() {
    const s = this.settings;
    const q = s.get('graphics');
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[q] || 1));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sky.setQuality(q);
    this.cam.sensitivity = s.get('sensitivity');
    this.cam.invertY = s.get('invertY');
    this.input.cameraMode = s.get('cameraMode');
    this.fpsEl.classList.toggle('hidden', !s.get('showFps'));
    document.documentElement.style.setProperty('--ui-scale', s.get('uiScale'));
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this.creator?.onResize(w, hgt);
  }

  /** Fade to black, run fn (may be async), fade back. */
  async fade(fn) {
    this.fadeEl.classList.add('on');
    await new Promise((r) => setTimeout(r, 300));
    await fn();
    await new Promise((r) => setTimeout(r, 60));
    this.fadeEl.classList.remove('on');
  }

  loadCity(cityId) {
    if (this.city) {
      this.scene.remove(this.city.group);
      this.city.dispose();
    }
    const cfg = getCity(cityId);
    this.city = generateCity(cfg, { season: calendar(this.timeTotal).seasonId });
    this.scene.add(this.city.group);
    return this.city;
  }

  /** Put the player (with the given look) into the open city. */
  enterCity(appearance = defaultAppearance()) {
    if (this.playerRig) {
      this.scene.remove(this.playerRig.group);
      this.playerRig.dispose();
    }
    this.playerRig = createRig(appearance);
    this.scene.add(this.playerRig.group);
    const w = { colliders: this.city.colliders, groundY: this.city.groundY };
    this.player.setWorld(w);
    this.cam.setWorld(w);
    this.player.setRig(this.playerRig);
    const sp = this.city.spawn;
    this.player.teleport(sp.x, sp.z, sp.ry);
    this.cam.snapBehind(sp.ry + 1.1);
    this.input.gameplay = true;
  }

  async start() {
    this.mode = 'boot';
    this.loop.start();
    await loadGLBCharacters(); // optional models; resolves immediately when none exist
    this.loadCity('newyork');
    this.openCreator();
  }

  /** Character creator -> new life. */
  openCreator() {
    this.input.gameplay = false;
    this.creator = new CharacterCreator(this, (profile) => {
      this.fade(() => {
        this.creator.close();
        this.creator = null;
        this.profile = profile;
        this.enterCity(profile.appearance);
        if (!this.devHud) this.ui.append((this.devHud = h('div.dev-hud')));
        this.mode = 'play';
      });
    });
    this.creator.onResize(window.innerWidth, window.innerHeight);
    this.mode = 'creator';
  }

  update(dt, elapsed) {
    const input = this.input;
    if (this.mode === 'creator') {
      this.creator.update(dt);
      this.renderer.render(this.creator.scene, this.creator.camera);
      input.endFrame();
      return;
    }
    if (this.mode !== 'play') {
      input.endFrame();
      return;
    }
    // --- time ---
    const minPerSec = (1440 / (16 * 60)) * this.settings.get('timeSpeed');
    this.timeTotal += dt * minPerSec;
    if (import.meta.env.DEV) {
      if (input.pressed('BracketRight')) this.timeTotal += 60;
      if (input.pressed('BracketLeft')) this.timeTotal -= 60;
    }
    const hour = hourOf(this.timeTotal);

    // --- world ---
    this.player.update(dt, input, this.cam.yaw);
    this.cam.update(dt, input, this.player.pos);
    worldUniforms.uTime.value = elapsed;
    this.sky.update(hour, dt, this.player.pos);
    this.city.update(elapsed, this.sky.night);
    this.updateLampLights(dt);

    // --- hud ---
    if (this.devHud) {
      const d = this.city.districtAt(this.player.pos.x, this.player.pos.z);
      const text = `${fmtClock(this.timeTotal)} · ${fmtDate(this.timeTotal)} · ${d.name}`;
      if (text !== this._hudText) this.devHud.textContent = this._hudText = text;
    }
    if (this.settings.get('showFps')) this.fpsEl.textContent = Math.round(this.loop.fps) + ' FPS';

    this.autoQuality(dt);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  updateLampLights(dt) {
    this._lampTimer -= dt;
    const night = this.sky.night;
    const on = night > 0.05 && this.quality !== 'low';
    if (this._lampTimer <= 0) {
      this._lampTimer = 0.35;
      const lp = this.city.lampPositions;
      const px = this.player.pos.x;
      const pz = this.player.pos.z;
      const best = [1e9, 1e9, 1e9];
      const idx = [-1, -1, -1];
      for (let i = 0; i < lp.length; i += 2) {
        const d = (lp[i] - px) ** 2 + (lp[i + 1] - pz) ** 2;
        for (let k = 0; k < 3; k++) {
          if (d < best[k]) {
            for (let m = 2; m > k; m--) {
              best[m] = best[m - 1];
              idx[m] = idx[m - 1];
            }
            best[k] = d;
            idx[k] = i;
            break;
          }
        }
      }
      for (let k = 0; k < 3; k++) if (idx[k] >= 0) this.lampLights[k].position.set(lp[idx[k]], 5.6, lp[idx[k] + 1]);
    }
    for (const l of this.lampLights) l.intensity = on ? night * 26 : 0;
  }

  /** Drop one graphics preset if the frame rate stays low for several seconds. */
  autoQuality(dt) {
    if (!this.settings.get('autoQuality') || this.loop.elapsed < 8) return;
    if (this.loop.fps < 34) this.lowFpsTime += dt;
    else this.lowFpsTime = Math.max(0, this.lowFpsTime - dt * 2);
    if (this.lowFpsTime > 6) {
      this.lowFpsTime = 0;
      const q = this.quality;
      if (q === 'high') this.settings.set('graphics', 'medium');
      else if (q === 'medium') this.settings.set('graphics', 'low');
      if (q !== 'low') this.events.emit('toast', { icon: '⚙️', title: 'Graphics lowered', text: 'Switched to a faster preset to keep things smooth.' });
    }
  }
}
