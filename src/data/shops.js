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
  autoshow: {
    label: 'Car Showroom', icon: '🚘', color: '#d84a4a', cat: 'shop', hours: [9, 20], interior: 'showroom', weight: 0.9,
    look: { front: 'showroom', brand: '#1d1f24', trim: '#f2f4f6', awning: 'none', extras: ['pennants', 'displayCar'] },
    names: ['Vanta Motors', 'Kestrel Auto Gallery', 'Nordvik Cars', 'Sora Motors', 'Brightline EV', 'Ridgeback Trucks', 'Monarch Luxury Motors', 'Velo Electric', 'Halden Motor Co.'],
    menu: [
      { id: 'testdrive', name: 'Take a test drive', icon: '🏎️', price: 0, minutes: 30, needs: { fun: 16 }, line: 'The salesperson grips the door handle as you take the corner.' },
      { id: 'sitin', name: 'Sit in the new models', icon: '💺', price: 0, minutes: 20, needs: { fun: 6 }, line: 'New car smell. You adjust the mirrors like you own it.' },
      { id: 'buycar', name: 'Talk to sales about buying a car', icon: '🔑', price: 0, minutes: 0, needs: {}, line: '', special: 'dealer' },
    ],
  },
  library: {
    label: 'Public Library', icon: '🏛️', color: '#8a6a3a', cat: 'fun', hours: [9, 20], interior: 'library', weight: 0.4,
    look: { front: 'classic', brand: '#3a2f24', trim: '#e9e2d0', awning: 'none', extras: ['planters'] },
    names: ['Riverside Public Library', 'Elm Street Library', 'Grand Hall Library', 'Harbor Heights Library', 'Westgate Branch Library', 'Northside Reading Room'],
    menu: [
      { id: 'read', name: 'Read in the quiet room', icon: '📖', price: 0, minutes: 60, needs: { fun: 10, energy: 2 }, line: 'Total silence, a big oak table, a good book. Bliss.' },
      { id: 'studycode', name: 'Study programming books', icon: '💻', price: 0, minutes: 90, needs: { fun: -2, energy: -5 }, xp: { coding: 0.25 }, line: 'Two chapters on algorithms. Something finally clicks.' },
      { id: 'studyfin', name: 'Read up on money and investing', icon: '📊', price: 0, minutes: 90, needs: { energy: -5 }, xp: { finance: 0.25 }, line: 'Compound interest is starting to look like magic.' },
      { id: 'studybiz', name: 'Business biographies and strategy', icon: '💼', price: 0, minutes: 90, needs: { energy: -5, fun: 2 }, xp: { business: 0.25 }, line: 'You fill three pages of notes on how founders think.' },
      { id: 'card', name: 'Sign up for a library card', icon: '🪪', price: 0, minutes: 5, needs: { fun: 2 }, line: 'Free. Possibly the best deal in the whole city.' },
    ],
  },
  artmuseum: {
    label: 'Art Museum', icon: '🖼️', color: '#b5343c', cat: 'fun', hours: [10, 18], interior: 'gallery', weight: 0.45,
    look: { front: 'classic', brand: '#7a1f2b', trim: '#f2ece0', awning: 'none', extras: ['planters'] },
    names: ['Meridian Museum of Art', 'The Halcyon Gallery', 'Museum of Modern Light', 'Canvas & Stone Museum', 'The Aurelia Collection'],
    menu: [
      { id: 'visit', name: 'Admission: wander the galleries', icon: '🖼️', price: 25, minutes: 90, needs: { fun: 22 }, xp: { creativity: 0.15 }, line: 'You stand in front of one painting for ten minutes. It stays with you.' },
      { id: 'tour', name: 'Guided tour with a curator', icon: '🎧', price: 35, minutes: 120, needs: { fun: 26, social: 8 }, xp: { creativity: 0.2 }, line: 'Hidden stories behind every frame. You will never look at art the same way.' },
      { id: 'print', name: 'Gift shop: an art print', icon: '🎁', price: 30, minutes: 10, needs: { fun: 4 }, special: 'gift', line: 'Rolled in a tube, ready to give to someone.' },
    ],
  },
  historymuseum: {
    label: 'Natural History Museum', icon: '🦕', color: '#4f7a3a', cat: 'fun', hours: [10, 18], interior: 'history', weight: 0.45,
    look: { front: 'classic', brand: '#2e4a3f', trim: '#ece4d2', awning: 'none', extras: ['planters'] },
    names: ['Museum of Natural Wonders', 'Hall of Ages Museum', 'The Fossil & Star Museum', 'Earth & Sky Museum'],
    menu: [
      { id: 'visit', name: 'Admission: dinosaurs, gems and space', icon: '🦕', price: 23, minutes: 120, needs: { fun: 24 }, line: 'A full skeleton towers over you. Kids gasp. So do you.' },
      { id: 'planetarium', name: 'Planetarium show', icon: '🔭', price: 15, minutes: 45, needs: { fun: 16, energy: 3 }, line: 'You lean back and fly through the rings of Saturn.' },
      { id: 'plush', name: 'Gift shop: a plush dinosaur', icon: '🧸', price: 18, minutes: 10, needs: { fun: 5 }, special: 'gift', line: 'Soft, green and very huggable.' },
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
  pho: {
    label: 'Vietnamese', icon: '🍜', color: '#d9a35a', cat: 'food', hours: [10, 22], interior: 'eat_pho', weight: 1.3,
    look: { front: 'shopfront', brand: '#b3261e', trim: '#ffd84a', awning: 'slant', extras: ['bladeLogo', 'planters'] },
    names: ['Pho Saigon House', 'Little Hanoi', 'Lotus Pho', 'Pho 99', 'Banh Mi Corner', 'Mekong Kitchen'],
    menu: [
      { id: 'pho', name: 'Pho bo — beef noodle soup', icon: '🍜', price: 13, minutes: 35, needs: { hunger: 50, energy: 6 }, line: 'Steaming broth, herbs, lime and a squeeze of sriracha. Perfect.' },
      { id: 'banhmi', name: 'Banh mi sandwich', icon: '🥖', price: 8, minutes: 15, needs: { hunger: 32 }, line: 'Crunchy baguette, pickled carrots and a kick of chili.' },
      { id: 'cafe', name: 'Vietnamese iced coffee', icon: '☕', price: 5, minutes: 10, needs: { energy: 20 }, line: 'Strong, sweet and very cold.' },
      { id: 'rolls', name: 'Fresh spring rolls', icon: '🥢', price: 7, minutes: 15, needs: { hunger: 18, fun: 3 }, line: 'Rice paper, shrimp and peanut sauce.' },
    ],
  },
  kbbq: {
    label: 'Korean BBQ', icon: '🥩', color: '#c53a3a', cat: 'food', hours: [11, 24], interior: 'eat_kbbq', weight: 1.2,
    look: { front: 'shopfront', brand: '#1d1f24', trim: '#e9c04c', awning: 'none', extras: ['neonSign', 'planters'] },
    names: ['Seoul Garden BBQ', 'Gangnam Grill', 'Hanok House', 'K-Town Charcoal', 'Bulgogi Brothers', 'Kimchi & Coal'],
    menu: [
      { id: 'bbq', name: 'BBQ set for the table, grilled in front of you', icon: '🥩', price: 48, minutes: 90, needs: { hunger: 65, social: 16, fun: 14 }, line: 'Sizzling bulgogi, banchan everywhere, someone orders another round.' },
      { id: 'bibim', name: 'Bibimbap in a hot stone bowl', icon: '🍚', price: 16, minutes: 30, needs: { hunger: 45 }, line: 'Crispy rice at the bottom is the best part.' },
      { id: 'chicken', name: 'Korean fried chicken and soju', icon: '🍗', price: 26, minutes: 60, needs: { hunger: 35, fun: 14, social: 10 }, line: 'Double-fried, sticky and spicy.' },
      { id: 'stew', name: 'Kimchi stew', icon: '🍲', price: 14, minutes: 25, needs: { hunger: 40, health: 3 }, line: 'Bubbling, sour and warming.' },
    ],
  },
  ramen: {
    label: 'Ramen Bar', icon: '🍥', color: '#e07b39', cat: 'food', hours: [11, 26], interior: 'eat_ramen', weight: 1.1,
    look: { front: 'shopfront', brand: '#2a1e1a', trim: '#f2e2b0', awning: 'flat', extras: ['bladeLogo', 'chalkboard'] },
    names: ['Ichiban Ramen', 'Tonkotsu Lane', 'Midnight Noodle', 'Ramen Kaze', 'Shoyu Street'],
    menu: [
      { id: 'tonkotsu', name: 'Tonkotsu ramen', icon: '🍜', price: 16, minutes: 30, needs: { hunger: 55, energy: 5 }, line: 'Creamy pork broth, soft egg, slurp loudly — it is polite.' },
      { id: 'gyoza', name: 'Pan-fried gyoza', icon: '🥟', price: 8, minutes: 15, needs: { hunger: 20 }, line: 'Crispy bottoms, juicy inside.' },
      { id: 'matcha', name: 'Iced matcha latte', icon: '🍵', price: 5, minutes: 10, needs: { energy: 10, fun: 3 }, line: 'Grassy, creamy and very green.' },
    ],
  },
  sushi: {
    label: 'Sushi Bar', icon: '🍣', color: '#e86a6a', cat: 'food', hours: [12, 23], interior: 'eat_sushi', weight: 1,
    look: { front: 'shopfront', brand: '#f2ece0', trim: '#1d1f24', awning: 'none', extras: ['planters'] },
    names: ['Sakura Sushi', 'Koi Sushi Bar', 'Omakase Kai', 'Umi Sushi', 'Tora Hand Rolls'],
    menu: [
      { id: 'platter', name: 'Sushi platter', icon: '🍣', price: 24, minutes: 35, needs: { hunger: 45, fun: 6 }, line: 'Salmon, tuna, yellowtail and a spicy roll.' },
      { id: 'omakase', name: 'Chef’s omakase at the counter', icon: '🎌', price: 95, minutes: 90, needs: { hunger: 55, fun: 25, social: 8 }, line: 'Fourteen pieces, each one better than the last. The chef nods at you.' },
      { id: 'miso', name: 'Miso soup and edamame', icon: '🥢', price: 6, minutes: 10, needs: { hunger: 12, health: 2 }, line: 'Warm and salty.' },
    ],
  },
  dumplings: {
    label: 'Dumpling House', icon: '🥟', color: '#b3261e', cat: 'food', hours: [10, 22], interior: 'eat_dumplings', weight: 1.2,
    look: { front: 'shopfront', brand: '#9a1b1b', trim: '#f2c230', awning: 'slant', extras: ['bladeLogo'] },
    names: ['Golden Dumpling', 'Jade Garden', 'Lucky Dragon Dim Sum', 'Shanghai Soup Dumplings', 'Red Lantern Noodles', 'Bamboo Steamer'],
    menu: [
      { id: 'xlb', name: 'Soup dumplings', icon: '🥟', price: 11, minutes: 25, needs: { hunger: 35, fun: 4 }, line: 'Bite, sip, burn your tongue, repeat.' },
      { id: 'dimsum', name: 'Dim sum brunch with the trolleys', icon: '🫖', price: 28, minutes: 70, needs: { hunger: 55, social: 12, fun: 8 }, line: 'Pork buns, shrimp dumplings, endless tea.' },
      { id: 'duck', name: 'Peking duck for the table', icon: '🦆', price: 38, minutes: 60, needs: { hunger: 60, social: 10 }, line: 'Crispy skin, thin pancakes, hoisin.' },
      { id: 'soup', name: 'Hot and sour soup', icon: '🍲', price: 7, minutes: 15, needs: { hunger: 20 }, line: 'Peppery and comforting.' },
    ],
  },
  taqueria: {
    label: 'Taqueria', icon: '🌮', color: '#f2a03c', cat: 'food', hours: [10, 25], interior: 'eat_taqueria', weight: 1.4,
    look: { front: 'shopfront', brand: '#2f8f6a', trim: '#f2c230', awning: 'slant', extras: ['chalkboard', 'stringLights'] },
    names: ['Taqueria El Sol', 'Tacos La Esquina', 'Casa Azul', 'Al Pastor King', 'La Lupita', 'Burrito Barn'],
    menu: [
      { id: 'tacos', name: 'Three tacos al pastor', icon: '🌮', price: 10, minutes: 15, needs: { hunger: 38, fun: 5 }, line: 'Pineapple, cilantro, onion, a squeeze of lime.' },
      { id: 'burrito', name: 'Giant burrito', icon: '🌯', price: 12, minutes: 20, needs: { hunger: 55 }, line: 'You will not need dinner.' },
      { id: 'horchata', name: 'Horchata', icon: '🥛', price: 4, minutes: 5, needs: { fun: 3, energy: 4 }, line: 'Cinnamon rice milk, sweet and cold.' },
      { id: 'marg', name: 'Margarita on the rocks', icon: '🍹', price: 12, minutes: 30, needs: { fun: 12, social: 6 }, line: 'Salt rim, lime, sunshine in a glass.' },
    ],
  },
  thai: {
    label: 'Thai', icon: '🍛', color: '#e9a33a', cat: 'food', hours: [11, 22], interior: 'eat_thai', weight: 1.1,
    look: { front: 'shopfront', brand: '#5a2a7a', trim: '#f2c230', awning: 'flat', extras: ['planters'] },
    names: ['Bangkok Street', 'Thai Orchid', 'Lemongrass Kitchen', 'Siam Spice', 'Basil & Lime'],
    menu: [
      { id: 'padthai', name: 'Pad thai', icon: '🍜', price: 14, minutes: 25, needs: { hunger: 48 }, line: 'Tamarind, peanuts, a wedge of lime.' },
      { id: 'curry', name: 'Green curry with jasmine rice', icon: '🍛', price: 15, minutes: 25, needs: { hunger: 50, health: 2 }, line: 'Coconutty and properly spicy.' },
      { id: 'tea', name: 'Thai iced tea', icon: '🧋', price: 5, minutes: 5, needs: { energy: 10, fun: 3 }, line: 'Bright orange and very sweet.' },
    ],
  },
  indian: {
    label: 'Indian', icon: '🥘', color: '#c45a2a', cat: 'food', hours: [11, 23], interior: 'eat_indian', weight: 1.1,
    look: { front: 'shopfront', brand: '#7a1f3a', trim: '#f2c230', awning: 'slant', extras: ['bladeLogo', 'planters'] },
    names: ['Taj Spice', 'Curry Leaf', 'Bombay Express', 'Masala House', 'Saffron Table'],
    menu: [
      { id: 'butter', name: 'Butter chicken with garlic naan', icon: '🍛', price: 17, minutes: 35, needs: { hunger: 55, fun: 4 }, line: 'Rich, creamy, and the naan is still blistered from the oven.' },
      { id: 'samosa', name: 'Samosas and chutney', icon: '🥟', price: 7, minutes: 10, needs: { hunger: 22 }, line: 'Crisp pastry, spiced potato.' },
      { id: 'lassi', name: 'Mango lassi', icon: '🥭', price: 5, minutes: 5, needs: { energy: 6, fun: 4 }, line: 'Thick, cold and tropical.' },
    ],
  },
  halal: {
    label: 'Halal & Falafel', icon: '🥙', color: '#3f8f4a', cat: 'food', hours: [9, 27], interior: 'eat_halal', weight: 1.2,
    look: { front: 'shopfront', brand: '#1f5f36', trim: '#f4f1ea', awning: 'flat', extras: ['chalkboard'] },
    names: ['Falafel Palace', 'Halal Bros', 'Mediterranean Grill', 'Shawarma Spot', 'Cedar & Olive'],
    menu: [
      { id: 'platter', name: 'Chicken over rice with white sauce', icon: '🍚', price: 10, minutes: 15, needs: { hunger: 50 }, line: 'The late-night classic. Extra white sauce, a little hot sauce.' },
      { id: 'falafel', name: 'Falafel wrap', icon: '🥙', price: 8, minutes: 10, needs: { hunger: 35, health: 2 }, line: 'Crunchy, herby, tahini dripping down your wrist.' },
      { id: 'tea', name: 'Fresh mint tea', icon: '🍵', price: 3, minutes: 5, needs: { energy: 4, fun: 2 }, line: 'Sweet and fragrant.' },
    ],
  },
  boba: {
    label: 'Bubble Tea', icon: '🧋', color: '#c98b6a', cat: 'food', hours: [11, 23], interior: 'eat_boba', weight: 1.3,
    look: { front: 'shopfront', brand: '#f2c4d6', trim: '#5a3a2a', awning: 'none', extras: ['planters', 'screens'] },
    names: ['Boba Bliss', 'Tapioca Time', 'Pearl Tea House', 'Moon Tea', 'Sip & Pop'],
    menu: [
      { id: 'brown', name: 'Brown sugar milk tea with boba', icon: '🧋', price: 6.5, minutes: 10, needs: { energy: 8, fun: 6 }, line: 'Tiger stripes of syrup, chewy pearls.' },
      { id: 'taro', name: 'Taro smoothie', icon: '🥤', price: 7, minutes: 10, needs: { fun: 6, hunger: 8 }, line: 'Purple, creamy and nutty.' },
      { id: 'fruit', name: 'Passion fruit green tea', icon: '🍹', price: 6, minutes: 10, needs: { energy: 6, fun: 4 }, line: 'Tart, fresh, popping boba on top.' },
    ],
  },
  icecream: {
    label: 'Ice Cream', icon: '🍦', color: '#f2a6c4', cat: 'food', hours: [11, 23], interior: 'eat_icecream', weight: 1,
    look: { front: 'shopfront', brand: '#f6d6e4', trim: '#c53a6a', awning: 'slant', extras: ['patio'] },
    names: ['Scoops', 'Sweet Swirl', 'Polar Parlor', 'Gelato Bella', 'Sprinkles & Co.'],
    menu: [
      { id: 'cone', name: 'Two scoops in a waffle cone', icon: '🍦', price: 6, minutes: 10, needs: { fun: 10, hunger: 8 }, line: 'Pistachio and salted caramel.' },
      { id: 'sundae', name: 'Hot fudge sundae', icon: '🍨', price: 9, minutes: 15, needs: { fun: 14, hunger: 12 }, line: 'Whipped cream, a cherry on top.' },
    ],
  },
  winebar: {
    label: 'Wine Bar', icon: '🍷', color: '#7a1f3a', cat: 'night', hours: [17, 25], interior: 'eat_wine', weight: 0.9,
    look: { front: 'shopfront', brand: '#3a1420', trim: '#d8b25a', awning: 'flat', extras: ['planters', 'stringLights'] },
    names: ['Vino Vino', 'The Cork Room', 'Barrel & Vine', 'Le Petit Verre', 'Decanter'],
    menu: [
      { id: 'glass', name: 'Glass of red', icon: '🍷', price: 14, minutes: 40, needs: { fun: 10, social: 6 }, line: 'Swirl, sniff, pretend you know what "notes of leather" means.' },
      { id: 'board', name: 'Cheese and charcuterie board', icon: '🧀', price: 24, minutes: 45, needs: { hunger: 30, social: 8, fun: 6 }, line: 'Fig jam, three cheeses, a crusty baguette.' },
    ],
  },
  bikeshop: {
    label: 'Bike Shop', icon: '🚲', color: '#18a999', cat: 'shop', hours: [9, 20], interior: 'bikeshop', weight: 1.1,
    look: { front: 'shopfront', brand: '#14615a', trim: '#f2f2ee', awning: 'flat', extras: ['bikeRack', 'planters'] },
    names: ['Spoke & Chain', 'Two Wheels Cycles', 'Freewheel Bikes', 'Pedal Pushers', 'Crank Cycle Co.', 'Urban Gear Bikes'],
    menu: [
      { id: 'cruiser', name: 'City cruiser (yours to keep, ride free with G)', icon: '🚲', price: 320, minutes: 15, needs: { fun: 10 }, line: 'Comfy saddle, a basket and a bell. Press G outside to ride.', special: 'bike', bike: 'cruiser' },
      { id: 'road', name: 'Road bike (faster)', icon: '🚴', price: 780, minutes: 15, needs: { fun: 12 }, line: 'Light, fast and a little terrifying downhill. Press G outside to ride.', special: 'bike', bike: 'road' },
      { id: 'ebike', name: 'E-bike (fastest, no sweat)', icon: '⚡', price: 1900, minutes: 15, needs: { fun: 14 }, line: 'A silent push with every pedal stroke. Press G outside to ride.', special: 'bike', bike: 'ebike' },
      { id: 'tuneup', name: 'Tune-up and a coffee while you wait', icon: '🔧', price: 35, minutes: 30, needs: { fun: 5 }, line: 'Gears clicking like new.' },
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
  skyscraper: { deli: 1.6, pharmacy: 1.4, pub: 1, club: 0.8, diner: 1.2, artmuseum: 2.2, historymuseum: 2, autoshow: 0.7 },
  midrise: { autoshow: 1.6, library: 1.3, pizza: 1.3, pub: 1.2, laundromat: 1.2, dumplings: 1.4, kbbq: 1.4, taqueria: 1.3, halal: 1.3 },
  brownstone: { library: 1.6, artmuseum: 1.3, bakery: 1.6, bookstore: 1.6, florist: 1.5, pub: 1.2, pizza: 1.2, pho: 1.4, ramen: 1.3, winebar: 1.5 },
  warehouse: { autoshow: 2.2, club: 2.5, pub: 1.6, arcade: 1.8, pizza: 1 },
  beach: { pub: 1.6, club: 1.4, salon: 1.4, diner: 1.2 },
  campus: { library: 2.2, historymuseum: 1.2, pizza: 1.6, bookstore: 1.8, arcade: 1.3, cinema: 1.4 },
  houses: { library: 1.2, autoshow: 1.2, deli: 1.2, laundromat: 1.4, barber: 1.4, bikeshop: 1.5 },
};
