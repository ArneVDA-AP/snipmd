  // N1 + N2: "10 minuten later" puts Snip to sleep; "Opslaan" brings the friend from the right edge.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  const shots = [await shot(page, 'N-before.png')];
  await page.evaluate(() => window.__h.press('10 minuten later'));
  const sleepMs = await until(page, () => window.__h.samples.at(-1).sn.s === 'sleep', 3000);
  await sleep(300);
  shots.push(await shot(page, 'N1-sleep.png'));
  await page.evaluate(() => window.__h.press('Opslaan'));
  const togetherMs = await until(page, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'clap' && s.fr && !s.fr.gone; }, 4000);
  await sleep(200);
  shots.push(await shot(page, 'N2-together.png'));
  const goneMs = await until(page, () => { const s = window.__h.samples.at(-1); return s.fr && s.fr.gone; }, 8000);
  const q = await quiet(page, 6000);
  shots.push(await shot(page, 'N2-end.png'));
  return { case: 'N12', pre: p0, geom: g, extra: { sleepMs, togetherMs, goneMs }, quietMs: q, shots, ...(await collect(page)) };
