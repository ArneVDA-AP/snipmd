// Snip's drawing (pet.ts), loaded after startup so the sprites cost the first paint nothing.
import type { State } from './pet';

const SVG = 'http://www.w3.org/2000/svg';

// 11×11 frames. c claw, # and s body, p eye, m mouth, b brow, z the sleeping z.
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

/** One path per part, cell runs joined per row: a frame is five elements, not a hundred rects. */
function frame(rows: string[], n: number): SVGGElement {
  const g = document.createElementNS(SVG, 'g');
  g.setAttribute('class', `frame frame-${n}`);
  const d: Record<string, string> = {};
  rows.forEach((row, y) => {
    for (const m of row.matchAll(/c+|[#s]+|[pm]+|b+|z+/g)) {
      const part = PART[m[0][0]];
      d[part] = (d[part] ?? '') + `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
    }
  });
  for (const [part, path] of Object.entries(d)) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('class', part);
    p.setAttribute('d', path);
    g.append(p);
  }
  return g;
}

/** Replaces the frames inside `svg` with the ones of `state`. */
export function drawPet(svg: Element, state: State): void {
  svg.replaceChildren(...FRAMES[state].map((rows, i) => frame(rows, i + 1)));
}
