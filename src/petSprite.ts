// Snip's drawing (pet.ts), loaded when the window is idle so the sprites cost the first paint nothing.
// Each state is a film strip: its frames side by side, in playing order, slid along by one animation.
import { NS } from './icons';
import type { State } from './pet';

// 11×11 frames. c claw, # and s body, p and m eye and mouth, b brow, z the sleeping z.
const FRAMES: Record<State, string[][]> = {
  idle: [
    ['c.c.....c.c', 'ccc.....ccc', 'c.........c', 'c.sss.sss.c', 'c.sps.sps.c', '.c.s...s.c.', '..#######..', '.#########.', '.####m####.', '..#######..', '.#.#...#.#.'],
    ['...........', 'c.c.....c.c', 'ccc.....ccc', 'c.........c', 'c.sss.sss.c', 'c.sps.sps.c', '.c#######c.', '.#########.', '.####m####.', '..#######..', '.#.#...#.#.'],
    ['c.c.....c.c', 'ccc.....ccc', 'c.........c', 'c.sss.sss.c', 'c.sss.sss.c', '.c.s...s.c.', '..#######..', '.#########.', '.####m####.', '..#######..', '.#.#...#.#.']
  ],
  clap: [
    ['.c.......c.', 'ccc.....ccc', 'c.........c', 'c.sss.sss.c', 'c.sps.sps.c', '.c.s...s.c.', '..#######..', '.#########.', '.###m#m###.', '..###m###..', '.#.#...#.#.'],
    ['c.c.....c.c', 'ccc.....ccc', 'c.........c', 'c.sss.sss.c', 'c.sps.sps.c', '.c.s...s.c.', '..#######..', '.#########.', '.###m#m###.', '..###m###..', '.#.#...#.#.']
  ],
  relief: [
    ['c.c.....c.c', 'ccc.....ccc', 'c.........c', 'c..s...s..c', 'c.s.s.s.s.c', '.c.s...s.c.', '..#######..', '.#########.', '.###m#m###.', '..###m###..', '.#.#...#.#.'],
    ['...........', 'c.c.....c.c', 'ccc.....ccc', 'c.........c', 'c..s...s..c', 'c.s.s.s.s.c', '.c#######c.', '.#########.', '.###m#m###.', '..###m###..', '.#.#...#.#.']
  ],
  worried: [
    ['c.c.....c.c', 'ccc.b.b.ccc', 'c..b...b..c', 'c.sss.sss.c', 'c.sps.sps.c', '.c.s...s.c.', '..#######..', '.#########.', '.####m####.', '..###m###..', '.#.#...#.#.'],
    ['.c.......c.', 'ccc.b.b.ccc', 'c..b...b..c', 'c.sss.sss.c', 'c.sps.sps.c', '.c.s...s.c.', '..#######..', '.#########.', '.####m####.', '..###m###..', '#.#.....#.#']
  ],
  // Asleep the eyes sit closed on the body: off it they would vanish against the bar.
  sleep: [
    ['........zzz', '.........z.', '........zzz', '...........', '...........', '...........', 'cc#######cc', 'c#pp###pp#c', '.#########.', '..#######..', '.#.#...#.#.'],
    ['........zzz', '.........z.', '........zzz', '...........', '...........', '...........', '..#######..', 'c#pp###pp#c', 'c#########c', '..#######..', '.#.#...#.#.']
  ]
};
const PART: Record<string, string> = { c: 'claw', '#': 'body', s: 'body', p: 'eye', m: 'eye', b: 'brow', z: 'zzz' };

/**
 * Each state's timing: `ms` per run, `runs` (Infinity loops), and when each frame starts, as
 * [offset 0–1, frame number from 1]. pet.ts waits `ms × runs` before going back to idle.
 */
export const TIMING: Record<State, { ms: number; runs: number; at: [number, number][] }> = {
  idle: { ms: 6000, runs: Infinity, at: [[0, 1], [0.3, 2], [0.55, 1], [0.88, 3], [0.91, 1]] }, // a breath, then a blink
  clap: { ms: 1200, runs: 1, at: [[0, 2], [0.08, 1], [0.17, 2], [0.25, 1], [0.42, 2]] },
  relief: { ms: 2400, runs: 1, at: [[0, 1], [0.35, 2], [0.75, 1]] },
  worried: { ms: 2000, runs: 2, at: [[0, 1], [0.6, 2], [0.65, 1], [0.7, 2], [0.75, 1]] },
  sleep: { ms: 4000, runs: Infinity, at: [[0, 1], [0.5, 2]] }
};

/** One path per part, cell runs joined per row, `dx` cells to the right. */
function frame(rows: string[], dx: number): SVGGElement {
  const g = document.createElementNS(NS, 'g');
  const d: Record<string, string> = {};
  rows.forEach((row, y) => {
    for (const m of row.matchAll(/([^.])\1*/g)) {
      const part = PART[m[1]];
      d[part] = (d[part] ?? '') + `M${dx + m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
    }
  });
  for (const [part, path] of Object.entries(d)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', part);
    p.setAttribute('d', path);
    g.append(p);
  }
  return g;
}

/**
 * Draws every state's frames into `svg` once, side by side per state, and returns how to play one:
 * show its strip and slide it from frame to frame. With reduced motion a state shows its first frame.
 */
export function drawPet(svg: SVGSVGElement): (state: State) => void {
  const states = Object.keys(FRAMES) as State[];
  const strips = states.map((state) => {
    const g = document.createElementNS(NS, 'g');
    g.append(...FRAMES[state].map((rows, i) => frame(rows, i * 11)));
    return g;
  });
  svg.replaceChildren(...strips);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  return (state) => {
    strips.forEach((g, i) => {
      g.getAnimations().forEach((a) => a.cancel());
      g.setAttribute('display', states[i] === state ? 'inline' : 'none');
    });
    const g = strips[states.indexOf(state)];
    const { ms, runs, at } = TIMING[state];
    const x = (n: number) => (1 - n) * 11;
    g.setAttribute('transform', `translate(${x(at[0][1])})`);
    const keys = at.map(([offset, n]) => ({ offset, easing: 'step-end', transform: `translateX(${x(n)}px)` }));
    if (!still.matches) g.animate([...keys, { ...keys[keys.length - 1], offset: 1 }], { duration: ms, iterations: runs });
  };
}
