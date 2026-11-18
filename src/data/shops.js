// Neighbourhood businesses that fill the ground floors of ordinary buildings:
// bars, clubs, pizza places, delis, pharmacies, barbers... Each one gets a
// fictional name, opening hours, a storefront look, an interior and a menu.
//
// menu item: { id, name, icon, price, minutes, needs:{need:delta}, line, special? }
//   special: 'haircut' | 'gift' | 'lottery' | 'books' | 'popularity'
// hours: [open, close] in hours; close may pass midnight (e.g. 26 = 2 AM)
// cat: map filter group ('food' | 'night' | 'shop' | 'service' | 'fun')

export const SHOP_TYPES = {
  pub: {
    label: 'Bar', icon: '🍺', color: '#c27a2c', cat: 'night', hours: [16, 26], interior: 'pub', weight: 2.4,
    look: { front: 'shopfront', brand: '#3b2418', trim: '#e2b35a', awning: 'flat', extras: ['neonSign', 'bladeLogo'] },
    names: ['The Rusty Nail', 'Half Moon Tavern', 'The Tipsy Owl', 'Copper Fox', 'Brick & Barrel', 'The Lantern Room', 'Corner Pocket', 'Last Call Saloon', 'The Hollow Oak', 'Red Door Tavern', 'Hops & Hollers', 'The Night Owl'],
    menu: [
      { id: 'beer', name: 'Draft beer', icon: '🍺', price: 7, minutes: 30, needs: { fun: 8, social: 5 }, line: 'Cold, crisp, and the bartender knows your name now.' },
      { id: 'cocktail', name: 'House cocktail', icon: '🍸', price: 14, minutes: 40, needs: { fun: 12, social: 7 }, line: 'Something smoky with a twist. You feel fancy.' },
      { id: 'darts', name: 'Play darts with the regulars', icon: '🎯', price: 0, minutes: 30, needs: { fun: 10, social: 9 }, line: 'You hit a bullseye. The regulars cheer. Mostly sarcastically.' },
      { id: 'game', name: 'Watch the game on the big screen', icon: '📺', price: 6, minutes: 90, needs: { fun: 16, social: 8 }, line: 'Overtime! The whole bar is on its feet.' },
    ],
  },
  club: {
    label: 'Nightclub', icon: '🪩', color: '#c43bd6', cat: 'night', hours: [21, 28], interior: 'club', weight: 1.5,
    look: { front: 'shopfront', brand: '#0f0b1a', trim: '#ff4fd8', awning: 'none', extras: ['neonStrip', 'velvetRope'] },
    names: ['Pulse', 'Neon Garden', 'Afterglow', 'Bassline', 'Club Echo', 'Midnight Hall', 'Lumen', 'Velvet Room', 'Prism', 'The Vault'],
    menu: [
      { id: 'dance', name: 'Cover charge — dance all night', icon: '💃', price: 25, minutes: 120, needs: { fun: 32, social: 16, energy: -18 }, line: 'The bass hits your chest. You dance until your feet give up.' },
      { id: 'drink', name: 'Drink at the bar', icon: '🍹', price: 16, minutes: 30, needs: { fun: 10, social: 6 }, line: 'Neon cocktail. It tastes like a glow stick, in a good way.' },
      { id: 'vip', name: 'VIP table and bottle service', icon: '🍾', price: 450, minutes: 180, needs: { fun: 45, social: 35, energy: -20 }, line: 'Sparklers, a booth, and a crowd taking photos of you.', special: 'popularity' },
    ],
  },
  pizza: {
    label: 'Pizzeria', icon: '🍕', color: '#d9482b', cat: 'food', hours: [10, 25], interior: 'pizza', weight: 3,
    look: { front: 'shopfront', brand: '#b3261e', trim: '#f4efe4', awning: 'slant', extras: ['chalkboard'] },
    names: ['Nonna Rosa Pizza', 'Big Slice', 'Corner Slice', 'Gino & Sons', 'Fire Brick Pizza', 'Lucky Pie', 'Two Brothers Slice', 'Mama Lucia', 'The Dough Box', 'Old Town Pizzeria'],
    menu: [
      { id: 'slice', name: 'Plain slice', icon: '🍕', price: 3.5, minutes: 10, needs: { hunger: 22 }, line: 'Folded in half, eaten on the sidewalk. Perfect.' },
      { id: 'pepperoni', name: 'Two pepperoni slices and a soda', icon: '🥤', price: 9, minutes: 20, needs: { hunger: 40, fun: 4 }, line: 'Crispy edges, grease on the paper plate. Worth it.' },
      { id: 'pie', name: 'Whole pie to share', icon: '🍕', price: 24, minutes: 40, needs: { hunger: 60, social: 6, fun: 5 }, line: 'You share it with the table next to you. New friends.' },
    ],
  },
  deli: {
    label: 'Deli & Grocery', icon: '🥪', color: '#3f8f4a', cat: 'food', hours: [0, 24], interior: 'deli', weight: 2.4,
    look: { front: 'shopfront', brand: '#1f5f36', trim: '#ffd84a', awning: 'flat', extras: ['produce'] },
    names: ['Lucky Star Deli', 'Corner Mart', 'Sunrise Deli & Grocery', 'Golden Apple Market', 'Ave Deli', '24/7 Bodega', 'Brothers Deli', 'Uptown Grocery', 'Happy Day Deli', 'Green Leaf Mart'],
    menu: [
      { id: 'bec', name: 'Bacon, egg and cheese on a roll', icon: '🥪', price: 6.5, minutes: 10, needs: { hunger: 32, fun: 3 }, line: 'Salt, pepper, ketchup. The breakfast of champions.' },
      { id: 'coffee', name: 'Coffee, regular', icon: '☕', price: 2, minutes: 5, needs: { energy: 12 }, line: 'Light and sweet, in the blue paper cup.' },
      { id: 'energy', name: 'Energy drink', icon: '🥫', price: 4, minutes: 3, needs: { energy: 22, health: -1 }, line: 'You can hear colours now.' },
      { id: 'snacks', name: 'Chips and a soda', icon: '🍟', price: 4, minutes: 5, needs: { hunger: 14, fun: 4 }, line: 'Crunchy, fizzy, gone in a minute.' },
      { id: 'lotto', name: 'Scratch-off lottery ticket', icon: '🎟️', price: 2, minutes: 2, needs: { fun: 3 }, line: '', special: 'lottery' },
    ],
  },
  pharmacy: {
    label: 'Pharmacy', icon: '💊', color: '#2f8fd6', cat: 'service', hours: [8, 22], interior: 'pharmacy', weight: 2,
    look: { front: 'shopfront', brand: '#1d5fa8', trim: '#ffffff', awning: 'none', extras: ['redCross'] },
    names: ['Wellcare Pharmacy', 'Main Street Drugs', 'Greenleaf Pharmacy', 'CityCare Chemists', 'Neighborhood Rx', 'Corner Drug Co.', 'Healthwise Pharmacy'],
    menu: [
      { id: 'cold', name: 'Cold and flu medicine', icon: '💊', price: 12, minutes: 5, needs: { health: 12 }, line: 'The pharmacist says rest and fluids. Mostly rest.' },
      { id: 'vitamins', name: 'Multivitamins', icon: '🧴', price: 18, minutes: 3, needs: { health: 6, energy: 4 }, line: 'You feel healthier already. Probably placebo. Still.' },
      { id: 'firstaid', name: 'First aid kit', icon: '🩹', price: 9, minutes: 3, needs: { health: 8 }, line: 'Plasters for every occasion.' },
      { id: 'flushot', name: 'Seasonal flu shot', icon: '💉', price: 0, minutes: 15, needs: { health: 10 }, line: 'A quick pinch. Covered by insurance.' },
    ],
  },
  barber: {
    label: 'Barbershop', icon: '💈', color: '#c53a3a', cat: 'service', hours: [9, 20], interior: 'barber', weight: 2.2,
    look: { front: 'shopfront', brand: '#1d2433', trim: '#e9e6df', awning: 'slant', extras: ['bladeLogo'] },
    names: ['Fade Factory', 'Sharp Lines', 'Classic Cuts', "The Gentleman's Chair", 'Clipper Kings', 'Fresh Fades', 'Main Street Barbers', 'Razor & Comb'],
    menu: [
      { id: 'cut', name: 'Haircut — pick a new style', icon: '✂️', price: 28, minutes: 40, needs: { hygiene: 10, fun: 6 }, line: 'Looking sharp. The barber spins the chair so you can see.', special: 'haircut' },
      { id: 'shave', name: 'Hot towel shave', icon: '🪒', price: 22, minutes: 30, needs: { hygiene: 14, fun: 8 }, line: 'Steaming towel, straight razor, total relaxation.' },
    ],
  },
  salon: {
    label: 'Nail & Spa', icon: '💅', color: '#e06a9a', cat: 'service', hours: [10, 20], interior: 'salon', weight: 1.4,
    look: { front: 'shopfront', brand: '#f2c4d6', trim: '#7a2a4a', awning: 'slant', extras: ['planters'] },
    names: ['Glow Nail Spa', 'Polish & Co', 'Luxe Nails', 'Lotus Spa', 'Pink Orchid Nails', 'Serenity Day Spa'],
    menu: [
      { id: 'mani', name: 'Manicure', icon: '💅', price: 30, minutes: 40, needs: { fun: 14, hygiene: 8 }, line: 'Fresh colour, fresh mood.' },
      { id: 'massage', name: 'Hour-long massage', icon: '💆', price: 75, minutes: 60, needs: { energy: 24, fun: 18, health: 4 }, line: 'Every knot from the week, gone.' },
    ],
  },
  bookstore: {
    label: 'Bookstore', icon: '📚', color: '#7a5a3c', cat: 'shop', hours: [9, 21], interior: 'bookstore', weight: 1.4,
    look: { front: 'shopfront', brand: '#2e4a3f', trim: '#f2e2b0', awning: 'slant', extras: ['chalkboard', 'planters'] },
    names: ['Dog-Eared Books', 'Page Turner', 'The Reading Room', 'Inkwell Books', 'Second Chapter', 'Paper Lantern Books', 'Spine & Story'],
    menu: [
      { id: 'browse', name: 'Browse the shelves', icon: '📖', price: 0, minutes: 30, needs: { fun: 9 }, line: 'You lose half an hour in the travel section.' },
      { id: 'novel', name: 'Buy a bestseller and read in the corner', icon: '📕', price: 16, minutes: 60, needs: { fun: 18, energy: 4 }, line: 'Page one hooks you. You read standing up.' },
      { id: 'skill', name: 'Look at career and skill books', icon: '🧠', price: 0, minutes: 0, needs: {}, line: '', special: 'books' },
    ],
  },
  laundromat: {
    label: 'Laundromat', icon: '🧺', color: '#4fb3c8', cat: 'service', hours: [6, 23], interior: 'laundromat', weight: 1.6,
    look: { front: 'shopfront', brand: '#2f7d9a', trim: '#e8f6fb', awning: 'flat', extras: [] },
    names: ['Spin City Laundromat', 'Suds & Duds', 'Clean Machine', 'Bubble Wash', 'Fluff & Fold', 'Wash World'],
    menu: [
      { id: 'wash', name: 'Wash and dry a load', icon: '🧺', price: 8, minutes: 70, needs: { hygiene: 22, fun: 2 }, line: 'Warm, clean, smells like spring. Nobody stole a sock.' },
      { id: 'fold', name: 'Drop-off wash and fold', icon: '👕', price: 18, minutes: 10, needs: { hygiene: 22 }, line: 'Picked up later, folded better than you ever could.' },
    ],
  },
  florist: {
    label: 'Florist', icon: '💐', color: '#e85c8a', cat: 'shop', hours: [8, 19], interior: 'florist', weight: 1,
    look: { front: 'shopfront', brand: '#4f7a3a', trim: '#fbe4ec', awning: 'slant', extras: ['planters', 'produce'] },
    names: ['Petal & Stem', 'Bloom Room', 'Wildflower Co.', 'The Flower Box', 'Green Thumb Florist'],
    menu: [
      { id: 'bouquet', name: 'Bouquet (a gift for a friend)', icon: '💐', price: 28, minutes: 10, needs: { fun: 4 }, line: 'Wrapped in brown paper. Give it to someone special.', special: 'gift' },
      { id: 'rose', name: 'A single rose for yourself', icon: '🌹', price: 5, minutes: 3, needs: { fun: 4 }, line: 'Why not?' },
    ],
  },
  cinema: {
    label: 'Cinema', icon: '🎬', color: '#b5343c', cat: 'fun', hours: [11, 25], interior: 'cinema', weight: 1.1,
    look: { front: 'shopfront', brand: '#7a1420', trim: '#ffd84a', awning: 'flat', extras: ['neonStrip', 'bladeLogo'] },
    names: ['Starlight Cinema', 'Majestic Theater', 'Reel Palace', 'The Picture House', 'Avenue Cinemas'],
    menu: [
      { id: 'movie', name: 'Movie ticket', icon: '🎟️', price: 16, minutes: 130, needs: { fun: 34 }, line: 'The twist! You did not see that coming.' },
      { id: 'combo', name: 'Movie with popcorn and soda', icon: '🍿', price: 26, minutes: 130, needs: { fun: 38, hunger: 15 }, line: 'Buttery fingers, big screen, best seat.' },
    ],
  },
  diner: {
    label: 'Diner', icon: '🍳', color: '#e0a23c', cat: 'food', hours: [0, 24], interior: 'diner', weight: 1.6,
    look: { front: 'shopfront', brand: '#c0392b', trim: '#f4f1ea', awning: 'none', extras: ['neonSign'] },
    names: ['Silver Spoon Diner', 'Starlite Diner', 'Route 9 Diner', "Mom's Kitchen", 'Blue Plate Diner', 'Sunny Side Up'],
    menu: [
      { id: 'pancakes', name: 'Stack of pancakes and coffee', icon: '🥞', price: 12, minutes: 30, needs: { hunger: 45, energy: 8 }, line: 'Bottomless coffee. The waitress calls you "hon".' },
      { id: 'burger', name: 'Burger, fries and a shake', icon: '🍔', price: 17, minutes: 35, needs: { hunger: 55, fun: 8 }, line: 'A classic for a reason.' },
      { id: 'pie', name: 'Slice of pie', icon: '🥧', price: 6, minutes: 15, needs: { hunger: 15, fun: 5 }, line: 'Warm cherry, à la mode.' },
    ],
  },
  arcade: {
    label: 'Arcade', icon: '🕹️', color: '#5a4fd0', cat: 'fun', hours: [12, 25], interior: 'arcade', weight: 1.1,
    look: { front: 'shopfront', brand: '#1a1240', trim: '#4fe0ff', awning: 'none', extras: ['neonStrip', 'screens'] },
    names: ['Pixel Palace', 'Coin-Op Arcade', 'Level Up', 'Game Over Bar', 'Joystick Junction'],
    menu: [
      { id: 'play', name: 'Bucket of tokens', icon: '🕹️', price: 10, minutes: 45, needs: { fun: 26, social: 4 }, line: 'New high score. Your initials are on the board.' },
      { id: 'tournament', name: 'Join the Friday tournament', icon: '🏆', price: 20, minutes: 90, needs: { fun: 34, social: 14 }, line: 'Knocked out in the semis, but you made friends.' },
    ],
  },
  bakery: {
    label: 'Bakery', icon: '🥐', color: '#d9a35a', cat: 'food', hours: [6, 19], interior: 'bakery', weight: 1.5,
    look: { front: 'shopfront', brand: '#f1e3c8', trim: '#7a4a2a', awning: 'slant', extras: ['patio', 'chalkboard'] },
    names: ['Golden Crust Bakery', 'Rise & Shine Bakehouse', 'Flour Power', 'Sweet Crumb', 'The Rolling Pin', 'Butter & Bloom'],
    menu: [
      { id: 'croissant', name: 'Croissant and coffee', icon: '🥐', price: 7, minutes: 15, needs: { hunger: 20, energy: 10 }, line: 'Flaky, buttery, still warm.' },
      { id: 'bagel', name: 'Everything bagel with cream cheese', icon: '🥯', price: 5, minutes: 10, needs: { hunger: 26 }, line: 'Toasted. Of course.' },
      { id: 'cake', name: 'Whole cake (a gift)', icon: '🎂', price: 36, minutes: 10, needs: { fun: 4 }, line: 'Boxed with a ribbon. Someone is going to love this.', special: 'gift' },
    ],
  },
};

export const SHOP_IDS = Object.keys(SHOP_TYPES);

export const SHOP_CATS = [
  ['key', '⭐ Key places'],
  ['food', '🍽️ Food'],
  ['night', '🌙 Nightlife'],
  ['shop', '🛍️ Shops'],
  ['service', '💈 Services'],
  ['fun', '🎬 Fun'],
];

/** Is a business open at this hour (0..24, fractional)? */
export function shopOpen(type, hour) {
  const t = SHOP_TYPES[type];
  if (!t) return true;
  const [o, c] = t.hours;
  if (c - o >= 24) return true;
  return c > 24 ? hour >= o || hour < c - 24 : hour >= o && hour < c;
}

/** "opens 9 AM" style text. */
export function opensAt(type) {
  const o = SHOP_TYPES[type].hours[0] % 24;
  return o === 0 ? 'midnight' : o < 12 ? `${o} AM` : o === 12 ? 'noon' : `${o - 12} PM`;
}

/** Which kinds of business suit a district style (weights multiply). */
export const STYLE_MIX = {
  skyscraper: { deli: 1.6, pharmacy: 1.4, pub: 1, club: 0.8, diner: 1.2 },
  midrise: { pizza: 1.3, pub: 1.2, laundromat: 1.2 },
  brownstone: { bakery: 1.6, bookstore: 1.6, florist: 1.5, pub: 1.2, pizza: 1.2 },
  warehouse: { club: 2.5, pub: 1.6, arcade: 1.8, pizza: 1 },
  beach: { pub: 1.6, club: 1.4, salon: 1.4, diner: 1.2 },
  campus: { pizza: 1.6, bookstore: 1.8, arcade: 1.3, cinema: 1.4 },
  houses: { deli: 1.2, laundromat: 1.4, barber: 1.4 },
};
