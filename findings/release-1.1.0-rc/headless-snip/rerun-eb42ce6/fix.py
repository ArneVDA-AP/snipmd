import pathlib
p = pathlib.Path(__file__).parent / 'src' / 'harness.js'
t = p.read_text(encoding='utf-8')
a = 'out\\\\headless-snip\\\\\';'
assert a in t
p.write_text(t.replace(a, 'out\\\\headless-snip\\\\rerun-eb42ce6\\\\\';'), encoding='utf-8')
