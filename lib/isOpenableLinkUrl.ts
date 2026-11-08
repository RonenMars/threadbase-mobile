/**
 * Gate for links tapped in model-rendered markdown. Anything but http(s) is
 * refused: tel:, sms:, intent: and app deep links such as threadbase://pair
 * would otherwise be one tap away from model output.
 */
export function isOpenableLinkUrl(raw: string): boolean {
  // new URL() silently strips leading whitespace, but openURL would receive the raw string.
  if (raw !== raw.trim()) return false
  try {
    const { protocol } = new URL(raw)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
