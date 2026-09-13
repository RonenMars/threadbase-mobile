import { getSafeBuildMetadata } from '@/services/safe-metadata'

const ENTRY_BUNDLE = /\/_expo\/static\/js\/web\/(entry-[0-9a-f]+)\.js/
// eslint-disable-next-line i18next/no-literal-string -- CSS selector, not UI copy
const SCRIPT_WITH_SRC = 'script[src]'

/**
 * A web export carries no ios/android build number (Expo drops those sections
 * from the web config), but its entry bundle filename is content-hashed, so it
 * changes on every deploy that changes the app. The dev server's bundle URL has
 * no hash, which only means the intro never replays under `expo start --web`.
 */
export function currentIntroVersion(): string {
  const { appVersion } = getSafeBuildMetadata()
  const scripts = Array.from(document.querySelectorAll(SCRIPT_WITH_SRC))
  const entry = scripts.map((s) => ENTRY_BUNDLE.exec(s.getAttribute('src') ?? '')?.[1]).find(Boolean)
  return entry ? `${appVersion} (${entry})` : appVersion
}
