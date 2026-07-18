import { useCallback, useEffect, useState } from 'react'
import { Alert, AppState, Linking } from 'react-native'
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useRenameSession } from '@/hooks/useSessionName'
import {
  pickFromCamera,
  pickFromLibraryMulti,
  pickFromFiles,
  uploadAttachment,
  type UploadedFile,
} from '@/services/uploads'
import { useDraftsStore } from '@/stores/drafts'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import type { SlashCommand } from '@/constants/slashCommands'

export interface UseComposerStateOptions {
  serverId: string
  sessionId: string
  onSend: (payload: string, optimisticText: string) => void
}

export interface ComposerState {
  inputText: string
  handleInputChange: (text: string) => void
  handleSend: () => void
  slashBoardVisible: boolean
  setSlashBoardVisible: (v: boolean) => void
  pendingArgCommand: SlashCommand | null
  setPendingArgCommand: (c: SlashCommand | null) => void
  handleSlashCommandSelect: (command: SlashCommand) => void
  handleSlashArgConfirm: (command: SlashCommand, arg: string) => void
  attachments: UploadedFile[]
  isUploading: boolean
  attachError: string | null
  handleAttach: () => void
  removeAttachment: (id: string) => void
  queueVisible: boolean
  setQueueVisible: (v: boolean) => void
  voice: { listening: boolean; start: () => Promise<void>; stop: () => void }
  micGranted: boolean
  handleToggleMic: () => Promise<void>
}

export function useComposerState({ serverId, sessionId, onSend }: UseComposerStateOptions): ComposerState {
  const [inputText, setInputText] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [slashBoardVisible, setSlashBoardVisible] = useState(false)
  const [pendingArgCommand, setPendingArgCommand] = useState<SlashCommand | null>(null)
  const [queueVisible, setQueueVisible] = useState(false)
  const [micGranted, setMicGranted] = useState(false)

  const setDraft = useDraftsStore((s) => s.setDraft)
  const clearDraft = useDraftsStore((s) => s.clearDraft)
  const hydrateDrafts = useDraftsStore((s) => s.hydrate)
  const getName = useSessionNamesStore((s) => s.getName)
  const { autoNameFromMessage } = useSettingsStore()
  const renameSession = useRenameSession(serverId)

  const voice = useVoiceInput({
    onTranscript: (text) => setInputText(text),
    contextualStrings: ['React', 'TypeScript', 'useEffect', 'Expo', 'TSX', 'Claude'],
  })

  const checkMicPermission = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync()
    setMicGranted(granted)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void checkMicPermission() }, [checkMicPermission])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkMicPermission()
    })
    return () => sub.remove()
  }, [checkMicPermission])

  useEffect(() => {
    hydrateDrafts().then(() => {
      const draft = useDraftsStore.getState().getDraft(serverId, sessionId)
      if (draft) setInputText(draft)
    })
  }, [serverId, sessionId, hydrateDrafts])

  const buildPayload = (text: string): string | null => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return null
    // Escape spaces in paths so Claude Code's @path parser doesn't split them.
    // The streamer now sanitizes filenames, but this handles legacy uploads.
    const escapePath = (p: string) => p.replace(/ /g, '\\ ')
    const refs = attachments.map((a) => `@${escapePath(a.path)}`).join(' ')
    return refs && trimmed ? `${refs} ${trimmed}` : refs || trimmed
  }

  const resetComposer = () => {
    setInputText('')
    setAttachments([])
    setAttachError(null)
    clearDraft(serverId, sessionId)
  }

  const handleInputChange = (text: string) => {
    setInputText(text)
    setDraft(serverId, sessionId, text)
    setSlashBoardVisible(/^\/.{0,30}$/.test(text))
  }

  const handleSend = () => {
    const text = inputText.trim()
    const payload = buildPayload(text)
    if (!payload) return
    if (autoNameFromMessage && !getName(serverId, sessionId)) {
      const autoName = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
      if (autoName) renameSession.mutate({ sessionId, name: autoName, origin: 'auto' })
    }
    onSend(payload, text || payload)
    resetComposer()
  }

  const handleSlashCommandSelect = (command: SlashCommand) => {
    setSlashBoardVisible(false)
    if (command.needsArgs) {
      setInputText('')
      setPendingArgCommand(command)
      return
    }
    const payload = `/${command.id}`
    onSend(payload, payload)
    resetComposer()
  }

  const handleSlashArgConfirm = (command: SlashCommand, arg: string) => {
    setPendingArgCommand(null)
    const payload = `/${command.id} ${arg}`
    onSend(payload, payload)
    resetComposer()
  }

  const runUpload = async (source: 'camera' | 'library' | 'files') => {
    setAttachError(null)
    try {
      let images: Awaited<ReturnType<typeof pickFromLibraryMulti>>
      if (source === 'camera') {
        const single = await pickFromCamera()
        if (!single) return
        images = [single]
      } else if (source === 'library') {
        images = await pickFromLibraryMulti()
        if (images.length === 0) return
      } else {
        images = await pickFromFiles()
        if (images.length === 0) return
      }
      setIsUploading(true)
      const uploaded = await Promise.all(images.map((img) => uploadAttachment(serverId, sessionId, img)))
      setAttachments((prev) => [...prev, ...uploaded])
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAttach = () => {
    if (isUploading) return
    Alert.alert('Attach', undefined, [
      { text: 'Take Photo', onPress: () => runUpload('camera') },
      { text: 'Choose from Gallery', onPress: () => runUpload('library') },
      { text: 'Choose Files', onPress: () => runUpload('files') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  const handleToggleMic = async () => {
    if (voice.listening) return voice.stop()
    try {
      await voice.start()
      setMicGranted(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'PERMISSION_DENIED') {
        setMicGranted(false)
        Alert.alert('Microphone access needed', 'Enable microphone access in Settings to dictate.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ])
      }
    }
  }

  return {
    inputText,
    handleInputChange,
    handleSend,
    slashBoardVisible,
    setSlashBoardVisible,
    pendingArgCommand,
    setPendingArgCommand,
    handleSlashCommandSelect,
    handleSlashArgConfirm,
    attachments,
    isUploading,
    attachError,
    handleAttach,
    removeAttachment,
    queueVisible,
    setQueueVisible,
    voice,
    micGranted,
    handleToggleMic,
  }
}
