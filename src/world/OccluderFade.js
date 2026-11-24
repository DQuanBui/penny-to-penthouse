// Small things between the camera and the player (awnings, planters, tree
// crowns, shopfront trim) dissolve with a screen-space dither instead of
// blocking the view. Materials opt in with fadeOccluders(material); the
// third-person camera updates the shared uniforms every frame.
import * as THREE from 'three';

export const occluderUniforms = {
  uOccCam: { value: new THREE.Vector3() },
  uOccHead: { value: new THREE.Vector3() },
  uOccOn: { value: 0 },
};

const VERT_DECL = 'varying vec3 vOccW;';
const VERT_BODY = `
  {
    vec4 occW = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      occW = instanceMatrix * occW;
    #endif
    vOccW = (modelMatrix * occW).xyz;
  }`;
const FRAG_DECL = `uniform vec3 uOccCam;
uniform vec3 uOccHead;
uniform float uOccOn;
varying vec3 vOccW;`;
// a cone around the camera -> player line: narrow at the lens, wider near you
const FRAG_BODY = `
  if (uOccOn > 0.5) {
    vec3 occSeg = uOccHead - uOccCam;
    float occL = length(occSeg);
    vec3 occD = occSeg / max(occL, 1e-3);
    vec3 occRel = vOccW - uOccCam;
    float occT = dot(occRel, occD);
    if (occT > 0.0 && occT < occL - 0.45) {
      float occR = length(occRel - occD * occT);
      float occRad = mix(0.6, 1.5, clamp(occT / max(occL, 1e-3), 0.0, 1.0));
      float occKeep = smoothstep(occRad * 0.4, occRad, occR);
      float occN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (occKeep < occN) discard;
    }
  }`;

/** Patch a material so it fades where it sits between the camera and the player. */
export function fadeOccluders(material) {
  if (!material || material.userData.occFade) return material;
  material.userData.occFade = true;
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, occluderUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_DECL).replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_DECL).replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FRAG_BODY);
  };
  const key = (prevKey ? prevKey() : '') + '|occ';
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}
