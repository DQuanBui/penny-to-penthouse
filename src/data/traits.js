// Personality traits. `mods` are multipliers (or additive bonuses where noted)
// read by the simulation through sim/Player.js -> mod(state, key).
//
// Multiplier keys used across the sim:
//   perfGain      work performance gained per shift
//   xpGain        all skill learning          xp_<skill>  one skill's learning
//   priceMul      shop prices                 relGain     friendship gained
//   relDecay      friendship lost over time   followerGain social followers gained
//   decay_<need>  how fast a need drains      gain_<need>  how much activities restore
//   nightEnergy   energy drain between 10pm-4am
//   investVol     market swing on your holdings (risk AND reward)
//   homeBonus     need restoration at home    giftPower   effect of gifts
//   interview     additive bonus to interview success (0.1 = +10%)
//   bizLuck       additive bonus to business success chance

export const TRAITS = [
  { id: 'ambitious', name: 'Ambitious', icon: '🚀', desc: 'Work performance builds 20% faster, but Fun drains 10% quicker.', mods: { perfGain: 1.2, decay_fun: 1.1 } },
  { id: 'frugal', name: 'Frugal', icon: '🪙', desc: 'Everything in shops costs 10% less.', mods: { priceMul: 0.9 } },
  { id: 'charismatic', name: 'Charismatic', icon: '✨', desc: 'Friendships grow 25% faster and interviews go better.', mods: { relGain: 1.25, interview: 0.1 } },
  { id: 'nightowl', name: 'Night Owl', icon: '🦉', desc: 'Lose 40% less Energy late at night; a little sluggish otherwise.', mods: { nightEnergy: 0.6, decay_energy: 1.04 } },
  { id: 'fitness', name: 'Fitness Buff', icon: '💪', desc: 'Fitness trains 50% faster and Health drains slower.', mods: { xp_fitness: 1.5, decay_health: 0.6, decay_energy: 0.95 } },
  { id: 'creative', name: 'Creative', icon: '🎨', desc: 'Creativity grows 50% faster and posts earn 20% more followers.', mods: { xp_creativity: 1.5, followerGain: 1.2 } },
  { id: 'genius', name: 'Genius', icon: '🧠', desc: 'Learn every skill 25% faster, but Social drains quicker.', mods: { xpGain: 1.25, decay_social: 1.15 } },
  { id: 'lazy', name: 'Lazy', icon: '🛋️', desc: 'Low grit: work performance builds 15% slower and Energy drains faster. Relaxing is extra fun.', mods: { perfGain: 0.85, decay_energy: 1.12, gain_fun: 1.2 } },
  { id: 'generous', name: 'Generous', icon: '🎁', desc: 'Gifts are 50% more effective and friendships fade slower.', mods: { giftPower: 1.5, relDecay: 0.6 } },
  { id: 'risktaker', name: 'Risk-Taker', icon: '🎲', desc: 'Your investments swing 25% harder (both ways) and bold business bets land more often.', mods: { investVol: 1.25, bizLuck: 0.08, interview: 0.04 } },
  { id: 'homebody', name: 'Homebody', icon: '🏡', desc: 'Needs recover 25% faster at home and Social drains slower.', mods: { homeBonus: 1.25, decay_social: 0.8 } },
  { id: 'social', name: 'Social Butterfly', icon: '🦋', desc: 'Socialising is 30% more effective and friends come easier — but you get lonely fast.', mods: { gain_social: 1.3, relGain: 1.12, decay_social: 1.2 } },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
