// Simple custom collision: axis-aligned boxes in a spatial hash, tested against
// the player's capsule (treated as a circle in XZ with a vertical extent).

export class ColliderWorld {
  constructor(cell = 16) {
    this.cell = cell;
    this.map = new Map();
    this.boxes = [];
    // World bounds the player can never leave.
    this.bounds = { minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 };
  }

  _key(cx, cz) {
    return (cx + 2048) * 4096 + (cz + 2048);
  }

  /** Add a box. y0..y1 is its vertical extent (defaults to a tall wall). */
  add(minX, minZ, maxX, maxZ, y1 = 1000, y0 = -1) {
    const box = { minX, minZ, maxX, maxZ, y0, y1 };
    this.boxes.push(box);
    const c = this.cell;
    for (let cx = Math.floor(minX / c); cx <= Math.floor(maxX / c); cx++) {
      for (let cz = Math.floor(minZ / c); cz <= Math.floor(maxZ / c); cz++) {
        const k = this._key(cx, cz);
        let list = this.map.get(k);
        if (!list) this.map.set(k, (list = []));
        list.push(box);
      }
    }
    return box;
  }

  remove(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    for (const list of this.map.values()) {
      const j = list.indexOf(box);
      if (j >= 0) list.splice(j, 1);
    }
  }

  /**
   * Push a circle (pos.x,pos.z,radius) out of every overlapping box whose
   * vertical range intersects [y, y+height]. Mutates pos. Returns true on contact.
   */
  resolve(pos, radius, y = 0, height = 1.7) {
    let hit = false;
    const c = this.cell;
    for (let pass = 0; pass < 2; pass++) {
      const cx0 = Math.floor((pos.x - radius) / c);
      const cx1 = Math.floor((pos.x + radius) / c);
      const cz0 = Math.floor((pos.z - radius) / c);
      const cz1 = Math.floor((pos.z + radius) / c);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const list = this.map.get(this._key(cx, cz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (y >= b.y1 - 0.02 || y + height <= b.y0) continue;
            const nx = pos.x < b.minX ? b.minX : pos.x > b.maxX ? b.maxX : pos.x;
            const nz = pos.z < b.minZ ? b.minZ : pos.z > b.maxZ ? b.maxZ : pos.z;
            let dx = pos.x - nx;
            let dz = pos.z - nz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= radius * radius) continue;
            hit = true;
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              const push = radius - d;
              pos.x += (dx / d) * push;
              pos.z += (dz / d) * push;
            } else {
              // Centre is inside the box: exit through the nearest face.
              const l = pos.x - b.minX;
              const r = b.maxX - pos.x;
              const t = pos.z - b.minZ;
              const bt = b.maxZ - pos.z;
              const m = Math.min(l, r, t, bt);
              if (m === l) pos.x = b.minX - radius;
              else if (m === r) pos.x = b.maxX + radius;
              else if (m === t) pos.z = b.minZ - radius;
              else pos.z = b.maxZ + radius;
            }
          }
        }
      }
    }
    const B = this.bounds;
    if (this.corridors) {
      for (const c of this.corridors) if (pos.x > c.minX && pos.x < c.maxX && pos.z > c.minZ && pos.z < c.maxZ) return hit;
    }
    if (pos.x < B.minX + radius) pos.x = B.minX + radius;
    if (pos.x > B.maxX - radius) pos.x = B.maxX - radius;
    if (pos.z < B.minZ + radius) pos.z = B.minZ + radius;
    if (pos.z > B.maxZ - radius) pos.z = B.maxZ - radius;
    return hit;
  }

  /**
   * Distance along a ray (unit direction) to the first box, each grown by pad,
   * or maxT when nothing is hit. A box the origin is already inside is skipped
   * (when only its padding holds the origin, the bare box is tested instead).
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT, pad = 0.25) {
    const c = this.cell;
    const ex = ox + dx * maxT;
    const ez = oz + dz * maxT;
    const cx0 = Math.floor((Math.min(ox, ex) - pad) / c);
    const cx1 = Math.floor((Math.max(ox, ex) + pad) / c);
    const cz0 = Math.floor((Math.min(oz, ez) - pad) / c);
    const cz1 = Math.floor((Math.max(oz, ez) + pad) / c);
    const stamp = (this._stamp = (this._stamp || 0) + 1);
    let best = maxT;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const list = this.map.get(this._key(cx, cz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (b._ray === stamp) continue;
          b._ray = stamp;
          let p = pad;
          if (inBox(ox, oy, oz, b, p)) {
            if (inBox(ox, oy, oz, b, 0)) continue;
            p = 0;
          }
          const t = rayBox(ox, oy, oz, dx, dy, dz, b, p, best);
          if (t >= 0 && t < best) best = t;
        }
      }
    }
    return best;
  }

  /** Highest box top under a point that the player could stand on (for furniture, kerbs...). */
  pointBlocked(x, y, z, pad = 0.2) {
    const list = this.map.get(this._key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad && y < b.y1 && y > b.y0) return true;
    }
    return false;
  }
}

function inBox(x, y, z, b, p) {
  return x > b.minX - p && x < b.maxX + p && y > b.y0 - p && y < b.y1 + p && z > b.minZ - p && z < b.maxZ + p;
}

/** One slab of the ray / box test: narrows [t0, t1] in place, false when it misses. */
function slab(o, d, lo, hi, T) {
  if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / d;
  let c = (hi - o) / d;
  if (a > c) {
    const s = a;
    a = c;
    c = s;
  }
  if (a > T[0]) T[0] = a;
  if (c < T[1]) T[1] = c;
  return T[0] <= T[1];
}
const _T = [0, 0];

/** Entry distance of a ray into box b grown by p (within tMax), or -1. */
function rayBox(ox, oy, oz, dx, dy, dz, b, p, tMax) {
  _T[0] = 0;
  _T[1] = tMax;
  if (!slab(ox, dx, b.minX - p, b.maxX + p, _T)) return -1;
  if (!slab(oy, dy, b.y0 - p, b.y1 + p, _T)) return -1;
  if (!slab(oz, dz, b.minZ - p, b.maxZ + p, _T)) return -1;
  return _T[0];
}

// ---- oriented boxes (cars) ----------------------------------------------------
// An OBB is { x, z, ry, hw, hl }: centre, heading (forward = (sin ry, cos ry)),
// half width and half length.

/**
 * Push a circle out of an oriented box. Mutates pos. Returns true on contact.
 */
export function pushOutOBB(pos, r, o) {
  const s = Math.sin(o.ry);
  const c = Math.cos(o.ry);
  const dx = pos.x - o.x;
  const dz = pos.z - o.z;
  const lx = dx * c - dz * s; // along the box's right axis
  const lz = dx * s + dz * c; // along its forward axis
  if (Math.abs(lx) > o.hw + r || Math.abs(lz) > o.hl + r) return false;
  const cx = lx < -o.hw ? -o.hw : lx > o.hw ? o.hw : lx;
  const cz = lz < -o.hl ? -o.hl : lz > o.hl ? o.hl : lz;
  const ex = lx - cx;
  const ez = lz - cz;
  const d2 = ex * ex + ez * ez;
  if (d2 >= r * r) return false;
  let nx;
  let nz;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    nx = cx + (ex / d) * r;
    nz = cz + (ez / d) * r;
  } else if (o.hw - Math.abs(lx) < o.hl - Math.abs(lz)) {
    nx = (lx < 0 ? -1 : 1) * (o.hw + r);
    nz = lz;
  } else {
    nx = lx;
    nz = (lz < 0 ? -1 : 1) * (o.hl + r);
  }
  pos.x = o.x + c * nx + s * nz;
  pos.z = o.z - s * nx + c * nz;
  return true;
}

/** Do two oriented boxes overlap? (separating-axis test) */
export function obbOverlap(a, b) {
  const axes = [a.ry, a.ry + Math.PI / 2, b.ry, b.ry + Math.PI / 2];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const ang of axes) {
    const ax = Math.sin(ang);
    const az = Math.cos(ang);
    const ra = a.hl * Math.abs(Math.sin(a.ry) * ax + Math.cos(a.ry) * az) + a.hw * Math.abs(Math.cos(a.ry) * ax - Math.sin(a.ry) * az);
    const rb = b.hl * Math.abs(Math.sin(b.ry) * ax + Math.cos(b.ry) * az) + b.hw * Math.abs(Math.cos(b.ry) * ax - Math.sin(b.ry) * az);
    if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
  }
  return true;
}
