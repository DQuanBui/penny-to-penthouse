// Inner walls are stored as unit (1 m) segments on the metre grid, so a
// doorway is simply a missing segment.
import { FURNITURE_BY_ID } from '../data/furniture.js';
import { rectOf, wallHitsRect, keepClear } from './Grid.js';

export const WALL_COST_PER_M = 60;

const key = (s) => `${Math.min(s.x1, s.x2)},${Math.min(s.z1, s.z2)},${s.z1 === s.z2 ? 'h' : 'v'}`;

/** Unit segments from grid point A to B (must share a row or column). */
export function wallRun(ax, az, bx, bz) {
  ax = Math.round(ax);
  az = Math.round(az);
  bx = Math.round(bx);
  bz = Math.round(bz);
  const out = [];
  if (az === bz) for (let x = Math.min(ax, bx); x < Math.max(ax, bx); x++) out.push({ x1: x, z1: az, x2: x + 1, z2: az });
  else if (ax === bx) for (let z = Math.min(az, bz); z < Math.max(az, bz); z++) out.push({ x1: ax, z1: z, x2: ax, z2: z + 1 });
  return out;
}

/**
 * Add a run of wall to a storey. Segments that would cut through furniture,
 * leave the room or duplicate an existing wall are skipped.
 * @returns number of metres added
 */
export function addWalls(layout, lv, level, run) {
  const have = new Set(lv.walls.map(key));
  const clear = keepClear(layout, level);
  let added = 0;
  for (const s of run) {
    if (have.has(key(s))) continue;
    // not on the outer walls or outside
    if (s.z1 === s.z2 ? s.z1 <= 0 || s.z1 >= layout.d || s.x1 < 0 || s.x2 > layout.w : s.x1 <= 0 || s.x1 >= layout.w || s.z1 < 0 || s.z2 > layout.d) continue;
    if (lv.items.some((it) => FURNITURE_BY_ID[it.id]?.h > 0 && wallHitsRect(s, rectOf(FURNITURE_BY_ID[it.id], it)))) continue;
    if (clear.some((r) => wallHitsRect(s, r))) continue;
    lv.walls.push(s);
    have.add(key(s));
    added++;
  }
  return added;
}

/** Remove the unit segment nearest to (x,z), within reach. Returns true if one was removed. */
export function removeWallAt(lv, x, z, reach = 0.45) {
  let best = -1;
  let bd = reach;
  lv.walls.forEach((s, i) => {
    const cx = (s.x1 + s.x2) / 2;
    const cz = (s.z1 + s.z2) / 2;
    const d = s.z1 === s.z2 ? Math.hypot(Math.max(0, Math.abs(x - cx) - 0.5), z - cz) : Math.hypot(x - cx, Math.max(0, Math.abs(z - cz) - 0.5));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) return false;
  lv.walls.splice(best, 1);
  return true;
}
