// Every kind of enterable place in a city. `interior` selects the interior
// template (see world/Interiors.js); `service` is the UI opened at its counter.

export const PLACE_TYPES = {
  home: { icon: '🏠', label: 'Residences', color: '#7dd3a8', interior: 'home' },
  cafe: { icon: '☕', label: 'Café', color: '#c98b4f', interior: 'cafe', service: 'cafe' },
  restaurant: { icon: '🍽️', label: 'Restaurant', color: '#e2674a', interior: 'restaurant', service: 'restaurant', career: 'hospitality' },
  grocery: { icon: '🛒', label: 'Grocery', color: '#63b866', interior: 'shop', service: 'grocery' },
  clothing: { icon: '👕', label: 'Clothing', color: '#d870b8', interior: 'shop', service: 'clothing' },
  furniture: { icon: '🛋️', label: 'Furniture', color: '#b08a5c', interior: 'shop', service: 'furniture' },
  electronics: { icon: '💻', label: 'Electronics', color: '#5aa7e8', interior: 'shop', service: 'electronics' },
  gym: { icon: '🏋️', label: 'Gym', color: '#ef6a5b', interior: 'gym', service: 'gym' },
  bank: { icon: '🏦', label: 'Bank', color: '#4f9d8b', interior: 'office', service: 'bank' },
  college: { icon: '🎓', label: 'College', color: '#7a7fe0', interior: 'college', service: 'college' },
  bar: { icon: '🍸', label: 'Lounge', color: '#b65ce0', interior: 'bar', service: 'bar' },
  realestate: { icon: '🏘️', label: 'Real Estate', color: '#e0a23c', interior: 'office', service: 'realestate', career: 'realestate' },
  dealer: { icon: '🚗', label: 'Car Dealer', color: '#e05c5c', interior: 'showroom', service: 'dealer' },
  hospital: { icon: '🏥', label: 'Hospital', color: '#e86a8a', interior: 'clinic', service: 'hospital', career: 'healthcare' },
  office_tech: { icon: '🖥️', label: 'Tech Office', color: '#4fb3e8', interior: 'office', service: 'work', career: 'tech' },
  office_finance: { icon: '📈', label: 'Finance Office', color: '#3fb88a', interior: 'office', service: 'work', career: 'finance' },
  trades: { icon: '🔧', label: 'Trades Depot', color: '#e0903c', interior: 'workshop', service: 'work', career: 'trades' },
  studio: { icon: '🎬', label: 'Creative Studio', color: '#e85ca0', interior: 'studio', service: 'work', career: 'creative' },
  station: { icon: '🚇', label: 'Transit', color: '#ffd24a', interior: null, service: 'transit' },
};
