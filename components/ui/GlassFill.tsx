import React from 'react'
import { StyleSheet } from 'react-native'
import { useIsGlass } from '@/contexts/ThemeContext'
import { GlassView } from './GlassView'

interface GlassFillProps {
  /** Override the blur intensity for this surface (defaults to the theme's). */
  intensity?: number
}

export function GlassFill({ intensity }: GlassFillProps) {
  const isGlass = useIsGlass()
  if (!isGlass) return null
  return <GlassView intensity={intensity} style={StyleSheet.absoluteFill} pointerEvents="none" />
}
