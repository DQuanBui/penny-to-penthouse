// Appearance options for the character creator and random NPC generation.
// Pure data + helpers (no three.js) so the sim and save files can use it.
import { pick } from '../core/utils.js';

export const SKIN_TONES = ['#fde0cc', '#f6cfb0', '#edbd98', '#e0a67e', '#d0936a', '#bd7f56', '#a56a44', '#8a5435', '#6e412a', '#553222', '#40251a'];
export const HAIR_COLORS = ['#17130f', '#2e1f16', '#4a2f1d', '#6b4526', '#8f5f30', '#b5803f', '#d8b162', '#e9d9a8', '#9a3b24', '#c0c0c4', '#f2f2f0', '#3d6fd0', '#d04f8a', '#3fa07a', '#7a4fd0'];
export const EYE_COLORS = ['#3b2616', '#5c3a1e', '#7a5a2c', '#3f6f4a', '#3a6ea5', '#5f8fbf', '#6b6f78', '#2a2a2e', '#3fa0e0', '#8a4fd0', '#d84a7a', '#3fbf7a', '#d4a02a'];
export const CLOTH_COLORS = ['#f4f4f2', '#1d1f24', '#3a4254', '#7a8494', '#c53a3a', '#e07b39', '#e9c04c', '#4f9d5d', '#2f8f8f', '#3f76d0', '#5a4fd0', '#a04fc0', '#e06a9a', '#8a5a3c', '#d9c7a8', '#27406b'];

export const BODY_TYPES = ['slim', 'average', 'athletic', 'curvy', 'heavy'];
export const FACE_SHAPES = ['oval', 'round', 'square', 'heart'];
export const EYE_SHAPES = ['round', 'almond', 'wide', 'narrow'];
export const BROWS = ['soft', 'thick', 'arched', 'straight'];
export const HAIR_STYLES = ['bald', 'buzz', 'short', 'sidepart', 'quiff', 'curly', 'afro', 'long', 'wavy', 'bob', 'ponytail', 'bun', 'mohawk', 'braids', 'spiky', 'twintails', 'hime'];
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'goatee', 'beard'];
export const TOPS = ['tee', 'tank', 'shirt', 'hoodie', 'sweater', 'blazer', 'jacket', 'dress'];
export const BOTTOMS = ['jeans', 'slacks', 'joggers', 'shorts', 'skirt'];
export const SHOES = ['sneakers', 'boots', 'dress', 'sandals'];
export const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'cap', 'beanie', 'headphones', 'watch', 'necklace', 'backpack'];

export const LABELS = {
  bald: 'Bald', buzz: 'Buzz Cut', short: 'Short', sidepart: 'Side Part', quiff: 'Quiff', curly: 'Curly', afro: 'Afro', long: 'Long',
  wavy: 'Wavy', bob: 'Bob', ponytail: 'Ponytail', bun: 'Top Bun', mohawk: 'Mohawk', braids: 'Braids', spiky: 'Spiky', twintails: 'Twin Tails', hime: 'Long Straight',
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
  beach: { weight: 0, look: (r) => ({ top: 'tank', topColor: pick(r, ['#e84a4a', '#2f6db5', '#f2b33d', '#3fd0a0', '#e86ab0', '#f4f1ea', '#ff7a45', '#1d1f24']), bottom: 'shorts', bottomColor: pick(r, ['#2f6db5', '#e84a4a', '#1d1f24', '#f2c230', '#2f8f8f', '#e86ab0']), shoes: 'sandals', shoeColor: pick(r, ['#1d1f24', '#f4f1ea', '#e84a4a']), hat: r() < 0.25 ? 'sunhat' : 'none', hatColor: '#e8dcc0', accessory: r() < 0.45 ? 'sunglasses' : 'none' }) },
  vendor: { weight: 0, look: (r) => ({ top: pick(r, ['tee', 'jacket', 'hoodie']), topColor: pick(r, ['#3a4254', '#7a3b3b', '#2f5a3a', '#1d1f24']), bottom: 'jeans', shoes: 'sneakers', apron: true, apronColor: pick(r, ['#f4f1ea', '#e9e2d0', '#c9d6e3']), accessory: 'cap', accColor: pick(r, ['#c53a3a', '#2f6db5', '#1d1f24', '#e9c04c']) }) },
  firefighter: { weight: 1, look: (r) => { const c = r() < 0.6 ? '#c9a24a' : '#2b2b2e'; return { top: 'turnout', topColor: c, bottom: 'slacks', bottomColor: c, shoes: 'boots', shoeColor: '#141518', hat: 'firehelmet', hatColor: r() < 0.7 ? '#1d1f24' : '#c53a3a', accessory: 'none', body: pick(r, ['athletic', 'average', 'heavy']) }; } },
  paramedic: { weight: 1, look: () => ({ top: 'uniform', topColor: '#27406b', badgeColor: '#f4f4f2', patchColor: '#c53a3a', bottom: 'slacks', bottomColor: '#1d2433', shoes: 'boots', shoeColor: '#141518', accessory: 'none' }) },
  sanitation: { weight: 1, look: (r) => ({ top: 'vest', topColor: '#9bd13a', shirtColor: '#3f6e4a', bottom: 'slacks', bottomColor: '#3f5a3a', shoes: 'boots', shoeColor: '#3a2f28', accessory: 'cap', accColor: '#3f6e4a', body: pick(r, ['average', 'heavy', 'athletic']) }) },
  rich: { weight: 2, look: (r) => ({ top: pick(r, ['coat', 'blazer', 'coat']), topColor: pick(r, ['#c19a6b', '#1d1f24', '#e8dcc0', '#5b4a3c', '#7a1f2b']), bottom: pick(r, ['slacks', 'skirt']), bottomColor: pick(r, ['#1d1f24', '#e8dcc0', '#3a3f48']), shoes: 'dress', shoeColor: pick(r, ['#1d1f24', '#7a1f2b', '#c19a6b']), accessory: pick(r, ['sunglasses', 'necklace', 'watch', 'sunglasses']), carry: r() < 0.7 ? 'shoppingbag' : 'none', carryColor: pick(r, ['#1d1f24', '#f4f1ea', '#e07b39', '#c9a227']), body: pick(r, ['slim', 'average']) }) },
  elderly: { weight: 3, look: (r) => ({ hairColor: pick(r, ['#d8d8d4', '#b9b9b4', '#8a8a86', '#efefe9']), top: pick(r, ['sweater', 'coat', 'shirt']), topColor: pick(r, ['#8a7a62', '#5a6a7a', '#7a3b3b', '#c9b9a0', '#3f6e4a']), bottom: 'slacks', bottomColor: pick(r, ['#5c6370', '#8a7a62', '#3a3f48']), shoes: pick(r, ['dress', 'sneakers']), accessory: r() < 0.6 ? 'glasses' : 'none', carry: r() < 0.6 ? 'cane' : 'tote', carryColor: '#5a4030', height: 0.92 + r() * 0.06, facial: r() < 0.2 ? 'mustache' : 'none' }) },
  parent: { weight: 2, look: (r) => ({ top: pick(r, ['jacket', 'hoodie', 'sweater', 'tee']), bottom: pick(r, ['jeans', 'joggers']), shoes: 'sneakers', carry: 'stroller', carryColor: pick(r, ['#2f6db5', '#3a3f48', '#7a3b3b', '#3f6e4a', '#c9b9a0']), accessory: r() < 0.4 ? 'sunglasses' : 'none' }) },
  skater: { weight: 1, look: (r) => ({ top: pick(r, ['hoodie', 'tee']), topColor: pick(r, ['#1d1f24', '#c53a3a', '#e9c04c', '#2f8f8f', '#f4f4f2']), bottom: pick(r, ['jeans', 'joggers']), shoes: 'sneakers', shoeColor: pick(r, ['#1d1f24', '#f4f4f2']), accessory: pick(r, ['beanie', 'cap', 'headphones']), accColor: pick(r, ['#1d1f24', '#c53a3a', '#2f5aa3']), carry: 'skateboard', carryColor: pick(r, ['#c53a3a', '#1d1f24', '#e9c04c', '#2f8f8f']), body: 'slim' }) },
  musician: { weight: 1, look: (r) => ({ top: pick(r, ['jacket', 'hoodie', 'tee']), topColor: pick(r, ['#1d1f24', '#3a3f48', '#5a4a8a', '#7a5a42']), bottom: 'jeans', shoes: 'boots', accessory: r() < 0.5 ? 'beanie' : 'none', accColor: '#1d1f24', carry: 'guitarcase', carryColor: '#1d1f24' }) },
  poor: { weight: 2, look: (r) => ({ top: pick(r, ['hoodie', 'coat', 'jacket']), topColor: pick(r, ['#4a4438', '#3a3f48', '#5a4a3a', '#2f3a33', '#5a5a5a']), bottom: 'jeans', bottomColor: pick(r, ['#3a3f48', '#4a4438']), shoes: pick(r, ['sneakers', 'boots']), shoeColor: '#3a2f28', accessory: r() < 0.5 ? 'beanie' : 'none', accColor: pick(r, ['#5a5a5a', '#3a4a5a']), carry: 'shoppingbag', carryColor: '#ecebe6' }) },
  kid: { weight: 3, look: (r) => ({ height: 0.58 + r() * 0.12, body: 'slim', top: pick(r, ['tee', 'hoodie', 'jacket']), topColor: pick(r, ['#e84a4a', '#3f76d0', '#f2c230', '#3fbf7a', '#e86ab0', '#ff7a45']), bottom: pick(r, ['shorts', 'jeans', 'joggers']), shoes: 'sneakers', shoeColor: pick(r, ['#f4f4f2', '#e84a4a', '#3f76d0']), accessory: r() < 0.6 ? 'backpack' : 'cap', accColor: pick(r, ['#e84a4a', '#3f76d0', '#f2c230', '#7a3fd0']), facial: 'none', hair: pick(r, ['short', 'ponytail', 'twintails', 'bob', 'curly', 'spiky']) }) },
  cosplayer: { weight: 1.5, look: (r) => ({ hair: pick(r, ['twintails', 'hime', 'spiky', 'bob']), hairColor: pick(r, ['#e86ab0', '#3fa0e0', '#7a4fd0', '#3fbf7a', '#f2f2f0', '#e84a4a']), eyes: pick(r, ['#3fa0e0', '#8a4fd0', '#d84a7a', '#3fbf7a', '#d4a02a']), top: pick(r, ['dress', 'jacket', 'blazer']), topColor: pick(r, ['#1d1f24', '#f4f4f2', '#2f3a6a', '#7a1f2b', '#e86ab0']), bottom: 'skirt', bottomColor: pick(r, ['#1d1f24', '#2f3a6a', '#7a1f2b']), shoes: 'boots', shoeColor: '#1d1f24', accessory: pick(r, ['none', 'headphones', 'necklace']), accColor: '#e86ab0', facial: 'none', body: pick(r, ['slim', 'average']) }) },
  hipster: { weight: 2, look: (r) => ({ top: pick(r, ['shirt', 'sweater', 'jacket']), topColor: pick(r, ['#7a3b3b', '#3f6e4a', '#8a6a3a', '#27406b', '#5a4a3a']), bottom: 'jeans', bottomColor: pick(r, ['#1d2433', '#2b3448']), shoes: 'boots', shoeColor: '#5a3a24', accessory: pick(r, ['glasses', 'beanie', 'glasses']), accColor: pick(r, ['#c9a24a', '#3a3f48', '#7a3b3b']), facial: r() < 0.6 ? 'beard' : 'none', carry: r() < 0.5 ? 'coffee' : 'tote', carryColor: '#d9c7a8' }) },
  goth: { weight: 1, look: (r) => ({ top: pick(r, ['hoodie', 'jacket', 'dress']), topColor: '#141418', bottom: pick(r, ['jeans', 'skirt']), bottomColor: '#141418', shoes: 'boots', shoeColor: '#141418', hairColor: pick(r, ['#141418', '#2a1830', '#7a1f2b', '#f2f2f0']), hair: pick(r, ['long', 'hime', 'bob', 'mohawk']), accessory: pick(r, ['necklace', 'none', 'headphones']), accColor: '#7a1f2b', facial: 'none' }) },
  athlete: { weight: 2, look: (r) => { const c = pick(r, ['#c53a3a', '#2f5aa3', '#1d1f24', '#3f6e4a', '#e9c04c']); return { top: 'jacket', topColor: c, bottom: 'joggers', bottomColor: c, shoes: 'sneakers', shoeColor: '#f4f4f2', accessory: r() < 0.5 ? 'headphones' : 'cap', accColor: '#f4f4f2', carry: r() < 0.4 ? 'tote' : 'none', carryColor: '#1d1f24', body: 'athletic' }; } },
  artist: { weight: 1, look: (r) => ({ top: pick(r, ['shirt', 'sweater']), topColor: pick(r, ['#f4f1ea', '#c9b9a0', '#3a4254']), bottom: pick(r, ['slacks', 'jeans']), bottomColor: '#3a3f48', shoes: 'boots', hat: 'beret', hatColor: pick(r, ['#1d1f24', '#7a1f2b', '#2f3a6a']), accessory: 'glasses', carry: 'tote', carryColor: '#8a6a4a', apron: r() < 0.3, apronColor: '#d9c7a8' }) },
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
