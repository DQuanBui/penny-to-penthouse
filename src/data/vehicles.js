// Cars sold at the dealer (all fictional makes).
//  top    top speed in m/s        accel  m/s²        grip  steering response
//  upkeep monthly insurance + fuel + maintenance (× city priceIndex)
//  size   [width, height, length] scale of the base car mesh
//  style  adds to popularity like an outfit does

export const VEHICLES = [
  { id: 'dart', name: 'Used Dart Hatchback', icon: '🚙', price: 6500, top: 15, accel: 5, grip: 1.0, upkeep: 150, size: [0.92, 0.95, 0.85], colors: ['#8a8d92', '#b0463c', '#3f5f8a'], style: 0, desc: 'High mileage, low price. It gets you there — and unlocks rideshare shifts.' },
  { id: 'metro', name: 'Apex Metro Sedan', icon: '🚗', price: 19500, top: 19, accel: 6.5, grip: 1.1, upkeep: 190, size: [1, 1, 1], colors: ['#f4f4f2', '#27406b', '#1d1f24', '#c53a3a'], style: 2, desc: 'Sensible, reliable, forgettable. The car your accountant drives.' },
  { id: 'hauler', name: 'Bluebonnet Hauler Pickup', icon: '🛻', price: 33000, top: 18, accel: 6, grip: 0.95, upkeep: 260, size: [1.08, 1.25, 1.18], colors: ['#c53a3a', '#f4f4f2', '#3a4254'], style: 3, desc: 'Hauls anything. Handy friends suddenly call you a lot.' },
  { id: 'trail', name: 'Summit Trail SUV', icon: '🚙', price: 42000, top: 20, accel: 7, grip: 1.05, upkeep: 280, size: [1.06, 1.3, 1.08], colors: ['#3f5f4a', '#1d1f24', '#d9c7a8'], style: 4, desc: 'Sits high, rides smooth, fits the whole friend group.' },
  { id: 'e1', name: 'Voltix E1 Electric', icon: '⚡', price: 49000, top: 23, accel: 10, grip: 1.25, upkeep: 140, size: [1, 0.96, 1], colors: ['#f4f4f2', '#5ab0ff', '#1d1f24'], style: 6, desc: 'Silent and startlingly quick. Costs little to run.' },
  { id: 'stinger', name: 'Apex Stinger Coupé', icon: '🏎️', price: 79000, top: 29, accel: 11, grip: 1.4, upkeep: 420, size: [1.02, 0.82, 1.02], colors: ['#e9c04c', '#c53a3a', '#1d1f24'], style: 9, desc: 'Two seats, too much power, zero practicality. People stare.' },
  { id: 'monarch', name: 'Monarch GT', icon: '👑', price: 168000, top: 31, accel: 12, grip: 1.35, upkeep: 650, size: [1.08, 0.92, 1.14], colors: ['#1d1f24', '#f4f4f2', '#5a4fd0'], style: 14, desc: 'Hand-stitched everything. The car that says you have arrived.' },
];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

export const CAR = {
  depreciationPerMonth: 0.013,
  sellBack: 0.85, // of current value at the dealer
  minDown: 0.1,
  valetFee: 25,
};
