import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { NestableDraggableFlatList, RenderItemParams } from 'react-native-draggable-flatlist'
import { DotsSixVertical } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { ServerConfig } from '@/types/api'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  activeServerIds: string[]
  servers: Record<string, ServerConfig>
  selectedServerIds: string[]
  onChange: (ids: string[]) => void
  showQuickActions?: boolean
  isEditingOrder?: boolean
  onReorder?: (orderedIds: string[]) => void
}

function toggleServer(selectedServerIds: string[], serverId: string): string[] {
  if (selectedServerIds.includes(serverId)) {
    return selectedServerIds.filter((id) => id !== serverId)
  }
  return [...selectedServerIds, serverId]
}

interface JigglingRowProps {
  server: ServerConfig
  index: number
  drag: () => void
  isActive: boolean
  isEditingOrder: boolean
}

function JigglingRow({ server, index, drag, isActive, isEditingOrder }: JigglingRowProps) {
  const rotation = useSharedValue(0)

  useEffect(() => {
    cancelAnimation(rotation)
    if (isEditingOrder) {
      const delay = index * 40
      const timer = setTimeout(() => {
        rotation.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 80 }),
            withTiming(2, { duration: 80 }),
          ),
          -1,
          true,
        )
      }, delay)
      return () => clearTimeout(timer)
    } else {
      rotation.value = withTiming(0, { duration: 100 })
    }
  }, [isEditingOrder, index, rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <Animated.View style={[animatedStyle, styles.jigglingRowWrapper]}>
      <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
        style={[styles.row, isActive && styles.rowActive]}
        activeOpacity={0.8}
      >
        <View style={styles.serverInfo}>
          <Text style={styles.serverLabel} numberOfLines={1}>
            {server.label || server.url}
          </Text>
          {server.label ? (
            <Text style={styles.serverUrl} numberOfLines={1}>
              {server.url}
            </Text>
          ) : null}
        </View>
        <View testID={`drag-handle-${server.id}`}>
          <DotsSixVertical size={20} color={dark.text.secondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

export function DisplayedServersList({
  activeServerIds,
  servers,
  selectedServerIds,
  onChange,
  showQuickActions = true,
  isEditingOrder = false,
  onReorder,
}: Props) {
  const { t } = useTranslation('servers')
  const latestServerId = activeServerIds[activeServerIds.length - 1]

  if (isEditingOrder) {
    const data = activeServerIds
      .map((id) => servers[id])
      .filter((s): s is ServerConfig => Boolean(s))

    return (
      <View style={styles.container}>
        <NestableDraggableFlatList
          data={data}
          keyExtractor={(s) => s.id}
          renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<ServerConfig>) => (
            <JigglingRow
              server={item}
              index={getIndex() ?? 0}
              drag={drag}
              isActive={isActive}
              isEditingOrder={isEditingOrder}
            />
          )}
          onDragEnd={({ data: reordered }) => onReorder?.(reordered.map((s) => s.id))}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {showQuickActions ? (
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => onChange(activeServerIds)}>
            <Text style={styles.quickButtonText}>{t('displayedServers.all')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => onChange(latestServerId ? [latestServerId] : [])}
          >
            <Text style={styles.quickButtonText}>{t('displayedServers.latestOnly')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => onChange([])}>
            <Text style={styles.quickButtonText}>{t('displayedServers.none')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activeServerIds.map((id) => {
        const server = servers[id]
        if (!server) return null
        const selected = selectedServerIds.includes(id)
        return (
          <View key={id} style={styles.row}>
            <View style={styles.serverInfo}>
              <Text style={styles.serverLabel} numberOfLines={1}>
                {server.label || server.url}
              </Text>
              {server.label ? (
                <Text style={styles.serverUrl} numberOfLines={1}>
                  {server.url}
                </Text>
              ) : null}
            </View>
            <Switch
              value={selected}
              onValueChange={() => onChange(toggleServer(selectedServerIds, id))}
              trackColor={{ false: dark.border, true: dark.text.accent }}
              thumbColor="#fff"
              testID={`server-toggle-${id}`}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  jigglingRowWrapper: {
    marginBottom: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickButton: {
    backgroundColor: dark.bg.card,
    borderColor: dark.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 38,
    justifyContent: 'center',
  },
  quickButtonText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  row: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowActive: {
    opacity: 0.7,
    transform: [{ scale: 1.02 }],
  },
  serverInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  serverLabel: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  serverUrl: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
})
