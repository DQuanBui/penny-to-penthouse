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
    if (pos.x < B.minX + radius) pos.x = B.minX + radius;
    if (pos.x > B.maxX - radius) pos.x = B.maxX - radius;
    if (pos.z < B.minZ + radius) pos.z = B.minZ + radius;
    if (pos.z > B.maxZ - radius) pos.z = B.maxZ - radius;
    return hit;
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
