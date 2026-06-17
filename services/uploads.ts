import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as ImageManipulator from 'expo-image-manipulator'
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

const SINGLE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.85,
  exif: false,
}

const MULTI_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.85,
  exif: false,
  allowsMultipleSelection: true,
}

function isHeic(uri: string, mimeType: string): boolean {
  const lower = uri.toLowerCase()
  return lower.endsWith('.heic') || lower.endsWith('.heif') ||
    mimeType === 'image/heic' || mimeType === 'image/heif'
}

async function normalizeAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const mimeType = asset.mimeType ?? guessMimeFromUri(asset.uri)

  if (isHeic(asset.uri, mimeType)) {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    )
    if (!result.base64) throw new Error('HEIC conversion returned no base64 data')
    const filename = (asset.fileName ?? asset.uri.split('/').pop() ?? 'image')
      .replace(/\.(heic|heif)$/i, '.jpg')
    return { uri: result.uri, base64: result.base64, filename, mimeType: 'image/jpeg' }
  }

  if (!asset.base64) throw new Error('Image picker returned no base64 data')
  return {
    uri: asset.uri,
    base64: asset.base64,
    filename: asset.fileName ?? deriveFilename(asset.uri, mimeType),
    mimeType,
  }
}

export async function pickFromLibrary(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync(SINGLE_PICKER_OPTIONS)
  if (result.canceled || result.assets.length === 0) return null
  return normalizeAsset(result.assets[0])
}

export async function pickFromLibraryMulti(): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync(MULTI_PICKER_OPTIONS)
  if (result.canceled || result.assets.length === 0) return []
  return Promise.all(result.assets.map(normalizeAsset))
}

export async function pickFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) throw new Error('Camera permission denied')

  const result = await ImagePicker.launchCameraAsync(SINGLE_PICKER_OPTIONS)
  if (result.canceled || result.assets.length === 0) return null
  return normalizeAsset(result.assets[0])
}

export async function pickFromFiles(): Promise<PickedImage[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['*/*'],
    multiple: true,
    copyToCacheDirectory: true,
  })
  if (result.canceled || result.assets.length === 0) return []

  return Promise.all(
    result.assets.map(async (asset) => {
      const mimeType = asset.mimeType ?? guessMimeFromUri(asset.uri)
      // Read base64 via fetch (document picker doesn't provide base64 directly)
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const base64 = await blobToBase64(blob)
      const filename = asset.name ?? deriveFilename(asset.uri, mimeType)

      if (isHeic(asset.uri, mimeType)) {
        const converted = await ImageManipulator.manipulateAsync(
          asset.uri,
          [],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        )
        if (!converted.base64) throw new Error('HEIC conversion returned no base64 data')
        return {
          uri: converted.uri,
          base64: converted.base64,
          filename: filename.replace(/\.(heic|heif)$/i, '.jpg'),
          mimeType: 'image/jpeg',
        }
      }

      return { uri: asset.uri, base64, filename, mimeType }
    }),
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip "data:...;base64," prefix
      resolve(dataUrl.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
  const base = uri.split('/').pop() ?? 'image'
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
