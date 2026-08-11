// Every fixture below is a status line observed verbatim in two live Claude
// Code turns captured off a real streamer (2026-08-12, v2.1.x) — not invented
// shapes. The naive version of each rule failed on exactly this data.

import {
  deriveAgentSubStatus,
  agentSubStatusLabelKey,
  SUB_STATUS_TAIL_ROWS,
} from '@/lib/agentSubStatus'
import { VirtualTerminal } from '@/services/virtual-terminal'

describe('deriveAgentSubStatus', () => {
  it('reads the thinking phase off the live status line', () => {
    expect(deriveAgentSubStatus(['✻ Moseying… (2s · thinking with high effort)'])).toBe('thinking')
  })

  it('treats the output-token counter as streaming', () => {
    expect(deriveAgentSubStatus(['✽ Roosting… (5s · ↓ 82 tokens)'])).toBe('streaming')
  })

  it('reports post-turn hooks, whose parenthetical does not start with the elapsed', () => {
    expect(
      deriveAgentSubStatus([
        '✽ Moseying… (running stop hooks… 0/6 · 5s · ↓ 225 tokens · thought for 1s)',
      ]),
    ).toBe('hooks')
  })

  it('ends the turn on the summary line whatever the randomized verb is', () => {
    // "Worked" and "Brewed" were both produced by the same session.
    expect(deriveAgentSubStatus(['✻ Worked for 5s', '❯ '])).toBe('idle')
    expect(deriveAgentSubStatus(['✻ Brewed for 5s', '❯ '])).toBe('idle')
  })

  it('does not treat the composer as an idle marker', () => {
    // `❯` is on screen for the whole turn; reading it as idle reported the turn
    // finished three times mid-response.
    expect(deriveAgentSubStatus(['❯ ', '  mid-response prose'], 'streaming')).toBe('streaming')
  })

  it('holds the previous value through a torn mid-repaint frame', () => {
    // Differential repaint: the status line exists but its opening paren has
    // not been painted yet.
    expect(deriveAgentSubStatus(['✻ Roosting…113 tokens · thinking with high eff'], 'streaming'))
      .toBe('streaming')
  })

  it('never downgrades an identified state to the contentless "working"', () => {
    // The counter drops out of the status line between repaints.
    expect(deriveAgentSubStatus(['✻ Moseying… (6s · thought for 1s)'], 'streaming')).toBe(
      'streaming',
    )
    expect(deriveAgentSubStatus(['✻ Moseying… (6s · thought for 1s)'], 'thinking')).toBe('thinking')
  })

  it('reports plain working when nothing more specific is known yet', () => {
    expect(deriveAgentSubStatus(['✻ Moseying… (6s · thought for 1s)'])).toBe('working')
  })

  it('stays unknown on a screen with no status line at all', () => {
    expect(deriveAgentSubStatus(['just some output'])).toBe('unknown')
  })
})

describe('agentSubStatusLabelKey', () => {
  it('maps the working states to sessions labels', () => {
    expect(agentSubStatusLabelKey('thinking')).toBe('status.thinking')
    expect(agentSubStatusLabelKey('streaming')).toBe('status.writing')
    expect(agentSubStatusLabelKey('hooks')).toBe('status.hooks')
    expect(agentSubStatusLabelKey('working')).toBe('status.working')
  })

  it('refines nothing when there is nothing to say', () => {
    expect(agentSubStatusLabelKey('idle')).toBeNull()
    expect(agentSubStatusLabelKey('unknown')).toBeNull()
  })
})

describe('against the rendered terminal grid', () => {
  it('derives from a real PTY chunk fed through VirtualTerminal', () => {
    // Verbatim bytes off the wire: cursor home, forward 12, down 33, SGR
    // colours, then absolute repositioning. Per-chunk text is unusable — this
    // only works because it reads the rendered grid.
    const chunk =
      '\x1b[?25l\x1b[H\r\x1b[12C\x1b[33B\x1b[38;5;246m(2s · ' +
      '\x1b[38;5;248mthinking with high effort\x1b[38;5;246m)\x1b[39m\x1b[40;1H\x1b[37;3H\x1b[?25h'
    const vt = new VirtualTerminal()
    vt.feed(chunk)

    expect(deriveAgentSubStatus(vt.getTailLines(SUB_STATUS_TAIL_ROWS))).toBe('thinking')
  })

  it('getTailLines returns the last non-empty rows, oldest first', () => {
    const vt = new VirtualTerminal()
    vt.feed('one\ntwo\n\nthree\n')

    expect(vt.getTailLines(2)).toEqual(['two', 'three'])
    expect(vt.getTailLines(10)).toEqual(['one', 'two', 'three'])
  })
})
