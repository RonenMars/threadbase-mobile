import AsyncStorage from '@react-native-async-storage/async-storage'

export const ETAG_STORAGE_KEY = 'threadbase-etag-cache-v1'
const WRITE_DEBOUNCE_MS = 1000

// First-page ETags, keyed `${serverId}::${id}`. Durable across launches via a
// dedicated AsyncStorage entry — kept separate from the RQ persist cycle
// because a per-conversation validator string isn't a message-payload concern
// and shouldn't inherit persistBuster/maxAge semantics.
const etags = new Map<string, string>()
let writeTimer: ReturnType<typeof setTimeout> | null = null

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    const obj: Record<string, string> = {}
    for (const [k, v] of etags) obj[k] = v
    void AsyncStorage.setItem(ETAG_STORAGE_KEY, JSON.stringify(obj))
  }, WRITE_DEBOUNCE_MS)
}

export async function hydrateEtags(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ETAG_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') etags.set(k, v)
    }
  } catch {
    // Corrupt/missing → treat as no known ETags (graceful degradation).
  }
}

export function getEtag(key: string): string | undefined {
  return etags.get(key)
}

export function setEtag(key: string, etag: string): void {
  etags.set(key, etag)
  scheduleWrite()
}

export function deleteEtag(key: string): void {
  etags.delete(key)
  scheduleWrite()
}

export function __resetEtagStoreForTests(): void {
  etags.clear()
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
}

// Fire-and-forget hydration at module load. A tail fetch that races this read
// simply sees no known ETag and sends no If-None-Match (benign — gets 200).
void hydrateEtags()
