  // CT5-like: reduced motion. W1 again (no walk, moment at home), then nap and "Opslaan" (wakes without a friend).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await ready(page);
    const p0 = await pre(page);
    const g = await geom(page);
    await sample(page);
    await page.evaluate(() => window.__h.press('labo-04.md'));
    await sleep(150);
    await page.evaluate(() => window.__h.press('Afbeelding geplakt'));
    await sleep(500);
    const shots = [await shot(page, 'CT5-clap.png')];
    await sleep(1500);
    await page.evaluate(() => window.__h.press('10 minuten later'));
    const sleepMs = await until(page, () => window.__h.samples.at(-1).sn.s === 'sleep', 3000);
    await sleep(300);
    shots.push(await shot(page, 'CT5-sleep.png'));
    await page.evaluate(() => window.__h.press('Opslaan'));
    await sleep(3000);
    shots.push(await shot(page, 'CT5-woken.png'));
    const end = await page.evaluate(() => ({ friendSvg: document.querySelectorAll('.pet > svg.friend').length,
      stripAnims: document.querySelector('.pet').getAnimations({ subtree: true }).map((a) => a.effect.getKeyframes().length) }));
    return { case: 'CT5', pre: p0, geom: g, extra: { sleepMs, end }, shots, ...(await collect(page)) };
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await ready(page);
  }
