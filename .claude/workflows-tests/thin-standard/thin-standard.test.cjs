// L0 test for thin-standard.js: deterministic, no tokens. Run: node thin-standard.test.cjs
// THIN_SCRIPT=<path> runs the same tests against another copy of the script (used for mutation checks).
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')

const SCRIPT = process.env.THIN_SCRIPT || path.join(os.homedir(), '.claude', 'workflows', 'thin-standard.js')
const src = fs.readFileSync(SCRIPT, 'utf8').split('\r\n').join('\n')
assert(/export const meta\b/.test(src), 'script must start with export const meta')

// Rewrite to a loadable CommonJS module in a temp file; the test removes it on exit.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'thin-standard-test-')), 'script.cjs')
const body = src.replace('export const meta', 'const meta')
const metaMatch = body.match(/^const meta = \{[\s\S]*?\n\}\n/)
fs.writeFileSync(tmp, `${metaMatch[0]}\nmodule.exports = { meta, run: async function (args, agent, parallel, log) {\n${body.slice(metaMatch[0].length)}\n} }\n`)
process.on('exit', () => { try { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }) } catch {} })
const mod = require(tmp)

const parallel = fns => Promise.all(fns.map(f => f()))

// Run the script with a mock agent. handler(prompt, opts, n) returns the handoff (or null).
async function run(args, handler = () => ok()) {
  const calls = []
  const logs = []
  const agent = async (prompt, opts) => { const c = { prompt, opts }; calls.push(c); return handler(prompt, opts, calls.length - 1) }
  const result = await mod.run(args, agent, parallel, m => logs.push(m))
  return { result, calls, logs }
}

const ok = (o = {}) => ({ status: 'done', outputs: [], checks: [], proves: [], defects: [], for_coordinator: [], ...o })
const unit = (id, o = {}) => ({ id, agentType: 'thin-builder', task: `task ${id}`, output: `out ${id}`, owns: [`src/${id}.py`], ...o })
// disk_check is off in the shared base so the older tests keep their exact agent counts; the disk tests turn it on.
const base = (phases, o = {}) => ({ goal: 'g', root: 'C:/dev/proj', contract: { shared: ['src/types.py'], signatures: [{ id: 'S1', owner: 'B1', signature: 'def f() -> int' }] }, phases, disk_check: false, ...o })
const phase = (title, units) => ({ title, units })

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const gap = (name, fn) => tests.push({ name, fn, gap: true }) // documents a script gap; fails the run only when the gap closes

// ---- validation: refused, and no agent is ever called ----
const refused = async (args, needle) => {
  const { result, calls } = await run(args)
  assert.strictEqual(result.status, 'refused', `expected refused, got ${JSON.stringify(result).slice(0, 200)}`)
  assert(result.errors.some(e => e.includes(needle)), `no error containing "${needle}" in ${JSON.stringify(result.errors)}`)
  assert.strictEqual(calls.length, 0, 'no agent may start after a refusal')
}

test('refuses owns that overlaps contract.shared', () => refused(base([phase('Build', [unit('B1', { owns: ['src/types.py'] })])]), 'contract.shared'))
test('refuses owns inside a contract.shared folder', () => refused(base([phase('Build', [unit('B1', { owns: ['pkg/sub/x.py'] })])], { contract: { shared: ['pkg'] } }), 'contract.shared'))
test('refuses overlapping owns in the same phase', () => refused(base([phase('Build', [unit('B1', { owns: ['src/a'] }), unit('B2', { owns: ['src/a/x.py'] })])]), 'overlapping B1'))
test('allows the same path in different phases', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { owns: ['src/a.py'] })]), phase('Fix', [unit('B2', { owns: ['src/a.py'] })])]))
  assert.strictEqual(result.status, 'done')
})
test('refuses an unknown seam', () => refused(base([phase('Build', [unit('B1', { seams: ['S9'] })])]), 'seam S9'))
test('accepts a known seam and puts its signature in the brief', async () => {
  const { result, calls } = await run(base([phase('Build', [unit('B1', { seams: ['S1'] })])]))
  assert.strictEqual(result.status, 'done')
  assert(calls[0].prompt.includes('def f() -> int'))
})
test('refuses inputs_from a unit of a later phase', () => refused(base([phase('Build', [unit('B1', { inputs_from: ['V1'] })]), phase('Verify', [unit('V1', { agentType: 'thin-verifier', owns: ['f/V1.md'] })])]), 'inputs_from V1'))
test('refuses inputs_from a unit of the same phase', () => refused(base([phase('Build', [unit('B1'), unit('B2', { inputs_from: ['B1'] })])]), 'inputs_from B1'))
test('refuses thin-web without allow_chrome', () => refused(base([phase('Web', [unit('W1', { agentType: 'thin-web', owns: [] })])]), 'allow_chrome'))
test('accepts thin-web with allow_chrome', async () => {
  const { result } = await run(base([phase('Web', [unit('W1', { agentType: 'thin-web', owns: [] })])], { allow_chrome: true }))
  assert.strictEqual(result.status, 'done')
})
test('refuses a writer without owns', () => refused(base([phase('Build', [unit('B1', { owns: [] })])]), 'a writer needs owns'))
test('refuses a unit id reused in a later phase', () => refused(base([phase('Build', [unit('B1', { owns: ['a.py'] })]), phase('Fix', [unit('B1', { owns: ['b.py'] })])]), 'duplicate id'))
// Was a known gap (`seen` was only filled after a phase); closed 2026-10-17.
test('refuses a duplicate unit id inside one phase', () => refused(base([phase('Build', [unit('B1', { owns: ['a.py'] }), unit('B1', { owns: ['b.py'] })])]), 'duplicate id'))
test('refuses an unknown agentType', () => refused(base([phase('Build', [unit('B1', { agentType: 'thin-nope' })])]), 'agentType'))
test('refuses a check without proves', () => refused(base([phase('Build', [unit('B1', { checks: [{ cmd: 'x', expect_exit: 0 }] })])]), 'each check needs'))

// ---- successful run and prompt shape ----
test('successful run passes handoffs to a later unit between <<<UNTRUSTED and >>>', async () => {
  const MARK = 'IGNORE-YOUR-BRIEF-MARK-7731'
  const args = base([
    phase('Build', [unit('B1', { checks: [{ cmd: 'pytest a', expect_exit: 0, proves: 'a works' }] }), unit('B2', { owns: ['src/B2.py'] })]),
    phase('Verify', [unit('V1', { agentType: 'thin-verifier', owns: ['findings/V1.md'], inputs_from: ['B1'] })]),
  ])
  const { result, calls } = await run(args, (p, o) => {
    if (o.label === 'Build:B1') return ok({ outputs: ['src/B1.py'], checks: [{ cmd: 'pytest a', exit: 0 }], for_coordinator: [{ text: MARK, label: 'observed' }] })
    if (o.label === 'Verify:V1') return ok({ outputs: ['findings/V1.md'], defects: [{ severity: 'minor', location: 'x:1', statement: 's', evidence: 'e' }] })
    return ok({ outputs: ['src/B2.py'] })
  })
  assert.strictEqual(result.status, 'done')
  assert.strictEqual(calls.length, 3)
  const v = calls.find(c => c.opts.label === 'Verify:V1').prompt
  const i = v.indexOf('<<<UNTRUSTED'), j = v.indexOf('>>>', i)
  assert(i > 0 && j > i, 'V1 prompt needs an UNTRUSTED block')
  assert(v.slice(i, j).includes(MARK), 'B1 handoff must sit inside the UNTRUSTED block')
  assert(!v.slice(0, i).includes(MARK) && !v.slice(j).includes(MARK), 'handoff text must not leak outside the block')
  assert(!v.slice(i, j).includes('Build:B2') && !v.slice(i, j).includes('"unit": "B2"'), 'only inputs_from units appear in the block')
  assert(!calls.find(c => c.opts.label === 'Build:B1').prompt.includes('UNTRUSTED'), 'a unit without inputs_from gets no block')
  assert.strictEqual(result.minors.length, 1)
  assert.strictEqual(result.minors[0].unit, 'V1')
  assert.strictEqual(result.for_coordinator[0].text, MARK)
})
test('agent options: agentType, schema, label; model and effort only when set', async () => {
  const { calls } = await run(base([phase('Build', [unit('B1', { model: 'haiku', effort: 'low' }), unit('B2', { owns: ['src/B2.py'] })])]))
  const a = calls.find(c => c.opts.label === 'Build:B1').opts, b = calls.find(c => c.opts.label === 'Build:B2').opts
  assert.strictEqual(a.agentType, 'thin-builder'); assert.strictEqual(a.model, 'haiku'); assert.strictEqual(a.effort, 'low')
  assert(a.schema && a.schema.required.includes('status'))
  assert(!('model' in b) && !('effort' in b), 'omitted model/effort must not appear in options')
})
test('units of one phase run in parallel (both started before either finishes)', async () => {
  let open = 0, peak = 0
  await run(base([phase('Build', [unit('B1'), unit('B2')])]), async () => { open++; peak = Math.max(peak, open); await new Promise(r => setTimeout(r, 20)); open--; return ok() })
  assert.strictEqual(peak, 2)
})

// ---- stop rules ----
const stopsAfterBuild = async (handler, needle, extra = {}) => {
  const args = base([
    phase('Build', [unit('B1', { checks: [{ cmd: 'pytest a', expect_exit: 0, proves: 'p' }], ...extra })]),
    phase('Verify', [unit('V1', { agentType: 'thin-verifier', owns: ['findings/V1.md'], inputs_from: ['B1'] })]),
  ])
  const { result, calls } = await run(args, handler)
  assert.strictEqual(result.status, 'stopped')
  assert.strictEqual(result.stopped_at, 'Build')
  assert(result.problems.some(p => p.includes(needle)), `no problem containing "${needle}" in ${JSON.stringify(result.problems)}`)
  assert.strictEqual(calls.length, 1, 'Verify must not start')
  assert(!calls.some(c => c.opts.phase === 'Verify'))
  return result
}
test('a red check stops after Build', () => stopsAfterBuild(() => ok({ checks: [{ cmd: 'pytest a', exit: 1 }] }), 'exit 1, expected 0'))
test('a declared check that was not run stops after Build', () => stopsAfterBuild(() => ok({ checks: [] }), 'check not run'))
test('a check that exits non-zero as declared (expect_exit 1) is green', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { checks: [{ cmd: 'c', expect_exit: 1, proves: 'fails on purpose' }] })])]), () => ok({ checks: [{ cmd: 'c', exit: 1 }] }))
  assert.strictEqual(result.status, 'done')
})
test('a major defect stops', () => stopsAfterBuild(() => ok({ checks: [{ cmd: 'pytest a', exit: 0 }], defects: [{ severity: 'major', location: 'a:1', statement: 's', evidence: 'e' }] }), 'major at a:1'))
test('a blocker defect stops', () => stopsAfterBuild(() => ok({ checks: [{ cmd: 'pytest a', exit: 0 }], defects: [{ severity: 'blocker', location: 'a:1', statement: 's', evidence: 'e' }] }), 'blocker at a:1'))
test('a minor defect does not stop', async () => {
  const { result } = await run(base([phase('Build', [unit('B1')])]), () => ok({ defects: [{ severity: 'minor', location: 'a:1', statement: 's', evidence: 'e' }] }))
  assert.strictEqual(result.status, 'done'); assert.strictEqual(result.minors.length, 1)
})
test('status blocked stops', () => stopsAfterBuild(() => ok({ status: 'blocked', checks: [{ cmd: 'pytest a', exit: 0 }] }), 'status blocked'))
test('an agent that returns null stops', () => stopsAfterBuild(() => null, 'no handoff'))
test('a reported output outside owns stops', () => stopsAfterBuild(() => ok({ checks: [{ cmd: 'pytest a', exit: 0 }], outputs: ['src/other.py'] }), 'outside owns'))
test('the report lists the stopped phase with its handoff', async () => {
  const r = await stopsAfterBuild(() => ok({ checks: [{ cmd: 'pytest a', exit: 7 }] }), 'exit 7')
  assert.strictEqual(r.report.length, 1); assert.strictEqual(r.report[0].units[0].handoff.checks[0].exit, 7)
})
test('one red unit stops the phase even if its sibling is green', async () => {
  const { result, calls } = await run(base([phase('Build', [unit('B1'), unit('B2')]), phase('Verify', [unit('V1', { agentType: 'thin-verifier', owns: ['f.md'] })])]), (p, o) => o.label === 'Build:B2' ? null : ok())
  assert.strictEqual(result.status, 'stopped'); assert.strictEqual(calls.length, 2)
  assert(result.problems.every(p => p.startsWith('B2')))
})

// ---- path normalisation ----
test('absolute backslash mixed-case owns collides with a relative shared path', () =>
  refused(base([phase('Build', [unit('B1', { owns: ['C:\\DEV\\Proj\\Src\\Types.PY'] })])]), 'contract.shared'))
test('absolute shared path collides with a relative owns path', () =>
  refused(base([phase('Build', [unit('B1', { owns: ['SRC\\types.py'] })])], { contract: { shared: ['c:/dev/proj/src/types.py'] } }), 'contract.shared'))
test('trailing slash and root casing do not hide an overlap', () =>
  refused(base([phase('Build', [unit('B1', { owns: ['src\\a\\'] }), unit('B2', { owns: ['C:/DEV/PROJ/src/a/x.py'] })])]), 'overlapping B1'))
test('a path that only shares a name prefix is not an overlap', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { owns: ['src/a'] }), unit('B2', { owns: ['src/ab.py'] })])]))
  assert.strictEqual(result.status, 'done')
})
test('absolute backslash output matches a relative owns', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { owns: ['src/B1.py'] })])]), () => ok({ outputs: ['C:\\dev\\proj\\SRC\\b1.PY'] }))
  assert.strictEqual(result.status, 'done')
})
test('an output in a sibling root with the same prefix is outside owns', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { owns: ['src/B1.py'] })])]), () => ok({ outputs: ['C:/dev/proj2/src/B1.py'] }))
  assert.strictEqual(result.status, 'stopped')
})

// ---- unit without checks, owns as folder ----
test('a unit without checks passes on a plain done handoff', async () => {
  const { result } = await run(base([phase('Review', [unit('R1', { agentType: 'thin-review', owns: ['review/R1.md'], checks: undefined })])]), () => ok({ outputs: ['review/R1.md'] }))
  assert.strictEqual(result.status, 'done')
})
test('a read-only unit (no owns) passes', async () => {
  const { result } = await run(base([phase('Review', [unit('R1', { agentType: 'thin-review', owns: undefined })])]), () => ok())
  assert.strictEqual(result.status, 'done')
})
test('owns as a folder accepts outputs inside it', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { owns: ['src/pkg/'] })])]), () => ok({ outputs: ['src/pkg/a.py', 'src\\pkg\\sub\\b.py'] }))
  assert.strictEqual(result.status, 'done')
})
test('owns as a folder rejects an output outside it', async () => {
  const { result } = await run(base([phase('Build', [unit('B1', { owns: ['src/pkg'] })])]), () => ok({ outputs: ['src/pkg2/a.py'] }))
  assert.strictEqual(result.status, 'stopped'); assert(result.problems[0].includes('outside owns'))
})
test('refuses a file owned inside another unit\'s folder (same phase)', () =>
  refused(base([phase('Build', [unit('B1', { owns: ['src/pkg'] }), unit('B2', { owns: ['src/pkg/m.py'] })])]), 'overlapping'))
test('refuses empty args and an empty phases list', async () => {
  for (const a of [null, { root: 'C:/x' }, { root: 'C:/x', phases: [] }]) {
    const { result } = await run(a); assert.strictEqual(result.status, 'refused')
  }
})

// ---- review findings (thin-review defects are the product, not a gate failure) ----
const review = (id, o = {}) => unit(id, { agentType: 'thin-review', owns: [`review/${id}.md`], ...o })
const blocker = { severity: 'blocker', location: 'l:1', statement: 's', evidence: 'e' }
test('a review blocker in the last phase ends done, with the finding in findings', async () => {
  const { result } = await run(base([phase('Build', [unit('B1')]), phase('Review', [review('R1')])]),
    (p, o) => o.label === 'Review:R1' ? ok({ defects: [blocker] }) : ok())
  assert.strictEqual(result.status, 'done', JSON.stringify(result).slice(0, 200))
  assert.strictEqual(result.findings.length, 1); assert.strictEqual(result.findings[0].unit, 'R1')
  assert.strictEqual(result.minors.length, 0)
})
test('a review blocker before a later phase returns needs_decision and the later phase does not start', async () => {
  const { result, calls } = await run(base([phase('Review', [review('R1')]), phase('Fix', [unit('F1')])]),
    (p, o) => o.label === 'Review:R1' ? ok({ defects: [blocker] }) : ok())
  assert.strictEqual(result.status, 'needs_decision'); assert.strictEqual(result.stopped_at, 'Review')
  assert.strictEqual(result.findings.length, 1)
  assert(!calls.some(c => c.opts.label === 'Fix:F1'), 'Fix must not start')
})
test('a review with only minor findings before a later phase continues', async () => {
  const { result, calls } = await run(base([phase('Review', [review('R1')]), phase('Fix', [unit('F1')])]),
    (p, o) => o.label === 'Review:R1' ? ok({ defects: [{ ...blocker, severity: 'minor' }] }) : ok())
  assert.strictEqual(result.status, 'done'); assert(calls.some(c => c.opts.label === 'Fix:F1'))
})
test('findings: false on a review restores the old stop rule', async () => {
  const { result } = await run(base([phase('Review', [review('R1', { findings: false })])]), () => ok({ defects: [blocker] }))
  assert.strictEqual(result.status, 'stopped')
})
test('a verifier major still stops (verifier is not a findings unit)', async () => {
  const { result } = await run(base([phase('Verify', [unit('V1', { agentType: 'thin-verifier', owns: ['f/V1.md'] })])]),
    () => ok({ defects: [{ ...blocker, severity: 'major' }] }))
  assert.strictEqual(result.status, 'stopped')
})
test('a review that fails its own check still stops', async () => {
  const { result } = await run(base([phase('Review', [review('R1', { checks: [{ cmd: 'test -s r', expect_exit: 0, proves: 'p' }] })])]),
    () => ok({ checks: [{ cmd: 'test -s r', exit: 1 }], defects: [blocker] }))
  assert.strictEqual(result.status, 'stopped')
})
test('refuses a non-boolean findings field', () => refused(base([phase('Review', [review('R1', { findings: 'yes' })])]), 'findings must be'))

// ---- disk check (git status against owns; default on) ----
const isDisk = o => String(o.label).endsWith(':disk')
const git = (paths, exit = 0) => ({ cmd: 'git status --porcelain=v1 --untracked-files=all', exit, paths })
// handler: disk scans answer from `scans` in call order (baseline first); units answer ok()
const withDisk = (scans, unitHandler = () => ok()) => { let n = 0; return (p, o) => isDisk(o) ? scans[Math.min(n++, scans.length - 1)] : unitHandler(p, o) }
const twoPhases = (o = {}) => base([phase('Build', [unit('B1')]), phase('Verify', [unit('V1', { agentType: 'thin-verifier', owns: ['findings/V1.md'] })])], { disk_check: true, ...o })

test('disk check is on by default: one scan before phase 1 and one after each phase, as a read-only thin-mech', async () => {
  const args = twoPhases(); delete args.disk_check
  const { result, calls } = await run(args, withDisk([git([])]))
  assert.strictEqual(result.status, 'done')
  const scans = calls.filter(c => isDisk(c.opts))
  assert.strictEqual(scans.length, 3)
  assert(scans.every(c => c.opts.agentType === 'thin-mech' && c.opts.effort === 'low' && c.opts.schema.required.includes('paths')))
  assert.strictEqual(scans[0].opts.label, 'Build:disk'); assert.strictEqual(scans[2].opts.label, 'Verify:disk')
  assert(scans[0].prompt.includes('change nothing'))
  assert.strictEqual(result.disk.mode, 'checked')
})
test('disk_check: false spawns no scan and reports mode off', async () => {
  const { result, calls } = await run(twoPhases({ disk_check: false }), withDisk([git([])]))
  assert.strictEqual(result.status, 'done'); assert.strictEqual(result.disk.mode, 'off')
  assert.strictEqual(calls.filter(c => isDisk(c.opts)).length, 0)
})
test('a changed file outside owns stops the phase even when the agent reported nothing', async () => {
  const { result, calls } = await run(twoPhases(), withDisk([git([]), git(['C:/dev/proj/src/B1.py', 'C:/dev/proj/src/other.py'])]))
  assert.strictEqual(result.status, 'stopped'); assert.strictEqual(result.stopped_at, 'Build')
  assert(result.problems.some(p => p.includes('disk: src/other.py') && p.includes('outside the owns')), JSON.stringify(result.problems))
  assert(!result.problems.some(p => p.includes('src/b1.py')), 'the owned file is not a problem')
  assert(!calls.some(c => c.opts.label === 'Verify:V1'), 'Verify must not start')
})
test('a changed file inside owns passes and is listed in disk.changed', async () => {
  const { result } = await run(twoPhases(), withDisk([git([]), git(['C:\\dev\\proj\\SRC\\b1.py']), git(['C:/dev/proj/src/B1.py', 'C:/dev/proj/findings/V1.md'])]))
  assert.strictEqual(result.status, 'done', JSON.stringify(result.problems))
  assert.deepStrictEqual(result.disk.changed.sort(), ['findings/v1.md', 'src/b1.py'])
})
test('a file dirty before phase 1 is baseline and not a problem', async () => {
  const dirty = 'C:/dev/proj/notes.txt'
  const { result } = await run(twoPhases(), withDisk([git([dirty]), git([dirty, 'C:/dev/proj/src/B1.py'])]))
  assert.strictEqual(result.status, 'done', JSON.stringify(result.problems))
  assert.strictEqual(result.disk.baseline, 1); assert.deepStrictEqual(result.disk.changed, ['src/b1.py'])
})
test('a changed contract.shared file stops with its own message', async () => {
  const { result } = await run(twoPhases(), withDisk([git([]), git(['C:/dev/proj/src/types.py'])]))
  assert.strictEqual(result.status, 'stopped')
  assert(result.problems.some(p => p.includes('disk: src/types.py') && p.includes('contract.shared')), JSON.stringify(result.problems))
})
test('a later phase may change a file owned in an earlier phase', async () => {
  const { result } = await run(twoPhases(), withDisk([git([]), git(['C:/dev/proj/src/B1.py']), git(['C:/dev/proj/src/B1.py', 'C:/dev/proj/findings/V1.md'])]))
  assert.strictEqual(result.status, 'done', JSON.stringify(result.problems))
})
test('a changed file outside the project root is outside owns', async () => {
  const { result } = await run(twoPhases(), withDisk([git([]), git(['C:/dev/proj2/src/B1.py'])]))
  assert.strictEqual(result.status, 'stopped'); assert(result.problems[0].includes('c:/dev/proj2/src/b1.py'))
})
test('git unavailable (non-zero exit) makes the check unavailable, logs it, and the run continues', async () => {
  const { result, calls, logs } = await run(twoPhases(), withDisk([{ cmd: 'git rev-parse --show-toplevel', exit: 128, paths: [] }]))
  assert.strictEqual(result.status, 'done'); assert.strictEqual(result.disk.mode, 'unavailable')
  assert(result.disk.reason.includes('exit 128'))
  assert(logs.some(l => l.includes('disk check unavailable')), JSON.stringify(logs))
  assert.strictEqual(calls.filter(c => isDisk(c.opts)).length, 1, 'no further scans after unavailable')
})
test('a disk scan that returns null makes the check unavailable instead of passing silently', async () => {
  const { result } = await run(twoPhases(), (p, o) => isDisk(o) ? null : ok())
  assert.strictEqual(result.status, 'done'); assert.strictEqual(result.disk.mode, 'unavailable'); assert.strictEqual(result.disk.reason, 'no handoff')
})
test('disk problems and gate problems are reported together', async () => {
  const { result } = await run(twoPhases(), withDisk([git([]), git(['C:/dev/proj/x.py'])], () => ok({ status: 'blocked' })))
  assert.strictEqual(result.status, 'stopped')
  assert(result.problems.some(p => p.includes('status blocked')) && result.problems.some(p => p.startsWith('disk:')))
})

// ---- runner ----
;(async () => {
  let failed = 0
  for (const t of tests) {
    const first = e => String(e.message).split('\n')[0]
    try {
      await t.fn()
      if (t.gap) { failed++; console.log(`GAP-CLOSED ${t.name} (script now passes: change gap() to test())`) } else console.log(`ok   ${t.name}`)
    } catch (e) {
      if (t.gap) console.log(`GAP  ${t.name}\n     known script gap: ${first(e).slice(0, 90)}`)
      else { failed++; console.log(`FAIL ${t.name}\n     ${first(e)}`) }
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} as expected (${SCRIPT})`)
  process.exitCode = failed ? 1 : 0
})()
