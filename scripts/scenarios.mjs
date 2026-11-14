// Scripted scenarios for scripts/smoke.mjs. Each gets { page, shot, wait }.

/** Fresh storage -> title -> New Life -> random character -> in the world. */
export async function startLife(page, wait) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.title-menu');
  await page.click('text=New Life');
  await page.waitForSelector('.creator-panel');
  await page.click('text=🎲 Random');
  await page.click('.tab:nth-child(4)');
  await page.click('text=Start Life');
  await page.waitForFunction(() => window.__game.mode === 'play');
  await wait(600);
}

/** Press a key and give the (slow, software-rendered) game loop time to see it. */
export async function key(page, code, ms = 500) {
  await page.keyboard.down(code);
  await page.waitForTimeout(160);
  await page.keyboard.up(code);
  await page.waitForTimeout(ms);
}

export const scenarios = {
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
    await page.click('.app-icon:nth-child(2)');
    await wait(300);
    await shot('p4-jobs');
    await page.click('.card.job:has-text("Dishwasher") >> text=Apply');
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
    await page.click('text=Start Life');
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
