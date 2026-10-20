export const meta = {
  name: 'thin-standard',
  description: 'Thin orchestration runner: validates a contract, runs thin-* units phase by phase, stops at the first red gate',
  whenToUse: 'Any multi-agent job the main session has already designed: it passes the contract and every brief in args; the script only dispatches and gates.',
}

// Standard workflow shape (Arne, 2026-10-16). The main session designs; this script decides nothing.
// It is self-contained: no kit, no substrate, no handoff files. The brief goes in the prompt and the
// handoff comes back through the HANDOFF schema.
//
// args = {
//   goal: 'one line, shown in logs',
//   root: 'C:/dev/project',                       // absolute project root
//   contract: {
//     shared: ['src/types.rs'],                   // built by the main session beforehand; no unit may own these
//     signatures: [{ id: 'S1', owner: 'B1', signature: 'pub fn parse(s: &str) -> Result<Cfg>', doc: '...' }],
//   },
//   phases: [                                     // run in order; units inside a phase run in parallel
//     { title: 'Build', units: [{
//         id: 'B1', agentType: 'thin-builder',
//         task: '...', output: '...',             // what to do, and the exact form of what comes back
//         owns: ['src/parse.rs', 'tests/parse.rs'],  // the only paths this unit may write; disjoint within a phase
//         reads: ['src/types.rs'],
//         seams: ['S1'],                          // contract signatures this unit implements or calls
//         checks: [{ cmd: 'cargo test parse', expect_exit: 0, proves: 'a malformed line is rejected' }],
//         inputs_from: [],                        // ids of units in earlier phases whose handoffs this unit gets
//         limits: 'max 300 lines per file',       // optional
//         model: undefined, effort: undefined,    // optional; omitted = the agent's frontmatter model
//     }] },
//     { title: 'Verify', units: [{ id: 'V1', agentType: 'thin-verifier', owns: ['findings/V1.md'], inputs_from: ['B1'], ... }] },
//     { title: 'Review', units: [{ id: 'R1', agentType: 'thin-review', owns: ['review/R1.md'], inputs_from: ['B1', 'V1'], ... }] },
//   ],
//   allow_chrome: false,                          // thin-web acts in Arne's own Chrome; refused unless true
//   disk_check: true,                             // default true: a thin-mech unit lists dirty files (git status) before
//                                                 // phase 1 and after every phase; a new or changed path outside the
//                                                 // owns of the units so far, or inside contract.shared, stops the run.
//                                                 // Reported outputs are what the agent says; this is what the disk says.
// }
//
// Optional per unit: findings (default true for thin-review): its defects are the product and go to `findings`
// instead of failing the gate; status, checks and ownership still gate.
//
// Done = every unit status done, every declared check exits as declared, no blocker or major outside findings.
// stopped = a gate failed. needs_decision = a findings unit reported a blocker or major and a later phase remains.
// Both return to the main session, which decides on fixes.

const AGENT_TYPES = ['thin-analyst', 'thin-builder', 'thin-mech', 'thin-research', 'thin-review', 'thin-verifier', 'thin-web', 'thin-writer']
const WRITERS = ['thin-builder', 'thin-mech', 'thin-writer']
const FINDINGS_DEFAULT = ['thin-review']

const HANDOFF = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    outputs: { type: 'array', items: { type: 'string', description: 'a file path and nothing else; describe the file in for_coordinator' } },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { cmd: { type: 'string' }, exit: { type: 'integer' } },
        required: ['cmd', 'exit'],
      },
    },
    proves: { type: 'array', items: { type: 'string' } },
    defects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          location: { type: 'string' },
          statement: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['severity', 'location', 'statement', 'evidence'],
      },
    },
    counts: { type: 'object', additionalProperties: { type: 'number' } },
    for_coordinator: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, label: { type: 'string', enum: ['observed', 'inferred'] } },
        required: ['text', 'label'],
      },
    },
  },
  required: ['status', 'outputs', 'checks', 'proves', 'defects', 'for_coordinator'],
}

// Disk check: what git says changed, as opposed to what an agent reports. Read-only thin-mech unit.
const DISK = {
  type: 'object',
  properties: {
    cmd: { type: 'string' },
    exit: { type: 'integer' },
    paths: { type: 'array', items: { type: 'string', description: 'absolute path of one dirty or untracked file' } },
  },
  required: ['cmd', 'exit', 'paths'],
}

function diskBrief(when) {
  return [
    `Disk check ${when}${args.goal ? `, goal: ${args.goal}` : ''}. Read-only: change nothing, write nothing, run no other command.`,
    `Project root: ${args.root}`,
    '', '## Task',
    '1. From the project root run `git rev-parse --show-toplevel`. If it exits non-zero, return that cmd, that exit code and paths = [].',
    '2. From the project root run `git status --porcelain=v1 --untracked-files=all`.',
    '3. Return cmd = that command, exit = its exit code, paths = every path it lists as <toplevel>/<path>. For a rename `old -> new` take new. Unquote quoted paths.',
    '', '## Output', 'The structured output through the StructuredOutput tool, nothing else.',
  ].join('\n')
}

const norm = p => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
const rel = p => { const n = norm(p), r = norm(args.root); return n.startsWith(r + '/') ? n.slice(r.length + 1) : n }
const overlaps = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/')
const bullets = xs => (xs && xs.length ? xs.map(x => `- ${x}`).join('\n') : '- none')

function validate(a) {
  const errors = []
  if (!a || !a.root || !Array.isArray(a.phases) || !a.phases.length) return ['args needs root and a non-empty phases list']
  const contract = a.contract || {}
  const shared = (contract.shared || []).map(rel)
  const sigIds = new Set((contract.signatures || []).map(s => s.id))
  const seen = new Set()
  for (const ph of a.phases) {
    if (!ph.title || !Array.isArray(ph.units) || !ph.units.length) { errors.push(`phase ${ph.title || '?'}: needs a title and units`); continue }
    const owned = []
    const here = new Set()
    for (const u of ph.units) {
      const where = `${ph.title}/${u.id || '?'}`
      if (!u.id || seen.has(u.id) || here.has(u.id)) errors.push(`${where}: missing or duplicate id`)
      here.add(u.id)
      if (!AGENT_TYPES.includes(u.agentType)) errors.push(`${where}: agentType must be one of ${AGENT_TYPES.join(', ')}`)
      if (u.agentType === 'thin-web' && !a.allow_chrome) errors.push(`${where}: thin-web uses Arne's Chrome; set allow_chrome: true only with his go-ahead`)
      if (!u.task || !u.output) errors.push(`${where}: task and output are required`)
      if (u.findings !== undefined && typeof u.findings !== 'boolean') errors.push(`${where}: findings must be true or false`)
      if (WRITERS.includes(u.agentType) && !(u.owns || []).length) errors.push(`${where}: a writer needs owns`)
      for (const c of u.checks || []) if (!c.cmd || typeof c.expect_exit !== 'number' || !c.proves) errors.push(`${where}: each check needs cmd, expect_exit, proves`)
      for (const s of u.seams || []) if (!sigIds.has(s)) errors.push(`${where}: seam ${s} is not in contract.signatures`)
      for (const id of u.inputs_from || []) if (!seen.has(id)) errors.push(`${where}: inputs_from ${id} is not a unit of an earlier phase`)
      for (const p of (u.owns || []).map(rel)) {
        if (shared.some(s => overlaps(s, p))) errors.push(`${where}: owns ${p}, which is contract.shared`)
        const clash = owned.find(o => overlaps(o.p, p))
        if (clash) errors.push(`${where}: owns ${p}, overlapping ${clash.id} in the same phase`)
        owned.push({ p, id: u.id })
      }
    }
    for (const u of ph.units) if (u.id) seen.add(u.id)
  }
  return errors
}

function brief(u, ph, done) {
  const contract = args.contract || {}
  const sigs = (contract.signatures || []).filter(s => (u.seams || []).includes(s.id))
  const prior = (u.inputs_from || []).map(id => ({ unit: id, ...done[id] }))
  return [
    `Brief ${u.id}, phase ${ph.title}${args.goal ? `, goal: ${args.goal}` : ''}.`,
    'No kit in this run: there is no SUBSTRATE.md, slice file, schema file, fact store or handoff file, and you do not write facts-proposed/.',
    'This brief is your whole input. Return your handoff through the StructuredOutput tool, not as a file path.',
    `Project root: ${args.root}`,
    '', '## Task', u.task,
    '', '## Output', u.output,
    '', '## Owns (write only these paths)', bullets(u.owns),
    '', '## Reads', bullets([...(contract.shared || []), ...(u.reads || [])]),
    '', '## Seams (exact signatures; do not change them)',
    sigs.length ? sigs.map(s => `- ${s.id} (owner ${s.owner}): \`${s.signature}\`${s.doc ? ` ${s.doc}` : ''}`).join('\n') : '- none',
    '', '## Checks (run each from the project root; record cmd exactly as written below and its exit code)',
    bullets((u.checks || []).map(c => `\`${c.cmd}\` expect exit ${c.expect_exit}; proves: ${c.proves}`)),
    '', '## Limits', u.limits || 'Stay inside Owns. If the task needs more, return status blocked and say what is missing.',
    ...(prior.length ? ['', '## Handoffs from earlier units', '<<<UNTRUSTED', JSON.stringify(prior, null, 2), '>>>'] : []),
    '', '## Handoff',
    'status blocked when you cannot finish inside Owns and Limits. outputs lists file paths only. Label each for_coordinator line observed (you saw it in output) or inferred.',
  ].join('\n')
}

function gate(u, h) {
  const problems = []
  if (!h) return [`${u.id}: no handoff (agent skipped or died)`]
  if (h.status !== 'done') problems.push(`${u.id}: status ${h.status}`)
  for (const c of u.checks || []) {
    const ran = (h.checks || []).find(r => r.cmd.trim() === c.cmd.trim())
    if (!ran) problems.push(`${u.id}: check not run: ${c.cmd}`)
    else if (ran.exit !== c.expect_exit) problems.push(`${u.id}: \`${c.cmd}\` exit ${ran.exit}, expected ${c.expect_exit}`)
  }
  const owns = (u.owns || []).map(rel)
  for (const o of h.outputs || []) {
    if (!owns.some(p => rel(o) === p || rel(o).startsWith(p + '/'))) problems.push(`${u.id}: reports output outside owns: ${o}`)
  }
  if (!isFindings(u)) for (const d of h.defects || []) if (d.severity !== 'minor') problems.push(`${u.id}: ${d.severity} at ${d.location}: ${d.statement}`)
  return problems
}

// A review's defects are its product, not a failure: they go to `findings` instead of the gate.
function isFindings(u) {
  return u.findings ?? FINDINGS_DEFAULT.includes(u.agentType)
}

const findingsOf = units => units.filter(u => isFindings(u) && u.handoff)
  .flatMap(u => (u.handoff.defects || []).map(d => ({ unit: u.id, ...d })))

const errors = validate(args)
if (errors.length) {
  log(`refused: ${errors.length} contract error(s)`)
  return { status: 'refused', errors }
}

const done = {}
const report = []
const inside = (p, bases) => bases.some(b => p === b || p.startsWith(b + '/'))
const disk = { mode: args.disk_check === false ? 'off' : 'checked', baseline: 0, changed: [] }
let baseline = new Set()
async function diskScan(when, phaseTitle) {
  const h = await agent(diskBrief(when), { label: `${phaseTitle}:disk`, phase: phaseTitle, agentType: 'thin-mech', schema: DISK, effort: 'low' })
  if (!h || h.exit !== 0) {
    disk.mode = 'unavailable'
    disk.reason = h ? `${h.cmd} exit ${h.exit}` : 'no handoff'
    log(`disk check unavailable (${disk.reason}): ownership is verified from reported outputs only`)
    return null
  }
  return new Set((h.paths || []).map(rel))
}
if (disk.mode === 'checked') {
  const b = await diskScan('before phase 1', args.phases[0].title)
  if (b) { baseline = b; disk.baseline = b.size }
}
for (const [i, ph] of args.phases.entries()) {
  log(`${ph.title}: ${ph.units.length} unit(s)`)
  // Barrier on purpose: the stop rule needs every result of this phase before the next phase may start.
  const handoffs = await parallel(ph.units.map(u => () => agent(brief(u, ph, done), {
    label: `${ph.title}:${u.id}`,
    phase: ph.title,
    agentType: u.agentType,
    schema: HANDOFF,
    ...(u.model ? { model: u.model } : {}),
    ...(u.effort ? { effort: u.effort } : {}),
  })))
  const problems = []
  ph.units.forEach((u, i) => {
    done[u.id] = { agentType: u.agentType, handoff: handoffs[i] }
    problems.push(...gate(u, handoffs[i]))
  })
  report.push({ phase: ph.title, units: ph.units.map(u => ({ id: u.id, findings: isFindings(u), ...done[u.id] })) })
  if (disk.mode === 'checked') {
    const now = await diskScan(`after ${ph.title}`, ph.title)
    if (now) {
      const ownsSoFar = args.phases.slice(0, i + 1).flatMap(p => p.units).flatMap(u => (u.owns || []).map(rel))
      const shared = ((args.contract || {}).shared || []).map(rel)
      disk.changed = [...now].filter(p => !baseline.has(p))
      for (const p of disk.changed) {
        if (inside(p, shared)) problems.push(`disk: ${p} changed, which is contract.shared`)
        else if (!inside(p, ownsSoFar)) problems.push(`disk: ${p} changed outside the owns of the units so far`)
      }
    }
  }
  if (problems.length) {
    log(`stopped after ${ph.title}: ${problems.length} problem(s)`)
    return { status: 'stopped', stopped_at: ph.title, problems, findings: findingsOf(report.flatMap(r => r.units)), disk, report }
  }
  // Stop rule (Arne): a blocker or major from a review returns to the main session before any later phase runs.
  const serious = findingsOf(report.at(-1).units).filter(d => d.severity !== 'minor')
  if (serious.length && ph !== args.phases.at(-1)) {
    log(`needs decision after ${ph.title}: ${serious.length} blocker/major finding(s)`)
    return { status: 'needs_decision', stopped_at: ph.title, findings: findingsOf(report.flatMap(r => r.units)), disk, report }
  }
}

const units = report.flatMap(r => r.units)
const findings = findingsOf(units)
const minors = units.filter(u => !u.findings).flatMap(u => (u.handoff.defects || []).map(d => ({ unit: u.id, ...d })))
const for_coordinator = units.flatMap(u => (u.handoff.for_coordinator || []).map(l => ({ unit: u.id, ...l })))
log(`done: ${findings.length} finding(s), ${minors.length} minor(s), ${for_coordinator.length} note(s) for the main session; disk check ${disk.mode}`)
return { status: 'done', findings, minors, for_coordinator, disk, report }
