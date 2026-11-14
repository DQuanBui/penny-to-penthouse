// Entrepreneur ventures. cost = startup capital; base = daily gross margin at
// level 1 with perfect management; skills = weights of the owner's skills;
// vol = day-to-day swing (risk). Tuning notes live in balance.js -> business.

export const BUSINESS_TYPES = [
  { id: 'food_truck', name: 'Food Truck', icon: '🚚', cost: 18000, base: 150, skills: { cooking: 1, business: 0.6 }, vol: 0.35, desc: 'Cheap to start, hard work. Great food builds a line down the block.' },
  { id: 'clothing_brand', name: 'Clothing Brand', icon: '👚', cost: 30000, base: 215, skills: { creativity: 1, business: 0.6 }, vol: 0.55, fame: true, desc: 'Design drops that sell out. Your popularity is your marketing budget.' },
  { id: 'app_startup', name: 'App Startup', icon: '📱', cost: 40000, base: 250, skills: { coding: 1.2, business: 0.6 }, vol: 0.95, desc: 'Wild swings: most months are scrappy, a few change your life.' },
  { id: 'property_mgmt', name: 'Property Management', icon: '🏢', cost: 50000, base: 300, skills: { business: 1, finance: 0.8 }, vol: 0.2, perProperty: 70, desc: 'Steady fees. Earns more for every property you own.' },
  { id: 'cafe_biz', name: 'Neighbourhood Café', icon: '☕', cost: 65000, base: 390, skills: { business: 1, cooking: 0.5, charisma: 0.5 }, vol: 0.3, desc: 'Regulars, rent and razor-thin margins — until the second location.' },
];
export const BUSINESS_BY_ID = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.id, b]));

export const BUSINESS = {
  maxOwned: 3,
  maxLevel: 5,
  levelGrowth: 1.75, // profit multiplier per level
  upgradeCost: 0.85, // × startup cost × current level
  staffWage: 105, // per staff per day (× city salaryIndex)
  fixedCost: 0.22, // of base, per day, grows with level
  marketingCost: 650, // × level
  marketingRep: 11,
  workHours: 4,
  bankruptAt: 0.3, // closes when cash < -cost × this
  sellMultiple: 14, // months of average profit a buyer pays
};
