/**
 * Screenshot handling for feedback. The user must EXPLICITLY pick an image —
 * the screen is never captured automatically. Picked images are re-encoded and
 * downscaled, which strips EXIF/metadata (location, device) and enforces a size
 * cap. The result is submitted exactly as the user selected it; the UI warns
 * that a screenshot may contain sensitive on-screen content.
 */

import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import type { FeedbackAttachment } from '@/types/feedback'

/** Max width the screenshot is downscaled to (keeps size + readability sane). */
const MAX_WIDTH = 1400
/** JPEG quality after re-encode. */
const COMPRESS_QUALITY = 0.7
/** Hard ceiling on the attachment size. */
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024

async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri)
    return info.exists && typeof info.size === 'number' ? info.size : 0
  } catch {
    return 0
  }
}

/**
 * Let the user pick a screenshot from their library, then re-encode + downscale
 * it (which strips EXIF and metadata) and enforce the size cap.
 *
 * @returns the prepared attachment, or null if the user cancelled.
 * @throws if the prepared image still exceeds the size cap (caller shows an error).
 */
export async function pickAndPrepareScreenshot(): Promise<FeedbackAttachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: false,
    quality: 1,
    exif: false, // do not read EXIF at pick time
    allowsMultipleSelection: false,
  })
  if (result.canceled || result.assets.length === 0) return null

  // Re-encode to JPEG + downscale. This drops any residual metadata the OS
  // attached and bounds the dimensions/size. Always resize to MAX_WIDTH — the
  // picker's reported asset.width can be missing (e.g. with exif:false on some
  // OS/library combos), so gating the resize on it left full-resolution modern
  // phone screenshots (3000px+) uncompressed enough to blow past the cap.
  let manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  )

  let sizeBytes = await fileSize(manipulated.uri)
  // Still too large (a very tall/dense screenshot) — retry once smaller before
  // giving up, so users with huge screens don't hit a dead end.
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: MAX_WIDTH / 2 } }],
      { compress: COMPRESS_QUALITY / 2, format: ImageManipulator.SaveFormat.JPEG },
    )
    sizeBytes = await fileSize(manipulated.uri)
  }

  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error('screenshot_too_large')
  }

  return {
    uri: manipulated.uri,
    mimeType: 'image/jpeg',
    sizeBytes,
  }
}
