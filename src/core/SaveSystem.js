// Three save slots in localStorage plus JSON export/import.
import { SAVE_VERSION } from '../sim/State.js';
import { dayOf } from './Clock.js';

const PREFIX = 'p2p.save.';
export const SLOTS = [1, 2, 3];

function read(slot) {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Small summary shown in menus and the Hall of Fame. */
export function makeMeta(state, extra = {}) {
  return {
    name: state.profile.name,
    archetype: state.profile.archetype,
    cityId: state.cityId,
    day: dayOf(state.time.total) + 1,
    age: state.profile.age,
    playtime: Math.round(state.playtime),
    savedAt: Date.now(),
    v: SAVE_VERSION,
    ...extra,
  };
}

export function listSlots() {
  return SLOTS.map((slot) => ({ slot, meta: read(slot)?.meta || null }));
}

export function saveSlot(slot, state, extra) {
  try {
    localStorage.setItem(PREFIX + slot, JSON.stringify({ meta: makeMeta(state, extra), state }));
    return true;
  } catch {
    return false;
  }
}

export function loadSlot(slot) {
  const data = read(slot);
  return data && data.state ? data.state : null;
}

export function deleteSlot(slot) {
  try {
    localStorage.removeItem(PREFIX + slot);
  } catch {
    /* ignore */
  }
}

/** Slot with the most recent save, or null. */
export function latestSlot() {
  let best = null;
  for (const s of listSlots()) if (s.meta && (!best || s.meta.savedAt > best.meta.savedAt)) best = s;
  return best ? best.slot : null;
}

export function firstFreeSlot() {
  const s = listSlots().find((x) => !x.meta);
  return s ? s.slot : null;
}

/** Download a save as a .json file. */
export function exportSave(state, extra) {
  const blob = new Blob([JSON.stringify({ game: 'penny-to-penthouse', meta: makeMeta(state, extra), state }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `penny-to-penthouse-${state.profile.name.replace(/[^a-z0-9]+/gi, '_')}-day${dayOf(state.time.total) + 1}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Ask for a .json file and resolve with its state (or reject with a message). */
export function importSave() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return reject(new Error('No file chosen'));
      try {
        const data = JSON.parse(await f.text());
        const state = data.state || data;
        if (!state || !state.profile || !state.money || !state.time) throw new Error('bad');
        resolve(state);
      } catch {
        reject(new Error('That file is not a Penny to Penthouse save.'));
      }
    };
    inp.click();
  });
}
