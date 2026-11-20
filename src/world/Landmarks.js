// Stylized, landmark-INSPIRED set pieces (not replicas). Each type is a small
// builder; cities reference them by `type` in their data file, so new cities
// can reuse them freely.
import * as THREE from 'three';
import { FACADE } from './Buildings.js';
import { timesSquare, adTextures } from './TimesSquare.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

export function buildLandmarks(ctx) {
  ctx.landmarks = [];
  ctx.animated = [];
  for (const b of ctx.blocks) {
    if (b.kind !== 'landmark') continue;
    const lm = b.landmark;
    const build = BUILDERS[lm.type] || BUILDERS.spire_tower;
    const g = new THREE.Group();
    g.position.set(b.cx, ctx.K.CURB, b.cz);
    ctx.group.add(g);
    // helpers bound to this block
    const T = {
      ctx,
      b,
      g,
      /** building-shader box (windows, night lights) centred on the block + offset */
      box: (dx, dz, w, d, h, color, type = FACADE.MASONRY, y0 = 0, solid = true) => {
        ctx.batch.add(b.cx + dx, b.cz + dz, w, d, h, color, { floorH: 3.8, bay: 2.6, seed: dx + dz + h, type }, y0);
        if (solid && y0 < 3) ctx.colliders.add(b.cx + dx - w / 2, b.cz + dz - d / 2, b.cx + dx + w / 2, b.cz + dz + d / 2, y0 + h);
      },
      mesh: (geo, mat, x = 0, y = 0, z = 0, shadow = true) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = shadow;
        g.add(m);
        return m;
      },
      solid: (dx, dz, w, d, h = 50) => ctx.colliders.add(b.cx + dx - w / 2, b.cz + dz - d / 2, b.cx + dx + w / 2, b.cz + dz + d / 2, h),
    };
    // plaza paving
    const plaza = T.mesh(new THREE.PlaneGeometry(ctx.K.BLOCK - 8, ctx.K.BLOCK - 8).rotateX(-Math.PI / 2), std('#d8cfbf', { roughness: 0.9 }), 0, 0.012, 0, false);
    plaza.receiveShadow = true;
    build(T);
    ctx.landmarks.push({ name: lm.name, type: lm.type, x: b.cx, z: b.cz, district: b.district });
  }
}

const BUILDERS = {
  /** A ballpark: tiered stands in an L, the diamond, light towers and a video scoreboard. */
  ballpark(T) {
    const { b } = T;
    const wall = '#b9b2a6';
    // the outer walls on all four streets (a gate gap on the south side)
    T.box(0, -23.5, 48, 2, 13, wall, FACADE.MASONRY);
    T.box(-23.5, 0, 2, 45, 13, wall, FACADE.MASONRY);
    T.box(23.5, 0, 2, 45, 7, wall, FACADE.MASONRY);
    T.box(-14.5, 23.5, 19, 2, 13, wall, FACADE.MASONRY);
    T.box(14.5, 23.5, 19, 2, 13, wall, FACADE.MASONRY);
    // the field: grass, an infield square (a diamond seen from home plate), bases, the mound
    const grassMat = std('#4f8f3f', { roughness: 1 });
    T.mesh(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), grassMat, 0, 0.03, 0, false).receiveShadow = true;
    const s = 12;
    const H = [-9, 9];
    const mid = [H[0] + s / 2, H[1] - s / 2];
    const dirt = std('#b98a5a', { roughness: 1 });
    T.mesh(new THREE.PlaneGeometry(s + 2, s + 2).rotateX(-Math.PI / 2), dirt, mid[0], 0.04, mid[1], false).receiveShadow = true;
    T.mesh(new THREE.PlaneGeometry(s - 4, s - 4).rotateX(-Math.PI / 2), grassMat, mid[0], 0.05, mid[1], false);
    T.mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.25, 16), dirt, mid[0], 0.12, mid[1], false);
    const white = std('#f4f4f2');
    for (const [x, z] of [[0, 0], [s, 0], [s, -s], [0, -s]]) T.mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), white, H[0] + x, 0.08, H[1] + z, false);
    // foul lines out to the walls
    T.mesh(new THREE.BoxGeometry(31, 0.02, 0.12), white, H[0] + 15.5, 0.06, H[1], false);
    T.mesh(new THREE.BoxGeometry(0.12, 0.02, 31), white, H[0], 0.06, H[1] - 15.5, false);
    // stands rising in tiers behind home plate (the west and south sides)
    const seats = [std('#3264b0', { roughness: 0.7 }), std('#26508f', { roughness: 0.7 }), std('#9aa2ad', { roughness: 0.8 })];
    for (let r = 0; r < 6; r++) {
      const h = 1.2 + r * 1.6;
      const seat = seats[r === 3 ? 2 : r % 2]; // a concourse walkway part way up
      T.mesh(new THREE.BoxGeometry(1.7, h, 44), seat, -12.2 - r * 1.6, h / 2, 0);
      T.mesh(new THREE.BoxGeometry(44, h, 1.7), seat, 0, h / 2, 12.2 + r * 1.6);
    }
    T.solid(-17.5, 0, 10, 45, 12);
    T.solid(0, 17.5, 45, 10, 12);
    // light towers and the video scoreboard over the outfield
    const steel = std('#5a6068', { metalness: 0.6, roughness: 0.4 });
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff6d8', toneMapped: false });
    for (const [x, z] of [[-21, -21], [21, -21], [21, 21], [-21, 21]]) {
      T.mesh(new THREE.CylinderGeometry(0.35, 0.5, 30, 8), steel, x, 15, z);
      const panel = T.mesh(new THREE.BoxGeometry(5, 3, 0.4), steel, x, 31, z);
      panel.lookAt(b.cx, 0, b.cz);
      const glow = T.mesh(new THREE.BoxGeometry(4.6, 2.6, 0.1), lamp, x * 0.985, 31, z * 0.985, false);
      glow.lookAt(b.cx, 0, b.cz);
    }
    const yaw = Math.atan2(-15, 21) + Math.PI; // facing home plate
    const board = T.mesh(new THREE.BoxGeometry(14, 7, 1), steel, 15, 15, -20);
    board.rotation.y = yaw;
    const scr = T.mesh(new THREE.PlaneGeometry(13, 6), new THREE.MeshBasicMaterial({ map: adTextures()[2], toneMapped: false }), 15 - Math.sin(yaw) * 0.52, 15, -20 - Math.cos(yaw) * 0.52, false);
    scr.rotation.y = yaw + Math.PI;
    for (const x of [-4, 4]) T.mesh(new THREE.BoxGeometry(0.6, 12, 0.6), steel, 15 + x * Math.cos(yaw), 6, -20 - x * Math.sin(yaw));
  },
  /** Times Square: billboard towers, tickers, the red steps. */
  times_square: timesSquare,
  /** Art-deco stepped tower with a needle. */
  spire_tower(T) {
    const c = '#cbb89a';
    T.box(0, 0, 34, 34, 70, c);
    T.box(0, 0, 26, 26, 70, c, FACADE.MASONRY, 70);
    T.box(0, 0, 18, 18, 50, c, FACADE.MASONRY, 140);
    T.box(0, 0, 10, 10, 22, c, FACADE.MASONRY, 190);
    T.mesh(new THREE.ConeGeometry(4, 22, 8), std('#b9c2cc', { metalness: 0.7, roughness: 0.3 }), 0, 223, 0);
    T.mesh(new THREE.CylinderGeometry(0.25, 0.4, 30, 6), std('#d8dee6', { metalness: 0.8, roughness: 0.3 }), 0, 247, 0);
  },
  /** Tapering glass tower. */
  glass_obelisk(T) {
    let y = 0;
    for (let i = 0; i < 7; i++) {
      const w = 34 - i * 3.4;
      const h = 30;
      T.box(0, 0, w, w, h, '#86b4d8', FACADE.GLASS, y);
      y += h;
    }
    T.mesh(new THREE.CylinderGeometry(0.3, 0.6, 36, 6), std('#e6ecf2', { metalness: 0.8, roughness: 0.3 }), 0, y + 18, 0);
  },
  /** Dark tapered tower with twin antennas. */
  black_tower(T) {
    const c = '#3a3f48';
    T.box(0, 0, 36, 36, 90, c, FACADE.GLASS);
    T.box(-4, 0, 28, 30, 60, c, FACADE.GLASS, 90);
    T.box(-4, -3, 20, 22, 50, c, FACADE.GLASS, 150);
    const m = std('#e8e8ea', { metalness: 0.6, roughness: 0.4 });
    T.mesh(new THREE.CylinderGeometry(0.3, 0.5, 40, 6), m, -8, 220, -3);
    T.mesh(new THREE.CylinderGeometry(0.3, 0.5, 40, 6), m, 0, 220, -3);
  },
  /** Glass tower with a pointed crown. */
  crown_tower(T) {
    T.box(0, 0, 30, 30, 110, '#9cc4e0', FACADE.GLASS);
    T.box(0, 0, 24, 24, 24, '#9cc4e0', FACADE.GLASS, 110);
    const crown = T.mesh(new THREE.ConeGeometry(17, 34, 4), std('#bfe0f2', { metalness: 0.5, roughness: 0.2 }), 0, 151, 0);
    crown.rotation.y = Math.PI / 4;
  },
  /** Monumental stone arch in a plaza — walk right through it. */
  grand_arch(T) {
    const stone = std('#e2d8c4', { roughness: 0.85 });
    T.mesh(new THREE.BoxGeometry(5, 18, 7), stone, -7.5, 9, 0);
    T.mesh(new THREE.BoxGeometry(5, 18, 7), stone, 7.5, 9, 0);
    T.mesh(new THREE.BoxGeometry(20, 6, 7), stone, 0, 21, 0);
    T.mesh(new THREE.BoxGeometry(22, 1, 8), stone, 0, 24.5, 0);
    T.solid(-7.5, 0, 5, 7);
    T.solid(7.5, 0, 5, 7);
  },
  /** Suspension-bridge style gateway: two towers with swooping cables. */
  arch_bridge(T) {
    const stone = std('#a89684', { roughness: 0.9 });
    const cable = std('#3a3f48', { metalness: 0.6, roughness: 0.4 });
    for (const x of [-16, 16]) {
      T.mesh(new THREE.BoxGeometry(6, 34, 8), stone, x, 17, 0);
      T.mesh(new THREE.BoxGeometry(7, 2, 9), stone, x, 35, 0);
      T.solid(x, 0, 6, 8);
    }
    T.mesh(new THREE.BoxGeometry(44, 1.2, 9), std('#6b6f78'), 0, 9, 0);
    for (const z of [-3.6, 3.6]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-16, 34, z), new THREE.Vector3(0, 8, z), new THREE.Vector3(16, 34, z));
      T.mesh(new THREE.TubeGeometry(curve, 20, 0.22, 6), cable);
      for (let i = 1; i < 10; i++) {
        const p = curve.getPoint(i / 10);
        T.mesh(new THREE.CylinderGeometry(0.06, 0.06, p.y - 9.6, 4), cable, p.x, (p.y + 9.6) / 2, z, false);
      }
    }
  },
  /** Domed civic building. */
  dome_capitol(T) {
    const c = '#d9a58a';
    T.box(0, 0, 44, 22, 14, c);
    T.box(0, 0, 18, 26, 18, c);
    const stone = std(c, { roughness: 0.8 });
    T.mesh(new THREE.CylinderGeometry(8, 8.5, 12, 20), stone, 0, 24, 0);
    T.mesh(new THREE.SphereGeometry(8.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 30, 0);
    T.mesh(new THREE.CylinderGeometry(1.4, 1.6, 5, 10), stone, 0, 40.5, 0);
    T.mesh(new THREE.SphereGeometry(0.9, 10, 8), std('#f2c94c', { metalness: 0.8, roughness: 0.3 }), 0, 43.8, 0);
  },
  /** Hilltop-style observatory with three domes. */
  observatory(T) {
    T.box(0, 0, 40, 16, 9, '#f2eee6', FACADE.MASONRY);
    const white = std('#f4f1ea', { roughness: 0.7 });
    const copper = std('#4a7a6a', { roughness: 0.5, metalness: 0.4 });
    for (const [x, r] of [
      [-15, 5],
      [0, 7.5],
      [15, 5],
    ]) {
      T.mesh(new THREE.CylinderGeometry(r, r, 4, 20), white, x, 11, 0);
      T.mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper, x, 13, 0);
    }
  },
  /** Round stacked-disc tower with a needle. */
  disc_tower(T) {
    const white = std('#f0ece4', { roughness: 0.6 });
    for (let i = 0; i < 13; i++) {
      T.mesh(new THREE.CylinderGeometry(12, 12, 0.5, 28), white, 0, 5 + i * 3.6, 0);
      T.mesh(new THREE.CylinderGeometry(10.6, 10.6, 3.1, 28), std('#39485c', { roughness: 0.25, metalness: 0.3 }), 0, 6.8 + i * 3.6, 0, false);
    }
    T.mesh(new THREE.CylinderGeometry(10.8, 10.8, 5, 28), white, 0, 2.5, 0);
    T.mesh(new THREE.ConeGeometry(1.2, 22, 8), white, 0, 63, 0);
    T.solid(0, 0, 21, 21);
  },
  /** Pastel art-deco hotel with a vertical fin sign. */
  deco_hotel(T) {
    T.box(0, 0, 40, 20, 30, '#f7c6c0', FACADE.BALCONY);
    T.box(0, 0, 16, 22, 40, '#bfe3d6', FACADE.BALCONY);
    T.mesh(new THREE.BoxGeometry(1.2, 22, 5), std('#ff6fa8', { emissive: '#ff3f8a', emissiveIntensity: 0.9 }), 0, 46, 11.2);
    for (const y of [10, 20, 30]) T.mesh(new THREE.BoxGeometry(40.6, 0.5, 20.6), std('#ffffff'), 0, y, 0, false);
  },
  /** Striped lighthouse. */
  lighthouse(T) {
    const white = std('#f5f2ea');
    const red = std('#d9534f');
    for (let i = 0; i < 6; i++) {
      const r0 = 4.6 - i * 0.45;
      T.mesh(new THREE.CylinderGeometry(r0 - 0.45, r0, 5, 16), i % 2 ? red : white, 0, 2.5 + i * 5, 0);
    }
    T.mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 16), std('#2b2f38'), 0, 30.2, 0);
    T.mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 12), std('#fff3b0', { emissive: '#ffe680', emissiveIntensity: 1.5 }), 0, 31.9, 0, false);
    T.mesh(new THREE.ConeGeometry(2.2, 2.4, 12), red, 0, 34.6, 0);
    T.solid(0, 0, 9, 9);
  },
  /** Slowly turning observation wheel. */
  ferris_wheel(T) {
    const steel = std('#e8ecf0', { metalness: 0.5, roughness: 0.4 });
    const wheel = new THREE.Group();
    wheel.position.set(0, 26, 0);
    T.g.add(wheel);
    const R = 22;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, 48), steel);
    rim.castShadow = true;
    wheel.add(rim);
    const colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#b983ff', '#ff9f45'];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, R, 4), steel);
      spoke.position.set((Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, 0);
      spoke.rotation.z = a - Math.PI / 2;
      wheel.add(spoke);
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), std(colors[i % colors.length]));
      car.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(car);
    }
    for (const x of [-9, 9]) {
      const leg = T.mesh(new THREE.CylinderGeometry(0.5, 0.7, 29, 6), steel, x / 2, 13, 0);
      leg.rotation.z = x > 0 ? 0.33 : -0.33;
      T.solid(x, 0, 2, 2);
    }
    T.ctx.animated.push((t) => {
      wheel.rotation.z = t * 0.08;
    });
  },
  /** Mirror-polished sculpture in a plaza. */
  mirror_sculpture(T) {
    const m = T.mesh(new THREE.SphereGeometry(7, 32, 20), std('#dfe6ee', { metalness: 0.7, roughness: 0.22 }), 0, 5.2, 0);
    m.scale.set(1.6, 0.75, 1);
    T.solid(0, 0, 20, 12, 10);
  },
};
