import { useCallback, useState } from 'react'
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native'
import { CLAUDE_CODE_PROVIDER, canonicalizeProviderName } from '@/constants/providers'
import { applyMention, findMentionToken, type MentionEntry, type MentionToken } from '@/lib/mentionToken'

export interface ComposerMention {
  serverId: string
  projectPath: string
  token: MentionToken
  onSelect: (entry: MentionEntry) => void
  onDismiss: () => void
}

interface Selection {
  start: number
  end: number
}

export interface UseFileMentionsOptions {
  serverId: string
  projectPath?: string | null
  provider?: string | null
  text: string
  onChangeText: (text: string) => void
}

export interface FileMentions {
  /** Set for one render after an insert so the caret lands after it; undefined otherwise. */
  selection: Selection | undefined
  onSelectionChange: (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void
  mention: ComposerMention | null
}

// Codex and Cursor open their own file popup on `@`, so text typed into their
// PTY may not land verbatim. Claude only until those runners are verified.
function supportsFileMentions(provider: string | null | undefined): boolean {
  if (!provider) return true
  return canonicalizeProviderName(provider) === CLAUDE_CODE_PROVIDER
}

export function useFileMentions({
  serverId,
  projectPath,
  provider,
  text,
  onChangeText,
}: UseFileMentionsOptions): FileMentions {
  const [cursor, setCursor] = useState(0)
  const [pendingSelection, setPendingSelection] = useState<Selection | undefined>(undefined)
  // The `@` index the user closed the picker on; it stays closed for that token.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)

  const enabled =
    process.env.EXPO_PUBLIC_FILE_MENTIONS === '1' && !!projectPath && supportsFileMentions(provider)
  const token = enabled ? findMentionToken(text, cursor) : null

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { start, end } = e.nativeEvent.selection
      setCursor(start === end ? start : -1)
      // Hand the caret back to the input once it has applied the insert.
      setPendingSelection(undefined)
    },
    [],
  )

  const visibleToken = token && token.start !== dismissedAt ? token : null
  // Leaving the dismissed token (or deleting its `@`) re-arms the picker.
  if (dismissedAt !== null && token?.start !== dismissedAt) setDismissedAt(null)

  if (!visibleToken || !projectPath) {
    return { selection: pendingSelection, onSelectionChange, mention: null }
  }

  const onSelect = (entry: MentionEntry) => {
    const next = applyMention(text, visibleToken, entry)
    onChangeText(next.text)
    setCursor(next.cursor)
    setPendingSelection({ start: next.cursor, end: next.cursor })
  }

  return {
    selection: pendingSelection,
    onSelectionChange,
    mention: {
      serverId,
      projectPath,
      token: visibleToken,
      onSelect,
      onDismiss: () => setDismissedAt(visibleToken.start),
    },
  }
}
