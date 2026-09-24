#!/usr/bin/env bash
# check-sentry-env.sh — gate the sentry-cli source-map upload credentials on APP_ENV.
#
# The @sentry/react-native Expo config plugin injects an Xcode build phase that
# shells out to sentry-cli on every Release build. Without SENTRY_AUTH_TOKEN /
# SENTRY_ORG / SENTRY_PROJECT that phase kills the build ~90 seconds in, buried
# in clang output — which is how an E2E run can burn a macOS runner without
# reaching a single Maestro flow.
#
#   APP_ENV=production  (the default)  the three vars are REQUIRED; missing ones
#                                      are named here, before any compile starts.
#   APP_ENV=development                they are optional; the upload is skipped.
#
# Unset APP_ENV means production on purpose: a release pipeline that forgets the
# flag gets the strict path, not a silently source-map-less build.
#
# Development uses SENTRY_DISABLE_AUTO_UPLOAD rather than SENTRY_ALLOW_FAILURE:
# disabling skips the sentry-cli call outright, so the build neither waits on a
# doomed network round-trip nor prints an upload error that looks like a defect.
# ALLOW_FAILURE would also tolerate a *real* credential rot wherever it is set,
# which is the failure mode this script exists to make loud.
#
# Prints `KEY=value` lines to stdout for the caller to apply (GitHub Actions:
# append to "$GITHUB_ENV"). Production prints nothing. Exits 1 on a missing
# credential.
#
# This is build-time only. It is unrelated to resolveEnvironment() in
# services/sentry.ts, which tags runtime crash events and is not readable here.

set -euo pipefail

APP_ENV="${APP_ENV:-production}"

case "$APP_ENV" in
  development)
    echo "SENTRY_DISABLE_AUTO_UPLOAD=true"
    ;;
  production)
    missing=()
    for var in SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT; do
      [[ -n "${!var:-}" ]] || missing+=("$var")
    done
    if (( ${#missing[@]} > 0 )); then
      echo "APP_ENV=production requires the sentry-cli credentials; missing: ${missing[*]}" >&2
      echo "Set them in the build environment, or use APP_ENV=development to skip the source-map upload." >&2
      exit 1
    fi
    # Defense-in-depth only — the runtime __DEV__ gate in
    # lib/diagnosticsConsentFlag.ts already makes this inert in a Release
    # bundle. Printed to stderr so stdout's KEY=value contract stays intact.
    if [[ "${EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI:-0}" == "1" ]]; then
      echo "::error::QA diagnostics consent UI override must not be enabled in production" >&2
      exit 1
    fi
    echo "Diagnostics QA UI override: disabled" >&2
    # Enforced tracking bypasses the user's diagnostics consent, so a store build
    # must never carry it. Expo inlines EXPO_PUBLIC_* from the shell *and* from
    # .env / .env.local in the working directory (ship scripts run from the repo
    # root), so both are checked.
    # Same values services/sentry.ts accepts: 1 or true, any case.
    if [[ "${EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING:-}" =~ ^(1|[Tt][Rr][Uu][Ee])$ ]] ||
       grep -qsiE '^[[:space:]]*EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING[[:space:]]*=[[:space:]]*["'"'"']?(1|true)["'"'"']?[[:space:]]*(#.*)?$' .env .env.local .env.production .env.production.local; then
      echo "::error::EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING bypasses diagnostics consent and must not be set in a production build" >&2
      exit 1
    fi
    ;;
  *)
    echo "APP_ENV must be 'production' or 'development' (got '$APP_ENV')" >&2
    exit 2
    ;;
esac
