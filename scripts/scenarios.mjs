// Scripted scenarios for scripts/smoke.mjs. Each gets { page, shot, wait }.

/** Skip through the creator with a random character. */
export async function startLife(page, wait) {
  await page.waitForSelector('.creator-panel');
  await page.click('text=🎲 Random');
  await page.click('.tab:nth-child(4)');
  await page.click('text=Start Life');
  await page.waitForFunction(() => window.__game.mode === 'play');
  await wait(600);
}

export const scenarios = {
  /** Phase 2: character creator tabs, random, start. */
  async creator({ page, shot, wait }) {
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
      g.timeTotal = 19.3 * 60;
      g.cam.pitch = 0.1;
      g.cam.yaw += 2;
    });
    await wait(800);
    await shot('p1-sunset');
    await page.evaluate(() => {
      const g = window.__game;
      g.timeTotal = 23 * 60;
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
