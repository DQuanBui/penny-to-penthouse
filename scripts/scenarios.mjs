// Scripted scenarios for scripts/smoke.mjs. Each gets { page, shot, wait }.

/** Fresh storage -> title -> New Life -> random character -> in the world. */
export async function startLife(page, wait, city = 'New York', shot = null, opts = {}) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.title-menu');
  await page.click('text=New Life');
  await page.waitForSelector('.creator-panel');
  await page.click('text=🎲 Random');
  await page.click('.tab:nth-child(5)');
  await page.click('text=Choose a city');
  await page.waitForSelector('.city-panel');
  await page.click('.city-card:has-text("' + city + '")');
  await wait(400);
  if (shot) {
    await wait(1200);
    await shot('p9-cityselect');
  }
  await page.click('text=Move to');
  await page.waitForFunction(() => window.__game.mode === 'play');
  if (!opts.tutorial) {
    // skip the First Day offer and start outdoors, as the older scenarios expect
    await page.click('text=Skip — I will figure it out');
    await page.evaluate(() => window.__game.leaveInterior(true));
  }
  // software GL is slow: use the Low preset so UI animations finish before screenshots
  await page.evaluate(() => window.__game.settings.set('graphics', 'low'));
  await wait(600);
}

/** Press a key and give the (slow, software-rendered) game loop time to see it. */
export async function key(page, code, ms = 500) {
  // never press keys while a fade-to-black is still running (they are ignored by design)
  await page.waitForFunction(() => !window.__game.fading);
  await page.keyboard.down(code);
  await page.waitForTimeout(160);
  await page.keyboard.up(code);
  await page.waitForTimeout(ms);
}

export const scenarios = {
  /** Weekly city events: concert, farmers market, night market, festival. */
  async events({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.settings.set('autoQuality', false);
      g.settings.set('graphics', 'medium');
      g.weather.force = 'clear';
    });
    const visit = async (id, day, hour, name, dz = 9) => {
      const info = await page.evaluate(
        async ([id2, day2, hour2, dz2]) => {
          const g = window.__game;
          g.closeAllOverlays();
          g.state.time.total = day2 * 1440 + hour2 * 60;
          await new Promise((r) => setTimeout(r, 2500));
          const ev = g.cityEvents.live.get(id2);
          if (!ev) return { live: false, all: [...g.cityEvents.live.keys()] };
          const s = ev.spot;
          const v = ev.venue;
          const dir = Math.sign(s.z - v.z) || 1; // stand on the crowd side looking at the stage / stalls
          g.player.teleport(s.x + 3, s.z + dir * dz2, dir > 0 ? Math.PI : 0);
          g.cam.snapBehind(dir > 0 ? Math.PI + 0.2 : 0.2);
          g.cam.pitch = 0.25;
          g.cam.dist = 9;
          g.cam._init = false;
          return { live: true, venue: v.name, crowd: ev.def.crowd };
        },
        [id, day, hour, dz],
      );
      console.log(id, JSON.stringify(info));
      await wait(3500);
      await shot('event-' + name);
    };
    await visit('concert', 4, 20.5, 'concert');
    await page.evaluate(() => {
      const g = window.__game;
      const ev = g.cityEvents.live.get('concert');
      g.player.teleport(ev.spot.x, ev.spot.z + Math.sign(ev.spot.z - ev.venue.z) * 2, 0);
    });
    await page.waitForFunction(() => window.__game.interactable && /Live in the Park/.test(window.__game.interactable.label), null, { timeout: 20000 });
    await key(page, 'KeyE');
    await shot('event-concert-menu');
    const before = await page.evaluate(() => Math.round(window.__game.state.needs.fun));
    await page.locator('.btn.answer').first().click();
    await wait(1800);
    const after = await page.evaluate(() => ({ fun: Math.round(window.__game.state.needs.fun), joined: window.__game.state.stats.cityEvents }));
    console.log('concert fun', before, '->', JSON.stringify(after));
    await visit('farmers', 5, 10, 'farmers', 4);
    await visit('nightmarket', 3, 20, 'nightmarket', 2);
    await visit('festival', 6, 14, 'festival', 2);
    const news = await page.evaluate(() => window.__game.state.news.filter((n) => /today at/.test(n.title)).map((n) => n.title));
    console.log('news', JSON.stringify(news));
  },
  /** Parks and street life: playground, food cart, busker, sitting on a bench. */
  async park({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.settings.set('autoQuality', false);
      g.settings.set('graphics', 'medium');
      g.weather.force = 'clear';
      g.state.time.total = 13 * 60;
      const b = g.city.blocks.find((x) => x.kind === 'park');
      g.player.teleport(b.cx + 5, b.cz + 6, 0.7);
      g.cam.snapBehind(0.75);
      g.cam.pitch = 0.32;
      g.cam.dist = 13;
      g.cam._init = false;
    });
    await wait(2500);
    await shot('park-playground');
    const s = await page.evaluate(() => {
      const g = window.__game;
      const v = g.city.vendors[0];
      g.player.teleport(v.x + 0.2, v.z + 1.8, Math.PI);
      g.cam.snapBehind(Math.PI + 0.4);
      g.cam.pitch = 0.2;
      g.cam.dist = 6;
      g.cam._init = false;
      return { vendors: g.city.vendors.length, buskers: g.city.buskers.length };
    });
    console.log('spots', JSON.stringify(s));
    await wait(1500);
    await shot('park-cart');
    await key(page, 'KeyE');
    await page.click('text=Hot dog');
    await wait(500);
    const hunger = await page.evaluate(() => Math.round(window.__game.state.needs.hunger));
    console.log('hunger after hot dog', hunger);
    await page.evaluate(() => {
      const g = window.__game;
      const b = g.city.buskers[0];
      g.player.teleport(b.x + Math.sin(b.ry) * 1.8, b.z + Math.cos(b.ry) * 1.8, b.ry + Math.PI);
      g.cam.snapBehind(b.ry + Math.PI + 0.4);
      g.cam._init = false;
    });
    await wait(1500);
    await shot('park-busker');
    await key(page, 'KeyE');
    await page.click('text=Drop a tip');
    await wait(1200);
    // sit on a bench
    await page.evaluate(() => {
      const g = window.__game;
      console.log('overlays before bench: ' + g.overlays.map((o) => o.el.className).join(','));
      g.closeAllOverlays();
      const b = g.city.benchSpots[0];
      g.player.teleport(b.x + Math.sin(b.ry) * 0.9, b.z + Math.cos(b.ry) * 0.9, b.ry + Math.PI);
      g.cam.snapBehind(b.ry + 2.5);
      g.cam._init = false;
    });
    await page.waitForFunction(() => window.__game.interactable && window.__game.interactable.label === 'Sit on the bench', null, { timeout: 15000 });
    const label = await page.evaluate(() => {
      const g = window.__game;
      const p = g.player.pos;
      return JSON.stringify({ cur: g.interactable && g.interactable.label, found: g.findInteractable()?.label, sitting: g.player.sitting, mode: g.mode, ov: g.overlays.length, fading: g.fading, inside: !!g.inside, drive: !!g.vehicles.driving });
    });
    await key(page, 'KeyE');
    await wait(1200);
    await shot('park-bench');
    const sit = await page.evaluate(() => ({ sitting: window.__game.player.sitting, tips: window.__game.state.stats.buskerTips }));
    console.log('bench', label, JSON.stringify(sit));
    await key(page, 'KeyW');
    console.log('stood up', await page.evaluate(() => !window.__game.player.sitting));
  },
  /** Dogs on leashes, pigeons that scatter, birds overhead, ducks in a park. */
  /** City buses: running routes and pulling up at shelters. */
  async buses({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.weather.force = 'clear';
      g.state.time.total = 11 * 60;
      g.settings.set('autoQuality', false);
    });
    await wait(2000);
    const info = await page.evaluate(() => {
      const t = window.__game.traffic;
      const out = [];
      for (let i = t.bus0; i < t.n; i++) out.push({ alive: t.alive[i], x: Math.round(t.x[i]), z: Math.round(t.z[i]), sp: t.speed[i].toFixed(1) });
      return { nb: t.nb, stops: window.__game.city.busStops.length, buses: out };
    });
    console.log('buses', JSON.stringify(info));
    // software rendering runs the sim slowly: put a bus 24 m before a stop on its route
    await page.evaluate(() => {
      const g = window.__game;
      const t = g.traffic;
      const c = g.city;
      const i = t.bus0;
      const [fi, fj, ti, tj] = [...t.stopSegs][3].split(',').map(Number);
      const hx = ti - fi;
      const hz = tj - fj;
      const s = c.busStops.find((b) => (hx ? Math.abs(b.z - c.roadCenter(tj)) < 9 && (b.x - c.roadCenter(fi)) * hx > 0 && (b.x - c.roadCenter(ti)) * hx < 0 : Math.abs(b.x - c.roadCenter(ti)) < 9 && (b.z - c.roadCenter(fj)) * hz > 0 && (b.z - c.roadCenter(tj)) * hz < 0));
      t.hx[i] = hx;
      t.hz[i] = hz;
      t.ti[i] = ti;
      t.tj[i] = tj;
      t.x[i] = hx ? s.x - hx * 24 : c.roadCenter(ti) - hz * 1.75;
      t.z[i] = hz ? s.z - hz * 24 : c.roadCenter(tj) + hx * 1.75;
      t.ry[i] = Math.atan2(hx, hz);
      t.turnT[i] = 0;
      t.alive[i] = 1;
      t.lastStop[i] = -1;
      g.player.teleport(s.x, s.z, 0);
    });
    // follow the first bus until it dwells at a stop
    let stopped = null;
    for (let k = 0; k < 60 && !stopped; k++) {
      stopped = await page.evaluate(() => {
        const g = window.__game;
        const t = g.traffic;
        for (let i = t.bus0; i < t.n; i++) {
          if (t.alive[i] && t.dwell[i] > 0) {
            const ry = t.ry[i];
            // stand on the pavement ahead of the bus, looking back at it
            const side = -1;
            g.player.teleport(t.x[i] + Math.sin(ry) * 12 + Math.cos(ry) * side * -4.5, t.z[i] + Math.cos(ry) * 12 - Math.sin(ry) * side * -4.5, ry + Math.PI);
            g.cam.snapBehind(ry + Math.PI + 0.5);
            g.cam.pitch = 0.1;
            g.cam._init = false;
            return { i, dwell: t.dwell[i].toFixed(1), stop: t.lastStop[i] };
          }
        }
        return null;
      });
      if (!stopped) await wait(1000);
    }
    console.log('dwelling', JSON.stringify(stopped));
    await wait(700);
    await shot('bus-stop');
  },
  /** Photo mode: hide the HUD, frame a landmark at golden hour with your dog, post and save. */
  async photo({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.weather.force = 'clear';
      g.state.time.total = 19 * 60;
      g.sim.pets.adopt(g.sim.pets.available()[1], 'Scout', true);
      const lm = g.city.landmarks[0];
      g.player.teleport(lm.x + 30, lm.z + 30, -2.35);
      g.syncPet();
      g.cam.snapBehind(-2.35);
      g.cam.pitch = 0.05;
    });
    await wait(1500);
    await key(page, 'KeyH', 800);
    const s = await page.evaluate(() => ({ active: window.__game.photoMode.active, hudHidden: getComputedStyle(document.querySelector('.hud')).display === 'none', tags: document.querySelector('.photo-tags').textContent, followers: window.__game.state.social.followers }));
    console.log('photo mode', JSON.stringify(s));
    await shot('photo-mode');
    await page.click('.photo-bar button:has-text("Post")');
    await wait(500);
    const post = await page.evaluate(() => ({ followers: window.__game.state.social.followers, last: window.__game.state.social.posts[0] }));
    console.log('posted', JSON.stringify(post));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('.photo-bar button:has-text("Save photo")')]);
    console.log('download', dl.suggestedFilename());
    await key(page, 'Escape', 500);
    console.log('after exit', await page.evaluate(() => ({ active: window.__game.photoMode.active, paused: !!document.querySelector('.overlay') })));
  },
  /** Interiors: skyline windows by day and night, curtains, wall clock, door frame. */
  async rooms({ page, shot, wait }) {
    await startLife(page, wait);
    const look = async (name, hour, yaw, pitch = 0.5) => {
      await page.evaluate(
        ([hr, yw, pt]) => {
          const g = window.__game;
          g.state.time.total = Math.floor(g.state.time.total / 1440) * 1440 + hr * 60;
          const L = g.inside.layout;
          g.player.teleport(L.w / 2, L.d - 1.6, Math.PI);
          g.cam.yaw = yw;
          g.cam.pitch = pt;
          g.cam.dist = 6;
          g.cam._init = false;
        },
        [hour, yaw, pitch],
      );
      await wait(1500);
      await shot(name);
    };
    await page.evaluate(() => {
      const g = window.__game;
      g.weather.force = 'clear';
      g.state.home.type = 'apartment';
      g.state.home.layout = null;
      g.enterPlace(g.homePlace(), true);
    });
    await wait(800);
    await look('rooms-home-day', 13, 0.35);
    await look('rooms-home-night', 22, -0.6);
    const clock = await page.evaluate(() => {
      const c = window.__game.interior.clock;
      return c ? { hour: c.hourH.rotation.x.toFixed(2), min: c.minH.rotation.x.toFixed(2) } : null;
    });
    console.log('clock', JSON.stringify(clock));
    await page.evaluate(() => {
      const g = window.__game;
      g.leaveInterior(true);
      g.enterPlace(g.city.places.find((p) => p.type === 'restaurant'), true);
    });
    await wait(800);
    await look('rooms-restaurant', 19.5, 0.2, 0.45);
  },
  /** HUD: need meters, compass with waypoint, pet chip, toasts. */
  async hud({ page, shot, wait }) {
    await startLife(page, wait);
    const r = await page.evaluate(() => {
      const g = window.__game;
      g.weather.force = 'clear';
      g.state.time.total = 15 * 60;
      g.state.needs.hunger = 12;
      const cafe = g.city.places.find((p) => p.type === 'cafe');
      g.map.setWaypoint ? g.map.setWaypoint(cafe) : (g.map.waypoint = { x: cafe.x, z: cafe.z, label: cafe.name, id: cafe.id });
      // look straight at the café
      const p = g.player.pos;
      const h = Math.atan2(cafe.x - p.x, cafe.z - p.z);
      g.player.teleport(p.x, p.z, h);
      g.cam.snapBehind(h);
      g.sim.pets.adopt(g.sim.pets.available()[0], 'Mochi', true);
      g.events.emit('toast', { icon: '🧪', title: 'Toast test', text: 'Click me to dismiss.', kind: 'info' });
      return { way: g.map.waypoint && g.map.waypoint.label };
    });
    await wait(1200);
    const m = await page.evaluate(() => {
      const el = document.querySelector('.compass-mark.way');
      const c = document.querySelector('.compass');
      const a = el.getBoundingClientRect();
      const b = c.getBoundingClientRect();
      return { text: el.textContent, offsetFromCentre: Math.round(a.left + a.width / 2 - (b.left + b.width / 2)), hidden: el.classList.contains('hidden'), lowPips: document.querySelectorAll('.pip.low').length, pet: document.querySelector('.pet-chip').textContent };
    });
    console.log('hud', JSON.stringify(r), JSON.stringify(m));
    await shot('hud-compass');
    await page.click('.toast');
    await wait(600);
    console.log('toasts left', await page.evaluate(() => document.querySelectorAll('.toast:not(.out)').length));
  },
  /** Pet rescue: adopt a dog, it follows you, waits outside shops, plays fetch. */
  async pets({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.weather.force = 'clear';
      g.state.time.total = 11 * 60;
      g.state.money.checking = 2000;
      const pl = g.city.places.find((p) => p.type === 'shelter');
      g.placePlayerAt(pl);
      g.player.teleport(pl.x + pl.nx * 5, pl.z + pl.nz * 5, Math.atan2(-pl.nx, -pl.nz));
      g.cam.snapBehind(Math.atan2(-pl.nx, -pl.nz));
      g.cam.pitch = 0.15;
    });
    await wait(1500);
    await shot('pets-rescue-front');
    await page.evaluate(() => window.__game.enterPlace(window.__game.city.places.find((p) => p.type === 'shelter'), true));
    await wait(1200);
    await page.evaluate(() => {
      const g = window.__game;
      const c = g.interior.points.find((p) => p.use === 'service');
      g.player.teleport(c.x, c.z + 1.2, Math.PI);
      g.cam.snapBehind(Math.PI + 0.5);
      g.cam.pitch = 0.45;
    });
    await wait(800);
    await shot('pets-rescue-inside');
    await page.waitForFunction(() => window.__game.interactable && /counter/.test(window.__game.interactable.label));
    await page.evaluate(() => window.__game.interactable.action());
    await page.waitForSelector('.dialog .slot');
    await wait(400);
    await shot('pets-adopt');
    await page.locator('.dialog .slot input.text').first().fill('Biscuit');
    await page.locator('.dialog .slot button:has-text("Adopt")').first().click();
    await wait(400);
    await shot('pets-adopted');
    const s1 = await page.evaluate(() => ({ pet: window.__game.state.pet, active: window.__game.pet.active }));
    console.log('adopted', JSON.stringify(s1));
    await key(page, 'Escape');
    await page.evaluate(() => window.__game.leaveInterior(true));
    await wait(500);
    // walk with the dog
    await page.keyboard.down('KeyW');
    await wait(3500);
    await page.keyboard.up('KeyW');
    await wait(1500);
    const s2 = await page.evaluate(() => {
      const g = window.__game;
      const d = Math.hypot(g.pet.pos.x - g.player.pos.x, g.pet.pos.z - g.player.pos.z);
      g.cam.snapBehind(g.player.heading + 2.4);
      g.cam.pitch = 0.2;
      g.cam.dist = 4;
      return { dist: d.toFixed(2), walked: g.state.pet.walked.toFixed(1), visible: g.pet.mesh.visible };
    });
    console.log('after walk', JSON.stringify(s2));
    await wait(800);
    await shot('pets-heel');
    // turn around to face the dog -> prompt
    await page.evaluate(() => {
      const g = window.__game;
      const h = Math.atan2(g.pet.pos.x - g.player.pos.x, g.pet.pos.z - g.player.pos.z);
      g.player.teleport(g.player.pos.x, g.player.pos.z, h);
    });
    await page.waitForFunction(() => window.__game.interactable && /Play with/.test(window.__game.interactable.label), null, { timeout: 8000 });
    await page.evaluate(() => window.__game.interactable.action());
    await page.waitForSelector('.dialog:has-text("Play fetch")');
    await wait(300);
    await shot('pets-dialog');
    await page.click('text=Play fetch');
    await wait(700);
    await page.evaluate(() => {
      const g = window.__game;
      g.cam.snapBehind(g.player.heading + 0.9);
      g.cam.dist = 7;
    });
    await wait(500);
    await shot('pets-fetch');
    await page.waitForFunction(() => !window.__game.pet.fetch, null, { timeout: 20000 });
    const s3 = await page.evaluate(() => ({ happy: window.__game.state.pet.happy, mode: window.__game.pet.mode }));
    console.log('after fetch', JSON.stringify(s3));
    // shops: the dog waits by the door
    await page.evaluate(() => {
      const g = window.__game;
      const cafe = g.city.places.find((p) => p.type === 'cafe');
      g.placePlayerAt(cafe);
      g.enterPlace(cafe, true);
    });
    await wait(500);
    const s4 = await page.evaluate(() => ({ mode: window.__game.pet.mode, inScene: window.__game.pet.mesh.parent === window.__game.scene }));
    await page.evaluate(() => window.__game.leaveInterior(true));
    await wait(1500);
    await page.evaluate(() => {
      const g = window.__game;
      g.cam.snapBehind(g.player.heading + Math.PI);
      g.cam.pitch = 0.2;
    });
    await wait(600);
    await shot('pets-waited');
    // home: the dog comes inside
    await page.evaluate(() => window.__game.enterPlace(window.__game.homePlace(), true));
    await wait(2000);
    const s5 = await page.evaluate(() => ({ inHome: window.__game.pet.mesh.parent === window.__game.interior.scene, mode: window.__game.pet.mode }));
    await shot('pets-home');
    console.log('shop', JSON.stringify(s4), 'home', JSON.stringify(s5));
  },
  async animals({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.settings.set('autoQuality', false);
      g.settings.set('graphics', 'medium');
      g.weather.force = 'clear';
      g.state.time.total = 10 * 60;
    });
    await wait(4000);
    // follow a dog walker
    const dog = await page.evaluate(() => {
      const g = window.__game;
      const cr = g.crowd;
      for (let k = 0; k < 40; k++) {
        const a = k * 8 + 3;
        if (cr.alive[a] && cr.cur[a] > 0) {
          const ry = cr.ry[a];
          g.player.teleport(cr.x[a] + Math.sin(ry) * 6 + Math.cos(ry) * 2.5, cr.z[a] + Math.cos(ry) * 6 - Math.sin(ry) * 2.5, ry + Math.PI);
          g.cam.snapBehind(ry + Math.PI - 0.5);
          g.cam.pitch = 0.12;
          g.cam.dist = 5;
          g.cam._init = false;
          return k;
        }
      }
      return -1;
    });
    console.log('dog walker', dog);
    await wait(1500);
    await shot('animals-dog');
    // walk into a pigeon flock
    const fl = await page.evaluate(() => {
      const g = window.__game;
      const an = g.animals;
      const f = an.flock.findIndex((x) => x.state === 'ground');
      if (f < 0) return null;
      const F = an.flock[f];
      g.player.teleport(F.x + 6, F.z, -Math.PI / 2);
      g.cam.snapBehind(-Math.PI / 2);
      g.cam.pitch = 0.2;
      g.cam._init = false;
      return f;
    });
    console.log('flock', fl);
    await wait(1200);
    await shot('animals-pigeons');
    await page.keyboard.down('KeyW');
    await wait(2400);
    await page.keyboard.up('KeyW');
    await wait(500);
    await shot('animals-pigeons-fly');
    const st = await page.evaluate((f) => window.__game.animals.flock[f].state, fl);
    console.log('flock state after approach', st);
    // park with ducks, looking up at birds
    await page.evaluate(() => {
      const g = window.__game;
      const b = g.animals.parks[0];
      g.player.teleport(b.cx + 4.5, b.cz + 1.5, -Math.PI / 2);
      g.cam.snapBehind(-Math.PI / 2 + 0.3);
      g.cam.pitch = 0.35;
      g.cam.dist = 6;
      g.cam._init = false;
    });
    await wait(2000);
    await shot('animals-ducks');
  },
  /** Photograph storefronts of several place types, day and night. */
  async fronts({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.settings.set('autoQuality', false);
      g.settings.set('graphics', 'medium');
      g.weather.force = 'clear';
      g.state.time.total = 15 * 60;
    });
    const look = async (type, name, tod) => {
      const ok = await page.evaluate(([t, tod2]) => {
        const g = window.__game;
        const p = g.city.places.find((q) => q.type === t);
        if (!p) return false;
        if (tod2) g.state.time.total = tod2 * 60;
        const ry = Math.atan2(p.nx, p.nz);
        // stand across the sidewalk and look back at the facade
        g.player.teleport(p.x + p.nx * 7.5 + p.nz * 2.5, p.z + p.nz * 7.5 - p.nx * 2.5, ry + Math.PI);
        g.cam.snapBehind(ry + Math.PI);
        g.cam.yaw = ry - 0.25;
        g.cam.pitch = 0.08;
        g.cam.dist = 7;
        g.cam._init = false;
        return true;
      }, [type, tod]);
      if (!ok) return console.log('no place', type);
      await wait(2600);
      await shot('front-' + name);
    };
    await look('cafe', 'cafe');
    await look('bank', 'bank');
    await look('office_finance', 'finance');
    await look('clothing', 'clothing');
    await look('mall', 'mall');
    await look('restaurant', 'restaurant-night', 21);
    await look('bar', 'bar-night', 22);
    await look('electronics', 'electronics-night', 21);
    // mall interior + counters
    await page.evaluate(() => {
      const g = window.__game;
      g.state.time.total = 13 * 60;
      g.enterPlace(g.city.places.find((q) => q.type === 'mall'));
    });
    await wait(1800);
    const pts = await page.evaluate(() => window.__game.interior.points.filter((p) => p.use === 'service').map((p) => p.label));
    console.log('mall counters', JSON.stringify(pts));
    await shot('mall-inside');
  },
  /** Close-ups of procedural characters (face, body, outfits). */
  async faces({ page, shot, wait }) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.title-menu');
    await page.click('text=New Life');
    await page.waitForSelector('.creator-panel');
    await wait(900);
    await shot('char-body');
    await page.click('.tab:nth-child(2)');
    await wait(1400);
    await shot('char-face');
    for (let i = 0; i < 3; i++) {
      await page.click('text=🎲 Random');
      await wait(900);
      await shot('char-face-' + i);
    }
    await page.click('.tab:nth-child(3)');
    await wait(1200);
    await page.evaluate(() => {
      const c = window.__game.creator;
      c.spin = Math.PI;
      c.spinVel = 0;
    });
    await wait(300);
    await shot('char-back');
  },
  /** Busy streets: crowd density, signal waiting, pauses (Medium preset). */
  async crowd({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.settings.set('autoQuality', false);
      g.settings.set('graphics', 'medium');
      g.state.time.total = 12.5 * 60;
      g.weather.force = 'clear';
      // stand at a sidewalk corner of an inner block, looking down the street
      const c = g.city;
      const x = c.blockMin(3) + 2.6;
      const z = c.blockMin(3) + 2.6;
      g.player.teleport(x + 1, z + 6, Math.PI);
      g.cam.snapBehind(Math.PI + 0.35);
      g.cam.pitch = 0.18;
      g.cam.dist = 8;
    });
    await wait(9000);
    await shot('crowd-noon');
    const info = await page.evaluate(() => {
      const g = window.__game;
      const cr = g.crowd;
      let alive = 0;
      let waiting = 0;
      let paused = 0;
      let near = 0;
      for (let i = 0; i < cr.n; i++) {
        if (!cr.alive[i]) continue;
        alive++;
        if (cr.cur[i] === 0 && cr.waitSig[i]) waiting++;
        if (cr.pause[i] > 0) paused++;
        if (Math.hypot(cr.x[i] - g.player.pos.x, cr.z[i] - g.player.pos.z) < 60) near++;
      }
      return { n: cr.n, alive, near60m: near, waitingAtSignal: waiting, paused, rigs: cr.rigs.filter((r) => r.agent >= 0).length, calls: g.renderer.info.render.calls };
    });
    console.log('crowd', JSON.stringify(info));
    await page.evaluate(() => (window.__game.state.time.total = 21.5 * 60));
    await wait(4000);
    await shot('crowd-night');
  },
  /** Cars are solid: walking into a parked car, into traffic, and driving into a car. */
  async collide({ page, shot, wait }) {
    await startLife(page, wait);
    const setup = await page.evaluate(() => {
      const g = window.__game;
      g.state.money.checking = 80000;
      g.sim.garage.buy('metro', '#c53a3a', 'cash');
      g.sim.garage.buy('dart', '#3f5f8a', 'cash');
      g.vehicles.sync();
      const [a, b] = [...g.vehicles.cars.values()];
      // second car parked 7 m behind the first, same lane
      const ga = a.group;
      b.v.pos = { x: ga.position.x - Math.sin(ga.rotation.y) * 7, z: ga.position.z - Math.cos(ga.rotation.y) * 7, ry: ga.rotation.y };
      g.vehicles.sync();
      // stand 4 m to the side of car A, facing it
      const rx = Math.cos(ga.rotation.y);
      const rz = -Math.sin(ga.rotation.y);
      const sx = ga.position.x + rx * 4;
      const sz = ga.position.z + rz * 4;
      const head = Math.atan2(-rx, -rz);
      g.player.teleport(sx, sz, head);
      g.cam.snapBehind(head);
      g.cam._init = false;
      return { car: [ga.position.x, ga.position.z], start: [sx, sz] };
    });
    await page.keyboard.down('KeyW');
    await wait(3500);
    await page.keyboard.up('KeyW');
    await shot('fix-walk-into-car');
    const walk = await page.evaluate(([cx, cz]) => {
      const g = window.__game;
      return { distToCarCentre: +Math.hypot(g.player.pos.x - cx, g.player.pos.z - cz).toFixed(2) };
    }, setup.car);
    console.log('walk into parked car', JSON.stringify(walk), walk.distToCarCentre > 1.1 ? 'OK (blocked)' : 'FAIL (walked through)');
    // drive car A backwards into car B
    await page.evaluate(() => {
      const g = window.__game;
      const a = [...g.vehicles.cars.values()][0];
      g.vehicles.enter(a);
    });
    await page.keyboard.down('KeyS');
    await wait(4000);
    await page.keyboard.up('KeyS');
    const drive = await page.evaluate(() => {
      const g = window.__game;
      const [a, b] = [...g.vehicles.cars.values()];
      return { gap: +Math.hypot(a.group.position.x - b.group.position.x, a.group.position.z - b.group.position.z).toFixed(2) };
    });
    console.log('reverse into parked car', JSON.stringify(drive), drive.gap > 4.2 ? 'OK (blocked)' : 'FAIL (overlap)');
    await shot('fix-drive-into-car');
    // walk into a traffic car
    await page.evaluate(() => {
      const g = window.__game;
      g.vehicles.exit(true);
    });
    const t = await page.evaluate(() => {
      const g = window.__game;
      const tr = g.traffic;
      let best = -1;
      for (let i = 0; i < tr.n; i++) if (tr.alive[i] && (best < 0 || Math.hypot(tr.x[i] - g.player.pos.x, tr.z[i] - g.player.pos.z) < Math.hypot(tr.x[best] - g.player.pos.x, tr.z[best] - g.player.pos.z))) best = i;
      // freeze it and put the player right inside it
      tr.max[best] = 0;
      tr.speed[best] = 0;
      g.player.teleport(tr.x[best] + 0.2, tr.z[best] + 0.1, 0);
      return best;
    });
    await wait(600);
    const inside = await page.evaluate((i) => {
      const g = window.__game;
      return +Math.hypot(g.player.pos.x - g.traffic.x[i], g.player.pos.z - g.traffic.z[i]).toFixed(2);
    }, t);
    console.log('player inside traffic car pushed out to', inside, inside > 1.1 ? 'OK' : 'FAIL');
  },
  /** Phase 12: post-processing on Medium, audio engine running, dev debug panel. */
  async polish({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.settings.set('autoQuality', false);
      g.settings.set('graphics', 'medium');
      g.state.time.total = 19.2 * 60;
      const lm = g.city.landmarks[0];
      g.player.teleport(lm.x + 36, lm.z + 36, -2.3);
      g.cam.snapBehind(-2.3);
      g.cam.pitch = 0.05;
    });
    await wait(4000);
    await shot('p12-sunset-fx');
    await page.evaluate(() => (window.__game.state.time.total = 22.5 * 60));
    await wait(4000);
    await shot('p12-night-fx');
    await page.keyboard.down('KeyW');
    await wait(2500);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('F1');
    await wait(500);
    await shot('p12-debug');
    await page.click('.dbg >> text=+$50,000');
    await page.click('.dbg >> text=Max skills');
    await page.keyboard.press('F1');
    const info = await page.evaluate(() => {
      const g = window.__game;
      return { audio: g.audio.ctx && g.audio.ctx.state, music: !!g.audio.music, fx: g.postfx.enabled, cash: g.state.money.checking, coding: g.state.skills.coding, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
    });
    console.log('info', JSON.stringify(info));
  },
  /** Phase 11: buy a car at the dealer, drive it, park it, traffic on the roads. */
  async drive({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.state.money.checking = 60000;
      g.state.time.total = 9 * 60;
      g.enterPlace(g.city.placeById.dealer);
    });
    await wait(1600);
    await page.evaluate(() => {
      const g = window.__game;
      g.npcs.clearIndoor();
      const pt = g.interior.points.find((p) => p.use === 'service');
      g.player.teleport(pt.x, pt.z, Math.PI);
    });
    await wait(400);
    await key(page, 'KeyE');
    await shot('p11-dealer');
    await page.locator('.card.job').nth(1).locator('.btn.primary').click();
    await wait(400);
    await page.evaluate(() => window.__game.leaveInterior());
    await wait(1500);
    const car = await page.evaluate(() => {
      const g = window.__game;
      const c = [...g.vehicles.cars.values()][0];
      const p = c.group.position;
      g.player.teleport(p.x + 2.4, p.z, 0);
      g.cam.snapBehind(c.group.rotation.y + 0.5);
      return { cars: g.state.vehicles.length, cash: g.state.money.checking, pos: [Math.round(p.x), Math.round(p.z)], traffic: g.traffic.alive.reduce((a, b) => a + b, 0) };
    });
    console.log('bought', JSON.stringify(car));
    await wait(700);
    await shot('p11-car');
    await key(page, 'KeyF');
    await page.keyboard.down('KeyW');
    await wait(3500);
    await shot('p11-driving');
    await page.keyboard.down('KeyA');
    await wait(900);
    await page.keyboard.up('KeyA');
    await wait(1200);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await wait(2500);
    await page.keyboard.up('KeyS');
    const d = await page.evaluate(() => {
      const g = window.__game;
      const c = g.vehicles.driving;
      return c ? { speed: +c.speed.toFixed(1), pos: [Math.round(c.group.position.x), Math.round(c.group.position.z)], onRoad: g.vehicles.onRoad(c.group.position.x, c.group.position.z) } : null;
    });
    console.log('driving', JSON.stringify(d));
    await page.evaluate(() => window.__game.vehicles.driving && (window.__game.vehicles.driving.speed = 0));
    await key(page, 'KeyF');
    const e = await page.evaluate(() => {
      const g = window.__game;
      const v = g.state.vehicles[0];
      return { driving: !!g.vehicles.driving, parked: v.pos && [Math.round(v.pos.x), Math.round(v.pos.z)], playerOnKerb: g.city.groundY(g.player.pos.x, g.player.pos.z) > 0, bills: g.sim.finance.monthlyBills().map((b) => b.label.split(' — ')[0]) };
    });
    console.log('parked', JSON.stringify(e));
    await page.evaluate(() => {
      const g = window.__game;
      g.state.time.total = 21 * 60;
      g.cam.pitch = 0.25;
    });
    await wait(2500);
    await shot('p11-night-traffic');
  },
  /** Phase 10: tutorial, life events, Goals / Rankings / Calendar apps, achievements. */
  async life({ page, shot, wait }) {
    await startLife(page, wait, 'Austin', null, { tutorial: true });
    await wait(600);
    await shot('p10-tutorial-offer');
    await page.click('text=Start "First Day"');
    await wait(500);
    const s0 = await page.evaluate(() => ({ inside: !!window.__game.inside, step: window.__game.state.flags.tutorial.step, obj: window.__game.tutorial.objective() }));
    console.log('start', JSON.stringify(s0));
    await page.keyboard.down('KeyW');
    await wait(2500);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await wait(2500);
    await page.keyboard.up('KeyS');
    await wait(600);
    await shot('p10-step-phone');
    await key(page, 'Tab');
    await page.click('.app-icon:has-text("Goals")');
    await wait(300);
    await shot('p10-goals');
    await page.click('.seg-btn:has-text("Achievements")');
    await wait(200);
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Rankings")');
    await wait(300);
    await shot('p10-rankings');
    await page.click('.seg-btn:has-text("National")');
    await page.click('.chip:has-text("Popularity")');
    await page.click('.seg-btn:has-text("Hall of Fame")');
    await wait(200);
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Calendar")');
    await wait(300);
    await shot('p10-calendar');
    await key(page, 'Escape');
    const s1 = await page.evaluate(() => {
      const g = window.__game;
      const out = { step: g.state.flags.tutorial.step, waypoint: g.map.waypoint && g.map.waypoint.label };
      g.sim.events.trigger('inheritance');
      g.state.time.total = Math.floor(g.state.time.total / 1440) * 1440 + 11 * 60;
      return out;
    });
    console.log('after phone', JSON.stringify(s1));
    await page.waitForSelector('.event-text', { timeout: 15000 });
    await wait(400);
    await shot('p10-event');
    await page.locator('.btn.answer').nth(1).click();
    await wait(300);
    await shot('p10-event-result');
    await page.click('text=Continue');
    const s2 = await page.evaluate(() => {
      const g = window.__game;
      g.sim.advance(1440 * 30, { noDecay: true, noCollapse: true });
      return { holdings: Object.keys(g.state.portfolio.holdings), ach: Object.keys(g.state.achievements), events: g.state.stats.eventsSeen, pending: g.state.events.pending && g.state.events.pending.id, rank: g.sim.rankings.rank('netWorth', 'city') };
    });
    console.log('month later', JSON.stringify(s2));
  },
  /** Phase 9: city select, every city generates, weather, transit and taxi. */
  async cities({ page, shot, wait }) {
    for (const [name, id] of [['Los Angeles', 'la'], ['Chicago', 'chi'], ['Miami', 'mia'], ['Austin', 'aus']]) {
      await startLife(page, wait, name, id === 'la' ? shot : null);
      const info = await page.evaluate(() => {
        const g = window.__game;
        const lm = g.city.landmarks[0];
        g.player.teleport(lm.x + 34, lm.z + 34, -2.3);
        g.cam.snapBehind(-2.3);
        g.cam.pitch = 0.12;
        g.state.time.total = 12 * 60;
        return { city: g.city.cfg.id, places: g.city.places.length, landmarks: g.city.landmarks.map((l) => l.name), npcs: g.npcs.list.length, rent: g.state.home.rent };
      });
      console.log(JSON.stringify(info));
      await wait(1800);
      await shot('p9-' + id);
    }
    // Chicago winter: find a snowy and a rainy block
    await startLife(page, wait, 'Chicago');
    const found = await page.evaluate(() => {
      const g = window.__game;
      const out = {};
      for (let d = 84; d < 112 && !out.snow; d++) {
        g.state.time.total = d * 1440 + 13 * 60;
        g.weather.update(0, g.city.cfg, g.state.time.total, g.camera.position, true);
        if (g.weather.kind === 'snow') out.snow = d;
      }
      return out;
    });
    console.log('snow day', JSON.stringify(found));
    await wait(5000);
    await shot('p9-snow');
    await page.evaluate(() => {
      const g = window.__game;
      for (let d = 0; d < 60; d++) {
        g.state.time.total = d * 1440 + 13 * 60;
        g.weather.update(0, g.city.cfg, g.state.time.total, g.camera.position, true);
        if (g.weather.kind === 'rain') break;
      }
    });
    await wait(5000);
    await shot('p9-rain');
    // transit
    await page.evaluate(() => {
      const g = window.__game;
      const s = g.city.places.find((p) => p.station);
      g.placePlayerAt(s);
    });
    await wait(500);
    await key(page, 'KeyE');
    await shot('p9-station');
    const before = await page.evaluate(() => window.__game.locationLabel());
    await page.locator('.menu-col .btn').first().click();
    await wait(1500);
    const after = await page.evaluate(() => ({ at: window.__game.locationLabel(), cash: window.__game.state.money.checking }));
    console.log('transit', before, '->', JSON.stringify(after));
    await key(page, 'KeyM');
    await shot('p9-map');
    await page.locator('.btn.taxi').nth(3).click();
    await wait(1500);
    console.log('taxi ->', await page.evaluate(() => window.__game.locationLabel() + ' $' + window.__game.state.money.checking));
  },
  /** Phase 8: build mode — place, rotate, move, store, undo; renovate an owned two-storey home. */
  async build({ page, shot, wait }) {
    await startLife(page, wait);
    const toScreen = (x, z) =>
      page.evaluate(
        ([wx, wz]) => {
          const g = window.__game;
          const v = new g.build.point.constructor(wx, 0, wz).project(g.build.camera);
          return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
        },
        [x, z],
      );
    const clickAt = async (x, z) => {
      const [sx, sy] = await toScreen(x, z);
      await page.mouse.move(sx, sy);
      await wait(250);
      await page.mouse.down();
      await page.mouse.up();
      await wait(350);
    };
    await page.evaluate(() => {
      const g = window.__game;
      g.state.money.checking = 30000;
      g.enterPlace(g.homePlace());
    });
    await wait(1500);
    await key(page, 'KeyB');
    await wait(600);
    await shot('p8-build');
    await page.click('.chip:has-text("Sofas")');
    await page.click('.build-item:has-text("Loveseat")');
    await clickAt(2.5, 3.5);
    await page.click('.chip:has-text("Plants")');
    await page.click('.build-item:has-text("Fiddle")');
    await clickAt(4.5, 4.4);
    await page.click('.build-bar >> text=Cancel');
    await page.click('.chip:has-text("Decor")');
    await page.click('.build-item:has-text("Framed Print")');
    await clickAt(2.5, 0.2);
    await page.click('.build-bar >> text=Cancel');
    await wait(300);
    await shot('p8-furnished');
    await page.click('.seg-btn:has-text("Renovate")');
    await wait(200);
    await shot('p8-renter');
    await page.click('text=Done');
    await wait(900);
    const a = await page.evaluate(() => ({ style: window.__game.state.home.styleScore, items: window.__game.state.home.layout.items.length, cash: Math.round(window.__game.state.money.checking) }));
    console.log('rented', JSON.stringify(a));
    await shot('p8-after');
    // own a two-storey home
    await page.evaluate(() => {
      const g = window.__game;
      const st = g.state;
      st.money.checking = 900000;
      g.leaveInterior(true);
      const ls = st.listings.find((l) => l.type === 'townhouse');
      g.sim.re.buy(ls.id, { downPct: 1, years: 30, use: 'live' });
    });
    await wait(1800);
    await page.evaluate(() => window.__game.enterPlace(window.__game.homePlace()));
    await wait(1500);
    await key(page, 'KeyB');
    await wait(500);
    await page.click('.seg-btn:has-text("Renovate")');
    await page.click('text=Draw wall');
    await clickAt(4, 0);
    await clickAt(4, 5);
    await page.mouse.click(640, 400, { button: 'right' });
    await page.click('text=Doorway');
    await clickAt(4, 2.5);
    await page.click('.chip:has-text("Wood")').catch(() => {});
    await page.click('.chip:has-text("Tile")').catch(() => {});
    await page.locator('.swatch').nth(7).click();
    await page.click('text=Panorama windows');
    await wait(300);
    await shot('p8-renovate');
    await page.click('.seg-btn:has-text("Upstairs")');
    await wait(400);
    await page.click('.seg-btn:has-text("Storage")');
    await wait(200);
    await shot('p8-upstairs');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await page.click('text=Done');
    await wait(900);
    await page.evaluate(() => {
      const g = window.__game;
      g.player.teleport(g.interior.lift.x, g.interior.lift.z - 0.6, 0);
    });
    await wait(400);
    const label = await page.evaluate(() => window.__game.interactable && window.__game.interactable.label);
    await key(page, 'KeyE');
    await wait(900);
    const b = await page.evaluate(() => {
      const g = window.__game;
      return { level: g.inside.level, walls: g.state.home.layout.walls.length, floor: g.state.home.layout.floor, windows: g.state.home.layout.windows, style: g.state.home.styleScore, stash: g.state.inventory.furniture };
    });
    console.log('owned', label, JSON.stringify(b));
    await shot('p8-upstairs-play');
  },
  /** Phase 7: Invest + News apps, Homes app (rent, buy with mortgage), loans in the Bank app. */
  async finance({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.state.money.checking = 250000;
      g.sim.jobs.hire('tech', 0);
      g.state.job.level = 3;
      g.state.credit.score = 720;
      g.sim.advance(1440 * 3, { noDecay: true, noCollapse: true });
    });
    await key(page, 'Tab');
    await page.click('.app-icon:has-text("Invest")');
    await wait(300);
    await page.click('.seg-btn:has-text("Markets")');
    await wait(200);
    await shot('p7-markets');
    await page.click('.lrow:has-text("CITY500")');
    await wait(200);
    await page.click('.btn:has-text("Buy")');
    await page.click('.chip:has-text("$10,000")');
    await page.click('.amount .btn.primary');
    await wait(200);
    await shot('p7-asset');
    await page.click('text=‹ Back');
    await page.click('.seg-btn:has-text("Portfolio")');
    await wait(200);
    await shot('p7-portfolio');
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Homes")');
    await wait(300);
    await shot('p7-myhome');
    await page.click('.seg-btn:has-text("Rent")');
    await wait(200);
    await shot('p7-rent');
    await page.click('.seg-btn:has-text("Buy")');
    await wait(200);
    await page.locator('.lrow').first().click();
    await wait(300);
    await shot('p7-listing');
    await page.click('text=Buy to rent out');
    await page.click('.dialog-foot >> text=Buy it');
    await wait(400);
    await shot('p7-owned');
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Bank")');
    await wait(300);
    await page.click('text=Apply for a personal loan');
    await page.click('.chip:has-text("$5,000")');
    await wait(200);
    await shot('p7-loan');
    await page.click('.app-back');
    await page.click('.app-icon:has-text("News")');
    await wait(300);
    await shot('p7-news');
    const info = await page.evaluate(() => {
      const g = window.__game;
      return { holdings: Object.keys(g.state.portfolio.holdings), props: g.state.properties.length, loans: g.state.loans.map((l) => l.kind), nw: Math.round(g.sim.finance.netWorth()) };
    });
    console.log('info', JSON.stringify(info));
  },
  /** Phase 6: Learn app, college class, gigs, ventures, the four new mini-games. */
  async learn({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => {
      const g = window.__game;
      g.state.money.checking = 90000;
      g.state.skills.coding = 5;
      g.state.inventory.items.laptop = 1;
      g.sim.advance(120, { noDecay: true });
    });
    await key(page, 'Tab');
    await page.click('.app-icon:has-text("Learn")');
    await wait(300);
    await shot('p6-skills');
    await page.click('.seg-btn:has-text("College")');
    await wait(200);
    await shot('p6-college');
    await page.locator('.card.job').nth(8).locator('text=Student loan').click();
    await page.click('.seg-btn:has-text("Online")');
    await page.locator('.lrow .btn').first().click();
    await wait(200);
    await page.click('text=Study 1 h');
    await wait(1200);
    await shot('p6-online');
    await page.click('.seg-btn:has-text("Books")');
    await page.locator('.lrow .btn').first().click();
    await page.click('text=Read 1 h');
    await wait(1200);
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Gigs")');
    await wait(300);
    await shot('p6-gigs');
    await page.locator('.card.job').first().locator('text=Start').click();
    await wait(1400);
    await key(page, 'Tab');
    await page.click('.app-icon:has-text("Ventures")');
    await wait(300);
    await page.locator('.card.job').first().locator('text=Launch').click();
    await page.click('.dialog-foot >> text=Launch');
    await wait(300);
    await page.click('text=Hire');
    await page.evaluate(() => window.__game.sim.advance(1440 * 6, { noDecay: true, noCollapse: true }));
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Ventures")');
    await wait(300);
    await shot('p6-ventures');
    await key(page, 'Escape');
    await page.evaluate(() => {
      const g = window.__game;
      g.state.time.total = Math.floor(g.state.time.total / 1440) * 1440 + 10 * 60;
      g.enterPlace(g.city.placeById.college);
    });
    await wait(1500);
    await page.evaluate(() => {
      const g = window.__game;
      g.npcs.clearIndoor();
      const pt = g.interior.points.find((p) => p.use === 'service');
      g.player.teleport(pt.x, pt.z, Math.PI);
    });
    await wait(400);
    await key(page, 'KeyE');
    await shot('p6-class');
    await page.click('text=Attend today');
    await wait(1500);
    for (const id of ['trading', 'triage', 'beatcut', 'matchhome']) {
      await page.evaluate((x) => void window.__mg(x, 2), id);
      await wait(3400);
      await shot('p6-' + id);
      await page.click('text=Skip — auto-resolve');
      await wait(300);
    }
    const info = await page.evaluate(() => {
      const g = window.__game;
      return { enrolled: g.state.education.enrolled, loans: g.state.loans.length, biz: g.state.businesses.map((b) => Math.round(b.cash)), coding: +g.state.skills.coding.toFixed(2), gigs: g.state.hustles.total };
    });
    console.log('info', JSON.stringify(info));
  },
  /** Phase 5: crowd, meeting an NPC, talk actions, Contacts + Social apps, NPCs indoors. */
  async social({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => window.__game.sim.advance(90, { noDecay: true }));
    await wait(1500);
    await shot('p5-crowd');
    const who = await page.evaluate(() => {
      const g = window.__game;
      g.sim.advance(9.5 * 60, { noDecay: true }); // ~6 PM: office workers are out
      for (const n of g.npcs.list) {
        const w = g.npcs.where(n);
        if (w.kind !== 'out') continue;
        const s = g.npcs.outdoorSpot(n, w.slot);
        g.player.teleport(s.x + Math.sin(s.ry) * 1.5, s.z + Math.cos(s.ry) * 1.5, s.ry + Math.PI);
        g.cam.snapBehind(s.ry + Math.PI + 0.7);
        return n.name;
      }
      return null;
    });
    console.log('npc', who);
    await wait(1800);
    await shot('p5-npc');
    await key(page, 'KeyE');
    await shot('p5-talk');
    await page.click('text=Chat');
    await page.click('text=Tell a joke');
    await page.click('text=Compliment');
    await page.click('text=Hang out');
    await wait(200);
    await shot('p5-hangout');
    await page.click('text=Back');
    await page.click('text=Give a gift');
    await page.click('text=Flowers');
    await wait(200);
    await shot('p5-talk2');
    await page.click('text=Goodbye');
    await key(page, 'Tab');
    await page.click('.app-icon:has-text("Contacts")');
    await wait(300);
    await shot('p5-contacts');
    await page.click('.lrow');
    await wait(200);
    await page.click('text=Send a friendly text');
    await shot('p5-person');
    await page.click('.app-back');
    await page.click('.app-icon:has-text("Pulse")');
    await wait(300);
    await page.click('.lrow:has-text("Selfie") >> text=Post');
    await wait(300);
    await shot('p5-social');
    await key(page, 'Escape');
    const inCafe = await page.evaluate(() => {
      const g = window.__game;
      g.state.time.total = 1440 * 1 + 12.4 * 60; // Tuesday lunch
      g.enterPlace(g.city.placeById.cafe);
      return true;
    });
    await wait(1600);
    const info = await page.evaluate(() => {
      const g = window.__game;
      return { indoor: g.npcs.indoor.map((a) => (a.npc ? a.npc.first : 'staff')), known: Object.keys(g.state.relationships).length, followers: g.state.social.followers, pop: Math.round(g.state.social.popularity), calls: g.renderer.info.render.calls };
    });
    console.log('info', JSON.stringify(info), inCafe);
    await shot('p5-cafe-npcs');
  },
  /** Phase 4: home interior, sleep, Jobs app + interview, shift + mini-games, café. */
  async work({ page, shot, wait }) {
    await startLife(page, wait);
    await page.evaluate(() => window.__game.enterPlace(window.__game.homePlace()));
    await wait(1400);
    await shot('p4-home');
    await page.evaluate(() => {
      const g = window.__game;
      const pt = g.interior.points.find((p) => p.use === 'sleep');
      g.player.teleport(pt.x, pt.z, 0);
    });
    await wait(500);
    await key(page, 'KeyE');
    await shot('p4-sleep');
    await key(page, 'Escape');
    await page.evaluate(() => window.__game.leaveInterior());
    await wait(1200);
    await key(page, 'Tab');
    await page.click('.app-icon:has-text("Jobs")');
    await wait(300);
    await shot('p4-jobs');
    await page.locator('.card.job').nth(1).locator('text=Apply').click();
    await wait(300);
    await shot('p4-interview');
    for (let i = 0; i < 3; i++) {
      await page.click('.btn.answer');
      await wait(150);
    }
    await shot('p4-verdict');
    await page.click('text=Continue');
    await key(page, 'Escape');
    await page.evaluate(() => {
      const g = window.__game;
      if (!g.state.job) g.sim.jobs.hire('hospitality', 0);
      g.sim.advance(4 * 60, { noDecay: true });
      g.enterPlace(g.city.placeById.restaurant);
    });
    await wait(1400);
    await shot('p4-restaurant');
    await page.evaluate(() => {
      const g = window.__game;
      g.npcs.clearIndoor(); // keep staff out of the way of the scripted interaction
      const pt = g.interior.points.find((p) => p.use === 'work');
      g.player.teleport(pt.x, pt.z, 0);
    });
    await wait(400);
    await key(page, 'KeyE');
    await shot('p4-shift');
    await page.click('text=Play shift');
    await wait(2800);
    for (const f of ['🍔', '🍟', '🥤']) await page.click('.or-btn:has-text("' + f + '")').catch(() => {});
    await shot('p4-orderrush');
    await page.click('text=Skip — auto-resolve');
    await wait(1500);
    await shot('p4-summary');
    await page.click('text=Continue');
    for (const id of ['bugsquash', 'wiring']) {
      await page.evaluate((x) => void window.__mg(x, 2), id);
      await wait(3600);
      await shot('p4-' + id);
      await page.click('text=Skip — auto-resolve');
      await wait(300);
    }
    await page.evaluate(() => {
      const g = window.__game;
      g.leaveInterior(true);
      g.enterPlace(g.city.placeById.cafe);
    });
    await wait(1400);
    await page.evaluate(() => {
      const g = window.__game;
      g.npcs.clearIndoor();
      const pt = g.interior.points.find((p) => p.use === 'service');
      g.player.teleport(pt.x, pt.z, Math.PI);
    });
    await wait(400);
    await key(page, 'KeyE');
    await shot('p4-cafe');
    await page.click('.slot .btn');
    await wait(1200);
    const info = await page.evaluate(() => ({ cash: Math.round(window.__game.state.money.checking), job: window.__game.sim.jobs.title(), energy: Math.round(window.__game.state.needs.energy), inside: !!window.__game.inside }));
    console.log('info', JSON.stringify(info));
    await shot('p4-after-coffee');
  },

  /** Phase 3: HUD, phone + bank, map, pause, settings, save/load round trip. */
  async core({ page, shot, wait }) {
    await startLife(page, wait);
    await wait(800);
    await shot('p3-hud');
    await key(page, 'Tab');
    await shot('p3-phone');
    await page.click('.app-icon');
    await wait(400);
    await shot('p3-bank');
    await page.click('text=Budget');
    await page.click('text=Activity');
    await key(page, 'Escape');
    await key(page, 'KeyM');
    await shot('p3-map');
    await page.click('.map-place');
    await key(page, 'Escape');
    await page.evaluate(() => window.__game.sim.advance(60 * 24 * 30, { noDecay: true, noCollapse: true }));
    await key(page, 'Escape');
    await shot('p3-pause');
    await page.click('text=Settings');
    await wait(300);
    await shot('p3-settings');
    await key(page, 'Escape');
    await page.click('text=Quit to title');
    await page.click('text=Save & quit');
    await page.waitForSelector('.title-menu');
    await page.click('text=Continue');
    await page.waitForFunction(() => window.__game.mode === 'play');
    await wait(900);
    const info = await page.evaluate(() => ({ day: window.__game.sim.day, cash: Math.round(window.__game.state.money.checking), overlays: window.__game.overlays.length }));
    console.log('after reload', JSON.stringify(info));
    await shot('p3-loaded');
  },

  /** Phase 2: title, character creator tabs, random, start. */
  async creator({ page, shot, wait }) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.title-menu');
    await wait(1200);
    await shot('p3-title');
    await page.click('text=New Life');
    await page.waitForSelector('.creator-panel');
    await wait(700);
    await shot('p2-background');
    await page.click('.tab:nth-child(2)');
    await wait(900);
    await shot('p2-look');
    await page.click('text=🎲 Random');
    await wait(500);
    await page.click('.tab:nth-child(3)');
    await wait(900);
    await shot('p2-outfit');
    await page.click('text=🎲 Random');
    await page.click('.tab:nth-child(4)');
    await wait(400);
    await shot('p2-traits');
    await page.click('.tab:nth-child(5)');
    await wait(400);
    await shot('p10-creator-goals');
    await page.click('text=Choose a city');
    await page.waitForSelector('.city-panel');
    await page.click('text=Move to');
    await wait(1500);
    await shot('p2-inworld');
  },

  /** Phase 1: walk around the city at a few times of day. */
  async default({ page, shot, wait }) {
    await startLife(page, wait);
    await wait(1500);
    await shot('p1-day');
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await wait(1500);
    await shot('p1-run');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await page.evaluate(() => {
      const g = window.__game;
      g.state.time.total = 19.3 * 60;
      g.cam.pitch = 0.1;
      g.cam.yaw += 2;
    });
    await wait(800);
    await shot('p1-sunset');
    await page.evaluate(() => {
      const g = window.__game;
      g.state.time.total = 23 * 60;
    });
    await wait(800);
    await shot('p1-night');
    const info = await page.evaluate(() => {
      const g = window.__game;
      return { fps: Math.round(g.loop.fps), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, places: g.city.places.length };
    });
    console.log('info', JSON.stringify(info));
  },
};
