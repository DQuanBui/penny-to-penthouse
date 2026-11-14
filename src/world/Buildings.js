// All city buildings are drawn with ONE InstancedMesh. Windows, storefronts,
// night lighting and a baked-AO gradient are generated in the fragment shader
// from world position, so there are no window meshes or textures at all.
import * as THREE from 'three';

/** Shared uniforms driven by Sky.js every frame. */
export const worldUniforms = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};

// Facade types understood by the shader (stored in aStyle.w).
export const FACADE = { GLASS: 0, MASONRY: 1, WAREHOUSE: 2, BALCONY: 3, PLAIN: 4 };

export function makeBuildingMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.02 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = worldUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aStyle;
        varying vec3 vWPos; varying vec3 vWN; varying vec4 vStyle;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 bwp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vWPos = bwp.xyz; vWN = normal; vStyle = aStyle;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vWPos; varying vec3 vWN; varying vec4 vStyle;
        float bhash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float winMask = 0.0; float litRnd = 1.0; float tvRnd = 0.0;
        float fType = floor(vStyle.w + 0.5);
        float bSeed = floor(vStyle.z + 0.5); // rounded: interpolation jitter would scramble the hash
        if (abs(vWN.y) < 0.5) {
          float side = abs(vWN.x) > 0.5 ? 1.0 : 0.0;
          float u = side > 0.5 ? vWPos.z : vWPos.x;
          float y = vWPos.y;
          float groundH = fType > 3.5 ? 0.0 : 4.2;
          if (fType > 3.5) {
            winMask = 0.0;
          } else if (y > groundH) {
            vec2 q = vec2(u / vStyle.y, (y - groundH) / vStyle.x);
            vec2 cell = floor(q); vec2 f = fract(q);
            vec2 fw = fwidth(q) * 1.2;
            float mx = fType < 0.5 ? 0.06 : (fType < 1.5 ? 0.24 : (fType < 2.5 ? 0.3 : 0.12));
            float y0 = fType < 0.5 ? 0.1 : 0.26;
            float y1 = fType < 0.5 ? 0.93 : 0.8;
            float m = smoothstep(mx - fw.x, mx + fw.x, f.x) * (1.0 - smoothstep(1.0 - mx - fw.x, 1.0 - mx + fw.x, f.x))
                    * smoothstep(y0 - fw.y, y0 + fw.y, f.y) * (1.0 - smoothstep(y1 - fw.y, y1 + fw.y, f.y));
            float cover = (1.0 - 2.0 * mx) * (y1 - y0);
            if (fType > 1.5 && fType < 2.5) { float keep = step(0.5, bhash(cell * 1.7 + bSeed)); m *= keep; cover *= 0.5; }
            float fade = clamp(max(fw.x, fw.y) * 1.4, 0.0, 1.0);
            winMask = mix(m, cover, fade);
            litRnd = bhash(cell + bSeed * 17.0 + side * 31.0);
            tvRnd = bhash(cell.yx + bSeed * 5.0);
            // Balcony slabs: a pale band at every floor line.
            if (fType > 2.5) {
              float slab = 1.0 - smoothstep(0.1, 0.1 + fw.y, f.y);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), slab * (1.0 - fade) * 0.9);
              winMask *= 1.0 - slab;
            }
          } else {
            // Storefront band on the ground floor.
            vec2 q = vec2(u / (vStyle.y * 1.7), y / groundH);
            vec2 f = fract(q); vec2 fw = fwidth(q) * 1.2;
            winMask = smoothstep(0.07 - fw.x, 0.07 + fw.x, f.x) * (1.0 - smoothstep(0.93 - fw.x, 0.93 + fw.x, f.x))
                    * smoothstep(0.1, 0.14, f.y) * (1.0 - smoothstep(0.76, 0.8, f.y));
            litRnd = 0.25 * bhash(vec2(floor(q.x), bSeed));
            diffuseColor.rgb *= 0.8;
          }
          // Baked-AO look: walls darken toward the pavement.
          diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 7.0, y));
        } else if (vWN.y > 0.5) {
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.45, vec3(0.3, 0.31, 0.34), 0.5);
        }
        vec3 glassDay = vec3(0.2, 0.31, 0.45) + 0.16 * tvRnd + 0.14 * smoothstep(0.0, 140.0, vWPos.y);
        vec3 glassCol = mix(glassDay, vec3(0.03, 0.04, 0.07), uNight);
        glassCol = mix(glassCol, diffuseColor.rgb * (1.0 - 0.6 * uNight), fType < 0.5 ? 0.35 : 0.05);
        diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, winMask);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.18, winMask);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float lit = step(litRnd, uNight * 0.46) * winMask;
        vec3 litCol = mix(vec3(1.0, 0.74, 0.42), vec3(0.55, 0.75, 1.0), step(0.86, tvRnd));
        totalEmissiveRadiance += litCol * lit * (0.45 + 0.5 * tvRnd);`,
      );
  };
  return mat;
}

/** Collects boxes, then builds one InstancedMesh. */
export class BuildingBatch {
  constructor() {
    this.items = [];
  }
  /**
   * @param x,z centre  @param w,d footprint  @param h height  @param y0 base height
   * @param color hex   @param style {floorH, bay, seed, type}
   */
  add(x, z, w, d, h, color, style = {}, y0 = 0) {
    this.items.push({ x, z, w, d, h, y0, color, style });
  }
  build() {
    const n = this.items.length;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const styles = new Float32Array(n * 4);
    const mesh = new THREE.InstancedMesh(geo, makeBuildingMaterial(), n);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const b = this.items[i];
      m.makeScale(b.w, b.h, b.d);
      m.setPosition(b.x, b.y0, b.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(b.color));
      styles[i * 4] = b.style.floorH ?? 3.4;
      styles[i * 4 + 1] = b.style.bay ?? 3;
      styles[i * 4 + 2] = Math.round((b.style.seed ?? i) * 7) % 512;
      styles[i * 4 + 3] = b.style.type ?? FACADE.MASONRY;
    }
    geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styles, 4));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

/** Generic helper: many copies of one geometry with per-instance transform + colour. */
export class InstanceBatch {
  constructor(geometry, material, { castShadow = false, receiveShadow = false } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.items = [];
  }
  add(x, y, z, { sx = 1, sy = 1, sz = 1, ry = 0, color = null } = {}) {
    this.items.push({ x, y, z, sx, sy, sz, ry, color });
  }
  get count() {
    return this.items.length;
  }
  build() {
    const n = this.items.length;
    if (!n) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    let colored = false;
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      q.setFromAxisAngle(up, it.ry);
      m.compose(p.set(it.x, it.y, it.z), q, s.set(it.sx, it.sy, it.sz));
      mesh.setMatrixAt(i, m);
      if (it.color != null) {
        mesh.setColorAt(i, c.set(it.color));
        colored = true;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colored) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    mesh.computeBoundingSphere();
    return mesh;
  }
}
