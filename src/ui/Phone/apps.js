// Registers every phone app in home-screen order.
import { BankApp } from './Bank.js';
import { openSettings } from '../Menus.js';

export function registerApps(phone, game) {
  phone.register(BankApp);
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
