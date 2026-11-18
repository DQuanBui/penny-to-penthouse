// Your dog: adoption, daily food, walks, cuddles and happiness.
// state.pet = { name, breed, age, adopted, happy 0..100, walked (min today),
//               lastCuddle (time), sadDays } or null
import { BREEDS, BREED_BY_ID, DOG_NAMES, PET } from '../data/pets.js';
import { addNeed } from './Needs.js';
import { mulberry32, hashStr, clamp, fmtMoney } from '../core/utils.js';

export class Pets {
  constructor(sim) {
    this.sim = sim;
  }
  get pet() {
    return this.sim.state.pet;
  }
  breed() {
    return this.pet ? BREED_BY_ID[this.pet.breed] || BREEDS[0] : null;
  }
  price(base) {
    return Math.round(base * (this.sim.city.priceIndex || 1));
  }
  fee(breed) {
    return this.price(breed.fee);
  }

  /** The three dogs waiting at the rescue (they change every few days). */
  available() {
    const sim = this.sim;
    const r = mulberry32(hashStr(`rescue-${sim.state.cityId}-${Math.floor(sim.day / 3)}`));
    const out = [];
    const used = new Set();
    while (out.length < 3) {
      const b = BREEDS[Math.floor(r() * BREEDS.length)];
      const name = DOG_NAMES[Math.floor(r() * DOG_NAMES.length)];
      if (used.has(b.id) || used.has(name)) continue;
      used.add(b.id);
      used.add(name);
      out.push({ breed: b, name, age: 1 + Math.floor(r() * 8) });
    }
    return out;
  }

  /** Adopt a dog. `free` skips the fee (a stray that chose you). */
  adopt(offer, name, free = false) {
    const sim = this.sim;
    if (this.pet) return false;
    name = String(name || offer.name).trim().slice(0, 16) || offer.name;
    if (!free && !sim.finance.spend(this.fee(offer.breed), 'other', `Adoption fee · ${name}`)) return false;
    sim.state.pet = { name, breed: offer.breed.id, age: offer.age, adopted: sim.day, happy: 80, walked: 0, lastCuddle: -999, sadDays: 0 };
    sim.state.stats.petsAdopted = (sim.state.stats.petsAdopted || 0) + 1;
    addNeed(sim, 'fun', 15);
    addNeed(sim, 'social', 10);
    sim.bus.emit('toast', { icon: '🐕', title: `Welcome home, ${name}!`, text: `${name} will follow you everywhere. Walk them every day and they will love you for it.`, kind: 'good' });
    sim.bus.emit('petChanged', {});
    return true;
  }

  /** Give the dog back to the rescue. */
  rehome(reason) {
    const sim = this.sim;
    const p = this.pet;
    if (!p) return;
    sim.state.pet = null;
    addNeed(sim, 'fun', -20);
    sim.bus.emit('toast', { icon: '💔', title: `Goodbye, ${p.name}`, text: reason || `${p.name} went back to the rescue, where they will find a new family.`, kind: 'bad' });
    sim.bus.emit('petChanged', {});
  }

  /** Called while you walk your dog outside (game minutes). */
  walk(minutes) {
    const p = this.pet;
    if (!p) return;
    const before = p.walked;
    p.walked += minutes;
    if (before < PET.walkMinutes && p.walked >= PET.walkMinutes) {
      p.happy = clamp(p.happy + 25, 0, 100);
      addNeed(this.sim, 'fun', 8);
      addNeed(this.sim, 'health', 2);
      this.sim.bus.emit('toast', { icon: '🦮', title: 'Good walk!', text: `${p.name} got their walk today. Tail wagging at full speed.`, kind: 'good' });
    }
  }

  /** Pet and cuddle. Returns the outcome text. */
  cuddle() {
    const sim = this.sim;
    const p = this.pet;
    if (!p) return '';
    const t = sim.state.time.total;
    if (t - p.lastCuddle < PET.cuddleEvery) return `${p.name} leans into you happily.`;
    p.lastCuddle = t;
    p.happy = clamp(p.happy + 6, 0, 100);
    addNeed(sim, 'fun', 5);
    addNeed(sim, 'social', 4);
    return `${p.name} rolls over for belly rubs. You both feel better.`;
  }

  /** A round of fetch (the game animates the throw first). */
  fetched() {
    const sim = this.sim;
    const p = this.pet;
    if (!p) return '';
    p.happy = clamp(p.happy + 10, 0, 100);
    addNeed(sim, 'fun', 9);
    addNeed(sim, 'energy', -2);
    sim.advance(5, { noCollapse: true });
    return `${p.name} brings the ball straight back. Again! Again!`;
  }

  /** Paid care at the rescue: 'treat' | 'vet' | 'groom' | 'toys'. */
  care(kind) {
    const sim = this.sim;
    const p = this.pet;
    if (!p) return false;
    const def = {
      treat: [PET.treat, 'food', 'Dog treat', 4],
      vet: [PET.vet, 'health', 'Vet check-up', 12],
      groom: [PET.groom, 'shopping', 'Dog grooming', 15],
      toys: [PET.toys, 'shopping', 'Dog toys', 9],
    }[kind];
    if (!def || !sim.finance.spend(this.price(def[0]), def[1], `${def[2]} · ${p.name}`)) return false;
    p.happy = clamp(p.happy + def[3], 0, 100);
    if (kind === 'vet') p.vetDay = sim.day;
    return true;
  }

  daily(sim) {
    const p = this.pet;
    if (!p) return;
    // a happy dog greets you every morning
    if (p.happy >= 70) {
      addNeed(sim, 'fun', 4);
      addNeed(sim, 'social', 5);
    }
    // breakfast
    const food = this.price(PET.foodPerDay);
    if (!sim.finance.spend(food, 'food', `Dog food · ${p.name}`, { silent: true })) p.happy -= 12;
    // missing a walk hurts; a walked dog only gets a little restless overnight
    p.happy = clamp(p.happy - (p.walked >= PET.walkMinutes ? 4 : 16), 0, 100);
    p.walked = 0;
    if (p.happy <= 0) p.sadDays++;
    else p.sadDays = 0;
    if (p.sadDays >= 4) return this.rehome(`${p.name} was neglected for too long. A neighbour called the rescue, and they came to take ${p.name} somewhere they will be loved.`);
    if (p.happy < 25 && !sim.headless) sim.bus.emit('toast', { icon: '🐕', title: `${p.name} looks sad`, text: `${p.name} needs a walk (${PET.walkMinutes} minutes outside together) and some attention.`, kind: 'warn' });
  }

  monthly(sim) {
    const p = this.pet;
    if (!p) return;
    // yearly shots and the odd chewed shoe
    const cost = this.price(18);
    sim.finance.spend(cost, 'health', `Pet insurance · ${p.name}`, { silent: true });
  }
}

/** Short status line for the UI. */
export function petStatus(sim) {
  const p = sim.state.pet;
  if (!p) return '';
  const left = Math.max(0, PET.walkMinutes - p.walked);
  return left > 0 ? `Needs ${Math.ceil(left)} more minutes of walking today` : 'Walked today ✓';
}

export const petFoodCost = (sim) => fmtMoney(Math.round(PET.foodPerDay * (sim.city.priceIndex || 1)));
