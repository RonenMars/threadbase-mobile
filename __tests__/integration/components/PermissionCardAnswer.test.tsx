import { render, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import { permissionAnswerKeys } from '@/utils/permissionAnswerKeys'
import type { PermissionOption } from '@/types/api'

/**
 * What a tapped permission card actually answers with.
 *
 * The bug this guards was invisible to every existing test: the streamer's
 * detector tests asserted the server emitted `answerKeys: "y"`, and stopped
 * there. Nothing checked the client, which dropped the field and sent `"1\r"`.
 * A contract needs a test on the side that consumes it, not only the side that
 * produces it.
 *
 * The answer now leaves in two pieces, so this checks both. The card reports a
 * POSITION in the options array as broadcast — the server derives the bytes
 * from its own copy of the gate, which is what stops two key-derivations
 * drifting apart. The keystrokes survive only as the fallback for a server too
 * old to have that route, so the byte claim is asserted against the same
 * fixtures at its new home rather than dropped.
 *
 * Both surfaces are covered because they hold separate copies of the handler.
 */

// Codex EXEC approval: renders "1. yes / 2. no", answered by y / Escape.
const EXEC: PermissionOption[] = [
  { index: 1, label: 'Yes', answerKeys: 'y' },
  { index: 2, label: 'No', answerKeys: '\x1b' },
]

// Claude OSC-777 gate: no answerKeys, numbered from the screen starting at 2.
const OSC_GATE: PermissionOption[] = [
  { index: 2, label: 'Yes' },
  { index: 3, label: 'No' },
]

describe.each([
  ['ThinkingBubble', (block: ReturnType<typeof mapPermissionToBlock>, onAnswerPermission: jest.Mock) => (
    <ThinkingBubble lines={[]} isStreaming={false} activeQuestion={block} onSendKeys={jest.fn()} onAnswerPermission={onAnswerPermission} />
  )],
  ['TerminalOutput', (block: ReturnType<typeof mapPermissionToBlock>, onAnswerPermission: jest.Mock) => (
    <TerminalOutput lines={[]} isStreaming={false} activeQuestion={block} onSendKeys={jest.fn()} onAnswerPermission={onAnswerPermission} />
  )],
])('%s — permission card answer position', (_name, renderWith) => {
  it('reports the first row as position 0, not as the on-screen number', async () => {
    const onAnswerPermission = jest.fn()
    const { getByLabelText } = await render(
      renderWith(mapPermissionToBlock('Codex requests command approval', EXEC, undefined), onAnswerPermission),
    )

    await fireEvent.press(getByLabelText('Yes'))

    expect(onAnswerPermission).toHaveBeenCalledWith(0)
  })

  it('reports the second row as position 1', async () => {
    const onAnswerPermission = jest.fn()
    const { getByLabelText } = await render(
      renderWith(mapPermissionToBlock('Codex requests command approval', EXEC, undefined), onAnswerPermission),
    )

    await fireEvent.press(getByLabelText('No'))

    expect(onAnswerPermission).toHaveBeenCalledWith(1)
  })

  // The gate numbering its rows from 2 is where position and on-screen number
  // diverge, and it is the case that makes the distinction load-bearing rather
  // than pedantic: sending 2 here would answer the *second* option.
  it('reports a position, not the number, for a gate numbered from 2', async () => {
    const onAnswerPermission = jest.fn()
    const { getByLabelText } = await render(
      renderWith(mapPermissionToBlock('Claude needs your permission', OSC_GATE, undefined), onAnswerPermission),
    )

    await fireEvent.press(getByLabelText('Yes'))

    expect(onAnswerPermission).toHaveBeenCalledWith(0)
    expect(onAnswerPermission).not.toHaveBeenCalledWith(2)
  })
})

// The other half, at the layer that now owns it. These are the bytes the
// fallback sends when the server is too old to have the validated route; the
// validated route sends no keystrokes at all.
describe('permission fallback keystrokes for the same gates', () => {
  it('sends the Codex EXEC literal key, not the on-screen number', () => {
    const block = mapPermissionToBlock('Codex requests command approval', EXEC, undefined)
    expect(permissionAnswerKeys(block, 0)).toBe('y')
    expect(permissionAnswerKeys(block, 0)).not.toBe('1\r')
  })

  it('sends Escape for the Codex reject row', () => {
    const block = mapPermissionToBlock('Codex requests command approval', EXEC, undefined)
    expect(permissionAnswerKeys(block, 1)).toBe('\x1b')
  })

  it('still answers a Claude OSC-777 gate with its real on-screen number', () => {
    const block = mapPermissionToBlock('Claude needs your permission', OSC_GATE, undefined)
    // The gate numbers from 2 — a 1-based index would send the wrong option.
    expect(permissionAnswerKeys(block, 0)).toBe('2\r')
  })
})
