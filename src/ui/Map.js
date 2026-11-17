// 2D city map: a pre-rendered image of the city used by the HUD minimap and
// the full-screen map (M) with district names, place icons, a waypoint and a
// GPS line that follows the streets.
import { h } from './dom.js';
import { PLACE_TYPES } from '../data/placeTypes.js';
import { taxiQuote, takeTaxi } from '../world/Transit.js';
import { fmtMoney } from '../core/utils.js';

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
    const pad = K.PROM + 30;
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
    g.fillStyle = '#353a48'; // roads
    g.fillRect(X(Math.max(lx0, -this.extent)), X(Math.max(lz0, -this.extent)), (Math.min(lx1, city.half) - Math.max(lx0, -city.half) + (w.west ? 0 : pad) + (w.east ? 0 : pad)) * PX, 0);
    g.fillRect(X(w.west ? -city.half : -this.extent), X(w.north ? -city.half : -this.extent), ((w.east ? city.half : this.extent) - (w.west ? -city.half : -this.extent)) * PX, ((w.south ? city.half : this.extent) - (w.north ? -city.half : -this.extent)) * PX);
    // blocks
    const tint = ['#4a5876', '#5a6a58', '#6a5a74', '#74604e'];
    for (const b of city.blocks) {
      g.fillStyle = b.kind === 'park' ? '#3f7a4a' : b.kind === 'landmark' ? '#8a7a5a' : tint[b.district.index % 4];
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

  setWaypoint(place) {
    this.waypoint = place ? { x: place.x, z: place.z, label: place.name, id: place.id } : null;
    this.game.events.emit('waypoint', this.waypoint);
  }

  // ---------------------------------------------------------------- full map
  isOpen() {
    return !!this.el;
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
    this.el = h('div.overlay.map-overlay', h('div.map-wrap', h('div.map-left', h('div.map-title', `🗺️ ${city.cfg.name}`), cv), side));
    const scale = size / (this.extent * 2);
    const sx = (x) => (x + this.extent) * scale;
    const draw = () => {
      const g = cv.getContext('2d');
      g.clearRect(0, 0, size, size);
      g.drawImage(this.image, 0, 0, size, size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 15px Outfit, sans-serif';
      for (const d of city.districts) {
        g.fillStyle = 'rgba(0,0,0,0.45)';
        const w = g.measureText(d.name).width + 16;
        g.beginPath();
        g.roundRect(sx(d.cx) - w / 2, sx(d.cz) - 12, w, 24, 12);
        g.fill();
        g.fillStyle = '#fff';
        g.fillText(d.name, sx(d.cx), sx(d.cz) + 1);
      }
      g.font = '17px "Segoe UI Emoji", sans-serif';
      for (const p of city.places) {
        const mine = game.state && p.id === 'home_' + game.state.home.districtId;
        if (p.type === 'home' && !mine) continue;
        g.fillText(p.icon, sx(p.x), sx(p.z));
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
    const list = () => {
      side.replaceChildren(
        h('div.map-side-title', 'Places'),
        h('div.muted.small', 'Click a place to set a GPS waypoint, or take a taxi straight there. Transit stations are cheaper.'),
        ...city.districts.map((d) =>
          h(
            'div.map-group',
            h('div.map-district', d.name),
            city.places
              .filter((p) => p.district === d && (p.type !== 'home' || (game.state && p.id === 'home_' + game.state.home.districtId)))
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
                  h('span.grow', p.type === 'home' ? 'My Home' : p.name),
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
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / scale - this.extent;
      const z = (e.clientY - r.top) / scale - this.extent;
      let best = null;
      for (const p of city.places) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < 22 && (!best || d < best.d)) best = { p, d };
      }
      this.setWaypoint(best ? best.p : null);
      draw();
      list();
    });
    draw();
    list();
    game.openOverlay(this.el, { onClose: () => (this.el = null) });
  }
}
