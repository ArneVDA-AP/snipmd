  // W8: 2 minutes idle, page focused, real time and real Math.random. Samples every frame like sample(),
  // but keeps only the changes (face, state, x, idle strip running, idle frame) so 12000 frames stay small.
  await ready(page);
  const p0 = await pre(page);
  const g = await geom(page);
  await page.evaluate(() => {
    const STATES = ['idle', 'clap', 'relief', 'worried', 'sleep', 'walk', 'wave'];
    const W = (window.__w8 = { t0: performance.now(), on: true, frames: 0, maxGap: 0, changes: [], focusLost: 0 });
    let prev = null, last = W.t0;
    const tick = () => {
      if (!W.on) return;
      const now = performance.now();
      W.maxGap = Math.max(W.maxGap, now - last); last = now; W.frames++;
      const svg = document.querySelector('.pet > svg:not(.friend)');
      const strips = [...svg.children];
      const i = strips.findIndex((x) => x.getAttribute('display') === 'inline');
      const m = new DOMMatrix(getComputedStyle(svg).transform === 'none' ? undefined : getComputedStyle(svg).transform);
      const idle = strips[0];
      const s = { face: Math.sign(m.a) || 1, x: m.e, state: i < 0 ? 'none' : STATES[i],
        idleRun: idle.getAnimations().some((a) => a.playState === 'running'),
        idleFrame: getComputedStyle(idle).transform, focus: document.hasFocus() };
      if (!s.focus) W.focusLost++;
      for (const k of Object.keys(s)) if (!prev || prev[k] !== s[k]) W.changes.push({ t: +(now - W.t0).toFixed(1), k, v: s[k] });
      prev = s;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t = Date.now();
  while (Date.now() - t < 121000) await sleep(1000);
  const shots = [await shot(page, 'W8-end.png')];
  const r = await page.evaluate(() => { const W = window.__w8; W.on = false; return { span: performance.now() - W.t0, frames: W.frames, maxGap: W.maxGap, focusLost: W.focusLost, changes: W.changes }; });
  return { case: 'W8', pre: p0, geom: g, randomIsNative: await page.evaluate(() => /\[native code\]/.test(String(Math.random))), shots, ...r };
