# Prompt — record the per-server "Require encryption" requirement on the E2EE issue

Issue: **https://github.com/RonenMars/threadbase-mobile/issues/698** (client half) · Server half: **https://github.com/RonenMars/threadbase-streamer/issues/590**

Hand this to a fresh agent session opened in `~/dev/ai-tools/tb-mobile`.

This is a **documentation task with no code changes.** It exists because the requirement below was approved in conversation and currently lives only in a session transcript. If nobody writes it down, Phase 5 gets built without it.

---

## Why this is urgent despite being small

The E2EE rollout in [`plan.md` Phase 5](https://github.com/RonenMars/threadbase-streamer/blob/main/specs/end-to-end-encryption/plan.md) is *negotiated*: the client encrypts when both sides advertise support and falls back to plaintext otherwise, because tb-mobile is released and cannot be force-updated.

That has a hole. An attacker in the middle — the Cloudflare-shaped position the whole feature exists to neutralise — strips the capability from `GET /api/info`, and the client cheerfully downgrades to plaintext. **Encryption you can talk a client out of is not encryption.**

`mobile-design.md` §6 already hard-fails for a server that is *pinned*. The gap is the server that has **not yet** been pinned: nothing today makes a first connection demand encryption, and most users will never open a settings screen to ask for it.

## The requirement to record

A per-server **"Require encryption"** boolean.

- Stored on the server record in `stores/servers.ts`, alongside where the device token already lives — **SecureStore, never AsyncStorage.** AsyncStorage is exactly where an attacker with device file access would go to clear it, and this bit *is* the anti-downgrade control.
- Surfaced as a row in `components/servers/ServerEditModal.tsx`.
- Phrased as a **demand, not a description**: "Require encryption for this server", never "is this server E2EE". A description invites a wrong answer that silently does nothing; a demand states the consequence.
- **Auto-set on first success.** The moment the app completes one encrypted connection to a server, the flag turns itself on and stays on. A flag that only exists if someone ticks it protects almost nobody.
- The checkbox still matters for the case auto-setting cannot cover: a user who knows their streamer does E2EE can tick it **before** the first connection. That is what beats trust-on-first-use.
- Turning it off after it has been on requires a confirmation with a plain-language warning — a deliberate revert to plaintext is legitimate when the operator ran `--no-e2ee`, but never a stray tap.

State table:

| Flag | Server offers E2EE | Behaviour |
|---|---|---|
| ON | yes | encrypted |
| ON | no | **REFUSE**, and tell the user why |
| OFF | yes | encrypt, then set the flag on |
| OFF | no | plaintext |

**Record the limit honestly alongside the requirement**, or it will be oversold: this defends against a *downgrade*, not against a *hostile server*. If someone repoints the app at a different machine, "require encryption" is satisfied by **their** encryption. The QR carrying the server's static public key (Phase 2) is what closes that. The two together are what make it real.

## What to do

Add this to issue #698 as a comment or an edit to the body — whichever keeps it readable — under a clear "Phase 5 — require-encryption flag" heading.

> **Check the repo rule first.** `CLAUDE.md` forbids commenting on GitHub issues and PRs in some workflows. If commenting is not available to you, **edit the issue body** instead, or write the requirement into a tracked file under `docs/` and say in your report that the issue itself still needs updating. Do not skip the task silently, and do not work around a restriction you were told about — surface it.

Cross-reference the streamer issue (#590) so the server half is discoverable from the client half.

## Scope

You own: issue #698's text, and — if you cannot edit the issue — one file under `docs/`.

Do **not** write code. No `stores/servers.ts`, no `ServerEditModal.tsx`, no new store fields. Phase 5 is several phases away; this task records the decision so it survives, nothing more.

Do not restate the whole E2EE design. The design lives in `tb-streamer/specs/end-to-end-encryption/` and this requirement is an addition to Phase 5, not a replacement for it.

## Deliverable

Report the issue URL, exactly where the requirement now lives, and — if you hit the commenting restriction — say so plainly rather than reporting success.
