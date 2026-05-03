import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { DiffHunk } from '@/types/api'

const COLLAPSE_THRESHOLD = 100

interface Props {
  filename: string
  hunks: DiffHunk[]
  language?: string
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

export function DiffViewer({ filename, hunks, language }: Props) {
  const { t } = useTranslation('conversation')
  const totalLines = hunks.reduce((acc, h) => acc + h.lines.length, 0)
  const [expanded, setExpanded] = useState(totalLines <= COLLAPSE_THRESHOLD)
  const { added, removed } = countChanges(hunks)
  const scale = useSharedValue(1)

  const pinchGesture = Gesture.Pinch().onUpdate((e) => {
    scale.value = Math.max(0.5, Math.min(2, e.scale))
  })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const copyPatch = () => Clipboard.setStringAsync(toPatch(filename, hunks))

  const ext = filename.split('.').pop() ?? ''
  const fileIcon = ext === 'ts' || ext === 'tsx' ? '📘' : ext === 'go' ? '🐹' : ext === 'md' ? '📝' : '📄'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.fileIcon}>{fileIcon}</Text>
        <Text style={styles.filename} numberOfLines={1}>{filename}</Text>
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
                <View>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: dark.bg.primary,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: '#1c2128',
  },
  fileIcon: { fontSize: font.sm },
  filename: {
    color: dark.text.primary,
    fontSize: font.sm,
    flex: 1,
    fontFamily: 'monospace',
  },
  added: { color: dark.status.running, fontSize: font.sm, fontWeight: '600' },
  removed: { color: dark.status.failed, fontSize: font.sm, fontWeight: '600' },
  copyBtn: { paddingHorizontal: spacing.sm, minHeight: 44, justifyContent: 'center' },
  copyText: { color: dark.text.secondary, fontSize: font.xs },
  collapseBtn: {
    padding: spacing.md,
    alignItems: 'center',
  },
  collapseBtnText: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
  hunkHeader: {
    color: '#7d8590',
    backgroundColor: '#1c2128',
    fontFamily: 'monospace',
    fontSize: font.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  lineRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
  },
  lineAdded: { backgroundColor: '#0d4429' },
  lineDeleted: { backgroundColor: '#4b1113' },
  linePrefix: {
    color: dark.text.secondary,
    fontFamily: 'monospace',
    fontSize: font.xs,
    width: 12,
  },
  lineContent: {
    color: dark.text.primary,
    fontFamily: 'monospace',
    fontSize: font.xs,
  },
})
