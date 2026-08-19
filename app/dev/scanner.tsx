/* eslint-disable i18next/no-literal-string, react-native/no-raw-text */
import React from 'react'
import { Redirect } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { SyncCachedNotice } from '@/components/sessions/SyncCachedNotice'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { ServerRootRow } from '@/components/sessions/tree/ServerRootRow'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import type { TreeNode } from '@/components/sessions/tree/types'

const previewNode: TreeNode = {
  name: 'root',
  fullPath: '/',
  children: new Map(),
  sessions: [],
  conversationCount: 0,
  conversationActivityMs: 0,
  totalCount: 87,
  directCount: 0,
}

export default function ScannerPreviewScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)

  if (!__DEV__) return <Redirect href="/" />

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Change theme under Settings → Appearance to see the palette update.
        </Text>

        <Text style={styles.heading}>Server header row</Text>
        <View style={styles.card}>
          <ServerHeaderRow serverId="preview" serverLabel="WIN" totalCount={87} isRefreshing />
        </View>

        <Text style={styles.heading}>Server tree row</Text>
        <View style={styles.card}>
          <ServerRootRow
            node={previewNode}
            serverLabel="WIN"
            collapsible
            isExpanded
            onToggle={() => undefined}
            onSelectLeaf={() => undefined}
            isRefreshing
          />
        </View>

        <Text style={styles.heading}>Banner overlay</Text>
        <View style={styles.overlayBox}>
          <SyncCachedNotice visible variant="banner" />
        </View>

        <Text style={styles.heading}>Caption overlay</Text>
        <View style={styles.overlayBox}>
          <SyncCachedNotice visible variant="caption" />
        </View>

        <Text style={styles.heading}>Standalone</Text>
        <View style={styles.standalone}>
          <KnightRiderScanner />
          <KnightRiderScanner size="banner" />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg.primary,
    },
    content: {
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    hint: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      fontSize: font.sm,
      color: theme.text.secondary,
    },
    heading: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      fontSize: font.xs,
      fontWeight: '600',
      color: theme.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    card: {
      backgroundColor: theme.bg.secondary,
    },
    overlayBox: {
      height: 56,
      marginHorizontal: spacing.md,
      backgroundColor: theme.bg.secondary,
      borderRadius: 8,
      overflow: 'hidden',
    },
    standalone: {
      marginHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.lg,
      backgroundColor: theme.bg.secondary,
      borderRadius: 8,
    },
  })
}
