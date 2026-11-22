// Fireworks over the water (or the biggest park) on Friday and Saturday nights,
// 9 to 10 PM: rockets trail up, burst into coloured spheres of sparks that fall
// and fade, with a boom that arrives a little after the flash.
import * as THREE from 'three';
import { hourOf } from '../core/Clock.js';

const SPARKS = 140;
const COLORS = ['#ff4f6a', '#ffd23f', '#4fd8ff', '#7cff6b', '#c77dff', '#ff9a3c', '#ffffff'];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Fireworks {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.bursts = [];
    this.nextT = 0;
    this.tex = glowTexture();
    this.announcedDay = -1;
  }

  setCity(city) {
    this.clear();
    this.city = city;
    // over the harbor beside the bridge, else above the most central park
    const b = city.bridge;
    if (b) this.origin = new THREE.Vector3(b.mid.x, 0, b.mid.z);
    else {
      const park = [...city.blocks.filter((q) => q.kind === 'park')].sort((p, q) => Math.hypot(p.cx, p.cz) - Math.hypot(q.cx, q.cz))[0];
      this.origin = park ? new THREE.Vector3(park.cx, 0, park.cz) : new THREE.Vector3(0, 0, 0);
    }
    this.game.scene.add(this.group);
  }

  clear() {
    for (const b of this.bursts) {
      b.points.geometry.dispose();
      b.points.material.dispose();
    }
    this.bursts = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  /** Is tonight a show night, and is it on right now? */
  live() {
    const st = this.game.state;
    if (!st) return false;
    const day = Math.floor(st.time.total / 1440);
    const wd = day % 7; // 0 Monday
    const hr = hourOf(st.time.total);
    return (wd === 4 || wd === 5 || this.forced) && hr >= 21 && hr < 22 && this.game.weather.kind !== 'rain';
  }

  launch() {
    const o = this.origin;
    const color = new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]);
    const c2 = new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]);
    const at = new THREE.Vector3(o.x + (Math.random() - 0.5) * 90, 55 + Math.random() * 35, o.z + (Math.random() - 0.5) * 60);
    const pos = new Float32Array(SPARKS * 3);
    const col = new Float32Array(SPARKS * 3);
    const vel = new Float32Array(SPARKS * 3);
    const speed = 24 + Math.random() * 10;
    for (let i = 0; i < SPARKS; i++) {
      // an even sphere of directions
      const y = 1 - (i / (SPARKS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.39996;
      vel.set([Math.cos(th) * r * speed, y * speed, Math.sin(th) * r * speed], i * 3);
      pos.set([0, 0, 0], i * 3);
      const cc = i % 3 ? color : c2;
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 6.5, map: this.tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const points = new THREE.Points(geo, mat);
    points.position.copy(at);
    points.frustumCulled = false;
    points.visible = false;
    this.group.add(points);
    // the rocket climbing first, then the burst
    const trail = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    trail.position.set(at.x, 0, at.z);
    this.group.add(trail);
    this.bursts.push({ points, vel, t: -1.4, trail, at, boomed: false });
  }

  update(dt, playerPos, inside) {
    if (!this.city) return;
    const on = this.live() && !inside;
    this.group.visible = !inside;
    if (on) {
      const day = Math.floor(this.game.state.time.total / 1440);
      if (this.announcedDay !== day) {
        this.announcedDay = day;
        this.game.events.emit('toast', { icon: '🎆', title: 'Fireworks tonight!', text: this.city.bridge ? 'Over the harbor by the bridge, 9 to 10 PM. Find a spot by the water.' : 'Above the park in the middle of town, 9 to 10 PM.', kind: 'good' });
      }
      this.nextT -= dt;
      if (this.nextT <= 0) {
        this.nextT = 0.5 + Math.random() * 1.2;
        this.launch();
      }
    }
    for (let k = this.bursts.length - 1; k >= 0; k--) {
      const b = this.bursts[k];
      b.t += dt;
      if (b.t < 0) {
        // climbing
        const f = 1 + b.t / 1.4;
        b.trail.position.y = b.at.y * f;
        continue;
      }
      if (b.trail.parent) {
        b.trail.removeFromParent();
        b.trail.geometry.dispose();
        b.points.visible = true;
      }
      const pos = b.points.geometry.attributes.position;
      const drag = Math.exp(-1.15 * dt);
      for (let i = 0; i < SPARKS; i++) {
        b.vel[i * 3] *= drag;
        b.vel[i * 3 + 1] = b.vel[i * 3 + 1] * drag - 4.5 * dt;
        b.vel[i * 3 + 2] *= drag;
        pos.array[i * 3] += b.vel[i * 3] * dt;
        pos.array[i * 3 + 1] += b.vel[i * 3 + 1] * dt;
        pos.array[i * 3 + 2] += b.vel[i * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
      b.points.material.opacity = Math.max(0, 1 - b.t / 2.6);
      // the boom arrives after the flash (sound is slower than light)
      const dist = b.at.distanceTo(playerPos);
      if (!b.boomed && b.t > dist / 340) {
        b.boomed = true;
        if (dist < 600) this.game.audio?.play('boom');
      }
      if (b.t > 2.8) {
        this.group.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(k, 1);
      }
    }
  }
}
