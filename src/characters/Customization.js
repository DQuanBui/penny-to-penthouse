// Appearance options for the character creator and random NPC generation.
// Pure data + helpers (no three.js) so the sim and save files can use it.
import { pick } from '../core/utils.js';

export const SKIN_TONES = ['#fde0cc', '#f6cfb0', '#edbd98', '#e0a67e', '#d0936a', '#bd7f56', '#a56a44', '#8a5435', '#6e412a', '#553222', '#40251a'];
export const HAIR_COLORS = ['#17130f', '#2e1f16', '#4a2f1d', '#6b4526', '#8f5f30', '#b5803f', '#d8b162', '#e9d9a8', '#9a3b24', '#c0c0c4', '#f2f2f0', '#3d6fd0', '#d04f8a', '#3fa07a', '#7a4fd0'];
export const EYE_COLORS = ['#3b2616', '#5c3a1e', '#7a5a2c', '#3f6f4a', '#3a6ea5', '#5f8fbf', '#6b6f78', '#2a2a2e'];
export const CLOTH_COLORS = ['#f4f4f2', '#1d1f24', '#3a4254', '#7a8494', '#c53a3a', '#e07b39', '#e9c04c', '#4f9d5d', '#2f8f8f', '#3f76d0', '#5a4fd0', '#a04fc0', '#e06a9a', '#8a5a3c', '#d9c7a8', '#27406b'];

export const BODY_TYPES = ['slim', 'average', 'athletic', 'curvy', 'heavy'];
export const FACE_SHAPES = ['oval', 'round', 'square', 'heart'];
export const EYE_SHAPES = ['round', 'almond', 'wide', 'narrow'];
export const BROWS = ['soft', 'thick', 'arched', 'straight'];
export const HAIR_STYLES = ['bald', 'buzz', 'short', 'sidepart', 'quiff', 'curly', 'afro', 'long', 'wavy', 'bob', 'ponytail', 'bun', 'mohawk', 'braids'];
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'goatee', 'beard'];
export const TOPS = ['tee', 'tank', 'shirt', 'hoodie', 'sweater', 'blazer', 'jacket', 'dress'];
export const BOTTOMS = ['jeans', 'slacks', 'joggers', 'shorts', 'skirt'];
export const SHOES = ['sneakers', 'boots', 'dress', 'sandals'];
export const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'cap', 'beanie', 'headphones', 'watch', 'necklace', 'backpack'];

export const LABELS = {
  bald: 'Bald', buzz: 'Buzz Cut', short: 'Short', sidepart: 'Side Part', quiff: 'Quiff', curly: 'Curly', afro: 'Afro', long: 'Long',
  wavy: 'Wavy', bob: 'Bob', ponytail: 'Ponytail', bun: 'Top Bun', mohawk: 'Mohawk', braids: 'Braids',
  tee: 'T-Shirt', tank: 'Tank Top', shirt: 'Button-Up', hoodie: 'Hoodie', sweater: 'Sweater', blazer: 'Blazer', jacket: 'Jacket', dress: 'Dress',
};
export const label = (id) => LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1);

export function defaultAppearance() {
  return {
    body: 'average', height: 1.0, skin: '#e0a67e', face: 'oval', eyes: '#5c3a1e', eyeShape: 'round', brows: 'soft',
    hair: 'short', hairColor: '#2e1f16', facial: 'none',
    top: 'hoodie', topColor: '#3f76d0', bottom: 'jeans', bottomColor: '#27406b', shoes: 'sneakers', shoeColor: '#f4f4f2', accessory: 'none',
  };
}

export function randomAppearance(rng = Math.random) {
  const facial = rng() < 0.3 ? pick(rng, FACIAL_HAIR) : 'none';
  return {
    body: pick(rng, BODY_TYPES),
    height: 0.92 + rng() * 0.16,
    skin: pick(rng, SKIN_TONES),
    face: pick(rng, FACE_SHAPES),
    eyes: pick(rng, EYE_COLORS),
    eyeShape: pick(rng, EYE_SHAPES),
    brows: pick(rng, BROWS),
    hair: pick(rng, HAIR_STYLES),
    hairColor: rng() < 0.85 ? pick(rng, HAIR_COLORS.slice(0, 10)) : pick(rng, HAIR_COLORS),
    facial,
    top: pick(rng, TOPS),
    topColor: pick(rng, CLOTH_COLORS),
    bottom: pick(rng, BOTTOMS),
    bottomColor: pick(rng, ['#27406b', '#1d1f24', '#3a4254', '#7a8494', '#8a5a3c', '#d9c7a8', '#2b3a55']),
    shoes: pick(rng, SHOES),
    shoeColor: pick(rng, ['#f4f4f2', '#1d1f24', '#8a5a3c', '#c53a3a', '#3a4254']),
    accessory: rng() < 0.45 ? pick(rng, ACCESSORIES) : 'none',
  };
}

/**
 * Everyday people of the city. weight = share of the crowd; look(rng) overrides a
 * random appearance. Brands are never shown; uniforms are generic.
 */
const NAVY = '#1f2a44';
export const ROLES = {
  civilian: { weight: 40, look: () => ({}) },
  business: { weight: 12, look: (r) => { const s = pick(r, ['#1d1f24', '#2a3140', '#27406b', '#4a4f5a', '#5b4a3c']); return { top: r() < 0.3 ? 'coat' : 'blazer', topColor: s, bottom: 'slacks', bottomColor: s, shoes: 'dress', shoeColor: '#1d1f24', accentColor: pick(r, ['#b5343c', '#27406b', '#c9a227', '#3f6e4a']), carry: r() < 0.6 ? 'briefcase' : 'coffee', carryColor: '#3a2a1e', accessory: r() < 0.3 ? 'watch' : 'none' }; } },
  police: { weight: 3, look: () => ({ top: 'uniform', topColor: NAVY, bottom: 'slacks', bottomColor: NAVY, shoes: 'boots', shoeColor: '#141518', hat: 'policecap', hatColor: NAVY, accessory: 'none' }) },
  construction: { weight: 4, look: (r) => ({ top: 'vest', topColor: pick(r, ['#ff7a1a', '#d4f03a']), shirtColor: pick(r, ['#e9e6df', '#7a8494', '#3a4254']), bottom: 'jeans', bottomColor: '#3a4a66', shoes: 'boots', shoeColor: '#8a5a34', hat: 'hardhat', hatColor: pick(r, ['#f2c230', '#f4f4f2', '#ff7a1a']), accessory: 'none', body: pick(r, ['average', 'athletic', 'heavy']) }) },
  nurse: { weight: 4, look: (r) => { const c = pick(r, ['#4aa3b5', '#3d6fa3', '#7fb3d5', '#5a4f8a', '#2f8f7a']); return { top: 'scrubs', topColor: c, bottom: 'slacks', bottomColor: c, shoes: 'sneakers', shoeColor: '#f4f4f2', carry: r() < 0.5 ? 'coffee' : 'none', carryColor: '#7a5a3c', accessory: 'none' }; } },
  doctor: { weight: 1, look: () => ({ top: 'labcoat', topColor: '#f6f6f4', shirtColor: '#a9c7e8', bottom: 'slacks', bottomColor: '#3a4254', shoes: 'dress', shoeColor: '#1d1f24', accessory: 'glasses' }) },
  chef: { weight: 1, look: () => ({ top: 'chefcoat', topColor: '#f6f6f4', bottom: 'slacks', bottomColor: '#1d1f24', shoes: 'sneakers', shoeColor: '#1d1f24', hat: 'chefhat', accessory: 'none' }) },
  delivery: { weight: 3, look: (r) => { const c = pick(r, ['#c53a3a', '#2f8f4a', '#e07b39', '#2f5aa3']); return { top: 'jacket', topColor: c, bottom: 'joggers', bottomColor: '#1d1f24', shoes: 'sneakers', shoeColor: '#1d1f24', accessory: 'cap', accColor: c, carry: 'deliverybag', carryColor: c }; } },
  mail: { weight: 1, look: () => ({ top: 'uniform', topColor: '#8fa3b8', badgeColor: '#c53a3a', patchColor: '#27406b', bottom: 'shorts', bottomColor: '#27406b', shoes: 'sneakers', shoeColor: '#1d1f24', accessory: 'cap', accColor: '#27406b', carry: 'mailbag', carryColor: '#5a4632' }) },
  student: { weight: 8, look: (r) => ({ top: pick(r, ['hoodie', 'tee', 'sweater', 'jacket']), bottom: pick(r, ['jeans', 'joggers']), shoes: 'sneakers', accessory: r() < 0.7 ? 'backpack' : 'headphones', accColor: pick(r, CLOTH_COLORS), height: 0.92 + r() * 0.08 }) },
  teacher: { weight: 2, look: (r) => ({ top: pick(r, ['sweater', 'shirt', 'blazer']), bottom: pick(r, ['slacks', 'skirt', 'jeans']), shoes: pick(r, ['dress', 'boots']), accessory: 'glasses', carry: 'tote', carryColor: pick(r, ['#d9c7a8', '#3f6e4a', '#8a5a3c']) }) },
  tourist: { weight: 4, look: (r) => ({ top: 'tee', topColor: pick(r, ['#e9c04c', '#e06a9a', '#2f8f8f', '#f4f4f2', '#3f76d0']), bottom: 'shorts', bottomColor: pick(r, ['#d9c7a8', '#7a8494', '#27406b']), shoes: pick(r, ['sneakers', 'sandals']), hat: r() < 0.5 ? 'sunhat' : 'none', hatColor: pick(r, ['#e8dcc0', '#f4f4f2', '#d9b48a']), accessory: r() < 0.5 ? 'sunglasses' : 'backpack', carry: 'camera' }) },
  jogger: { weight: 3, look: (r) => ({ top: 'tank', topColor: pick(r, ['#ff5a3c', '#3fd0a0', '#3f76d0', '#e9c04c', '#1d1f24']), bottom: 'shorts', bottomColor: '#1d1f24', shoes: 'sneakers', shoeColor: pick(r, ['#ff5a3c', '#f4f4f2', '#3fd0a0']), accessory: 'headphones', accColor: '#1d1f24', body: pick(r, ['slim', 'athletic']) }) },
  shopper: { weight: 5, look: (r) => ({ carry: 'shoppingbag', carryColor: pick(r, ['#c53a3a', '#1d1f24', '#e9c04c', '#f4f4f2', '#2f8f8f', '#a04fc0']) }) },
  homeless: { weight: 0, look: (r) => ({ top: 'coat', topColor: pick(r, ['#4a4438', '#3a3f48', '#5a4a3a', '#2f3a33']), scarfColor: pick(r, ['#7a3b3b', '#5a5a4a', '#3a4a5a']), bottom: 'jeans', bottomColor: pick(r, ['#3a3f48', '#4a4438']), shoes: 'boots', shoeColor: '#3a2f28', accessory: 'beanie', accColor: pick(r, ['#5a5a5a', '#7a3b3b', '#2f3a5a']), facial: pick(r, ['beard', 'stubble', 'none']) }) },
};
export const ROLE_IDS = Object.keys(ROLES);
const ROLE_TOTAL = ROLE_IDS.reduce((s, k) => s + ROLES[k].weight, 0);

/** A random role by crowd share. */
export function randomRole(rng = Math.random) {
  let r = rng() * ROLE_TOTAL;
  for (const k of ROLE_IDS) {
    r -= ROLES[k].weight;
    if (r <= 0) return k;
  }
  return 'civilian';
}

/** A random person dressed for their role (police, nurse, tourist...). */
export function roleAppearance(role, rng = Math.random) {
  const base = randomAppearance(rng);
  const extra = (ROLES[role] || ROLES.civilian).look(rng);
  return { ...base, hat: 'none', carry: 'none', ...extra, role };
}

const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Avery', 'Quinn', 'Jamie', 'Sam', 'Maya', 'Leo', 'Nina', 'Omar', 'Zoe', 'Kai', 'Priya', 'Mateo', 'Aisha', 'Devin', 'Lena', 'Marcus', 'Sofia', 'Ethan', 'Noor', 'Diego', 'Hana', 'Tyler', 'Imani', 'Lucas'];
const LAST = ['Rivera', 'Chen', 'Brooks', 'Patel', 'Nguyen', 'Carter', 'Kim', 'Morales', 'Bennett', 'Okafor', 'Rossi', 'Hayes', 'Ali', 'Sullivan', 'Park', 'Reyes', 'Foster', 'Singh', 'Cruz', 'Walker'];
export const randomName = (rng = Math.random) => `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
