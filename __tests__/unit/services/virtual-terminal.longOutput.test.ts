import { VirtualTerminal } from '@/services/virtual-terminal'

describe('VirtualTerminal long-output resilience', () => {
  it('caps scrollback and stays bounded under a long append-only feed', () => {
    const vt = new VirtualTerminal()
    const started = Date.now()
    let payload = ''
    for (let i = 0; i < 20_000; i++) {
      payload += `line-${i} plain output\n`
      if (payload.length > 64_000) {
        vt.feed(payload)
        payload = ''
      }
    }
    if (payload) vt.feed(payload)
    const elapsed = Date.now() - started
    const lines = vt.getLines()
    expect(lines.length).toBeLessThanOrEqual(10_000)
    expect(lines[lines.length - 1]).toContain('line-19999')
    // Generous CI budget — catches pathological O(n²) regressions.
    expect(elapsed).toBeLessThan(5_000)
  })

  it('tracks unsupported sequences and exposes low confidence', () => {
    const vt = new VirtualTerminal()
    // Feed many unknown CSI finals with enough payload to cross the threshold.
    let chunk = 'hello\n'
    for (let i = 0; i < 20; i++) {
      chunk += `\x1b[${i}Zunknown\n`
    }
    chunk = chunk.repeat(8)
    vt.feed(chunk)
    expect(vt.getParseStats().unsupportedSequenceCount).toBeGreaterThanOrEqual(12)
    expect(vt.getParseConfidence()).toBe('low')
    expect(vt.getRawLines().length).toBeGreaterThan(0)
  })

  it('replay feed is idempotent when historyFed guard is simulated by reset+feed once', () => {
    const vt = new VirtualTerminal()
    const history = 'one\ntwo\nthree\n'
    vt.feed(history)
    const first = vt.getLines()
    // Double-feed without reset would duplicate — callers must guard.
    vt.feed(history)
    const duplicated = vt.getLines()
    expect(duplicated.length).toBeGreaterThan(first.length)

    vt.reset()
    vt.feed(history)
    expect(vt.getLines()).toEqual(first)
  })
})
