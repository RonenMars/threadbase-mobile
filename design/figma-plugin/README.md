# Threadbase DS Builder (local Figma plugin)

Finishes the "Threadbase Mobile Design System" Figma file
(https://www.figma.com/design/EhOoHrZG4C6A2lNz0i5ewK).
Most of that file was built over the Figma MCP, but the Starter plan caps MCP use at 20 calls a month, so the rest of the build runs here.
It uses the same Plugin API and needs no MCP calls.

## Run it

1. Open the file in the **Figma desktop app**.
2. Menu → Plugins → Development → **Import plugin from manifest…** → pick `manifest.json` in this folder.
3. Plugins → Development → Threadbase DS Builder → **Build remaining components + screens**.

The plugin creates or reuses the required pages, then runs all jobs for one page before switching to the next.
Each step skips itself if its output already exists, so it is safe to run again after a partial failure.
Public component names must be unique across the file; the build stops on an ambiguous lookup instead of linking or instancing the wrong asset.
Errors are listed in the toast and in the plugin console (Plugins → Development → Show/Hide console).

## What it adds

- **20 Core & Shared, 30 Sessions, 40 Conversation & Terminal, 50 Connectivity and 60 Product Experience:**
  - icons: `Icon/SlidersHorizontal`, `Icon/Gear`, `Mark/Claude`
  - component sets: Banner, EmptyState, FAB, StateBadge, ServerChip, LiveCard, EarlierRow, ServerListCard
  - batch 1 (ui): ProviderMark, SkeletonBox, TimeBucketPills, MessagePreview, LoadingOverlay
  - batch 2 (sessions): LiveDot, SectionEyebrow, HistorySkeletonRow, CantResumeRow, DrillFolderRow, KnightRiderScanner, InlineError, ServerHeaderRow, SessionBanner, ServerStatusCard, ConversationListItem
  - batch 3 (conversation): MessageBubble, ThinkingCard, ThinkingBubble, ToolCard, DiffViewer, MessageSkeletonRow, InheritedHistoryDivider, LivePauseControl, SlowLoadingBanner, ChatComposer
  - batch 4 (servers): AddServerButton, EncryptionRefusalBanner, FilterPresets, NoServersWelcome, ServerBadge, ServerIndexingBanner, ServerFormFields, ServerErrorModal, ServersStatusModal + ServerMenuSheet, CacheAlertModal, FilterSortSheet, and StatusRow variants for the alert-only CacheAlert / HostPressure / ServerState components
  - batch 5 (alerts, shared, misc): StatusPill, AvatarMenu, StatusStrip, StatusRow, StatusSheet, CriticalDialog, NavigationLockOverlay, ScreenHeader, HeaderOverflowMenu, InfoModal, QuestionCard, QuickAccessChip / Strip / ActionSheet, ShelfBubble, ShelfPanel, FirstShowBanner, AnonymousDiagnosticsConsentBanner, SweepBar, IdentityFingerprintBlock, PairCameraIdentityCard
  - batch 6 (servers, pairing, browse): NewSessionServerPicker, ServerClaudeFlagsSection, ServerEncryptionSection, ServerEditModal, ServerFilterSheet, PairConfirmGate, PairScannerModal, RecentDirsModal, BrowseSlowBanner
  - batch 7 (sessions): SessionRow, ConvRow, MachineBadge, SessionStatusBadge, NeedsYouCard, WorkingCard, ProjectHubCard, ExternalSessionBanner, ServerWarmingBanner, SessionDetailSlowBanner, SyncCachedNotice, LeaveSessionModal, NameSessionModal, ModelEffortSheet, ConversationPreviewSheet, RemoteKeyboardControls
  - batch 8 (review, terminal, misc): DiagnosticsPreview, ReviewSheet, QuietHoursEditor, SlashCommandBoard, SlashCommandArgModal, TourOverlay, ConversationSearchView (match bar), SessionHistoryFeed, TerminalOutput, RootErrorBoundary and RenderErrorBoundary fallbacks
  - batch 9 (onboarding, literal palette): PagerDots, PrimaryButton, TerminalCard, InfoTooltip, ThreadField, and an `Onboarding` set with all five steps and their states
  - `Asset/AppIcon`: a placeholder until a bridge job fills it with `assets/icon.png`, because the plugin can't read files from disk
- **80 Screens:**
  - `Now — dark`, rebuilt from component instances to match `e2e/visual/theme-gallery/theme-gallery-dark-now.png`
  - `Now — empty`
  - `Settings — servers`
- **90 Visual QA:**
  - the 16 `e2e/visual/theme-gallery/*.png` reference screenshots, moved here and laid out 1/3 scale in two rows (Now, Projects) with one column per theme.
    They were uploaded over the MCP, which places them on another page, so this step collects them wherever they landed.
- **Source links:** every component set, plus `ServerChip`, gets a `documentationLinks` entry pointing at its `.tsx` file on GitHub, shown in the Inspect panel.
  That stands in for Code Connect, which needs an Organization or Enterprise plan.

## Switching themes

The Starter plan allows only one variable mode, so the 8 themes can't be Figma modes.
The `Color` collection aliases one palette in `Theme Palettes` instead.
To switch themes:

- Run **Plugins → Development → Threadbase DS Builder → Theme → nord** (or any other theme).
- **Theme → toggle dark / light** flips between `dark` and `light`; from any other theme it goes to `dark`.
- That re-points every `color/*` alias, so every component and screen recolors at once.
- `color/brand/*` is theme-independent and is never touched.

## Source of truth

All values come from the tb-mobile code:

- `constants/theme.ts`: colors, spacing, radius, font sizes
- `constants/providers.ts`: brand colors
- `components/ui/*`, `components/sessions/now/*`, `components/servers/ServerListCard.tsx`: component specs

If the code changes, edit this plugin or the variables to match; don't edit the code to match Figma.

`code.js` keeps build jobs and public assets in one `CATALOG`.
Each record carries the build or source-link data plus its target page, group, kind and lifecycle status, so organization does not drift into a second hand-maintained map.
The page metadata does not move live Figma nodes by itself; a separate migration phase owns that change.

The builder creates or reuses these pages in this order:

1. `00 Start Here`
2. `10 Foundations`
3. `20 Core & Shared`
4. `30 Sessions`
5. `40 Conversation & Terminal`
6. `50 Connectivity`
7. `60 Product Experience`
8. `70 Patterns`
9. `80 Screens`
10. `90 Visual QA`
11. `99 Deprecated`

Generated sections carry their catalog group in the private `threadbase-group` plugin-data key so a later migration can organize existing nodes without changing component identity.
The builder also generates `00 Start Here` and an intro guide above every other page from `CATALOG_PAGE_GUIDANCE`.
Those guides define scope, included groups, the change path, lifecycle meanings, usage, and repository links without adding canvas-only documentation to the source of truth.

Every source-linked public component receives a `threadbase-status` plugin-data value and a matching lifecycle line in its description.
Current code-backed and live-validated assets are `stable`.
`LeaveNotice`, `SessionActionSheet`, `EndSessionStatus`, `EndSessionDialogs`, and `SlowQueryBanner` are reserved as `beta` until issue #1167 completes live validation.
Move an asset to `99 Deprecated` only when its replacement and migration note are both recorded.

## Live bridge (for agent-driven edits)

Lets a shell script drive the open file through the full Plugin API, with no MCP call limit.

1. `node bridge.mjs` starts the relay on `http://localhost:7079` (localhost only) and prints a token.
2. In Figma, run **Plugins → Development → Threadbase DS Builder → Bridge (live)** and leave its small window open.
   The first time, paste the token into the box it shows; Figma remembers it per machine, so later runs connect on their own.
3. `node bridge.mjs run job.js [outDir]` sends `job.js`, prints its return value and saves any `snap(node, name, scale)` PNGs to `outDir` (default `out/`).

A job is the body of an async function, with everything above `// ---------- plugin entry ----------` in `code.js` in scope.
Call `await init()` first to load variables, text styles and fonts.
Start a job with `// bridge:bare` when it needs only the `figma` and `snap` arguments; the relay then skips the large plugin prelude, which is preferable for bounded inventory and migration jobs.
Close the bridge window to stop it; the plugin runs nothing on its own.

### Why there is a token

`/run` executes whatever it is handed inside the open Figma document, and any page in the browser can reach a port on localhost.
Binding to `127.0.0.1` stops the network but not the browser, and CORS does not help: a cross-origin `POST` is still *sent*, CORS only decides who may read the reply.

Every request must carry the secret from `design/figma-plugin/.bridge-token`, which is gitignored, `0600`, and readable only by local processes.
The CLI sends it in the `x-bridge-token` header for `/run`, which forces a preflight that a forged browser request cannot satisfy.
The Figma sandbox sends it as an encoded query parameter for `/next` and `/result` because the desktop sandbox strips the custom header; those endpoints still reject requests without the exact secret and remain bound to loopback.

Set `BRIDGE_TOKEN_FILE` to use another local token file without copying or printing its value.
The relay mints it on first run. Delete the file to roll it; the plugin will ask for the new one.

## Tests

`npm run test:scripts` runs `__tests__/unit/scripts/figma-plugin.test.js`, which checks that `code.js` parses, evaluates its prelude without calling Figma, and validates the catalog's builders, organization metadata, source paths, unique public names and build/link consumers.
`code.js` is outside the lint globs and has no type checking, so everything beyond those structural contracts still needs Figma.

The same file starts `bridge.mjs` on a spare port and drives one job end to end, asserting that `/run`, `/next` and `/result` all refuse a request without the token.
