// 2D city map: a pre-rendered image of the city used by the HUD minimap and
// the full-screen map (M) with district names, place icons, a waypoint and a
// GPS line that follows the streets.
import { SHOP_TYPES, SHOP_CATS, shopOpen } from '../data/shops.js';
import { h } from './dom.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { taxiQuote, takeTaxi } from '../world/Transit.js';
import { fmtMoney } from '../core/utils.js';
import { fmtHour, hourOf } from '../core/Clock.js';

const PX = 2; // pixels per metre in the static image

export class CityMap {
  constructor(game) {
    this.game = game;
    this.city = null;
    this.waypoint = null; // { x, z, label }
    this.el = null;
  }

  /** Render the static map image for a freshly generated city. */
  setCity(city) {
    this.city = city;
    this.waypoint = null;
    const K = city.K;
    const pad = Math.max(K.PROM + (city.beach ? 66 : 30), city.zoo?.rect || city.hills ? 160 : 0);
    this.extent = city.half + pad;
    const size = Math.ceil(this.extent * 2 * PX);
    const cv = (this.image = document.createElement('canvas'));
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const X = (x) => (x + this.extent) * PX;
    // land / water
    g.fillStyle = city.water.any ? '#27628a' : '#2a2f3d';
    g.fillRect(0, 0, size, size);
    const w = city.water;
    const lx0 = w.west ? -city.half - K.PROM : -this.extent;
    const lx1 = w.east ? city.half + K.PROM : this.extent;
    const lz0 = w.north ? -city.half - K.PROM : -this.extent;
    const lz1 = w.south ? city.half + K.PROM : this.extent;
    g.fillStyle = city.cfg.promenade === 'beach' ? '#d9c796' : '#8a7458';
    g.fillRect(X(lx0), X(lz0), (lx1 - lx0) * PX, (lz1 - lz0) * PX);
    // the beach: sand down to the shoreline, then the shallows
    const B = city.beach;
    if (B) {
      const rect = (d0, d1, color) => {
        const [x0, z0] = B.at(B.a0, d0);
        const [x1, z1] = B.at(B.a1, d1);
        g.fillStyle = color;
        g.fillRect(X(Math.min(x0, x1)), X(Math.min(z0, z1)), Math.abs(x1 - x0) * PX, Math.abs(z1 - z0) * PX);
      };
      rect(0, B.shoreD + 18, '#3f8fae');
      rect(0, B.shoreD, '#e6d3a3');
      const [bx, bz] = B.at(B.ac, B.shoreD / 2);
      g.font = `${16 * PX}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('🏖️', X(bx), X(bz));
    }
    g.fillStyle = '#353a48'; // roads
    g.fillRect(X(Math.max(lx0, -this.extent)), X(Math.max(lz0, -this.extent)), (Math.min(lx1, city.half) - Math.max(lx0, -city.half) + (w.west ? 0 : pad) + (w.east ? 0 : pad)) * PX, 0);
    g.fillRect(X(w.west ? -city.half : -this.extent), X(w.north ? -city.half : -this.extent), ((w.east ? city.half : this.extent) - (w.west ? -city.half : -this.extent)) * PX, ((w.south ? city.half : this.extent) - (w.north ? -city.half : -this.extent)) * PX);
    // the zoo grounds beyond the edge
    const Z = city.zoo?.rect;
    if (Z) {
      g.fillStyle = '#4f7a3a';
      g.beginPath();
      g.roundRect(X(Z[0]), X(Z[1]), (Z[2] - Z[0]) * PX, (Z[3] - Z[1]) * PX, 10);
      g.fill();
      g.font = `${22 * PX}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('🦁', X((Z[0] + Z[2]) / 2), X((Z[1] + Z[3]) / 2));
    }
    // the hiking hills: green slopes, contour rings around the summit, the trail
    const H = city.hills;
    if (H) {
      const R = H.rect;
      g.fillStyle = '#5a7f45';
      g.beginPath();
      g.roundRect(X(R[0]), X(R[1]), (R[2] - R[0]) * PX, (R[3] - R[1]) * PX, 14);
      g.fill();
      g.save();
      g.beginPath();
      g.rect(X(R[0]), X(R[1]), (R[2] - R[0]) * PX, (R[3] - R[1]) * PX);
      g.clip();
      g.strokeStyle = 'rgba(30,45,24,0.45)';
      g.lineWidth = Math.max(1, 1.2 * PX);
      for (let r = 12; r < 90; r += 13) {
        g.beginPath();
        g.ellipse(X(H.summit.x), X(H.summit.z), r * PX * 1.15, r * PX, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = '#d9b98a';
      g.setLineDash([4 * PX, 3 * PX]);
      g.lineWidth = Math.max(1.5, 2 * PX);
      g.beginPath();
      H.trail.forEach((t, i) => (i ? g.lineTo(X(t.x), X(t.z)) : g.moveTo(X(t.x), X(t.z))));
      g.stroke();
      g.setLineDash([]);
      g.font = `${20 * PX}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('🏔️', X(H.summit.x), X(H.summit.z));
    }
    // blocks
    const tint = ['#4a5876', '#5a6a58', '#6a5a74', '#74604e', '#5a6e78', '#6e5a5a'];
    for (const b of city.blocks) {
      g.fillStyle = b.kind === 'park' ? '#3f7a4a' : b.kind === 'zoo' ? '#5f8a3a' : b.kind === 'campus' ? '#8a8a6a' : b.kind === 'airport' ? '#5a6a7a' : b.kind === 'school' ? '#8a6a5a' : b.kind === 'landmark' ? '#8a7a5a' : b.kind === 'sports' ? '#3f7a8a' : b.kind === 'skate' ? '#7a7a8a' : tint[b.district.index % tint.length];
      g.beginPath();
      g.roundRect(X(b.x0), X(b.z0), K.BLOCK * PX, K.BLOCK * PX, 6);
      g.fill();
      if (b.kind === 'build') {
        g.fillStyle = 'rgba(255,255,255,0.13)';
        for (const l of b.lots) if (!l.empty) g.fillRect(X(l.x0) + 2, X(l.z0) + 2, (l.x1 - l.x0) * PX - 4, (l.z1 - l.z0) * PX - 4);
      }
    }
    // landmarks
    g.font = `${13 * PX}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const lm of city.landmarks) g.fillText('⭐', X(lm.x), X(lm.z));
  }

  /** Draw the circular minimap centred on the player (north-up). */
  /** Map filter: key places, or one kind of neighbourhood business. */
  shows(p) {
    const f = this.filter || 'key';
    return f === 'key' ? !p.minor : !!p.minor && SHOP_TYPES[p.type]?.cat === f;
  }

  drawMini(ctx, size, px, pz, heading, scale = 0.62) {
    if (!this.image) return;
    const r = size / 2;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1b2030';
    ctx.fillRect(0, 0, size, size);
    const s = scale / PX; // screen px per image px
    ctx.drawImage(this.image, r - (px + this.extent) * PX * s, r - (pz + this.extent) * PX * s, this.image.width * s, this.image.height * s);
    // place icons
    ctx.font = '13px "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.city.places) {
      const dx = (p.x - px) * scale;
      const dz = (p.z - pz) * scale;
      if (dx * dx + dz * dz > (r - 10) * (r - 10)) continue;
      ctx.font = p.minor ? '10px "Segoe UI Emoji", sans-serif' : '13px "Segoe UI Emoji", sans-serif';
      ctx.fillText(p.icon, r + dx, r + dz);
    }
    // waypoint (clamped to the rim)
    if (this.waypoint) this.drawRoute(ctx, (x) => r + (x - px) * scale, (z) => r + (z - pz) * scale, px, pz, r);
    // player arrow
    ctx.translate(r, r);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#ffb347';
    ctx.strokeStyle = '#1b1208';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * GPS line: an L-shaped street route from the player to the waypoint, snapped
   * to the nearest road centre lines.
   */
  routePoints(px, pz) {
    const c = this.city;
    const wp = this.waypoint;
    const snap = (v) => {
      let best = c.roadCenter(0);
      for (let k = 0; k <= c.N; k++) if (Math.abs(c.roadCenter(k) - v) < Math.abs(best - v)) best = c.roadCenter(k);
      return best;
    };
    const rx = snap(px); // vertical road near the player
    const rz = snap(wp.z); // horizontal road near the target
    return [
      [px, pz],
      [rx, pz],
      [rx, rz],
      [wp.x, rz],
      [wp.x, wp.z],
    ];
  }

  /**
   * District names in the clearest spot of each district: candidates on a grid
   * inside the district, scored by how much they cover icons (and each other),
   * with a gentle pull toward the district's centre.
   */
  drawDistrictLabels(g, sx, icons) {
    const city = this.game.city;
    if (!this._dBounds || this._dBoundsCity !== city) {
      this._dBoundsCity = city;
      this._dBounds = city.districts.map(() => ({ x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }));
      for (const b of city.blocks) {
        const B = this._dBounds[b.district.index];
        if (!B) continue;
        B.x0 = Math.min(B.x0, b.x0);
        B.z0 = Math.min(B.z0, b.z0);
        B.x1 = Math.max(B.x1, b.x1);
        B.z1 = Math.max(B.z1, b.z1);
      }
    }
    g.font = '700 15px Outfit, sans-serif';
    const H = 24;
    const IC = 11; // half size of an emoji icon
    const placed = [];
    const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
    for (const d of city.districts) {
      const B = this._dBounds[d.index];
      const w = g.measureText(d.name).width + 16;
      const X0 = sx(B.x0) + w / 2 - 14;
      const X1 = sx(B.x1) - w / 2 + 14;
      const Y0 = sx(B.z0) + H / 2 - 10;
      const Y1 = sx(B.z1) - H / 2 + 10;
      let best = { x: sx(d.cx), y: sx(d.cz), cost: Infinity };
      const S = 18;
      for (let gy = 0; gy <= S; gy++) {
        for (let gx = 0; gx <= S; gx++) {
          const x = X1 > X0 ? X0 + ((X1 - X0) * gx) / S : sx(d.cx);
          const y = Y1 > Y0 ? Y0 + ((Y1 - Y0) * gy) / S : sx(d.cz);
          const lx = x - w / 2 - 3;
          const ly = y - H / 2 - 3;
          let cost = Math.hypot(x - sx(d.cx), y - sx(d.cz)) * 0.3;
          for (let i = 0; i < icons.length; i += 2) cost += overlap(lx, ly, w + 6, H + 6, icons[i] - IC, icons[i + 1] - IC, IC * 2, IC * 2) * 4;
          for (const r of placed) cost += overlap(lx, ly, w + 6, H + 6, r[0], r[1], r[2], r[3]) * 8;
          if (cost < best.cost) best = { x, y, cost };
        }
      }
      placed.push([best.x - w / 2 - 3, best.y - H / 2 - 3, w + 6, H + 6]);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.roundRect(best.x - w / 2, best.y - H / 2, w, H, 12);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(d.name, best.x, best.y + 1);
    }
    // (smoke tests read how many icons a label still covers)
    let covered = 0;
    for (let i = 0; i < icons.length; i += 2) if (placed.some((r) => overlap(r[0] + 3, r[1] + 3, r[2] - 6, r[3] - 6, icons[i] - IC + 2, icons[i + 1] - IC + 2, IC * 2 - 4, IC * 2 - 4) > 0)) covered++;
    this.labelStats = { labels: placed.length, icons: icons.length / 2, covered };
    g.font = '17px "Segoe UI Emoji", sans-serif';
  }

  drawRoute(ctx, sx, sz, px, pz, clipR) {
    const pts = this.routePoints(px, pz);
    ctx.save();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(sx(x), sz(z)) : ctx.moveTo(sx(x), sz(z))));
    ctx.stroke();
    ctx.setLineDash([]);
    let wx = sx(this.waypoint.x);
    let wz = sz(this.waypoint.z);
    if (clipR) {
      const dx = wx - clipR;
      const dz = wz - clipR;
      const d = Math.hypot(dx, dz);
      if (d > clipR - 9) {
        wx = clipR + (dx / d) * (clipR - 9);
        wz = clipR + (dz / d) * (clipR - 9);
      }
    }
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(wx, wz, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /** "Happening today" rows for the map side list. */
  eventRows(game, draw, list) {
    if (!game.state) return [];
    const today = game.cityEvents.onDay(Math.floor(game.state.time.total / 1440));
    if (!today.length) return [];
    return [
      h('div.map-side-title', 'Happening today'),
      ...today.map(({ def, venue }) =>
        h(
          'div.map-place' + (this.waypoint?.id === 'event_' + def.id ? '.active' : ''),
          { onclick: () => (this.setWaypoint(game.cityEvents.waypointFor(def)), draw(), list()) },
          h('span', def.icon),
          h('span.grow', def.name),
          h('span.muted.small', `${venue.name.split(' ')[0]} · ${fmtHour(def.hours[0])}`),
        ),
      ),
    ];
  }

  setWaypoint(place) {
    this.waypoint = place ? { x: place.x, z: place.z, label: place.name, id: place.id } : null;
    this.game.events.emit('waypoint', this.waypoint);
  }

  // ---------------------------------------------------------------- full map
  isOpen() {
    return !!this.el;
  }
  /** What is at a map point: a place, a landmark, a park, the beach... or just a street in some district. */
  identify(x, z) {
    const city = this.city;
    let best = null;
    for (const p of city.places) {
      if (p.type === 'home' && !(this.game.state && p.id === 'home_' + this.game.state.home.districtId)) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 16 && (!best || d < best.d)) best = { p, d };
    }
    const district = city.districtAt(x, z);
    if (best) {
      const p = best.p;
      return { title: `${p.icon} ${p.type === 'home' ? 'My Home' : p.name}`, sub: `${PLACE_TYPES[p.type]?.label || p.type} · ${p.district?.name || district.name}`, place: p };
    }
    for (const lm of city.landmarks) if (Math.hypot(lm.x - x, lm.z - z) < 30) return { title: `⭐ ${lm.name}`, sub: `Landmark · ${district.name}` };
    const Z = city.zoo?.rect;
    if (Z && x > Z[0] && x < Z[2] && z > Z[1] && z < Z[3]) return { title: `🦁 ${city.zoo.name}`, sub: 'Zoo · tickets at the gate', place: city.zoo.place };
    const B = city.beach;
    if (B) {
      const [bx0, bz0] = B.at(B.a0, 0);
      const [bx1, bz1] = B.at(B.a1, 60);
      if (x > Math.min(bx0, bx1) && x < Math.max(bx0, bx1) && z > Math.min(bz0, bz1) && z < Math.max(bz0, bz1)) return { title: `🏖️ ${B.name}`, sub: 'Beach · swim, sunbathe, volleyball' };
    }
    const H = city.hills;
    if (H && x > H.rect[0] && x < H.rect[2] && z > H.rect[1] && z < H.rect[3]) return { title: `⛰️ ${H.name}`, sub: 'Hiking trail · a telescope at the summit', place: city.placeById.hills };
    const b = city.blocks.find((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
    const KIND = { park: '🌳 Park', sports: '🏀 Sports courts', skate: '🛹 Skate park', campus: '🎓 Campus', school: '🏫 School', airport: '✈️ Airport' };
    if (b && KIND[b.kind]) return { title: KIND[b.kind], sub: district.name };
    if (Math.abs(x) > city.half + 2 || Math.abs(z) > city.half + 2) return { title: city.water.any ? `🌊 ${city.cfg.waterName || 'The water'}` : '🌾 Open land', sub: 'Outside the city' };
    return { title: `📍 ${district.name}`, sub: b ? 'A city block' : 'A street' };
  }

  toggle() {
    if (this.el) this.game.closeOverlay(this.el);
    else this.open();
  }

  open() {
    const game = this.game;
    const city = this.city;
    const size = Math.min(window.innerHeight * 0.8, window.innerWidth * 0.56);
    const cv = h('canvas.map-canvas', { width: size, height: size });
    const side = h('div.map-side');
    const tip = h('div.map-tip');
    tip.style.display = 'none';
    this.el = h('div.overlay.map-overlay', h('div.map-wrap', h('div.map-left', h('div.map-title', `🗺️ ${city.cfg.name}`), h('div.map-canvas-wrap', cv, tip)), side));
    this.query ||= '';
    const matches = () => {
      const q = this.query.trim().toLowerCase();
      if (!q) return null;
      return city.places.filter((p) => (p.type !== 'home' || (game.state && p.id === 'home_' + game.state.home.districtId)) && `${p.name} ${PLACE_TYPES[p.type]?.label || ''} ${p.district?.name || ''}`.toLowerCase().includes(q));
    };
    const scale = size / (this.extent * 2);
    const sx = (x) => (x + this.extent) * scale;
    const draw = () => {
      const g = cv.getContext('2d');
      g.clearRect(0, 0, size, size);
      g.drawImage(this.image, 0, 0, size, size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '17px "Segoe UI Emoji", sans-serif';
      const icons = []; // screen positions of every icon drawn, so the district labels can keep clear
      for (const lm of city.landmarks) icons.push(sx(lm.x), sx(lm.z));
      for (const p of city.places) {
        const mine = game.state && p.id === 'home_' + game.state.home.districtId;
        if (p.type === 'home' && !mine) continue;
        if (p.minor && !this.shows(p)) {
          // other businesses: small dots so the streets still read as busy
          g.fillStyle = 'rgba(255,255,255,0.4)';
          g.beginPath();
          g.arc(sx(p.x), sx(p.z), 2.2, 0, Math.PI * 2);
          g.fill();
          continue;
        }
        g.fillText(p.icon, sx(p.x), sx(p.z));
        icons.push(sx(p.x), sx(p.z));
      }
      this.drawDistrictLabels(g, sx, icons);
      // search results glow on the map
      for (const p of matches() || []) {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(sx(p.x), sx(p.z), 11, 0, Math.PI * 2);
        g.stroke();
      }
      if (this.picked) {
        g.fillStyle = 'rgba(255,210,63,0.9)';
        g.beginPath();
        g.arc(sx(this.picked.x), sx(this.picked.z), 5, 0, Math.PI * 2);
        g.fill();
      }
      const pp = game.playerMapPos();
      if (this.waypoint) this.drawRoute(g, sx, sx, pp.x, pp.z, 0);
      g.save();
      g.translate(sx(pp.x), sx(pp.z));
      g.rotate(-pp.heading + Math.PI);
      g.fillStyle = '#ffb347';
      g.strokeStyle = '#1b1208';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -11);
      g.lineTo(8, 8);
      g.lineTo(0, 4);
      g.lineTo(-8, 8);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    };
    const row = (p) =>
      h(
        'div.map-place' + (this.waypoint?.id === p.id ? '.active' : ''),
        {
          onclick: () => {
            this.setWaypoint(this.waypoint?.id === p.id ? null : p);
            draw();
            list();
          },
        },
        h('span', p.icon),
        h('span.grow', p.type === 'home' ? 'My Home' : p.name, h('span.muted.small', `  · ${p.district?.name || ''}`)),
        game.state ? h('button.btn.small.taxi', { title: 'Take a taxi here', onclick: (e) => (e.stopPropagation(), takeTaxi(game, p)) }, `🚕 ${fmtMoney(taxiQuote(game, p).fare)}`) : null,
      );
    const search = h('input.map-search', { type: 'search', placeholder: '🔍 Search places: pizza, museum, Brooklyn…', value: this.query });
    search.addEventListener('input', () => {
      this.query = search.value;
      draw();
      results();
    });
    search.addEventListener('keydown', (e) => e.stopPropagation()); // typing shouldn't move you or close the map
    const found = h('div.map-results');
    const results = () => {
      const m = matches();
      found.replaceChildren(...(m ? (m.length ? [h('div.muted.small', `${m.length} found · click one to set your GPS`), ...m.slice(0, 40).map(row)] : [h('div.muted.small', 'Nothing matches.')]) : []));
    };
    const list = () => {
      results();
      side.replaceChildren(
        search,
        found,
        ...this.eventRows(game, draw, list),
        h('div.map-side-title', 'Places'),
        h('div.muted.small', 'Click a place to set a GPS waypoint, or take a taxi straight there. Transit stations are cheaper.'),
        h('div.chips.map-filter', SHOP_CATS.map(([id, text]) => h('button.chip' + ((this.filter || 'key') === id ? '.active' : ''), { onclick: () => ((this.filter = id), draw(), list()) }, text))),
        ...city.districts.map((d) =>
          h(
            'div.map-group',
            h('div.map-district', d.name),
            city.places
              .filter((p) => p.district === d && this.shows(p) && (p.type !== 'home' || (game.state && p.id === 'home_' + game.state.home.districtId)))
              .map((p) =>
                h(
                  'div.map-place' + (this.waypoint?.id === p.id ? '.active' : ''),
                  {
                    onclick: () => {
                      this.setWaypoint(this.waypoint?.id === p.id ? null : p);
                      draw();
                      list();
                    },
                  },
                  h('span', p.icon),
                  h('span.grow', p.type === 'home' ? 'My Home' : p.name, p.minor && game.state ? h('span.muted.small', shopOpen(p.type, hourOf(game.state.time.total)) ? '  · open' : '  · closed') : null),
                  game.state
                    ? h(
                        'button.btn.small.taxi',
                        {
                          title: 'Take a taxi here',
                          onclick: (e) => {
                            e.stopPropagation();
                            takeTaxi(game, p);
                          },
                        },
                        `🚕 ${fmtMoney(taxiQuote(game, p).fare)}`,
                      )
                    : h('span.muted.small', PLACE_TYPES[p.type].label),
                ),
              ),
          ),
        ),
      );
    };
    // hover shows what is under the cursor; a click names it and sets the GPS there
    const showTip = (e, info) => {
      const r = cv.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = e.clientX - r.left + 14 + 'px';
      tip.style.top = e.clientY - r.top + 10 + 'px';
      tip.replaceChildren(h('div.map-tip-title', info.title), h('div.map-tip-sub', info.sub));
    };
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) * (size / r.width) / scale - this.extent, (e.clientY - r.top) * (size / r.height) / scale - this.extent];
    };
    cv.addEventListener('mousemove', (e) => showTip(e, this.identify(...at(e))));
    cv.addEventListener('mouseleave', () => (tip.style.display = 'none'));
    cv.addEventListener('click', (e) => {
      const [x, z] = at(e);
      const info = this.identify(x, z);
      this.picked = { x, z };
      showTip(e, info);
      if (info.place) this.setWaypoint(info.place);
      game.events.emit('toast', { icon: '📍', title: info.title, text: info.sub + (info.place ? ' · GPS set' : ''), kind: 'info' });
      draw();
      list();
    });
    draw();
    list();
    game.openOverlay(this.el, { onClose: () => (this.el = null) });
  }
}
