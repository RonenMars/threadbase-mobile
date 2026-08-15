import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Notifications from 'expo-notifications'
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import { useLiveCameraPermissions } from '@/hooks/useLiveCameraPermissions'

export type PermissionStatus = 'granted' | 'denied' | 'undetermined'
export type PermissionKey = 'camera' | 'microphone' | 'photos' | 'notifications'

export type PermissionsStatus = {
  camera: PermissionStatus
  microphone: PermissionStatus
  photos: PermissionStatus
  notifications: PermissionStatus
}

async function fetchStatuses(): Promise<Omit<PermissionsStatus, 'camera'>> {
  const [mic, photos, notifs] = await Promise.all([
    ExpoSpeechRecognitionModule.getPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ])
  return {
    microphone: mic.status as PermissionStatus,
    photos: photos.status as PermissionStatus,
    notifications: notifs.status as PermissionStatus,
  }
}

export function usePermissionsStatus() {
  // Camera is the one permission `refresh` below cannot see: fetchStatuses is
  // typed `Omit<PermissionsStatus, 'camera'>` and only re-reads the other three,
  // so the foreground listener left the Camera row showing whatever was true
  // before the user walked to Settings. The live hook re-reads it there.
  const [cameraPermission, requestCameraPermission] = useLiveCameraPermissions()
  const [statuses, setStatuses] = useState<PermissionsStatus>({
    camera: 'undetermined',
    microphone: 'undetermined',
    photos: 'undetermined',
    notifications: 'undetermined',
  })

  const refresh = useCallback(async () => {
    const next = await fetchStatuses()
    setStatuses((prev) => ({ ...prev, ...next }))
  }, [])

  // Sync camera status from the expo-camera hook (no extra async call needed)
  useEffect(() => {
    if (!cameraPermission) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatuses((prev) => ({ ...prev, camera: cameraPermission.status as PermissionStatus }))
  }, [cameraPermission])

  // Fetch all non-camera permissions on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  // Re-check when returning from background (user may have changed permissions in OS Settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const request = useCallback(async (key: PermissionKey) => {
    switch (key) {
      case 'camera': {
        const result = await requestCameraPermission()
        setStatuses((prev) => ({ ...prev, camera: result.status as PermissionStatus }))
        break
      }
      case 'microphone': {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
        setStatuses((prev) => ({ ...prev, microphone: result.status as PermissionStatus }))
        break
      }
      case 'photos': {
        const result = await ImagePicker.requestMediaLibraryPermissionsAsync()
        setStatuses((prev) => ({ ...prev, photos: result.status as PermissionStatus }))
        break
      }
      case 'notifications': {
        const result = await Notifications.requestPermissionsAsync()
        setStatuses((prev) => ({ ...prev, notifications: result.status as PermissionStatus }))
        break
      }
    }
  }, [requestCameraPermission])

  const openSettings = useCallback(() => Linking.openSettings(), [])

  return { statuses, refresh, request, openSettings }
}
