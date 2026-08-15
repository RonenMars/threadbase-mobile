import { render, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import type { PermissionOption } from '@/types/api'

/**
 * What actually reaches the PTY when a permission card is tapped.
 *
 * The bug this guards was invisible to every existing test: the streamer's
 * detector tests asserted the server emitted `answerKeys: "y"`, and stopped
 * there. Nothing checked the client, which dropped the field and sent `"1\r"`.
 * A contract needs a test on the side that consumes it, not only the side that
 * produces it — so these drive the real components and assert the bytes.
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
  ['ThinkingBubble', (block: ReturnType<typeof mapPermissionToBlock>, onSendKeys: jest.Mock) => (
    <ThinkingBubble lines={[]} isStreaming={false} activeQuestion={block} onSendKeys={onSendKeys} />
  )],
  ['TerminalOutput', (block: ReturnType<typeof mapPermissionToBlock>, onSendKeys: jest.Mock) => (
    <TerminalOutput lines={[]} isStreaming={false} activeQuestion={block} onSendKeys={onSendKeys} />
  )],
])('%s — permission card answer bytes', (_name, renderWith) => {
  it('sends the Codex EXEC literal key, not the on-screen number', async () => {
    const onSendKeys = jest.fn()
    const { getByLabelText } = await render(
      renderWith(mapPermissionToBlock('Codex requests command approval', EXEC, undefined), onSendKeys),
    )

    await fireEvent.press(getByLabelText('Yes'))

    expect(onSendKeys).toHaveBeenCalledWith('y')
    expect(onSendKeys).not.toHaveBeenCalledWith('1\r')
  })

  it('sends Escape for the Codex reject row', async () => {
    const onSendKeys = jest.fn()
    const { getByLabelText } = await render(
      renderWith(mapPermissionToBlock('Codex requests command approval', EXEC, undefined), onSendKeys),
    )

    await fireEvent.press(getByLabelText('No'))

    expect(onSendKeys).toHaveBeenCalledWith('\x1b')
  })

  it('still answers a Claude OSC-777 gate with its real on-screen number', async () => {
    const onSendKeys = jest.fn()
    const { getByLabelText } = await render(
      renderWith(mapPermissionToBlock('Claude needs your permission', OSC_GATE, undefined), onSendKeys),
    )

    await fireEvent.press(getByLabelText('Yes'))

    // The gate numbers from 2 — a 1-based index would send the wrong option.
    expect(onSendKeys).toHaveBeenCalledWith('2\r')
  })
})
