import { useEffect, useState } from 'react'
import { browserNeedsWrappedKey, isDeviceStaticKeyWrapped } from '@/services/e2ee/device-key'

/**
 * Whether to show the weaker-key warning. With a server, whether that server's
 * stored key is wrapped; without one, whether a new pairing in this browser
 * would be. Always false on native.
 */
export function useWrappedKeyWarning(serverId?: string): boolean {
  const [wrapped, setWrapped] = useState(false)

  useEffect(() => {
    let live = true
    const probe = serverId ? isDeviceStaticKeyWrapped(serverId) : browserNeedsWrappedKey()
    probe
      .then((answer) => {
        if (live) setWrapped(answer)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [serverId])

  return wrapped
}
