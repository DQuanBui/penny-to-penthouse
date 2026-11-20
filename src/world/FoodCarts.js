// Street food carts: halal, hot dogs, pretzels, ice cream, coffee & bagels,
// fruit, churros & elote, dumplings. Carts stand near street corners all over
// the city (plus the park and transit carts), each with its own menu, a sign
// on both sides and a striped umbrella. Vendors are run by world/StreetLife.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { labelTexture } from './Textures.js';
import { vehicleGeometry, carMaterial } from './CarModel.js';

const F = (id, name, icon, price, needs, line) => ({ id, name, icon, price, needs, line });

export const CART_KINDS = {
  halal: {
    name: 'Halal cart', sign: 'HALAL FOOD', icon: '🥙', body: '#f4f1ea', band: '#c53a3a', umb: ['#e8c23a', '#c53a3a'], steam: true,
    menu: [
      F('overrice', 'Chicken over rice', '🍛', 9, { hunger: 55, fun: 4 }, 'White sauce, hot sauce, extra napkins.'),
      F('gyro', 'Lamb gyro', '🥙', 8, { hunger: 46, fun: 3 }, 'Wrapped tight and dripping.'),
      F('falafel', 'Falafel wrap', '🧆', 7, { hunger: 40 }, 'Crunchy, herby, still hot.'),
      F('soda', 'Can of soda', '🥤', 2, { energy: 4, fun: 3 }, 'Ice cold from the cooler.'),
    ],
  },
  hotdog: {
    name: 'Hot dog cart', sign: 'HOT DOGS', icon: '🌭', body: '#f4f1ea', band: '#2f6db5', umb: ['#2f6db5', '#f2c230'], steam: true,
    menu: [
      F('hotdog', 'Hot dog', '🌭', 4, { hunger: 32, fun: 3 }, 'Mustard, onions, perfect.'),
      F('chilidog', 'Chili cheese dog', '🌭', 5.5, { hunger: 40, fun: 5 }, 'Messy. Worth it.'),
      F('knish', 'Potato knish', '🥟', 3.5, { hunger: 26 }, 'Hot, dense, very filling.'),
      F('soda', 'Can of soda', '🥤', 2, { energy: 4, fun: 3 }, 'Ice cold from the cooler.'),
    ],
  },
  pretzel: {
    name: 'Pretzel & nut cart', sign: 'PRETZELS · NUTS', icon: '🥨', body: '#e9e4d8', band: '#3f6e4a', umb: ['#3f6e4a', '#f4f1ea'], steam: false,
    menu: [
      F('pretzel', 'Soft pretzel', '🥨', 3.5, { hunger: 22 }, 'Warm, salty, gone in a minute.'),
      F('nuts', 'Honey-roasted nuts', '🥜', 4, { hunger: 12, fun: 5 }, 'The smell carries half a block.'),
      F('cocoa', 'Hot chocolate', '☕', 3.5, { fun: 7, energy: 4 }, 'Warms your hands too.'),
    ],
  },
  icecream: {
    name: 'Ice cream cart', sign: 'ICE CREAM', icon: '🍦', body: '#fbf4f6', band: '#e86ab0', umb: ['#e86ab0', '#f4f1ea'], steam: false,
    menu: [
      F('icecream', 'Ice cream cone', '🍦', 4.5, { hunger: 10, fun: 14 }, 'It melts faster than you can eat it.'),
      F('snowcone', 'Rainbow snow cone', '🍧', 3.5, { fun: 12, energy: 3 }, 'Your tongue turns blue.'),
      F('sundae', 'Sundae cup', '🍨', 5.5, { hunger: 14, fun: 16 }, 'Sprinkles, sauce, a cherry on top.'),
      F('lemonade', 'Fresh lemonade', '🍋', 3, { fun: 6, energy: 5 }, 'Cold and tart. Exactly right.'),
    ],
  },
  coffee: {
    name: 'Coffee & bagel cart', sign: 'COFFEE · BAGELS', icon: '☕', body: '#f0ece4', band: '#7a4a2a', umb: ['#7a4a2a', '#e8d6b8'], steam: true,
    menu: [
      F('cartcoffee', 'Coffee, light & sweet', '☕', 2.5, { energy: 18 }, 'Blue paper cup, scalding hot.'),
      F('bagel', 'Bagel with cream cheese', '🥯', 3.5, { hunger: 26 }, 'Toasted, schmeared, wrapped in foil.'),
      F('roll', 'Buttered roll', '🍞', 2.5, { hunger: 18 }, 'Simple. Classic.'),
      F('donut', 'Glazed donut', '🍩', 2, { hunger: 12, fun: 8 }, 'Sticky fingers for an hour.'),
    ],
  },
  fruit: {
    name: 'Fruit stand', sign: 'FRESH FRUIT', icon: '🍓', body: '#f4f1ea', band: '#2f8f4a', umb: ['#2f8f4a', '#f2b33d'], steam: false,
    menu: [
      F('fruitcup', 'Fruit cup', '🍓', 4, { hunger: 14, health: 3 }, 'Melon, pineapple, strawberries.'),
      F('mango', 'Mango on a stick', '🥭', 5, { hunger: 16, fun: 6 }, 'With chili and lime.'),
      F('banana', 'Two bananas', '🍌', 1, { hunger: 12 }, 'A dollar. Unbeatable.'),
      F('coconut', 'Coconut water', '🥥', 4, { energy: 6, fun: 4 }, 'Straw straight into the shell.'),
    ],
  },
  churro: {
    name: 'Churro & elote cart', sign: 'CHURROS · ELOTE', icon: '🌽', body: '#f7efe0', band: '#e07b39', umb: ['#e07b39', '#2f8f8f'], steam: true,
    menu: [
      F('churros', 'Churros', '🥖', 4, { hunger: 14, fun: 10 }, 'Cinnamon sugar everywhere.'),
      F('elote', 'Elote', '🌽', 4.5, { hunger: 24, fun: 6 }, 'Mayo, cotija, chili, lime.'),
      F('aguafresca', 'Agua fresca', '🍹', 3.5, { fun: 6, energy: 6 }, 'Watermelon, over ice.'),
    ],
  },
  dumpling: {
    name: 'Dumpling cart', sign: 'DUMPLINGS', icon: '🥟', body: '#f4f1ea', band: '#b5343c', umb: ['#b5343c', '#e9c04c'], steam: true,
    menu: [
      F('dumplings', 'Pork dumplings (6)', '🥟', 5, { hunger: 32, fun: 4 }, 'Pan-fried, with chili oil.'),
      F('scallion', 'Scallion pancake', '🫓', 4, { hunger: 24 }, 'Flaky and greasy in the best way.'),
      F('bubbletea', 'Bubble tea', '🧋', 5.5, { fun: 10, energy: 5 }, 'Extra pearls.'),
    ],
  },
};
// the station newsstand sells from the same kind of menu (not a street cart)
CART_KINDS.newsstand = {
  name: 'Newsstand', sign: 'NEWS', icon: '📰', body: '#3f5a3a', band: '#2b3a28', umb: ['#3f5a3a', '#f4f1ea'], steam: false,
  menu: [
    F('water', 'Bottle of water', '💧', 2, { energy: 4 }, 'Cold, from the fridge by the register.'),
    F('candy', 'Candy bar', '🍫', 2, { hunger: 10, fun: 4 }, 'Gone before the train comes.'),
    F('paper', 'Newspaper', '📰', 1.5, { fun: 7 }, 'Something to read on the ride.'),
    F('gum', 'Pack of gum', '🍬', 1, { fun: 2 }, 'Minty.'),
  ],
};
// food trucks parked at the kerb (not street carts)
const TRUCKS = {
  taco_truck: { name: 'Taco truck', sign: 'TACOS EL SOL', icon: '🌮', body: '#f2c230', band: '#c53a3a', umb: ['#c53a3a', '#3fbf7a'], menu: [
    F('tacos3', 'Three tacos al pastor', '🌮', 9, { hunger: 42, fun: 6 }, 'Pineapple, cilantro, a squeeze of lime.'),
    F('burrito', 'Loaded burrito', '🌯', 11, { hunger: 58, fun: 4 }, 'Heavy enough to count as a workout.'),
    F('horchata', 'Horchata', '🥛', 4, { fun: 5, energy: 4 }, 'Cinnamon and ice.'),
  ] },
  burger_truck: { name: 'Burger truck', sign: 'SMASH BROS BURGERS', icon: '🍔', body: '#1d1f24', band: '#e9c04c', umb: ['#e9c04c', '#1d1f24'], menu: [
    F('smash', 'Double smash burger', '🍔', 12, { hunger: 55, fun: 7 }, 'Crispy edges, melty cheese, secret sauce.'),
    F('fries', 'Loaded fries', '🍟', 7, { hunger: 30, fun: 5 }, 'Cheese, bacon bits, a lot of napkins.'),
    F('shake', 'Milkshake', '🥤', 6, { fun: 10, hunger: 10 }, 'So thick the straw stands up.'),
  ] },
  kbbq_truck: { name: 'Korean BBQ truck', sign: 'SEOUL ON WHEELS', icon: '🥢', body: '#f4f1ea', band: '#2f6db5', umb: ['#2f6db5', '#c53a3a'], menu: [
    F('bulgogi', 'Bulgogi rice bowl', '🍚', 12, { hunger: 52, fun: 5 }, 'Sweet, smoky, a fried egg on top.'),
    F('kfc', 'Korean fried chicken', '🍗', 11, { hunger: 44, fun: 8 }, 'Double fried, gochujang glaze.'),
    F('tteok', 'Spicy rice cakes', '🌶️', 8, { hunger: 30, fun: 6 }, 'Chewy and fiery.'),
  ] },
  crepe_truck: { name: 'Crêpe truck', sign: 'LA PETITE CRÊPE', icon: '🥞', body: '#e8c6d8', band: '#7a3f6a', umb: ['#7a3f6a', '#f4f1ea'], menu: [
    F('nutella', 'Chocolate-hazelnut crêpe', '🥞', 8, { hunger: 22, fun: 12 }, 'Folded in a paper cone. Messy, perfect.'),
    F('savory', 'Ham and cheese galette', '🧀', 10, { hunger: 38 }, 'Buckwheat, crispy at the edges.'),
    F('latte', 'Café au lait', '☕', 4, { energy: 14 }, 'In a bowl-sized cup.'),
  ] },
  lobster_truck: { name: 'Lobster roll truck', sign: 'HARBOR LOBSTER CO.', icon: '🦞', body: '#c53a3a', band: '#f4f1ea', umb: ['#f4f1ea', '#2f6db5'], menu: [
    F('lobroll', 'Lobster roll', '🦞', 24, { hunger: 40, fun: 14 }, 'Buttered, toasted, piled high. Worth every cent.'),
    F('chowder', 'Clam chowder', '🥣', 9, { hunger: 34 }, 'Creamy, with oyster crackers.'),
    F('lemonade2', 'Fresh lemonade', '🍋', 4, { fun: 6, energy: 5 }, 'Cold and tart.'),
  ] },
  greek_truck: { name: 'Greek truck', sign: 'OPA! STREET FOOD', icon: '🥙', body: '#f4f1ea', band: '#2f5aa3', umb: ['#2f5aa3', '#f4f1ea'], menu: [
    F('souvlaki', 'Chicken souvlaki pita', '🥙', 10, { hunger: 46, fun: 5 }, 'Tzatziki, tomato, onion, fries tucked inside.'),
    F('spanakopita', 'Spanakopita', '🥧', 6, { hunger: 24 }, 'Flaky and buttery.'),
    F('baklava', 'Baklava', '🍯', 4, { hunger: 10, fun: 9 }, 'Honey all over your fingers.'),
  ] },
};
Object.assign(CART_KINDS, TRUCKS);
export const TRUCK_IDS = Object.keys(TRUCKS);
export const CART_IDS = Object.keys(CART_KINDS).filter((k) => k !== 'newsstand' && !TRUCKS[k]);

class Bag {
  constructor() {
    this.list = [];
  }
  add(geo, color, x, y, z, ry) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.rotateY(ry);
    geo.translate(x, y, z);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.deleteAttribute('uv');
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
  }
}
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cy = (r0, r1, h, x = 0, y = 0, z = 0, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s).translate(x, y, z);

/** One cart in local coordinates (front, where customers stand, faces +z). */
function cartGeometry(bag, k, x, y, z, ry) {
  const g = (geo, c) => bag.add(geo, c, x, y, z, ry);
  const steel = '#b9bdc3';
  g(bx(1.8, 0.95, 0.9, 0, 0.75, 0), k.body);
  g(bx(1.82, 0.26, 0.92, 0, 0.6, 0), k.band);
  g(bx(1.9, 0.06, 1.0, 0, 1.25, 0), steel);
  // glass sneeze guard and the grill / display on top
  g(bx(1.6, 0.32, 0.03, 0, 1.44, 0.42), '#cfe3ea');
  g(bx(0.7, 0.12, 0.5, -0.45, 1.34, -0.05), k.steam ? '#3a3d44' : '#d9d9d9');
  g(bx(0.5, 0.18, 0.4, 0.45, 1.37, -0.05), '#d9d9d9');
  // wheels, handle, a cooler on the side
  for (const wx of [-0.75, 0.75]) g(cy(0.24, 0.24, 0.1, wx, 0.24, -0.47, 14).rotateX(0), '#26282d');
  g(cy(0.025, 0.025, 0.9, -1.05, 1.0, 0, 6).rotateZ(Math.PI / 2), steel);
  g(bx(0.5, 0.45, 0.5, 1.2, 0.22, 0.1), '#2f6db5');
  // umbrella: pole and eight alternating panels
  g(cy(0.035, 0.035, 1.6, 0.6, 2.05, -0.25, 6), steel);
  for (let i = 0; i < 8; i++) g(new THREE.ConeGeometry(1.5, 0.55, 1, 1, true, (i * Math.PI) / 4, Math.PI / 4).translate(0.6, 3.05, -0.25), k.umb[i % 2]);
}

/** Carts on street corners (and the visuals for every vendor cart spot). */
export function buildFoodCarts(ctx) {
  const { blocks, K, rng, colliders, places, reserved, group, cfg } = ctx;
  const Y = K.CURB;
  const share = cfg.foodCarts ?? 0.36;
  const doors = places.map((p) => [p.doorX, p.doorZ]);
  const clear = (x, z) => {
    for (const p of reserved) if ((p.x - x) ** 2 + (p.z - z) ** 2 < 3.4 * 3.4) return false;
    for (const [dx, dz] of doors) if ((dx - x) ** 2 + (dz - z) ** 2 < 3.2 * 3.2) return false;
    return !colliders.pointBlocked(x, 0.5, z, 0.9);
  };
  const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let n = 0;
  for (const b of blocks) {
    if (['zoo', 'airport', 'campus'].includes(b.kind)) continue;
    if (rng() > share) continue;
    // a corner: one side of the block, near one end
    const [nx, nz] = SIDES[Math.floor(rng() * 4)];
    const t = rng() < 0.5 ? -16.5 : 16.5;
    const e = K.BLOCK / 2 - 1.6;
    const x = b.cx + nx * e - nz * t;
    const z = b.cz + nz * e + nx * t;
    if (!clear(x, z)) continue;
    const ry = Math.atan2(-nx, -nz);
    const kind = CART_IDS[Math.floor(rng() * CART_IDS.length)];
    const hw = nx ? 0.55 : 1.0;
    const hd = nx ? 1.0 : 0.55;
    colliders.add(x - hw, z - hd, x + hw, z + hd, 1.4);
    reserved.push({ x, z });
    ctx.vendors.push({ x, z, ry, kind: 'cart', cart: kind, id: `corner_${b.i}_${b.j}`, corner: true });
    n++;
  }
  // every cart spot (parks, transit, corners) gets its cart
  const bag = new Bag();
  const signs = new Map();
  for (const v of ctx.vendors) {
    const k = CART_KINDS[v.cart] || CART_KINDS.hotdog;
    cartGeometry(bag, k, v.x, Y, v.z, v.ry);
    // sign on the front (customers) and the back (the street)
    for (const back of [false, true]) {
      const p = new THREE.PlaneGeometry(1.6, 0.4);
      if (back) p.rotateY(Math.PI);
      p.translate(0, 0.86, back ? -0.465 : 0.465);
      p.rotateY(v.ry);
      p.translate(v.x, Y, v.z);
      if (!signs.has(k)) signs.set(k, []);
      signs.get(k).push(p);
    }
  }
  if (bag.list.length) {
    const mesh = new THREE.Mesh(mergeGeometries(bag.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const [k, list] of signs) {
    const mat = new THREE.MeshBasicMaterial({ map: labelTexture(k.sign, { icon: k.icon, bg: k.band, accent: k.umb[1] === '#f4f1ea' ? '#1d1f24' : k.umb[1], w: 512, h: 128 }), toneMapped: false });
    mat.userData.ownMap = true;
    group.add(new THREE.Mesh(mergeGeometries(list), mat));
  }
  return n;
}

/**
 * Food trucks parked in the kerb lane beside parks and landmark plazas, with
 * the serving window on the sidewalk side. Spots join ctx.vendors (truck: true).
 */
export function buildFoodTrucks(ctx, lane) {
  const { group, colliders, K, rng, blocks, roadCenter, N } = ctx;
  const spots = [];
  const sites = blocks.filter((b) => b.kind === 'park' || b.kind === 'landmark').slice(0, 10);
  for (const b of sites) {
    // the north side of the block (when there is a street there), parked toward the east
    if (b.j === 0) continue;
    const z = roadCenter(b.j) + lane;
    const x = b.cx + (rng() - 0.5) * 20;
    spots.push({ x, z, ry: Math.PI / 2, nx: 0, nz: 1, kind: TRUCK_IDS[spots.length % TRUCK_IDS.length] });
    void N;
  }
  const mat = carMaterial();
  const types = {};
  for (const s of spots) (types[s.kind] ||= []).push(s);
  const geo = vehicleGeometry('box', { low: true }).body;
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  const bag = new Bag();
  const signs = new Map();
  const m4 = new THREE.Matrix4();
  spots.forEach((s, i) => {
    const k = CART_KINDS[s.kind];
    m4.makeRotationY(s.ry).setPosition(s.x, 0, s.z);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, new THREE.Color(k.body));
    // serving window, counter, awning on the sidewalk side (local +x is the sidewalk when ry = PI/2... use the normal)
    const side = (geo2, color) => bag.add(geo2, color, s.x, 0, s.z, 0);
    const wx = s.x;
    const wz = s.z + s.nz * 1.12;
    side(new THREE.BoxGeometry(2.4, 1.0, 0.06).translate(0, 1.55, 0).translate(wx - s.x, 0, wz - s.z), '#1a1b1f');
    side(new THREE.BoxGeometry(2.6, 0.06, 0.4).translate(0, 1.05, 0).translate(wx - s.x, 0, wz - s.z + s.nz * 0.18), '#c9ced6');
    side(new THREE.BoxGeometry(2.9, 0.06, 1.0).rotateX(-s.nz * 0.35).translate(0, 2.35, 0).translate(wx - s.x, 0, wz - s.z + s.nz * 0.45), k.band);
    const p = new THREE.PlaneGeometry(2.6, 0.62).translate(s.x, 2.75, s.z + s.nz * 1.13);
    if (!signs.has(k)) signs.set(k, []);
    signs.get(k).push(p);
    colliders.add(s.x - 3.4, s.z - 1.15, s.x + 3.4, s.z + 1.15, 3);
    // the cook stands inside at the window; customers queue on the sidewalk
    ctx.vendors.push({ x: s.x, z: s.z + s.nz * 2.2, ry: Math.atan2(0, -s.nz) + Math.PI, kind: 'cart', cart: s.kind, id: 'truck_' + i, truck: true, vx: s.x, vz: s.z + s.nz * 0.55, vy: 0.75 });
  });
  if (spots.length) {
    inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    group.add(inst);
    const mesh = new THREE.Mesh(mergeGeometries(bag.list), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    group.add(mesh);
    for (const [k, list] of signs) {
      const mat2 = new THREE.MeshBasicMaterial({ map: labelTexture(k.sign, { icon: k.icon, bg: k.band, accent: k.umb[1] }), toneMapped: false });
      mat2.userData.ownMap = true;
      group.add(new THREE.Mesh(mergeGeometries(list), mat2));
    }
  }
  ctx.truckSpots = spots;
  return spots.length;
}

/** Rising steam puffs over a cart's grill (added to the vendor's group). */
export function steamPuffs() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat.clone());
    m.userData.phase = i / 4;
    g.add(m);
  }
  g.userData.tick = (t) => {
    for (const m of g.children) {
      const p = (t * 0.45 + m.userData.phase) % 1;
      m.position.set(-0.45 + Math.sin(p * 9 + m.userData.phase * 6) * 0.08, 1.45 + p * 1.1, 0.9);
      m.scale.setScalar(0.6 + p * 1.6);
      m.material.opacity = 0.32 * (1 - p);
    }
  };
  return g;
}
