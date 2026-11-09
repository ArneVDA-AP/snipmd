async page => {
  // Shared harness for the headless Snip check. build.py pastes one case body at CASE_BODY.
  const OUT = 'C:\\Users\\Admin\\AppData\\Local\\Temp\\claude\\7323b5bed2752d75\\42d8ed5a-578a-4047-85be-4a566a1c9312\\scratchpad\\out\\headless-snip\\rerun-eb42ce6\\';
  const URL0 = 'http://127.0.0.1:5199/';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BAR = { x: 0, y: 0, width: 1280, height: 34 };

  async function ready(p) {
    await p.reload();
    await p.waitForFunction(() => document.querySelectorAll('.pet svg path').length > 0
      && document.querySelectorAll('.tabs [role=tab]').length >= 4
      && document.querySelectorAll('.demo button').length >= 10, null, { timeout: 15000 });
    await p.waitForTimeout(400);
  }

  // Per animation frame: Snip and friend position, rect, state strip; new animations on either svg.
  async function sample(p) {
    await p.evaluate(() => {
      const STATES = ['idle', 'clap', 'relief', 'worried', 'sleep', 'walk', 'wave'];
      const st = (svg) => {
        const i = [...svg.children].findIndex((g) => g.getAttribute('display') === 'inline');
        return i < 0 ? 'none' : STATES[i];
      };
      const rd = (svg) => {
        const cs = getComputedStyle(svg).transform;
        const m = cs === 'none' ? new DOMMatrix() : new DOMMatrix(cs);
        const r = svg.getBoundingClientRect();
        return { x: +m.e.toFixed(3), face: Math.sign(m.a) || 1, l: r.left, t: r.top, r: r.right, w: r.width, s: st(svg) };
      };
      const seen = new WeakSet();
      const W = (window.__h = { samples: [], walks: [], events: [], t0: performance.now(), on: true });
      W.now = () => +(performance.now() - W.t0).toFixed(2);
      W.mark = (name) => W.events.push({ t: W.now(), name });
      W.press = (label) => {
        const b = [...document.querySelectorAll('.demo button')].find((x) => x.textContent === label);
        W.mark('press:' + label + (b ? '' : ' (MISSING)'));
        if (b) b.click();
      };
      W.later = (ms, label) => setTimeout(() => W.press(label), ms);
      const tick = () => {
        if (!W.on) return;
        const pet = document.querySelector('.pet');
        const snip = pet && pet.querySelector(':scope > svg:not(.friend)');
        const fr = pet && pet.querySelector(':scope > svg.friend');
        const s = { t: W.now(), hid: pet ? pet.hidden : null, pr: pet ? pet.getBoundingClientRect().width : null };
        if (snip) s.sn = rd(snip);
        if (fr) { s.fr = rd(fr); s.fr.gone = fr.classList.contains('gone'); }
        for (const [who, svg] of [['snip', snip], ['friend', fr]]) {
          if (!svg) continue;
          for (const a of svg.getAnimations()) {
            if (seen.has(a)) continue;
            seen.add(a);
            const kf = a.effect.getKeyframes();
            W.walks.push({ who, t: s.t, dur: a.effect.getTiming().duration, n: kf.length,
              kf: kf.length > 2 ? kf.map((k) => [+k.computedOffset.toFixed(4), k.transform]) : kf.map((k) => k.transform) });
          }
        }
        s.walking = snip ? snip.getAnimations().some((a) => a.playState === 'running' && a.effect.getKeyframes().length > 2) : false;
        s.run = pet ? pet.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0;
        W.samples.push(s);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  const pre = (p) => p.evaluate(() => {
    const pet = document.querySelector('.pet');
    const svg = pet.querySelector(':scope > svg');
    return { focus: document.hasFocus(), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      dark: matchMedia('(prefers-color-scheme: dark)').matches, dpr: devicePixelRatio,
      inner: [innerWidth, innerHeight], hidden: pet.hidden, widthAttr: svg.getAttribute('width'),
      transform: getComputedStyle(svg).transform };
  });

  const geom = (p) => p.evaluate(() => {
    const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const pet = document.querySelector('.pet');
    const svg = pet.querySelector(':scope > svg');
    return { dpr: devicePixelRatio, inner: [innerWidth, innerHeight], home: R(pet), svg: R(svg), widthAttr: svg.getAttribute('width'),
      cell: Number(svg.getAttribute('width')) / 11, strip: R(document.querySelector('.tabs')),
      tabs: [...document.querySelectorAll('.tabs [role=tab]')].map((t) => ({ id: t.dataset.id, title: t.querySelector('.tab-title')?.textContent,
        tab: R(t), close: R(t.querySelector('.tab-close')), glyph: R(t.querySelector('.tab-close svg')) })) };
  });

  const last = (p) => p.evaluate(() => window.__h.samples.at(-1));
  // Waits until the last sample satisfies `cond` (a function source over s), polling every 30 ms.
  async function until(p, cond, cap) {
    const t = Date.now();
    while (Date.now() - t < cap) {
      if (await p.evaluate(cond)) return Date.now() - t;
      await sleep(30);
    }
    return -1;
  }
  // Quiet: Snip idle at x 0, no walk running, friend absent or gone, for `hold` ms.
  async function quiet(p, cap = 15000, hold = 600) {
    return until(p, (h) => {
      const S = window.__h.samples; const end = S.at(-1); if (!end) return false;
      const ok = (s) => s.sn && s.sn.s === 'idle' && s.sn.x === 0 && !s.walking && (!s.fr || s.fr.gone) && s.sn.face === 1;
      const from = end.t - 600; const win = S.filter((s) => s.t >= from);
      return win.length > 5 && win.every(ok) && end.t - window.__h.samples[0].t > 600;
    }, cap);
  }
  const collect = (p) => p.evaluate(() => { const W = window.__h; W.on = false; return { samples: W.samples, walks: W.walks, events: W.events }; });
  async function shot(p, name, clip = BAR) {
    await p.evaluate((n) => window.__h && window.__h.mark('shot:' + n), name);
    await p.screenshot({ path: OUT + name, clip });
    return name;
  }

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
}
