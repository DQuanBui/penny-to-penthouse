// Optional GLB characters (Mixamo / Quaternius style rigs). Files found in
// public/models/characters/ are loaded once and instanced with SkeletonUtils;
// clips are matched by name (idle / walk / run / sit / jump) and blended with
// an AnimationMixer. Extra clips in public/models/characters/animations/ are
// shared by every model with matching bone names (Mixamo "without skin" files).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadAssetManifest } from '../core/Assets.js';

const CLIP_PATTERNS = {
  idle: /idle|stand|breath/i,
  walk: /walk/i,
  run: /run|jog|sprint/i,
  sit: /sit/i,
  jump: /jump|fall/i,
};

const library = new Map(); // file name -> { scene, clips, scale, yOffset }
let loaded = false;

export async function loadGLBCharacters() {
  if (loaded) return library;
  loaded = true;
  const m = await loadAssetManifest();
  if (!m.characters.length) return library;
  const loader = new GLTFLoader();
  const shared = [];
  for (const f of m.animations) {
    try {
      const g = await loader.loadAsync('./models/characters/animations/' + f);
      for (const c of g.animations) {
        if (g.animations.length === 1) c.name = f.replace(/\.[^.]+$/, '');
        shared.push(c);
      }
    } catch {
      /* skip unreadable files */
    }
  }
  for (const f of m.characters) {
    try {
      const g = await loader.loadAsync('./models/characters/' + f);
      const box = new THREE.Box3().setFromObject(g.scene);
      const height = Math.max(0.01, box.max.y - box.min.y);
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
        }
      });
      library.set(f, { scene: g.scene, clips: [...g.animations, ...shared], scale: 1.75 / height, yOffset: -box.min.y });
    } catch {
      /* skip unreadable files */
    }
  }
  return library;
}

export const glbCharacterNames = () => [...library.keys()];
/** Models whose file name starts with "player" are offered to the player; the rest dress NPCs. */
export const glbPlayerModels = () => glbCharacterNames().filter((n) => /^player/i.test(n));
export const glbNpcModels = () => glbCharacterNames().filter((n) => !/^player/i.test(n));

/** Build a rig with the same interface as the procedural one. Returns null if the model is unknown. */
export function buildGLBCharacter(name, heightScale = 1) {
  const src = library.get(name);
  if (!src) return null;
  const model = cloneSkinned(src.scene);
  model.scale.setScalar(src.scale);
  model.position.y = src.yOffset * src.scale;
  const group = new THREE.Group();
  group.add(model);
  group.scale.setScalar(heightScale);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const key in CLIP_PATTERNS) {
    const clip = src.clips.find((c) => CLIP_PATTERNS[key].test(c.name));
    if (clip) actions[key] = mixer.clipAction(clip);
  }
  let current = null;
  const play = (key) => {
    const next = actions[key] || actions.idle || actions.walk;
    if (!next || next === current) return;
    next.reset().fadeIn(0.22).play();
    if (current) current.fadeOut(0.22);
    current = next;
  };
  play('idle');
  return {
    type: 'glb',
    group,
    model,
    anim: {},
    updateGLB(dt, p) {
      const speed = p.speed || 0;
      const key = p.sitting ? 'sit' : p.grounded === false && actions.jump ? 'jump' : speed > 4.2 ? 'run' : speed > 0.25 ? 'walk' : 'idle';
      play(key);
      if (current) current.timeScale = key === 'walk' ? Math.max(0.6, speed / 1.5) : key === 'run' ? Math.max(0.7, speed / 5.5) : 1;
      mixer.update(dt);
    },
    dispose() {
      mixer.stopAllAction();
    },
  };
}
