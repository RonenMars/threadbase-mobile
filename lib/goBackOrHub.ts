/**
 * Deep links (push, threadbase:// URLs, an OS-camera QR with the app closed)
 * can mount a screen as the only stack entry. router.back() then fires an
 * unhandled GO_BACK. Fall back to the hub instead.
 */
export function goBackOrHub(router: {
  canGoBack: () => boolean
  back: () => void
  replace: (href: '/') => void
}): void {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.replace('/')
  }
}
