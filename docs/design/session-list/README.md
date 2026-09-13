# Handoff: session list redesign (Now / Projects)

Target repo: **RonenMars/threadbase-mobile** (`main`)
Design source: `Session List Redesign.dc.html` (turns 1–5; **turn 5 is newest, turn 1 oldest**)
Fidelity: **high** — colours, type, spacing and row anatomy are taken from `constants/theme.ts` and the existing components, not invented.

---

## Overview

The app currently ships **three interchangeable top-level views** over one dataset (Classic, Tree, Hub) plus a pinned `LIVE · N` widget. This redesign collapses that to **two views with distinct jobs**:

- **Now** — default. A flat list ordered by *state*, not by clock: `Needs you` → `Working` → `Earlier`. Replaces Classic **and** the LIVE widget.
- **Projects** — grouped by project/repo. Hub's card model survives; **Tree becomes a path drill** reached from a project card, plus a path filter field.

It also fixes one system-level problem: **the same fact is currently told three or four different ways**. Liveness is an amber rail + the word "Resumed" in Classic, an amber `LIVE` pill in Hub, a coloured dot in Tree, and `Running / Active / Idle` in the Filter sheet — while `lib/sessionPresentation.ts` defines 15 status labels. This brief replaces all of that with **two colour tiers and five words**.

### About the design files

The bundled HTML is a **design reference** — a prototype of intended look and behaviour. Do **not** port the HTML or its CSS. Recreate each screen in the existing Expo / React Native / NativeWind environment using the existing components (`ConversationListItem`, `SessionCard`, `Card`, `GlassView`, `FilterSortSheet`, `FlashList`/`FlatList`), the existing token modules, and the repo's conventions in `CLAUDE.md`.

Read the HTML in a browser with the canvas zoomed out: each turn is a `<section>`, newest first, and every option carries a visible id badge (`1a`, `2b`, `3a`, `4a`, `5a`…). References below use those ids.

---

## Decisions already made (do not relitigate)

| Decision | Value |
|---|---|
| Views | Two: **Now** (default) and **Projects**. `sessionsLayout: 'tree'` is retired. |
| State colour | Green `status.running` = **Working**; amber `status.waiting` = **Needs you**. (Option `3b`-A.) |
| State vocabulary | 5 words: `Needs you`, `Working`, `Resumable`, `Can't resume`, `Observed`. |
| Provider marks | Real monochrome marks from **lobe-icons (MIT)**, shown **only on rows whose provider differs from the screen's dominant provider**. (Option `3c`-T3.) |
| Titles | Client-side cleanup pipeline + fallbacks. No server summarizer. |
| Density | Adaptive per state (4 lines / 3 / 2 / 1). |
| Glass | Chrome only (header, sheet, action pill). Content cards opaque. |
| Forked / duplicate rows | **Out of scope.** Do not implement. |
| New colour tokens | **None.** Everything uses existing `theme.*` values. |
| New locale strings | Only the ones listed in "i18n" below. |

---

---

## Audit corrections — main @ `9480b97c`, 2026-09-13

This brief was written from a read of `main` a day earlier. A verification pass found four places where it is wrong about *where* or *why*, and several stale premises. **Where this section and the text below disagree, this section wins.**

### Design changes that follow from the audit

1. **Titles are stored, not just displayed.** `hooks/useComposerState.ts:135` slugs the first prompt and slices it, then `hooks/useSessionName.ts:13` PATCHes it to the server; `autoNameFromMessage` defaults true (`stores/settings.ts:156`). So `does-the-currently-r` is a *stored name*, and no `numberOfLines` change can reach it. The pipeline therefore has **two consumers**: (a) it replaces the slug-and-slice before the name is stored, and (b) it runs at render as a repair pass over names already on the server. **Do not silently re-PATCH existing names** — repair at the display layer and let the user's inline rename be the only write.
2. **The Needs-you qualifier is cut.** There is no wait-start timestamp on the wire (`elapsedMs` is session runtime, `lifecycleUpdatedAt` moves on lifecycle, `activity.lastEventAt` is JSONL-only). Render the second line as **`Needs you`** alone, with the clock stamp in the right column. Keep `row.waitingFor` unused until the streamer provides a wait-start field; do not approximate it.
3. **"N today" is sessions-only, always.** The audit is right that it is *inconsistent* rather than unavailable: the session half is computable on a closed card (`ProjectHubCard.tsx:71`), the conversation half is 0 until first expand and then persists (`useProjectConversations.ts:51-56`). A number that changes meaning after an interaction is worse than a missing one. **Count sessions only, on closed and open cards alike.** Conversation totals live in the count slot, which is already a total.
4. **Eyebrows use the existing mono stack.** There is no JetBrains Mono in the bundle — mono today is `Platform.OS === 'ios' ? 'Menlo' : 'monospace'` (`SessionCard.tsx:270`). Use that. **Do not add a font dependency for an eyebrow.**
5. **The existing row settings win where they overlap.** `stores/settings.ts:61-65` already ships `rowTitleSource`, `rowPreviewMode`, `rowDensity`, `rowPathDisplay`, `rowServerIndicator`. Resolution: **adaptive density replaces `rowDensity`** (delete it — state decides height, not a preference); **`rowPreviewMode` survives** as the subtitle on/off control and is what the title pipeline's subtitle step reads; **retire `rowTitleSource` and `aiGeneratedNames`**, which have no consumer outside `app/settings.tsx`.

### PR 5 correction — the wash, and "keep glass on chrome"

A second audit pass found the canvas wash: **two full-screen `expo-linear-gradient` layers at `app/_layout.tsx:503-531`**, drawn whenever `isGlass` is true, showing through because the nav theme, the stack content style and the sessions screen container are all transparent. Dropping the `GlassCard` route does **not** remove it. On `main` the session cards are already see-through, and **neither the header nor the FAB has glass today**.

Three consequences:

1. **PR 5 is the app-wide cut** (revised — see the addendum below). Originally scoped to four files on the sessions screen: `app/index.tsx` paints `bg.primary` on the container and drops the conversation-card transparency; `SessionCard.tsx` drops its transparent variant and inert `GlassFill`; `Card.tsx` drops the `GlassCard` branch; `GlassCard.tsx` is deleted. The gradient stays behind every other screen. Flattening the whole app is a separate design call, like the canvas-darkening one already deferred.
2. **"Keep glass on chrome" is additive work — remove it from PR 5.** Sequence it after PR 6, which ships the header anyway, and **gate it on measurement**: blurred chrome over a `FlashList` is the classic jank site, and every contrast gain in this brief comes from the flat canvas plus opaque cards. If it costs frames on the oldest supported device, don't ship it. The design does not depend on it.
3. **Two defects for their own issues, not for PR 5:**
   - `useIsGlass()` has returned true for every theme since #924, so all fifteen themes — Solarized Light, One Light, Catppuccin Latte, Rosé Pine Dawn included — are painted with a blue gradient. The glass theme is not a choice anyone is making.
   - The wash **ignores Reduce Transparency**. `GlassView` honours it and falls back to opaque `bg.secondary`; a `LinearGradient` does not. A user who asked the OS for less translucency still gets two translucent full-screen layers. This is the stronger case for removing them app-wide than the contrast measurement below.

Note for anyone diffing against `screenshots/01-today-classic-annotated.png`: it recreates the user's build, where cards read as solid. On `main` they are see-through.

#### Addendum — PR 5 goes app-wide

A separate session on 2026-09-06, working from a photo of a "dark rectangle" on the homepage, traced the **same** gradient. The second full-screen layer ran from (0.1, 0) to (0.9, 0.55); past its endpoints a gradient clamps to a solid colour rather than fading, so on a tall phone it produced a solid tinted block top-left and a solid untinted block across the lower 45% — the hard edge in the photo. That session stretched the endpoint to (1,1), left the edit uncommitted in a `homepage-bg-fix` worktree, and never opened a PR.

**Scope is therefore app-wide:** delete both gradients in `app/_layout.tsx:503-531`, set the nav background to `bg.primary`, plus the four sessions-screen files, and update the one test asserting a transparent nav background. Remove the `homepage-bg-fix` worktree — it has nothing committed, and its only edit repairs a gradient this PR deletes.

Why this overrides the scope-discipline argument:

- The defect is **visible and user-reported**, not just measurable. A sessions-screen-only fix leaves a hard-edged rectangle on every other screen and a half-finished fix rotting in a worktree — two open bugs where there was one.
- **Two independent investigations found the same 28 lines in one week**, from unrelated starting points.
- It **converges the app on the onboarding palette**, which the user has already said reads as more dominant and higher-contrast than the list screens. Onboarding is flat near-black with no wash; flattening the nav and header screens moves the rest of the app toward the part that already works.

**Accept one consequence deliberately:** after this the app has no glass anywhere. Flat dark and high contrast is a defensible place to land. If the Apple Glass identity is still wanted, it returns **after PR 6**, as chrome only (header, sheet, action pill), gated on a frame measurement on the oldest supported device — never on content.

The `useIsGlass()` issue stays open: it still mis-routes `GlassCard` and `GlassSheet` on settings surfaces, which this PR does not touch. The Reduce Transparency issue closes with the gradients.

### Factual corrections

- **Use `isPresentationLive` (`lib/sessionPresentation.ts:389`), not the expression in this brief.** Mine drops `orphaned` — which `sessionPhase` treats as live — and drops the older-server fallback. There are 13 status-based gates to replace; the audit lists them. The rows in the LIVE block already return `live: false`; they appear there only because the header covers every session.
- **Claim 15 is worse than described.** `None` on Status neither dismisses the sheet nor empties the list: `useSession.ts:44` omits the status param for an empty array, so the server returns everything, while the filter icon reports active (`app/index.tsx:205`). The UI lies about being filtered. This is why tier filtering must be **client-side** — the wire only knows wire statuses.
- **Cursor is already on `main`** (PR #1055, 2026-09-12). Wire value is **`cursor-cli`**; `brand.cursor` and `sessions:provider.cursor` exist. Open question 3 is closed.
- **`GlassFill` is not inert** — `app/settings.tsx` passes `material` at 11 sites. It *is* inert on list surfaces, which is all this brief needed it to be.
- **`e2e/browse.yaml` has no Tree reference**; only `e2e/feat1_tree_drill_new_session.yaml`.
- **`unavailable.worktree` is redundant** — `sessions:status.unavailableWorktree` already reads "Worktree gone". Reuse it.
- **There is no `filter.sortStatus` key**; the sort option reuses `servers:filter.status`.
- **Every new `{{count}}` key needs plurals** — `_one`/`_other` in en/he/ru and six forms in ar, as `locales/ar/sessions.json` already does for `headerLive_*`.
- **The i18n removal list is incomplete.** Also unused after this work: `sessions:status.livePill`, `status.externalPill`, `card.noBranch`, and `settings:appearance.layoutHub`/`layoutClassic`/`layout`.
- **The new sheet's own labels need keys** — `SHOW`, `AGENT`, `ACTIVE WITHIN`, the four ranges, `Recent`, `Project`, plus the drill's `FOLDERS` and `HERE · N CONVERSATIONS`. Some reuse `filter.provider`, `filter.order`, `filter.resetDefaults`, `filter.newestFirst`.
- **Open question 1 answered:** no per-project today count on the wire — `ProjectSummary` is path, name, conversationCount, lastActivity (`services/projects-api.ts:17-22`). Hence correction 3 above.
- **Open question 4 answered:** the `sessionsLayout` migration belongs in `hydrate` (`stores/settings.ts:223`), beside the existing `colorScheme` coercion.


## The state system

One derivation, one place: extend `lib/sessionPresentation.ts`. The 15 `SessionStatusLabel` values collapse to five **presentation tiers**. Keep the wire-level fidelity internally if useful, but the list must only ever render one of five words.

| Tier | Condition | Colour | Motion | Row shape |
|---|---|---|---|---|
| **Needs you** | live **and** `status === 'waiting_input'` | `status.waiting` `#d29922` | 8px dot pulsing 0.4→1→0.4 / 1.6s | Card, 4 lines, solid amber border, action row |
| **Working** | live **and** `status === 'running'` | `status.running` `#3fb950` | dot pulses; 2px indeterminate sweep | Card, 3 lines |
| **Resumable** | no live process, resume possible | `text.secondary` dot `#484f58` | none | List row, 2 lines, hairline divider |
| **Can't resume** | `resumable === false` + `unavailableReason`, or `failed` | `status.failed` `#f85149` | none | List row, 1–2 lines, reason in the line |
| **Observed** | external process, `isObserveOnly` | `status.completed` `#58a6ff` | none | List row, 2 lines, read-only |

**"Live" has exactly one gate** — this is the single highest-impact fix in the brief:

Use the existing `isPresentationLive` (`lib/sessionPresentation.ts:389`) — it already handles `lifecycle` resumable/completed/failed, external-alive, `orphaned`, and the older-server status fallback. Replace the 13 status-based gates with it; do not hand-roll the expression.

Nothing else may enter the live block. Today `ClassicSessionsList` uses `LIVE_STATUSES.includes(s.status)`, which is why `LIVE · 10` in the screenshots contains rows idle for 183 hours and rows with `0 prompts`.

**Retired from the list surface:** `Resumed`, `Was waiting`, `Interrupted`, `On hold`, `History`, `Idle`, `Stale`, `Starting up`, `External` as *distinct visual states*. They may survive as detail-screen copy; they must not produce a different colour or a different word in a row.

**Second line format.** `<tier word>` · `<qualifier>`:
- Needs you → nothing. No wait-start timestamp exists on the wire; the clock stamp in the right column carries the time. See audit correction 2.
- Working → `<phase> · <elapsed>` where phase comes from `subStatus: AgentPhase` (`sessions:phase.thinking` → "Thinking", `phase.streaming` → "Replying", `phase.hooks` → "Running hooks", `phase.acting` → "Acting", `phase.working` → "Working"). Already gated on `live` inside `deriveSessionPresentation`.
- Resumable → `HH:mm · <branch> · N msgs`
- Can't resume → `Worktree gone — can't resume` (see i18n)

**No second time system.** Clock stamps for history, elapsed only while live. Never both on one row, and never a raw `183h 11m`.

---

## Title pipeline

New module: `lib/displayTitle.ts`. Pure, synchronous, no network. Unit-tested.

```
resolveDisplayTitle(input): { title: string; subtitle?: string }
```

Order of precedence:

1. **User rename** — `useSessionNamesStore.getName(serverId, id)`. Always wins.
2. **Cleaned first user message.** Strip, in order: leading `#`/`##` markdown heading marks; fenced code blocks; `<image name=… path="…">` and `[Image #N]`; `<user_action>` / `<context>` and other injected-context tags (see `lib/codexInjectedContext.ts`); JSON blobs; `ls -la`-style output; absolute paths → basename; URLs → host. Collapse all whitespace to a single line. Sentence-case the first character only — **do not correct typos**, they are the user's words.
3. **Reject** the cleaned string if: fewer than 3 words, or it matches a greeting list (`hi`, `hey`, `hello`, `hello there`, `ahoy`, `yo`, `sup`, …, case-insensitive), or more than 60% of characters are non-alphanumeric, or it is still a bare path / hash / hex id.
4. **Fallback chain on rejection:** first assistant sentence → `<projectName> · <branch>` + relative time. A rejected title must never render blank and must never render `no git · 145h 30m` (today's Hub does — screen 6).
5. **Subtitle = the answer, not the echo.** First assistant sentence, clipped at a sentence boundary. If it would repeat the title, **omit the line** and let the row shrink. Today every Classic card repeats its own title as the preview (screens 2, 3) — about 40% of the list's vertical space carrying zero information.
6. **Truncate by width, never by character count.** `numberOfLines={1}` (list rows) / `{2}` (cards). Today's titles are sliced at 20 characters mid-word (`does-the-currently-r`, `look-for-the-real-pr`) with ~90px of empty row beside them.

**Grouped noise rows.** When ≥3 rejected-title sessions fall in the same time bucket, collapse them into one row: `N one-line sessions` + a `GROUPED` pill + the titles joined with ` · `, tappable to expand. Display-layer only, no new data.

---

## Screens

### 1. Now — `4a` (surfaces) + `3a` (content)

Layout, top to bottom:

- **Glass header** (`z-index` above content, content scrolls under it): status bar → brand row (`assets/icon.png` 22×22, `radius 5`, title `font.lg` 600 `#ffffff`, then search / filter / settings icons at 20px `text.secondary`) → **segmented control** `Now | Projects`, 10px radius, 1px `rgba(88,166,255,.18)`, active tab `rgba(88,166,255,.14)` + `#ffffff`.
- Scroll content **starts below the full header height**. A semantic label must never sit inside the translucent band — only decorative or non-state chrome may (in `4a` it's the filter preset pair).
- **Section eyebrows** in the existing mono stack (`Menlo` / `monospace`) / `font.xs` 600, 1.5px tracking, coloured by tier, followed by a 1px rule at 28% opacity: `NEEDS YOU · 1`, `WORKING · 2`, `EARLIER TODAY`. Mono eyebrows are lifted from the onboarding flow (`> 01 / LANGUAGE`, `HANDSHAKE COMPLETE`).
- **Needs-you card:** 3px amber rail; title `font.base` 600 `#ffffff` (2 lines max); tier line; **`session.lastOutput` verbatim** in a mono block (`bg.primary`, 1px `border`, `radius.sm`, `font.xs`, single line, ellipsis); footer `project/path · branch` + `Open →` in `text.accent`.
  ⚠️ There is **no parsed-question UI and no answer affordance**. The mono block is the raw terminal tail, the same string `SessionCard` already renders on its line 3. Do not add "Answer" or option buttons.
- **Working card:** 3px green rail; title; `Working · <phase> · <elapsed>`; **2px indeterminate sweep** (reuse the treatment in `components/sessions/KnightRiderScanner.tsx`). There is **no percentage anywhere in the API** — never render determinate progress.
- **Earlier rows:** 2 lines (title + subtitle), no card, 1px `rgba(88,166,255,.09)` divider, right column = clock stamp (mono, tabular) + provider mark when non-dominant.
- **Bottom:** 96px scrim + a 44px action pill (`+ New session`) at `right: 20`, `bottom: 24 + insets.bottom`, with the onboarding CTA's radial glow beneath. **The list needs ≥96px bottom padding** — today the FAB covers a timestamp or provider badge in 13 of 14 screenshots.

### 2. Projects — `5a`

- Path filter field at the top (mono placeholder, `bg.secondary`, `radius 8`).
- Eyebrows `ACTIVE · N` (amber) and `RECENT` group the cards; `QUIET · N` collapses long-tail projects into a wrapped chip row (`name count`) with a `Show` link.
- **Project card (closed):** muted parent path (mono `font.xs - 1`), project name `font.lg` 600 `#ffffff`, optional `WORKTREE` pill, then **`N live · last <time>` only**, a single right-aligned count, and a chevron.
  ⚠️ **`N today` counts sessions only, on every card state.** The conversation half is 0 until first expand and then persists, so today's number changes meaning after an interaction (screens 4, 8). Counting sessions only makes it stable; there is no per-project today count on the wire to fix it properly.
- **Project card (open):** amber rail if it has a live session, hairline divider, then up to 3 conversation rows (7px state dot, title, mono meta), then a footer with `All N conversations →` and `browse path ›`.
- **One meaning for the count slot.** Today it is `sessionCount + convCount` or `"N · M"` depending on `mergeChats`. Pick one (total) and keep it.
- **Path drill** (Tree successor): breadcrumb header `machine · ~/dev` + folder name in mono; `FOLDERS` section with 7px state dot, mono name, pill count, right-aligned time; then `HERE · N CONVERSATIONS`. Label what the counts mean — today's Tree shows `46/1137`, `851` and `24` in the same slot with no legend, and the notation changes on expand (`directCount/totalCount`).

### 3. Filter & sort — `2b` (and `2a` = today, annotated)

- **`View` leaves the sheet.** It is navigation, currently two taps deep under a title that says "Filter & Sort", and `FilterSortSheet.tsx` gates Sort-by and Order on `sessionsLayout !== 'tree'`, so choosing Tree deletes two sections under the user's finger.
- Two presets at the top: **`Only what needs me`** (amber, filled) and `Everything`. These replace the grey `All` / `None` buttons, which read as disabled (`font.xs` `text.secondary` on `bg.card` ≈ 4.0:1, under AA).
- `SHOW` — the five tier chips, each with a **live count**, each multi-select with a leading check when on.
- `AGENT` — `Claude` / `Codex` / `Cursor`, multi-select, same chip mechanics. (`main` currently ships All/Claude/Codex only and a single-select `providerFilter`; Cursor appears in the user's build.)
- `ACTIVE WITHIN` — `Any time / Today / 7 days / 30 days`.
- `ORDER` — `State, then recent` (default) / `Recent` / `Project`, plus a scoped direction toggle labelled `Within each group`. **Drop `Created date` and `Sort by status`** — the latter has no stated ordering.
- **Sticky footer:** `Reset` (peer control, full contrast) + primary `Show N results`, updating live. At zero it disables and reads "No sessions match — loosen a filter", so an empty list is unreachable.
- Bottom safe-area inset; the sheet must not run under the home indicator.
- One selection model throughout. Today Status is multi-select with external All/None and Provider is a radio with an inline `All` pill.

### 4. Edge states — `5b`

All four reuse **existing** copy from `locales/en/sessions.json`:

| State | Keys | Treatment |
|---|---|---|
| Nothing running | `list.empty`, `list.emptySubtitle` | Centred, muted Claude Code mark in a 44px tile, headline, subtitle, `+ New session` pill |
| One host down | `list.serverOffline`, `list.serverOfflineSubtitle` | Red-bordered banner **scoped to that server** + `Retry`; every other machine keeps rendering |
| Still indexing | `list.serverWarming`, `list.serverWarmingSubtitle` | Amber pulsing banner; **history skeletons only** — live sessions don't depend on the index, so the live block stays usable |
| Server too old | `list.serverNeedsUpgrade` | Neutral banner for that host (`unsupportedServerIds` from `useProjectSummaries`); Now keeps working — CLAUDE.md's "degrade, don't break" |

**Multi-machine** needs no new concept: it is multi-server. Group with `ServerHeaderRow` + the server's assigned `color` as a 3px rail and a chip. Server identity is never a state colour. `Needs you` still sorts above every group.

---

## Surfaces and glass

| Surface | Value |
|---|---|
| Canvas | `theme.bg.primary` `#0d1117`, **flat** — no gradient, no blue wash |
| Content card | `theme.bg.secondary` `#161b22`, 1px `rgba(88,166,255,.18)`, `radius.lg` 12–16, opaque always |
| Chrome (header, sheet, action pill) | `GlassView` as-is: native `glassEffectStyle="regular"` on iOS 26+, `BlurView intensity 40` (sheet 60) elsewhere, opaque `bg.secondary` under Reduce Transparency |
| Divider | 1px `rgba(88,166,255,.09)` |
| Glow | Only under the primary CTA and behind the brand mark. Never behind body text |

**Why:** with the wash behind content, `text.secondary` `#7d8590` measures **5.0:1** against `#0d1117` at the top of the list and **3.3:1** against the `#1d3550` the wash reaches at the bottom — same component, passing or failing by scroll position. Apple's material is for floating navigation with opaque content passing underneath; the page background is the one place it isn't designed for.

**The change this requires is one level above `GlassView`:** `components/ui/Card.tsx` routes to `GlassCard` on glass themes, so *every content card* is currently a material layer. Cards go opaque; chrome keeps the material. (`GlassFill` is inert on list surfaces — it returns `null` unless `material` is passed, and only `app/settings.tsx` passes it, at 11 sites.)

**Do not** darken the canvas to onboarding's `#08090c` in this work. That is a re-ramp of `bg.*` across all fifteen themes for ~0.3:1; removing the gradient buys 1.7:1. Separate, later call.

---

## Design tokens

Everything below already exists. **No new tokens.**

```
bg.primary #0d1117   bg.secondary #161b22   bg.card #21262d   border #30363d
text.primary #e6edf3   text.secondary #7d8590   text.accent #58a6ff
status.running #3fb950   status.waiting #d29922   status.failed #f85149
status.completed #58a6ff   status.idle #7d8590
brand.claude #E8622A   brand.codex #7B5EA7
spacing 4 / 8 / 12 / 16 / 24 / 32      radius 6 / 10 / 16 / 9999
font 11 / 13 / 15 / 17 / 20 / 24 (xs → xxl)
```

Two required overrides: `rosePine.status.running` is `#31748f` and `rosePineDawn.status.running` is `#286983` — both blue-teal, which would put **Working** next to the accent colour. Give those two themes an explicit green for this semantic. (`THEMES` has **15** entries; `ThemeId` has 16 because it includes `'system'`, which `THEMES` excludes.)

Contrast: prefer `#8b949e` (shipped as `githubDark.text.secondary`) over `#7d8590` for 11–12px secondary text on cards — `#7d8590` on `bg.card` is ≈4.0:1, under AA at that size.

Motion (from the design system): standard easing `cubic-bezier(.2,.7,.2,1)`; durations 120 / 180 / 280ms; live pulse 0.4→1→0.4 over 1.6s; **no bounces, nothing overshoots**.

---

## Assets

- **Brand mark** — `assets/icon.png` already in the repo (rendered 22×22, `radius 5`).
- **Provider marks** — copied into this bundle from **lobehub/lobe-icons** (MIT, licence included): `claudecode.svg`, `codex.svg`, `cursor.svg` (monochrome, `fill="currentColor"`, 24 viewBox) plus `claudecode-color.svg` / `claude-color.svg` for non-list surfaces. Add them via `react-native-svg` at 13px in `#8b949e` inside a 22×22 `bg.card` tile.
  Rules: monochrome in the list (colour belongs to state); render **only when the row's provider differs from the screen's dominant provider** — same "auto" logic `ConversationListItem` already uses for the server chip. Colour versions are allowed in the session detail header only.
- **UI icons** — Phosphor only, per CLAUDE.md. No emoji anywhere.

---

## Suggested PR sequence

Each is independently shippable, conventional-commit titled, and small enough to review. Titles follow the repo's `type(scope): imperative summary` rule.

1. `fix(sessions): gate the live block on process liveness` — the `processLiveness`/`lifecycle` gate. No visual redesign. Highest trust payoff in the app.
2. `fix(sessions): add bottom inset so the FAB stops covering rows` — ≥96px list padding; hide the FAB on scroll-down. Also fixes `ProjectHubCard`'s chevron, which animates `0 → 180deg` so "open" points left instead of down.
3. `feat(sessions): collapse session states to five labels and two colours` — `sessionPresentation` tiers + one badge component; delete per-view liveness treatments.
4. `feat(sessions): derive display titles from raw first messages` — `lib/displayTitle.ts` + unit tests + grouped-noise rows.
5. `fix(theme): keep glass on chrome and content cards opaque` — `Card`/`GlassCard` routing, flat canvas.
6. `feat(sessions): state-ordered Now list` — new default view; retires Classic and `LiveSessionsHeader` as a widget.
7. `feat(sessions): provider marks on non-dominant rows` — lobe-icons + dominance rule; removes the word badges.
8. `refactor(servers): move the view switch out of Filter & Sort` — sheet restructure, presets, live count, one selection model.
9. `feat(sessions): fold Tree into Projects as a path drill` — retire `sessionsLayout: 'tree'` **with a settings migration** for persisted values.
10. `feat(sessions): scoped empty, offline, warming and unsupported states`.

---

## i18n

`i18next/no-literal-string` runs at **error** and `npm run test:i18n` fails on missing **and unused** keys, so locale work is part of each PR, not a follow-up. Four locales: `en`, `he`, `ar`, `ru`.

**Add** (namespace `sessions`):
```
status.needsYou      "Needs you"
status.working       "Working"
status.resumable     "Resumable"
status.cantResume    "Can't resume"
status.observed      "Observed"
live.headerNeedsYou  "NEEDS YOU · {{count}}"
live.headerWorking   "WORKING · {{count}}"
live.headerEarlier   "EARLIER TODAY"
row.waitingFor       "waiting {{elapsed}}"
row.groupedOneLine   "{{count}} one-line sessions"
row.groupedPill      "GROUPED"
row.open             "Open"
unavailable.worktree "Worktree gone — can't resume"
```
**Add** (namespace `servers`):
```
filter.presetNeedsMe   "Only what needs me"
filter.presetEverything "Everything"
filter.showResults     "Show {{count}} results"
filter.noResults       "No sessions match — loosen a filter"
filter.withinEachGroup "Within each group"
filter.sortStateFirst  "State, then recent"
```
**Remove** as they fall out of use (or the unused-keys check fails): `sessions:status.{resumed,interrupted,interruptedWaiting,historical,onHold,stale,externalLive,idle,starting}`, `sessions:live.{headerLive,headerIdle}`, `servers:filter.{view,sortCreatedDate,statusRunning,statusActive,statusIdle,all,none}`, plus `settings:appearance.layoutTree` once Tree is gone. Keep `sessions:phase.*` — the Working row uses all five.

Follow the repo's rule: resolve semantic values through an exhaustive `switch` with literal `t('namespace:key')` calls at the presentation boundary. No key indirection, no `preservePatterns`.

---

## Tests, stories, CI

- **A story is mandatory for every new component** — `scripts/check-story-coverage.js` blocks the commit otherwise. New components here: the state badge, the Needs-you card, the Working card, the grouped-noise row, the project card, the filter chip, the four banners.
- **Unit tests** for `lib/displayTitle.ts` (one case per reject rule and per fallback) and for the liveness gate in `sessionPresentation`.
- **Maestro**: `e2e/feat1_tree_drill_new_session.yaml` references the Tree layout and will need updating in PR 9; add any new flow to the `test:e2e:mock` script in `package.json`, which is the authoritative list.
- `SessionScreen.*` suites are load-sensitive — confirm any failure serially with `npx jest --ci --runInBand --testPathPattern "SessionScreen"` before treating it as real.
- Worktrees go **outside** the repo root, as siblings.

---

## Known defects this brief fixes (with evidence)

1. `LIVE · 10` containing rows idle 183h and rows with `0 prompts` — `ClassicSessionsList.tsx` gates on `status`, not liveness.
2. `Was waiting` and `History` rendering in the same `#7d8590` with the same static dot — two meanings, one colour.
3. Raw first messages as permanent titles, including a leaked clipboard path (`<image name=[Image #1] path="/var/folders/…">`).
4. Preview lines echoing their own titles verbatim.
5. Titles sliced at 20 characters mid-word while the row has ~90px spare.
6. Two time systems per row (clock stamp + `183h 11m`).
7. `no git · 145h 30m` rendered as a conversation title.
8. FAB occluding a timestamp or provider badge in 13 of 14 screenshots; no bottom inset.
9. Hub chevron rotating `0 → 180deg` (points left when open).
10. Hub count slot meaning two different things depending on `mergeChats`.
11. `N today` printed on collapsed Hub cards from data only available when expanded.
12. Filter sheet's `Running / Active / Idle` as a fourth status vocabulary; `Active` exists nowhere else in the product.
13. Filter sheet deleting its own Sort-by and Order sections when Tree is selected.
14. `All` / `None` buttons at ~4.0:1, reading as disabled.
15. No result count and no primary action in the filter sheet; `None` on Status drops you onto an empty list with the sheet already dismissed.

---

## Open questions for the developer

1. ~~Per-project today counts~~ — **answered**: not on the wire. Count sessions only.
2. **`waiting_input` start time** — **answered for now**: nothing suitable on the wire, so the qualifier is cut. Worth a streamer field; it is the one number a triaging user most wants.
3. ~~Cursor as a provider~~ — **answered**: already on `main`, wire value `cursor-cli`.
4. ~~Tree retirement migration~~ — **answered**: `hydrate` in `stores/settings.ts:223`.

---

## Files in this bundle

**Start with `PROMPT.md`** — this README is the specification to keep in context, not the prompt to paste.

| File | What |
|---|---|
| `PROMPT.md` | The prompts to paste into Claude Code, in order. |
| `README.md` | This spec. |
| `Session List Redesign.dc.html` | The design source. Turns 1–5, newest first; option ids are visible badges. |
| `screenshots/01-today-classic-annotated.png` | Today's Classic list + LIVE widget, with the 8 numbered findings. |
| `screenshots/02-filter-sheet-today-annotated.png` | Today's Filter &amp; Sort shelf, with its 8 findings. |
| `screenshots/03-now-final.png` | **Now** — the target default view (`4a`). |
| `screenshots/04-projects.png` | **Projects** — the target grouped view (`5a`). |
| `screenshots/05-filter-sheet-redesigned.png` | Filter &amp; sort, rebuilt (`2b`). |
| `screenshots/06-edge-states.png` | Multi-machine, empty, offline, warming, unsupported (`5b`). |
| `screenshots/07-state-and-title-system.png` | State tiers + title pipeline spec (`1d`). |
| `screenshots/08-state-colour-options.png` | The three colour options; **A is chosen** (`3b`). |
| `screenshots/09-provider-badge-options.png` | The three badge treatments; **T3 is chosen** (`3c`). |
| `assets/icon.png` | Brand mark used in every mock (already in the repo). |
| `icons/claudecode.svg`, `icons/codex.svg`, `icons/cursor.svg` | Monochrome provider marks, lobe-icons (MIT). |
| `icons/claudecode-color.svg`, `icons/claude-color.svg` | Colour variants, for non-list surfaces only. |
| `icons/LICENSE` | lobe-icons MIT licence. |
