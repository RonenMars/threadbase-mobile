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
`docs/proposed-privacy-policy.md` for the authoritative list. In short:

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
