# Crash Reporting (Sentry) — Setup & Privacy

Threadbase Mobile has **optional, opt-in** crash reporting built on
[`@sentry/react-native`](https://docs.sentry.io/platforms/react-native/). It is
**disabled by default** and never transmits anything unless the user explicitly
enables it in **Settings → Crash Reporting** _and_ a DSN is configured _and_ the
build environment permits reporting.

This document covers local configuration and the manual Sentry/EAS dashboard
steps. **Never commit a real DSN or auth token.**

## What is (and isn't) sent

Everything that leaves the device passes through the centralized sanitizer
(`services/sanitize.ts`) via `beforeSend` / `beforeBreadcrumb`. See
`docs/privacy-policy/proposed-privacy-policy.md` for the authoritative list. In short:

- **Sent (when opted in):** app version, build number, platform, OS
  major/minor, JS engine, environment/channel, Expo runtime version, EAS update
  id, an anonymous per-install UUID (for issue grouping only), a derived generic
  connection-mode enum (`local`/`remote`/`unknown`), and scrubbed exception
  type/message/stack frames.
- **Never sent:** prompts, terminal output, source code, file contents,
  credentials, tokens, headers, server URLs, hostnames, IPs, repository
  names/paths, absolute/home paths, session names/titles, WebSocket payloads,
  request/response bodies, clipboard contents, or device names.

Session Replay, screenshots, view-hierarchy attachment, console capture,
network breadcrumbs, and default PII are all **disabled** in
`services/sentry.ts`.

## Configuration (fork-friendly — no org/project hardcoded)

`app.json` registers the Sentry Expo plugin with no `organization`/`project`
props, so this repo carries no Sentry account details. Each builder points the
app at their own Sentry project via environment variables:

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | `.env` | Runtime DSN the app sends events to. Public by design (not a secret). |
| `EXPO_PUBLIC_SENTRY_ALLOW_DEV` | `.env` | Optional local QA override. Set to `1` only when you want a development build to transmit Sentry events. |
| `EXPO_PUBLIC_SENTRY_DEBUG` | `.env` | Optional SDK troubleshooting flag. Set to `1` only when you need verbose Sentry SDK logs in Metro. |
| `SENTRY_ORG` | shell env / EAS env | Org slug, used only at build time to upload source maps. |
| `SENTRY_PROJECT` | shell env / EAS env | Project slug, used only at build time to upload source maps. |
| `SENTRY_AUTH_TOKEN` | shell env / EAS env (**sensitive**) | Secret. Authenticates the source-map upload. Never in `.env`, never committed. |

Without `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`, crash reporting still
works end-to-end (events transmit with `EXPO_PUBLIC_SENTRY_DSN` + consent) —
stack traces just show up unsymbolicated in the Sentry dashboard.
