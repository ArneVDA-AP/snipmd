"""Joins src/harness.js with each src/<ID>.body.js into <ID>.js, the file passed to run-code."""
import pathlib
import sys

here = pathlib.Path(__file__).parent
harness = (here / 'src' / 'harness.js').read_text(encoding='utf-8')
ids = sys.argv[1:] or [p.name[: -len('.body.js')] for p in (here / 'src').glob('*.body.js')]
for i in ids:
    body = (here / 'src' / f'{i}.body.js').read_text(encoding='utf-8')
    (here / f'{i}.js').write_text(harness.replace('/*CASE_BODY*/', body.strip('\n')), encoding='utf-8')
    print('built', i + '.js')
