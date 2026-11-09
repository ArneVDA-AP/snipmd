  // M2 (reviewer): a moment on t1, and while Snip plays it there, "10 minuten later"; later "Opslaan".
  // Reviewer's claim: Snip sleeps over the tab and stays; after "Opslaan" it ends idle over the tab, not at home.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  await page.evaluate(() => window.__h.press('labo-04.md'));
  await sleep(150);
  await page.evaluate(() => window.__h.press('Afbeelding geplakt'));
  const reach = await until(page, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'clap' && s.sn.x !== 0; }, 4000);
  await page.evaluate(() => window.__h.press('10 minuten later'));
  await sleep(4000); // well past the clap (1200 ms) and a walk home (1400 ms)
  const asleep = await page.evaluate(() => window.__h.samples.at(-1));
  const shots = [await shot(page, 'M2-asleep.png')];
  await page.evaluate(() => window.__h.press('Opslaan'));
  const goneMs = await until(page, () => { const s = window.__h.samples.at(-1); return s.fr && s.fr.gone; }, 9000);
  await sleep(2500);
  const end = await page.evaluate(() => window.__h.samples.at(-1));
  shots.push(await shot(page, 'M2-end.png'));
  return { case: 'M2', pre: p0, geom: g, reachMs: reach, extra: { asleep, goneMs, end }, shots, ...(await collect(page)) };
