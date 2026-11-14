// Education catalogue.
//  PROGRAMS  — taught at the college, one class per day (multi-week).
//              kind: degree | cert   grants: id stored in education.degrees/certs
//  ONLINE    — short phone courses, a lesson is 1 hour anywhere.
//  BOOKS     — bought once, read in 1-hour sittings.
// `skills` is the TOTAL experience handed out over the whole course.

export const PROGRAMS = [
  { id: 'bs_cs', kind: 'degree', name: 'B.S. Computer Science', icon: '💻', sessions: 28, hours: 2.5, tuition: 24000, skills: { coding: 5, business: 0.8 }, desc: 'Opens senior engineering and management tracks in Tech.' },
  { id: 'ba_business', kind: 'degree', name: 'B.A. Business', icon: '💼', sessions: 24, hours: 2.5, tuition: 20000, skills: { business: 4.5, finance: 1.5, charisma: 1 }, desc: 'A broad foundation for management, finance and founders.' },
  { id: 'bs_finance', kind: 'degree', name: 'B.S. Finance', icon: '📊', sessions: 24, hours: 2.5, tuition: 22000, skills: { finance: 5, business: 1.5 }, desc: 'Required for analyst roles and above in Finance.' },
  { id: 'bs_nursing', kind: 'degree', name: 'B.S. Nursing', icon: '🩺', sessions: 26, hours: 2.5, tuition: 22000, skills: { charisma: 2.5, handiness: 2, fitness: 1 }, desc: 'Registered Nurse licence: the heart of the Healthcare ladder.' },
  { id: 'ba_arts', kind: 'degree', name: 'B.F.A. Design & Media', icon: '🎨', sessions: 20, hours: 2.5, tuition: 16000, skills: { creativity: 5, charisma: 1 }, desc: 'Portfolio, craft and industry contacts for Creative careers.' },
  { id: 'mba', kind: 'degree', name: 'M.B.A.', icon: '🎓', sessions: 20, hours: 3, tuition: 48000, req: { anyDegree: true }, skills: { business: 5, finance: 2.5, charisma: 2 }, desc: 'The executive ticket. Needs any bachelor degree first.' },
  { id: 'md', kind: 'degree', name: 'Doctor of Medicine', icon: '⚕️', sessions: 36, hours: 3, tuition: 96000, req: { degree: ['bs_nursing'] }, skills: { handiness: 4, charisma: 3 }, desc: 'Long, brutal and worth it: physician roles in Healthcare.' },
  { id: 'bootcamp_code', kind: 'cert', name: 'Coding Bootcamp', icon: '⌨️', sessions: 12, hours: 3, tuition: 9500, skills: { coding: 4.5 }, desc: 'Twelve intense classes. Counts as a degree for most Tech roles.' },
  { id: 'culinary', kind: 'cert', name: 'Culinary Certificate', icon: '👨‍🍳', sessions: 10, hours: 3, tuition: 6500, skills: { cooking: 4.5, business: 0.5 }, desc: 'Knife skills to kitchen management.' },
  { id: 'trade_cert', kind: 'cert', name: 'Electrician Certification', icon: '🔌', sessions: 10, hours: 3, tuition: 3500, skills: { handiness: 3.5 }, desc: 'Required to work as a Journeyman in the Trades.' },
  { id: 'contractor_license', kind: 'cert', name: 'Contractor Licence', icon: '🏗️', sessions: 8, hours: 2.5, tuition: 5000, req: { skills: { handiness: 6 } }, skills: { business: 2.5, handiness: 1 }, desc: 'Run your own crews: General Contractor.' },
  { id: 'realestate_license', kind: 'cert', name: 'Real Estate Licence', icon: '🏘️', sessions: 8, hours: 2, tuition: 1200, skills: { business: 1.5, charisma: 1.5, finance: 0.5 }, desc: 'Lets you close deals — and earn commission.' },
  { id: 'cna', kind: 'cert', name: 'Nursing Assistant (CNA)', icon: '🏥', sessions: 8, hours: 2.5, tuition: 1800, skills: { charisma: 1.5, handiness: 1 }, desc: 'The fastest way onto a hospital ward.' },
  { id: 'series65', kind: 'cert', name: 'Securities Licence', icon: '📈', sessions: 8, hours: 2.5, tuition: 1500, skills: { finance: 3 }, desc: 'An alternative to a degree for Finance analyst roles.' },
];
export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));

const O = (id, name, icon, skill, price, lessons, xp, min = 0) => ({ id, name, icon, skill, price, lessons, xp, min });
export const ONLINE = [
  O('on_code1', 'Python for Beginners', '🐍', 'coding', 49, 6, 0.42),
  O('on_code2', 'Data Structures & Systems', '🧩', 'coding', 189, 8, 0.5, 4),
  O('on_biz1', 'Business Fundamentals', '📋', 'business', 59, 6, 0.42),
  O('on_biz2', 'Strategy & Leadership', '♟️', 'business', 219, 8, 0.5, 4),
  O('on_fin1', 'Personal Finance 101', '💵', 'finance', 39, 6, 0.42),
  O('on_fin2', 'Investing & Valuation', '📉', 'finance', 199, 8, 0.5, 4),
  O('on_cha1', 'Public Speaking', '🎤', 'charisma', 45, 6, 0.4),
  O('on_cre1', 'Design Basics', '🖌️', 'creativity', 45, 6, 0.42),
  O('on_cre2', 'Video & Storytelling', '🎬', 'creativity', 179, 8, 0.5, 4),
  O('on_cook1', 'Home Cooking Masterclass', '🍳', 'cooking', 35, 6, 0.42),
  O('on_handy1', 'DIY Home Repair', '🧰', 'handiness', 35, 6, 0.42),
  O('on_fit1', 'Bodyweight Training Plan', '🤸', 'fitness', 29, 6, 0.36),
];
export const ONLINE_BY_ID = Object.fromEntries(ONLINE.map((o) => [o.id, o]));

const B = (id, name, skill, price, xp = 0.34) => ({ id, name, skill, price, sittings: 4, xp });
export const BOOKS = [
  B('bk_code', 'Clean Code, Calm Mind', 'coding', 32),
  B('bk_biz', 'The Lean Corner Shop', 'business', 24),
  B('bk_fin', 'The Patient Investor', 'finance', 22),
  B('bk_cha', 'How to Talk to Anyone, Anywhere', 'charisma', 19),
  B('bk_cre', 'Steal Like a Designer', 'creativity', 21),
  B('bk_cook', 'Salt, Heat & Leftovers', 'cooking', 26),
  B('bk_handy', 'Fix It Yourself', 'handiness', 20),
  B('bk_fit', 'Strong at Any Age', 'fitness', 18),
];
export const BOOK_BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
