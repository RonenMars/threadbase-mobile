# There is no hosted Threadbase service

**Status as of 2026-09-12: no hosted service exists.** The app talks only to streamers the user installs on their own machines. Nothing routes through a Threadbase-operated server, because there isn't one.

A hosted service is considered likely eventually. When it ships it falsifies claims this repo makes as fact, so they are listed here in advance.

## What breaks in this repo

| Where | Claim |
|---|---|
| `docs/FEATURES.md` | "No hosted relay — session traffic goes directly to your own streamers; nothing routes through a Threadbase-run server." |
| `README.md`, privacy section | "Threadbase is a thin client for self-hosted streamers, with no product analytics, tracking, or behavioral telemetry." |
| `README.md`, privacy section | "Session content, prompts, provider metadata, and status events go only to the streamer URL you configure." |

The landing repo carries more of this than we do — see `docs/no-hosted-service.md` there for the site copy, the privacy-policy sub-processor list, and the marketing seed. The two must change in the same pass or the app and the site will disagree.

## Adjacent consequences

- **A new Sentry project starts unprotected.** The `threadbase` project has "Prevent Storing of IP Addresses" on. That setting is per-project and only affects events ingested after it is enabled, so a hosted backend reporting into a new project needs it turned on at creation.
- **Anonymous Diagnostics §17 becomes live.** The spec's web/IP clause — that Sentry must not use a visitor's IP as a substitute identity where there is no per-install ID — is currently theoretical because there is no web deployment. A hosted service likely produces one, and §17 then needs actual verification rather than a note.
- **The privacy model gains a party.** Today the only things that receive data are the user's own streamers, Expo, Apple, and Sentry. A hosted backend is a new recipient and belongs in the sub-processor list on the site before it serves a single request.

## The rule

Do not hedge these claims ahead of time. They are true now, and pre-emptive softening ("we don't currently…") costs more credibility than it saves. Change them when the thing exists, together, in one deliberate pass.
