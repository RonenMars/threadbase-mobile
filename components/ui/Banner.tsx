import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native'
import { CaretDown, CaretUp } from 'phosphor-react-native'

interface BannerAction {
  label: string
  onPress: () => void
}

interface Props {
  title: string
  message: string
  accent: string
  icon?: React.ReactNode
  action?: BannerAction
  secondaryAction?: BannerAction
  details?: string
  style?: ViewStyle
}

export function Banner({ title, message, accent, icon, action, secondaryAction, details, style }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { borderColor: accent }, style]}>
        {icon}
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.message, { color: accent }]}>{message}</Text>

        {details ? (
          <View style={styles.detailsContainer}>
            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => setDetailsOpen((v) => !v)}
            >
              <Text style={{ color: accent, fontSize: 12 }}>More info</Text>
              {detailsOpen
                ? <CaretUp size={12} color={accent} />
                : <CaretDown size={12} color={accent} />}
            </TouchableOpacity>
            {detailsOpen ? (
              <Text style={[styles.detailsText, { color: accent }]}>{details}</Text>
            ) : null}
          </View>
        ) : null}

        {(action || secondaryAction) ? (
          <View style={styles.actions}>
            {secondaryAction ? (
              <TouchableOpacity style={styles.actionBtn} onPress={secondaryAction.onPress}>
                <Text style={styles.actionLabel}>{secondaryAction.label}</Text>
              </TouchableOpacity>
            ) : null}
            {action ? (
              <TouchableOpacity style={styles.actionBtn} onPress={action.onPress}>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 240,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  title: {
    color: '#e6edf3',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  detailsContainer: {
    width: '100%',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  detailsText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.75,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionLabel: {
    color: '#e6edf3',
    fontSize: 13,
    fontWeight: '600',
  },
})
