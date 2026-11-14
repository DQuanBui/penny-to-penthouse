// NPC registry + helpers that turn the compact rows into full characters
// (deterministic look per NPC) and answer "where is this person right now?".
import newyork from './newyork.js';
import { mulberry32, hashStr, pick } from '../../core/utils.js';
import { randomAppearance } from '../../characters/Customization.js';

const BY_CITY = { newyork };
const cache = new Map();

/** All named NPCs of a city (with generated appearance and age). */
export function npcsOf(cityId) {
  if (cache.has(cityId)) return cache.get(cityId);
  const rows = BY_CITY[cityId] || [];
  const list = rows.map((r) => {
    const rng = mulberry32(hashStr(r.id));
    const look = randomAppearance(rng);
    // dress for the job a little
    if (r.sched === 'office') Object.assign(look, { top: pick(rng, ['shirt', 'blazer', 'sweater']), bottom: pick(rng, ['slacks', 'skirt', 'jeans']), shoes: pick(rng, ['dress', 'boots']) });
    if (r.work === 'trades') Object.assign(look, { top: 'jacket', bottom: 'jeans', shoes: 'boots', accessory: 'none' });
    if (r.work === 'gym') Object.assign(look, { top: 'tank', bottom: 'joggers', shoes: 'sneakers', body: 'athletic' });
    if (r.work === 'hospital') Object.assign(look, { top: 'shirt', topColor: '#7fc8c0', bottom: 'slacks', bottomColor: '#7fc8c0', shoes: 'sneakers' });
    return { ...r, first: r.name.replace(/^(Dr\.|Prof\.)\s+/, '').split(' ')[0], age: 21 + Math.floor(rng() * 34), look };
  });
  cache.set(cityId, list);
  return list;
}
export function registerNpcs(cityId, rows) {
  BY_CITY[cityId] = rows;
  cache.delete(cityId);
}
export const npcById = (cityId, id) => npcsOf(cityId).find((n) => n.id === id);

// Schedule tables: [fromHour, kind, options]   kind: home | work | in | out
// "in" = inside one of the listed place types; "fav" uses the NPC's favourites.
const WD = {
  office: [[0, 'home'], [7.5, 'out'], [9, 'work'], [12, 'in', ['cafe', 'restaurant']], [13, 'work'], [17, 'out'], [19, 'in', 'fav'], [21.5, 'home']],
  early: [[0, 'home'], [6.5, 'out'], [7, 'work'], [15, 'out'], [17.5, 'in', 'fav'], [20.5, 'home']],
  service: [[0, 'home'], [8.5, 'out'], [10, 'work'], [18, 'out'], [19.5, 'in', 'fav'], [22, 'home']],
  night: [[0, 'work'], [2, 'home'], [11.5, 'out'], [14, 'in', 'fav'], [17, 'work']],
  student: [[0, 'home'], [8, 'in', ['college']], [14, 'out'], [17, 'in', 'fav'], [20, 'out'], [22.5, 'home']],
  freelance: [[0, 'home'], [8.5, 'in', ['cafe']], [12, 'out'], [16.5, 'in', 'fav'], [19, 'out'], [21.5, 'home']],
};
const WE = [[0, 'home'], [9.5, 'out'], [12, 'in', ['cafe', 'restaurant']], [13.5, 'out'], [18, 'in', ['bar', 'restaurant']], [22.5, 'home']];

/**
 * Where an NPC is at a given time.
 * @returns { kind: 'home'|'work'|'in'|'out', type?: placeType, slot: string }
 */
export function npcWhere(npc, hour, day) {
  const weekend = day % 7 >= 5 && npc.sched !== 'night' && npc.sched !== 'service';
  const table = weekend ? WE : WD[npc.sched] || WD.office;
  let row = table[0];
  let idx = 0;
  for (let i = 0; i < table.length; i++) if (hour >= table[i][0]) (row = table[i]), (idx = i);
  const slot = `${day}:${idx}`;
  const kind = row[1];
  if (kind === 'work') return npc.work ? { kind, type: npc.work, slot } : { kind: 'out', slot };
  if (kind === 'in') {
    const opts = row[2] === 'fav' ? npc.fav : row[2];
    const r = mulberry32(hashStr(npc.id + slot));
    return { kind, type: opts[Math.floor(r() * opts.length)], slot };
  }
  return { kind, slot };
}

export const PERSONALITY = {
  outgoing: { label: 'Outgoing', chat: 1.2, joke: 1.3, compliment: 1.0, askWork: 1.0 },
  shy: { label: 'Shy', chat: 0.9, joke: 0.8, compliment: 1.4, askWork: 1.0 },
  ambitious: { label: 'Ambitious', chat: 1.0, joke: 0.8, compliment: 1.0, askWork: 1.5 },
  chill: { label: 'Easy-going', chat: 1.1, joke: 1.4, compliment: 1.0, askWork: 0.8 },
  creative: { label: 'Creative', chat: 1.1, joke: 1.1, compliment: 1.3, askWork: 0.9 },
  serious: { label: 'Serious', chat: 1.0, joke: 0.6, compliment: 0.9, askWork: 1.4 },
};
