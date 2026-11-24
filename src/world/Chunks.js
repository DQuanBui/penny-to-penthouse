// One pass at the end of city generation that makes the static city cheap to
// draw: anything merged or instanced across the whole map (trees, lamps,
// storefront details, fire escapes, rooftop units...) is split into ~200 m
// tiles, so the camera and the shadow map only draw the tiles they can see.
// Every tile, sign and floating icon is also registered for distance culling
// (city.update hides things far from the player).
import * as THREE from 'three';

const TILE = 200;
const BIG = 250; // bounding radius above which a mesh gets split

const _m = new THREE.Matrix4();
const cellOf = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;

/** Split an InstancedMesh into one InstancedMesh per tile. */
function splitInstanced(mesh) {
  const n = mesh.count;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const cells = new Map();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    p.setFromMatrixPosition(m);
    const k = cellOf(p.x, p.z);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(i);
  }
  if (cells.size < 2) return null;
  const base = mesh.geometry;
  const inst = Object.entries(base.attributes).filter(([, a]) => a.isInstancedBufferAttribute);
  const out = [];
  for (const ids of cells.values()) {
    let geo = base;
    if (inst.length) {
      // per-instance attributes live on the geometry: give each tile its own slice
      geo = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(base.attributes)) if (!a.isInstancedBufferAttribute) geo.setAttribute(name, a);
      if (base.index) geo.setIndex(base.index);
      for (const [name, a] of inst) {
        const arr = new a.array.constructor(ids.length * a.itemSize);
        ids.forEach((id, j) => {
          for (let c = 0; c < a.itemSize; c++) arr[j * a.itemSize + c] = a.array[id * a.itemSize + c];
        });
        geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, a.itemSize));
      }
    }
    const t = new THREE.InstancedMesh(geo, mesh.material, ids.length);
    const c = new THREE.Color();
    ids.forEach((id, j) => {
      mesh.getMatrixAt(id, m);
      t.setMatrixAt(j, m);
      if (mesh.instanceColor) {
        mesh.getColorAt(id, c);
        t.setColorAt(j, c);
      }
    });
    t.castShadow = mesh.castShadow;
    t.receiveShadow = mesh.receiveShadow;
    t.renderOrder = mesh.renderOrder;
    t.frustumCulled = true;
    t.computeBoundingSphere();
    out.push(t);
  }
  return out;
}

/** Split a big merged Mesh by triangle into one Mesh per tile. */
function splitMerged(mesh) {
  let geo = mesh.geometry;
  if (geo.index) geo = geo.toNonIndexed();
  const pos = geo.attributes.position;
  const tris = pos.count / 3;
  const cellTris = new Map();
  for (let t = 0; t < tris; t++) {
    const i = t * 3;
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const k = cellOf(x, z);
    if (!cellTris.has(k)) cellTris.set(k, []);
    cellTris.get(k).push(t);
  }
  if (cellTris.size < 2) return null;
  const out = [];
  for (const list of cellTris.values()) {
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(geo.attributes)) {
      const s = a.itemSize;
      const arr = new a.array.constructor(list.length * 3 * s);
      let o = 0;
      for (const t of list) {
        const from = t * 3 * s;
        for (let c = 0; c < 3 * s; c++) arr[o++] = a.array[from + c];
      }
      g.setAttribute(name, new THREE.BufferAttribute(arr, s, a.normalized));
    }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mesh.material);
    m.castShadow = mesh.castShadow;
    m.receiveShadow = mesh.receiveShadow;
    m.renderOrder = mesh.renderOrder;
    out.push(m);
  }
  if (geo !== mesh.geometry) geo.dispose();
  return out;
}

export function chunkCity(ctx) {
  const group = ctx.group;
  const lod = (ctx.lod ||= []);
  const inLod = new Set(lod.map((l) => l.mesh));
  const stats = { split: 0, tiles: 0, culled: 0 };
  for (const o of [...group.children]) {
    if (inLod.has(o) || o.renderOrder < 0) continue;
    if (o.isSprite) {
      lod.push({ mesh: o, x: o.position.x, z: o.position.z, r: 10, small: true });
      stats.culled++;
      continue;
    }
    if (!o.isMesh || Array.isArray(o.material) || !o.geometry) continue;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    let bs = o.geometry.boundingSphere;
    if (o.isInstancedMesh) {
      o.computeBoundingSphere();
      bs = o.boundingSphere;
    }
    if (!bs) continue;
    const r = bs.radius;
    if (r > BIG) {
      const parts = o.isInstancedMesh ? splitInstanced(o) : o.position.lengthSq() === 0 && o.rotation.y === 0 ? splitMerged(o) : null;
      if (!parts) continue;
      group.remove(o);
      if (!o.isInstancedMesh) o.geometry.dispose();
      for (const t of parts) {
        group.add(t);
        const s = t.isInstancedMesh ? t.boundingSphere : t.geometry.boundingSphere;
        lod.push({ mesh: t, x: s.center.x, z: s.center.z, r: s.radius });
      }
      stats.split++;
      stats.tiles += parts.length;
    } else if (r < 25) {
      // a small static thing (a sign, a logo): hide it when far away
      const c = bs.center.clone().applyMatrix4(_m.compose(o.position, o.quaternion, o.scale));
      lod.push({ mesh: o, x: c.x, z: c.z, r: Math.max(6, r), small: true });
      stats.culled++;
    }
  }
  return stats;
}
