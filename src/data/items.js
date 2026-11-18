// Things you can buy: outfits (clothing store), electronics, gifts.
// Outfit `look` overrides the clothing part of the character's appearance;
// `style` feeds interviews and popularity.

export const OUTFITS = [
  { id: 'starter', name: 'Everyday Clothes', icon: '👕', price: 0, style: 2, look: null, desc: 'What you arrived in.' },
  { id: 'thrift', name: 'Thrift Store Mix', icon: '🧢', price: 45, style: 3, look: { top: 'tee', topColor: '#e9c04c', bottom: 'jeans', bottomColor: '#27406b', shoes: 'sneakers', shoeColor: '#f4f4f2', accessory: 'cap', accColor: '#3f76d0' }, desc: 'Second-hand, first-rate attitude.' },
  { id: 'athleisure', name: 'Athleisure Set', icon: '🏃', price: 95, style: 4, look: { top: 'tank', topColor: '#2f8f8f', bottom: 'joggers', bottomColor: '#1d1f24', shoes: 'sneakers', shoeColor: '#f4f4f2', accessory: 'headphones', accColor: '#e06a9a' }, desc: 'Gym to brunch without changing.' },
  { id: 'workwear', name: 'Rugged Workwear', icon: '🥾', price: 110, style: 4, look: { top: 'jacket', topColor: '#8a5a3c', bottom: 'jeans', bottomColor: '#3a4254', shoes: 'boots', shoeColor: '#8a5a3c', accessory: 'none' }, desc: 'Built to last a double shift.' },
  { id: 'summer', name: 'Summer Dress', icon: '👗', price: 120, style: 5, look: { top: 'dress', topColor: '#e06a9a', bottom: 'skirt', bottomColor: '#e06a9a', shoes: 'sandals', shoeColor: '#d9c7a8', accessory: 'necklace' }, desc: 'Light, bright and easy.' },
  { id: 'smart', name: 'Smart Casual', icon: '👔', price: 140, style: 5, look: { top: 'shirt', topColor: '#f4f4f2', bottom: 'slacks', bottomColor: '#3a4254', shoes: 'dress', shoeColor: '#8a5a3c', accessory: 'watch' }, desc: 'The safe bet for almost anything.' },
  { id: 'creative', name: 'Art District Look', icon: '🎨', price: 210, style: 6, look: { top: 'sweater', topColor: '#a04fc0', bottom: 'skirt', bottomColor: '#1d1f24', shoes: 'boots', shoeColor: '#1d1f24', accessory: 'beanie', accColor: '#e9c04c' }, desc: 'Looks effortless. Was not.' },
  { id: 'street', name: 'Streetwear Drop', icon: '🧥', price: 260, style: 6, look: { top: 'hoodie', topColor: '#1d1f24', bottom: 'joggers', bottomColor: '#7a8494', shoes: 'sneakers', shoeColor: '#c53a3a', accessory: 'cap', accColor: '#c53a3a' }, desc: 'Limited release. You queued.' },
  { id: 'suit', name: 'Interview Suit', icon: '🤵', price: 320, style: 7, look: { top: 'blazer', topColor: '#3a4254', bottom: 'slacks', bottomColor: '#3a4254', shoes: 'dress', shoeColor: '#1d1f24', accessory: 'none' }, desc: 'Says "hire me" before you do.' },
  { id: 'designer', name: 'Designer Fit', icon: '🕶️', price: 1400, style: 9, look: { top: 'jacket', topColor: '#1d1f24', bottom: 'slacks', bottomColor: '#1d1f24', shoes: 'dress', shoeColor: '#1d1f24', accessory: 'sunglasses' }, desc: 'Quiet luxury, loud price tag.' },
  { id: 'tailored', name: 'Tailored Power Suit', icon: '💼', price: 2600, style: 10, look: { top: 'blazer', topColor: '#27406b', bottom: 'slacks', bottomColor: '#27406b', shoes: 'dress', shoeColor: '#8a5a3c', accessory: 'watch', accentColor: '#e8c45a' }, desc: 'Cut for the corner office.' },
  { id: 'gala', name: 'Red-Carpet Look', icon: '✨', price: 5200, style: 12, look: { top: 'dress', topColor: '#b5343c', bottom: 'skirt', bottomColor: '#b5343c', shoes: 'dress', shoeColor: '#e8c45a', accessory: 'necklace' }, desc: 'For the nights that end up in the news.' },
];
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

export const ELECTRONICS = [
  { id: 'laptop', name: 'Laptop', icon: '💻', price: 650, desc: 'Practise coding, take online courses and freelance from any desk at home.' },
  { id: 'gaming_pc', name: 'Gaming & Streaming PC', icon: '🖥️', price: 1900, desc: 'Everything a laptop does, plus smoother streams and more fun.' },
  { id: 'phone_pro', name: 'Flagship Phone', icon: '📱', price: 900, desc: 'Sharper photos: social posts earn 20% more followers.' },
  { id: 'camera', name: 'Mirrorless Camera', icon: '📷', price: 750, desc: 'Pro-looking shots: posts earn 30% more followers.' },
  { id: 'headphones', name: 'Noise-Cancelling Headphones', icon: '🎧', price: 180, desc: 'Commutes and study sessions drain less Fun.' },
];
export const ELECTRONIC_BY_ID = Object.fromEntries(ELECTRONICS.map((e) => [e.id, e]));

export const GIFTS = [
  { id: 'flowers', name: 'Flowers', icon: '💐', price: 18, power: 1.0 },
  { id: 'chocolates', name: 'Chocolates', icon: '🍫', price: 28, power: 1.3 },
  { id: 'book', name: 'A Good Book', icon: '📚', price: 22, power: 1.2 },
  { id: 'tickets', name: 'Concert Tickets', icon: '🎟️', price: 120, power: 2.4 },
  { id: 'watch_gift', name: 'Engraved Watch', icon: '⌚', price: 480, power: 4 },
];

const CLOTHING_KEYS = ['top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoeColor', 'accessory', 'accColor', 'accentColor'];

/** True if the player owns any computer. */
export const hasComputer = (state) => !!(state.inventory.items.laptop || state.inventory.items.gaming_pc);

/** Put on an owned outfit: updates appearance + outfit style. */
export function wearOutfit(state, id) {
  const o = OUTFIT_BY_ID[id];
  const p = state.profile;
  if (!o) return false;
  if (!p.baseLook) {
    p.baseLook = {};
    for (const k of CLOTHING_KEYS) p.baseLook[k] = p.appearance[k];
  }
  const look = o.look || p.baseLook;
  for (const k of CLOTHING_KEYS) {
    if (look[k] !== undefined) p.appearance[k] = look[k];
    else if (k === 'accessory') p.appearance[k] = 'none';
    else if (k === 'accColor' || k === 'accentColor') delete p.appearance[k];
  }
  p.outfit = id;
  p.outfitStyle = o.style;
  return true;
}

// Street carts (parks, transit entrances). needs = instant need changes.
export const STREET_FOOD = [
  { id: 'hotdog', name: 'Hot dog', icon: '🌭', price: 4, needs: { hunger: 32, fun: 3 }, line: 'Mustard, onions, perfect.' },
  { id: 'pretzel', name: 'Soft pretzel', icon: '🥨', price: 3.5, needs: { hunger: 22 }, line: 'Warm, salty, gone in a minute.' },
  { id: 'icecream', name: 'Ice cream cone', icon: '🍦', price: 4.5, needs: { hunger: 10, fun: 14 }, line: 'It melts faster than you can eat it.' },
  { id: 'lemonade', name: 'Fresh lemonade', icon: '🍋', price: 3, needs: { fun: 6, energy: 5 }, line: 'Cold and tart. Exactly right.' },
  { id: 'taco', name: 'Street tacos', icon: '🌮', price: 6, needs: { hunger: 40, fun: 5 }, line: 'Three tacos and a lime wedge.' },
];
