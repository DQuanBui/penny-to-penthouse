// Umbrellas for rainy days: a canopy on a shaft, held in the right hand
// (the animator raises the forearm with { umbrella: true }).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const UMBRELLA_COLORS = ['#1d1f24', '#27406b', '#c53a3a', '#e9c04c', '#2f8f6a', '#5a4fd0', '#e06a9a', '#f4f4f2', '#7a5a3c'];

let geo = null;
/** Geometry in the character's frame (feet at the origin, facing +Z). */
export function umbrellaGeometry() {
  if (geo) return geo;
  const parts = [];
  // canopy: an eight-panel dome, open underneath, tipped slightly back
  const canopy = new THREE.ConeGeometry(0.62, 0.3, 8, 1, true).translate(0, 0.15, 0);
  canopy.rotateX(-0.12);
  parts.push(canopy.translate(-0.08, 2.0, 0.06));
  parts.push(new THREE.SphereGeometry(0.03, 6, 4).translate(-0.08, 2.33, 0.03));
  // shaft from the hand up through the canopy, and a curved handle
  parts.push(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6).translate(-0.2, 1.62, 0.22));
  parts.push(new THREE.TorusGeometry(0.045, 0.012, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(-0.2, 1.14, 0.265));
  geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  }));
  return geo;
}

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide }));
  return mats.get(color);
}

/** Show or hide an umbrella on a character rig (created on first use). */
export function setUmbrella(rig, on, color) {
  if (!rig || rig.type === 'glb') return;
  if (on && !rig.umbrella) {
    rig.umbrella = new THREE.Mesh(umbrellaGeometry(), mat(color || UMBRELLA_COLORS[Math.floor(Math.random() * UMBRELLA_COLORS.length)]));
    rig.umbrella.castShadow = true;
    rig.group.add(rig.umbrella);
  }
  if (rig.umbrella) rig.umbrella.visible = !!on;
}
