  // W3: relief on the tab nearest Snip (t4, todo.md).
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  await page.evaluate(() => window.__h.press('todo.md'));
  await sleep(150);
  const shots = [await shot(page, 'W3-before.png')];
  await page.evaluate(() => window.__h.press('Tab teruggehaald'));
  const reach = await until(page, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'relief' && s.sn.x !== 0; }, 4000);
  await sleep(300);
  const atTab = await page.evaluate(() => window.__h.samples.at(-1).sn);
  shots.push(await shot(page, 'W3-at-tab.png'));
  const q = await quiet(page, 9000);
  shots.push(await shot(page, 'W3-home.png'));
  return { case: 'W3', pre: p0, geom: g, reachMs: reach, quietMs: q, atTab, shots, ...(await collect(page)) };
