import { getSafeBuildMetadata } from '@/services/safe-metadata'

/**
 * `app.json`'s `version` has stayed 1.0.0 since the first commit, so the build
 * number is what actually moves on an update.
 */
export function currentIntroVersion(): string {
  const { appVersion, buildNumber } = getSafeBuildMetadata()
  return `${appVersion} (${buildNumber})`
}
