// Recurring city happenings. Every city runs the same calendar at its own
// parks and plazas (chosen per city in world/CityEvents.js).
//   days   weekdays it runs (0 = Monday … 6 = Sunday)
//   week1  true = only in the first week of each month
//   hours  [start, end)
//   venue  park | plaza        set  market | stage | arch | festival
//   crowd  people gathered     dance true = the crowd dances
// Activities: price · minutes · needs (total change) · xp · meals (groceries)
//   followers · furniture (id put in storage)

export const CITY_EVENTS = [
  {
    id: 'farmers', name: 'Farmers Market', icon: '🥕', days: [5], hours: [8, 14], venue: 'park', set: 'market', crowd: 34,
    blurb: 'Local growers, fresh bread and too many kinds of honey.',
    tents: ['#2f7d3a', '#e9c04c', '#c46a3a', '#f4f1ea', '#5a8fd0'],
    activities: [
      { id: 'produce', label: 'Buy fresh produce (8 portions)', icon: '🧺', price: 16, minutes: 20, meals: 8, needs: { fun: 4 } },
      { id: 'samples', label: 'Wander and taste the samples', icon: '🍯', minutes: 40, needs: { hunger: 14, fun: 10, social: 6 } },
      { id: 'farmers', label: 'Chat with the farmers about cooking', icon: '👩‍🌾', minutes: 45, needs: { social: 12 }, xp: { cooking: 0.3 } },
    ],
  },
  {
    id: 'nightmarket', name: 'Night Market', icon: '🏮', days: [3], hours: [18, 23.5], venue: 'plaza', set: 'market', crowd: 40,
    blurb: 'Lanterns, sizzling woks and handmade everything.',
    tents: ['#b5343c', '#e9c04c', '#2f2f3a', '#c86bff', '#2f6e78'],
    lanterns: true,
    activities: [
      { id: 'foodcrawl', label: 'Street-food crawl', icon: '🥟', price: 14, minutes: 60, needs: { hunger: 55, fun: 16, social: 8 } },
      { id: 'crafts', label: 'Browse the handmade crafts', icon: '🧶', minutes: 40, needs: { fun: 12, social: 5 }, xp: { creativity: 0.15 } },
      { id: 'lantern', label: 'Buy a paper lantern for home', icon: '🏮', price: 30, minutes: 10, needs: { fun: 4 }, furniture: 'lamp_table' },
    ],
  },
  {
    id: 'concert', name: 'Live in the Park', icon: '🎸', days: [4], hours: [19, 23], venue: 'park', set: 'stage', crowd: 60, dance: true,
    blurb: 'Free outdoor concert. Bring friends, bring a blanket.',
    activities: [
      { id: 'watch', label: 'Watch the show', icon: '🎶', minutes: 90, needs: { fun: 34, social: 14 } },
      { id: 'dance', label: 'Dance up front', icon: '💃', minutes: 60, needs: { fun: 40, social: 18, energy: -14, hygiene: -10 }, xp: { fitness: 0.15 } },
      { id: 'merch', label: 'Buy band merch and post about it', icon: '👕', price: 30, minutes: 10, needs: { fun: 8 }, followers: 60 },
    ],
  },
  {
    id: 'artfair', name: 'Art Fair', icon: '🎨', days: [5, 6], week1: true, hours: [10, 18], venue: 'plaza', set: 'market', crowd: 30,
    blurb: 'Painters, potters and photographers from across the city.',
    tents: ['#f4f1ea', '#e8e4dc', '#d9c7a8', '#c9d4dc'],
    easels: true,
    activities: [
      { id: 'browse', label: 'Browse the art', icon: '🖼️', minutes: 45, needs: { fun: 14 }, xp: { creativity: 0.3 } },
      { id: 'print', label: 'Buy a framed print for home', icon: '🖼️', price: 80, minutes: 15, needs: { fun: 8 }, furniture: 'painting_s' },
      { id: 'sketch', label: 'Join the open sketch circle', icon: '✏️', minutes: 60, needs: { fun: 10, social: 10 }, xp: { creativity: 0.5 } },
    ],
  },
  {
    id: 'funrun', name: 'Sunday Fun Run', icon: '🏃', days: [6], hours: [7, 10.5], venue: 'park', set: 'arch', crowd: 26,
    blurb: 'A friendly 5K loop. Medals for everyone who finishes.',
    activities: [
      { id: 'run', label: 'Run the 5K', icon: '🏅', minutes: 50, needs: { energy: -24, hygiene: -30, fun: 14, health: 8 }, xp: { fitness: 0.7 }, followers: 25 },
      { id: 'cheer', label: 'Cheer the runners on', icon: '📣', minutes: 30, needs: { fun: 10, social: 10 } },
    ],
  },
  {
    id: 'festival', name: 'Street Festival', icon: '🎪', days: [6], hours: [12, 21], venue: 'plaza', set: 'festival', crowd: 55, dance: true,
    blurb: 'Music, food trucks, face paint and the whole neighbourhood.',
    tents: ['#e84a4a', '#f2b33d', '#3f76d0', '#2f8f4a', '#a04fc0'],
    activities: [
      { id: 'join', label: 'Join the festival', icon: '🎉', price: 18, minutes: 120, needs: { fun: 42, social: 26, hunger: 30 } },
      { id: 'games', label: 'Play the fair games', icon: '🎯', price: 8, minutes: 30, needs: { fun: 18 } },
      { id: 'volunteer', label: 'Volunteer at a stall', icon: '🙋', minutes: 120, needs: { social: 24, fun: 8, energy: -10 }, xp: { charisma: 0.35, business: 0.15 } },
    ],
  },
];
export const CITY_EVENT_BY_ID = Object.fromEntries(CITY_EVENTS.map((e) => [e.id, e]));

/** Is event e running on absolute day d at hour h? (h = null: any time that day) */
export function eventOn(e, day, hour = null) {
  if (!e.days.includes(day % 7)) return false;
  if (e.week1 && (day % 28) >= 7) return false;
  return hour == null || (hour >= e.hours[0] && hour < e.hours[1]);
}
