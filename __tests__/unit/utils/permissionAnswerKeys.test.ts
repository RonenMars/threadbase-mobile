import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import { permissionAnswerKeys } from '@/utils/permissionAnswerKeys'
import type { PermissionOption } from '@/types/api'

// The streamer marks `answerKeys` authoritative over `index` because some
// prompts render numbers that do not answer them. The client used to drop the
// field entirely and always send `${index}\r`, so a Codex EXEC approval — which
// draws "1. yes" but is answered by `y` — sent the wrong bytes to the PTY.
//
// Both halves matter here: the literal keys must win where they exist, and the
// index fallback must survive untouched where they don't, because that is what
// every Claude OSC-777 gate relies on.

function block(options: PermissionOption[]) {
  return mapPermissionToBlock('Prompt?', options, undefined)
}

describe('permissionAnswerKeys', () => {
  describe('literal keys win (Codex, shell prompts)', () => {
    // detectCodexCommandApproval: the visible 1./2. rows are presentation only.
    const exec: PermissionOption[] = [
      { index: 1, label: 'Yes', answerKeys: 'y' },
      { index: 2, label: 'No', answerKeys: '\x1b' },
    ]

    it('sends y for a Codex EXEC approval, not "1\\r"', () => {
      expect(permissionAnswerKeys(block(exec), 0)).toBe('y')
    })

    it('sends Escape for the reject row, not "2\\r"', () => {
      expect(permissionAnswerKeys(block(exec), 1)).toBe('\x1b')
    })

    it('sends the shell prompt\'s own letter for a [y/N]', () => {
      // detectShellPrompt — reached on CLAUDE sessions too (pty-manager.ts).
      const shell: PermissionOption[] = [
        { index: 1, label: 'Yes', answerKeys: 'y\r' },
        { index: 2, label: 'No', answerKeys: 'n\r' },
      ]
      expect(permissionAnswerKeys(block(shell), 0)).toBe('y\r')
      expect(permissionAnswerKeys(block(shell), 1)).toBe('n\r')
    })

    it('still sends the number when the detector says the number is the answer', () => {
      // parseCodexNumberedOptions emits `${n}\r` — same bytes as the fallback,
      // but taken from answerKeys, so this must not regress either.
      const menu: PermissionOption[] = [
        { index: 1, label: 'Switch model', answerKeys: '1\r' },
        { index: 2, label: 'Keep current model', answerKeys: '2\r' },
        { index: 3, label: 'Never show again', answerKeys: '3\r' },
      ]
      expect(permissionAnswerKeys(block(menu), 2)).toBe('3\r')
    })
  })

  describe('index fallback is preserved (Claude OSC-777 gates)', () => {
    // detectPermissionGate never sets answerKeys — it only declares the field.
    // These gates number their options from the screen, and can start at 2.
    const osc: PermissionOption[] = [
      { index: 2, label: 'Yes' },
      { index: 3, label: 'No' },
    ]

    it('sends the REAL on-screen number, not a 1-based index', () => {
      expect(permissionAnswerKeys(block(osc), 0)).toBe('2\r')
      expect(permissionAnswerKeys(block(osc), 1)).toBe('3\r')
    })

    it('falls back per-option, so a partially-populated gate still answers', () => {
      const mixed: PermissionOption[] = [
        { index: 2, label: 'Yes', answerKeys: 'y' },
        { index: 3, label: 'No' },
      ]
      expect(permissionAnswerKeys(block(mixed), 0)).toBe('y')
      expect(permissionAnswerKeys(block(mixed), 1)).toBe('3\r')
    })

    it('returns null rather than guessing when the option does not exist', () => {
      expect(permissionAnswerKeys(block(osc), 7)).toBeNull()
    })
  })

  it('keeps the mapped indices intact for the card cursor', () => {
    const mapped = mapPermissionToBlock('Prompt?', [{ index: 2, label: 'Yes' }], 2)
    expect(mapped.permissionIndices).toEqual([2])
    expect(mapped.selectedIndex).toBe(0)
  })
})
