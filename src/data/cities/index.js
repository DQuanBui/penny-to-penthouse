// Registry of playable cities. To add a city: create a data file next to this
// one and add it to the list — no engine changes required.
import newyork from './newyork.js';
import losangeles from './losangeles.js';
import chicago from './chicago.js';
import miami from './miami.js';
import austin from './austin.js';

export const CITIES = [newyork, losangeles, chicago, miami, austin];
export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));
export const getCity = (id) => CITY_BY_ID[id] || CITIES[0];
