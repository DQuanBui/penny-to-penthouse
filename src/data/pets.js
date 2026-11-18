// Dogs you can adopt at each city's pet rescue. Breeds are real dog breeds;
// the rescues themselves are fictional. `coat` tints the shared dog model,
// `scale` sizes it, `fee` is the adoption fee before the city's price index.

export const BREEDS = [
  { id: 'mixed', name: 'Mixed breed', icon: '🐕', coat: '#c9a26b', scale: 0.95, fee: 60, desc: 'A bit of everything and loyal through and through.' },
  { id: 'retriever', name: 'Golden retriever', icon: '🦮', coat: '#d9a95b', scale: 1.12, fee: 180, desc: 'Friendly with everyone. Everyone.' },
  { id: 'labrador', name: 'Black labrador', icon: '🐕', coat: '#2b2b2e', scale: 1.1, fee: 160, desc: 'Endless energy, and will fetch until your arm gives out.' },
  { id: 'beagle', name: 'Beagle', icon: '🐶', coat: '#b07a45', scale: 0.84, fee: 120, desc: 'Follows their nose first and you second.' },
  { id: 'husky', name: 'Husky', icon: '🐺', coat: '#c9ccd2', scale: 1.08, fee: 200, desc: 'Dramatic, talkative and very fluffy.' },
  { id: 'poodle', name: 'Poodle', icon: '🐩', coat: '#f4f1ea', scale: 0.8, fee: 220, desc: 'Clever, elegant and secretly a clown.' },
  { id: 'shiba', name: 'Shiba inu', icon: '🐕', coat: '#d8843c', scale: 0.82, fee: 240, desc: 'An independent spirit with a curly tail.' },
  { id: 'terrier', name: 'Terrier', icon: '🐕', coat: '#8a5a34', scale: 0.74, fee: 100, desc: 'Small dog, big personality, bigger bark.' },
];
export const BREED_BY_ID = Object.fromEntries(BREEDS.map((b) => [b.id, b]));

export const DOG_NAMES = ['Biscuit', 'Mochi', 'Pepper', 'Scout', 'Luna', 'Rocky', 'Maple', 'Ziggy', 'Olive', 'Bruno', 'Nacho', 'Daisy', 'Koda', 'Pickles', 'Juniper', 'Waffles', 'Bean', 'Rosie', 'Tank', 'Clover'];

export const PET = {
  foodPerDay: 5, // dog food, charged every morning
  walkMinutes: 30, // game minutes of walking outside that count as "walked today"
  cuddleEvery: 60, // game minutes between cuddles that still lift your mood
  vet: 90, // check-up at the rescue clinic
  groom: 45,
  toys: 25,
  treat: 3,
};

/** Happiness label for the UI. */
export const petMood = (h) => (h >= 80 ? ['Over the moon', '🥰'] : h >= 60 ? ['Happy', '😊'] : h >= 40 ? ['Restless', '😐'] : h >= 20 ? ['Sad', '😢'] : ['Miserable', '😭']);
