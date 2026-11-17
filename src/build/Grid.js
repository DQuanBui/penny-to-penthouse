// Grid maths for build mode: snapping, footprints, placement rules and the
// home style score. Pure functions on a layout (no three.js).
import { FURNITURE_BY_ID } from '../data/furniture.js';

export const CELL = 0.5; // furniture snaps to half-metre cells; walls to whole metres

/** The part of a layout for a storey: level 0 is the layout itself. */
export function levelOf(layout, level = 0) {
  if (!level) return layout;
  return (layout.upper ||= { walls: [], items: [] });
}

/** Footprint size after rotation (r = quarter turns). */
export const sizeOf = (def, r) => (r % 2 ? [def.d, def.w] : [def.w, def.d]);

/** Snap a centre coordinate so the item's edges sit on the grid. */
export const snapCenter = (v, size) => Math.round((v - size / 2) / CELL) * CELL + size / 2;

export function rectOf(def, it) {
  const [w, d] = sizeOf(def, it.r || 0);
  return { x0: it.x - w / 2, z0: it.z - d / 2, x1: it.x + w / 2, z1: it.z + d / 2 };
}
const overlap = (a, b, e = 0.02) => a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.z0 < b.z1 - e && a.z1 > b.z0 + e;

/** Does a 1-D wall segment cut through a rectangle? */
export function wallHitsRect(s, r, e = 0.05) {
  if (s.z1 === s.z2) return s.z1 > r.z0 + e && s.z1 < r.z1 - e && Math.max(s.x1, s.x2) > r.x0 + e && Math.min(s.x1, s.x2) < r.x1 - e;
  return s.x1 > r.x0 + e && s.x1 < r.x1 - e && Math.max(s.z1, s.z2) > r.z0 + e && Math.min(s.z1, s.z2) < r.z1 - e;
}

/** Areas that must stay clear: in front of the door and the lift pad. */
export function keepClear(layout, level) {
  const out = [];
  const dx = layout.doorX ?? layout.w / 2;
  if (!level) out.push({ x0: dx - 0.75, z0: layout.d - 1.5, x1: dx + 0.75, z1: layout.d });
  if ((layout.floors || 1) > 1) out.push({ x0: layout.w - 1.5, z0: layout.d - 1.5, x1: layout.w, z1: layout.d });
  return out;
}

/**
 * Wall-mounted items snap to the nearest perimeter wall and face the room.
 * @returns { x, z, r } or null when too far from a wall
 */
export function snapToWall(layout, def, x, z) {
  const d = [z, layout.w - x, layout.d - z, x]; // north, east, south, west
  let side = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[side]) side = i;
  if (d[side] > 1.2) return null;
  const half = def.d / 2;
  const along = (v, max) => Math.min(max - def.w / 2, Math.max(def.w / 2, snapCenter(v, def.w)));
  if (side === 0) return { x: along(x, layout.w), z: half, r: 0 };
  if (side === 2) return { x: along(x, layout.w), z: layout.d - half, r: 2 };
  if (side === 1) return { x: layout.w - half, z: along(z, layout.d), r: 3 };
  return { x: half, z: along(z, layout.d), r: 1 };
}

/**
 * Can `it` (an item of type def) go here? ignoreUid = the item being moved.
 * @returns { ok, reason }
 */
export function canPlace(layout, level, def, it, ignoreUid) {
  const lv = levelOf(layout, level);
  const r = rectOf(def, it);
  if (r.x0 < -0.01 || r.z0 < -0.01 || r.x1 > layout.w + 0.01 || r.z1 > layout.d + 0.01) return { ok: false, reason: 'Outside the room' };
  for (const k of keepClear(layout, level)) if (def.h > 0 && overlap(r, k)) return { ok: false, reason: 'Keep the doorway clear' };
  for (const s of lv.walls) if (wallHitsRect(s, r)) return { ok: false, reason: 'A wall is in the way' };
  const flat = def.h === 0; // rugs, wall art
  for (const o of lv.items) {
    if (o.uid === ignoreUid) continue;
    const od = FURNITURE_BY_ID[o.id];
    if (!od) continue;
    const oflat = od.h === 0;
    // rugs go under anything; wall items only clash with other wall items or tall furniture
    if (flat !== oflat && !(def.wall && od.h > 1.2) && !(od.wall && def.h > 1.2)) continue;
    if (flat && oflat && !!def.wall !== !!od.wall) continue;
    if (overlap(r, rectOf(od, o))) return { ok: false, reason: 'Something is already there' };
  }
  return { ok: true };
}

const FLOOR_STYLE = { carpet: 0, concrete: 0, wood: 3, tile: 2 };

/** Style score of a whole home (both storeys). */
export function styleScore(layout) {
  if (!layout) return 0;
  let score = FLOOR_STYLE[layout.floor] || 0;
  if (layout.windows === 'panorama') score += 6;
  if (layout.painted) score += 2;
  const cats = new Set();
  const seen = {};
  for (const lv of [layout, layout.upper]) {
    if (!lv) continue;
    for (const it of lv.items) {
      const def = FURNITURE_BY_ID[it.id];
      if (!def) continue;
      // repeats of the same piece add less each time
      const n = (seen[it.id] = (seen[it.id] || 0) + 1);
      score += def.style / n;
      if (def.style > 0) cats.add(def.cat);
    }
  }
  return Math.round(score + cats.size * 2);
}
