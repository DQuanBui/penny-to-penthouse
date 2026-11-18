// Flying between cities. A trip keeps your home, job and bills where they
// are; you stay in the visited city's hotel (charged nightly) until you fly
// back. state.trip = { cityId, since } or null.
import { CITY_BY_ID } from '../data/cities/index.js';

const COORDS = { newyork: [40.71, -74.0], losangeles: [34.05, -118.24], chicago: [41.88, -87.63], miami: [25.76, -80.19], austin: [30.27, -97.74] };

/** Great-circle distance, one-way fare and flight time between two cities. */
export function flightInfo(from, to) {
  const a = COORDS[from] || COORDS.newyork;
  const b = COORDS[to] || COORDS.newyork;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  const km = Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
  return { km, fare: Math.round(59 + km * 0.075), minutes: Math.round(40 + (km / 780) * 60) };
}

export const hotelRate = (cityId) => Math.round(150 * (CITY_BY_ID[cityId]?.priceIndex || 1));
export const hotelName = (cityId) => CITY_BY_ID[cityId]?.hotel || `Grand ${CITY_BY_ID[cityId]?.name || ''} Hotel`;

export class Trips {
  constructor(sim) {
    this.sim = sim;
  }
  daily(sim) {
    const t = sim.state.trip;
    if (!t) return;
    // the hotel bills every night you are away
    sim.finance.charge(hotelRate(t.cityId), 'housing', `Hotel night · ${hotelName(t.cityId)}`);
  }
}
