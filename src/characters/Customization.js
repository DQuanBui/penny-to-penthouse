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

const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Avery', 'Quinn', 'Jamie', 'Sam', 'Maya', 'Leo', 'Nina', 'Omar', 'Zoe', 'Kai', 'Priya', 'Mateo', 'Aisha', 'Devin', 'Lena', 'Marcus', 'Sofia', 'Ethan', 'Noor', 'Diego', 'Hana', 'Tyler', 'Imani', 'Lucas'];
const LAST = ['Rivera', 'Chen', 'Brooks', 'Patel', 'Nguyen', 'Carter', 'Kim', 'Morales', 'Bennett', 'Okafor', 'Rossi', 'Hayes', 'Ali', 'Sullivan', 'Park', 'Reyes', 'Foster', 'Singh', 'Cruz', 'Walker'];
export const randomName = (rng = Math.random) => `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
