import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { Highlight, themes, type Language } from 'prism-react-renderer'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { layoutDirectionStyle } from '@/lib/rtl'

/**
 * A fenced code block in the chat view: Prism-highlighted, copyable, pinned LTR.
 *
 * Lifted out of `MessageBubble` so `ChatMarkdown` can render a `code` block
 * through the same component instead of a second implementation — importing it
 * back from `MessageBubble` would be a cycle.
 */

const CODE_THEME = themes.oneDark

function useCodeStyles() {
  return useThemedStyles(makeStyles)
}

function DiffLines({ code }: { code: string }) {
  const { styles } = useCodeStyles()
  const lines = code.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const isAdd = line.startsWith('+')
        const isDel = line.startsWith('-')
        const lineStyle = isAdd ? styles.diffAdd : isDel ? styles.diffDel : undefined
        return (
          <View key={i} style={[styles.codeLine, lineStyle]}>
            <Text style={styles.codeToken} selectable>{line.length === 0 ? ' ' : line}</Text>
          </View>
        )
      })}
    </>
  )
}

// Prism tokenization runs synchronously on the JS thread and a large block
// costs tens of ms — memoized so CodeBlock-local state changes (the copied
// flag) and parent re-renders don't re-tokenize the same code.
const HighlightedCode = React.memo(function HighlightedCode({ code, language }: { code: string; language: Language }) {
  const { styles } = useCodeStyles()
  return (
    <View style={[styles.codeBody, { backgroundColor: CODE_THEME.plain.backgroundColor }]}>
      {language === 'diff' ? (
        <DiffLines code={code} />
      ) : (
        <Highlight code={code} language={language} theme={CODE_THEME}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <>
              {tokens.map((line, lineIdx) => {
                const { style: lineStyle } = getLineProps({ line })
                return (
                  <View key={lineIdx} style={[styles.codeLine, lineStyle as object]}>
                    {line.map((token, tokenIdx) => {
                      const { style: tokenStyle, children } = getTokenProps({ token })
                      return (
                        <Text
                          key={tokenIdx}
                          style={[styles.codeToken, tokenStyle as object]}
                          selectable
                        >
                          {children}
                        </Text>
                      )
                    })}
                  </View>
                )
              })}
            </>
          )}
        </Highlight>
      )}
    </View>
  )
})

export function CodeBlock({ code, language }: { code: string; language: Language }) {
  const { t } = useTranslation('conversation')
  const { styles } = useCodeStyles()
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
  }, [])
  const copy = async () => {
    await Clipboard.setStringAsync(code)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={styles.codeBlock} testID="message-code-block">
      <View style={styles.codeHeader}>
        <Text style={styles.codeHeaderText}>{t('message.code')}</Text>
        <TouchableOpacity onPress={copy} style={styles.codeCopyBtn}>
          <Text style={styles.codeCopyText}>
            {copied ? t('action.copiedCode') : t('action.copyCode')}
          </Text>
        </TouchableOpacity>
      </View>
      <HighlightedCode code={code} language={language} />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    codeBlock: {
      ...layoutDirectionStyle('ltr'),
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      overflow: 'hidden',
      marginVertical: spacing.xs,
    },
    codeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: '#1c2128',
    },
    codeHeaderText: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
    codeCopyBtn: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    codeCopyText: {
      color: theme.text.accent,
      fontSize: font.xs,
    },
    codeBody: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    codeLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    codeToken: {
      fontFamily: 'monospace',
      fontSize: font.sm,
      fontWeight: '600',
      color: theme.text.primary,
    },
    diffAdd: {
      backgroundColor: 'rgba(46, 160, 67, 0.18)',
    },
    diffDel: {
      backgroundColor: 'rgba(248, 81, 73, 0.18)',
    },
  })
}
