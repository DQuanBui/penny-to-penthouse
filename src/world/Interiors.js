// Enterable interiors. Each place is a small separate scene built from a
// layout: { w, d, floor, wall, walls[], items[{id,x,z,r}], doorX }.
// Homes store their layout in the save (build mode edits it); shops, offices
// and so on use the templates below.
import * as THREE from 'three';
import { ColliderWorld } from './Collision.js';
import { Tex } from './Textures.js';
import { buildFurniture } from '../build/FurnitureCatalog.js';
import { FURNITURE_BY_ID } from '../data/furniture.js';
import { HOME_BY_ID } from '../data/homes.js';
import { PLACE_TYPES } from '../data/placeTypes.js';

export const ROOM_H = 3.0;

/** Prompt text for counters that offer a specific service (mall). */
const SVC_LABEL = { clothing: 'Fashion counter', electronics: 'Tech counter', cafe: 'Food court' };

const USE_LABEL = {
  sleep: 'Sleep', relax: 'Relax', computer: 'Use the computer', read: 'Read a book', eat: 'Open the fridge', cook: 'Cook a meal',
  shower: 'Take a shower', bath: 'Take a bath', wardrobe: 'Change outfit', tv: 'Watch TV', game: 'Play video games', music: 'Listen to music',
  piano: 'Play the piano', workout: 'Work out', paint: 'Paint', service: 'Talk to staff', work: 'Start your shift', board: 'Board the train', sit: 'Sit down', tickets: '🎫 Ticket machine', snack: '📰 Newsstand',
};

/** Footprint of an item after rotation (r = quarter turns). */
export function footprint(def, r) {
  return r % 2 ? [def.d, def.w] : [def.w, def.d];
}

/**
 * Line items up along the walls (clockwise from the back-left corner), each
 * facing into the room. Leaves the doorway on the south wall clear.
 */
export function autoFurnish(w, d, ids, doorX = w / 2) {
  const items = [];
  const gap = 0.25;
  // wall runs: [start, end, place(fn)]
  let side = 0; // 0 north, 1 east, 2 west, 3 south-left, 4 south-right
  let cur = gap;
  const limits = [w - gap, d - 1.2, d - 1.2, doorX - 1.2, w - gap];
  const starts = [gap, 1.3, 1.3, gap, doorX + 1.2];
  let firstNorth = null; // corner pieces on the back wall push the side-wall runs down
  let lastNorth = null;
  for (const entry of ids) {
    const it = typeof entry === 'string' ? { id: entry } : { ...entry };
    const def = FURNITURE_BY_ID[it.id];
    if (!def) continue;
    let placed = false;
    while (side < 5 && !placed) {
      const len = def.w;
      if (cur + len <= limits[side] + 1e-6) {
        const c = cur + len / 2;
        if (side === 0) {
          Object.assign(it, { x: c, z: def.d / 2 + 0.05, r: 0 });
          firstNorth ||= def;
          lastNorth = { def, end: cur + len };
        }
        else if (side === 1) Object.assign(it, { x: w - def.d / 2 - 0.05, z: c, r: 3 });
        else if (side === 2) Object.assign(it, { x: def.d / 2 + 0.05, z: c, r: 1 });
        else Object.assign(it, { x: c, z: d - def.d / 2 - 0.05, r: 2 });
        cur += len + gap;
        placed = true;
      } else {
        side++;
        cur = starts[side] ?? 0;
        // keep clear of furniture already in the back corners
        if (side === 1 && lastNorth && lastNorth.end > w - 1.3) cur = Math.max(cur, lastNorth.def.d + 0.4);
        if (side === 2 && firstNorth) cur = Math.max(cur, firstNorth.d + 0.4);
      }
    }
    if (placed) items.push(it);
  }
  return items;
}

let uidCounter = 1;
const withUids = (items) => items.map((i) => ({ uid: i.uid || 'i' + uidCounter++, ...i }));

/** Starter layout for a home type (rentals come with basic furniture). */
export function defaultHomeLayout(typeId) {
  const t = HOME_BY_ID[typeId];
  const [w, d] = t.size;
  const sets = {
    couch: [{ id: 'loveseat', use: 'sleep', q: 0.7 }, 'table_small', 'mini_fridge', { id: 'shower_basic' }, 'lamp_table'],
    room: ['bed_single', 'lamp_table', 'desk_basic', 'mini_fridge', 'hotplate', 'shower_basic', 'dresser'],
    studio: ['bed_single', 'lamp_table', 'desk_basic', 'bookshelf', 'fridge', 'stove', 'counter', 'shower_basic', 'toilet', 'loveseat', 'tv_small', 'dresser'],
    apartment: ['bed_double', 'lamp_table', 'wardrobe', 'desk_basic', 'bookshelf', 'fridge', 'stove', 'sink_kitchen', 'counter', 'shower_basic', 'toilet', 'sink', 'sofa', 'tv_small', 'plant_floor'],
  };
  const owned = ['bed_single', 'fridge', 'stove', 'sink_kitchen', 'shower_basic', 'toilet', 'sink'];
  const items = autoFurnish(w, d, sets[typeId] || owned);
  if (typeId !== 'couch') items.push({ id: 'rug_small', x: w / 2, z: d / 2, r: 0 });
  if (typeId === 'room' || typeId === 'studio' || typeId === 'apartment') {
    const desk = items.find((i) => i.id === 'desk_basic');
    if (desk) items.push({ id: 'chair_basic', x: desk.x + (desk.r === 1 ? 0.9 : desk.r === 3 ? -0.9 : 0), z: desk.z + (desk.r === 0 ? 0.9 : desk.r === 2 ? -0.9 : 0), r: (desk.r + 2) % 4 });
  }
  return { w, d, floors: t.floors, floor: typeId === 'couch' || typeId === 'room' ? 'carpet' : 'wood', wall: '#e9e2d4', walls: [], items: withUids(items), doorX: w / 2 };
}

/** Template layout for a commercial place. */
export function commercialLayout(place) {
  const kind = PLACE_TYPES[place.type].interior;
  const L = (w, d, floor, wall, items) => ({ w, d, floor, wall, walls: [], items: withUids(items), doorX: w / 2 });
  /** A themed restaurant: counter and open kitchen at the back, seating to suit. */
  const eatery = (floor, wall, kind) => {
    const items = [
      { id: kind === 'bar' ? 'bar_counter' : 'shop_counter', x: 5.5, z: 1.6, r: 0 },
      { id: 'kitchen_line', x: kind === 'bar' ? 9.6 : 9.2, z: 0.5, r: 0, use: '' },
      { id: 'plant_floor', x: 0.5, z: 0.5, r: 0 },
      { id: 'plant_floor', x: 10.5, z: 8.5, r: 0 },
      { id: 'painting_l', x: 2.4, z: 0.3, r: 0 },
    ];
    if (kind === 'bar') items.push(...[3.6, 4.8, 6, 7.2].map((x) => ({ id: 'bar_stool', x, z: 2.6, r: 0 })), ...cafeTables(2.4, 5.6, 3, 1, 3));
    else if (kind === 'grills') items.push(...[2.2, 5.5, 8.8].flatMap((x) => [5.2, 7.6].map((z) => ({ id: 'grill_table', x, z, r: 0 }))));
    else if (kind === 'small') items.push(...cafeTables(2.4, 5.4, 3, 1, 3), { id: 'sofa', x: 10.4, z: 4.2, r: 3 });
    else items.push(...cafeTables(2.2, 4.8, 3, 2, 3.1, 2.3));
    if (kind === 'lanterns') for (const x of [2.2, 5.5, 8.8]) items.push({ id: 'lantern', x, z: 6, r: 0 });
    if (kind === 'plants') items.push({ id: 'plant_tree', x: 10.4, z: 0.7, r: 0 }, { id: 'plant_tree', x: 0.6, z: 8.3, r: 0 });
    return L(11, 9, floor, wall, items);
  };
  const cafeTables = (x0, z0, nx, nz, sx = 2.6, sz = 2.4) => {
    const out = [];
    for (let a = 0; a < nx; a++)
      for (let c = 0; c < nz; c++) {
        const x = x0 + a * sx;
        const z = z0 + c * sz;
        out.push({ id: 'table_small', x, z, r: 0 }, { id: 'dining_chair', x: x - 0.8, z, r: 1 }, { id: 'dining_chair', x: x + 0.8, z, r: 3 });
      }
    return out;
  };
  switch (kind) {
    case 'cafe':
      return L(10, 8, 'wood', '#efe4d2', [
        { id: 'shop_counter', x: 3, z: 1.4, r: 0 },
        { id: 'shop_shelf', x: 3, z: 0.3, r: 0 },
        { id: 'plant_floor', x: 0.5, z: 0.5, r: 0 },
        { id: 'plant_tree', x: 9.3, z: 0.7, r: 0 },
        { id: 'sofa', x: 9.4, z: 3.2, r: 3 },
        { id: 'painting_l', x: 7.2, z: 0.3, r: 0 },
        ...cafeTables(2, 4.4, 3, 1),
        ...cafeTables(6.2, 6.4, 1, 1),
      ]);
    case 'restaurant':
      return L(13, 10, 'wood', '#3f2f2a', [
        { id: 'reception', x: 10.4, z: 8.2, r: 2 },
        { id: 'kitchen_line', x: 3, z: 0.6, r: 0 },
        { id: 'counter', x: 6, z: 0.6, r: 0 },
        { id: 'fridge_steel', x: 7.4, z: 0.6, r: 0 },
        { id: 'plant_tree', x: 12.3, z: 0.7, r: 0 },
        { id: 'painting_l', x: 10.4, z: 0.3, r: 0 },
        ...cafeTables(2, 3.6, 4, 2, 2.8, 2.6),
      ]);
    case 'mall':
      // atrium with three counters: fashion, tech and a food court
      return L(20, 14, 'tile', '#f1f3f5', [
        { id: 'shop_counter', x: 3.5, z: 1.6, r: 0, svc: 'clothing' },
        { id: 'clothes_rack', x: 1.4, z: 0.3, r: 0 },
        { id: 'clothes_rack', x: 5.6, z: 0.3, r: 0 },
        { id: 'clothes_rack', x: 3.5, z: 4.2, r: 0 },
        { id: 'shop_counter', x: 16.5, z: 1.6, r: 0, svc: 'electronics' },
        { id: 'shop_shelf', x: 14.4, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 18.6, z: 0.3, r: 0 },
        { id: 'tv_big', x: 16.5, z: 0.3, r: 0 },
        { id: 'bar_counter', x: 10, z: 1.6, r: 0, svc: 'cafe' },
        { id: 'plant_tree', x: 7.6, z: 0.8, r: 0 },
        { id: 'plant_tree', x: 12.4, z: 0.8, r: 0 },
        { id: 'sofa', x: 6.5, z: 9.5, r: 1 },
        { id: 'sofa', x: 13.5, z: 9.5, r: 3 },
        { id: 'plant_floor', x: 0.5, z: 13.4, r: 0 },
        { id: 'plant_floor', x: 19.5, z: 13.4, r: 0 },
        ...cafeTables(8.3, 5.4, 3, 2, 1.7, 2.3),
      ]);
    case 'shelter':
      // a bright rescue: reception, pet-food shelves and a play area for the dogs
      return L(12, 9, 'wood', '#f3e6d3', [
        { id: 'reception', x: 9.4, z: 1.6, r: 0 },
        { id: 'shop_shelf', x: 1.2, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 3.6, z: 0.3, r: 0 },
        { id: 'painting_l', x: 6.2, z: 0.3, r: 0 },
        { id: 'rug_large', x: 2.8, z: 3.4, r: 0 },
        { id: 'rug_large', x: 5.8, z: 3.4, r: 0 },
        { id: 'plant_tree', x: 11.3, z: 0.7, r: 0 },
        { id: 'armchair', x: 11.2, z: 5.6, r: 3 },
        { id: 'armchair', x: 11.2, z: 6.8, r: 3 },
        { id: 'plant_floor', x: 0.6, z: 8.4, r: 0 },
      ]);
    case 'eat_pho':
      return eatery('tile', '#f3e3c3', 'lanterns');
    case 'eat_kbbq':
      return eatery('wood', '#3a2a24', 'grills');
    case 'eat_ramen':
      return eatery('wood', '#4a3426', 'bar');
    case 'eat_sushi':
      return eatery('wood', '#efe6d2', 'bar');
    case 'eat_dumplings':
      return eatery('tile', '#8a2a24', 'lanterns');
    case 'eat_taqueria':
      return eatery('tile', '#f0b04a', 'tables');
    case 'eat_thai':
      return eatery('wood', '#e9d6b0', 'plants');
    case 'eat_indian':
      return eatery('wood', '#c4683a', 'tables');
    case 'eat_halal':
      return eatery('tile', '#ece4d0', 'tables');
    case 'eat_boba':
      return eatery('tile', '#f6e3ec', 'small');
    case 'eat_icecream':
      return eatery('tile', '#e2f2f4', 'small');
    case 'eat_wine':
      return eatery('wood', '#4a2228', 'bar');
    case 'bikeshop':
      return L(11, 8, 'concrete', '#e9ece6', [
        { id: 'shop_counter', x: 8.8, z: 6.4, r: 3 },
        { id: 'bike_display', x: 2.2, z: 0.6, r: 0 },
        { id: 'bike_display', x: 5.6, z: 0.6, r: 0 },
        { id: 'bike_display', x: 3.5, z: 3.6, r: 0 },
        { id: 'workbench', x: 9.6, z: 0.6, r: 0, use: '' },
        { id: 'shop_shelf', x: 0.6, z: 5, r: 1 },
        { id: 'plant_floor', x: 0.5, z: 7.4, r: 0 },
      ]);
    case 'platform': {
      const el = place.rail === 'elevated';
      const items = [
        { id: 'tracks', x: 17, z: 2, r: 0 },
        { id: 'platform_edge', x: 17, z: 4.3, r: 0 },
        ...[5, 11, 17, 23, 29].map((x) => ({ id: 'column_steel', x, z: 5.9, r: 0 })),
        ...[8, 14, 20, 26].map((x) => ({ id: 'platform_bench', x, z: 7.6, r: 0 })),
        ...[12.5, 14.5, 19.5, 21.5].map((x) => ({ id: 'turnstile', x, z: 9.6, r: 0 })),
        // the mezzanine behind the turnstiles: ticket machines, a newsstand, maps
        ...[2.4, 3.5, 4.6].map((x) => ({ id: 'ticket_machine', x, z: 15.55, r: 2 })),
        { id: 'newsstand', x: 29.5, z: 14.9, r: 2 },
        { id: 'subway_map', x: 9.5, z: 15.9, r: 2 },
        { id: 'subway_map', x: 24.5, z: 15.9, r: 2 },
        ...[7, 27].map((x) => ({ id: 'column_steel', x, z: 12.6, r: 0 })),
        ...[2, 32].map((x) => ({ id: 'platform_bench', x, z: 11.2, r: 0 })),
      ];
      const l = L(34, 16, el ? 'concrete' : 'tile', el ? '#cfd6dc' : '#eef1ee', items);
      l.windows = el ? 'panorama' : 'none';
      return l;
    }
    case 'subwaycar': {
      const l = L(16, 3.8, 'tile', '#dfe3e6', [
        { id: 'subway_seat', x: 3.2, z: 0.3, r: 0 },
        { id: 'subway_seat', x: 8, z: 0.3, r: 0 },
        { id: 'subway_seat', x: 12.8, z: 0.3, r: 0 },
        ...[2.2, 5.6, 10.4, 13.8].map((x) => ({ id: 'grab_pole', x, z: 1.9, r: 0 })),
      ]);
      l.windows = 'train';
      return l;
    }
    case 'terminal':
      return L(20, 14, 'tile', '#e6ebf0', [
        { id: 'reception', x: 5, z: 1.6, r: 0 },
        { id: 'reception', x: 10, z: 1.6, r: 0, use: '' },
        { id: 'reception', x: 15, z: 1.6, r: 0, use: '' },
        { id: 'tv_cinema', x: 10, z: 0.3, r: 0, use: '' },
        ...[6.5, 8.2, 9.9].flatMap((z) => [{ id: 'airport_seats', x: 5.5, z, r: 0 }, { id: 'airport_seats', x: 14.5, z, r: 0 }]),
        { id: 'plant_tree', x: 0.8, z: 0.8, r: 0 },
        { id: 'plant_tree', x: 19.2, z: 0.8, r: 0 },
        { id: 'plant_floor', x: 19.4, z: 13.4, r: 0 },
      ]);
    case 'hotelroom':
      return L(9, 7, 'carpet', '#e9dfcf', autoFurnish(9, 7, ['bed_queen', 'room_phone', 'wardrobe', 'desk_wood', 'tv_small', 'mini_fridge', 'shower_basic', 'toilet', 'sink', 'armchair', 'plant_floor']));
    case 'lecture':
      return L(16, 12, 'wood', '#e6dccb', [
        { id: 'chalkboard_wall', x: 8, z: 0.25, r: 0 },
        { id: 'lectern', x: 8, z: 1.8, r: 0 },
        { id: 'reception', x: 13.6, z: 10.6, r: 3 },
        { id: 'bookshelf', x: 0.6, z: 3, r: 1 },
        { id: 'bookshelf', x: 0.6, z: 4.2, r: 1 },
        ...[4, 5.6, 7.2, 8.8].flatMap((z) => [3, 5.2, 7.4, 9.6, 11.8].map((x) => ({ id: 'school_desk', x, z, r: 0 }))),
        { id: 'plant_floor', x: 15.4, z: 0.6, r: 0 },
      ]);
    case 'classroom':
      return L(12, 10, 'tile', '#f3ecd8', [
        { id: 'chalkboard_wall', x: 6, z: 0.25, r: 0 },
        { id: 'desk_wood', x: 9.5, z: 1.6, r: 2, use: '' },
        { id: 'reception', x: 10.2, z: 8.6, r: 3 },
        { id: 'bookshelf', x: 0.6, z: 3, r: 1 },
        { id: 'painting_l', x: 2.4, z: 0.3, r: 0 },
        ...[3.6, 5, 6.4].flatMap((z) => [2.5, 4.2, 5.9, 7.6].map((x) => ({ id: 'school_desk', x, z, r: 0 }))),
        { id: 'rug_large', x: 3, z: 8.2, r: 0 },
        { id: 'plant_floor', x: 11.4, z: 0.6, r: 0 },
      ]);
    case 'pub':
      return L(12, 9, 'wood', '#5a3a2a', [
        { id: 'bar_counter', x: 6, z: 1.6, r: 0 },
        { id: 'tv_big', x: 10.5, z: 0.3, r: 0, use: '' },
        { id: 'dartboard', x: 1.5, z: 0.25, r: 0 },
        ...[2, 4, 8, 10].flatMap((x) => [{ id: 'table_small', x, z: 5.6, r: 0 }, { id: 'bar_stool', x: x - 0.7, z: 5.6, r: 1 }, { id: 'bar_stool', x: x + 0.7, z: 5.6, r: 3 }]),
        { id: 'plant_floor', x: 11.4, z: 8.4, r: 0 },
      ]);
    case 'club': {
      const l = L(14, 11, 'concrete', '#16121f', [
        { id: 'dj_booth', x: 7, z: 0.8, r: 0 },
        { id: 'dance_floor', x: 7, z: 4.4, r: 0 },
        { id: 'bar_counter', x: 12, z: 6.5, r: 3 },
        { id: 'sofa', x: 1.2, z: 6, r: 1 },
        { id: 'sofa', x: 1.2, z: 8.6, r: 1 },
        { id: 'speaker', x: 0.6, z: 0.6, r: 0, use: '' },
        { id: 'speaker', x: 13.4, z: 0.6, r: 0, use: '' },
      ]);
      l.dark = true;
      return l;
    }
    case 'pizza':
      return L(10, 8, 'tile', '#f1e6d2', [
        { id: 'shop_counter', x: 3.2, z: 1.6, r: 0 },
        { id: 'kitchen_line', x: 7.4, z: 0.6, r: 0, use: '' },
        { id: 'painting_l', x: 3.2, z: 0.3, r: 0 },
        ...cafeTables(2, 4.6, 3, 1, 2.8),
      ]);
    case 'deli':
      return L(10, 8, 'tile', '#eef0f2', [
        { id: 'shop_counter', x: 8, z: 6.4, r: 3 },
        { id: 'fridge_steel', x: 0.5, z: 1, r: 1, use: '' },
        { id: 'fridge_steel', x: 0.5, z: 2.2, r: 1, use: '' },
        { id: 'fridge_steel', x: 0.5, z: 3.4, r: 1, use: '' },
        { id: 'shop_shelf', x: 3.5, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 6, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 3.5, z: 3.2, r: 0 },
        { id: 'shop_shelf', x: 6, z: 3.2, r: 0 },
        { id: 'shop_shelf', x: 3.5, z: 4.6, r: 2 },
        { id: 'shop_shelf', x: 6, z: 4.6, r: 2 },
      ]);
    case 'pharmacy':
      return L(11, 8, 'tile', '#f6f8fa', [
        { id: 'reception', x: 8.8, z: 1.4, r: 0 },
        ...[1.4, 3.8, 6.2].map((x) => ({ id: 'shop_shelf', x, z: 0.3, r: 0 })),
        ...[2.4, 5.2].flatMap((x) => [{ id: 'shop_shelf', x, z: 3.4, r: 0 }, { id: 'shop_shelf', x, z: 4.9, r: 2 }]),
        { id: 'plant_floor', x: 10.5, z: 7.4, r: 0 },
      ]);
    case 'barber':
      return L(10, 7, 'tile', '#e9e4da', [
        { id: 'reception', x: 8.2, z: 5.6, r: 3 },
        ...[1.4, 3.6, 5.8].flatMap((x) => [{ id: 'mirror_station', x, z: 0.25, r: 0 }, { id: 'barber_chair', x, z: 1.4, r: 2 }]),
        { id: 'sofa', x: 0.6, z: 5, r: 1 },
        { id: 'plant_floor', x: 9.5, z: 0.5, r: 0 },
      ]);
    case 'salon':
      return L(10, 7, 'wood', '#f6e6ee', [
        { id: 'reception', x: 8.2, z: 5.6, r: 3 },
        ...[1.5, 4, 6.5].flatMap((x) => [{ id: 'table_small', x, z: 1.2, r: 0 }, { id: 'armchair', x, z: 2.3, r: 2 }]),
        { id: 'plant_tree', x: 9.4, z: 0.6, r: 0 },
        { id: 'plant_floor', x: 0.6, z: 6.4, r: 0 },
      ]);
    case 'bookstore':
      return L(12, 9, 'wood', '#efe4d2', [
        { id: 'shop_counter', x: 9.6, z: 7.2, r: 2 },
        ...[1.2, 3.6, 6, 8.4, 10.8].map((x) => ({ id: 'bookshelf', x, z: 0.3, r: 0 })),
        ...[2.5, 5.5].flatMap((x) => [{ id: 'bookshelf', x, z: 3.4, r: 0 }, { id: 'bookshelf', x, z: 4.2, r: 2 }]),
        { id: 'armchair', x: 9.4, z: 3.6, r: 3 },
        { id: 'armchair', x: 9.4, z: 5, r: 3 },
        { id: 'lamp_floor', x: 10.6, z: 4.3, r: 0 },
        { id: 'rug_small', x: 9.4, z: 4.3, r: 0 },
      ]);
    case 'laundromat':
      return L(11, 8, 'tile', '#e8f4f8', [
        { id: 'shop_counter', x: 9, z: 6.6, r: 3 },
        ...[0.7, 1.6, 2.5, 3.4, 4.3, 5.2, 6.1, 7.0, 7.9].map((x) => ({ id: 'washer', x, z: 0.55, r: 0 })),
        ...[1.2, 2.2, 3.2].map((z) => ({ id: 'washer', x: 0.55, z: z + 1.4, r: 1 })),
        { id: 'sofa', x: 5, z: 4.4, r: 0 },
        { id: 'table_small', x: 5, z: 3.2, r: 0 },
      ]);
    case 'florist':
      return L(9, 7, 'wood', '#eef2e6', [
        { id: 'shop_counter', x: 6.8, z: 5.6, r: 3 },
        ...[0.8, 2.2, 3.6, 5.0, 6.4, 7.8].map((x, k) => ({ id: k % 2 ? 'plant_floor' : 'planter', x, z: 0.4, r: 0 })),
        ...[1.6, 3.6].flatMap((x) => [{ id: 'planter', x, z: 3, r: 0 }, { id: 'plant_floor', x, z: 4, r: 0 }]),
        { id: 'plant_tree', x: 8.4, z: 0.6, r: 0 },
      ]);
    case 'cinema': {
      const l = L(14, 12, 'carpet', '#2a1418', [
        { id: 'tv_cinema', x: 7, z: 0.4, r: 0, use: '' },
        ...[3.5, 5.0, 6.5, 8.0].map((z) => ({ id: 'cinema_seats', x: 6, z, r: 0 })),
        { id: 'display_case', x: 11.6, z: 9.8, r: 3 },
        { id: 'plant_floor', x: 13.4, z: 11.4, r: 0 },
      ]);
      l.dark = true;
      return l;
    }
    case 'diner':
      return L(12, 9, 'tile', '#f3e6cc', [
        { id: 'shop_counter', x: 6, z: 1.6, r: 0 },
        { id: 'kitchen_line', x: 6, z: 0.5, r: 0, use: '' },
        ...[3.5, 6, 8.5].map((x) => ({ id: 'bar_stool', x, z: 2.6, r: 0 })),
        ...[1.5, 4.5, 7.5, 10.5].flatMap((x) => [{ id: 'table_small', x, z: 6, r: 0 }, { id: 'loveseat', x, z: 7.6, r: 2 }]),
      ]);
    case 'arcade': {
      const l = L(12, 9, 'carpet', '#1a1240', [
        { id: 'shop_counter', x: 9.6, z: 7.4, r: 2 },
        ...[1.2, 2.4, 3.6, 4.8, 6, 7.2, 8.4, 9.6, 10.8].map((x) => ({ id: 'arcade_cab', x, z: 0.6, r: 0 })),
        ...[3, 4.2, 5.4, 6.6].flatMap((x) => [{ id: 'arcade_cab', x, z: 3.6, r: 2 }, { id: 'arcade_cab', x, z: 4.6, r: 0 }]),
      ]);
      l.dark = true;
      return l;
    }
    case 'bakery':
      return L(10, 8, 'tile', '#f6ecd8', [
        { id: 'display_case', x: 3.4, z: 1.7, r: 0 },
        { id: 'shop_shelf', x: 3.4, z: 0.3, r: 0 },
        { id: 'kitchen_line', x: 7.6, z: 0.5, r: 0, use: '' },
        ...cafeTables(2, 4.8, 3, 1, 2.6),
        { id: 'plant_floor', x: 9.5, z: 7.4, r: 0 },
      ]);
    case 'shop': {
      const rack = place.type === 'clothing' ? 'clothes_rack' : 'shop_shelf';
      const rows = [];
      for (let a = 0; a < 3; a++) for (let c = 0; c < 2; c++) rows.push({ id: rack, x: 2 + a * 2.6, z: 2.6 + c * 2.2, r: 0 });
      return L(11, 8, 'tile', '#eef0f2', [
        { id: 'shop_counter', x: 8.9, z: 6.2, r: 3 },
        { id: 'shop_shelf', x: 1.2, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 3.6, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 6, z: 0.3, r: 0 },
        { id: rack, x: 8.6, z: 0.3, r: 0 },
        { id: 'plant_floor', x: 10.5, z: 0.5, r: 0 },
        ...rows,
      ]);
    }
    case 'gym':
      return L(13, 10, 'concrete', '#39414f', [
        { id: 'reception', x: 10.5, z: 8.3, r: 2 },
        { id: 'gym_treadmill', x: 1.2, z: 1.5, r: 0 },
        { id: 'gym_treadmill', x: 2.8, z: 1.5, r: 0 },
        { id: 'gym_treadmill', x: 4.4, z: 1.5, r: 0 },
        { id: 'gym_weights', x: 1.2, z: 5, r: 0 },
        { id: 'gym_weights', x: 3, z: 5, r: 0 },
        { id: 'gym_weights', x: 4.8, z: 5, r: 0 },
        { id: 'gym_shower', x: 11.5, z: 0.6, r: 0 },
        { id: 'gym_shower', x: 12.4, z: 2, r: 3 },
        { id: 'mirror', x: 7.5, z: 0.3, r: 0 },
        { id: 'mirror', x: 8.7, z: 0.3, r: 0 },
        { id: 'plant_floor', x: 0.5, z: 9.4, r: 0 },
      ]);
    case 'office': {
      const desks = [];
      for (let a = 0; a < 3; a++)
        for (let c = 0; c < 2; c++) {
          const x = 2 + a * 3;
          const z = 2 + c * 2.8;
          desks.push({ id: 'work_desk', x, z, r: 0 }, { id: 'office_chair', x, z: z + 0.85, r: 2 });
        }
      return L(12, 9, 'carpet', '#e6e9ee', [
        { id: 'reception', x: 9.6, z: 7.3, r: 2 },
        { id: 'plant_floor', x: 0.5, z: 0.5, r: 0 },
        { id: 'plant_tree', x: 11.3, z: 0.7, r: 0 },
        { id: 'sofa', x: 2, z: 8.3, r: 2 },
        { id: 'painting_l', x: 10.3, z: 0.3, r: 0 },
        ...desks,
      ]);
    }
    case 'college': {
      const desks = [];
      for (let a = 0; a < 4; a++) for (let c = 0; c < 2; c++) desks.push({ id: 'table_small', x: 2 + a * 2.2, z: 4 + c * 2, r: 0 }, { id: 'chair_basic', x: 2 + a * 2.2, z: 4.8 + c * 2, r: 2 });
      return L(12, 10, 'wood', '#e9e2d4', [
        { id: 'reception', x: 10, z: 8.3, r: 2 },
        { id: 'lectern', x: 5, z: 1.4, r: 0 },
        { id: 'bookshelf', x: 0.9, z: 0.3, r: 0 },
        { id: 'bookshelf', x: 2.1, z: 0.3, r: 0 },
        { id: 'bookshelf', x: 10.9, z: 0.3, r: 0 },
        { id: 'painting_s', x: 7.5, z: 0.3, r: 0 },
        ...desks,
      ]);
    }
    case 'bar':
      return L(12, 9, 'wood', '#2a2238', [
        { id: 'bar_counter', x: 4, z: 1.9, r: 0 },
        { id: 'bar_stool', x: 2.6, z: 3, r: 2 },
        { id: 'bar_stool', x: 3.6, z: 3, r: 2 },
        { id: 'bar_stool', x: 4.6, z: 3, r: 2 },
        { id: 'bar_stool', x: 5.6, z: 3, r: 2 },
        { id: 'sectional', x: 10, z: 0.6, r: 0 },
        { id: 'sofa', x: 11.4, z: 3, r: 3 },
        { id: 'table_small', x: 9.8, z: 2.6, r: 0 },
        { id: 'speaker', x: 0.5, z: 8.4, r: 2 },
        { id: 'lamp_floor', x: 11.5, z: 8.4, r: 0 },
        { id: 'plant_tree', x: 7.8, z: 0.7, r: 0 },
        ...cafeTables(3, 6.2, 3, 1, 2.6),
      ]);
    case 'showroom':
      return L(15, 11, 'tile', '#f2f4f6', [
        { id: 'reception', x: 12.5, z: 9.3, r: 2 },
        { id: 'show_car', x: 3.5, z: 3.5, r: 0 },
        { id: 'show_car', x: 8, z: 3.5, r: 0, p: 1 },
        { id: 'plant_tree', x: 14.3, z: 0.7, r: 0 },
        { id: 'sofa', x: 13.6, z: 4, r: 3 },
      ]);
    case 'clinic':
      return L(11, 8, 'tile', '#eaf2f4', [
        { id: 'reception', x: 8.6, z: 6.3, r: 2 },
        { id: 'hospital_bed', x: 1.2, z: 1.2, r: 0 },
        { id: 'hospital_bed', x: 3.2, z: 1.2, r: 0 },
        { id: 'hospital_bed', x: 5.2, z: 1.2, r: 0 },
        { id: 'work_desk', x: 9, z: 1.4, r: 0 },
        { id: 'office_chair', x: 9, z: 2.25, r: 2 },
        { id: 'plant_floor', x: 0.5, z: 7.4, r: 0 },
        { id: 'sofa', x: 2.6, z: 7.3, r: 2 },
      ]);
    case 'workshop':
      return L(12, 9, 'concrete', '#5a5f6a', [
        { id: 'reception', x: 9.6, z: 7.3, r: 2 },
        { id: 'workbench', x: 1.6, z: 0.8, r: 0 },
        { id: 'workbench', x: 4.4, z: 0.8, r: 0 },
        { id: 'workbench', x: 7.2, z: 0.8, r: 0 },
        { id: 'workbench', x: 0.8, z: 4.5, r: 1 },
        { id: 'shop_shelf', x: 10.6, z: 0.3, r: 0 },
        { id: 'shop_shelf', x: 11.6, z: 3, r: 3 },
      ]);
    case 'studio':
    default:
      return L(12, 9, 'concrete', '#2b2f3c', [
        { id: 'reception', x: 9.6, z: 7.3, r: 2 },
        { id: 'camera_rig', x: 3, z: 4.6, r: 2 },
        { id: 'camera_rig', x: 5.5, z: 5, r: 2 },
        { id: 'sofa', x: 4, z: 1, r: 0 },
        { id: 'plant_tree', x: 6.6, z: 1, r: 0 },
        { id: 'lamp_arc', x: 1.6, z: 1, r: 0 },
        { id: 'work_desk', x: 10.6, z: 1.4, r: 0 },
        { id: 'office_chair', x: 10.6, z: 2.25, r: 2 },
        { id: 'speaker', x: 0.5, z: 8.4, r: 2 },
      ]);
  }
}

const FLOORS = { wood: () => Tex.wood(), tile: () => Tex.tile(), carpet: () => Tex.carpet(), concrete: () => Tex.concrete() };
export const FLOOR_TYPES = Object.keys(FLOORS);

export class Interior {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d0f16');
    this.hemi = new THREE.HemisphereLight('#fff4e4', '#6a5f58', 1.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.lamps = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffcf90', 0, 9, 1.6);
      this.scene.add(l);
      this.lamps.push(l);
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);
    // windows look out onto the city: a skyline tinted by the sky by day, lit up at night
    this.windowMat = new THREE.MeshBasicMaterial({ color: '#9fd0ff', map: Tex.skylineDay() });
    this.clock = null;
    this.world = null;
    this.points = [];
    this.layout = null;
    this.itemNodes = new Map();
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose();
    });
    this.root.clear();
    this.itemNodes.clear();
  }

  /**
   * Build the room. opts: { place, home:boolean, hasPc:boolean }
   */
  build(layout, opts = {}) {
    this.dispose();
    this.layout = layout;
    this.opts = opts;
    this.dark = !!layout.dark;
    this.windowMat.userData.keep = false;
    this.scrollTex = null;
    const { w, d } = layout;
    const H = ROOM_H;
    const root = this.root;
    const level = opts.level || 0;
    this.level = level;
    // level 0 is the layout itself; the upper storey has its own walls and items
    const src = level ? (layout.upper ||= { walls: [], items: [] }) : layout;
    const colliders = new ColliderWorld(4);
    colliders.bounds = { minX: 0.02, maxX: w - 0.02, minZ: 0.02, maxZ: d - 0.02 };
    this.world = { colliders, groundY: () => 0, ceiling: H };

    // floor + ceiling
    const tex = (FLOORS[layout.floor] || FLOORS.wood)().clone();
    tex.repeat.set(w / 2, d / 2);
    tex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    floor.position.set(w / 2, 0, d / 2);
    floor.receiveShadow = true;
    root.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 1 }));
    ceil.position.set(w / 2, H, d / 2);
    root.add(ceil);

    // perimeter walls: inward-facing planes (invisible from outside, dollhouse style)
    const plaster = Tex.plaster().clone();
    plaster.repeat.set(3, 1.2);
    plaster.needsUpdate = true;
    const wallMat = new THREE.MeshStandardMaterial({ color: layout.wall || '#e9e2d4', roughness: 0.95, map: plaster });
    const trim = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    const wall = (len, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), wallMat);
      m.position.set(x, H / 2, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      root.add(m);
      // skirting board and crown molding: one-sided like the wall, so the
      // cut-away walls nearest the camera stay invisible from outside
      const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), trim);
      b.position.set(x + Math.sin(ry) * 0.006, 0.06, z + Math.cos(ry) * 0.006);
      b.rotation.y = ry;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.09), trim);
      c.position.set(x + Math.sin(ry) * 0.006, H - 0.045, z + Math.cos(ry) * 0.006);
      c.rotation.y = ry;
      root.add(b, c);
    };
    wall(w, w / 2, 0, 0);
    wall(w, w / 2, d, Math.PI);
    wall(d, 0, d / 2, Math.PI / 2);
    wall(d, w, d / 2, -Math.PI / 2);

    // windows on the back wall glow with the sky colour
    const nWin = Math.max(1, Math.floor(w / 4));
    const pano = layout.windows === 'panorama';
    const ww = pano ? Math.min(3.2, w / nWin - 0.5) : 1.5;
    const wh = pano ? 1.9 : 1.3;
    const wy = pano ? 1.65 : 1.95;
    for (let i = 0; i < (layout.dark || layout.windows === 'none' ? 0 : nWin); i++) {
      const x = (w / nWin) * (i + 0.5);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), trim);
      frame.position.set(x, wy, 0.012);
      const gg = new THREE.PlaneGeometry(ww - 0.14, wh - 0.14);
      // each window shows a different slice of the skyline
      const uv = gg.attributes.uv;
      const u0 = (i * 0.29 + (opts.place?.x || 0) * 0.013) % 0.7;
      const su = Math.min(0.3, (ww / 1.5) * 0.22);
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * su, 0.4 + uv.getY(k) * (wh / ww) * su);
      const glass = new THREE.Mesh(gg, this.windowMat);
      glass.position.set(x, wy, 0.02);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.16, 0.05, 0.14), trim);
      sill.position.set(x, wy - wh / 2 - 0.02, 0.07);
      root.add(sill);
      if (opts.home && !pano) {
        // curtains on a rod, gathered at both sides
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, ww + 0.7, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3b3530', roughness: 0.5, metalness: 0.4 }));
        rod.position.set(x, wy + wh / 2 + 0.16, 0.07);
        root.add(rod);
        for (const sgn of [-1, 1]) {
          const cg = new THREE.PlaneGeometry(0.42, wh + 0.45, 10, 1);
          const pos = cg.attributes.position;
          for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin(pos.getX(k) * 26) * 0.035);
          cg.computeVertexNormals();
          const cur = new THREE.Mesh(cg, this.curtainMat(layout));
          cur.position.set(x + sgn * (ww / 2 + 0.12), wy + 0.12 - 0.2, 0.08);
          cur.castShadow = true;
          root.add(cur);
        }
      }
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.05, wh - 0.14), trim);
      bar.position.set(x, wy, 0.025);
      root.add(frame, glass, bar);
    }

    // lift pad between storeys (two-floor homes are stairs-free)
    this.lift = null;
    if ((layout.floors || 1) > 1 && opts.home) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a3a', emissiveIntensity: 0.7, roughness: 0.4 }));
      pad.position.set(w - 0.8, 0.02, d - 0.8);
      root.add(pad);
      this.lift = { x: w - 0.8, z: d - 0.8 };
    }

    // door on the south wall (ground floor only)
    const dx = layout.doorX ?? w / 2;
    // a plane facing into the room, so it never hides the player from a camera outside the wall
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.6 }));
    door.position.set(dx, 1.1, d - 0.02);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.6), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 1 }));
    mat.position.set(dx, 0.012, d - 0.5);
    if (!level) {
      root.add(door, mat);
      const frameMat = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.6 });
      // frame, handle and light switch all face into the room (never seen from outside)
      for (const [fw, fh, fx, fy] of [[0.1, 2.3, dx - 0.6, 1.15], [0.1, 2.3, dx + 0.6, 1.15], [1.3, 0.1, dx, 2.3]]) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh).rotateY(Math.PI), frameMat);
        f.position.set(fx, fy, d - 0.03);
        root.add(f);
      }
      const knob = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.3, metalness: 0.8 }));
      knob.position.set(dx - 0.4, 1.0, d - 0.03);
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.12).rotateY(Math.PI), frameMat);
      sw.position.set(dx + 0.85, 1.25, d - 0.012);
      root.add(knob, sw);
    }
    // a wall clock that keeps the game's time (homes, offices, cafés...)
    this.clock = null;
    if (!level && d >= 5) this.clock = this.makeClock(root, 0.03, 2.3, Math.min(d * 0.32, d - 2.5));
    this.door = level ? null : { x: dx, z: d - 0.9 };

    // inner walls
    for (const s of src.walls || []) {
      const horiz = s.z1 === s.z2;
      const len = horiz ? Math.abs(s.x2 - s.x1) : Math.abs(s.z2 - s.z1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.12, H, horiz ? 0.12 : len), wallMat);
      m.position.set((s.x1 + s.x2) / 2, H / 2, (s.z1 + s.z2) / 2);
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      colliders.add(Math.min(s.x1, s.x2) - 0.07, Math.min(s.z1, s.z2) - 0.07, Math.max(s.x1, s.x2) + 0.07, Math.max(s.z1, s.z2) + 0.07, H);
    }

    // furniture
    this.points = [];
    let lampI = 0;
    for (const l of this.lamps) l.intensity = 0;
    this.lampBase = [];
    for (const it of src.items) {
      const def = FURNITURE_BY_ID[it.id];
      if (!def) continue;
      const use = it.use ?? def.use;
      const node = buildFurniture(it.id, { pc: (use === 'computer' && opts.hasPc) || def.p?.pc });
      node.position.set(it.x, 0, it.z);
      node.rotation.y = (it.r || 0) * (Math.PI / 2);
      root.add(node);
      this.itemNodes.set(it.uid, node);
      const [fw, fd] = footprint(def, it.r || 0);
      if (def.h > 0) colliders.add(it.x - fw / 2 + 0.06, it.z - fd / 2 + 0.06, it.x + fw / 2 - 0.06, it.z + fd / 2 - 0.06, def.h);
      if (use) {
        // interaction spot: just in front of the item
        const a = (it.r || 0) * (Math.PI / 2);
        const reach = def.d / 2 + 0.45;
        this.points.push({ x: it.x + Math.sin(a) * reach, z: it.z + Math.cos(a) * reach, ix: it.x, iz: it.z, r: Math.max(1.15, def.w / 2 + 0.5), use, item: it, def, label: it.svc ? SVC_LABEL[it.svc] || USE_LABEL[use] : USE_LABEL[use] || 'Use' });
      }
      if (def.light && lampI < this.lamps.length) {
        this.lamps[lampI].position.set(it.x, Math.min(2.4, (def.p?.h || 2) + 0.2), it.z);
        this.lampBase[lampI] = def.light * 7;
        lampI++;
      }
    }

    // set the tables in places that serve food: plates, glasses, a candle or a little vase
    const venue = !opts.home && opts.place && ['restaurant', 'cafe', 'bar', 'mall'].includes(opts.place.type) ? opts.place.type : null;
    if (venue && !level) {
      const china = new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.35 });
      const glassM = new THREE.MeshStandardMaterial({ color: '#cfe6f2', roughness: 0.1, transparent: true, opacity: 0.55 });
      const flame = new THREE.MeshBasicMaterial({ color: '#ffcf70' });
      const cloth = new THREE.MeshStandardMaterial({ color: venue === 'restaurant' ? '#f4f1ea' : '#b8463c', roughness: 0.95 });
      const plateG = new THREE.CylinderGeometry(0.11, 0.09, 0.015, 18);
      const glassG = new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10);
      for (const it of src.items) {
        if (it.id !== 'table_small' && it.id !== 'dining_table') continue;
        const top = FURNITURE_BY_ID[it.id].h + 0.005;
        const g = new THREE.Group();
        if (venue === 'restaurant') {
          // a white tablecloth square
          const tc = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.01, 0.98), cloth);
          tc.position.y = top;
          g.add(tc);
        }
        for (const s of [-1, 1]) {
          const p = new THREE.Mesh(plateG, china);
          p.position.set(s * 0.26, top + 0.015, 0);
          const gl = new THREE.Mesh(glassG, glassM);
          gl.position.set(s * 0.26, top + 0.07, s * 0.2);
          g.add(p, gl);
        }
        if (venue === 'restaurant' || venue === 'bar') {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), china);
          c.position.set(0, top + 0.05, 0);
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5).scale(1, 1.8, 1), flame);
          f.position.set(0, top + 0.12, 0);
          g.add(c, f);
        } else {
          const v = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.1, 10), glassM);
          v.position.set(0, top + 0.05, 0);
          const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: ['#e35d6a', '#f2c94c', '#9b6be0'][Math.abs(Math.round(it.x * 7 + it.z * 3)) % 3], roughness: 0.8 }));
          fl.position.set(0, top + 0.14, 0);
          g.add(v, fl);
        }
        g.position.set(it.x, 0, it.z);
        g.rotation.y = (it.r || 0) * (Math.PI / 2);
        root.add(g);
      }
    }

    // lighting rig sized to the room
    this.sun.position.set(w * 0.35, 7, d * 0.75);
    this.sun.target.position.set(w * 0.5, 0, d * 0.4);
    const sc = this.sun.shadow.camera;
    const ext = Math.max(w, d) * 0.75;
    sc.left = sc.bottom = -ext;
    sc.right = sc.top = ext;
    sc.near = 0.5;
    sc.far = 20;
    sc.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
    return this;
  }

  /** Curtain fabric picked to suit the wall colour. */
  curtainMat(layout) {
    const key = layout.wall || 'x';
    if (this._curtain?.key === key) return this._curtain.mat;
    const cols = ['#8a3b3b', '#2f4f6f', '#6b7a4a', '#d9cbb0', '#4a3f5c', '#b98a5a'];
    let hsh = 0;
    for (const ch of key) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
    const mat = new THREE.MeshStandardMaterial({ color: cols[Math.abs(hsh) % cols.length], roughness: 0.95, side: THREE.DoubleSide });
    this._curtain = { key, mat };
    return mat;
  }

  /** Round wall clock on the west wall; hands follow the game clock. */
  makeClock(root, x, y, z) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 28).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.6 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 8, 28).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.4, metalness: 0.3 }));
    g.add(face, rim);
    const tickMat = new THREE.MeshBasicMaterial({ color: '#2b2b2e' });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.005, i % 3 ? 0.018 : 0.035, 0.008), tickMat);
      t.position.set(0.017, Math.cos(a) * 0.155, Math.sin(a) * 0.155);
      t.rotation.x = a;
      g.add(t);
    }
    const hand = (len, wid) => {
      const p = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.006, len, wid).translate(0, len / 2 - 0.02, 0), tickMat);
      p.add(m);
      p.position.x = 0.022;
      g.add(p);
      return p;
    };
    const hourH = hand(0.1, 0.014);
    const minH = hand(0.15, 0.009);
    g.position.set(x, y, z);
    root.add(g);
    return { hourH, minH };
  }

  /** Up to n open floor positions (for NPCs), away from furniture and the door. */
  freeSpots(n, rng = Math.random) {
    const { w, d } = this.layout;
    const out = [];
    for (let x = 1; x <= w - 1; x += 1) {
      for (let z = 1; z <= d - 1.6; z += 1) {
        const px = x + (rng() - 0.5) * 0.4;
        const pz = z + (rng() - 0.5) * 0.4;
        if (this.world.colliders.pointBlocked(px, 0.4, pz, 0.5)) continue;
        if (this.door && Math.hypot(px - this.door.x, pz - this.door.z) < 1.8) continue;
        out.push({ x: px, z: pz, k: rng() });
      }
    }
    return out.sort((a, b) => a.k - b.k).slice(0, n);
  }

  /** Nearest usable thing to a position: furniture point or the exit door. */
  nearest(pos) {
    let best = null;
    let bd = 1e9;
    for (const p of this.points) {
      // closest interaction spot wins (each spot sits just in front of its item)
      const reach = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (reach < p.r && reach < bd) {
        bd = reach;
        best = p;
      }
    }
    if (best) return best;
    if (this.lift && Math.hypot(this.lift.x - pos.x, this.lift.z - pos.z) < 1.2) return { lift: true, label: this.level ? 'Go downstairs' : 'Go upstairs' };
    if (this.door && Math.hypot(this.door.x - pos.x, this.door.z + 0.5 - pos.z) < 1.5) return { exit: true, label: 'Leave' };
    return null;
  }

  /** @param night 0..1  @param skyColor THREE.Color of the horizon/top mix */
  update(night, skyColor, minutes) {
    const dark = night > 0.55;
    const map = this.windowMat.userData.keep ? this.windowMat.map : dark ? Tex.skylineNight() : Tex.skylineDay();
    if (this.windowMat.map !== map) {
      this.windowMat.map = map;
      this.windowMat.needsUpdate = true;
    }
    if (this.windowMat.userData.keep) this.windowMat.color.setScalar(1);
    else if (dark) this.windowMat.color.setScalar(0.75 + (night - 0.55) * 0.5);
    else this.windowMat.color.copy(skyColor).lerp(_white, 0.35 + (1 - night) * 0.25);
    if (this.clock && minutes != null) {
      const m = minutes % 1440;
      this.clock.minH.rotation.x = -((m % 60) / 60) * Math.PI * 2;
      this.clock.hourH.rotation.x = -(((m / 60) % 12) / 12) * Math.PI * 2;
    }
    const dim = this.dark ? 0.28 : 1;
    this.sun.intensity = (1.7 - night * 0.9) * dim;
    this.hemi.intensity = (1.9 - night * 0.5) * (this.dark ? 0.35 : 1);
    for (let i = 0; i < this.lamps.length; i++) {
      this.lamps[i].intensity = (this.lampBase?.[i] || 0) * (this.dark ? 1.4 : 0.35 + night * 0.65);
      this.lamps[i].color.set(this.dark ? ['#ff4fd8', '#4fe0ff', '#8a5bff'][i % 3] : '#ffcf90');
    }
  }
}
const _white = new THREE.Color('#ffffff');
