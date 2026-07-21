import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { HighlightText } from 'one-more-highlight/native'
import { brand, font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from '@/components/sessions/LiveDot'
import { formatListTime, formatListTimeAccessible } from './formatListTime'
import { pathDisplay, type PathDisplayMode } from './pathDisplay'
import { MessagePreview, type MessagePreviewMode } from './MessagePreview'
import { ServerChip, type ServerChipVariant } from './ServerChip'
import { SERVER_COLOR_DEFAULT, initialsFor } from './serverPalette'

export type ConversationListDensity = 'comfortable' | 'compact' | 'chip'
export type ConversationListLeading = 'avatar' | 'dot' | 'depth' | 'none'
export type ConversationListServerMode = 'auto' | 'always' | 'never'

export interface ConversationListItemProps {
  /** Primary identity. When undefined or empty, falls back to `path`. */
  title?: string | null
  /** Path used by `pathDisplay`. Required if `title` is missing. */
  path?: string | null
  /** Other visible paths on the same screen — feeds `pathDisplay` smart mode. */
  siblings?: readonly string[]
  /** Timestamp shown in the meta column. ISO string, epoch ms, or Date. */
  timestamp?: string | number | Date | null
  /** Total messages in the conversation (used by `auto` preview + count chip). */
  messageCount?: number
  /** Git branch shown next to msg count, in JetBrains Mono. */
  branch?: string | null
  /** When set, the row gains a pulsing amber live indicator + LIVE pill. */
  live?: boolean
  /**
   * When set (with `live`), renders the read-only "external / observed" variant
   * instead of the interactive amber treatment: a blue dot + EXTERNAL pill.
   * Distinguishes a discovered process the streamer only observes from a
   * streamer-owned live session.
   */
  external?: boolean

  /** Optional message snapshots used by `MessagePreview`. */
  firstMessage?: { text: string } | null
  lastMessage?: { text: string } | null
  preview?: string | null
  lastOutput?: string | null

  /** Multi-server identity. When provided AND `showServer` resolves true, the row paints a 3px left strip + chip. */
  serverLabel?: string | null
  serverColor?: string | null
  /** Used by the `letter` variant if `serverLabel` is missing — pass the existing label/id. */
  serverFallback?: string

  /** Layout. */
  density?: ConversationListDensity
  leading?: ConversationListLeading
  /** Depth used when `leading='depth'`. */
  depth?: number
  pathDisplayMode?: PathDisplayMode
  /** Cap on path parent length passed through to `pathDisplay`. */
  parentMaxChars?: number

  /** Preview rendering mode. */
  previewMode?: MessagePreviewMode

  /** Server indicator behaviour. */
  showServer?: ConversationListServerMode
  serverChipVariant?: ServerChipVariant
  /** Total active servers in the app — used to resolve `showServer === 'auto'`. */
  activeServerCount?: number

  /** Search-result inline substring highlight. */
  highlight?: string

  /** Toggles. */
  showCount?: boolean
  showBranch?: boolean

  /** Source provider — 'codex-cli' shows a Codex badge; 'claude-code' (default) shows nothing. */
  provider?: 'claude-code' | 'codex-cli'

  onPress?: () => void
  onLongPress?: () => void
  onServerPress?: () => void
  onServerLongPress?: () => void

  testID?: string
}

const STRIP_WIDTH = 3
const STRIP_RADIUS = 2

function shouldShowServer(mode: ConversationListServerMode, activeServerCount: number | undefined, hasLabel: boolean): boolean {
  if (!hasLabel) return false
  if (mode === 'never') return false
  if (mode === 'always') return true
  return (activeServerCount ?? 0) > 1
}

export function ConversationListItem(props: ConversationListItemProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const {
    title,
    path,
    siblings,
    timestamp,
    messageCount,
    branch,
    live = false,
    external = false,
    firstMessage,
    lastMessage,
    preview,
    lastOutput,
    serverLabel,
    serverColor,
    serverFallback,
    density = 'comfortable',
    leading = 'avatar',
    depth = 0,
    pathDisplayMode = 'smart',
    parentMaxChars,
    previewMode = 'auto',
    showServer = 'auto',
    serverChipVariant = 'label',
    activeServerCount,
    highlight,
    showCount = true,
    showBranch = true,
    provider,
    onPress,
    onLongPress,
    onServerPress,
    onServerLongPress,
    testID,
  } = props

  // Blue for an observed external session, amber for an interactive live one.
  const liveColor = external ? theme.status.completed : theme.status.waiting
  const serverVisible = shouldShowServer(showServer, activeServerCount, Boolean(serverLabel))
  const stripColor = serverVisible
    ? (serverColor ?? SERVER_COLOR_DEFAULT)
    : (live ? liveColor : null)

  // Path rendering — only consulted when no title.
  const pathParts = useMemo(() => {
    if (title) return null
    if (!path) return null
    return pathDisplay(path, {
      mode: pathDisplayMode,
      siblings,
      parentMaxChars,
    })
  }, [title, path, pathDisplayMode, siblings, parentMaxChars])

  // The visible primary line: title when present, otherwise the path suffix.
  const primaryText = title?.trim() || pathParts?.suffix || ''

  const timeText = timestamp ? formatListTime(timestamp) : ''
  const timeA11y = timestamp ? formatListTimeAccessible(timestamp) : undefined

  // Chip density skips most of the chrome — used in QuickAccessChip.
  const isChip = density === 'chip'
  const isCompact = density === 'compact'

  const indentPx = leading === 'depth' ? Math.max(0, depth) * 16 : 0

  // Title-line highlight (case-insensitive substring tint).
  const highlightNeedle = highlight?.trim()
  const renderTitle = () => {
    if (!primaryText) return null
    if (!highlightNeedle) return <Text style={styles.title} numberOfLines={1}>{primaryText}</Text>
    return (
      <HighlightText
        text={primaryText}
        searchWords={[highlightNeedle]}
        highlightStyle={styles.match}
        style={styles.title}
        textProps={{ numberOfLines: 1 }}
      />
    )
  }

  const showPreview = !isChip && previewMode !== 'none'
  const showMeta = !isChip && (showBranch || showCount)
  const metaPieces: string[] = []
  if (showBranch && branch) metaPieces.push(branch)
  if (showCount && typeof messageCount === 'number') metaPieces.push(`${messageCount} msgs`)

  const Wrapper = onPress || onLongPress ? Pressable : View
  const wrapperProps =
    onPress || onLongPress
      ? {
          onPress,
          onLongPress,
          accessibilityRole: 'button' as const,
        }
      : {}

  return (
    <Wrapper
      {...wrapperProps}
      testID={testID}
      style={[
        styles.row,
        isCompact && styles.rowCompact,
        isChip && styles.rowChip,
      ]}
    >
      {/* Left server-identity strip (3px). Painted in server color when visible,
         otherwise amber when live, otherwise nothing — preserves alignment. */}
      <View
        style={[
          styles.strip,
          stripColor ? { backgroundColor: stripColor } : null,
        ]}
      />

      {/* Leading slot: avatar / dot / depth indent / nothing. */}
      {leading === 'avatar' && !isChip && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText} numberOfLines={1}>
            {initialsFor(serverFallback ?? serverLabel ?? primaryText, '?')}
          </Text>
        </View>
      )}
      {leading === 'dot' && !isChip && (
        <View style={styles.dotSlot}>
          <LiveDot live={live} color={live ? liveColor : theme.text.accent} size={6} />
        </View>
      )}
      {leading === 'depth' && !isChip && (
        <View style={[styles.depthSlot, { width: indentPx + 12 }]} />
      )}

      {/* Body — primary line + optional secondary lines. */}
      <View style={styles.body}>
        {/* Parent-path line shown above the suffix when no title (smart / suffix / full modes). */}
        {!title && pathParts?.parent ? (
          <Text style={styles.parent} numberOfLines={1}>{pathParts.parent}</Text>
        ) : null}

        {renderTitle()}

        {showPreview ? (
          <MessagePreview
            mode={previewMode}
            firstMessage={firstMessage}
            lastMessage={lastMessage}
            preview={preview}
            lastOutput={lastOutput}
            messageCount={messageCount}
            highlight={highlight}
          />
        ) : null}

        {showMeta && metaPieces.length > 0 ? (
          <Text style={styles.meta} numberOfLines={1}>{metaPieces.join(' · ')}</Text>
        ) : null}
      </View>

      {/* Trailing meta column: time + live pill + server chip. */}
      {!isChip ? (
        <View style={styles.tail}>
          {live ? (
            <View style={[styles.livePill, external && { backgroundColor: `${liveColor}24` }]}>
              <View style={[styles.livePillDot, external && { backgroundColor: liveColor }]} />
              <Text style={[styles.livePillText, external && { color: liveColor }]}>
                {external ? 'EXTERNAL' : 'LIVE'}
              </Text>
            </View>
          ) : timeText ? (
            <Text
              style={styles.time}
              accessibilityLabel={timeA11y}
              numberOfLines={1}
            >
              {timeText}
            </Text>
          ) : null}

          {serverVisible && serverLabel ? (
            <ServerChip
              label={serverLabel}
              color={serverColor ?? SERVER_COLOR_DEFAULT}
              variant={serverChipVariant}
              onPress={onServerPress}
              onLongPress={onServerLongPress}
            />
          ) : null}
          {provider != null ? (
            <View style={provider === 'codex-cli' ? styles.codexBadge : styles.claudeBadge} testID="provider-badge">
              <Text style={provider === 'codex-cli' ? styles.codexBadgeText : styles.claudeBadgeText}>
                {provider === 'codex-cli' ? 'Codex' : 'Claude'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Wrapper>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: 64,
    },
    rowCompact: {
      minHeight: 48,
      paddingVertical: spacing.xs + 2,
    },
    rowChip: {
      minHeight: 28,
      paddingVertical: 0,
      paddingHorizontal: spacing.sm,
    },
    strip: {
      width: STRIP_WIDTH,
      alignSelf: 'stretch',
      borderRadius: STRIP_RADIUS,
      marginVertical: spacing.xs,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.bg.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '700',
    },
    dotSlot: {
      width: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    depthSlot: {
      height: 1,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    parent: {
      color: theme.text.secondary,
      fontSize: font.xs - 1,
      fontWeight: '500',
    },
    title: {
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '600',
      lineHeight: font.sm + 5,
    },
    meta: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: font.xs + 4,
    },
    match: {
      backgroundColor: `${theme.text.accent}38`,
      color: theme.text.primary,
    },
    tail: {
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0,
    },
    time: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '500',
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: `${theme.status.waiting}24`,
    },
    livePillDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.status.waiting,
    },
    livePillText: {
      color: theme.status.waiting,
      fontSize: font.xs - 2,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    codexBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: `${brand.codex}20`,
    },
    codexBadgeText: {
      color: brand.codex,
      fontSize: font.xs - 2,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    claudeBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: `${brand.claude}20`,
    },
    claudeBadgeText: {
      color: brand.claude,
      fontSize: font.xs - 2,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  })
}
