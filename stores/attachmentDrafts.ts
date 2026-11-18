import { create } from 'zustand'
import type { ComposerAttachment } from '@/services/uploads'

export function attachmentDraftKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface AttachmentDraftsStore {
  byKey: Record<string, ComposerAttachment[]>
  update: (key: string, fn: (prev: ComposerAttachment[]) => ComposerAttachment[]) => void
}

// In memory only, unlike text drafts: an upload lives in the streamer's upload dir and its
// localUri in the picker cache, so a restored copy could point at a file that is gone.
export const useAttachmentDraftsStore = create<AttachmentDraftsStore>((set) => ({
  byKey: {},
  update: (key, fn) =>
    set((s) => {
      const next = fn(s.byKey[key] ?? [])
      const { [key]: _removed, ...rest } = s.byKey
      return { byKey: next.length > 0 ? { ...rest, [key]: next } : rest }
    }),
}))
