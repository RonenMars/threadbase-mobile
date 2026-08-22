import React, { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import * as SecureStore from '@/services/secure-store'
import { ONBOARDING_RESUME_KEY, parseOnboardingResume } from '@/lib/onboarding-resume'
import { useServersStore } from '@/stores/servers'
import { persistSettingsNow } from '@/stores/settings'
import type { PairResult } from '@/hooks/useTBPair'
import { OnboardingShell } from './OnboardingShell'
import { ConnectStep } from './steps/ConnectStep'
import { DoneStep } from './steps/DoneStep'
import { LanguageStep } from './steps/LanguageStep'
import { NotificationsStep } from './steps/NotificationsStep'
import { WelcomeStep } from './steps/WelcomeStep'

// Language → Welcome → Connect → Notifications → Done
export const TOTAL_STEPS = 5
export const ONBOARDED_KEY = 'threadbase_onboarded'
const PAIRED_TOKEN_HASH_KEY = 'threadbase_paired_token_hash'

interface Props {
  onDone: () => void
  mode?: 'review'
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

export function OnboardingNavigator({ onDone, mode }: Props) {
  const { t } = useTranslation('onboarding')
  const [index, setIndex] = useState<number | null>(null)
  const [direction, setDirection] = useState<1 | -1 | 0>(0)
  const [paired, setPaired] = useState<PairResult | null>(null)
  const [languageBusy, setLanguageBusy] = useState(false)
  const [languageError, setLanguageError] = useState<'persist' | null>(null)
  const languageInProgress = useRef(false)
  const addServer = useServersStore((s) => s.addServer)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let initialIndex = 0
      try {
        const rawResume = await AsyncStorage.getItem(ONBOARDING_RESUME_KEY)
        const resume = parseOnboardingResume(rawResume)
        if (resume?.mode === 'review' && mode !== 'review') return
        if (rawResume !== null) {
          await AsyncStorage.removeItem(ONBOARDING_RESUME_KEY)
          if (resume?.step === 'welcome') initialIndex = 1
        }
      } catch {
        initialIndex = 0
      }
      if (!cancelled) setIndex(initialIndex)
    })()
    return () => {
      cancelled = true
    }
  }, [mode])

  const goto = useCallback((next: number) => {
    setIndex((curr) => {
      const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next))
      setDirection(clamped >= (curr ?? 0) ? 1 : -1)
      return clamped
    })
  }, [])

  const continueFromLanguage = useCallback(async () => {
    if (languageInProgress.current) return
    languageInProgress.current = true
    setLanguageBusy(true)
    setLanguageError(null)

    try {
      await persistSettingsNow()
    } catch {
      await AsyncStorage.removeItem(ONBOARDING_RESUME_KEY).catch(() => {})
      setLanguageError('persist')
      languageInProgress.current = false
      setLanguageBusy(false)
      return
    }

    // An LTR↔RTL change needs no reload: direction comes from i18next and is
    // painted as a Yoga `direction` style at the app root, so the next step
    // renders in the new direction on the same React tree.
    goto(1)
    languageInProgress.current = false
    setLanguageBusy(false)
  }, [goto])

  const onNext = useCallback(() => {
    if (index === 0) {
      void continueFromLanguage()
      return
    }
    setIndex((curr) => {
      if (curr === null) return curr
      // Connect step: swipe/forward must not jump to Done unpaired.
      if (curr === 2 && !paired) return curr
      if (curr >= TOTAL_STEPS - 1) return curr
      setDirection(1)
      return curr + 1
    })
  }, [continueFromLanguage, index, paired])

  // ConnectStep calls this after a successful pair — bypass the unpaired guard
  // (paired state may not have flushed yet when onAdvance runs).
  const advanceAfterPair = useCallback(() => {
    setDirection(1)
    setIndex(3)
  }, [])

  const onBack = useCallback(() => {
    setIndex((curr) => {
      if (curr === null) return curr
      if (curr <= 0) return curr
      setDirection(-1)
      return curr - 1
    })
  }, [])

  // Skip / pair-later: jump to Done, skipping Notifications when unpaired.
  const onSkip = useCallback(() => {
    if (index !== 2) return
    goto(TOTAL_STEPS - 1)
  }, [goto, index])

  const handlePaired = useCallback((result: PairResult) => {
    setPaired(result)
  }, [])

  const handleEnter = useCallback(async () => {
    try {
      if (paired) {
        await addServer(paired.url, paired.apiKey, paired.label, {
          deviceId: paired.deviceId,
          deviceToken: paired.deviceToken,
          capabilities: paired.capabilities,
          publicUrl: paired.publicUrl,
          serverPublicKey: paired.serverPublicKey,
          requireEncryption: paired.requireEncryption,
        })
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

  if (index === null) return null

  return (
    <OnboardingShell
      index={index}
      total={TOTAL_STEPS}
      direction={direction}
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
      showSkip={index === 2}
      skipLabelKey="shell.pairLater"
    >
      {index === 0 && (
        <LanguageStep
          onContinue={continueFromLanguage}
          busy={languageBusy}
          error={
            languageError === 'persist' ? t('language.persistRetry') : null
          }
        />
      )}
      {index === 1 && <WelcomeStep onNext={onNext} />}
      {index === 2 && (
        <ConnectStep onPaired={handlePaired} onAdvance={advanceAfterPair} />
      )}
      {index === 3 && <NotificationsStep onNext={onNext} />}
      {index === 4 && (
        <DoneStep
          onEnter={handleEnter}
          serverHost={paired ? deriveHost(paired.url) : undefined}
          serverPort={paired ? derivePort(paired.url) : undefined}
          serverLabel={paired?.label}
        />
      )}
    </OnboardingShell>
  )
}
