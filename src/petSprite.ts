// Snip's drawing (pet.ts), loaded when the window is idle so the sprites cost the first paint nothing.
// Each state is a film strip: its frames side by side, in playing order, slid along by one animation.
import { NS } from './icons';
import type { State, Timing } from './pet';

// 11×11 frames. c claw, # body, k eye and mouth, w pupil, z the sleeping z. Eyes and mouth sit on the body,
// so they read against it in both themes.
const FRAMES: Record<State, string[][]> = {
  idle: [
    ['...........', 'c.c.....c.c', 'ccc.....ccc', 'ccc.....ccc', '.cc#####cc.', '.##wk#wk##.', '###kk#kk###', '###########', '.#########.', '#.#.....#.#', '#..#...#..#'],
    ['c.c.....c.c', 'ccc.....ccc', 'ccc.....ccc', '.c.......c.', '.cc#####cc.', '.##wk#wk##.', '###kk#kk###', '###########', '.#########.', '#.#.....#.#', '#..#...#..#'],
    ['...........', 'c.c.....c.c', 'ccc.....ccc', 'ccc.....ccc', '.cc#####cc.', '.#########.', '###kk#kk###', '###########', '.#########.', '#.#.....#.#', '#..#...#..#']
  ],
  clap: [
    ['c.c.....c.c', 'ccc.....ccc', 'ccc.....ccc', '.c.......c.', '.cc#####cc.', '.##wk#wk##.', '###kk#kk###', '###########', '.###kkk###.', '#.#.....#.#', '#..#...#..#'],
    ['...........', '..ccc.ccc..', '..ccc.ccc..', '...c...c...', '...c###c...', '.##wk#wk##.', '###kk#kk###', '###########', '.###kkk###.', '#.#.....#.#', '#..#...#..#']
  ],
  relief: [
    ['...........', 'c.c.....c.c', 'ccc.....ccc', 'ccc.....ccc', '.cc#####cc.', '.#########.', '###kk#kk###', '###########', '.####k####.', '#.#.....#.#', '#..#...#..#'],
    ['...........', '...........', '...........', 'c.c.....c.c', 'ccc#####ccc', '.c#######c.', '###kk#kk###', '###########', '.####k####.', '#.#.....#.#', '#..#...#..#']
  ],
  worried: [
    ['...........', '...........', 'c.c.....c.c', 'ccc.....ccc', 'ccc#####ccc', '.##kw#kw##.', '###kk#kk###', '###########', '###kkkkk###', '.#########.', '#.#.....#.#'],
    ['...........', '...........', '.c.c...c.c.', '.ccc...ccc.', '.ccc###ccc.', '.##kw#kw##.', '###kk#kk###', '###########', '###kkkkk###', '.#########.', '.#.#...#.#.']
  ],
  sleep: [
    ['......zzzz.', '........z..', '.......z...', '......zzzz.', '...........', '..#######..', 'c#########c', 'cc#kk#kk#cc', '###########', '.#########.', '#.#.....#.#'],
    ['......zzzz.', '........z..', '.......z...', '......zzzz.', '...........', '...........', 'c.#######.c', 'cc#######cc', '##kk###kk##', '.#########.', '#.#.....#.#']
  ]
};
const PART: Record<string, string> = { c: 'claw', '#': 'body', k: 'eye', w: 'pupil', z: 'zzz' };
/** When each frame starts within a run, as [offset 0–1, frame number from 1]. */
const AT: Record<State, [number, number][]> = {
  idle: [[0, 1], [0.3, 2], [0.55, 1], [0.88, 3], [0.91, 1]], // a breath, then a blink
  clap: [[0, 2], [0.08, 1], [0.17, 2], [0.25, 1], [0.42, 2]],
  relief: [[0, 1], [0.35, 2], [0.75, 1]],
  worried: [[0, 1], [0.6, 2], [0.65, 1], [0.7, 2], [0.75, 1]],
  sleep: [[0, 1], [0.5, 2]]
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
 * show its strip and slide it from frame to frame. `timing` is passed in so this chunk imports nothing
 * at run time. With reduced motion a state shows its first frame. An unfocused window plays nothing:
 * the idle breath and the nap need no frames nobody sees.
 */
export function drawPet(svg: SVGSVGElement, timing: Timing): (state: State) => void {
  const states = Object.keys(FRAMES) as State[];
  const strips = states.map((state) => {
    const g = document.createElementNS(NS, 'g');
    g.append(...FRAMES[state].map((rows, i) => frame(rows, i * 11)));
    return g;
  });
  svg.replaceChildren(...strips);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener('blur', () => svg.getAnimations({ subtree: true }).forEach((a) => a.pause()));
  window.addEventListener('focus', () => svg.getAnimations({ subtree: true }).forEach((a) => a.play()));
  return (state) => {
    strips.forEach((g, i) => {
      g.getAnimations().forEach((a) => a.cancel());
      g.setAttribute('display', states[i] === state ? 'inline' : 'none');
    });
    const g = strips[states.indexOf(state)];
    const { ms, runs } = timing[state];
    const at = AT[state];
    const x = (n: number) => (1 - n) * 11;
    g.setAttribute('transform', `translate(${x(at[0][1])})`);
    const keys = at.map(([offset, n]) => ({ offset, easing: 'step-end', transform: `translateX(${x(n)}px)` }));
    if (still.matches) return;
    const a = g.animate([...keys, { ...keys[keys.length - 1], offset: 1 }], { duration: ms, iterations: runs });
    if (!document.hasFocus()) a.pause(); // the focus listener above plays it
  };
}
