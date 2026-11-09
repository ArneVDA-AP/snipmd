"""Derives walk numbers from a trace JSON written by run.sh. Usage: python analyze.py <ID>.json [key]."""
import json
import sys


def runs(samples, who='sn', gap=250):
    """Movement runs of one sprite: consecutive x changes no more than `gap` ms apart."""
    out, cur, prev = [], None, None
    for s in samples:
        c = s.get(who)
        if not c:
            continue
        if prev is not None and c['x'] != prev['x']:
            ch = {'t': s['t'], 'from': prev['x'], 'to': c['x'], 'dt': round(s['t'] - prev_t, 2), 'face': c['face'], 'top': c['t'], 'state': c['s']}
            if cur and s['t'] - cur[-1]['t'] <= gap:
                cur.append(ch)
            else:
                cur = [ch]
                out.append(cur)
        prev, prev_t = c, s['t']
    return out


def summarize(d, who='sn'):
    g = d.get('geom', {})
    cell = g.get('cell') or 2
    res = []
    for r in runs(d['samples'], who):
        deltas = [abs(c['to'] - c['from']) / cell for c in r]
        big = [(round(c['t']), round(abs(c['to'] - c['from']) / cell, 3), c['dt']) for c in r if abs(c['to'] - c['from']) / cell > 1.0001]
        res.append({
            'start_t': r[0]['t'], 'end_t': r[-1]['t'], 'dur_ms': round(r[-1]['t'] - r[0]['t'], 1),
            'from': r[0]['from'], 'to': r[-1]['to'], 'cells': round(abs(r[-1]['to'] - r[0]['from']) / cell, 3),
            'changes': len(r), 'max_delta_cells': round(max(deltas), 3), 'n_delta_gt1': len(big),
            'all_whole_cells': all(abs(x - round(x)) < 0.01 for x in deltas),
            'faces': sorted({c['face'] for c in r}), 'tops': sorted({c['top'] for c in r}),
            'first_big': big[:3], 'max_dt': max(c['dt'] for c in r),
        })
    return res


def walks(d, who=None):
    out = []
    for w in d['walks']:
        if who and w['who'] != who:
            continue
        if w['n'] > 2:
            kf = w['kf']
            xs = [float(k[1].split('translateX(')[1].split('px')[0]) for k in kf]
            steps = sorted({round(abs(b - a), 4) for a, b in zip(xs, xs[1:])})
            out.append({'who': w['who'], 't': w['t'], 'dur': w['dur'], 'keys': w['n'], 'from': xs[0], 'to': xs[-1], 'key_steps_px': steps, 'face': kf[0][1].split('scaleX(')[1].rstrip(')')})
        else:
            out.append({'who': w['who'], 't': w['t'], 'place': w['kf'][0]})
    return out


def states(samples, who='sn'):
    """State changes over time: [(t, state, x)]."""
    out, prev = [], None
    for s in samples:
        c = s.get(who)
        if not c:
            if prev != 'absent':
                out.append((s['t'], 'absent', None))
                prev = 'absent'
            continue
        key = c['s'] + (' gone' if c.get('gone') else '')
        if key != prev:
            out.append((s['t'], key, c['x']))
            prev = key
    return out


if __name__ == '__main__':
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    print('case', d.get('case'), 'pre', d.get('pre'))
    print('samples', len(d['samples']), 'span_ms', d['samples'][-1]['t'] - d['samples'][0]['t'] if d['samples'] else 0)
    dts = [b['t'] - a['t'] for a, b in zip(d['samples'], d['samples'][1:])]
    if dts:
        print('frame dt median', sorted(dts)[len(dts) // 2], 'max', max(dts))
    print('events', d['events'])
    for k in ('reachMs', 'quietMs', 'atTab', 'extra'):
        if k in d:
            print(k, d[k])
    for w in walks(d):
        print('walk', w)
    for who in ('sn', 'fr'):
        if any(who in s for s in d['samples']):
            print(who, 'states', states(d['samples'], who))
            for r in summarize(d, who):
                print(who, 'run', r)
    end = d['samples'][-1]
    print('last sample', end)
