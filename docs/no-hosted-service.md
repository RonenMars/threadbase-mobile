# Hosted services and the app's claims

**Status as of 2026-10-31: one optional hosted service exists, the Threadbase relay.** Otherwise the app talks only to streamers the user installs on their own machines.

The landing repo's `docs/no-hosted-service.md` is the checklist for this topic, and the two files must change in the same pass or the app and the site will disagree.

## What is true today

| Part | Relay state |
|---|---|
| Streamer, stable releases | The `relay` feature flag defaults to off and is described as "in development". |
| Streamer, `next` channel | On by default since [streamer #1067](https://github.com/RonenMars/threadbase-streamer/pull/1067), which has not reached the streamer's `main`. |
| App, reaching a paired server | [#1265](https://github.com/RonenMars/threadbase-mobile/pull/1265) shipped it: a pinned server that reports a route in sealed `GET /api/info` gets the relay as its last address, after the user's own addresses. The per-server switch in the server's address section is on by default. |
| App, pairing | Not shipped. [#1269](https://github.com/RonenMars/threadbase-mobile/pull/1269) is open and held until the default below is decided. |

So a server with the flag off never touches the relay, and a server with it on uses the relay when its own addresses cannot be reached, unless the user turns the switch off.
Traffic through the relay stays end-to-end encrypted, and the relay cannot read it. It can see connection metadata, and the landing doc lists which.

## What breaks in this repo

These claims must change, together with the site's, before #1067 reaches the streamer's `main`:

| Where | Claim |
|---|---|
| `docs/FEATURES.md` | "Self-hosted daemon", and the `[operator-enabled]` tag on "Threadbase relay". |
| `README.md`, privacy section | "Session content, prompts, provider metadata, and status events go only to the streamer you configure", and the relay clause after it. |
| `CLAUDE.md` and `AGENTS.md`, "Product claims" | "stays off in stable streamer releases". |
| `docs/privacy-and-verifiable-builds.md` | "no Threadbase-run server in the path unless that streamer has the optional relay on". |

## Adjacent consequences

- **A new Sentry project starts unprotected.** The `threadbase` project has "Prevent Storing of IP Addresses" on. That setting is per-project and only affects events ingested after it is enabled, so a hosted backend reporting into a new project needs it turned on at creation.
- **Anonymous Diagnostics §17 applies to any web deployment.** The spec's web/IP clause says Sentry must not use a visitor's IP as a substitute identity where there is no per-install ID, and it needs actual verification once a web deployment exists.
- **The privacy model has a new party.** The relay is hosted on Fly.io, which is on the site's sub-processor list. Any further hosted backend belongs on that list before it serves a single request.

## The rule

State what is true for both kinds of user, the one whose server has the relay off and the one whose server has it on. Change these claims when the facts change, together, in one deliberate pass.
