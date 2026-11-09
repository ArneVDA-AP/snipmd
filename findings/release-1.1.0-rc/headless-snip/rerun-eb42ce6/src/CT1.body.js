  // CT1-like: Snip at home in light and in dark. Clips at dpr 1 in this page, plus an 8x context as an illustration.
  const out = {};
  const ctx8 = await page.context().browser().newContext({ deviceScaleFactor: 8, viewport: { width: 1280, height: 720 } });
  try {
    const p8 = await ctx8.newPage();
    await p8.goto(URL0);
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      const g = await geom(page);
      const colours = await page.evaluate(() => {
        const svg = document.querySelector('.pet > svg');
        const f = (c) => { const e = svg.querySelector('.' + c); return e ? getComputedStyle(e).fill : null; };
        return { body: f('body'), claw: f('claw'), eye: f('eye'), pupil: f('pupil'), bar: getComputedStyle(document.querySelector('.titlebar')).backgroundColor };
      });
      const clip = { x: g.home.l - 4, y: g.home.t - 4, width: g.home.w + 8, height: g.home.h + 8 };
      await page.screenshot({ path: OUT + 'CT1-' + scheme + '-home.png', clip });
      await page.screenshot({ path: OUT + 'CT1-' + scheme + '-bar.png', clip: BAR });
      await p8.emulateMedia({ colorScheme: scheme });
      await ready(p8);
      const g8 = await geom(p8);
      await p8.screenshot({ path: OUT + 'CT1-' + scheme + '-home-x8.png', clip: { x: g8.home.l - 2, y: g8.home.t - 2, width: g8.home.w + 4, height: g8.home.h + 4 } });
      out[scheme] = { dark: await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), colours, dpr8: g8.dpr,
        shots: ['CT1-' + scheme + '-home.png', 'CT1-' + scheme + '-bar.png', 'CT1-' + scheme + '-home-x8.png'] };
    }
  } finally {
    await ctx8.close();
    await page.emulateMedia({ colorScheme: null });
    await page.bringToFront();
    await ready(page);
  }
  return { case: 'CT1', focusAfter: await page.evaluate(() => document.hasFocus()), ...out };
