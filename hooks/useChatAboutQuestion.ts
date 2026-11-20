import { useCallback, useState } from 'react'
import { useServersStore } from '@/stores/servers'

/**
 * The composer side of "Chat about this". Once that answer lands, the question
 * becomes the composer's placeholder and the input takes focus, so the user
 * replies to it without it being typed into their message. The next send clears it.
 *
 * `onChatAbout` is undefined on a server without `questionOther`: the hosts read
 * that as "offer neither terminal row", because such a server would decline
 * the whole question on either one.
 */
export function useChatAboutQuestion(serverId: string) {
  const questionOther = useServersStore((s) => s.servers[serverId]?.serverInfo?.questionOther === true)
  const [placeholder, setPlaceholder] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  const onChatAbout = useCallback((question: string) => {
    setPlaceholder(question)
    setFocusRequest((n) => n + 1)
  }, [])
  const clear = useCallback(() => setPlaceholder(null), [])

  return { onChatAbout: questionOther ? onChatAbout : undefined, placeholder, focusRequest, clear }
}
