// Pet UI: the dialog you get when you walk up to your dog, and the counter
// at the pet rescue (adopt a dog, or buy care for the one you have).
import { h, btn } from './dom.js';
import { dialog, confirmBox } from './Menus.js';
import { BREED_BY_ID, PET, petMood } from '../data/pets.js';
import { petStatus, petFoodCost } from '../sim/Pets.js';
import { fmtMoney } from '../core/utils.js';

function happyBar(pet) {
  const [label, icon] = petMood(pet.happy);
  const col = pet.happy >= 60 ? 'var(--good)' : pet.happy >= 30 ? 'var(--accent)' : 'var(--bad)';
  return h('div', h('div.row.between', h('span.muted.small', 'Happiness'), h('span.small', `${icon} ${label}`)), h('div.bar', h('div.bar-fill', { style: { width: pet.happy + '%', background: col } })));
}

function petCard(game) {
  const pet = game.state.pet;
  const b = BREED_BY_ID[pet.breed];
  const days = game.sim.day - pet.adopted;
  return h(
    'div.card',
    h('div.row.between', h('b', `${b.icon} ${pet.name}`), h('span.muted.small', `${b.name} · ${pet.age + Math.floor(days / 112)} yrs`)),
    happyBar(pet),
    h('div.muted.small', `${petStatus(game.sim)} · food ${petFoodCost(game.sim)}/day · with you for ${days} day${days === 1 ? '' : 's'}`),
  );
}

/** Walk up to your dog and press E. */
export function openPet(game) {
  const sim = game.sim;
  const pet = game.state.pet;
  if (!pet) return;
  const outside = !game.inside;
  const say = (text, kind = 'good') => game.events.emit('toast', { icon: '🐕', title: pet.name, text, kind });
  const el = dialog(game, {
    title: `🐕 ${pet.name}`,
    body: h(
      'div.menu-col',
      petCard(game),
      btn('🤗  Pet and cuddle', () => {
        game.closeOverlay(el);
        game.audio?.play('bark');
        say(sim.pets.cuddle());
      }),
      outside
        ? btn('🎾  Play fetch', () => {
            game.closeOverlay(el);
            game.audio?.play('throw');
            game.pet.onFetched = () => {
              game.audio?.play('bark');
              say(sim.pets.fetched());
            };
            game.pet.throwBall(game.player, game.city.colliders);
          })
        : h('div.muted.small', 'Fetch needs more room. Take them outside, ideally to a park.'),
      btn(`🦴  Give a treat · ${fmtMoney(sim.pets.price(PET.treat))}`, () => {
        if (!sim.pets.care('treat')) return;
        game.closeOverlay(el);
        game.audio?.play('bark');
        say(`${pet.name} crunches the treat in one second flat.`);
      }),
      h('div.tip', `💡 Walk ${pet.name} for ${PET.walkMinutes} minutes outside every day. A happy dog lifts your Fun and Social every morning.`),
    ),
  });
}

/** Counter service at the pet rescue. */
export function shelterService(game, place, body, refresh) {
  const sim = game.sim;
  const pet = game.state.pet;
  body.append(h('div.muted', 'Every dog here is vaccinated, microchipped and waiting for a family. Adoption fees keep the rescue running.'));
  if (pet) {
    body.append(petCard(game), h('div.sec-title', `Care for ${pet.name}`));
    const care = [
      ['vet', '🩺', 'Vet check-up', 'A full check-up and shots. Peace of mind.', PET.vet],
      ['groom', '🛁', 'Grooming', 'Bath, brush and nail trim. Comes out looking brand new.', PET.groom],
      ['toys', '🧸', 'Toy bundle', 'Rope, squeaky duck and a new ball.', PET.toys],
    ];
    for (const [kind, icon, name, desc, price] of care) {
      body.append(
        h(
          'div.slot',
          h('div.lrow-icon', icon),
          h('div.grow', h('div.slot-name', name), h('div.muted.small', desc)),
          btn(fmtMoney(sim.pets.price(price)), () => {
            if (!sim.pets.care(kind)) return;
            game.audio?.play('cash');
            game.events.emit('toast', { icon, title: name, text: `${pet.name} is a very happy dog.`, kind: 'good' });
            refresh();
          }, 'small primary'),
        ),
      );
    }
    body.append(
      btn(`Give ${pet.name} back to the rescue`, async () => {
        const ok = await confirmBox(game, { title: `Rehome ${pet.name}?`, text: `${pet.name} will stay at the rescue until a new family adopts them. Are you sure?`, yes: 'Rehome', danger: true });
        if (ok) {
          sim.pets.rehome();
          refresh();
        }
      }, 'small'),
    );
    return;
  }
  body.append(h('div.sec-title', 'Looking for a home'));
  for (const o of sim.pets.available()) {
    let name = o.name;
    const input = h('input.text', { value: name, maxLength: 16, style: { width: '120px', padding: '4px 8px' }, oninput: (e) => (name = e.target.value), onkeydown: (e) => e.stopPropagation() });
    body.append(
      h(
        'div.slot',
        h('div.lrow-icon', o.breed.icon),
        h('div.grow', h('div.slot-name', `${o.name} · ${o.breed.name}, ${o.age} yr${o.age === 1 ? '' : 's'}`), h('div.muted.small', o.breed.desc)),
        h('div.row', input, btn(`Adopt · ${fmtMoney(sim.pets.fee(o.breed))}`, () => {
          if (!sim.pets.adopt(o, name)) return;
          game.audio?.play('bark');
          refresh();
        }, 'small primary')),
      ),
    );
  }
  body.append(h('div.tip', `💡 A dog costs about ${petFoodCost(sim)} a day in food. They follow you everywhere, wait outside shops and ride along in your car.`));
}
