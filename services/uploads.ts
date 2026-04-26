import * as ImagePicker from 'expo-image-picker'
import { useServersStore } from '@/stores/servers'
import { NetworkError, AuthError, NotFoundError } from '@/services/api-client'

export interface PickedImage {
  uri: string
  base64: string
  filename: string
  mimeType: string
}

export interface UploadedFile {
  id: string
  path: string
  originalName: string
  mimeType: string
  sizeBytes: number
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.85,
  exif: false,
}

export async function pickFromLibrary(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
  return assetToPicked(result)
}

export async function pickFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) throw new Error('Camera permission denied')

  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
  return assetToPicked(result)
}

function assetToPicked(result: ImagePicker.ImagePickerResult): PickedImage | null {
  if (result.canceled || result.assets.length === 0) return null
  const a = result.assets[0]
  if (!a.base64) throw new Error('Image picker returned no base64 data')
  const mimeType = a.mimeType ?? guessMimeFromUri(a.uri)
  const filename = a.fileName ?? deriveFilename(a.uri, mimeType)
  return { uri: a.uri, base64: a.base64, filename, mimeType }
}

function guessMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic')) return 'image/heic'
  if (lower.endsWith('.heif')) return 'image/heif'
  return 'image/jpeg'
}

function deriveFilename(uri: string, mimeType: string): string {
  const base = uri.split('/').pop() ?? `image-${Date.now()}`
  if (base.includes('.')) return base
  const ext = mimeType.split('/')[1] ?? 'jpg'
  return `${base}.${ext}`
}

export async function uploadAttachment(
  serverId: string,
  sessionId: string,
  image: PickedImage,
): Promise<UploadedFile> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}/api/sessions/${encodeURIComponent(sessionId)}/files`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${server.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      filename: image.filename,
      mimeType: image.mimeType,
      dataBase64: image.base64,
    }),
  })

  if (response.status === 401) throw new AuthError()
  if (response.status === 404) throw new NotFoundError(`/api/sessions/${sessionId}/files`)
  if (!response.ok) {
    let detail = `Server returned ${response.status}`
    try {
      const body = await response.json()
      if (body?.error) detail = body.error
    } catch {}
    throw new NetworkError(detail)
  }

  return response.json() as Promise<UploadedFile>
}
