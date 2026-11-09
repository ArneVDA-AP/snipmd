  // W1 + W2: clap on the far tab t1 (labo-04.md), walk there, clap, walk back, settle.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  await page.evaluate(() => window.__h.press('labo-04.md'));
  await sleep(150);
  const shots = [await shot(page, 'W1-before.png')];
  await page.evaluate(() => window.__h.press('Afbeelding geplakt'));
  const reach = await until(page, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'clap' && s.sn.x !== 0; }, 4000);
  await sleep(250);
  const atTab = await page.evaluate(() => window.__h.samples.at(-1).sn);
  shots.push(await shot(page, 'W1-at-tab.png'));
  const q = await quiet(page, 9000);
  shots.push(await shot(page, 'W1-home.png'));
  return { case: 'W1', pre: p0, geom: g, reachMs: reach, quietMs: q, atTab, shots, ...(await collect(page)) };
