# Anonymous Diagnostics (Sentry) — Setup & Privacy

Threadbase Mobile has **optional, opt-in Anonymous Diagnostics** built on
[`@sentry/react-native`](https://docs.sentry.io/platforms/react-native/), off
**by default**. See `docs/specs/anonymous-diagnostics-consent-v0.1.md` for the
full spec — this doc covers local configuration and the manual Sentry/EAS
dashboard steps only. **Never commit a real DSN or auth token.**

The Sentry SDK becomes ready (`Sentry.init` runs) at app startup whenever a
DSN is configured and the build environment permits it — that alone
authorizes nothing. Passive/automatic transmission (crash/error events,
breadcrumbs, session tracking) is gated separately on the **Anonymous
diagnostics** setting (Settings → Anonymous diagnostics), off by default.
Explicit user actions — tapping "Report this crash" or submitting feedback —
work independent of that setting and send only that one report (see
`services/sentry.ts` module doc and
`docs/audits/anonymous-diagnostics-transmission-proof.md`).

## What is (and isn't) sent

Everything that leaves the device passes through the centralized sanitizer
(`services/sanitize.ts`) via `beforeSend` / `beforeBreadcrumb`. See
`docs/privacy-policy/proposed-privacy-policy.md` for the authoritative list. In short:

- **Sent (once Anonymous Diagnostics is on, or for an explicit one-shot
  report/feedback submission):** app version, build number, platform, OS
  major/minor, JS engine, environment/channel, Expo runtime version, EAS update
  id, an anonymous per-install UUID (for issue grouping only), a derived generic
  connection-mode enum (`local`/`remote`/`unknown`), scrubbed exception
  type/message/stack frames, and (once diagnostics is on) anonymous
  session/release-health pings (start/end timestamp + ok/errored/crashed
  status only).
- **Never sent:** prompts, terminal output, source code, file contents,
  credentials, tokens, headers, server URLs, hostnames, IPs, repository
  names/paths, absolute/home paths, session names/titles, WebSocket payloads,
  request/response bodies, clipboard contents, or device names.

Session Replay, screenshots, view-hierarchy attachment, console capture,
network breadcrumbs, and default PII are all **disabled** in
`services/sentry.ts`.

## Configuration (fork-friendly — no org/project hardcoded)

`app.json` registers the Sentry Expo plugin with no `organization`/`project`
props, so this repo carries no Sentry account details. `app.config.js` forwards
`SENTRY_ORG` / `SENTRY_PROJECT` into those plugin props when they are set
(local `.env`, ship shell, or EAS). Without them the plugin warns and
`sentry-cli` falls back to the same env vars at upload time.

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | `.env` | Runtime DSN the app sends events to. Public by design (not a secret). |
| `EXPO_PUBLIC_SENTRY_ALLOW_DEV` | `.env` | Optional local QA override. Set to `1` only when you want a development build to transmit Sentry events. |
| `EXPO_PUBLIC_SENTRY_DEBUG` | `.env` | Optional SDK troubleshooting flag. Set to `1` only when you need verbose Sentry SDK logs in Metro. |
| `SENTRY_ORG` | `.env` / shell env / EAS env | Org slug. Silences the Expo plugin warning and is used at build time to upload source maps. |
| `SENTRY_PROJECT` | `.env` / shell env / EAS env | Project slug. Same as `SENTRY_ORG`. |
| `SENTRY_AUTH_TOKEN` | shell env / EAS env (**sensitive**) | Secret. Authenticates the source-map upload. Never committed. |

Without `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`, Anonymous Diagnostics
still works end-to-end (events transmit with `EXPO_PUBLIC_SENTRY_DSN` + consent
on, or via an explicit one-shot report/feedback submission) — stack traces
just show up unsymbolicated in the Sentry dashboard.
