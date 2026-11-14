// Investable assets. All companies are fictional.
//  kind:  index | stock | crypto | bond
//  vol:   own daily volatility      beta: sensitivity to the whole market
//  div:   dividend / interest yield per game year (paid every 28 days)

export const ASSETS = [
  { sym: 'CITY500', name: 'City 500 Index Fund', kind: 'index', sector: 'market', price: 100, vol: 0, beta: 1, div: 0.015, desc: 'Owns a slice of every big company. Boring, diversified, hard to beat.' },
  { sym: 'BOND', name: 'Treasury Bond Fund', kind: 'bond', sector: 'bonds', price: 50, vol: 0.0012, beta: 0, div: 0.045, desc: 'Lends to the government. Tiny swings, steady interest.' },
  { sym: 'BYTE', name: 'Byteway Tech', kind: 'stock', sector: 'tech', price: 142, vol: 0.016, beta: 1.25, div: 0.004, desc: 'Cloud software giant. Grows fast, wobbles often.' },
  { sym: 'NOVA', name: 'Novacore AI', kind: 'stock', sector: 'tech', price: 61, vol: 0.03, beta: 1.6, div: 0, desc: 'Unprofitable, adored and wildly volatile.' },
  { sym: 'SUMT', name: 'Summit Bank', kind: 'stock', sector: 'finance', price: 88, vol: 0.012, beta: 1.1, div: 0.034, desc: 'Old-money bank with a dependable dividend.' },
  { sym: 'KEYS', name: 'Keystone Realty Trust', kind: 'stock', sector: 'realestate', price: 47, vol: 0.011, beta: 0.8, div: 0.055, desc: 'Owns apartment towers and passes the rent on to you.' },
  { sym: 'MERC', name: 'Mercy Health Group', kind: 'stock', sector: 'health', price: 113, vol: 0.011, beta: 0.7, div: 0.02, desc: 'Hospitals and clinics. People get sick in every economy.' },
  { sym: 'FRSH', name: 'FreshCart Markets', kind: 'stock', sector: 'consumer', price: 39, vol: 0.009, beta: 0.55, div: 0.028, desc: 'Groceries: slow, steady, recession-resistant.' },
  { sym: 'BREW', name: 'Brewly Coffee Co.', kind: 'stock', sector: 'consumer', price: 54, vol: 0.014, beta: 0.95, div: 0.012, desc: 'A café on every corner and a loyal morning crowd.' },
  { sym: 'VOLT', name: 'Voltix Energy', kind: 'stock', sector: 'energy', price: 72, vol: 0.018, beta: 1.0, div: 0.03, desc: 'Power and batteries. Rides the commodity cycle.' },
  { sym: 'APEX', name: 'Apex Motors', kind: 'stock', sector: 'auto', price: 33, vol: 0.02, beta: 1.4, div: 0.01, desc: 'Car maker: booms in good times, stalls in bad.' },
  { sym: 'GTHM', name: 'Gotham Media', kind: 'stock', sector: 'media', price: 26, vol: 0.021, beta: 1.15, div: 0, desc: 'Streaming and studios. Every hit show moves the stock.' },
  { sym: 'PNYC', name: 'PennyCoin', kind: 'crypto', sector: 'crypto', price: 420, vol: 0.06, beta: 0.9, div: 0, desc: 'Crypto. Can double or halve in a month. Only bet what you can lose.' },
];
export const ASSET_BY_SYM = Object.fromEntries(ASSETS.map((a) => [a.sym, a]));
export const SECTORS = ['tech', 'finance', 'realestate', 'health', 'consumer', 'energy', 'auto', 'media'];

// Company headlines: [good, bad]
export const HEADLINES = {
  tech: [['{n} smashes earnings on cloud demand', '{n} hit by outage and customer exodus'], ['{n} unveils breakthrough product', '{n} faces antitrust probe']],
  finance: [['{n} posts record profit as rates rise', '{n} discloses bad-loan losses'], ['{n} raises its dividend', '{n} fined over compliance failures']],
  realestate: [['{n} fills towers at record rents', '{n} warns of rising vacancies']],
  health: [['{n} wins approval for new treatment centres', '{n} sued over billing practices']],
  consumer: [['{n} reports surging same-store sales', '{n} recalls products, shoppers stay away']],
  energy: [['{n} lands giant grid-battery contract', '{n} plant shutdown dents output']],
  auto: [['{n} can’t build its new model fast enough', '{n} recalls 200,000 vehicles']],
  media: [['{n} has the hit show everyone is watching', '{n} loses subscribers for third quarter']],
  crypto: [['{n} soars as a big fund buys in', '{n} plunges after exchange hack']],
};
