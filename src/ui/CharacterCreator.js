// Character select + creator: pick an archetype, customise the look and
// outfit, choose two traits. A lit studio scene shows a live, rotating preview.
import * as THREE from 'three';
import { h, clear, btn } from './dom.js';
import { ARCHETYPES, ARCHETYPE_BY_ID, SKILL_BY_ID } from '../data/archetypes.js';
import { TRAITS, TRAIT_BY_ID } from '../data/traits.js';
import * as C from '../characters/Customization.js';
import { createRig } from '../characters/CharacterFactory.js';
import { glbPlayerModels } from '../characters/GLBCharacters.js';
import { animateRig } from '../characters/Animation.js';
import { Tex } from '../world/Textures.js';
import { damp, fmtMoney, pick, shuffle } from '../core/utils.js';

const TABS = [
  ['background', '1 · Background'],
  ['look', '2 · Look'],
  ['style', '3 · Outfit'],
  ['traits', '4 · Traits'],
];

export class CharacterCreator {
  /**
   * @param game
   * @param onDone(profile)  profile = { name, archetype, appearance, traits }
   * @param onBack           optional
   */
  constructor(game, onDone, onBack) {
    this.game = game;
    this.onDone = onDone;
    this.onBack = onBack;
    this.tab = 'background';
    this.profile = { name: C.randomName(), archetype: 'dreamer', appearance: C.defaultAppearance(), traits: [] };
    this.applyArchetype('dreamer', true);
    this.spin = 0.4;
    this.spinVel = 0;
    this.zoom = 0; // 0 = full body, 1 = face
    this.zoomTarget = 0;
    this.buildStudio();
    this.buildDom();
    this.rebuildRig();
  }

  // ---------------------------------------------------------------- studio
  buildStudio() {
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#141a2e');
    scene.fog = new THREE.Fog('#141a2e', 9, 22);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#232a44', roughness: 0.85 }));
    floor.receiveShadow = true;
    scene.add(floor);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: Tex.glow(), color: '#ffb066', transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.position.y = 0.01;
    scene.add(glow);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.1, 40), new THREE.MeshStandardMaterial({ color: '#39425f', roughness: 0.5, metalness: 0.2 }));
    pedestal.position.y = 0.05;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    scene.add(pedestal);
    // soft backdrop arcs for depth
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2 + i * 1.5, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: i === 1 ? '#ff9a5a' : '#5a6fb8', transparent: true, opacity: 0.35 }));
      ring.position.set(0, 1.6, -4 - i * 1.2);
      scene.add(ring);
    }

    const key = new THREE.DirectionalLight('#fff0dc', 3.2);
    key.position.set(3.5, 5.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: 1, far: 16 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7fa8ff', 2.4);
    rim.position.set(-4, 3.5, -4);
    scene.add(rim);
    const warm = new THREE.DirectionalLight('#ff9a66', 0.9);
    warm.position.set(-3, 1.5, 3);
    scene.add(warm);
    scene.add(new THREE.HemisphereLight('#cfe0ff', '#4a3f4a', 1.5));

    this.holder = new THREE.Group();
    this.holder.position.y = 0.1;
    scene.add(this.holder);
  }

  onResize(w, hgt) {
    this.camera.aspect = w / hgt;
    // shift the picture so the character stands right of the UI panel
    const shift = w > 900 ? 0.2 : 0;
    this.camera.setViewOffset(w, hgt, -w * shift, 0, w, hgt);
    this.camera.updateProjectionMatrix();
  }

  rebuildRig() {
    if (this.rig) {
      this.holder.remove(this.rig.group);
      this.rig.dispose();
    }
    this.rig = createRig(this.profile.appearance, { blobShadow: false });
    this.holder.add(this.rig.group);
    this.waveT = 0.9;
  }

  update(dt) {
    if (!this.dragging) this.spin += dt * 0.35 + this.spinVel * dt;
    this.spinVel = damp(this.spinVel, 0, 3, dt);
    this.holder.rotation.y = this.spin;
    this.waveT = Math.max(0, this.waveT - dt);
    animateRig(this.rig, dt, { speed: 0, grounded: true, waving: this.waveT > 0.2 && this.waveT < 0.9 && this.justPicked });
    this.zoom = damp(this.zoom, this.zoomTarget, 5, dt);
    const z = this.zoom;
    const hgt = this.profile.appearance.height || 1;
    this.camera.position.set(0, 1.2 + z * 0.55 * hgt, 6.6 - z * 4.3);
    this.camera.lookAt(0, 1.02 + z * 0.68 * hgt, 0);
  }

  // ------------------------------------------------------------------ data
  applyArchetype(id, silent) {
    const a = ARCHETYPE_BY_ID[id];
    const p = this.profile;
    p.archetype = id;
    Object.assign(p.appearance, a.look || {});
    p.traits = p.traits.filter((t) => t !== a.trait).slice(0, 2);
    if (!silent) {
      this.justPicked = true;
      this.rebuildRig();
    }
  }

  randomize() {
    const p = this.profile;
    const arch = pick(Math.random, ARCHETYPES);
    p.name = C.randomName();
    p.appearance = C.randomAppearance();
    p.archetype = arch.id;
    p.traits = shuffle(Math.random, TRAITS.filter((t) => t.id !== arch.trait)).slice(0, 2).map((t) => t.id);
    this.justPicked = true;
    this.spinVel = 6;
    this.rebuildRig();
    this.render();
  }

  setLook(key, value) {
    this.profile.appearance[key] = value;
    this.justPicked = false;
    this.rebuildRig();
    this.renderBody();
  }

  // ------------------------------------------------------------------- DOM
  buildDom() {
    this.el = h('div.creator');
    this.panel = h('div.creator-panel');
    this.el.append(this.panel, (this.hint = h('div.creator-hint', 'Drag to rotate · scroll the panel for more options')));
    this.game.ui.append(this.el);
    const cv = this.game.canvas;
    this._down = (e) => {
      this.dragging = true;
      this._lx = e.clientX;
    };
    this._move = (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this._lx;
      this._lx = e.clientX;
      this.spin += dx * 0.01;
      this.spinVel = dx * 0.4;
    };
    this._up = () => (this.dragging = false);
    cv.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    this.render();
  }

  close() {
    const cv = this.game.canvas;
    cv.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    this.el.remove();
    this.rig?.dispose();
  }

  render() {
    const p = this.profile;
    clear(this.panel);
    this.panel.append(
      h('div.creator-head', h('div.creator-title', 'Create your character'), h('div.muted', 'Start with nothing. Build everything.')),
      h(
        'div.tabs',
        TABS.map(([id, label]) =>
          h('button.tab' + (this.tab === id ? '.active' : ''), { onclick: () => this.setTab(id) }, label),
        ),
      ),
      (this.body = h('div.creator-body')),
      h(
        'div.creator-foot',
        btn('🎲 Random', () => this.randomize()),
        this.onBack ? btn('Back', () => this.onBack()) : null,
        h('div.grow'),
        (this.nextBtn = btn('', () => this.next(), 'primary')),
      ),
    );
    void p;
    this.renderBody();
  }

  setTab(id) {
    this.tab = id;
    this.zoomTarget = id === 'look' ? 1 : 0;
    this.render();
  }

  next() {
    const i = TABS.findIndex((t) => t[0] === this.tab);
    const p = this.profile;
    if (i < TABS.length - 1) return this.setTab(TABS[i + 1][0]);
    if (!p.name.trim()) p.name = C.randomName();
    if (p.traits.length < 2) return this.renderBody('Pick two traits to continue.');
    const arch = ARCHETYPE_BY_ID[p.archetype];
    this.onDone({ name: p.name.trim().slice(0, 24), archetype: p.archetype, appearance: { ...p.appearance }, traits: [arch.trait, ...p.traits] });
  }

  renderBody(warn) {
    const keepScroll = this._lastTab === this.tab ? this.body.scrollTop : 0;
    this._lastTab = this.tab;
    const b = clear(this.body);
    queueMicrotask(() => (b.scrollTop = keepScroll));
    const p = this.profile;
    const a = p.appearance;
    const last = this.tab === 'traits';
    this.nextBtn.textContent = last ? 'Start Life →' : 'Next →';

    const chips = (title, opts, cur, key) =>
      h('div.opt', h('div.opt-title', title), h('div.chips', opts.map((o) => h('button.chip' + (o === cur ? '.active' : ''), { onclick: () => this.setLook(key, o) }, C.label(o)))));
    const swatches = (title, colors, cur, key) =>
      h(
        'div.opt',
        h('div.opt-title', title),
        h('div.swatches', colors.map((c) => h('button.swatch' + (c === cur ? '.active' : ''), { style: { background: c }, title: c, onclick: () => this.setLook(key, c) }))),
      );

    if (this.tab === 'background') {
      b.append(
        h('div.muted.pad', 'Where you come from decides your starting cash, debt, skills and one free trait.'),
        h(
          'div.arch-grid',
          ARCHETYPES.map((ar) => {
            const t = TRAIT_BY_ID[ar.trait];
            return h(
              'button.arch' + (ar.id === p.archetype ? '.active' : ''),
              {
                onclick: () => {
                  this.applyArchetype(ar.id);
                  this.renderBody();
                },
              },
              h('div.arch-top', h('span.arch-icon', ar.icon), h('div', h('div.arch-name', ar.name), h('div.arch-money', h('span.good', fmtMoney(ar.cash)), ar.debt ? h('span.bad', ` · ${fmtMoney(ar.debt.amount)} debt`) : h('span.muted', ' · no debt')))),
              h('div.arch-story', ar.backstory),
              h(
                'div.chips.tiny',
                h('span.pill.trait', `${t.icon} ${t.name}`),
                Object.entries(ar.skills).map(([s, v]) => h('span.pill', `${SKILL_BY_ID[s].icon} ${SKILL_BY_ID[s].name} ${v}`)),
                ar.followers ? h('span.pill', `📱 ${ar.followers.toLocaleString()} followers`) : null,
                ar.monthlyExtra ? h('span.pill.warn', `${ar.monthlyExtra.label} ${fmtMoney(ar.monthlyExtra.amount)}/mo`) : null,
              ),
            );
          }),
        ),
      );
    } else if (this.tab === 'look') {
      const models = glbPlayerModels();
      b.append(
        ...[
        h(
          'div.opt',
          h('div.opt-title', 'Name'),
          h(
            'div.row',
            h('input.text', {
              value: p.name,
              maxlength: 24,
              placeholder: 'Your name',
              oninput: (e) => (p.name = e.target.value),
            }),
            btn('🎲', () => {
              p.name = C.randomName();
              this.renderBody();
            }, 'small'),
          ),
        ),
        models.length
          ? h('div.opt', h('div.opt-title', 'Model'), h('div.chips', [null, ...models].map((m) => h('button.chip' + ((a.model || null) === m ? '.active' : ''), { onclick: () => this.setLook('model', m) }, m ? m.replace(/\.[^.]+$/, '') : 'Custom'))))
          : null,
        chips('Body type', C.BODY_TYPES, a.body, 'body'),
        h(
          'div.opt',
          h('div.opt-title', `Height · ${Math.round(a.height * 175)} cm`),
          h('input.slider', {
            type: 'range', min: 0.9, max: 1.1, step: 0.01, value: a.height,
            oninput: (e) => {
              a.height = +e.target.value;
              this.rig.group.scale.setScalar(a.height);
              e.target.parentElement.firstChild.textContent = `Height · ${Math.round(a.height * 175)} cm`;
            },
          }),
        ),
        swatches('Skin tone', C.SKIN_TONES, a.skin, 'skin'),
        chips('Face shape', C.FACE_SHAPES, a.face, 'face'),
        chips('Eyes', C.EYE_SHAPES, a.eyeShape, 'eyeShape'),
        swatches('Eye colour', C.EYE_COLORS, a.eyes, 'eyes'),
        chips('Brows', C.BROWS, a.brows, 'brows'),
        chips('Hairstyle', C.HAIR_STYLES, a.hair, 'hair'),
        swatches('Hair colour', C.HAIR_COLORS, a.hairColor, 'hairColor'),
        chips('Facial hair', C.FACIAL_HAIR, a.facial, 'facial'),
        ].filter(Boolean),
      );
    } else if (this.tab === 'style') {
      b.append(
        chips('Top', C.TOPS, a.top, 'top'),
        swatches('Top colour', C.CLOTH_COLORS, a.topColor, 'topColor'),
        chips('Bottom', C.BOTTOMS, a.bottom, 'bottom'),
        swatches('Bottom colour', C.CLOTH_COLORS, a.bottomColor, 'bottomColor'),
        chips('Shoes', C.SHOES, a.shoes, 'shoes'),
        swatches('Shoe colour', C.CLOTH_COLORS, a.shoeColor, 'shoeColor'),
        chips('Accessory', C.ACCESSORIES, a.accessory, 'accessory'),
        swatches('Accessory colour', C.CLOTH_COLORS, a.accColor || '#c53a3a', 'accColor'),
      );
    } else {
      const arch = ARCHETYPE_BY_ID[p.archetype];
      b.append(
        h('div.pad' + (warn ? '.bad' : '.muted'), warn || `Pick 2 traits (${p.traits.length}/2). ${arch.name} already comes with ${TRAIT_BY_ID[arch.trait].name}.`),
        h(
          'div.trait-grid',
          TRAITS.map((t) => {
            const locked = t.id === arch.trait;
            const on = locked || p.traits.includes(t.id);
            return h(
              'button.trait-card' + (on ? '.active' : '') + (locked ? '.locked' : ''),
              {
                onclick: () => {
                  if (locked) return;
                  if (p.traits.includes(t.id)) p.traits = p.traits.filter((x) => x !== t.id);
                  else if (p.traits.length < 2) p.traits.push(t.id);
                  else p.traits = [p.traits[1], t.id];
                  this.renderBody();
                },
              },
              h('div.trait-name', `${t.icon} ${t.name}`, locked ? h('span.pill.trait', 'background') : null),
              h('div.trait-desc', t.desc),
            );
          }),
        ),
      );
    }
  }
}
