// Park furnishing (hedges, flower beds, playground, picnic tables) and the
// spots where street vendors and buskers set up: in parks, by transit
// entrances and on landmark plazas. Static geometry is merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { InstanceBatch } from './Buildings.js';

const FLOWERS = ['#e84a6a', '#f2b33d', '#f4f1ea', '#9b59d0', '#ff7a45', '#e86ab0', '#5aa0e8'];

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x = 0, y = 0, z = 0, ry = 0) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    if (ry) geo.rotateY(ry);
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
}
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cy = (r0, r1, h, x = 0, y = 0, z = 0, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s).translate(x, y, z);

/** A food cart (front faces +z), in local coordinates. */
function cartParts(bag, x, y, z, ry, color) {
  const g = (geo, c) => bag.add(geo, c, x, y, z, ry);
  g(bx(1.8, 0.95, 0.9, 0, 0.75, 0), '#f4f1ea');
  g(bx(1.82, 0.22, 0.92, 0, 0.62, 0), color);
  g(bx(1.9, 0.06, 1.0, 0, 1.25, 0), '#b9bdc3');
  g(cy(0.04, 0.04, 1.3, 0.75, 1.9, -0.3, 6), '#b9bdc3');
  g(new THREE.ConeGeometry(1.4, 0.55, 8).translate(0.75, 2.75, -0.3), color);
  for (const wx of [-0.75, 0.75]) g(cy(0.24, 0.24, 0.1, wx, 0.24, 0.47, 12).rotateX(0), '#26282d');
  g(bx(0.5, 0.18, 0.4, -0.5, 1.37, 0), '#d9d9d9');
}

export function decorateParks(ctx) {
  const { group, colliders, rng, K, blocks, places, landmarks } = ctx;
  const Y = K.CURB;
  const bag = new Bag();
  const hedges = new InstanceBatch(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#3f6f34', roughness: 1 }), { castShadow: true, receiveShadow: true });
  const flowers = new InstanceBatch(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
  const soft = new InstanceBatch(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b5583e', roughness: 1 }), { receiveShadow: true });
  ctx.vendors = [];
  ctx.buskers = [];

  for (const b of blocks) {
    if (b.kind !== 'park') continue;
    const cx = b.cx;
    const cz = b.cz;
    const h = (K.BLOCK - 4) / 2 - 0.6;
    // hedges around the edge, with gaps where the paths enter
    for (const [ax, sgn] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
      for (const seg of [-1, 1]) {
        const len = h - 2.2;
        const t = seg * (2.2 + len / 2);
        const x = ax === 'x' ? cx + sgn * h : cx + t;
        const z = ax === 'x' ? cz + t : cz + sgn * h;
        hedges.add(x, Y, z, { sx: ax === 'x' ? 0.8 : len, sy: 0.9, sz: ax === 'x' ? len : 0.8 });
        colliders.add(x - (ax === 'x' ? 0.4 : len / 2), z - (ax === 'x' ? len / 2 : 0.4), x + (ax === 'x' ? 0.4 : len / 2), z + (ax === 'x' ? len / 2 : 0.4), 0.9);
      }
    }
    // flower beds beside the paths
    for (const [dx, dz, along] of [[12, 2.1, 'x'], [-12, -2.1, 'x'], [12, -2.1, 'x'], [-12, 2.1, 'x'], [2.1, -12, 'z'], [-2.1, -12, 'z']]) {
      const x = cx + dx;
      const z = cz + dz;
      bag.add(bx(along === 'x' ? 5 : 0.9, 0.18, along === 'x' ? 0.9 : 5), '#5a4030', x, Y + 0.09, z);
      for (let k = 0; k < 12; k++) {
        const t = (k / 11 - 0.5) * 4.4;
        flowers.add(along === 'x' ? x + t : x + (rng() - 0.5) * 0.5, Y + 0.3, along === 'x' ? z + (rng() - 0.5) * 0.5 : z + t, { color: FLOWERS[Math.floor(rng() * FLOWERS.length)], sx: 1, sy: 0.8, sz: 1 });
      }
    }
    // playground (south-east quadrant)
    const px = cx + 16;
    const pz = cz + 15;
    soft.add(px, Y + 0.025, pz, { sx: 11, sz: 10 });
    // slide tower
    for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) bag.add(cy(0.06, 0.06, 2.6, ox, 1.3, oz, 6), '#2f6db5', px - 2.5, Y, pz - 1.5);
    bag.add(bx(1.4, 0.1, 1.4, 0, 1.5, 0), '#f2b33d', px - 2.5, Y, pz - 1.5);
    bag.add(new THREE.ConeGeometry(1.1, 0.8, 4).rotateY(Math.PI / 4).translate(0, 3.0, 0), '#e84a4a', px - 2.5, Y, pz - 1.5);
    bag.add(bx(0.8, 0.06, 3.0, 0, 0, 0).rotateX(0.5).translate(0, 0.8, 2.0), '#e84a4a', px - 2.5, Y, pz - 1.5);
    for (let k = 0; k < 5; k++) bag.add(bx(0.6, 0.05, 0.08, 0, 0.3 + k * 0.28, 0), '#d9d9d9', px - 2.5, Y, pz - 2.3);
    colliders.add(px - 3.3, pz - 2.3, px - 1.7, pz - 0.7, 3);
    // swings
    for (const sx of [-1.4, 1.4]) {
      bag.add(cy(0.06, 0.06, 2.6, 0, 1.2, -0.7, 6).rotateX(0.25), '#2f8f6a', px + 2.6 + sx, Y, pz + 1);
      bag.add(cy(0.06, 0.06, 2.6, 0, 1.2, 0.7, 6).rotateX(-0.25), '#2f8f6a', px + 2.6 + sx, Y, pz + 1);
    }
    bag.add(cy(0.06, 0.06, 3.0, 0, 2.45, 0, 6).rotateZ(Math.PI / 2), '#2f8f6a', px + 2.6, Y, pz + 1);
    for (const sx of [-0.6, 0.6]) {
      bag.add(bx(0.5, 0.05, 0.25, sx, 0.5, 0), '#26282d', px + 2.6, Y, pz + 1);
      bag.add(bx(0.02, 1.9, 0.02, sx - 0.22, 1.45, 0), '#9aa2ad', px + 2.6, Y, pz + 1);
      bag.add(bx(0.02, 1.9, 0.02, sx + 0.22, 1.45, 0), '#9aa2ad', px + 2.6, Y, pz + 1);
    }
    // sandbox and a spring rider
    bag.add(bx(2.6, 0.25, 2.6, 0, 0.125, 0), '#8a6a4a', px - 2.2, Y, pz + 3);
    bag.add(bx(2.3, 0.2, 2.3, 0, 0.15, 0), '#e6d3a3', px - 2.2, Y, pz + 3);
    bag.add(cy(0.08, 0.08, 0.5, 0, 0.25, 0, 6), '#9aa2ad', px + 2.8, Y, pz - 2.5);
    bag.add(new THREE.SphereGeometry(0.32, 10, 8).scale(0.7, 0.8, 1.2).translate(0, 0.75, 0), '#f2b33d', px + 2.8, Y, pz - 2.5);
    // picnic tables (south-west quadrant)
    for (const [dx, dz] of [[-13, 12], [-18, 16], [-13, 19]]) {
      const x = cx + dx;
      const z = cz + dz;
      bag.add(bx(1.9, 0.07, 0.8, 0, 0.75, 0), '#8a6a4a', x, Y, z);
      for (const sz of [-0.65, 0.65]) bag.add(bx(1.9, 0.06, 0.3, 0, 0.45, sz), '#7a5a3c', x, Y, z);
      for (const sx of [-0.75, 0.75]) bag.add(bx(0.08, 0.75, 1.5, sx, 0.37, 0), '#5a4030', x, Y, z);
      colliders.add(x - 1, z - 0.8, x + 1, z + 0.8, 0.8);
      ctx.benchSpots?.push({ x, z: z + 0.65, ry: Math.PI });
    }
    // a food cart by the fountain and a busker on the north path
    cartParts(bag, cx + 8, Y, cz - 2.3, 0, '#e84a4a');
    colliders.add(cx + 7, cz - 2.8, cx + 9, cz - 1.8, 1.3);
    ctx.vendors.push({ x: cx + 8, z: cz - 2.3, ry: 0, kind: 'cart', id: `cart_${b.i}_${b.j}` });
    ctx.buskers.push({ x: cx - 2.9, z: cz - 10, ry: Math.PI / 2, id: `busk_${b.i}_${b.j}` });
  }

  // carts outside transit entrances, buskers on landmark plazas
  for (const p of places) {
    if (!p.station) continue;
    const tx = p.nz;
    const tz = -p.nx;
    const x = p.doorX - tx * 7 - p.nx * 0.4;
    const z = p.doorZ - tz * 7 - p.nz * 0.4;
    const ry = Math.atan2(-p.nx, -p.nz);
    cartParts(bag, x, Y, z, ry, '#2f6db5');
    colliders.add(x - 1, z - 1, x + 1, z + 1, 1.3);
    ctx.vendors.push({ x, z, ry, kind: 'cart', id: 'cart_' + p.id });
  }
  for (const lm of landmarks || []) ctx.buskers.push({ x: lm.x + 19, z: lm.z + 19, ry: -Math.PI * 0.75, id: 'busk_' + lm.name });

  const mats = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  if (bag.list.length) {
    const mesh = new THREE.Mesh(mergeGeometries(bag.list), mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const m of [hedges.build(), flowers.build(), soft.build()]) if (m) group.add(m);
}
