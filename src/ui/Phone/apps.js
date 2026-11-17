// Registers every phone app in home-screen order.
import { BankApp } from './Bank.js';
import { JobsApp } from './Jobs.js';
import { ContactsApp } from './Contacts.js';
import { SocialApp } from './Social.js';
import { LearnApp } from './Learn.js';
import { GigsApp, VenturesApp } from './Ventures.js';
import { InvestApp, NewsApp } from './Invest.js';
import { HomesApp } from './Homes.js';
import { openSettings } from '../Menus.js';

export function registerApps(phone, game) {
  phone.register(BankApp);
  phone.register(InvestApp);
  phone.register(HomesApp);
  phone.register(JobsApp);
  phone.register(LearnApp);
  phone.register(GigsApp);
  phone.register(VenturesApp);
  phone.register(ContactsApp);
  phone.register(SocialApp);
  phone.register(NewsApp);
  phone.register({
    id: 'map',
    name: 'Map',
    icon: '🗺️',
    color: 'linear-gradient(135deg,#22c55e,#15803d)',
    render(root, { phone: p }) {
      p.close();
      game.map.open();
    },
  });
  phone.register({
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    color: 'linear-gradient(135deg,#6b7280,#374151)',
    render(root, { phone: p }) {
      p.close();
      openSettings(game);
    },
  });
}
