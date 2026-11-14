// Registry of playable cities. To add a city: create a data file next to this
// one and add it to the list — no engine changes required.
import newyork from './newyork.js';

export const CITIES = [newyork];
export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));
export const getCity = (id) => CITY_BY_ID[id] || CITIES[0];
