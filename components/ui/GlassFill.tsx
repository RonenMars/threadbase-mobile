import React from 'react'
import { StyleSheet } from 'react-native'
import { GlassView } from './GlassView'

interface GlassFillProps {
  /** Adds one material layer for a major card or sheet surface. */
  material?: boolean
  /** Retained while callers migrate away from nested surface backgrounds. */
  intensity?: number
}

/**
 * Legacy background helper.
 *
 * Major cards and sheets now own the only material layer. Leaving this
 * transparent prevents controls nested inside them from becoming glass-on-glass.
 */
export function GlassFill({ material = false, intensity }: GlassFillProps) {
  if (!material) return null
  return <GlassView intensity={intensity} style={StyleSheet.absoluteFill} pointerEvents="none" />
}
