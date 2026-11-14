// Healthcare mini-game: patients arrive with a complaint — pick the right
// treatment before the waiting room fills up.
import { h } from '../ui/dom.js';

const CASES = [
  ['🤕', 'Cut and bruises', '🩹'],
  ['🤒', 'High fever', '💊'],
  ['🦴', 'Broken arm', '🦾'],
  ['😮‍💨', 'Short of breath', '🫁'],
  ['🤢', 'Stomach bug', '💧'],
  ['💔', 'Chest pain', '⚡'],
];
const TREATMENTS = [
  ['🩹', 'Bandage'],
  ['💊', 'Medicine'],
  ['🦾', 'Splint'],
  ['🫁', 'Oxygen'],
  ['💧', 'Fluids'],
  ['⚡', 'Cardiac team'],
];

export const Triage = {
  id: 'triage',
  title: 'Triage',
  icon: '🩺',
  how: 'Read the complaint, then choose the matching treatment. Speed matters, mistakes cost more.',
  seconds: 34,
  setup(ctx) {
    const card = h('div.triage-card');
    const pad = h('div.triage-pad', TREATMENTS.map(([icon, label]) => h('button.or-btn.triage-btn', { onclick: () => treat(icon) }, h('div', icon), h('small', label))));
    ctx.area.append(h('div.or-wrap', card, pad));
    let cur = null;
    let ok = 0;
    let bad = 0;
    const target = 13 + ctx.level;
    const next = () => {
      cur = CASES[Math.floor(ctx.rng() * CASES.length)];
      card.replaceChildren(h('div.triage-face', cur[0]), h('div', h('div.muted.small', `Patient #${ok + bad + 1}`), h('div.big', cur[1])));
      ctx.setInfo(`Treated ${ok} · Errors ${bad}`);
    };
    function treat(icon) {
      if (icon === cur[2]) {
        ok++;
        ctx.sfx('click');
        card.classList.add('flash');
        ctx.after(120, () => card.classList.remove('flash'));
      } else {
        bad++;
        ctx.sfx('error');
        card.classList.add('shake');
        ctx.after(250, () => card.classList.remove('shake'));
      }
      next();
    }
    next();
    return { score: () => (ok - bad * 1.2) / target };
  },
};
