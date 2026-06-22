import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition'

type UseVoiceInputArgs = {
  onTranscript: (text: string) => void
  contextualStrings?: string[]
}

const SILENCE_TIMEOUT_MS = 30_000

export function useVoiceInput({ onTranscript, contextualStrings }: UseVoiceInputArgs) {
  const [listening, setListening] = useState(false)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
  }, [])

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer()
    silenceTimer.current = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.stop()
      } catch {}
      setListening(false)
    }, SILENCE_TIMEOUT_MS)
  }, [clearSilenceTimer])

  useSpeechRecognitionEvent('result', (e: { results: { transcript: string }[] }) => {
    armSilenceTimer()
    const transcript = e.results[0]?.transcript ?? ''
    if (transcript) onTranscript(transcript)
  })

  useSpeechRecognitionEvent('end', () => {
    clearSilenceTimer()
    setListening(false)
  })

  useSpeechRecognitionEvent('error', () => {
    clearSilenceTimer()
    setListening(false)
  })

  useEffect(
    () => () => {
      clearSilenceTimer()
      try {
        ExpoSpeechRecognitionModule.stop()
      } catch {}
    },
    [clearSilenceTimer],
  )

  const start = useCallback(async () => {
    // Simulators have no real mic; AVAudioEngine input init RPC-times-out and
    // aborts the process (native SIGABRT, uncatchable from JS). Skip there.
    if (!Device.isDevice) {
      throw new Error('VOICE_UNAVAILABLE')
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!granted) {
      throw new Error('PERMISSION_DENIED')
    }
    setListening(true)
    armSilenceTimer()
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: Platform.OS === 'ios',
      contextualStrings,
    })
  }, [contextualStrings, armSilenceTimer])

  const stop = useCallback(() => {
    clearSilenceTimer()
    try {
      ExpoSpeechRecognitionModule.stop()
    } catch {}
    setListening(false)
  }, [clearSilenceTimer])

  return { listening, start, stop }
}
