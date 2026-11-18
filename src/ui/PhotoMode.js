// Photo mode (H): hides the HUD, pauses the clock and frees the camera so you
// can frame a shot. Save it as a PNG, or post it to your social feed — photos
// of landmarks, city events, your dog, golden hour or snow earn more followers.
import { h, btn } from './dom.js';
import { hourOf } from '../core/Clock.js';
import { fmtNum } from '../core/utils.js';

export class PhotoMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.el = h(
      'div.photo-bar.hidden',
      h('div.photo-info', h('b', '📷 Photo mode'), (this.tagsEl = h('span.photo-tags'))),
      h('div.photo-help.muted.small', 'Drag to frame · scroll to zoom · the clock is paused'),
      h(
        'div.photo-btns',
        btn('💾 Save photo', () => this.save(), 'small'),
        (this.postBtn = btn('📲 Post', () => this.post(), 'small primary')),
        btn('✕ Exit (H)', () => this.toggle(false), 'small'),
      ),
    );
    this.flash = h('div.photo-flash');
    game.ui.append(this.el, this.flash);
  }

  toggle(on = !this.active) {
    const g = this.game;
    if (on && (g.overlays.length || g.build.active || g.fading || g.mode !== 'play')) return;
    this.active = on;
    g.hud.el.classList.toggle('photo-hide', on);
    this.el.classList.toggle('hidden', !on);
    if (on) {
      this._cam = { min: g.cam.minDist, max: g.cam.maxDist };
      g.cam.minDist = 1.2;
      g.cam.maxDist = Math.max(g.cam.maxDist, g.inside ? 10 : 24);
      this.refresh();
      g.hud.hint('photo', 'Photo mode: shots of landmarks, events, your dog, golden hour or snow get the most likes.', 8);
    } else if (this._cam) {
      g.cam.minDist = this._cam.min;
      g.cam.maxDist = this._cam.max;
      g.cam.dist = Math.min(Math.max(g.cam.dist, g.cam.minDist), g.cam.maxDist);
    }
  }

  /** What makes this shot special: { mult, tags[], caption }. */
  subject() {
    const g = this.game;
    const st = g.state;
    const p = g.player.pos;
    const ctx = g.postContext();
    const tags = [];
    const bits = [];
    let mult = 1;
    const hr = hourOf(st.time.total);
    if (ctx.landmark) {
      mult += 0.6;
      tags.push('⭐ ' + ctx.landmark);
      bits.push('at ' + ctx.landmark);
    }
    if (!g.inside) {
      for (const ev of g.cityEvents.live.values()) {
        if ((ev.spot.x - p.x) ** 2 + (ev.spot.z - p.z) ** 2 < 30 * 30) {
          mult += 0.5;
          tags.push(ev.def.icon + ' ' + ev.def.name);
          bits.push('at the ' + ev.def.name);
          break;
        }
      }
    }
    if (!g.inside && g.zooLife?.inside(p)) {
      mult += 0.4;
      tags.push('🦒 Zoo');
      bits.push('at the zoo');
    }
    if (st.pet && g.pet.active && g.pet.mesh.visible && (g.pet.pos.x - p.x) ** 2 + (g.pet.pos.z - p.z) ** 2 < 8 * 8) {
      mult += 0.35;
      tags.push('🐕 ' + st.pet.name);
      bits.push('with ' + st.pet.name + ' 🐕');
    }
    let light = null;
    if (!g.inside && ((hr >= 18.3 && hr < 20) || (hr >= 6 && hr < 7.5))) {
      mult += 0.3;
      light = 'Golden hour';
    } else if (!g.inside && (hr >= 20.5 || hr < 5)) {
      mult += 0.15;
      light = 'City lights';
    }
    if (light) tags.push(light === 'Golden hour' ? '🌅 Golden hour' : '🌃 City lights');
    const wx = g.weather.info;
    if (!g.inside && /snow/i.test(wx.label)) {
      mult += 0.25;
      tags.push('❄️ Snow');
    }
    if (ctx.inHome) {
      bits.push('home sweet home');
      tags.push('🏠 Home');
    }
    const where = g.inside ? g.inside.place.name : g.city.districtAt(p.x, p.z).name;
    const caption = (light ? light + ' ' : '') + (bits.length ? bits.join(' ') : 'in ' + where) + (light || bits.length ? '' : ' 📸');
    return { mult: Math.min(2.6, mult), tags, caption: caption[0].toUpperCase() + caption.slice(1) };
  }

  refresh() {
    const s = this.subject();
    this.tagsEl.textContent = s.tags.length ? ' · ' + s.tags.join(' · ') : '';
    const why = this.game.sim.social.postOptions({ photo: true }).photo;
    this.postBtn.disabled = !!why;
    this.postBtn.title = why || 'Share this shot';
  }

  /** Render a clean frame and download it. */
  save() {
    const g = this.game;
    g.draw(g.inside ? g.interior.scene : g.scene, g.camera);
    const url = g.renderer.domElement.toDataURL('image/png');
    const a = h('a', { href: url, download: `penny-to-penthouse-day${g.sim.day + 1}.png` });
    document.body.append(a);
    a.click();
    a.remove();
    this.shutter();
  }

  post() {
    const g = this.game;
    const s = this.subject();
    const why = g.sim.social.postOptions({ photo: true }).photo;
    if (why) return g.events.emit('toast', { icon: '📷', title: 'Not now', text: why, kind: 'warn' });
    this.shutter();
    const r = g.sim.social.post('photo', { mult: s.mult, caption: s.caption, landmark: null });
    g.events.emit('toast', { icon: '📲', title: 'Posted: "' + s.caption + '"', text: `+${fmtNum(r.gain)} followers` + (s.mult > 1.2 ? ' · great shot!' : ''), kind: 'good' });
    this.refresh();
  }

  shutter() {
    this.game.audio?.play('shutter');
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
  }
}
