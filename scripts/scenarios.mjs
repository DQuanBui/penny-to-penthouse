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
