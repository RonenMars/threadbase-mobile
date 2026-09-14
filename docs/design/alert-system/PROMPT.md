# Implement: severity-routed alert system (Threadbase mobile)

You are working in `RonenMars/threadbase-mobile` (Expo / React Native / TypeScript, zustand, i18next, phosphor icons, @gorhom/bottom-sheet).

## Read the design first

The design lives in the Claude-Design workspace as **`Alert System Redesign.dc.html`** (project "Threadbase session list redesign"). Use the Claude-Design MCP to read it before writing any code, and keep it open as the spec:

- The **THE DIAGNOSIS** card — which existing surfaces are duplicates and why.
- The **SHARED FOUNDATION** card — the four-level severity table and the four routing rules. This is the contract; do not invent a fifth surface.
- The **ACCESSIBILITY** card — the a11y spec applies to every surface.
- Option **1c** (inline-first) and option **1b** (header pill + Status Center) — we are shipping the hybrid recommended at the bottom of 1c's card. Option **1a** is not being built; read it only for the untruncated-banner copy treatment, which the "everything is stale" case reuses.
- The **EVERY SURFACE IN THE SCREENSHOTS, ROUTED** grid — treat it as the acceptance checklist.

If any instruction below conflicts with the design doc, the design doc wins; say so rather than silently diverging.

## What we're building

One arbiter, four severities, one surface each.

| Level | Surface |
|---|---|
| `critical` | Modal dialog. Blocks. Never auto-dismisses. The only modal in the app. |
| `error` | Inline in the scope that failed (1c), **or** the header status pill + Status sheet when the failing scope isn't on screen (1b). No timeout, always has a recovery action. |
| `warning` | Header status pill only. Costs no layout space. |
| `info` | Toast, 5s auto-dismiss. The only auto-dismissing surface. |

Routing rules (from the doc, verbatim intent):
1. **One cause, one surface.** Every alert carries a `cause` key (`server:<id>`, `query:messages`, …). The host keeps the highest severity per cause and drops the rest.
2. **At most one global surface at a time.** Critical suppresses Error suppresses Warning suppresses Info. Never a modal over a sheet over a banner.
3. **Auto-dismiss is Info only** (WCAG 2.2.1).
4. **Never ship a truncated error.** Full first sentence + one action visible; code / raw error one tap deeper.

## Work plan

Do these as separate commits, each green on `yarn lint && yarn tsc --noEmit && yarn test` before moving on.

**1 — `AlertHost` arbiter.**
Extend `types/alerts.ts` with `cause: string` on `AlertSpec`. Add a selector layer over `stores/toasts.ts` (rename to `stores/alerts.ts` if the blast radius is acceptable; otherwise keep the file and add the selectors) that: groups entries by `cause`, keeps the max severity per cause, and exposes `{ critical, errors, warnings, infos }`. Move the `announceForAccessibility` logic out of `ErrorRecoverySheet` into the host so every surface inherits it — announce once per `cause`+level fingerprint, never per render. `critical`/`error` → assertive; `warning`/`info` → `accessibilityLiveRegion="polite"`.

**2 — Header status pill (1b).**
Replaces `IssuesIndicator` (delete it) and the header bell + red dot (delete them). Colour and label reflect the worst active severity: hidden when clear, amber "Degraded", red "N issues". 44pt target. On a *new* error it expands to a one-line strip for 6s, then collapses — that is the mitigation for the passivity cost named in 1b's card.

**3 — Status sheet (1b).**
One sheet, fed by the host's selectors, rows ordered by severity. Server rows and failed-request rows are the same row component: title, one-sentence consequence, per-row Retry, and a "Technical details" disclosure carrying `code` + `rawMessage` with the existing copy buttons. `ErrorRecoverySheet`, `ServersStatusModal`, `ServerErrorModal` and `AlertDetailsModal` converge here. Rows where `classifyError(...).retryable === false` (e.g. HTTP 404) render **no** Retry.

**4 — Inline-first failures (1c).**
In the session list, a failing server becomes a section header in its own state with its own Retry; its sessions stay visible marked stale rather than being swapped for an empty screen. A conversation that fails to load reports in the message area. Full-screen state only when *every* server is down. No global chrome for anything visible on screen.

**5 — Critical dialogs.**
Wire `error-policy`'s `presentation: 'blocking'` (currently dead) to a single dialog component. "Leave this session?" and "Resume this conversation?" both adopt it — one visual language, not a custom radio dialog in one place and an iOS action sheet in the other. `accessibilityViewIsModal` on iOS, `importantForAccessibility="no-hide-descendants"` behind, focus returned to the trigger on close. Radio options get `accessibilityRole="radio"` + `accessibilityState={{ checked }}`. Destructive option red; never two emphasised options.

**6 — Demotions and deletions.**
Host-under-load becomes `warning` (pill only — today it renders the same paragraph twice simultaneously). "Server Status" is settings content, reachable from Details and Settings, never self-raising. "Reconnecting…" and empty states stay `info`/inline and never compete with an error for the same strip.

## Copy

Rewrite the alert strings in `locales/en/*.json` as you go: say what happened and what it means, and label buttons with the outcome. "Some requests failed" → "Messages didn't load from Ronens-MacBook-Pro." Every error states its consequence ("Your sessions below are from 6 minutes ago"). Keep every string in i18n; no literals in components.

## Constraints

- Alert surfaces are **opaque**, not glass — red `#f85149` on the glass banner fails 4.5:1. Severity is never colour-alone: icon + text label in the accessibility name ("Error. Can't reach Ronens-MacBook-Pro.").
- Reduce Motion → banner slide and sheet spring become a cross-fade. Reduce Transparency → opaque fill, no layout change.
- Every action row is 44pt. Swipe-to-dismiss is always mirrored by a visible control.
- Follow `CLAUDE.md` (no emoji in UI; a missing optional field renders without it rather than throwing).
- Tests: extend the existing `__tests__/unit/components/**` suites rather than replacing them; add cases for the arbiter (two causes at different severities, same cause raised twice, critical suppressing an error) and an a11y test that the announcement fires once per cause.

## Before you start

Reply with: the file-by-file diff plan for step 1, anything in the design doc you think is wrong for this codebase, and any question whose answer would change the shape of the arbiter. Then wait for approval before writing code.
