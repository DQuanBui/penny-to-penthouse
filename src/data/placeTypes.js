// Every kind of enterable place in a city. `interior` selects the interior
// template (see world/Interiors.js); `service` is the UI opened at its counter.
//
// `look` drives how the place appears on the street (world/Storefronts.js):
//   front    shopfront | lobby | classic | showroom | residential
//   brand    main brand colour (awning, fascia, logo)
//   awning   slant | flat | none          extras  street dressing ids
//   building optional override for the whole building: { color, facade, minH, maxH }
//            (otherwise the shop sits on the ground floor of a normal building)
//   sky      true = lit company name near the roof

import { SHOP_TYPES } from './shops.js';

export const PLACE_TYPES = {
  home: { icon: '🏠', label: 'Residences', color: '#7dd3a8', interior: 'home', look: { front: 'residential', brand: '#2e4a3f', awning: 'flat', extras: ['planters'] } },
  cafe: { icon: '☕', label: 'Café', color: '#c98b4f', interior: 'cafe', service: 'cafe', look: { front: 'shopfront', brand: '#1e5b3a', trim: '#f1ece2', awning: 'slant', extras: ['bladeLogo', 'patio', 'chalkboard'] } },
  restaurant: { icon: '🍽️', label: 'Restaurant', color: '#e2674a', interior: 'restaurant', service: 'restaurant', career: 'hospitality', look: { front: 'shopfront', brand: '#6e1f2b', trim: '#e9dcc3', awning: 'slant', extras: ['patio', 'stringLights', 'planters'] } },
  grocery: { icon: '🛒', label: 'Grocery', color: '#63b866', interior: 'shop', service: 'grocery', look: { front: 'shopfront', brand: '#2f7d3a', trim: '#f4f1e8', awning: 'flat', extras: ['produce', 'carts'], building: { color: '#cbb894', facade: 'masonry', minH: 9, maxH: 13 } } },
  clothing: { icon: '👕', label: 'Clothing', color: '#d870b8', interior: 'shop', service: 'clothing', look: { front: 'shopfront', brand: '#16161a', trim: '#d8c08a', awning: 'none', extras: ['mannequins', 'planters'] } },
  furniture: { icon: '🛋️', label: 'Furniture', color: '#b08a5c', interior: 'shop', service: 'furniture', look: { front: 'shopfront', brand: '#5a4632', trim: '#efe6d6', awning: 'flat', extras: ['displaySofa'] } },
  electronics: { icon: '💻', label: 'Electronics', color: '#5aa7e8', interior: 'shop', service: 'electronics', look: { front: 'shopfront', brand: '#14243d', trim: '#4fb3ff', awning: 'none', extras: ['screens', 'neonStrip'] } },
  gym: { icon: '🏋️', label: 'Gym', color: '#ef6a5b', interior: 'gym', service: 'gym', look: { front: 'shopfront', brand: '#1b1b1f', trim: '#ff5a3c', awning: 'none', extras: ['neonStrip', 'banner'] } },
  bank: { icon: '🏦', label: 'Bank', color: '#4f9d8b', interior: 'office', service: 'bank', look: { front: 'classic', brand: '#1f4f6e', trim: '#e3d9c6', extras: ['flags'], sky: true, building: { color: '#d9d0c0', facade: 'masonry', minH: 26, maxH: 44 } } },
  college: { icon: '🎓', label: 'College', color: '#7a7fe0', interior: 'college', service: 'college', look: { front: 'classic', brand: '#4b2e83', trim: '#e7dcc8', extras: ['flags', 'banners'], sky: true, building: { color: '#b9876a', facade: 'masonry', minH: 16, maxH: 26 } } },
  bar: { icon: '🍸', label: 'Lounge', color: '#b65ce0', interior: 'bar', service: 'bar', look: { front: 'shopfront', brand: '#1a1222', trim: '#c86bff', awning: 'flat', extras: ['neonSign', 'velvetRope'] } },
  realestate: { icon: '🏘️', label: 'Real Estate', color: '#e0a23c', interior: 'office', service: 'realestate', career: 'realestate', look: { front: 'shopfront', brand: '#2b2f3a', trim: '#e0a23c', awning: 'flat', extras: ['listings', 'planters'] } },
  dealer: { icon: '🚗', label: 'Car Dealer', color: '#e05c5c', interior: 'showroom', service: 'dealer', look: { front: 'showroom', brand: '#b3202a', trim: '#f2f4f6', extras: ['pennants', 'displayCar'], building: { color: '#e4e8ec', facade: 'glass', minH: 9, maxH: 11 } } },
  hospital: { icon: '🏥', label: 'Hospital', color: '#e86a8a', interior: 'clinic', service: 'hospital', career: 'healthcare', look: { front: 'lobby', brand: '#c4142b', trim: '#f4f6f8', extras: ['redCross', 'planters'], sky: true, building: { color: '#e7ebee', facade: 'masonry', minH: 26, maxH: 38 } } },
  office_tech: { icon: '🖥️', label: 'Tech Office', color: '#4fb3e8', interior: 'office', service: 'work', career: 'tech', look: { front: 'lobby', brand: '#1678c2', trim: '#dfe8ef', extras: ['planters', 'bikeRack'], sky: true, building: { color: '#7fa9c9', facade: 'glass', minH: 45, maxH: 90 } } },
  office_finance: { icon: '📈', label: 'Finance Office', color: '#3fb88a', interior: 'office', service: 'work', career: 'finance', look: { front: 'lobby', brand: '#0f3b2e', trim: '#c9b27a', extras: ['planters', 'flags'], sky: true, building: { color: '#5c7d96', facade: 'glass', minH: 80, maxH: 150, tiers: true } } },
  trades: { icon: '🔧', label: 'Trades Depot', color: '#e0903c', interior: 'workshop', service: 'work', career: 'trades', look: { front: 'showroom', brand: '#d4691f', trim: '#2b2f38', extras: ['crates'], building: { color: '#8a7c6a', facade: 'warehouse', minH: 9, maxH: 13 } } },
  studio: { icon: '🎬', label: 'Creative Studio', color: '#e85ca0', interior: 'studio', service: 'work', career: 'creative', look: { front: 'lobby', brand: '#c2185b', trim: '#1b1b20', extras: ['neonStrip', 'banner'], sky: true, building: { color: '#3c3f4a', facade: 'warehouse', minH: 14, maxH: 24 } } },
  mall: { icon: '🛍️', label: 'Mall', color: '#f2a93b', interior: 'mall', service: 'mall', look: { front: 'showroom', brand: '#2d3a8c', trim: '#f2f4f6', extras: ['banner', 'planters', 'flags'], sky: true, building: { color: '#d7dde4', facade: 'glass', minH: 14, maxH: 20 } } },
  shelter: { icon: '🐾', label: 'Pet Rescue', color: '#e8a05c', interior: 'shelter', service: 'shelter', look: { front: 'shopfront', brand: '#2f7d8f', trim: '#f6e7c8', awning: 'slant', extras: ['bladeLogo', 'planters', 'chalkboard'] } },
  station: { icon: '🚇', label: 'Transit', color: '#ffd24a', interior: 'platform', service: 'transit' },
  subwaycar: { icon: '🚇', label: 'Train', color: '#ffd24a', interior: 'subwaycar', service: null },
  zoo: { icon: '🦁', label: 'Zoo', color: '#4f8a3a', interior: null, service: 'zoo', outdoor: true },
  airport: { icon: '✈️', label: 'Airport', color: '#4f9dff', interior: 'terminal', service: 'flights' },
  hotel: { icon: '🏨', label: 'Hotel', color: '#c9a227', interior: 'hotelroom', service: 'hotel', look: { front: 'lobby', brand: '#6b1f2a', trim: '#e2c27a', extras: ['flags', 'planters'], sky: true, building: { color: '#cdbfa8', facade: 'masonry', minH: 38, maxH: 55 } } },
  university: { icon: '🎓', label: 'University', color: '#7a7fe0', interior: 'lecture', service: 'college' },
  school: { icon: '🏫', label: 'School', color: '#e0903c', interior: 'classroom', service: 'school' },
  // neighbourhood businesses (data/shops.js): minor = generated on ordinary lots
  ...Object.fromEntries(Object.entries(SHOP_TYPES).map(([id, t]) => [id, { icon: t.icon, label: t.label, color: t.color, interior: t.interior, service: 'minor', look: t.look, minor: true }])),
};
