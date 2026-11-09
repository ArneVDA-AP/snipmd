  // W5x = W5 plus 3 s after quiet and an end inventory of animations. W5-like: "Twee kort na elkaar" = clap on the last tab, 400 ms later worried on the first tab.
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
  await sleep(3000); // a stale second walk home would start in this window
  shots.push(await shot(page, 'W5-home.png'));
  const endAnims = await page.evaluate(() => { const svg = document.querySelector('.pet > svg:not(.friend)');
    return { onSvg: svg.getAnimations().map((a) => ({ state: a.playState, keys: a.effect.getKeyframes().length, dur: a.effect.getTiming().duration })),
      subtreeRunning: svg.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').map((a) => (a.effect.target === svg ? 'svg' : 'strip:' + [...svg.children].indexOf(a.effect.target))) }; });
  return { case: 'W5x', endAnims, pre: p0, geom: g, reachMs: reach, quietMs: q, atTab, shots, ...(await collect(page)) };
