// Building styles a district can use. The city generator reads these; adding a
// new style here (and referencing it from a city file) needs no engine change
// as long as it uses an existing `lots` layout.
//
// lots:    tower | grid (nx × nz) | rows (brownstone terraces) | houses
// facade:  weighted list of glass | masonry | warehouse | balcony
// heights: [min, max] in metres

export const DISTRICT_STYLES = {
  skyscraper: {
    lots: 'tower',
    heights: [55, 190],
    facade: ['glass', 'glass', 'glass', 'masonry'],
    floorH: 3.7,
    bay: 2.6,
    tiers: true,
    parkChance: 0.06,
    trees: 0.5,
    palette: ['#7fa3c7', '#5f87b0', '#8fb0c9', '#a8b9c9', '#6d8fa8', '#4f6f95', '#b5c4d1', '#3d5878', '#c9b79a', '#d8c9ae'],
  },
  midrise: {
    lots: 'grid',
    grid: [3, 2],
    heights: [16, 46],
    facade: ['masonry', 'masonry', 'glass'],
    floorH: 3.4,
    bay: 3.0,
    tiers: false,
    parkChance: 0.08,
    trees: 0.8,
    palette: ['#b8a58d', '#c9b29a', '#a39284', '#d2c4b0', '#8f9aa6', '#b0876d', '#9c6f5a', '#c7c0b4'],
  },
  brownstone: {
    lots: 'rows',
    heights: [11, 16],
    facade: ['masonry'],
    floorH: 3.3,
    bay: 2.7,
    parkChance: 0.1,
    trees: 1,
    palette: ['#7a4a38', '#8a5a44', '#6b3f30', '#9a6a50', '#a8785c', '#5f4034', '#b08968'],
  },
  beach: {
    lots: 'grid',
    grid: [2, 2],
    heights: [18, 70],
    facade: ['balcony', 'balcony', 'glass'],
    floorH: 3.3,
    bay: 3.4,
    tiers: false,
    parkChance: 0.08,
    trees: 1,
    palette: ['#f6d8c8', '#f9e7b8', '#cfe9e4', '#f7c6c0', '#d9e8f7', '#ffffff', '#fbe3d0', '#bfe3d6'],
  },
  warehouse: {
    lots: 'grid',
    grid: [2, 2],
    heights: [8, 16],
    facade: ['warehouse', 'warehouse', 'masonry'],
    floorH: 4.2,
    bay: 4.2,
    parkChance: 0.05,
    trees: 0.5,
    palette: ['#8a4b3a', '#a05a44', '#6f6f73', '#7d7468', '#93543f', '#59606b', '#e0563f', '#3a9ad9', '#f2b63c', '#5cbf8a', '#b85ccf'],
  },
  houses: {
    lots: 'houses',
    heights: [5.5, 8],
    facade: ['masonry'],
    floorH: 3.0,
    bay: 2.6,
    parkChance: 0.12,
    trees: 1,
    palette: ['#e8dcc8', '#d9c7a8', '#c8d6d0', '#e6c9b0', '#b9c7d6', '#f0e6d2', '#d4b89c', '#a9b8a0'],
    roofs: ['#7a4a3a', '#5a5f6a', '#8a5a40', '#4f5560', '#9a6a4c'],
  },
  campus: {
    lots: 'grid',
    grid: [2, 2],
    heights: [12, 34],
    facade: ['glass', 'glass', 'masonry'],
    floorH: 3.8,
    bay: 2.8,
    parkChance: 0.14,
    trees: 1,
    palette: ['#9fc0d9', '#b8d0e0', '#8ab0c8', '#dfe7ee', '#7f9fb8', '#c8b8a0'],
  },
};
