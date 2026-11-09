  // W7: type for at least 10 s in the editor of the active tab: no walk, no state other than idle.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await page.click('.cm-content');
  await sample(page);
  const shots = [await shot(page, 'W7-before.png')];
  const t = Date.now();
  await page.evaluate(() => window.__h.mark('type:start'));
  const text = 'Snip blijft thuis tijdens het typen. ';
  while (Date.now() - t < 10000) await page.keyboard.type(text, { delay: 30 });
  await page.evaluate(() => window.__h.mark('type:end'));
  const typedMs = Date.now() - t;
  await sleep(1500); // autosave fires 1 s after the last edit
  shots.push(await shot(page, 'W7-after.png'));
  const doc = await page.evaluate(() => document.querySelector('.cm-content').textContent.length);
  return { case: 'W7', pre: p0, geom: g, extra: { typedMs, docChars: doc }, shots, ...(await collect(page)) };
