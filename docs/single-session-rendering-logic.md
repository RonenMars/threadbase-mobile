# Rendering Logic — Single Session Display

Audit of how **one** session is drawn. Scope: the session-detail screen and the
session-specific components under `components/sessions/`. **Excludes** the list
views (`hub/`, `tree/`, `classic/`, `shared/`) and list chrome
(`LiveSessionsHeader`, which is a list eyebrow, not a session view).

Two surfaces show a single session:
- **`SessionCard.tsx`** — the session's compact row (rendered by the lists, but it
  is the single-session *summary* card).
- **`app/session/[id].tsx`** — the full-screen detail view (the orchestrator).

---

## 1. `app/session/[id].tsx` — the detail screen

A state machine of early returns. The first matching condition wins; only the last
("Normal") reaches the full layout.

### Top-level render states (in order)

| State | Guard | Renders |
|---|---|---|
| **Pending** | `isPending` = `id?.startsWith('pending_')` (`:409`) | `PendingSessionScreen` — spinner, rotating phrase, cancel |
| **Discovered / overtake** | `session.ptyAttached === false && (status === 'running' \|\| 'waiting_input')` (`:488`) | `DiscoveredSessionScreen` — warning + "Overtake" / "Back" |
| **Loading, no data** | `isLoading && !session` (`:523`) | empty header + centered spinner + optional `SessionDetailSlowBanner` |
| **Not found** | `!session` (non-`disc_`) (`:536`) | "Session not found" + id |
| **Not found but discovered** | `!session && id?.startsWith('disc_')` (`:537`) | `DiscoveredSessionScreen` |
| **Normal** | `session` exists (`:552`+) | header + status bar + body |

### `isLive` — the central predicate (`:603`)
```
isLive = ptyAttached === true
       && (status === 'waiting_input' || status === 'running')
       && !!conversationId
```
Gates whether the body shows the live chat vs. a placeholder.

### Body routing (`:625`)
```
isLive                                   → LiveConversationView | TerminalView  (+ WakingUpOverlay)
session.failureReason                    → red error placeholder
noAttachEmptyPlaceholder && idle         → "Running elsewhere" + MatrixRain (+ "View Conversation" if promptCount>0)
noAttachEmptyPlaceholder                 → "No terminal" placeholder
```
`noAttachEmptyPlaceholder = ptyAttached === false && !isLive` (`:608`).

### "Waking up" (`:496`)
```
isWakingUp = status === 'running' && !hasReachedPrompt && (promptCount ?? 0) === 0
```
- `hasReachedPrompt` latches `true` once `status === 'waiting_input'` (`:467`); resets on `id` change (`:464`).
- Drives: `disabled={isWakingUp}` on `LiveConversationView`/`TerminalView` (`:641`), and a `WakingUpOverlay` with a session-deterministic phrase `wakingUpPhrase(id)` (`:648`).

### Header (`:615`)
- `title = sessionName` (`getName() || projectName`, `:441`); `titleRight` = pencil → opens `NameSessionModal` (`:590`).
- `right = sessionHeaderActions`: favorite star (toggles pin) + info icon (`:556`/`:576`).
- `SessionStatusBadge status={session.status} isRefetching={false}` (`:618`) — refetch flag is hardcoded `false` here.

### `LiveConversationView` props (`:637`)
| Prop | Source |
|---|---|
| `serverId` / `sessionId` | route params (`:406`/`:401`) |
| `conversationId` | `session.conversationId!` (`:640`) |
| `disabled` | `isWakingUp` (`:641`) |
| `pendingPlan` | `planVisible ? pendingPlan : null` (`:642`) |
| `onClosePlan` | clears `planVisible` + `pendingPlan` (`:643`) |
| `keyboardVerticalOffset` | `aboveBodyHeight` (measured header layout, `:614`) |

### Plans (`:472`)
WS `plan_ready` for this `id` → `setPendingPlan(msg.plan)` + `setPlanVisible(true)`. Surfaced **only** by passing `pendingPlan` into the conversation child (the `PlanPreviewSheet` lives in `LiveConversationView`, not here).

### WS / lifecycle subscriptions that flip rendered state
- `session_ready` (`:211`) and `session_update` w/ `ptyAttached` (`:217`) → navigate pending → real detail.
- `AppState` resume (`:419`) → reconnect WS + invalidate `['session', serverId, id]`.

### Modals / banners
- `NameSessionModal` (`:688`): `visible = renameSheetVisible`, `mode="exit"` (hardcoded), `onSave` → `renameSession.mutate`.
- `SessionDetailSlowBanner` (`:530`): only in the loading state, gated by `isDetailSlow` (`slowCounts['session-detail'] > 0`); `onAbort` → `router.back()`.

> No Resume/Export action bar lives in this screen — those are delegated to `LiveConversationView`.

---

## 2. `SessionCard.tsx` — single-session summary row

Renders one `MultiSession` as a 3-line card with a left **spine**. `React`-free of
memo (relies on `_animatedIds` set, below).

### Layout
- **Spine** (`:127`): 3px left column, color by state —
  `isLive ? amber(status.waiting) : multipleServers ? serverColor : accent`,
  dimmed to `opacity 0.55` when not live. `isLive = running || waiting_input` (`:54`).
- **Line 1** (`:131`): folder icon + `displayName` (`customName ?? projectName`, `:49`) +
  trailing meta chips — `branch` Badge, `MachineBadge`, `ServerChip` (only when
  `multipleServers`), and a `formatListTime` timestamp.
- **Line 2** (`:150`): `SessionStatusBadge` • `elapsedLabel` • `promptsLabel`, mono with
  bullet separators.
- **Line 3** (`:160`): `session.lastOutput`, mono single line — **dropped entirely** if absent.

### Behavior
- **Enter animation**: `FadeInDown` only on first sighting — `_animatedIds` Set
  (`:24`) tracks `serverId::id` so polling remounts don't re-animate (`:51`/`:115`).
- **Press** → `router.push('/session/{id}?server={serverId}')` (`:67`).
- **Long-press** → action sheet (iOS `ActionSheetIOS`, Android `Alert`): Copy ID /
  Send input / Cancel(destructive) (`:70`). Cancel routes through a confirm dialog → `cancelSession.mutate()`.
- `displayName` reacts to `useSessionNamesStore` (custom rename) and `serverColor` to `useServersStore`.

---

## 3. Session-specific leaf components

### `SessionStatusBadge.tsx`
Maps `SessionStatus` → label + color, then a dot/spinner + text.
- Labels: `running→"Running"`, `waiting_input→"Active"`, `idle→"Idle"` (`:7`).
- Colors: running/waiting_input → `status.running`; idle → `status.idle` (`:21`).
- `isLive = running || waiting_input` (`:27`).
- **`isRefetching`** swaps the `LiveDot` for an `ActivityIndicator` (scaled 0.6) — lets a row show "refreshing" without changing the label. (Detail screen passes `false`; lists may pass a live value.)

### `LiveDot.tsx` — shared pulse primitive
- `live` → reanimated opacity loop `0.4 → 1 → 0.4` over 1.6s, `Easing.out(quad)` (`:30`). The cadence matches `DESIGN.md`'s "live/running" signal.
- `!live` → cancels the animation, opacity pinned to 1.
- Cleans up on unmount (`cancelAnimation`). Pure presentational primitive; also used by the tree leaf + hub row.

### `MachineBadge.tsx`
Thin wrapper over the shared `Badge` — accent-tinted chip showing `machineName`. No logic.

### `NameSessionModal.tsx`
Transparent fade `Modal`. `create` vs `exit` mode only changes copy
(title/save-label, `:36`) and whether a `Current: "<name>"` hint shows (`:55`). Clears
the field on each open via `queueMicrotask` (`:28`). `handleSave` no-ops on empty/
whitespace (`:41`). (The detail screen always mounts it in `"exit"` mode.)

### `SessionDetailSlowBanner.tsx`
Static wrapper over the shared `Banner` (warning accent, spinner icon, destructive
Cancel → `onAbort`). Copy is hardcoded. No internal state.

---

## State → render quick reference

| Session state | `SessionCard` | Detail screen body |
|---|---|---|
| `running` (pre-prompt) | amber spine, "Running" | `isWakingUp` overlay + disabled composer |
| `running` / `waiting_input` (attached) | amber spine, "Running"/"Active" | `LiveConversationView` |
| `idle` (attached) | dimmed accent spine, "Idle" | `LiveConversationView` if `conversationId` else placeholder |
| `idle` (detached, `ptyAttached:false`) | — | "Running elsewhere" + MatrixRain |
| failed (`failureReason`) | — | red error placeholder |
| pending (`pending_*` id) | — | `PendingSessionScreen` |
| discovered, unattached + active | — | `DiscoveredSessionScreen` (overtake) |

---

## Observations (not acted on)

- `SessionStatusBadge` has **no `waiting`/amber** color — `waiting_input` reuses
  `status.running` (green) and the label "Active", while `SessionCard`'s spine uses
  amber (`status.waiting`) for the same state. Two different visual encodings of
  `waiting_input` across the two surfaces.
- The detail screen hardcodes `SessionStatusBadge isRefetching={false}` (`:618`), so
  the spinner-swap affordance is dead on this surface (only lists exercise it).
- `LiveSessionsHeader` lives in this folder but is list chrome (an eyebrow above a
  group), so it's intentionally out of scope here.
