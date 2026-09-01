#!/usr/bin/env node
/* global __dirname */
/**
 * XC1 seen-red mutation driver.
 *
 * A safeguard whose mutation was never seen red is not verified. This applies
 * one mutation at a time, runs the suite that is supposed to hold the rule, and
 * records the verdict.
 *
 * Program-wide rules from W1a, all enforced here:
 *   - every mutation is reverted in a `finally`;
 *   - the mutated source file is restored byte-for-byte after each revert;
 *   - a mutated module that fails to parse or import is reported
 *     `BROKEN — did not run`, NEVER counted as a pass. Absence of a failure
 *     line is not evidence; only an observed red is.
 *
 * Not committed as product code — it lives under scripts/ so the campaign is
 * reproducible rather than a claim in a report.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
/** Each mutation: the file, an exact literal swap, and the suite that must go red. */
const MUTATIONS = [
  {
    id: 'M1',
    rule: '§3 counter precision — a `number` counter silently repeats past 2^53',
    file: 'services/e2ee/record.ts',
    from: '  view.setBigUint64(4, assertCounter(counter), false)',
    to: '  view.setBigUint64(4, BigInt(Number(assertCounter(counter))), false)',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M2',
    rule: '§2 direction binding — must remove EVERY binding (AAD, nonce, header check)',
    file: 'services/e2ee/record.ts',
    edits: [
      // the AAD field
      ['  view.setUint32(1 + CTX_ID_BYTES, direction, false)', '  view.setUint32(1 + CTX_ID_BYTES, 0, false)'],
      // the nonce bytes
      ['  view.setUint32(0, assertDirection(direction), false)', '  view.setUint32(0, 0, false)'],
      // the explicit header check
      ['      header.direction !== this.#direction ||', ''],
    ],
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M3',
    rule: '§4 counter binding — must remove EVERY binding (AAD and nonce)',
    file: 'services/e2ee/record.ts',
    edits: [
      ['  view.setBigUint64(1 + CTX_ID_BYTES + 4, counter, false)', '  view.setBigUint64(1 + CTX_ID_BYTES + 4, 0n, false)'],
      ['  view.setBigUint64(4, assertCounter(counter), false)', '  view.setBigUint64(4, 0n, false)'],
    ],
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M4',
    rule: '§5 R2 strict socket counter — a window must let a gap through',
    file: 'services/e2ee/record.ts',
    from: '    if (header.counter !== this.#counter) {',
    to: '    if (header.counter < this.#counter || header.counter > this.#counter + 32n) {',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M10',
    rule: '§4 AAD binds ctxId — single-field mutation is sufficient here',
    file: 'services/e2ee/record.ts',
    from: '  aad.set(ctxId, 1)',
    to: '  aad.set(new Uint8Array(CTX_ID_BYTES), 1)',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M11',
    rule: '§4 AAD binds channel — single-field mutation is sufficient here',
    file: 'services/e2ee/record.ts',
    from: '  aad[1 + CTX_ID_BYTES + 4 + 8] = channel',
    to: '  aad[1 + CTX_ID_BYTES + 4 + 8] = 0',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M12',
    rule: '§5 R3 — advancing on a rejected frame lets a duplicate through',
    file: 'services/e2ee/record.ts',
    from: '    if (!opened) {\n      throw new RecordError',
    to: '    if (!opened) {\n      this.#counter = header.counter + 1n\n      throw new RecordError',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M13',
    rule: '§5 R2 ordering — checking the counter before the AEAD mis-attributes an injected frame',
    file: 'services/e2ee/record.ts',
    from: '    const opened = this.#aead.open(nonce, frame.subarray(HEADER_BYTES), aad)',
    to:
      '    if (header.counter !== this.#counter) {\n' +
      "      throw new RecordError('E2EE_SEQUENCE_VIOLATION', 'mutated: counter checked before the AEAD')\n" +
      '    }\n' +
      '    const opened = this.#aead.open(nonce, frame.subarray(HEADER_BYTES), aad)',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M15',
    rule: '§7 exhaustion — allowing the wrap',
    file: 'services/e2ee/record.ts',
    edits: [
      ['    if (counter > MAX_COUNTER) {\n      // §7: the refusal leaves the state unchanged, and the caller must then\n      // destroy the context. There is no recovery that keeps it.\n      throw new RecordError(\'E2EE_COUNTER_EXHAUSTED\', \'E2EE: the record counter is exhausted\')\n    }', '    const counterWrapped = counter > MAX_COUNTER ? 0n : counter'],
      ['    const aad = recordAad(\n      target === undefined\n        ? { ctxId: this.#ctxId, direction: this.#direction, counter, channel: this.#channel }\n        : { ctxId: this.#ctxId, direction: this.#direction, counter, channel: this.#channel, target },\n    )\n    const nonce = recordNonce(this.#direction, counter)', '    const aad = recordAad(\n      target === undefined\n        ? { ctxId: this.#ctxId, direction: this.#direction, counter: counterWrapped, channel: this.#channel }\n        : { ctxId: this.#ctxId, direction: this.#direction, counter: counterWrapped, channel: this.#channel, target },\n    )\n    const nonce = recordNonce(this.#direction, counterWrapped)'],
      ['    this.#counter = counter + 1n\n    return frame', '    this.#counter = counterWrapped + 1n\n    return frame'],
    ],
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
  {
    id: 'M17',
    rule: 'pollution — reading an optional arg with `??` instead of Object.hasOwn',
    file: 'services/e2ee/record.ts',
    from: "  const hasTarget = Object.hasOwn(fields, 'target') && fields.target !== undefined",
    to: '  const hasTarget = (fields.target ?? null) !== null',
    suite: '__tests__/unit/e2ee-record.test.ts',
  },
]

function assertRestored(id, target, original) {
  if (fs.readFileSync(target, 'utf8') !== original) {
    throw new Error(`${id}: mutated source was NOT restored byte-for-byte, stop everything`)
  }
}

function runSuite(suite) {
  try {
    const out = execFileSync(
      'npx',
      ['jest', '--ci', '--forceExit', suite],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return { red: false, output: out }
  } catch (e) {
    return { red: true, output: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/** A parse/import failure is BROKEN, not a red. Distinguish them explicitly. */
function isBroken(output) {
  return (
    /Cannot find module|SyntaxError|TSError|Unexpected token|Your test suite must contain at least one test|error TS\d+/i.test(
      output,
    ) && !/✕/.test(output)
  )
}

function firstFailure(output) {
  const fail = output.match(/●[^\n]*\n[\s\S]{0,600}?(?=\n\s*at |\n\n\s*●|$)/)
  const bullet = output.match(/✕ [^\n]+/)
  return { test: bullet ? bullet[0].trim() : '(no ✕ line)', detail: fail ? fail[0].trim() : '(no ● block)' }
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const selected = only.length ? MUTATIONS.filter((m) => only.includes(m.id)) : MUTATIONS

const results = []

for (const m of selected) {
  const target = path.join(ROOT, m.file)
  const original = fs.readFileSync(target, 'utf8')
  let verdict
  try {
    let mutated = original
    const edits = m.edits ?? [[m.from, m.to]]
    for (const [from, to] of edits) {
      if (!mutated.includes(from)) {
        throw new Error(`anchor not found in ${m.file}: ${JSON.stringify(from.slice(0, 80))}`)
      }
      mutated = mutated.replace(from, to)
    }
    if (mutated === original) throw new Error('mutation was a no-op')
    fs.writeFileSync(target, mutated)

    const { red, output } = runSuite(m.suite)
    if (isBroken(output)) {
      verdict = { id: m.id, rule: m.rule, status: 'BROKEN — did not run', evidence: output.slice(-400) }
    } else if (red) {
      verdict = { id: m.id, rule: m.rule, status: 'SEEN RED', ...firstFailure(output) }
    } else {
      verdict = { id: m.id, rule: m.rule, status: 'GREEN — SAFEGUARD NOT VERIFIED', evidence: 'suite passed under mutation' }
    }
  } catch (e) {
    verdict = { id: m.id, rule: m.rule, status: 'DRIVER ERROR', evidence: e.message }
  } finally {
    fs.writeFileSync(target, original)
    assertRestored(m.id, target, original)
  }
  results.push(verdict)
  console.log(`\n=== ${verdict.id} — ${verdict.status} ===`)
  console.log(`rule: ${verdict.rule}`)
  if (verdict.test) console.log(`test: ${verdict.test}`)
  if (verdict.detail) console.log(`assertion:\n${verdict.detail}`)
  if (verdict.evidence) console.log(`evidence: ${verdict.evidence}`)
}

console.log('\n\n================ XC1 MUTATION SUMMARY ================')
for (const r of results) console.log(`${r.id.padEnd(4)} ${r.status.padEnd(32)} ${r.rule}`)
const bad = results.filter((r) => r.status !== 'SEEN RED')
console.log(`\n${results.length - bad.length}/${results.length} seen red.`)
if (bad.length) {
  console.log('NOT VERIFIED:')
  for (const r of bad) console.log(`  ${r.id}: ${r.status}`)
  process.exitCode = 1
}
