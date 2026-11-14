// Career ladders. Salary is a base annual figure (× city salaryIndex × the
// city's industry boost). `req` lists what a level needs:
//   skills {id: level}, degree (any of), cert (any of), popularity
// `hours` = [start, end] of the weekday shift. `tips` adds per-shift cash.
// `place` is the workplace's place type; `minigame` the shift mini-game id.

export const CAREERS = [
  {
    id: 'tech', name: 'Tech', icon: '💻', place: 'office_tech', minigame: 'bugsquash', skill: 'coding',
    blurb: 'Write code, ship features, climb to the C-suite.',
    levels: [
      { title: 'IT Support Intern', salary: 36000, hours: [9, 17], req: { skills: { coding: 1 } } },
      { title: 'Junior Developer', salary: 62000, hours: [9, 17], req: { skills: { coding: 3 } } },
      { title: 'Software Developer', salary: 90000, hours: [9, 17], req: { skills: { coding: 5 } } },
      { title: 'Senior Developer', salary: 125000, hours: [9, 17], req: { skills: { coding: 7, business: 2 } } },
      { title: 'Tech Lead', salary: 160000, hours: [9, 17], req: { skills: { coding: 8, charisma: 3 } } },
      { title: 'Engineering Manager', salary: 210000, hours: [9, 17], req: { skills: { coding: 8, business: 5, charisma: 4 }, degree: ['bs_cs', 'bootcamp_code', 'mba'] } },
      { title: 'VP of Engineering', salary: 300000, hours: [9, 18], req: { skills: { business: 7, charisma: 6 }, degree: ['bs_cs', 'mba'] }, exec: true },
      { title: 'Chief Technology Officer', salary: 430000, hours: [9, 18], req: { skills: { coding: 9, business: 8, charisma: 7 } }, exec: true, ceo: true },
    ],
  },
  {
    id: 'hospitality', name: 'Hospitality & Food', icon: '🍽️', place: 'restaurant', minigame: 'orderrush', skill: 'cooking',
    blurb: 'Start in the dish pit, end up running the kitchen. Tips paid daily.',
    levels: [
      { title: 'Dishwasher', salary: 27000, hours: [11, 19], req: {} },
      { title: 'Server', salary: 30000, hours: [11, 19], req: { skills: { charisma: 1 } }, tips: [25, 70] },
      { title: 'Line Cook', salary: 40000, hours: [11, 19], req: { skills: { cooking: 3 } }, tips: [10, 30] },
      { title: 'Sous Chef', salary: 56000, hours: [11, 19], req: { skills: { cooking: 5 } }, tips: [10, 35] },
      { title: 'Head Chef', salary: 80000, hours: [11, 20], req: { skills: { cooking: 7, business: 2 } } },
      { title: 'Restaurant Manager', salary: 104000, hours: [10, 19], req: { skills: { business: 4, charisma: 5 } } },
      { title: 'Executive Chef & Partner', salary: 150000, hours: [10, 19], req: { skills: { cooking: 8, business: 6 } }, exec: true },
    ],
  },
  {
    id: 'trades', name: 'Skilled Trades', icon: '🔧', place: 'trades', minigame: 'wiring', skill: 'handiness',
    blurb: 'Honest work, early mornings, strong pay without a degree.',
    levels: [
      { title: 'Laborer', salary: 33000, hours: [7, 15], req: {} },
      { title: 'Apprentice', salary: 42000, hours: [7, 15], req: { skills: { handiness: 2 } } },
      { title: 'Journeyman Electrician', salary: 62000, hours: [7, 15], req: { skills: { handiness: 4 }, cert: ['trade_cert'] } },
      { title: 'Master Electrician', salary: 86000, hours: [7, 15], req: { skills: { handiness: 6, fitness: 2 } } },
      { title: 'Site Foreman', salary: 108000, hours: [7, 16], req: { skills: { handiness: 7, charisma: 3 } } },
      { title: 'Project Manager', salary: 138000, hours: [8, 17], req: { skills: { handiness: 7, business: 5 } } },
      { title: 'General Contractor', salary: 195000, hours: [8, 17], req: { skills: { handiness: 8, business: 7 }, cert: ['contractor_license'] }, exec: true },
    ],
  },
  {
    id: 'finance', name: 'Finance', icon: '📈', place: 'office_finance', minigame: 'trading', skill: 'finance',
    blurb: 'Read the market, manage money, earn the biggest bonuses in town.',
    levels: [
      { title: 'Operations Clerk', salary: 35000, hours: [9, 17], req: { skills: { finance: 1 } } },
      { title: 'Junior Analyst', salary: 64000, hours: [9, 17], req: { skills: { finance: 3 } } },
      { title: 'Financial Analyst', salary: 94000, hours: [9, 18], req: { skills: { finance: 5 }, degree: ['bs_finance', 'ba_business', 'mba'], cert: ['series65'], either: true } },
      { title: 'Senior Analyst', salary: 138000, hours: [9, 18], req: { skills: { finance: 7, business: 2 } } },
      { title: 'Portfolio Manager', salary: 195000, hours: [9, 18], req: { skills: { finance: 8, business: 4 } } },
      { title: 'Director', salary: 275000, hours: [8, 18], req: { skills: { finance: 8, business: 6, charisma: 5 }, degree: ['mba', 'bs_finance'] } },
      { title: 'Managing Director', salary: 400000, hours: [8, 18], req: { skills: { finance: 9, business: 7, charisma: 6 }, degree: ['mba'] }, exec: true },
      { title: 'Chief Financial Officer', salary: 520000, hours: [8, 18], req: { skills: { finance: 10, business: 8, charisma: 7 } }, exec: true, ceo: true },
    ],
  },
  {
    id: 'healthcare', name: 'Healthcare', icon: '🩺', place: 'hospital', minigame: 'triage', skill: 'charisma',
    blurb: 'Steady, meaningful work. The top of the ladder needs serious schooling.',
    levels: [
      { title: 'Hospital Orderly', salary: 31000, hours: [7, 15], req: {} },
      { title: 'Nursing Assistant', salary: 40000, hours: [7, 15], req: { cert: ['cna'] } },
      { title: 'Registered Nurse', salary: 84000, hours: [7, 15], req: { degree: ['bs_nursing'] } },
      { title: 'Charge Nurse', salary: 106000, hours: [7, 15], req: { degree: ['bs_nursing'], skills: { charisma: 4 } } },
      { title: 'Nurse Practitioner', salary: 138000, hours: [8, 16], req: { degree: ['bs_nursing'], skills: { charisma: 5, handiness: 3 } } },
      { title: 'Resident Physician', salary: 165000, hours: [7, 17], req: { degree: ['md'] } },
      { title: 'Attending Physician', salary: 300000, hours: [8, 17], req: { degree: ['md'], skills: { charisma: 6, handiness: 5 } }, exec: true },
      { title: 'Chief of Medicine', salary: 460000, hours: [8, 17], req: { degree: ['md'], skills: { charisma: 7, business: 5 } }, exec: true, ceo: true },
    ],
  },
  {
    id: 'creative', name: 'Creative & Influencer', icon: '🎬', place: 'studio', minigame: 'beatcut', skill: 'creativity',
    blurb: 'Make things people share. Fame opens the top jobs.',
    levels: [
      { title: 'Production Assistant', salary: 30000, hours: [10, 18], req: {} },
      { title: 'Junior Designer', salary: 47000, hours: [10, 18], req: { skills: { creativity: 3 } } },
      { title: 'Content Producer', salary: 68000, hours: [10, 18], req: { skills: { creativity: 5 } } },
      { title: 'Senior Creative', salary: 95000, hours: [10, 18], req: { skills: { creativity: 7, charisma: 3 } } },
      { title: 'Creative Director', salary: 145000, hours: [10, 18], req: { skills: { creativity: 8, business: 3 }, popularity: 20 } },
      { title: 'Showrunner', salary: 215000, hours: [10, 19], req: { skills: { creativity: 9, charisma: 6 }, popularity: 40 } },
      { title: 'Media Executive', salary: 345000, hours: [9, 18], req: { skills: { creativity: 9, business: 6 }, popularity: 60 }, exec: true, ceo: true },
    ],
  },
  {
    id: 'realestate', name: 'Real Estate', icon: '🏘️', place: 'realestate', minigame: 'matchhome', skill: 'charisma',
    blurb: 'Lower base pay, but every closed deal pays commission the same day.',
    levels: [
      { title: 'Leasing Assistant', salary: 32000, hours: [9, 17], req: { skills: { charisma: 1 } } },
      { title: 'Leasing Agent', salary: 40000, hours: [9, 17], req: { skills: { charisma: 3 }, cert: ['realestate_license'] }, tips: [20, 70] },
      { title: 'Sales Agent', salary: 56000, hours: [9, 17], req: { skills: { charisma: 5, business: 2 }, cert: ['realestate_license'] }, tips: [50, 190] },
      { title: 'Senior Agent', salary: 82000, hours: [9, 17], req: { skills: { charisma: 6, business: 4 } }, tips: [90, 330] },
      { title: 'Broker', salary: 118000, hours: [9, 17], req: { skills: { business: 6, finance: 3, charisma: 6 } }, tips: [140, 480] },
      { title: 'Managing Broker', salary: 172000, hours: [9, 18], req: { skills: { business: 7, charisma: 7 } }, tips: [200, 600] },
      { title: 'Brokerage Partner', salary: 265000, hours: [9, 18], req: { skills: { business: 9, charisma: 8, finance: 5 } }, exec: true, ceo: true },
    ],
  },
];
export const CAREER_BY_ID = Object.fromEntries(CAREERS.map((c) => [c.id, c]));

// Interview question pool. Each answer has a score: 2 great, 1 fine, 0 poor.
// `needs` shows the answer only if the player has that skill level (a strong,
// honest answer you can only give if it is true).
export const INTERVIEW_QUESTIONS = [
  { q: 'Tell me about yourself.', a: [{ t: 'A short story: where I come from, what I am good at, why this role.', s: 2 }, { t: 'I just really need a job right now.', s: 0 }, { t: 'My whole life story, starting in kindergarten.', s: 1 }] },
  { q: 'Why do you want to work here?', a: [{ t: 'I looked into what you do and I can help with it from day one.', s: 2 }, { t: 'It is close to my apartment.', s: 0 }, { t: 'The pay seems fair and I want to grow.', s: 1 }] },
  { q: 'Describe a time something went wrong.', a: [{ t: 'I owned the mistake, fixed it, and changed how I work.', s: 2 }, { t: 'Honestly, things rarely go wrong for me.', s: 0 }, { t: 'It was mostly a teammate’s fault, but I helped.', s: 1 }] },
  { q: 'Where do you see yourself in three years?', a: [{ t: 'Leading bigger pieces of work here, with the skills to back it.', s: 2 }, { t: 'Probably doing your job.', s: 1 }, { t: 'I do not really plan that far ahead.', s: 0 }] },
  { q: 'How do you handle a rush or a tight deadline?', a: [{ t: 'Prioritise, communicate early, and stay calm.', s: 2 }, { t: 'I work best when I panic a little.', s: 1 }, { t: 'I usually let someone else take the lead.', s: 0 }] },
  { q: 'What is your biggest weakness?', a: [{ t: 'A real one — and what I am doing to improve it.', s: 2 }, { t: 'I am a perfectionist. I care too much.', s: 1 }, { t: 'I do not have any.', s: 0 }] },
  { q: 'A customer or colleague is being difficult. What do you do?', a: [{ t: 'Listen first, stay respectful, look for what they actually need.', s: 2 }, { t: 'Tell them exactly what I think.', s: 0 }, { t: 'Avoid them until it blows over.', s: 1 }] },
  { q: 'Do you have any questions for us?', a: [{ t: 'What does success look like in the first 90 days?', s: 2 }, { t: 'How soon can I take vacation?', s: 0 }, { t: 'No, I think you covered everything.', s: 1 }] },
  { q: 'What salary are you expecting?', a: [{ t: 'Something fair for the role — I am flexible for the right team.', s: 1 }, { t: 'I researched the range, and here is why I am worth the upper half.', s: 2, needs: { charisma: 3 } }, { t: 'Whatever you are offering is fine.', s: 1 }, { t: 'Double what the ad says.', s: 0 }] },
  { q: 'Show us something you have built or fixed.', a: [{ t: 'Walk through a real project step by step.', s: 2, needs: { any: 3 } }, { t: 'I have not built much yet, but I learn fast — here is how I practise.', s: 1 }, { t: 'I would rather not; my work speaks for itself.', s: 0 }] },
];
