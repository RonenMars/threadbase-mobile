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
  // False after cancel(): a result already in flight must not refill a composer
  // that was just sent and cleared.
  const acceptResultsRef = useRef(false)

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
    if (!acceptResultsRef.current) return
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
    acceptResultsRef.current = true
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

  // stop() asks the recognizer for a final `result`; abort() discards it.
  const cancel = useCallback(() => {
    acceptResultsRef.current = false
    clearSilenceTimer()
    try {
      ExpoSpeechRecognitionModule.abort()
    } catch {}
    setListening(false)
  }, [clearSilenceTimer])

  return { listening, start, stop, cancel }
}
