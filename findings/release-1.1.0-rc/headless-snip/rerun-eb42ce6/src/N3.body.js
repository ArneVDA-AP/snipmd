  // N3: nap, "Opslaan", 200 ms later "Afbeelding geplakt" on t1 while the friend walks in.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await sample(page);
  await page.evaluate(() => window.__h.press('labo-04.md'));
  await sleep(150);
  await page.evaluate(() => window.__h.press('10 minuten later'));
  const sleepMs = await until(page, () => window.__h.samples.at(-1).sn.s === 'sleep', 3000);
  await sleep(300);
  await page.evaluate(() => { window.__h.press('Opslaan'); window.__h.later(200, 'Afbeelding geplakt'); });
  const reach = await until(page, () => { const s = window.__h.samples.at(-1); return s.sn.s === 'clap' && s.sn.x !== 0; }, 4000);
  await sleep(250);
  const shots = [await shot(page, 'N3-at-tab.png')];
  const q = await quiet(page, 10000);
  shots.push(await shot(page, 'N3-end.png'));
  const end = await page.evaluate(() => ({ snips: document.querySelectorAll('.pet > svg:not(.friend)').length, friends: document.querySelectorAll('.pet > svg.friend').length,
    friendGone: document.querySelector('.pet > svg.friend')?.classList.contains('gone') ?? null }));
  return { case: 'N3', pre: p0, geom: g, extra: { sleepMs, end }, reachMs: reach, quietMs: q, shots, ...(await collect(page)) };
