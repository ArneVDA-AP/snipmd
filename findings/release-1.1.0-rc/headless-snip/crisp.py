"""Pixel check of the CT2 clips: inside Snip's box, every pixel must be a sprite colour or the background,
and every run of one sprite colour along a row must be a whole number of cells. Writes 8x enlargements.
Usage: python crisp.py  (reads CT2.json and the full-viewport CT2-dpr*-home.png / -at-tab.png next to it)."""
import json
import pathlib
from collections import Counter

from PIL import Image

here = pathlib.Path(__file__).parent
SPRITE = {(123, 79, 214): 'body', (95, 143, 10): 'claw', (255, 255, 255): 'eye', (36, 36, 36): 'pupil'}  # light theme, CT1.json


def check(png, cell, rect, dpr):
    """`rect` is Snip's box in CSS px (l, t, w); the full-viewport PNG is cropped to it plus 3 device px."""
    full = Image.open(here / png).convert('RGB')
    l, t, wd = rect
    box = (int(l * dpr) - 3, int(t * dpr) - 3, int((l + wd) * dpr + 0.999) + 3, int((t + wd) * dpr + 0.999) + 3)
    im = full.crop(box)
    png = png.replace('.png', '-clip.png')
    im.save(here / png)
    w, h = im.size
    px = im.load()
    pts = [(x, y) for y in range(h) for x in range(w) if px[x, y] in ((123, 79, 214), (95, 143, 10))]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    box = [px[x, y] for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    count = Counter(box)
    bg = [c for c, _ in count.most_common() if c not in SPRITE][:1]
    stray = {c: n for c, n in count.items() if c not in SPRITE and c not in bg}
    bad_runs = Counter()
    for y in range(y0, y1 + 1):
        x = x0
        while x <= x1:
            c = px[x, y]
            n = 1
            while x + n <= x1 and px[x + n, y] == c:
                n += 1
            if c in SPRITE and n % cell:
                bad_runs[n] += 1
            x += n
    big = im.resize((w * 8, h * 8), Image.NEAREST)
    name = png.replace('.png', '-x8.png')
    big.save(here / name)
    return {'png': png, 'size': [w, h], 'box_dev': [x0, y0, x1 - x0 + 1, y1 - y0 + 1], 'box_cells': [(x1 - x0 + 1) / cell, (y1 - y0 + 1) / cell],
            'background': bg, 'stray_colours': len(stray), 'stray_pixels': sum(stray.values()), 'stray_sample': list(stray.items())[:4],
            'runs_not_whole_cells': dict(bad_runs), 'enlarged': name}


d = json.load(open(here / 'CT2.json', encoding='utf-8'))
out = []
for k, v in d['byScale'].items():
    cell = round(v['geom']['cell'] * v['geom']['dpr'])
    dpr = v['geom']['dpr']
    sv, at = v['geom']['svg'], v['atTab']
    for png, rect in ((v['shots'][0], (sv['l'], sv['t'], sv['w'])), (v['shots'][2], (at['l'], at['t'], at['w']))):
        r = check(png, cell, rect, dpr)
        r['dsf'] = k
        r['cell_dev'] = cell
        out.append(r)
        print(r)
json.dump(out, open(here / 'CT2-pixels.json', 'w', encoding='utf-8'), indent=1)
