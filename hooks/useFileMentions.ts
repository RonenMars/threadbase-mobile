import { useCallback, useState } from 'react'
import type { TextInputSelectionChangeEvent } from 'react-native'
import { CLAUDE_CODE_PROVIDER, canonicalizeProviderName } from '@/constants/providers'
import { applyMention, findMentionToken, type MentionEntry, type MentionToken } from '@/lib/mentionToken'
import { applySkill, findSlashToken, isSkillIntact, type SkillEntry, type SlashToken } from '@/lib/slashToken'

export interface ComposerMention {
  serverId: string
  projectPath: string
  token: MentionToken
  onSelect: (entry: MentionEntry) => void
  onDismiss: () => void
}

export interface ComposerSlash {
  serverId: string
  sessionId: string
  token: SlashToken
  onSelect: (skill: SkillEntry) => void
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
  /** Enables the `/` skills picker; it lists this session's skills. */
  sessionId?: string
  text: string
  onChangeText: (text: string) => void
}

export interface FileMentions {
  /** Set for one render after an insert so the caret lands after it; undefined otherwise. */
  selection: Selection | undefined
  onSelectionChange: (e: TextInputSelectionChangeEvent) => void
  mention: ComposerMention | null
  /** Open `/` token at the start of the prompt; null closes the skills picker. */
  slash: ComposerSlash | null
  /** The skill picked from the `/` picker, while its name at the start of the text is untouched. */
  skill: SkillEntry | null
  /** Removes the marked skill's name from the text. */
  clearSkill: () => void
  /** What to send instead of the text while a skill is marked: the text behind a `/`. */
  skillPayload: string | undefined
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
  sessionId,
  text,
  onChangeText,
}: UseFileMentionsOptions): FileMentions {
  const [cursor, setCursor] = useState(0)
  const [pendingSelection, setPendingSelection] = useState<Selection | undefined>(undefined)
  // The `@` index the user closed the picker on; it stays closed for that token.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [skill, setSkill] = useState<SkillEntry | null>(null)

  const enabled = !!projectPath && supportsFileMentions(provider)
  const token = enabled ? findMentionToken(text, cursor) : null
  const slashToken = sessionId && supportsFileMentions(provider) ? findSlashToken(text, cursor) : null

  const onSelectionChange = useCallback(
    (e: TextInputSelectionChangeEvent) => {
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
  if (slashDismissed && !slashToken) setSlashDismissed(false)
  // Any edit to the name drops the mark; the text left behind stays as typed.
  const markedSkill = skill && isSkillIntact(text, skill.name) ? skill : null
  if (skill && !markedSkill) setSkill(null)

  const placeCaret = (at: number) => {
    setCursor(at)
    setPendingSelection({ start: at, end: at })
  }

  const clearSkill = () => {
    if (!markedSkill) return
    setSkill(null)
    onChangeText(text.slice(markedSkill.name.length).replace(/^ /, ''))
    placeCaret(0)
  }

  const slash: ComposerSlash | null =
    slashToken && !slashDismissed && sessionId
      ? {
          serverId,
          sessionId,
          token: slashToken,
          onSelect: (picked) => {
            const next = applySkill(text, slashToken, picked)
            setSkill(picked)
            onChangeText(next.text)
            placeCaret(next.cursor)
          },
          onDismiss: () => setSlashDismissed(true),
        }
      : null

  const shared = {
    selection: pendingSelection,
    onSelectionChange,
    slash,
    skill: markedSkill,
    clearSkill,
    skillPayload: markedSkill ? `/${text}` : undefined,
  }

  if (!visibleToken || !projectPath) return { ...shared, mention: null }

  const onSelect = (entry: MentionEntry) => {
    const next = applyMention(text, visibleToken, entry)
    onChangeText(next.text)
    placeCaret(next.cursor)
  }

  return {
    ...shared,
    mention: {
      serverId,
      projectPath,
      token: visibleToken,
      onSelect,
      onDismiss: () => setDismissedAt(visibleToken.start),
    },
  }
}
