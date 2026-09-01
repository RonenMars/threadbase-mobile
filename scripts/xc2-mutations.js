#!/usr/bin/env node
/* global __dirname */
/**
 * XC2 seen-red mutation driver.
 *
 * A safeguard whose mutation was never seen red is not verified. This applies
 * one mutation at a time, runs the suite that is supposed to hold the rule,
 * and records the verdict.
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

const MUTATIONS = [
  {
    id: 'R1',
    rule: 'no Authorization on a sealed request',
    file: 'services/authed-fetch.ts',
    from: '  if (lower === HEADER_AUTHORIZATION.toLowerCase()) return true',
    to: '  if (false && lower === HEADER_AUTHORIZATION.toLowerCase()) return true',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R2',
    rule: 'GET uses X-TB-Env, never a body',
    file: 'services/authed-fetch.ts',
    from:
      "    delete headers['Content-Type']\n    headers[HEADER_ENV] = encodeBase64Url(frame)\n    body = undefined",
    to: "    delete headers['Content-Type']\n    delete headers[HEADER_ENV]\n    body = frame as BodyInit",
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R3',
    rule: 'never both carriers',
    file: 'services/authed-fetch.ts',
    edits: [
      [
        "    delete headers['Content-Type']\n    headers[HEADER_ENV] = encodeBase64Url(frame)\n    body = undefined",
        "    delete headers['Content-Type']\n    headers[HEADER_ENV] = encodeBase64Url(frame)\n    body = frame as BodyInit",
      ],
      [
        '  if (lower === HEADER_ENV.toLowerCase()) return true',
        '  if (false && lower === HEADER_ENV.toLowerCase()) return true',
      ],
    ],
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R4',
    rule: 'target is the raw path, never decoded',
    file: 'services/e2ee/record.ts',
    from: '  const input = `${method.toUpperCase()}\\n${path}\\n${query}`',
    to: '  const input = `${method.toUpperCase()}\\n${decodeURIComponent(path)}\\n${query}`',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R5',
    rule: 'response counter equals request counter',
    file: 'services/e2ee/record.ts',
    from: '    if (opened.counter !== expected) {',
    to: '    if (false && opened.counter !== expected) {',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R6',
    rule: '409 E2EE_CTX_UNKNOWN reopens once',
    file: 'services/authed-fetch.ts',
    from:
      "    if (response.status === 409 && code === 'E2EE_CTX_UNKNOWN' && !retriedUnknown) {\n      invalidateRestContext(serverId)\n      return sealedFetch(target, path, url, init, true)\n    }",
    to: "    if (false && response.status === 409 && code === 'E2EE_CTX_UNKNOWN' && !retriedUnknown) {\n      invalidateRestContext(serverId)\n      return sealedFetch(target, path, url, init, true)\n    }",
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R7',
    rule: 'unsealed 401 is EnvelopeError, never AuthError',
    file: 'services/authed-fetch.ts',
    from:
      '  if (!isSealedResponse(response)) {\n    throw new EnvelopeError(\n      \'E2EE_SEAL_FAILED\',\n      \'E2EE: the server answered a sealed request without a sealed response\',\n      path,\n      false,\n    )\n  }',
    to:
      '  if (!isSealedResponse(response)) {\n    if (response.status === 401) throw new AuthError(\'shared\', path)\n    throw new EnvelopeError(\n      \'E2EE_SEAL_FAILED\',\n      \'E2EE: the server answered a sealed request without a sealed response\',\n      path,\n      false,\n    )\n  }',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R8',
    rule: 'no persistence of ctxId, keys, or counters',
    file: 'services/e2ee/rest-session.ts',
    from: '  binding.bytes += n',
    to: "  binding.bytes += n\n  void require('@/services/secure-store').setItemAsync('tb-e2ee-rest-counter', String(binding.bytes))",
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R9',
    rule: 'unpinned path still sends Authorization',
    file: 'services/authed-fetch.ts',
    from: '      Authorization: `Bearer ${credential.token}`,',
    to: '      // mutated: drop Authorization on an unpinned server',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R10',
    rule: 'retries re-seal; sealed bytes are never resent',
    file: 'services/authed-fetch.ts',
    from: '  const frame = context.send.seal(plaintext, targetHash)\n  const seq = recordCounter(frame)',
    to:
      '  const frame = retriedUnknown && globalThis.__xc2PrevFrame\n    ? globalThis.__xc2PrevFrame\n    : context.send.seal(plaintext, targetHash)\n  globalThis.__xc2PrevFrame = frame\n  const seq = recordCounter(frame)',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R11',
    rule: 'two REST callers share one context / one send counter',
    file: 'services/e2ee/rest-session.ts',
    from: '  if (existing && !shouldRollover(existing, t)) return existing.context',
    to: '  if (false && existing && !shouldRollover(existing, t)) return existing.context',
    suite: '__tests__/unit/e2ee-rest-envelope.test.ts',
  },
  {
    id: 'R12',
    rule: 'REST context uses request/response channel bytes, not websocket',
    file: 'services/e2ee/context.ts',
    from:
      '  const sendChannel = kind === \'rest\' ? CHANNEL_REST_REQUEST : CHANNEL_WEBSOCKET\n  const recvChannel = kind === \'rest\' ? CHANNEL_REST_RESPONSE : CHANNEL_WEBSOCKET',
    to: '  const sendChannel = CHANNEL_WEBSOCKET\n  const recvChannel = CHANNEL_WEBSOCKET',
    suite: '__tests__/unit/e2ee-rest-context-channels.test.ts',
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
      ['jest', '--ci', '--forceExit', '--runInBand', suite],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return { red: false, output: out }
  } catch (e) {
    return { red: true, output: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

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

function runCampaign() {
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

  console.log('\n\n================ XC2 MUTATION SUMMARY ================')
  for (const r of results) console.log(`${r.id.padEnd(4)} ${r.status.padEnd(32)} ${r.rule}`)
  const bad = results.filter((r) => r.status !== 'SEEN RED')
  console.log(`\n${results.length - bad.length}/${results.length} seen red.`)
  if (bad.length) {
    console.log('NOT VERIFIED:')
    for (const r of bad) console.log(`  ${r.id}: ${r.status}`)
    process.exitCode = 1
  }
}

module.exports = { MUTATIONS }
if (require.main === module) runCampaign()
