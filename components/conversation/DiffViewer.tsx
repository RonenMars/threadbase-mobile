import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { FileCode } from 'phosphor-react-native'
import * as Clipboard from 'expo-clipboard'
import { useRecyclingState } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { MAX_FONT_SIZE_MULTIPLIER_MONO, MIN_TOUCH_TARGET } from '@/constants/a11y'
import type { DiffHunk } from '@/types/api'

const COLLAPSE_THRESHOLD = 100

interface Props {
  filename: string
  hunks: DiffHunk[]
  language?: string
  /** Stable per-cell key — reset recycled `expanded` state when the cell is reassigned. */
  recycleKey?: string
}

function countChanges(hunks: DiffHunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'addition') added++
      else if (line.type === 'deletion') removed++
    }
  }
  return { added, removed }
}

function toPatch(filename: string, hunks: DiffHunk[]): string {
  const lines: string[] = [`--- a/${filename}`, `+++ b/${filename}`]
  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`)
    for (const line of hunk.lines) {
      const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '
      lines.push(prefix + line.content)
    }
  }
  return lines.join('\n')
}

export function DiffViewer({ filename, hunks, language, recycleKey }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const totalLines = hunks.reduce((acc, h) => acc + h.lines.length, 0)
  const [expanded, setExpanded] = useRecyclingState(
    totalLines <= COLLAPSE_THRESHOLD,
    [recycleKey, totalLines],
  )
  const { added, removed } = countChanges(hunks)
  const scale = useSharedValue(1)

  const pinchGesture = Gesture.Pinch().onUpdate((e) => {
    scale.value = Math.max(0.5, Math.min(2, e.scale))
  })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const copyPatch = () => Clipboard.setStringAsync(toPatch(filename, hunks))

  return (
    <View style={styles.container} accessible accessibilityLabel={filename}>
      <View style={styles.header}>
        <FileCode size={14} color={theme.text.secondary} />
        <Text style={styles.filename} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER_MONO}>{filename}</Text>
        <Text style={styles.added}>+{added}</Text>
        <Text style={styles.removed}>−{removed}</Text>
        <TouchableOpacity onPress={copyPatch} style={styles.copyBtn}>
          <Text style={styles.copyText}>{t('action.copyPatch')}</Text>
        </TouchableOpacity>
      </View>

      {!expanded ? (
        <TouchableOpacity style={styles.collapseBtn} onPress={() => setExpanded(true)}>
          <Text style={styles.collapseBtnText}>{t('action.showAllLines', { count: totalLines })}</Text>
        </TouchableOpacity>
      ) : (
        <GestureHandlerRootView>
          <GestureDetector gesture={pinchGesture}>
            <Animated.View style={animatedStyle}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={styles.hunksContainer}>
                  {hunks.map((hunk, hi) => (
                    <View key={hi}>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <Text style={styles.hunkHeader}>
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </Text>
                      {hunk.lines.map((line, li) => (
                        <View
                          key={li}
                          style={[
                            styles.lineRow,
                            line.type === 'addition' && styles.lineAdded,
                            line.type === 'deletion' && styles.lineDeleted,
                          ]}
                        >
                          <Text style={styles.linePrefix}>
                            {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                          </Text>
                          <Text style={styles.lineContent} selectable>{line.content}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      )}
    </View>
  )
}

// Palette hexes are 6-digit, so a 2-digit suffix is a valid alpha channel (33 = 20%).
function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.bg.primary,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      backgroundColor: theme.bg.card,
    },
    filename: {
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '600',
      flex: 1,
      fontFamily: 'monospace',
    },
    added: { color: theme.status.running, fontSize: font.sm, fontWeight: '700' },
    removed: { color: theme.status.failed, fontSize: font.sm, fontWeight: '700' },
    copyBtn: { paddingHorizontal: spacing.sm, minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET, justifyContent: 'center' },
    copyText: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '600' },
    collapseBtn: {
      padding: spacing.md,
      alignItems: 'center',
    },
    collapseBtnText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
    hunkHeader: {
      color: theme.status.idle,
      backgroundColor: theme.bg.card,
      fontFamily: 'monospace',
      fontSize: font.xs,
      fontWeight: '600',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    hunksContainer: {
      minWidth: '100%',
    },
    lineRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.xs,
    },
    lineAdded: { backgroundColor: `${theme.status.running}33` },
    lineDeleted: { backgroundColor: `${theme.status.failed}33` },
    linePrefix: {
      color: theme.text.secondary,
      fontFamily: 'monospace',
      fontSize: font.xs,
      fontWeight: '600',
      width: 12,
    },
    lineContent: {
      color: theme.text.primary,
      fontFamily: 'monospace',
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
