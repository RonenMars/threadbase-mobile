import { NetworkError, NotFoundError } from '@/services/api-client'
import { CODEX_CLI_PROVIDER } from '@/constants/providers'
import type { Session } from '@/types/api'

/** The route is absent — a streamer that predates PATCH /model and /effort. */
export function isRouteMissingError(err: Error | null | undefined): boolean {
  return err instanceof NotFoundError
}

/** 501 UNSUPPORTED_PROVIDER — the server has the route but not for this agent. */
export function isUnsupportedProviderError(err: Error | null | undefined): boolean {
  return err instanceof NetworkError && err.status === 501
}

/**
 * Whether the model/effort entry point may be shown.
 *
 * `effort` is the capability signal: the streamer emits it in session state for
 * live Claude sessions that can take the setting, and a server too old to have
 * the routes never emits it. The 404/501 checks stay as the fallback for the
 * first write against a server that reports `effort` but refuses the route.
 */
export function canSetModelEffort(
  session: Pick<Session, 'provider' | 'effort'> | undefined | null,
  errors: readonly (Error | null | undefined)[] = [],
): boolean {
  if (!session) return false
  if (session.provider === CODEX_CLI_PROVIDER) return false
  if (session.effort === undefined || session.effort === null) return false
  return !errors.some((e) => isRouteMissingError(e) || isUnsupportedProviderError(e))
}
