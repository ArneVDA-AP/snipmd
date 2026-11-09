  // M1 (reviewer): nap, "Opslaan", 300 ms later "Opslaan" again. Reviewer's claim: Snip stays asleep, the friend leaves.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  await page.evaluate(() => window.__h.press('10 minuten later'));
  const sleepMs = await until(page, () => window.__h.samples.at(-1).sn.s === 'sleep', 3000);
  await sleep(300);
  await page.evaluate(() => { window.__h.press('Opslaan'); window.__h.later(300, 'Opslaan'); });
  const goneMs = await until(page, () => { const s = window.__h.samples.at(-1); return s.fr && s.fr.gone; }, 9000);
  const q = await quiet(page, 6000);
  await sleep(1000);
  const shots = [await shot(page, 'M1-end.png')];
  const end = await page.evaluate(() => window.__h.samples.at(-1));
  return { case: 'M1', pre: p0, geom: g, extra: { sleepMs, goneMs, end }, quietMs: q, shots, ...(await collect(page)) };
