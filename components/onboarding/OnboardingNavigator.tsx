import React, { useCallback, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from '@/services/secure-store'
import { useServersStore } from '@/stores/servers'
import type { PairResult } from '@/hooks/useTBPair'
import { OnboardingShell } from './OnboardingShell'
import { ConnectStep } from './steps/ConnectStep'
import { DoneStep } from './steps/DoneStep'
import { NotificationsStep } from './steps/NotificationsStep'
import { WelcomeStep } from './steps/WelcomeStep'

// Welcome → Connect → Notifications → Done (redesign: Notifications after pair)
export const TOTAL_STEPS = 4
export const ONBOARDED_KEY = 'threadbase_onboarded'
const PAIRED_TOKEN_HASH_KEY = 'threadbase_paired_token_hash'

interface Props {
  onDone: () => void
}

// FNV-1a 32-bit hash → hex. Stored alongside `onboarded:true` so we never
// persist the raw token but can later compare/audit which token was used.
function hashToken(token: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function deriveHost(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname || 'localhost'
  } catch {
    return url.replace(/^https?:\/\//, '').split(/[/:]/)[0] || 'localhost'
  }
}

function derivePort(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.port) return parsed.port
    return parsed.protocol === 'https:' ? '443' : '80'
  } catch {
    return '8766'
  }
}

export function OnboardingNavigator({ onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1 | 0>(0)
  const [paired, setPaired] = useState<PairResult | null>(null)
  const addServer = useServersStore((s) => s.addServer)

  const goto = useCallback((next: number) => {
    setIndex((curr) => {
      const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next))
      setDirection(clamped >= curr ? 1 : -1)
      return clamped
    })
  }, [])

  const onNext = useCallback(() => {
    setIndex((curr) => {
      // Connect step: swipe/forward must not jump to Done unpaired.
      if (curr === 1 && !paired) return curr
      if (curr >= TOTAL_STEPS - 1) return curr
      setDirection(1)
      return curr + 1
    })
  }, [paired])

  // ConnectStep calls this after a successful pair — bypass the unpaired guard
  // (paired state may not have flushed yet when onAdvance runs).
  const advanceAfterPair = useCallback(() => {
    setDirection(1)
    setIndex(2)
  }, [])

  const onBack = useCallback(() => {
    setIndex((curr) => {
      if (curr <= 0) return curr
      setDirection(-1)
      return curr - 1
    })
  }, [])

  // Welcome: no Skip (avoids empty-Hub first impression). Connect: "Pair later".
  // Skip / pair-later: jump to Done, skipping Notifications when unpaired.
  const onSkip = useCallback(() => {
    if (index !== 1) return
    goto(TOTAL_STEPS - 1)
  }, [goto, index])

  const handlePaired = useCallback((result: PairResult) => {
    setPaired(result)
  }, [])

  const handleEnter = useCallback(async () => {
    try {
      if (paired) {
        await addServer(paired.url, paired.apiKey)
        await SecureStore.setItemAsync(
          PAIRED_TOKEN_HASH_KEY,
          hashToken(paired.apiKey),
        )
      }
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true')
    } finally {
      onDone()
    }
  }, [addServer, onDone, paired])

  return (
    <OnboardingShell
      index={index}
      total={TOTAL_STEPS}
      direction={direction}
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
      showSkip={index === 1}
      skipLabelKey="shell.pairLater"
    >
      {index === 0 && <WelcomeStep onNext={onNext} />}
      {index === 1 && (
        <ConnectStep onPaired={handlePaired} onAdvance={advanceAfterPair} />
      )}
      {index === 2 && <NotificationsStep onNext={onNext} />}
      {index === 3 && (
        <DoneStep
          onEnter={handleEnter}
          serverHost={paired ? deriveHost(paired.url) : undefined}
          serverPort={paired ? derivePort(paired.url) : undefined}
        />
      )}
    </OnboardingShell>
  )
}
