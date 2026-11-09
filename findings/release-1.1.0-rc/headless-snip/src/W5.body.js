  // W5-like: "Twee kort na elkaar" = clap on the last tab, 400 ms later worried on the first tab.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  const shots = [await shot(page, 'W5-before.png')];
  await page.evaluate(() => window.__h.press('Twee kort na elkaar'));
  const reach = await until(page, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'worried' && s.sn.x !== 0; }, 5000);
  await sleep(300);
  const atTab = await page.evaluate(() => window.__h.samples.at(-1).sn);
  shots.push(await shot(page, 'W5-at-tab.png'));
  const q = await quiet(page, 12000);
  shots.push(await shot(page, 'W5-home.png'));
  return { case: 'W5', pre: p0, geom: g, reachMs: reach, quietMs: q, atTab, shots, ...(await collect(page)) };
