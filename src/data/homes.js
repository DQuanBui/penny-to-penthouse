// Housing ladder. Rent and price are base values (× city rentIndex/homePriceIndex
// × district rentMul). `size` is the interior footprint in grid cells (1 cell = 1 m),
// `floors` the number of storeys build mode may use, `comfort` scales how well
// needs recover at home before furniture is counted.

export const HOME_TYPES = [
  { id: 'couch', name: "Friend's Couch", icon: '🛋️', tier: 0, rent: 260, price: 0, size: [5, 4], floors: 1, comfort: 0.7, rentOnly: true, desc: 'A lumpy sofa in a shared living room. It is a roof.' },
  { id: 'room', name: 'Rented Room', icon: '🚪', tier: 1, rent: 720, price: 0, size: [5, 5], floors: 1, comfort: 0.85, rentOnly: true, desc: 'One small room in a shared flat. Yours, mostly.' },
  { id: 'studio', name: 'Studio', icon: '🏢', tier: 2, rent: 1180, price: 185000, size: [7, 6], floors: 1, comfort: 1.0, desc: 'Kitchen, bed and sofa all within arm’s reach.' },
  { id: 'apartment', name: 'One-Bedroom Apartment', icon: '🏬', tier: 3, rent: 1750, price: 295000, size: [9, 8], floors: 1, comfort: 1.1, desc: 'A real bedroom door. Room for guests and a desk.' },
  { id: 'condo', name: 'Condo', icon: '🏙️', tier: 4, rent: 2550, price: 420000, size: [11, 9], floors: 1, comfort: 1.2, desc: 'Modern two-bedroom with a view and a doorman.' },
  { id: 'townhouse', name: 'Townhouse', icon: '🏘️', tier: 5, rent: 3300, price: 575000, size: [9, 10], floors: 2, comfort: 1.25, desc: 'Two floors, a stoop and neighbours who say hello.' },
  { id: 'house', name: 'House', icon: '🏡', tier: 6, rent: 4100, price: 740000, size: [13, 11], floors: 2, comfort: 1.3, desc: 'A whole house. Space to build exactly the life you want.' },
  { id: 'penthouse', name: 'Luxury Penthouse', icon: '🌇', tier: 7, rent: 11500, price: 2150000, size: [16, 13], floors: 2, comfort: 1.5, desc: 'The top floor. The city is your wallpaper.' },
];
export const HOME_BY_ID = Object.fromEntries(HOME_TYPES.map((h) => [h.id, h]));

/** Monthly rent of a home type in a district of a city. */
export function rentFor(typeId, city, district) {
  const t = HOME_BY_ID[typeId];
  return Math.round((t.rent * city.rentIndex * (district?.rentMul || 1)) / 10) * 10;
}
/** Purchase price of a home type in a district of a city. */
export function priceFor(typeId, city, district) {
  const t = HOME_BY_ID[typeId];
  return Math.round((t.price * (city.homePriceIndex || city.rentIndex) * (0.6 + 0.4 * (district?.rentMul || 1))) / 1000) * 1000;
}
