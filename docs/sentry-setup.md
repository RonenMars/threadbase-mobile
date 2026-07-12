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

## 1. Create the Sentry project (one-time, manual)

1. Sign up / log in at <https://sentry.io> and create a **React Native**
   project. Note the **organization slug**, **project name**, and **DSN**.
2. Update `app.json` → `plugins` → `@sentry/react-native/expo` with the real
   `organization` and `project` slugs (currently `threadbase` /
   `threadbase-mobile` — adjust if yours differ).
3. Create an **Organization Auth Token** at
   <https://sentry.io/settings/auth-tokens/> (auto-scoped for source-map upload
   and release creation). This is a **secret** — see step 3.

## 2. Configure the DSN (runtime)

The DSN is a **public** value (safe to embed in the client bundle by design; it
is not a secret). Set it as a public Expo env var:

```sh
# .env (never committed)
EXPO_PUBLIC_SENTRY_DSN=https://<publicKey>@o<org>.ingest.sentry.io/<projectId>
```

With no DSN set, crash reporting is unavailable regardless of the consent
toggle — `services/sentry.ts` returns early.

### Local QA of the pipeline (optional)

Reporting is disabled in development builds by default. To exercise it locally:

```sh
EXPO_PUBLIC_SENTRY_ALLOW_DEV=1
```

Never set this in a committed env file. In production builds it is irrelevant.

## 3. Source maps — EAS Build & EAS Update (secret token)

The **auth token is a secret** and must live only in the EAS build environment,
never in a committed file and never in the bundle.

- **EAS Build:** add `SENTRY_AUTH_TOKEN` as an EAS environment variable with
  **sensitive** visibility. Source maps upload automatically during the build.
  ```sh
  eas env:create --name SENTRY_AUTH_TOKEN --value <token> --visibility sensitive
  ```
- **EAS Update:** after `eas update`, upload source maps:
  ```sh
  eas update --branch <branch> && npx sentry-expo-upload-sourcemaps dist
  ```

The Metro config (`metro.config.js`) already wraps the Expo config with
`getSentryExpoConfig` so a debug id is emitted for symbolication.

## 4. Verify

1. Build a release/internal build with the DSN set.
2. In **Settings → Crash Reporting**, enable "Share anonymous crash reports".
3. In a development/internal build, tap **Test crash reporting** (visible only
   when `__DEV__`) — this raises a sanitized test error via the explicit capture
   helper.
4. Confirm the event appears in Sentry and that its stack frames are
   symbolicated and contain **no** absolute paths, URLs, or secrets.

## 5. Turning it off

Disabling the toggle calls `Sentry.close()` immediately (no further events are
sent) and deletes the anonymous install id. The app never re-prompts a user who
has declined.

## Manual dashboard checklist

- [ ] Sentry project created; org/project slugs match `app.json`.
- [ ] In Sentry project settings, **Session Replay is disabled** (we also pin
      sample rates to 0, but disable it at the project level too).
- [ ] Data-scrubbing / server-side PII filtering left **enabled** as an extra
      layer (defense in depth; our client-side sanitizer is primary).
- [ ] `SENTRY_AUTH_TOKEN` stored in EAS with **sensitive** visibility.
- [ ] `EXPO_PUBLIC_SENTRY_DSN` set in the build environment (or omitted to keep
      reporting unavailable).
- [ ] Retention configured per the privacy policy (see
      `docs/proposed-privacy-policy.md`).
