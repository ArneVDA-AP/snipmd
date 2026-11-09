  // CT2-like: device scale 1, 1.25, 1.5, 2 in new contexts. Geometry, a W1 trace, clips at home and at the far tab.
  const res = {};
  for (const dsf of [1, 1.25, 1.5, 2]) {
    const ctx = await page.context().browser().newContext({ deviceScaleFactor: dsf, viewport: { width: 1280, height: 720 } });
    try {
      const p = await ctx.newPage();
      await p.goto(URL0);
      await p.bringToFront();
      await ready(p);
      const p0 = await pre(p);
      const g = await geom(p);
      const tag = 'CT2-dpr' + String(dsf).replace('.', '_');
      const around = (l) => ({ x: Math.floor(l) - 3, y: 3, width: 30, height: 28 });
      await p.screenshot({ path: OUT + tag + '-home.png' }); // full viewport: origin 0,0, no resampling; crisp.py crops
      await p.screenshot({ path: OUT + tag + '-bar-home.png', clip: BAR });
      await sample(p);
      await p.evaluate(() => window.__h.press('labo-04.md'));
      await sleep(150);
      await p.evaluate(() => window.__h.press('Afbeelding geplakt'));
      const reach = await until(p, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'clap' && s.sn.x !== 0; }, 4000);
      await sleep(250);
      const atTab = await p.evaluate(() => window.__h.samples.at(-1).sn);
      await p.evaluate(() => window.__h.mark('shot:at-tab'));
      await p.screenshot({ path: OUT + tag + '-at-tab.png' });
      await p.screenshot({ path: OUT + tag + '-bar-at-tab.png', clip: BAR });
      const q = await quiet(p, 9000);
      res[dsf] = { case: 'CT2', dsf, pre: p0, geom: g, reachMs: reach, quietMs: q, atTab, clipHome: around(g.home.l), clipTab: around(atTab.l),
        shots: [tag + '-home.png', tag + '-bar-home.png', tag + '-at-tab.png', tag + '-bar-at-tab.png'], ...(await collect(p)) };
    } finally {
      await ctx.close();
    }
  }
  await page.bringToFront();
  return { case: 'CT2', focusAfter: await page.evaluate(() => document.hasFocus()), byScale: res };
