// Procedural animation for the procedural rig (idle / walk / run / jump / sit /
// talk / wave), blended with damped weights so transitions are always smooth.
// GLB rigs are animated by AnimationMixer instead (see GLBCharacters.js).
import { damp, lerp, smoothstep } from '../core/utils.js';

/**
 * @param rig   from CharacterFactory.buildCharacter
 * @param dt    seconds
 * @param p     { speed (m/s), grounded, sitting, floor (sitting on the ground), talking, waving, shaking }
 */
export function animateRig(rig, dt, p) {
  if (rig.type === 'glb') {
    rig.updateGLB(dt, p);
    return;
  }
  const a = rig.anim;
  const b = rig.bones;
  const speed = p.speed || 0;
  a.t += dt;
  const run = smoothstep(3.4, 6.0, speed);
  const moving = speed > 0.15 && !p.sitting;
  a.amp = damp(a.amp, moving ? Math.min(1, speed / 1.6) : 0, 9, dt);
  a.air = damp(a.air, p.grounded === false ? 1 : 0, 10, dt);
  a.sit = damp(a.sit, p.sitting ? 1 : 0, 7, dt);
  a.floor = damp(a.floor || 0, p.floor ? 1 : 0, 7, dt);
  a.talk = damp(a.talk, p.talking ? 1 : 0, 6, dt);
  a.wave = damp(a.wave, p.waving ? 1 : 0, 8, dt);
  a.shake = damp(a.shake || 0, p.shaking ? 1 : 0, 8, dt);
  // one full cycle = two steps
  const stride = lerp(1.45, 2.5, run);
  if (moving) a.phase += (speed / stride) * Math.PI * 2 * dt;
  const ph = a.phase;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const amp = a.amp * (1 - a.sit) * (1 - a.air * 0.6);
  const t = a.t;
  const breathe = Math.sin(t * 1.7);

  // legs
  const swing = lerp(0.52, 0.95, run) * amp;
  const knee = lerp(0.95, 1.75, run) * amp;
  let thL = -s * swing - run * 0.12 * amp;
  let thR = s * swing - run * 0.12 * amp;
  let shL = Math.max(0, c) * knee + 0.06 * amp;
  let shR = Math.max(0, -c) * knee + 0.06 * amp;
  // air pose: tuck slightly
  thL = lerp(thL, -0.55, a.air);
  thR = lerp(thR, 0.2, a.air);
  shL = lerp(shL, 0.9, a.air);
  shR = lerp(shR, 0.5, a.air);
  // seated
  thL = lerp(thL, -1.48, a.sit);
  thR = lerp(thR, -1.48, a.sit);
  shL = lerp(shL, 1.5, a.sit);
  shR = lerp(shR, 1.5, a.sit);
  // on the ground: legs out in front, one knee up
  thL = lerp(thL, -1.5, a.floor);
  thR = lerp(thR, -1.95, a.floor);
  shL = lerp(shL, 0.12, a.floor);
  shR = lerp(shR, 1.9, a.floor);
  b.thighL.rotation.x = thL;
  b.thighR.rotation.x = thR;
  b.shinL.rotation.x = shL;
  b.shinR.rotation.x = shR;
  b.footL.rotation.x = lerp(-Math.max(0, -s) * 0.35 * amp, 0.1, a.sit);
  b.footR.rotation.x = lerp(-Math.max(0, s) * 0.35 * amp, 0.1, a.sit);

  // hips: bob + sway, lowered when seated
  const bob = Math.cos(ph * 2) * 0.018 * (1 + run * 1.2) * amp;
  b.hips.position.y = rig.hipsY + bob - a.sit * 0.44 - a.floor * 0.84 + Math.sin(t * 1.7) * 0.003;
  b.hips.rotation.y = s * 0.09 * amp;
  b.hips.rotation.z = c * 0.03 * amp;

  // torso
  b.spine.rotation.x = lerp(0.02, 0.2, run) * amp + a.air * 0.1 - a.sit * 0.05 - a.floor * 0.12;
  b.chest.rotation.y = -s * 0.14 * amp;
  b.chest.rotation.x = breathe * 0.012 + a.talk * Math.sin(t * 2.3) * 0.02;
  b.neck.rotation.x = -lerp(0.0, 0.12, run) * amp;
  b.head.rotation.y = Math.sin(t * 0.45) * 0.07 * (1 - amp) + a.talk * Math.sin(t * 1.9) * 0.08;
  b.head.rotation.x = Math.sin(t * 0.6) * 0.02 + a.talk * Math.sin(t * 3.1) * 0.04;

  // arms (swing opposite to the legs)
  const arm = lerp(0.42, 0.95, run) * amp;
  const elbow = lerp(0.18, 1.35, run) * amp + 0.1;
  let aLx = s * arm;
  let aRx = -s * arm;
  let fLx = -elbow - Math.max(0, -s) * 0.25 * amp;
  let fRx = -elbow - Math.max(0, s) * 0.25 * amp;
  let aLz = 0.07 + breathe * 0.008 + a.air * 0.5;
  let aRz = -0.07 - breathe * 0.008 - a.air * 0.5;
  // seated: hands on lap
  aLx = lerp(aLx, -0.45, a.sit);
  aRx = lerp(aRx, -0.45, a.sit);
  fLx = lerp(fLx, -0.75, a.sit);
  fRx = lerp(fRx, -0.75, a.sit);
  aLx = lerp(aLx, -0.55, a.floor);
  aRx = lerp(aRx, -0.9, a.floor);
  fLx = lerp(fLx, -0.45, a.floor);
  fRx = lerp(fRx, -0.6, a.floor);
  // talking: gentle hand gestures
  if (a.talk > 0.01) {
    const g = a.talk;
    aRx = lerp(aRx, -0.5 + Math.sin(t * 2.6) * 0.15, g);
    fRx = lerp(fRx, -1.3 + Math.sin(t * 3.4) * 0.3, g);
    aLx = lerp(aLx, -0.25 + Math.sin(t * 2.1 + 1) * 0.1, g * 0.7);
    fLx = lerp(fLx, -0.9 + Math.sin(t * 2.9 + 2) * 0.25, g * 0.7);
  }
  // handshake: right arm out in front, forearm pumping
  if (a.shake > 0.01) {
    aRx = lerp(aRx, -0.9, a.shake);
    aRz = lerp(aRz, 0.16, a.shake);
    fRx = lerp(fRx, -0.42 + Math.sin(t * 13) * 0.13, a.shake);
  }
  // waving with the right arm
  if (a.wave > 0.01) {
    aRz = lerp(aRz, -2.5, a.wave);
    aRx = lerp(aRx, 0, a.wave);
    fRx = lerp(fRx, -0.5, a.wave);
    b.foreR.rotation.z = Math.sin(t * 9) * 0.45 * a.wave;
  } else b.foreR.rotation.z = 0;
  b.armL.rotation.x = aLx;
  b.armR.rotation.x = aRx;
  b.armL.rotation.z = aLz;
  b.armR.rotation.z = aRz;
  b.foreL.rotation.x = fLx;
  b.foreR.rotation.x = fRx;
}
