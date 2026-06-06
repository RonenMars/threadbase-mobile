import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TourTarget } from './TourOverlay'

export const HUB_TOUR_KEY = 'threadbase_tour_hub'
const TOTAL_STEPS = 3

export type HubTourStep = 'sessionCard' | 'laneIndicator' | 'fab'

export interface HubTourState {
  stepIndex: number
  targets: Partial<Record<HubTourStep, TourTarget>>
  registerTarget: (step: HubTourStep, layout: TourTarget) => void
  advanceStep: () => void
  skipTour: () => void
}

export function useHubTour(): HubTourState | null {
  const [ready, setReady] = useState(false)
  const [seen, setSeen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targets, setTargets] = useState<Partial<Record<HubTourStep, TourTarget>>>({})

  useEffect(() => {
    AsyncStorage.getItem(HUB_TOUR_KEY).then((v) => {
      if (v === 'seen') setSeen(true)
      setReady(true)
    })
  }, [])

  const markSeen = useCallback(() => {
    setSeen(true)
    void AsyncStorage.setItem(HUB_TOUR_KEY, 'seen')
  }, [])

  const advanceStep = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1
      if (next >= TOTAL_STEPS) {
        markSeen()
      }
      return next
    })
  }, [markSeen])

  const skipTour = useCallback(() => {
    markSeen()
  }, [markSeen])

  const registerTarget = useCallback((step: HubTourStep, layout: TourTarget) => {
    setTargets((prev) => ({ ...prev, [step]: layout }))
  }, [])

  if (!ready || seen || stepIndex >= TOTAL_STEPS) return null

  return { stepIndex, targets, registerTarget, advanceStep, skipTour }
}
