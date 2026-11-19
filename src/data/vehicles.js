// Cars sold at the dealer (all fictional makes).
//  top    top speed in m/s        accel  m/s²        grip  steering response
//  upkeep monthly insurance + fuel + maintenance (× city priceIndex)
//  body   body style (world/CarModel.js BODIES)   size  [width, height, length] scale of that body
//  style  adds to popularity like an outfit does

export const VEHICLES = [
  { id: 'dart', name: 'Used Dart Hatchback', icon: '🚙', price: 6500, top: 15, accel: 5, grip: 1.0, upkeep: 150, body: 'compact', size: [1, 1, 1], colors: ['#8a8d92', '#b0463c', '#3f5f8a'], style: 0, desc: 'High mileage, low price. It gets you there — and unlocks rideshare shifts.' },
  { id: 'kaze', name: 'Kaze City Compact', icon: '🚗', price: 17500, top: 17, accel: 6, grip: 1.1, upkeep: 160, body: 'compact', size: [1, 1, 1], colors: ['#c53a3a', '#f4f4f2', '#2f8f8f', '#e9c04c'], style: 1, desc: 'Starts every morning, parks anywhere, sips fuel. Everyone has had one.' },
  { id: 'metro', name: 'Apex Metro Sedan', icon: '🚗', price: 19500, top: 19, accel: 6.5, grip: 1.1, upkeep: 190, body: 'sedan', size: [1, 1, 1], colors: ['#f4f4f2', '#27406b', '#1d1f24', '#c53a3a'], style: 2, desc: 'Sensible, reliable, forgettable. The car your accountant drives.' },
  { id: 'hauler', name: 'Bluebonnet Hauler Pickup', icon: '🛻', price: 33000, top: 18, accel: 6, grip: 0.95, upkeep: 260, body: 'pickup', size: [1, 1, 1], colors: ['#c53a3a', '#f4f4f2', '#3a4254'], style: 3, desc: 'Hauls anything. Handy friends suddenly call you a lot.' },
  { id: 'trail', name: 'Summit Trail SUV', icon: '🚙', price: 42000, top: 20, accel: 7, grip: 1.05, upkeep: 280, body: 'suv', size: [1, 1, 1], colors: ['#3f5f4a', '#1d1f24', '#d9c7a8'], style: 4, desc: 'Sits high, rides smooth, fits the whole friend group.' },
  { id: 'e1', name: 'Voltix E1 Electric', icon: '⚡', price: 49000, top: 23, accel: 10, grip: 1.25, upkeep: 140, body: 'sport', size: [1, 0.98, 0.97], colors: ['#f4f4f2', '#5ab0ff', '#1d1f24'], style: 6, desc: 'Silent and startlingly quick. Costs little to run.' },
  { id: 'vektor', name: 'Nordwerk Vektor Sport Sedan', icon: '🚘', price: 56000, top: 26, accel: 9.5, grip: 1.3, upkeep: 360, body: 'sport', size: [1, 1, 1], colors: ['#1d2a4a', '#f4f4f2', '#8a8d92', '#1d1f24'], style: 7, desc: 'Precise steering, a growl at full throttle and a very serious grille.' },
  { id: 'titan', name: 'Titan Box Truck', icon: '🚚', price: 52000, top: 15, accel: 4, grip: 0.8, upkeep: 380, body: 'box', size: [1, 1, 1], colors: ['#f4f4f2', '#2f5aa3', '#c53a3a'], style: 1, desc: 'Moves a whole apartment in one trip. Parking it is another story.' },
  { id: 'stinger', name: 'Apex Stinger Coupé', icon: '🏎️', price: 79000, top: 29, accel: 11, grip: 1.4, upkeep: 420, body: 'coupe', size: [1, 1, 1], colors: ['#e9c04c', '#c53a3a', '#1d1f24'], style: 9, desc: 'Two seats, too much power, zero practicality. People stare.' },
  { id: 'monarch', name: 'Monarch GT', icon: '👑', price: 168000, top: 31, accel: 12, grip: 1.35, upkeep: 650, body: 'sport', size: [1.04, 1.02, 1.06], colors: ['#1d1f24', '#f4f4f2', '#5a4fd0'], style: 14, desc: 'Hand-stitched everything. The car that says you have arrived.' },
  { id: 'furia', name: 'Veloce Furia V12', icon: '🏎️', price: 340000, top: 37, accel: 15, grip: 1.55, upkeep: 1400, body: 'supercar', size: [1, 1, 1], colors: ['#e9c04c', '#3fbf5a', '#f07a1a', '#c53a3a', '#1d1f24'], style: 22, desc: 'A scissor-door wedge with a V12 scream. Heads turn three blocks away.' },
];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

export const CAR = {
  depreciationPerMonth: 0.013,
  sellBack: 0.85, // of current value at the dealer
  minDown: 0.1,
  valetFee: 25,
};
