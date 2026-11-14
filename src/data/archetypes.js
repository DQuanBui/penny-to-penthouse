// Starting archetypes. Each sets cash, debt, skills, a signature trait (free,
// on top of the two the player picks) and optional extras the sim understands:
//   followers, degrees[], items[], friends (number of starting acquaintances),
//   monthlyExtra {label, amount} (a recurring bill), look (appearance hints).

export const ARCHETYPES = [
  {
    id: 'dreamer', name: 'Small-Town Dreamer', icon: '🌾', age: 22,
    backstory: 'You packed one suitcase, hugged your folks and bought a one-way bus ticket. The city is huge, loud and full of doors you plan to walk through.',
    cash: 1500, debt: null, trait: 'ambitious',
    skills: { charisma: 2, cooking: 2, handiness: 2 },
    look: { top: 'shirt', bottom: 'jeans', shoes: 'boots' },
  },
  {
    id: 'citykid', name: 'City Kid', icon: '🏙️', age: 21,
    backstory: 'Born and raised on these blocks. You know which train to take, who to call, and that rent waits for no one.',
    cash: 900, debt: null, trait: 'social', friends: 3,
    skills: { charisma: 3, business: 1, creativity: 1 },
    look: { top: 'jacket', bottom: 'joggers', shoes: 'sneakers', accessory: 'cap' },
  },
  {
    id: 'heir', name: 'Rich Heir', icon: '💎', age: 23,
    backstory: 'The trust fund finally landed. Your family expects you to turn it into more — but you have never had to work a day in your life.',
    cash: 60000, debt: null, trait: 'lazy',
    skills: { charisma: 1, finance: 1 },
    look: { top: 'blazer', bottom: 'slacks', shoes: 'dress', accessory: 'watch' },
  },
  {
    id: 'dropout', name: 'College Dropout', icon: '💻', age: 21,
    backstory: 'Two years of computer science, one big idea and a pile of loans. Lectures were too slow — the real world better be faster.',
    cash: 600, debt: { type: 'student', amount: 18000 }, trait: 'genius',
    skills: { coding: 3, business: 1 },
    look: { top: 'hoodie', bottom: 'jeans', shoes: 'sneakers', accessory: 'glasses' },
  },
  {
    id: 'hustler', name: 'First-Gen Hustler', icon: '🧾', age: 22,
    backstory: 'Your parents crossed an ocean and worked doubles so you could have a shot. Every dollar has a job, and so do you.',
    cash: 800, debt: null, trait: 'frugal',
    skills: { business: 2, finance: 2, cooking: 1 },
    look: { top: 'shirt', bottom: 'slacks', shoes: 'sneakers' },
  },
  {
    id: 'athlete', name: 'Retired Athlete', icon: '🏅', age: 27,
    backstory: 'A torn ligament ended the pro dream early. You have some savings, a famous-ish face and absolutely no idea what a spreadsheet is.',
    cash: 12000, debt: null, trait: 'charismatic', followers: 2500,
    skills: { fitness: 6, charisma: 2 },
    look: { body: 'athletic', top: 'tee', bottom: 'joggers', shoes: 'sneakers', height: 1.07 },
  },
  {
    id: 'artist', name: 'Art School Grad', icon: '🎨', age: 23,
    backstory: 'A fine-arts degree, a portfolio you are proud of and a loan balance you try not to look at. Time to prove creativity pays.',
    cash: 700, debt: { type: 'student', amount: 32000 }, trait: 'creative', degrees: ['ba_arts'], followers: 300,
    skills: { creativity: 5, charisma: 1 },
    look: { top: 'sweater', bottom: 'skirt', shoes: 'boots', accessory: 'beanie', hair: 'bob' },
  },
  {
    id: 'military', name: 'Ex-Military', icon: '🎖️', age: 26,
    backstory: 'Four years of service taught you discipline, early mornings and how to fix almost anything. Civilian life is the next mission.',
    cash: 6000, debt: null, trait: 'fitness',
    skills: { fitness: 4, handiness: 3, business: 1 },
    look: { body: 'athletic', hair: 'buzz', top: 'tee', bottom: 'jeans', shoes: 'boots' },
  },
  {
    id: 'parent', name: 'Single Parent', icon: '🧸', age: 29,
    backstory: 'Everything you do is for the little one. Childcare is not cheap and sleep is a rumour, but nobody multitasks like you.',
    cash: 2200, debt: { type: 'personal', amount: 4000 }, trait: 'generous',
    monthlyExtra: { label: 'Childcare', amount: 450 },
    skills: { cooking: 4, charisma: 2, business: 1 },
    look: { top: 'sweater', bottom: 'jeans', shoes: 'sneakers', hair: 'ponytail' },
  },
  {
    id: 'streamer', name: 'Gamer / Streamer', icon: '🎮', age: 20,
    backstory: 'Eight hundred followers watch you play at 2 AM. The setup went on a credit card; the dream is to make the hobby pay for it.',
    cash: 1100, debt: { type: 'card', amount: 1500 }, trait: 'nightowl', followers: 800, items: ['gaming_pc'],
    skills: { coding: 2, creativity: 3, charisma: 1 },
    look: { top: 'hoodie', bottom: 'shorts', shoes: 'sneakers', accessory: 'headphones' },
  },
];
export const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

export const SKILLS = [
  { id: 'coding', name: 'Coding', icon: '💻' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'finance', name: 'Finance', icon: '📊' },
  { id: 'charisma', name: 'Charisma', icon: '🗣️' },
  { id: 'fitness', name: 'Fitness', icon: '💪' },
  { id: 'creativity', name: 'Creativity', icon: '🎨' },
  { id: 'cooking', name: 'Cooking', icon: '🍳' },
  { id: 'handiness', name: 'Handiness', icon: '🔧' },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
