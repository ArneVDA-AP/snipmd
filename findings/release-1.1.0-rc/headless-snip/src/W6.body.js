  // W6: Ctrl+T until the strip scrolls and t1 is out of view; then a moment on t1: no walk, played at home.
  await ready(page);
  const p0 = await pre(page);
  // Mirrors pet.ts spot(): would Snip's stop at t1 lie outside the strip?
  const outOfView = () => page.evaluate(() => {
    const el = document.querySelector('.tab[data-id=t1]');
    const tab = el.getBoundingClientRect(); const strip = el.parentElement.getBoundingClientRect();
    const w = Number(document.querySelector('.pet > svg').getAttribute('width'));
    const center = Math.max(tab.left + w / 2, tab.right - 26 - w / 2);
    return { out: center - w / 2 < strip.left || center + w / 2 > strip.right, tab: [tab.left, tab.right], strip: [strip.left, strip.right],
      stop: [center - w / 2, center + w / 2], scrollLeft: el.parentElement.scrollLeft, n: document.querySelectorAll('.tabs [role=tab]').length };
  });
  let ov = await outOfView();
  let presses = 0;
  while (!ov.out && presses < 40) {
    await page.keyboard.press('Control+t');
    presses++;
    await sleep(120);
    ov = await outOfView();
  }
  await sleep(300);
  ov = await outOfView();
  const g = await geom(page);
  await sample(page);
  await page.evaluate(() => window.__h.press('labo-04.md'));
  await sleep(150);
  const shots = [await shot(page, 'W6-before.png')];
  await page.evaluate(() => window.__h.press('Gewijzigd buiten SnipMD'));
  const seen = await until(page, () => window.__h.samples.at(-1).sn.s === 'worried', 3000);
  await sleep(500);
  shots.push(await shot(page, 'W6-moment.png'));
  const q = await quiet(page, 9000);
  const res = { case: 'W6', pre: p0, geom: g, extra: { presses, outOfView: ov, worriedSeenMs: seen }, quietMs: q, shots, ...(await collect(page)) };
  await ready(page); // drops the extra tabs: the mock session has four
  return res;
