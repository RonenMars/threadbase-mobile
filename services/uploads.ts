import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
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

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: false,
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

async function assetToPicked(result: ImagePicker.ImagePickerResult): Promise<PickedImage | null> {
  if (result.canceled || result.assets.length === 0) return null
  const a = result.assets[0]
  const mimeType = a.mimeType ?? guessMimeFromUri(a.uri)
  const filename = a.fileName ?? deriveFilename(a.uri, mimeType)
  console.log('[uploads] pickerResult', {
    uri: a.uri,
    mimeType,
    filename,
    width: a.width,
    height: a.height,
  })
  const heic = mimeType === 'image/heic' || mimeType === 'image/heif'
  console.log('[uploads] normalizeAsset:start', { uri: a.uri, heic, mimeType })
  const sourceUri = heic ? await convertHeicToJpeg(a.uri) : a.uri
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  console.log('[uploads] normalizeAsset', {
    uri: a.uri,
    mimeType,
    filename,
    heic,
    width: a.width,
    height: a.height,
    base64Len: base64.length,
  })
  return {
    uri: sourceUri,
    base64,
    filename: heic ? replaceExtension(filename, 'jpg') : filename,
    mimeType: heic ? 'image/jpeg' : mimeType,
  }
}

async function convertHeicToJpeg(uri: string): Promise<string> {
  console.log('[uploads] convertToJpeg:start', { uri })
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  })
  console.log('[uploads] convertToJpeg', { uri, resultUri: result.uri })
  return result.uri
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

function replaceExtension(filename: string, extension: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) return `${filename}.${extension}`
  return `${filename.slice(0, idx + 1)}${extension}`
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
  console.log('[uploads] uploadAttachment:request', {
    url,
    filename: image.filename,
    mimeType: image.mimeType,
    base64Len: image.base64.length,
    status: response.status,
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
