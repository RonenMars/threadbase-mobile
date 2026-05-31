# Conversation List Redesign — Design Plan

**Status:** Draft v2 for review
**Date:** 2026-05-15
**Author:** Claude (with @ronen.mars)
**Scope:** Hub directory drill, Hub root, Classic, Tree, Tree drill, Quick access strip, Search results, Settings, Landing-page alignment notes

---

## Sources consulted

- **`/impeccable` shared design laws** — color strategy, no side-stripe accents (>1px), no decorative gradients, no glassmorphism by default, no emoji as UI, sentence-case copy, em-dashes-as-comma forbidden in commits but allowed in body.
- **`design/DESIGN.md`** — Threadbase brand DNA: midnight canvas (`#070b11`), cyan-blue thread (`#63b3ff`), amber live (`#f08a24`), Inter + JetBrains Mono, 4px spacing base, 8/12px radii, status pulse motion.
- **`design/colors_and_type.css`** — full token set including the ink scale (`--tb-ink-0..7`), fg scale (`--tb-fg-0..4`), brand glow tokens (`--shadow-glow-blue`, `--shadow-glow-amber`), divider rule (`rgba(99,179,255,0.08)`), grid pattern (`--grid-bg`), and the existing semantic classes (`.tb-h3`, `.tb-body`, `.tb-meta`, `.tb-eyebrow`, `.tb-code`).
- **`design/preview/components-conversation-row.html`** — the brand's existing conversation row spec: 28×28 project avatar (mono initials), Inter 13/1.3 semibold title, JetBrains Mono 11/1.3 meta line, amber pulsing LIVE pill, right-aligned time in mono.
- **`design/ui_kits/mobile/HistoryScreen.jsx`** — high-fidelity working reference: same row, plus a 40px-tall search bar and "All / Today / 7d / 30d" pill filters on top.
- **`design/onboarding/`** — Variation A/B canvas, kickoff context.
- **`design/SKILL.md`** — Threadbase brand skill manifest.
- **`docs/superpowers/specs/`** — read in full where relevant:
  - `2026-04-30-projects-hub-redesign.md` — defines the Projects hub and the search-results behavior (results replace hub cards, grouped Conversations + Sessions).
  - `2026-05-02-quick-access-strip-design.md` — defines the strip (Favorites, Recents, Popular).
  - `2026-05-01-cardshell-unified-card-template.md` — `CardShell` is already the unification primitive for cards; we reuse it, don't duplicate.
  - `2026-05-02-theming-system-design.md`, `2026-05-02-i18n-design.md`, `2026-05-02-session-naming-design.md`, `2026-05-01-nativewind-migration-design.md` — checked for token / naming / i18n contracts.
- **Stitch references in the user's library:**
  - **PocketDev — iOS Code Editor** (`projects/5744215642564693719`) — mobile dark, architectural minimalism, no-line rule, indentation-driven hierarchy, monospace for paths.
  - **Threadbase Landing Page** (`projects/18263145864044698201`) — brand-aligned visual language.
- **Current implementation:**
  - `components/quick-access/QuickAccessStrip.tsx`, `QuickAccessChip.tsx`, `QuickAccessActionSheet.tsx`
  - `components/sessions/hub/{ProjectHubCard, ConvRow, SessionRow}.tsx`
  - `components/sessions/tree/{TreeRow, DrillRow, DrillView, ServerHeaderRow, ServerRootRow}.tsx`
  - `components/sessions/classic/ClassicSessionsList.tsx`
  - `components/sessions/{SessionCard, LiveDot, MachineBadge, SessionStatusBadge}.tsx`
  - `components/ui/{Card, CardShell, Badge, EmptyState}.tsx`
  - `constants/theme.ts`, `types/api.ts`

---

## Diagnosis

Screenshots reveal a single root problem: **information density inversion**. The chrome (folder icon, full path, timestamp) is ~80% of each row; the content (what this conversation is *about*) is 0%.

Concretely:

1. **Hub drill (img 1)** — 16 rows all reading `apps/ios/Tabby`. The label is the same as the parent context. No preview. No message count. No `MachineBadge`. No way to differentiate one row from another except `23h ago` repeated.
2. **Hub root (img 2)** — long absolute paths middle-truncated (`/Users/<name>/dev/ai-tools/...`). The disambiguating segment is the part that gets hidden. The `FolderSimple` icon and a count badge are the only visual data.
3. **Tree (img 3)** — actually closest to the brand spec, but the green `<Svg fill="#2e7d4f">` chat icon at `TreeRow.tsx:75` is off-palette; depth indentation has no visible gutter.
4. **Tree drill (img 4)** — same problem as hub drill, without even the folder icon.

The brand already has a row design (`design/preview/components-conversation-row.html`) and a working reference (`design/ui_kits/mobile/HistoryScreen.jsx`). The job is to bring the app rows into alignment with that spec and apply it consistently across all four views — not invent new chrome.

---

## Conceptual frame: Hub vs Recents vs Classic

Per user feedback point (1):

- **Hub directory drill** (img 1) and **Hub root** (img 2) — these list **conversations and sessions, full-history, grouped/scoped by project**. Hub-drill is practically *the full Recents tab but unbounded in time and filterable*. The Quick Access strip's `Recents` tab is a 5-6 item slice of the same data, surfaced for one-tap access at the top of the screen.
- **Classic** — same data, no grouping, sorted by recency. Sessions clustered on top via `LiveSessionsHeader`.
- **Tree** — same data, indented by directory hierarchy.

**Why hub-drill is still distinct from Recents-tab:** different *purposes*. Recents is "the 5-6 things I touched today, surface them now." Hub-drill is "show me everything that ever happened in `apps/ios/Tabby`." The strip's Recents tab can disappear (if user is on Favorites or Popular, or has Recents disabled in Settings) — the hub view must still answer "what's in this project, ever."

**Implication:** the strip's Recents tab and the hub-drill list must look like they belong to the same family but show different *density*:

- Strip Recents: chip form, 1 line, project label only.
- Hub drill: row form, 2-3 lines, title + preview + meta + server.

Both consume the same `ConversationListItem` primitive, switched via the `density` prop.

---

## Design system layer — `tb-list`

Three reusable primitives. Single source of truth.

### 1. `ConversationListItem` — the atomic row

One component, rendered in hub-drill, tree-drill, classic, search results, and (compact) inside the tree leaves.

**Anatomy (from `design/preview/components-conversation-row.html`, brand-aligned):**

```
┌─ status dot (5–8px, amber pulse | blue idle | grey complete)
│  ┌─ leading slot
│  │   • mode='avatar' — 28×28 mono-initials tile (HistoryScreen.jsx convention)
│  │   • mode='dot'    — just the status dot
│  │   • mode='depth'  — indented hairline gutters
│  │  ┌────────────────────────────────────────────────────┬─ trailing meta
│  │  │ TITLE (Inter 13/1.3 semibold, --tb-fg-0)           │ ⏵ Live pill
│  │  │ project · branch · N msgs (JetBrains Mono 11)      │ ts (mono 10)
│  │  │ User: "first prompt preview ..." (Inter 12, --fg-3)│ [server chip]
│  │  └────────────────────────────────────────────────────┘
```

**Props:**

| Prop | Values | Effect |
|---|---|---|
| `density` | `comfortable` \| `compact` \| `chip` | row height 64 / 48 / 28 |
| `preview` | `'first'` \| `'last'` \| `'auto'` \| `'none'` | which message snippet to show |
| `showCount` | bool | message count chip on the right |
| `showBranch` | bool | git branch in mono |
| `leading` | `'avatar'` \| `'dot'` \| `'depth'` \| `'none'` | hub / list / nested / chip |
| `pathDisplay` | `'smart'` (default) \| `'full'` \| `'suffix'` \| `'last-segment'` | how to render long paths |
| `showServer` | `'auto'` (default) \| `'always'` \| `'never'` | multi-server indicator behavior |
| `highlight` | string \| undefined | substring to highlight for search results |
| `pinned` | bool | renders a small `Star` weight=fill in the leading slot corner |
| `onPress` / `onLongPress` | fn | tap (open) / long-press (action sheet, includes "Preview messages") |

**Tokens (mapped from `colors_and_type.css` → `constants/theme.ts`):**

| Element | Spec value | Current `theme.ts` mapping |
|---|---|---|
| Row bg (rest) | `--tb-ink-2` `#0b1220` | `dark.bg.card` (`#21262d` today — drifted from brand) |
| Row bg (press) | `--tb-ink-3` `#0f1a2c` | n/a — add `dark.bg.cardPress` |
| Title | `--tb-fg-0` `#f4f7fb` | `dark.text.primary` (`#e6edf3` — close enough) |
| Mono meta | `--tb-fg-3` `#6c809b` | `dark.text.secondary` (`#7d8590` — drifted slightly) |
| Divider | `rgba(99,179,255,0.08)` | new — add `dark.divider` |
| Live amber | `#f08a24` | `dark.status.waiting` (`#d29922` — drifted, GitHub yellow) |
| Idle blue | `#63b3ff` | `dark.text.accent` (`#58a6ff` — GitHub blue, drifted) |

**Brand-alignment note:** the live theme has drifted from brand by ~5-10% on every key color. User confirmed earlier we leave the palette alone *for this PR*. That decision still holds — this redesign uses the current `dark.*` tokens. Brand alignment becomes a separate, focused PR. Listing the drift here so it's tracked.

### 2. `pathDisplay` — the path handler (`smart` is the default)

Per user feedback point (5): `smart` is the default.

In most rows the path IS the identity (no conversation title exists). Rules:

- **`smart`** (default) — algorithm:
  1. Compute the shortest **unique trailing suffix** among visible rows.
  2. Render that suffix in primary color (`--tb-fg-0`, Inter 13 semibold).
  3. Render the diverging parent segments above it, muted (`--tb-fg-3`, mono 11). Never middle-truncated — tail-truncate from the *left* so the rightmost differentiating segment is always visible.
  4. Inside a drill view, the parent is in the back-header → show only the suffix.
- **`full`** — entire path, mono, single line tail-truncated.
- **`suffix`** — fixed 2-segment tail, mono.
- **`last-segment`** — Inter semibold, the leaf only. Power-user setting.

All path text renders in **JetBrains Mono** so paths read as data, not prose. This is consistent with the brand's mono-for-technical-text rule.

### 3. `MessagePreview` — the content snippet

Sub-line under the title (or under the path when there's no title). Single line, Inter 12 in `--tb-fg-3`.

- `'first'` — `User · "fix the metro path resolution issue"` — role prefix in mono 11 in `--tb-blue-400`, content in Inter 12 italics.
- `'last'` — `Claude · "I've updated metro.config.js..."` (truncated).
- `'auto'` — `'first'` when `messageCount ≤ 3`, else `'last'`.
- `'none'` — omit the line entirely.

Data already on the wire: `MultiConversation.firstMessage`, `lastMessage`, `preview` (`types/api.ts:38-42`). Fallback chain when missing: `lastOutput` → `branch · N msgs · status` → `(no preview)` muted.

### 4. Server identity — paired left accent strip + server chip

**Purpose:** when 3-4 servers are active, every row tells you at a glance which server it belongs to. **Color is never alone** — paired with the visible server label (and optionally a symbol). This follows the [Scottish Government Status Tag](https://designsystem.gov.scot/components/status-tag) accessibility rule: *"Do not use colour alone to convey a status. You must also use a text label."*

**Why color alone fails here:** with 3–4 servers, even users who know the palette can mis-read at a glance, and screen-reader / color-blind users can't read it at all. The dual encoding (strip color + chip label) is the same pattern as the [Trips screen reference](image 5) where green/red is paired with "Starting at 10:00 AM" / "Ending at 12:30 PM" text — never the color alone.

**Visibility rules (simplified per user clarification):**

- `disabled` servers (toggled off in Settings) → row never appears in any list. Their data is excluded upstream.
- `filtered-out` servers (hidden via `ServerFilterSheet`) → row never appears. Filter is applied upstream.
- `disconnected` servers → no data fetched, so no rows to render anyway.
- → **There is exactly one valid state for the chip: "this row belongs to server X."** No degraded states.

So the indicator's only job is **identity disambiguation among multiple active servers**.

#### Two paired indicators per row

**(a) Left accent strip** — 3px-wide vertical bar pinned to the row's leading edge, full row height, in the server's assigned color.

- Matches `design/preview/components-conversation-row.html` line 14 (`box-shadow: inset 2px 0 0 var(--tb-blue-400)` on `.row.active`) but extended to 3px and used as a server-identity stripe rather than an active-state indicator.
- Inspired by [App Categories reference](image 9) — each category row carries a color stripe + icon. We adapt: server identity stripe + server label chip.
- Never the only signal. Always paired with the chip below.

**(b) Server chip** — renders inside the row's meta column, right side.

Three variants the user can pick globally in Settings → Servers → Indicator style:

| Variant | What it shows | When to use |
|---|---|---|
| `label` (default, recommended) | Small pill, server's short label as text, server color as 12%-opacity background + full-color border. Sentence case, 11pt mono. | Default. Most readable. Matches Scottish Gov status-tag rules. |
| `letter` | Gravatar-style — 18×18 rounded square, server color background, 1-2 letter initials in white. ([reference image 6](image 6)) | Power users with many servers who want compact rows. |
| `symbol` | 18×18 rounded square, server color background, user-picked Phosphor icon. ([reference image 8](image 8)) | Brand-flexing. Requires user to remember the icon-server mapping — accessibility hit. |

User can choose per their preference. **Default is `label` (Scottish Gov status-tag style)** — confirmed by user. It requires zero learning and is the only variant that fully satisfies "never rely on color alone."

#### Server color & label data model

Today `ServerConfig` (`stores/servers.ts:24-31`) has `id`, `url`, `label?` (user-defined when adding), `apiKey`, `serverInfo`, `connectionError`. We add two fields:

```ts
interface ServerConfig {
  // ... existing ...
  color?: string       // hex; auto-assigned on addServer() from a palette of 8 brand-safe options; user-editable in Settings → Servers
  symbol?: string      // optional Phosphor icon name; used by 'symbol' variant only
}
```

**Auto-assigned palette** (brand-safe, all pass WCAG 4.5:1 contrast against `--tb-ink-1`):

| # | Hex | Family |
|---|---|---|
| 1 | `#63b3ff` | Brand blue (default for first server) |
| 2 | `#f08a24` | Brand amber — **reserved for live/now**; only used as a server color if user explicitly picks it (warning shown) |
| 3 | `#4ade80` | Brand success green |
| 4 | `#a78bfa` | Violet |
| 5 | `#22d3ee` | Cyan |
| 6 | `#fb7185` | Coral |
| 7 | `#fbbf24` | Amber-2 (warmer than brand amber) |
| 8 | `#a3a3a3` | Neutral grey (color-blind safe fallback) |

`addServer()` picks the lowest-index unused color. User can override in Settings → Servers (color picker + label edit). The strip color and chip color always derive from the same `ServerConfig.color` field — they can't diverge.

#### Rendering rules (re-stated from rules above, concrete)

- If `activeServerIds.length === 1` → no strip, no chip. Single-server users see clean rows.
- If `activeServerIds.length >= 2` → **always** show both the left strip (3px) and the chip (per user's chosen variant).
- The strip color must visually meet ≥3:1 against the row background per WCAG 1.4.11 (non-text contrast). All eight palette entries satisfy this.
- The chip's text label uses sentence case, adjectives/nouns only — never a verb (per Status Tag guidance: verbs imply interactivity, but tapping the chip *is* interactive — see below).
- Screen-reader label: `Server: {label}`. The strip is `aria-hidden` (decorative — the chip carries the accessible name).
- Tap on the chip → opens a quick filter: "Show only {label}" (applies a one-server filter to the current view). Long-press → opens Settings → Servers focused on that server.

#### What this replaces in current code

- `components/sessions/MachineBadge.tsx` — kept as the chip primitive but extended: takes `color`, `label`, `variant` props instead of just `machineName`. Old call-sites (`MachineBadge machineName={server.label}`) still work via a default-color path.
- Inline `serverLabel` rendering at `ConvRow.tsx:31-33` and `SessionRow.tsx:76-78` — deleted; the chip moves into the `ConversationListItem`'s meta column.

### 5. `ConversationPreviewSheet` — bottom-sheet preview modal (user feedback point 6)

On long-press of any `ConversationListItem`, an action sheet opens with a new top option: **Preview last 10 messages**. Tapping opens a modal bottom-sheet (`@gorhom/bottom-sheet`, already in the repo for `RenameSessionSheet`) that:

- Shows the `ConversationListItem` itself pinned at the top, identical chrome.
- Below it: scrollable list of the last N messages (default 10, setting-controllable) using the existing message renderer from `app/conversation/[id].tsx` in read-only mode.
- Sticky footer: `Open conversation` (primary) · `Resume in terminal` (if session) · `Pin/Unpin`.
- Swipe-down dismisses; swipe-up to half-height to full-height.

Purpose: lets the user peek at content **without committing to a navigation away from the list**. The most common decision the user makes is "is this the right conversation?" — currently they must open it and come back. This collapses 2 navigations to a long-press + swipe.

The sheet reuses `ConversationListItem` at top → another consumer that proves the primitive's value.

### 6. Manipulable props (user feedback point 4) — future hooks

The component exposes its full prop surface from day one. Per-row overrides aren't user-facing in v1, but the door is open: a future "Customize row" sheet (long-press on header → Customize) lets power users toggle:

- `preview` on/off
- `showCount` / `showBranch` / `showServer`
- `density` (per-view)

These would persist in `stores/settings.ts` under a new `listPrefs` key, keyed by view (`hub-drill`, `tree-drill`, `classic`, `search`). Out of scope for v1 — but the prop API is the contract that makes it cheap later.

### 7. Future plan — Settings server color picker (deferred from v1)

**Decision (confirmed by user):** ship a pre-defined color picker in Settings → Servers for assigning each server its identity color. Deferred from v1 — listed here so it's tracked.

**Scope when implemented:**

- Each server row in Settings → Servers (next to the existing label edit) gains a color swatch button showing the current `ServerConfig.color`.
- Tapping the swatch opens a small popover with the **8 pre-defined palette swatches** (the brand-safe WCAG-passing palette listed in §4 above) plus a "Reset to auto" option.
- The brand amber `#f08a24` swatch shows a small warning subtitle: *"Reserved for live sessions — choosing this may clash with live-row indicators."* User can still pick it.
- Selecting a swatch persists immediately via `useServersStore().updateServerColor(serverId, hex)` — a new store action paired with `updateServerLabel`.
- Collision handling: if the user picks a color already used by another active server, show an inline notice — *"Also used by `{otherLabel}`. Pick again or keep both."* — do not block.
- No free-form hex input in v1 of this future feature. Stay on the palette so contrast guarantees hold.
- Reorder/drag of servers in Settings stays unchanged (already shipped via the `2026-05-11-server-drag-reorder-design.md` spec).

**Implementation prerequisites:**

- `ServerConfig.color` field added in v1 of this plan (auto-assigned at `addServer()`).
- The 8-color palette already declared in §4.
- A new store action: `updateServerColor(serverId: string, hex: string): void` mirroring `updateServerLabel`. Persists via the existing `persistServerList` path.

**Where it fits in the rollout:** lands as its own follow-up PR after the v1 list redesign ships and stabilizes on TestFlight. Until then, server colors are auto-assigned only and the user can't change them in-app (they'd have to remove and re-add the server to roll the auto-assignment).

### 8. Design-system browseable preview — colors + components

**Goal:** a single place to see every design-system token rendered live — every color, type ramp, spacing scale, radius, shadow, and component variant. Today `design/preview/*.html` has 16 static HTML cards that already cover this for the brand reference; they're not connected to the runtime tokens in `constants/theme.ts`, and the components shown are HTML mocks, not the real React Native ones. The two surfaces below close that gap.

#### 8a. Web preview surface (Playwright-driven snapshot harness)

A static web preview that renders the project's brand tokens **from `colors_and_type.css`** plus a side-by-side mirror of the **runtime** tokens from `constants/theme.ts`. Anyone (designer, reviewer, the user) can open it in a browser and scroll through every token, with Playwright wired up to snapshot the page on every PR so visual drift gets flagged.

Structure:

```
design/preview/
  ├── index.html              # entry; links to all category pages
  ├── colors-*.html           # existing files, kept as-is
  ├── spacing-*.html, type-*.html, components-*.html   # existing
  └── tokens-runtime.html     # NEW — pulls dark/light/dracula/catppuccin/nord from theme.ts
                              #       via a small build step that emits a JSON snapshot
```

Build step: `npm run preview:build` runs a tiny Node script that reads `constants/theme.ts`, evaluates the exported `dark` / `light` / `dracula` / `catppuccin` / `nord` objects, and writes `design/preview/tokens-runtime.json`. `tokens-runtime.html` reads that JSON and renders side-by-side swatches with the brand spec swatches from `colors_and_type.css`. Any drift (e.g. current `dark.text.accent: #58a6ff` vs brand `#63b3ff`) is visually obvious in the diff column.

Playwright role: one test file `design/preview/__tests__/preview.spec.ts` opens each `*.html` page in headless Chromium, takes a full-page screenshot, and diffs against a committed baseline. Anchored under the `pr-review-toolkit` flow so every PR that touches `constants/theme.ts`, `colors_and_type.css`, or any `components/ui/*` triggers it.

Tooling decision: **Playwright over Chromatic / Percy** because:
- Playwright is the user's existing browser-automation surface (see `plugin:playwright:playwright` MCP loaded in this session).
- Snapshots live in the repo, no external service / billing.
- The same Playwright suite can later drive the on-device preview (§8b) via a small Expo Dev Tools bridge.

Scope of what lands in v1:
- The `tokens-runtime.html` page and the build script.
- Playwright config + a single snapshot test that captures the new page.
- A `package.json` script: `npm run preview:check` runs the build + the Playwright snapshot diff.
- Documented in `design/preview/README.md` (new file).

What's deferred:
- Re-rendering the existing HTML cards from runtime tokens (they stay as the brand-spec reference).
- Hooking the same snapshot into CI — separate PR once the workflow stabilizes locally.

#### 8b. On-device component preview — Storybook for React Native

**Goal:** open the iPhone/simulator, browse every real React Native component (`ConversationListItem`, `ServerChip`, `CardShell`, `Badge`, `EmptyState`, `LiveDot`, `MessagePreview`, etc.) in isolation with all variants and controls. The runtime tokens are real, the components are real — what you see is what ships.

**Recommended stack:** **`@storybook/react-native` v8+** with the `@storybook/addon-ondevice-controls` and `@storybook/addon-ondevice-actions` addons. This is the canonical "Storybook for React Native" the user asked for. It runs *inside the Expo app* as an alternate root view, gated behind a dev-only flag — so we can ship it without any production cost.

Why this stack works for an Expo SDK 55 project:
- `@storybook/react-native` v8 supports Expo Router and the SDK 55 toolchain. The compatibility matrix is published; no patching required.
- Stories live next to components: `components/sessions/shared/ConversationListItem.stories.tsx`. Co-located, no story registry file to maintain.
- Storybook UI itself is a React Native tree, so it benefits from any Reanimated/Gesture changes the host app gets.
- Works fine alongside Hermes (the iOS 26 crash issue from memory is fixed in our current SDK 55 setup).

Wiring:
- Add a dev-only entry in `app/_layout.tsx`: `if (__DEV__ && process.env.EXPO_PUBLIC_STORYBOOK === '1') { return <StorybookUIRoot /> }`. Toggled by a `npm run storybook:ios` script that sets the env var and starts Metro.
- Stories cover every shared component (`components/ui/*`, `components/sessions/shared/*`) plus the four list views (`hub`, `tree`, `classic`, search) with mock data fixtures pulled from the existing Maestro mock server.
- Theme switcher addon: a dropdown in the Storybook control panel that flips the theme between `dark` / `light` / `dracula` / `catppuccin` / `nord`. Same surface as the web preview (§8a) — any token change is visible in both places.

Risks / known issues:
- `@storybook/react-native` v8 has a Metro config requirement (a separate `metro.config.storybook.js` may be needed). The `expo-local-ship` workflow stays untouched — Storybook is a dev-only Metro target.
- The user's bookmark on Metro path resolution (Node version, Watchman reset) still applies; setup notes in the future PR will reference those.

Scope of what lands in v1 of *this* plan:
- **Storybook setup is deferred to a follow-up PR**, same as the server color picker. Listed here so it's tracked.
- The components built in v1 (`ConversationListItem`, `ServerChip`, `MessagePreview`) are written so their props are pure and snapshot-friendly — they'll plug straight into Storybook when it lands.

What v1 *does* include: a single `__tests__/visual/` directory with React Test Renderer snapshots of `ConversationListItem` in its key variants. Lightweight, no new dependencies, catches regression on prop combinations until Storybook ships.

#### 8c. Why both surfaces?

- **Web preview (§8a)** = brand designers + reviewers, browser-based, snapshot-diffable in CI.
- **Storybook on device (§8b)** = engineers + the user, real-device fidelity, theme switching, gesture and animation testing.

They share the same token source (`constants/theme.ts` exported, consumed by both). A change in one is visible in the other.

---

## Per-view designs

### View A — Hub directory drill (img 1)

Goal: each row says what the conversation **is**, not where it lives.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹  apps/ios/Tabby                          12 conversations  🔍  │ ← sticky sub-header
├──────────────────────────────────────────────────────────────────┤
│ ●Live│ Fix metro bundler crash                          23h ago │
│  TB  │ User · "the bundler is throwing on iOS 26 ..."  42 msgs · main [srv-a]
├──────────────────────────────────────────────────────────────────┤
│  ○   │ Add settings sheet drag-reorder                  23h ago │
│  TB  │ Claude · "I've wired up NestableDragga..."    28 msgs · feat/sort
├──────────────────────────────────────────────────────────────────┤
│  ○   │ TestFlight build 87 failed                       1d ago  │
│  TB  │ User · "archive succeeded but upload ..."        9 msgs · main
└──────────────────────────────────────────────────────────────────┘
```

- **Sticky sub-header** = back chevron, project path (smart-collapsed if deep), conversation count, view-switch icon (jump to tree/classic for this project).
- **Title row** = `conversation.title` when present (rare). Fallback chain: first user message (60 chars) → `lastOutput` → `branch · N msgs`.
- **Preview row** = `MessagePreview` per global setting.
- **Right column** = relative time top, `N msgs · branch` bottom; `[server chip]` only when multi-server.
- **Live pill** in the title-row right edge when status ∈ `running` | `waiting_input`. Brand amber, pulses.
- **No FolderSimple repetition** in body rows — context is in the sub-header.

### View B — Hub root (img 2)

Goal: tell projects apart at a glance when the path IS the identity.

```
┌──────────────────────────────────────────────────────────────────┐
│ ┃ Desktop/dev/ai-tools/                              52    ›    │  parent muted (mono 11)
│ ┃ tb-streamer                                                    │  suffix bold (Inter 16)
│ ┃ ● 1 live · 23 today · last 14m ago                  [srv-a]   │  activity summary
├──────────────────────────────────────────────────────────────────┤
│   /Users/                                              74    ›   │
│   ronenmars                                                      │
│   23 today · last 4h ago                              [srv-a]   │
├──────────────────────────────────────────────────────────────────┤
│ ┃ .claude-mem/                                       757    ›   │
│ ┃ observer-sessions                                              │
│ ┃ 12 today · last 5h ago                              [srv-b]   │
└──────────────────────────────────────────────────────────────────┘
```

- **Last path segment** = Inter 16/20 semibold, primary text. The disambiguator.
- **Parent segments** = JetBrains Mono 11, `--tb-fg-3`, **left-truncated only** when too long.
- **Tertiary line** = activity summary, not raw count: `N live · M today · last X ago` + `ServerChip` (when multi-server).
- **Thread spine** = 2px vertical bar in `--tb-blue-400` (idle) or `--tb-amber-400` (live with pulse), runs the full card height. Echoes the brand icon's thread spine.
- **When a conversation has its own name** (user-named sessions started inside the app — see `2026-05-02-session-naming-design.md`), replace the suffix segment with the name; show full path muted underneath. Path is always present.

### View C — Classic (sessions list)

`ClassicSessionsList.tsx` currently renders `SessionCard` for each session. Migration:

- Replace `SessionCard` body content with `ConversationListItem` in `density='comfortable'`, `leading='avatar'`.
- Keep `LiveSessionsHeader` — it's a section header, not a row.
- Keep `CardShell` wrapper around each row group (per `2026-05-01-cardshell-unified-card-template.md`) — it's the brand's card primitive.
- Top-of-list search input (already exists in `searchOpen` mode) gains the `All / Today / 7d / 30d` pill row from `HistoryScreen.jsx` for time-bucket filtering.

### View D — Tree (img 3)

Tree is closest to the spec already. Light touches:

- **Indent gutters become visible**: 1px hairlines in `--color-divider` (`rgba(99,179,255,0.08)`) at each depth level. The blue tint is what makes them feel "Threadbase" instead of generic.
- **Green chat icon at `TreeRow.tsx:75`** is replaced with Phosphor `<ChatCircle weight="fill" size={12} color={dark.text.accent + '99'} />`.
- **Count chip** uses unified `Badge` ('pill' variant) with `--color-accent-soft` bg and `--tb-blue-400` text.
- **Time** right-aligned at fixed column so rows align vertically.
- **Leaf rows** use `ConversationListItem` in `density='compact'`, `leading='depth'`. Same component as the rest of the system.

### View E — Tree drill (img 4)

Apply View A's fix (title + preview + meta) plus:

- **Sticky sub-header** with parent's stats: `15 conversations · 8 today · 2 live`.
- **Right-side "switch view" pill** lets you jump to the same project's hub-card or classic-list rendering without going back to the root. Reuses the same data layer.

### View F — Quick Access Strip (top bar)

- **Active tab keeps its icon; inactive tabs lose theirs.** Reduces visual noise. Matches Stitch "PocketDev" — only current state earns the icon.
- **Chips become slimmer**: 28px height, 11pt mono for paths, 12pt sans for session names. `ConversationListItem` in `density='chip'`.
- **`+ N more`** → single right-aligned `›` caret that opens a bottom sheet listing the full set.
- **Gear / pencil / collapse** consolidated behind a single `⋯` overflow menu on the right.
- **Multi-server**: when active servers > 1, chips append a 2px colored vertical stripe on the right edge in the server's color (assigned hash). Tap-hold to filter to that server.
- **Strip ↔ Hub relationship made explicit**: when Recents tab is the active strip tab AND the screen below is the hub root, the strip's chips visually align with the hub cards (same width). Same data, two densities.

### View G — Search results

Per `2026-04-30-projects-hub-redesign.md`: search results replace the hub-card list with a flat list grouped by type — **Conversations** section then **Sessions** section. We extend that:

- Both sections use `ConversationListItem` with `density='comfortable'`, `preview='auto'`, `highlight=<query>` so matched substrings get an inline `--color-accent-soft` background.
- Section headers use `.tb-eyebrow` (UPPER, 0.08em, mono 12) — matches brand spec.
- Empty state: existing `EmptyState` component, message: `No matches for "{query}"`.
- Search bar gets the time-bucket pills (`All / Today / 7d / 30d`) from `HistoryScreen.jsx` reference.
- Search is scoped by the current active-servers filter; results from disabled/disconnected servers are excluded automatically. The user is informed via a small `N more in {disabled count} hidden server(s)` chip at the bottom, tappable to expand.

---

## Settings impact (user feedback point + design system unity)

New settings group **Conversation rows** in `app/settings.tsx`:

- **Title source** — `conversation title` (default) | `first message` | `last message`
- **Preview** — `first message` | `last message` | `auto` | `off` (confirmed: global, in Settings only — no sort-sheet duplication)
- **Density** — `comfortable` (default) | `compact`
- **Path display** — `smart` (default per user point 5) | `full` | `last segment only`
- **Server indicator** — `auto` (only when >1 server) | `always` | `never`
- **Preview-modal message count** — `5` | `10` (default) | `20`
- **Server chip style** — `label` (Scottish Gov status-tag, default) | `letter` | `symbol`

All persisted in `stores/settings.ts`. Names mirror the data model so they're predictable.

---

## Landing-page recommendations (user feedback point 8)

Read `DESIGN.md` in the threadbase landing-page repo. The landing page already uses `#63b3ff` / `#f08a24` / `#070b11` correctly. Aligning the mobile to the landing-page is a **mobile-side change**, not a landing-side change.

That said, the landing page's "Screenshots Section" (alternating image/text) is currently illustrative. We should **swap in the new mobile screens once shipped**, prioritized:

1. **Hub root with thread-spine cards** — the strongest visual demonstration of the brand's thread metaphor on mobile. Matches the landing's own thread iconography exactly.
2. **Hub drill with title + preview** — shows the "real content" value prop.
3. **Search results highlighting** — shows the speed/index theme the landing already pitches.
4. **Tree view** — secondary, but visually distinctive.

Landing-page changes I recommend pairing with this mobile work (separate PR on the landing-page repo):

- The "8 features grid" currently doesn't mention the conversation row format. After this mobile work ships, add a feature card: **"Scannable rows"** — "First-message preview, message count, branch, server, live status — every row carries the context you need to decide without opening."
- The "Screenshots Section" needs three fresh assets (PNG exports of the new hub root, hub drill, search). Recommend storing them in `landing-page/public/screenshots/mobile/` and lazy-loading.

No landing-page code edits in this plan; the recommendation is for a follow-up scoped PR after the mobile work ships and we have real screenshots.

---

## Explicit non-goals

- No backend changes. Data is on the wire (`firstMessage`, `lastMessage`, `preview`, `messageCount`, `serverLabel`, `branch`).
- No new theme tokens / no palette alignment in this PR (user confirmed: separate scoped PR for brand color reconciliation).
- No new dependencies.
- No animation work beyond existing chevron rotation and `LiveDot` pulse.
- No rewrite of `CardShell` / `Card` / `Badge` / `EmptyState` — consumed as-is.

The new `ConversationListItem` is intended to replace `ConvRow`, `SessionRow`, `DrillRow`, and the leaf state of `TreeRow`. Old files are deleted, not parallel-shipped (see rollout section).

---

## Rollout

**Rollout — confirmed: replace all at once.**

Implementation order, smallest-viable-change per commit:

1. `components/sessions/shared/formatListTime.ts` — pure helper (see `design/scratch/time-format-research.md`). Test cases listed in research doc; lands fully unit-tested before any consumer uses it.
2. `components/sessions/shared/pathDisplay.ts` — pure utility, fully unit-tested.
3. `components/sessions/shared/MessagePreview.tsx`.
4. `components/sessions/shared/ServerChip.tsx` — Scottish-Gov status-tag style as default.
5. `components/sessions/shared/ConversationListItem.tsx` — composes all four primitives above. Snapshot tests for every variant combination.
6. `components/sessions/shared/TimeBucketPills.tsx` — `All / Today / 7d / 30d / Custom` pill row (confirmed v2). Pure component, takes counts as props.
7. Migrate hub-drill: `ProjectHubCard` body rows + `app/project/[id].tsx`. Pills wired here.
8. Migrate hub root cards.
9. Migrate classic.
10. Migrate tree leaves + tree-drill.
11. Migrate Quick Access strip chips.
12. Wire search-results path. Pills wired here too.
13. Add settings entries to `app/settings.tsx` + `stores/settings.ts`.
14. `ConversationPreviewSheet` (confirmed v2 — ship in this release).
15. Delete `ConvRow.tsx`, `SessionRow.tsx`, `DrillRow.tsx`, `hubUtils.dateLabel`, `treeUtils.latestActivityLabel`, and `TreeRow.tsx`'s leaf branch.

Each commit ships its piece working end-to-end on TestFlight. Estimate 12-15 commits.

### Why replace, not parallel-ship

The new component **is** the design system. Two row implementations co-existing means two divergent code paths, two sets of bugs, and two visual languages on screen at the same time — the exact problem this redesign solves. The diff is bigger but the work is "swap the renderer," not "redesign each view independently." Localized to one component file, easy to bisect on regression.

Parallel-ship would only make sense if there's a product reason to ship one view at a time (e.g. ship hub-drill first to TestFlight without touching tree). For the duration of that migration the four screens look different from each other — defeating the unification goal. It also doubles testing surface: every tweak to the new component has to be reconciled with the legacy rows still in tree.

**Risk:** a regression in `ConversationListItem` hits all four views at once. Mitigated by:
- Snapshot tests + Maestro flows for each view before deletion.
- Each migration commit is independently revertible (the old row file isn't deleted until step 13).

---

## Decisions (resolved)

| Question | Decision | Source |
|---|---|---|
| Rollout | **Replace all four rows at once.** | User, 2026-05-15 |
| `ConversationPreviewSheet` | **Ship in v1** (v2 in preview cards). Long-press opens a half-height sheet that pins the `ConversationListItem` + last N messages + sticky footer (Open / Resume / Pin). Swipe up to full height. | User, 2026-05-15. Preview: `design/scratch/conversation-preview-sheet.html`. |
| Time-bucket pills | **Ship in v1** (v2 in preview cards). `All / Today / 7d / 30d / Custom` row in hub-drill + search results, with bucket counts in mono. | User, 2026-05-15. Preview: `design/scratch/time-bucket-pills.html`. |
| Time-label format | **Exact `HH:mm` for same-day items, `Yesterday`, weekday, `5 Mar`, `5 Mar 24` ladder.** No more `23h ago` / `4h ago`. Locale-aware via `Intl.DateTimeFormat`. | User feedback 2026-05-15; convention research in `design/scratch/time-format-research.md` (Gmail / iMessage / Slack / WhatsApp / Discord convergence). |
| Server color assignment | Auto from 8-color WCAG-safe palette on `addServer()`. User color picker deferred to follow-up PR (§7). | Earlier in plan. |
| Server chip default style | `label` (Scottish Gov status-tag). | User, 2026-05-15. |

After this lock-in I start with step 1 (`formatListTime`) → step 2 (`pathDisplay`) → … . I'll surface each step for review before progressing to the next.
