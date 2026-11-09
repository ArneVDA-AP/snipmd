// Probe for the review of Snip (RC src/pet.ts). Same jsdom harness as RC src/pet.test.ts.
// Run from RC: npx vitest run --root ../out --environment jsdom --globals
// Uses vitest globals, because OUT has no node_modules to resolve 'vitest' from.

const played: { el: Element; keys: Keyframe[]; opts: KeyframeAnimationOptions; paused: boolean; done: () => void; cut: () => void }[] = [];
let progress = 0.5;

const box = (left: number, width: number) => ({ left, right: left + width, width }) as DOMRect;
const strip = document.createElement('div');
strip.getBoundingClientRect = () => box(0, 80);
const tabs: Record<string, HTMLElement> = {};
for (const [id, left] of [['a', 0], ['b', 60]] as const) {
  tabs[id] = document.createElement('div');
  tabs[id].getBoundingClientRect = () => box(left, 60);
  strip.append(tabs[id]);
}
const lastWalk = () => played.filter((p) => p.el.tagName === 'svg' && p.opts.duration).at(-1)!;
const walks = () => played.filter((p) => p.el.tagName === 'svg' && p.opts.duration).map((p) => [p.keys[0].transform, p.keys.at(-1)!.transform]);

async function mounted() {
  vi.resetModules();
  played.length = 0;
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: false, addEventListener: () => {} })) as never;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
  Element.prototype.animate = function (this: Element, keys: Keyframe[], opts: KeyframeAnimationOptions) {
    let done = () => {};
    let cut = () => {};
    const finished = new Promise<void>((res, rej) => ((done = res), (cut = rej)));
    finished.catch(() => {});
    const a = { el: this, keys, opts, paused: false, done, cut };
    played.push(a);
    return { finished, pause: () => (a.paused = true), cancel: () => cut(), effect: { getComputedTiming: () => ({ progress }) } } as unknown as Animation;
  } as never;
  Element.prototype.getAnimations = () => [];
  const pet = await import('../rc/src/pet');
  const slot = document.createElement('span');
  slot.getBoundingClientRect = () => box(100, 22);
  pet.mountPet(slot, true, (id) => tabs[id]);
  vi.advanceTimersByTime(200);
  await vi.dynamicImportSettled();
  const svg = slot.firstElementChild!;
  const state = () => ['idle', 'clap', 'relief', 'worried', 'sleep', 'walk', 'wave'][[...svg.children].findIndex((g) => g.getAttribute('display') === 'inline')];
  /** Snip's last pose: the last keyframe of the newest animation on the svg itself. */
  const pose = () => played.filter((p) => p.el === svg).at(-1)!.keys.at(-1)!.transform;
  return { pet, slot, svg, state, pose };
}

describe('probe: Snip and the nap', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    progress = 0.5;
  });

  it('P1: a nap that starts while Snip plays a moment at a tab leaves it asleep at the tab, and the wake visit leaves it parked there', async () => {
    const { pet, state, pose } = await mounted();
    vi.advanceTimersByTime(10 * 60_000 - 1200); // mounted() already spent 200 ms: now 1 s before the nap
    pet.petMoment('worried', 'a');
    played.at(-1)!.done(); // arrives at tab a
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('worried');
    await vi.advanceTimersByTimeAsync(1000); // the nap timer fires during the 4 s of worry
    expect(state()).toBe('sleep');
    const walksBefore = walks().length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(walks().length).toBe(walksBefore); // no walk home
    expect(pose()).toBe('translateX(-88px) scaleX(1)'); // asleep over tab a
    // the next save brings the friend to where Snip lies
    pet.petMoment('saved');
    const friendWalk = walks().at(-1)!;
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(500 + 1200 + 700);
    played.at(-1)!.done(); // the friend leaves
    await vi.advanceTimersByTimeAsync(2000);
    expect(state()).toBe('idle');
    // Snip ends idle over tab a, not at home: it stays there until the next moment
    expect(pose()).toMatch(/^translateX\(-88px\)/);
    expect(friendWalk[1]).toBe('translateX(-64px) scaleX(1)'); // the friend stopped one cell right of Snip at the tab
  });

  it('P2: a nap that starts during a walk is overwritten by the moment and the next nap is 10 min later', async () => {
    const { pet, state } = await mounted();
    vi.advanceTimersByTime(10 * 60_000 - 300); // mounted() already spent 200 ms: now 100 ms before the nap
    pet.petMoment('clap', 'a'); // walk of 1.1 s starts
    await vi.advanceTimersByTimeAsync(200); // the nap fires mid-walk
    expect(state()).toBe('sleep');
    lastWalk().done(); // arrives
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('clap'); // the moment replaced the sleep
    await vi.advanceTimersByTimeAsync(1200);
    lastWalk().done(); // home
    await vi.advanceTimersByTimeAsync(1000);
    expect(state()).toBe('idle'); // awake, although no save came for 10 min
    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(state()).toBe('idle'); // still awake after 19 min without a save
  });

  it('P3: an idle glance during the friend visit turns Snip away from its friend while the friend leaves', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // a glance every 20 s from the mount
    const { pet, svg, state } = await mounted();
    const facing = () => played.filter((p) => p.el === svg).at(-1)!.keys[0].transform;
    await vi.advanceTimersByTimeAsync(618_000); // asleep since 600 s; glances fall at 20 s steps
    expect(state()).toBe('sleep');
    pet.petMoment('saved'); // t = 618.0 s
    played.at(-1)!.done(); // the friend arrives at once
    await vi.advanceTimersByTimeAsync(500 + 1200); // t = 619.7 s: tap and clap done, Snip idle, facing its friend
    expect(state()).toBe('idle');
    expect(facing()).toBe('translateX(0px) scaleX(-1)');
    await vi.advanceTimersByTimeAsync(1250); // the glance at 620.0 s, and its look back 900 ms later
    // t = 620.95 s: the friend is walking off to the right, but Snip now looks left, away from it
    expect(facing()).toBe('translateX(0px) scaleX(1)');
  });

  it('P4: a moment while the friend walks in lets the friend finish its walk-in to the empty spot before it leaves', async () => {
    const { pet } = await mounted();
    vi.advanceTimersByTime(10 * 60_000);
    pet.petMoment('saved');
    const friendIn = played.at(-1)!;
    pet.petMoment('clap', 'a'); // Snip leaves for tab a
    const n = walks().length;
    expect(walks()[n - 1]).toEqual(['translateX(0px) scaleX(1)', 'translateX(-88px) scaleX(1)']);
    friendIn.done(); // the friend's walk-in was not cut: it reaches the spot next to home
    await vi.advanceTimersByTimeAsync(0);
    expect(walks().at(-1)).toEqual(['translateX(24px) scaleX(-1)', 'translateX(924px) scaleX(-1)']); // only now it leaves
  });

  it('P5: a moment during the nap wakes Snip without the friend, and the next save brings no friend', async () => {
    const { pet, slot, state } = await mounted();
    vi.advanceTimersByTime(10 * 60_000);
    expect(state()).toBe('sleep');
    pet.petMoment('worried', 'a');
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(4000);
    played.at(-1)!.done(); // home
    await vi.advanceTimersByTimeAsync(1000);
    expect(state()).toBe('idle');
    pet.petMoment('saved');
    expect(slot.querySelector('svg.friend')).toBeNull(); // no visit: the save after the nap did not count
  });

  it('P6: a second save while the friend walks in sends the friend away and leaves Snip asleep', async () => {
    const { pet, slot, state } = await mounted();
    vi.advanceTimersByTime(10 * 60_000);
    expect(state()).toBe('sleep');
    pet.petMoment('saved'); // first autosave after the nap: the friend starts to walk in
    await vi.advanceTimersByTimeAsync(300);
    expect(state()).toBe('sleep'); // Snip sleeps until the friend taps it
    pet.petMoment('saved'); // a second write 300 ms later (autosave after a short pause, or Ctrl+S)
    await vi.advanceTimersByTimeAsync(0);
    const friend = slot.querySelector('svg.friend')!;
    const friendWalks = played.filter((p) => p.el === friend && p.opts.duration).map((p) => p.keys.at(-1)!.transform);
    // walk in, walk in again, then two walks out: the old visit's leave() cut the new visit's walk-in
    expect(friendWalks).toEqual(['translateX(24px) scaleX(1)', 'translateX(24px) scaleX(1)', 'translateX(924px) scaleX(-1)', 'translateX(924px) scaleX(-1)']);
    lastWalk().done(); // the friend reaches the window edge
    await vi.advanceTimersByTimeAsync(10_000);
    expect(friend.classList.contains('gone')).toBe(true);
    expect(state()).toBe('sleep'); // Snip never woke, although two saves came
    pet.petMoment('saved'); // only a third save, once the friend is gone, wakes it
    expect(state()).toBe('sleep');
  });
});
