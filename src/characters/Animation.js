// Procedural animation for the procedural rig (idle / walk / run / jump / sit /
// talk / wave), blended with damped weights so transitions are always smooth.
// GLB rigs are animated by AnimationMixer instead (see GLBCharacters.js).
import { damp, lerp, smoothstep } from '../core/utils.js';

/**
 * @param rig   from CharacterFactory.buildCharacter
 * @param dt    seconds
 * @param p     { speed (m/s), grounded, sitting, floor (sitting on the ground), riding (a bicycle), umbrella, talking, waving, shaking, dancing, cheering, jacks, phone }
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
  a.ride = damp(a.ride || 0, p.riding ? 1 : 0, 8, dt);
  if (p.riding) a.pedal = (a.pedal || 0) + speed * dt * 2.4;
  a.talk = damp(a.talk, p.talking ? 1 : 0, 6, dt);
  a.wave = damp(a.wave, p.waving ? 1 : 0, 8, dt);
  a.shake = damp(a.shake || 0, p.shaking ? 1 : 0, 8, dt);
  a.umb = damp(a.umb || 0, p.umbrella ? 1 : 0, 6, dt);
  a.cheer = damp(a.cheer || 0, p.cheering ? 1 : 0, 9, dt);
  a.jacks = damp(a.jacks || 0, p.jacks ? 1 : 0, 8, dt);
  a.phone = damp(a.phone || 0, p.phone ? 1 : 0, 7, dt);
  a.dance = damp(a.dance || 0, p.dancing ? 1 : 0, 5, dt);
  a.push = damp(a.push || 0, p.pushing ? 1 : 0, 6, dt);
  a.cane = damp(a.cane || 0, p.cane ? 1 : 0, 6, dt);
  a.swim = damp(a.swim || 0, p.swimming ? 1 : 0, 6, dt);
  a.lie = damp(a.lie || 0, p.lying ? 1 : 0, 6, dt);
  if (p.swimming) a.stroke = (a.stroke || 0) + dt * (1.6 + (p.swimMove || 0) * 1.6);
  // one full cycle = two steps
  const stride = lerp(1.45, 2.5, run);
  if (moving) a.phase += (speed / stride) * Math.PI * 2 * dt;
  const ph = a.phase;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const amp = a.amp * (1 - a.sit) * (1 - a.air * 0.6) * (1 - (a.ride || 0));
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
  // on a bicycle: pedalling legs
  if (a.ride > 0.01) {
    const pc = a.pedal || 0;
    thL = lerp(thL, -1.05 + Math.sin(pc) * 0.42, a.ride);
    thR = lerp(thR, -1.05 - Math.sin(pc) * 0.42, a.ride);
    shL = lerp(shL, 1.15 + Math.cos(pc) * 0.45, a.ride);
    shR = lerp(shR, 1.15 - Math.cos(pc) * 0.45, a.ride);
  }
  b.thighL.rotation.x = thL;
  b.thighR.rotation.x = thR;
  b.shinL.rotation.x = shL;
  b.shinR.rotation.x = shR;
  b.footL.rotation.x = lerp(-Math.max(0, -s) * 0.35 * amp, 0.1, a.sit);
  b.footR.rotation.x = lerp(-Math.max(0, s) * 0.35 * amp, 0.1, a.sit);

  // hips: bob + sway, lowered when seated
  const bob = Math.cos(ph * 2) * 0.018 * (1 + run * 1.2) * amp;
  b.hips.position.y = rig.hipsY + bob - a.sit * 0.44 - a.floor * 0.84 + (a.ride || 0) * 0.02 + Math.sin(t * 1.7) * 0.003;
  b.hips.rotation.y = s * 0.09 * amp;
  b.hips.rotation.z = c * 0.03 * amp;

  // torso
  b.spine.rotation.x = lerp(0.02, 0.2, run) * amp + a.air * 0.1 - a.sit * 0.05 - a.floor * 0.12 + (a.ride || 0) * 0.42;
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
  aLx = lerp(aLx, -0.22, a.sit);
  aRx = lerp(aRx, -0.22, a.sit);
  fLx = lerp(fLx, -0.62, a.sit);
  fRx = lerp(fRx, -0.62, a.sit);
  // hands on the handlebars
  aLx = lerp(aLx, -0.95, a.ride || 0);
  aRx = lerp(aRx, -0.95, a.ride || 0);
  fLx = lerp(fLx, -0.3, a.ride || 0);
  fRx = lerp(fRx, -0.3, a.ride || 0);
  aLx = lerp(aLx, -0.55, a.floor);
  aRx = lerp(aRx, -0.9, a.floor);
  fLx = lerp(fLx, -0.45, a.floor);
  fRx = lerp(fRx, -0.6, a.floor);
  // pushing a stroller: both hands forward on the handle
  if (a.push > 0.01) {
    aLx = lerp(aLx, -0.78, a.push);
    aRx = lerp(aRx, -0.78, a.push);
    fLx = lerp(fLx, -0.55, a.push);
    fRx = lerp(fRx, -0.55, a.push);
    aLz = lerp(aLz, 0.12, a.push);
    aRz = lerp(aRz, -0.12, a.push);
  }
  // walking with a cane: the right arm steadies, a slight stoop
  if (a.cane > 0.01) {
    aRx = lerp(aRx, -0.15 + Math.sin(ph) * 0.12, a.cane);
    fRx = lerp(fRx, -0.25, a.cane);
    b.spine.rotation.x += 0.12 * a.cane;
  }
  // talking: gentle hand gestures
  if (a.talk > 0.01) {
    const g = a.talk;
    aRx = lerp(aRx, -0.5 + Math.sin(t * 2.6) * 0.15, g);
    fRx = lerp(fRx, -1.3 + Math.sin(t * 3.4) * 0.3, g);
    aLx = lerp(aLx, -0.25 + Math.sin(t * 2.1 + 1) * 0.1, g * 0.7);
    fLx = lerp(fLx, -0.9 + Math.sin(t * 2.9 + 2) * 0.25, g * 0.7);
  }
  // dancing: bounce to the beat, arms up and swinging
  if (a.dance > 0.01) {
    const d = a.dance;
    const beat = t * 7.6 + (a.danceSeed || (a.danceSeed = Math.random() * 6));
    aLz = lerp(aLz, 1.0 + Math.sin(beat * 0.5) * 0.9, d);
    aRz = lerp(aRz, -1.0 - Math.sin(beat * 0.5 + 1.4) * 0.9, d);
    fLx = lerp(fLx, -0.9 + Math.sin(beat) * 0.4, d);
    fRx = lerp(fRx, -0.9 - Math.sin(beat) * 0.4, d);
    b.hips.position.y -= Math.abs(Math.sin(beat)) * 0.05 * d;
    b.hips.rotation.y += Math.sin(beat * 0.5) * 0.25 * d;
    b.chest.rotation.z = Math.sin(beat * 0.5) * 0.12 * d;
    b.head.rotation.x += Math.sin(beat) * 0.12 * d;
  } else b.chest.rotation.z = 0;
  // cheering: both arms thrown up, a little bounce
  if (a.cheer > 0.01) {
    aLz = lerp(aLz, 2.6 + Math.sin(t * 9) * 0.15, a.cheer);
    aRz = lerp(aRz, -2.6 - Math.sin(t * 9) * 0.15, a.cheer);
    fLx = lerp(fLx, -0.3, a.cheer);
    fRx = lerp(fRx, -0.3, a.cheer);
    b.hips.position.y += Math.abs(Math.sin(t * 9)) * 0.04 * a.cheer;
  }
  // jumping jacks: arms and legs out together, hop
  if (a.jacks > 0.01) {
    const j = (Math.sin(t * 9) + 1) / 2;
    aLz = lerp(aLz, 0.15 + j * 2.6, a.jacks);
    aRz = lerp(aRz, -0.15 - j * 2.6, a.jacks);
    b.thighL.rotation.z = j * 0.32 * a.jacks;
    b.thighR.rotation.z = -j * 0.32 * a.jacks;
    b.hips.position.y += Math.abs(Math.cos(t * 9)) * 0.07 * a.jacks;
  } else {
    b.thighL.rotation.z = 0;
    b.thighR.rotation.z = 0;
  }
  // on the phone: right hand at the ear, head tilted
  if (a.phone > 0.01) {
    aRx = lerp(aRx, -1.05, a.phone);
    aRz = lerp(aRz, 0.28, a.phone);
    fRx = lerp(fRx, -2.2, a.phone);
    b.head.rotation.z = -0.12 * a.phone;
  } else b.head.rotation.z = 0;
  // holding an umbrella: right forearm up in front of the chest
  if (a.umb > 0.01) {
    aRx = lerp(aRx, -0.42, a.umb);
    aRz = lerp(aRz, 0.02, a.umb);
    fRx = lerp(fRx, -1.5, a.umb);
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
  // swimming: an overarm crawl when moving, treading water when still
  if (a.swim > 0.01) {
    const st = a.stroke || 0;
    const mv = Math.min(1, (p.swimMove || 0) / 0.6);
    const crawlL = -1.5 + Math.sin(st * 2) * 1.5;
    const crawlR = -1.5 - Math.sin(st * 2) * 1.5;
    aLx = lerp(aLx, lerp(-0.55 + Math.sin(st * 3) * 0.2, crawlL, mv), a.swim);
    aRx = lerp(aRx, lerp(-0.55 - Math.sin(st * 3) * 0.2, crawlR, mv), a.swim);
    aLz = lerp(aLz, lerp(0.85 + Math.sin(st * 3) * 0.35, 0.25, mv), a.swim);
    aRz = lerp(aRz, lerp(-0.85 - Math.sin(st * 3) * 0.35, -0.25, mv), a.swim);
    fLx = lerp(fLx, -0.35, a.swim);
    fRx = lerp(fRx, -0.35, a.swim);
    b.thighL.rotation.x = lerp(b.thighL.rotation.x, -0.3 + Math.sin(st * 5) * 0.3, a.swim);
    b.thighR.rotation.x = lerp(b.thighR.rotation.x, -0.3 - Math.sin(st * 5) * 0.3, a.swim);
    b.shinL.rotation.x = lerp(b.shinL.rotation.x, 0.4, a.swim);
    b.shinR.rotation.x = lerp(b.shinR.rotation.x, 0.4, a.swim);
    b.head.rotation.x -= 0.15 * a.swim;
  }
  // lying on a towel (the body itself is tipped over by the caller): arms relaxed out
  if (a.lie > 0.01) {
    aLz = lerp(aLz, 0.35, a.lie);
    aRz = lerp(aRz, -0.35, a.lie);
    aLx = lerp(aLx, 0, a.lie);
    aRx = lerp(aRx, 0, a.lie);
    fLx = lerp(fLx, -0.1, a.lie);
    fRx = lerp(fRx, -0.1, a.lie);
  }
  b.armL.rotation.x = aLx;
  b.armR.rotation.x = aRx;
  b.armL.rotation.z = aLz;
  b.armR.rotation.z = aRz;
  b.foreL.rotation.x = fLx;
  b.foreR.rotation.x = fRx;
}
