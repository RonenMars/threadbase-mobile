import type { ProviderName } from '@/constants/providers'

/** The most frequent defined provider; undefined when empty or tied at the top. */
export function dominantProvider(
  providers: readonly (ProviderName | undefined)[],
): ProviderName | undefined {
  const counts = new Map<ProviderName, number>()
  for (const provider of providers) {
    if (provider == null) continue
    counts.set(provider, (counts.get(provider) ?? 0) + 1)
  }
  let top: ProviderName | undefined
  let topCount = 0
  let tied = false
  for (const [provider, count] of counts) {
    if (count > topCount) {
      top = provider
      topCount = count
      tied = false
    } else if (count === topCount) {
      tied = true
    }
  }
  return tied ? undefined : top
}

/** Marks appear only on a mixed screen, and only on rows that break from the majority. */
export function showsProviderMark(
  provider: ProviderName | undefined,
  dominant: ProviderName | undefined,
): boolean {
  return provider != null && dominant != null && provider !== dominant
}
