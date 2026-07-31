# 🚦 Pre-release Backlog & Roadmap Analysis — 2026-07-18

> **Snapshot:** `origin/main` at `94145f1b82bd8d97754b595c005f1df7161d221f` (fetched 2026-07-18)<br>
> **Status update:** 2026-07-19 — live open-items: [`pre-relase-backlog-and-roadmap-analysis-2026-07-18-open-items.md`](./pre-relase-backlog-and-roadmap-analysis-2026-07-18-open-items.md)<br>
> **Sources:** [`BACKLOG.md`](./BACKLOG.md), [`ROADMAP.md`](./ROADMAP.md), current code, current Git history, and focused verification commands<br>
> **Scope:** Active, partial, moved, and cleanup entries. Entries already filed under the documents' explicit **Shipped** sections are not duplicated here.

## 🚨 Release verdict

**Tables below are the frozen 2026-07-18 snapshot.** As of 2026-07-19:

1. 🟡 **Crash-reporting consent (Feature 35)** — in flight: [#343](https://github.com/RonenMars/threadbase-mobile/pull/343) (option a).
2. 🟡 **Privacy checklist (Feature 36)** — code-side progress in #343; store/legal/on-device evidence still human-only.
3. 🟡 **Bug 5 (multi-attachment / spaced `@path`)** — in flight: [#345](https://github.com/RonenMars/threadbase-mobile/pull/345).
4. 🟡 **Bug 16 (abandoned empty sessions)** — in flight: [#346](https://github.com/RonenMars/threadbase-mobile/pull/346).
5. 🔴 **Type check still red** and **Maestro release suite still ungreen** — maintainer gates, not first-session product blockers for an OSS invite.

Do not treat the frozen table rows for Features 35/36 or Bugs 5/16 as current — see the open-items status doc.

## 🗝️ Legend

- **Severity:** 🔴 Critical · 🟡 High · 🔵 Medium · 🟢 Low · ⚪ None
- **Priority:** 🔴 P0 release gate · 🟡 P1 before release · 🔵 P2 soon · 🟢 P3 close/defer
- **Effort:** 🟢 XS `<0.5d` · 🔵 S `0.5–1d` · 🟡 M `2–3d` · 🔴 L `4–5d` · 🟣 XL `>1w`
- **Implementation:** ✅ Yes · 🟡 Partial · 🔎 Code present, runtime verification pending · ❌ No · ♻️ Replaced/obsolete · ➡️ Moved
- **Age:** calendar age as of 2026-07-18, based on `Filed` date where present and Git history otherwise.

## 🐛 Backlog and issue analysis

| Item | Estimated severity level | Estimated priority level | Estimated effort | Already implemented on main? | Age | Type |
|---|---:|---:|---:|---|---:|---|
| [Bug 2](./BACKLOG.md#bug-2--hub-tree-node-open-loader--long-list-render-stall) — Hub loader + long-list stall umbrella | 🟡 High | 🟡 P1 | 🔴 L | 🟡 Partial — Issue 1 fixed; Issue 2 remains | 57d · 2026-05-22 | 🧭 Other / umbrella |
| [Bug 5](./BACKLOG.md#bug-5--multi-attachment-send-produces-no-output) — multi-attachment send has no output | 🟡 High | 🟡 P1 | 🟢 XS verification | 🟡 Partial — multi-select/upload/send code shipped in `c70a498`; real multi-file response still lacks a green Maestro case | 61d · 2026-05-18 | 🐛 Bug |
| [Bug 7](./BACKLOG.md#bug-7--quick-access-strip-default-collapsed--tab-reorder--hide-when-fully-empty) — Quick Access defaults/order/empty state | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes, then simplified to Favorites-only in `c43e9a1` | 57d · 2026-05-22 | 🐛 Bug |
| [Bug 8](./BACKLOG.md#bug-8--manage-favorites-duplicate-top-bar) — duplicate Manage Favorites header | 🔵 Medium | 🟢 P3 | 🟢 XS docs | ✅ Yes — one native Stack header, no in-screen duplicate | 57d · 2026-05-22 | 🐛 Bug |
| [Bug 9](./BACKLOG.md#bug-9--quick-access-hide-edit-pencil-when-strip-is-collapsed) — pencil visible while collapsed | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — pencil and gear are gated on `!stripCollapsed` | 57d · 2026-05-22 | 🐛 Bug |
| [Issue 1](./BACKLOG.md#issue-1--post-intro-cached-hub-list-flashes-then-re-paints-with-server-data) — cached Hub flashes before refresh | 🔵 Medium | 🟢 P3 | 🟢 XS docs | ✅ Yes — cached-data refresh indicator shipped in `2a3e6d8` | 57d · 2026-05-22 | 🐛 Bug |
| [Issue 2](./BACKLOG.md#issue-2--hub-accordion-expand-stalls-on-long-projects-1266-items--9-s) — accordion expansion stalls ~9s | 🟡 High | 🟡 P1 | 🔴 L | ❌ No — `ProjectHubCard` still sorts/maps every expanded row inline | 57d · 2026-05-22 | 🐛 Bug / performance |
| [Bug 13](./BACKLOG.md#bug-13--new-session-name-modal-flashes-open-then-auto-closes-before-user-can-type) — create-name modal auto-closes | 🟡 High | 🟢 P3 | 🟢 XS docs | ♻️ Replaced — create/exit name modals were removed in `6c138c8`; rename remains available | 56d · 2026-05-23 | 🐛 Bug |
| [Bug 14](./BACKLOG.md#bug-14--after-starting-new-session-file-browser-stays-in-stack-and-re-shows-on-exit) — Browse remains under new session | 🔴 Critical | 🟢 P3 | 🟢 XS docs | ✅ Yes — current `/session/new` dismiss-then-push flow shipped in `0909404` | 56d · 2026-05-23 | 🐛 Bug |
| [Bug 15](./BACKLOG.md#bug-15--after-new-session-back-file-browser-is-interaction-locked-only-close-works) — stale Browse screen interaction-locks | 🟡 High | 🟢 P3 | 🟢 XS docs | ✅ Yes — eliminated with the Bug 14 navigation replacement | 55d · 2026-05-24 | 🐛 Bug |
| [Bug 16](./BACKLOG.md#bug-16--back-from-never-typed-in-new-session-leaves-an-empty-session-alive) — abandoned empty session stays alive | 🔵 Medium | 🔵 P2 | 🟡 M | ❌ No — no discard/delete-on-unused-exit path found | 55d · 2026-05-24 | 🐛 Bug |
| [Bug 17](./BACKLOG.md#bug-17--chat-output--on-reconnect-scroll-to-bottom-is-jumpy-not-smooth) — jumpy stream/reconnect autoscroll | 🔵 Medium | 🔵 P2 | 🟡 M | 🟡 Partial — terminal/history use native bottom anchoring; live chat still issues animated `scrollToEnd` calls | 55d · 2026-05-24 | 🐛 Bug |
| [Bug 18](./BACKLOG.md#bug-18--maestro-flow-server_drag_reorderyamlskip-crashes-the-app-at-the-swipe-step) — drag-reorder Maestro crash | 🔵 Medium | 🟡 P1 | 🔵 S | 🟡 Partial — flow exists, but is absent from `test:e2e:mock` and lacks a recorded green run | 55d · 2026-05-24 | 🔧 Maintenance / test |
| [Bug 19](./BACKLOG.md#bug-19--maestro-flow-tree_server_headersyamlskip-cant-return-to-hub-after-pairing-second-server) — tree headers E2E cannot finish pairing | 🔵 Medium | 🟡 P1 | 🔵 S | ❌ No — flow remains `tree_server_headers.yaml.skip` | 55d · 2026-05-24 | 🔧 Maintenance / test |
| [Cleanup: locked agent worktrees](./BACKLOG.md#locked-agent-worktrees-in-claudeworktrees) | ⚪ None | 🟢 P3 | 🟢 XS docs | ♻️ Obsolete — named worktrees/branches no longer exist | 54d · 2026-05-25 | 🧹 Maintenance |
| [Cleanup: uncommitted E2E/research](./BACKLOG.md#uncommitted-e2e--research-changes-on-main) | ⚪ None | 🟢 P3 | 🟢 XS docs | ♻️ Obsolete — current tree is clean; files were committed, replaced, or removed | 54d · 2026-05-25 | 🧹 Maintenance |
| [Cleanup: TestFlight build after conversation fix](./BACKLOG.md#testflight-build-with-the-conversation-load-fix) | ⚪ None | 🟢 P3 | 🟢 XS docs | ♻️ Obsolete — many builds followed; current iOS build is 164 | 54d · 2026-05-25 | 🧹 Maintenance |
| [Bug 20](./BACKLOG.md#bug-20--new-session-from-tree-view-with-path-completion-errors-on-path) — tree prefilled path rejected | 🟡 High | 🟢 P3 | 🟢 XS docs | ✅ Yes — out-of-root paths fall back to Browse root in `55eb9a8` | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 21](./BACKLOG.md#bug-21--open-session-from-recents-lands-on-session-not-found) — Recents opens wrong route | 🟡 High | 🟢 P3 | 🟢 XS docs | ♻️ Replaced — fixed in `a6a4f9f`; Recents was later removed in `c43e9a1` | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 22](./BACKLOG.md#bug-22--settings-qr-scanner-button-is-a-no-op-on-the-ui-layer) — Settings QR scanner is a no-op | 🟡 High | 🟢 P3 | 🟢 XS docs | ✅ Yes — scanner modal wiring + E2E shipped in `9335ca0` | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 23](./BACKLOG.md#bug-23--popular--new-session-here-errors-unable-to-load-directories) — Popular routes to wrong server | 🟡 High | 🟢 P3 | 🟢 XS docs | ♻️ Replaced — fixed in `3a0d061`; Popular was later removed | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 24](./BACKLOG.md#bug-24--popular-error-text-is-black-on-black-almost-invisible) — Popular error contrast | 🔵 Medium | 🟢 P3 | 🟢 XS docs | ♻️ Replaced — themed in `3a0d061`; Popular was later removed | 54d · 2026-05-25 | 🐛 Bug / visual |
| [Bug 25](./BACKLOG.md#bug-25----moved-to-roadmap) — Settings button parity | ⚪ None | 🟢 P3 | 🟢 XS docs | ➡️ Moved to Feature 22; ✅ shipped in `b82834d` | 54d · 2026-05-25 | 🧭 Other / moved |
| [Bug 26](./BACKLOG.md#bug-26--hide-quick-access-edit-pencil-when-the-active-tab-is-empty) — pencil on empty tab | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — empty strip returns `null`; pencil also requires items | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 27](./BACKLOG.md#bug-27----moved-to-roadmap) — optional server-name onboarding slide | ⚪ None | 🟢 P3 | 🟢 XS docs | ➡️ Moved to Feature 23; ✅ shipped in `9335ca0` | 54d · 2026-05-25 | 🧭 Other / moved |
| [Bug 28](./BACKLOG.md#bug-28--pull-to-refresh-modal-show-ipport-when-server-has-no-name) — unnamed server display fallback | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — `serverDisplayName` host:port fallback in `9335ca0` | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 29](./BACKLOG.md#bug-29--quick-access-open-only-on-tab-click-remove-the-right-side-chevron) — Quick Access expansion affordance | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — tab toggles strip; right chevron is gone | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 30](./BACKLOG.md#bug-30--add-to-favorites-is-non-functional--needs-spec-from-claude-code) — Favorites are non-functional | 🟡 High | 🟢 P3 | 🟢 XS docs | ✅ Yes — toggles across detail/Hub/Tree shipped in `ada009b`, rollback polish in `2a773aa` | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 31](./BACKLOG.md#bug-31--settings-theme-change-doesnt-apply-colors-across-the-whole-app) — theme does not propagate app-wide | 🟡 High | 🟢 P3 | 🟢 XS docs | ✅ Yes — app-wide `useTheme()` migration shipped in `a986613` | 54d · 2026-05-25 | 🐛 Bug |
| [Bug 33](./BACKLOG.md#bug-33--browsesession-navigation-simplify-the-transitionend-dismiss-then-push-dance) — simplify Browse navigation dance | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — transition listener replaced by `/session/new` + next-frame push in `0909404` | 48d · 2026-05-31 | 🔧 Maintenance |
| [E2E remaining work](./e2e-remaining-work.md) — mock suite failures and environment blockers | 🔴 Critical | 🔴 P0 | 🟡 M | 🟡 Partial — unit-level E2E tests pass, but native Maestro release suite is not green | 5d · 2026-07-13 | 🔧 Maintenance / test |

## 🗺️ Roadmap analysis

Missing roadmap features are generally **not release defects** unless they represent an already-advertised capability, a privacy/store obligation, or a verification gate. Their severity therefore stays low even when effort is large.

| Item | Estimated severity level | Estimated priority level | Estimated effort | Already implemented on main? | Age | Type |
|---|---:|---:|---:|---|---:|---|
| [Feature 3](./ROADMAP.md#feature-3--attach-multiple-files-to-a-single-message) — multiple attachments | 🟡 High | 🟡 P1 | 🟢 XS verification | ✅ Yes in `c70a498`; pair with Bug 5 runtime verification | 55d · 2026-05-24 | 📋 Task / feature |
| [Feature 4](./ROADMAP.md#feature-4--auto-deploy-to-app-store--google-play) — automated store deploy | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — manual GitHub Actions deploy supports iOS/Android/all, with store upload and version landing | 57d · 2026-05-22 | 🔧 Maintenance / release |
| [Feature 5](./ROADMAP.md#feature-5--polish-the-onboarding-flow) — onboarding polish | 🔵 Medium | 🔵 P2 | 🟡 M | 🟡 Partial — multiple redesign/copy/error passes shipped; undefined audit/top-five closeout remains | 57d · 2026-05-22 | 📋 Task / UX |
| [Feature 6](./ROADMAP.md#feature-6--cross-session-search-with-hit-context--open-in-session) — search with anchored open | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — cross-server results, anchor loading, and highlight shipped in `d71ade4` | 57d · 2026-05-22 | 📋 Task / feature |
| [Feature 7](./ROADMAP.md#feature-7--workspace-tagging-across-sessions--conversations--projects) — workspace tagging | 🟢 Low | 🟢 P3 | 🟣 XL | ❌ No | 57d · 2026-05-22 | 📋 Task / feature |
| [Feature 8](./ROADMAP.md#feature-8--saved-views-persisted-filter--sort--tag-combos-as-named-tabs) — saved views | 🟢 Low | 🟢 P3 | 🔴 L | ❌ No | 57d · 2026-05-22 | 📋 Task / feature |
| [Feature 9](./ROADMAP.md#feature-9--side-by-side-session-split-view-for-live-runs) — split session view | 🟢 Low | 🟢 P3 | 🟣 XL | ❌ No | 57d · 2026-05-22 | 📋 Task / feature |
| [Feature 10](./ROADMAP.md#feature-10--cross-server-prompt-templates--snippets-library) — snippets library | 🟢 Low | 🟢 P3 | 🔴 L | ❌ No — slash-command UI is not a user snippet store | 57d · 2026-05-22 | 📋 Task / feature |
| [Feature 11](./ROADMAP.md#feature-11--workspace-sync-across-devices-via-streamer) — cross-device workspace sync | 🟢 Low | 🟢 P3 | 🟣 XL | ❌ No | 57d · 2026-05-22 | 📋 Task / cross-repo |
| [Feature 12](./ROADMAP.md#feature-12--live-activities--dynamic-island-for-in-progress-sessions) — Live Activities / Dynamic Island | 🟢 Low | 🟢 P3 | 🟣 XL | ❌ No | 57d · 2026-05-22 | 📋 Task / native |
| [Feature 13](./ROADMAP.md#feature-13--mission-control-aggregate-every-live-session-across-servers) — Mission Control | 🟢 Low | 🔵 P2 | 🟣 XL | ❌ No | 57d · 2026-05-22 | 📋 Task / feature |
| [Feature 14](./ROADMAP.md#feature-14--voice-prompts-via-on-device-whisper) — voice prompts | 🔵 Medium | 🔵 P2 | 🟡 M | 🟡 Partial — OS speech recognition shipped in `bf583f0`/`c70a498`; offline Whisper, waveform, and silence-stop did not | 57d · 2026-05-22 | 📋 Task / native |
| [Feature 15](./ROADMAP.md#feature-15--scheduled-prompts-send-tomorrow-at-9am) — scheduled prompts | 🟢 Low | 🟢 P3 | 🟣 XL | ❌ No | 57d · 2026-05-22 | 📋 Task / cross-repo |
| [Feature 16](./ROADMAP.md#feature-16--sync-mode-jsonl-sourced-bubbles--native-prompt-forms) — JSONL bubbles + native prompt forms | 🔵 Medium | 🔵 P2 | 🔴 L | 🟡 Partial — live bubbles and structured prompts shipped; the specified per-session Sync toggle/model was re-scoped | 56d · 2026-05-23 | 📋 Task / cross-repo |
| [Feature 17](./ROADMAP.md#feature-17--expand-maestro-e2e-coverage-to-high-value-flows) — high-value Maestro coverage | 🟡 High | 🔴 P0 | 🟡 M | 🟡 Partial — coverage expanded substantially, but the release suite remains ungreen | 56d · 2026-05-23 | 🔧 Maintenance / test |
| [Feature 19](./ROADMAP.md#feature-19--queue-while-thinking-recolor-send-button-as-add-to-queue-during-a-turn-auto-send-when-idle) — queue while thinking | 🔵 Medium | 🔵 P2 | 🔴 L | 🟡 Partial — queue API/sheet exists, but the composer/send-button behavior and automatic idle flush do not | 55d · 2026-05-24 | 📋 Task / feature |
| [Feature 20](./ROADMAP.md#feature-20--visual-regression-gate-on-maestro-screenshots) — screenshot regression gate | 🔵 Medium | 🔵 P2 | 🔵 S | ❌ No — screenshots exist; comparator/baselines/CI gate do not | 55d · 2026-05-24 | 🔧 Maintenance / test |
| [Feature 21](./ROADMAP.md#feature-21--tree-view-render-drilled-folder-conversations-as-full-hubclassic-rows) — rich Tree drill rows | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — `DrillRow` uses shared `ConversationListItem` with preview/count/branch/provider | 54d · 2026-05-25 | 📋 Task / UX |
| [Feature 22](./ROADMAP.md#feature-22--settings-button-on-the-filter--sort-bar-parity-with-sidebar) — Settings button parity | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes in `b82834d` | 54d · 2026-05-25 | 📋 Task / UX |
| [Feature 23](./ROADMAP.md#feature-23--onboarding-optional-server-name-slide-before-the-qr-scan) — optional server-name slide | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes in `9335ca0` | 54d · 2026-05-25 | 📋 Task / UX |
| [Feature 24](./ROADMAP.md#feature-24--manage-favorites-add-to-favorites-empty-state-cta) — Favorites empty-state CTA | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — CTA exists and Favorites are functional | 54d · 2026-05-25 | 📋 Task / UX |
| [Feature 25](./ROADMAP.md#feature-25--clear-react-hooks-v5-lint-warnings-react-compiler-prereq) — clear hooks lint warnings | 🟢 Low | 🟢 P3 | 🟢 XS docs | ✅ Yes — full ESLint pass is clean with zero warnings | 52d · 2026-05-27 | 🔧 Maintenance |
| [Feature 26](./ROADMAP.md#feature-26--verify-sdk-56-precompiled-xcframeworks-are-active-in-maestro-ci) — verify precompiled XCFrameworks | 🟢 Low | 🔵 P2 | 🔵 S | 🟡 Partial — precompile is explicitly enabled; clean CI-log evidence and timing comparison are not documented | 52d · 2026-05-27 | 🔧 Maintenance / performance |
| [Feature 27](./ROADMAP.md#feature-27--adopt-eas-precompiled-community-libs-for-ios-build-time) — EAS community precompile | 🟢 Low | 🟢 P3 | 🔵 S | ♻️ Not applicable to current self-hosted Actions path; EAS remains opt-in | 52d · 2026-05-27 | 🔧 Maintenance / performance |
| [Feature 28](./ROADMAP.md#feature-28--audit-manual-usememousecallbackreactmemo-for-react-compiler-driven-deletion) — manual memoization audit | 🟢 Low | 🟢 P3 | 🟡 M | ❌ No — React Compiler is on, but 187 memoization calls remain and no profile-driven audit is recorded | 52d · 2026-05-27 | 🔧 Maintenance / performance |
| [Feature 29](./ROADMAP.md#feature-29--spike-swap-gorhombottom-sheet-for-sdk-56s-drop-in-replacement) — bottom-sheet replacement spike | 🟢 Low | 🟢 P3 | 🔵 S | ❌ No — `@gorhom/bottom-sheet` remains the active dependency | 52d · 2026-05-27 | 🔧 Maintenance / dependency |
| [Feature 30](./ROADMAP.md#feature-30--build-time-warning-cleanup-ship-121-follow-ups) — build warning cleanup | 🟢 Low | 🟢 P3 | 🔵 S | 🟡 Partial — Fastlane is now 2.236.1 and SDK moved to 57; remaining warning acceptance is undocumented | 48d · 2026-05-31 | 🔧 Maintenance |
| [Feature 31](./ROADMAP.md#feature-31--reuse-the-fly-demo-server-as-a-stable-backend-for-maestro-and-visual-regression-tests) — reuse Fly demo server | 🟢 Low | 🟢 P3 | 🟡 M | ♻️ Re-scoped/obsolete — `demo-server/` no longer exists; demo Maestro flows remain separate | 47d · 2026-06-01 | 🔧 Maintenance / infrastructure |
| [Feature 32](./ROADMAP.md#feature-32--handle-batched-conversation_events-ws-event) — batched conversation WS events | 🟡 High | 🟢 P3 | 🟢 XS docs | ✅ Yes — WS union and shared batch handler are present | 23d · 2026-06-25 | 🐛 Bug / compatibility |
| [Feature 33](./ROADMAP.md#feature-33--repair-stale-demo-server-yaml-e2e-flows-selector-drift--maestro-2x-syntax) — repair demo E2E selectors | 🔵 Medium | 🟡 P1 | 🟢 XS verification | 🔎 Code present in `c9ac740`; green demo run still required | 18d · 2026-06-30 | 🔧 Maintenance / test |
| [Feature 34](./ROADMAP.md#feature-34--structured-prompt-cards-for-codex-sessions) — Codex structured prompts | 🟢 Low | 🟢 P3 | 🔴 L | ❌ No on mobile `main`; explicitly streamer-side | 14d · 2026-07-04 | 📋 Task / cross-repo |
| [Feature 35](./ROADMAP.md#feature-35--decide-the-crash-reporting-consent-model-auto-init-vs-explicit-only) — crash-report consent model | 🟡 High | 🔴 P0 | 🔵 S | ❌ No — current one-shot crash and feedback paths still use different consent behavior | 5d · 2026-07-13 | 🧭 Other / product decision |
| Feature 36 — validate privacy checklist and crash-reporting UX recommendation | 🔴 Critical | 🔴 P0 | 🟡 M | 🟡 Partial — core sanitizer/config code exists; production, legal, push, speech, and store checks remain open | 2d · 2026-07-16 | 🔧 Maintenance / privacy |

## 🆕 Verification finding not yet tracked in either source

| Item | Estimated severity level | Estimated priority level | Estimated effort | Already implemented on main? | Age | Type |
|---|---:|---:|---:|---|---:|---|
| Expo Router typed-route errors: nine `string` → `Href` failures across navigation call sites | 🟡 High | 🔴 P0 | 🔵 S | ❌ No — `npm run typecheck` fails on current `main` | ≤6d · introduced across 2026-07-12–17 | 🐛 Bug / CI |

Affected files: `app/_layout.tsx`, `app/index.tsx`, `app/session/[id].tsx`, `components/conversation/ConversationList.tsx`, `components/sessions/hub/ProjectHubList.tsx`, and `components/sessions/tree/TreeSessionsList.tsx`.

## ✅ Verification performed

| Check | Result |
|---|---|
| `git fetch origin main --prune` | ✅ Current checkout equals `origin/main` at `94145f1` |
| `npx eslint . --max-warnings=0` | ✅ Passed |
| `npm run test:ci -- --runInBand` | ✅ 107 suites; 1,038 passed; 1 skipped |
| `npm run typecheck` | ❌ Failed with nine typed-route errors |
| `git diff --check` | ✅ Passed |
| Working tree before report creation | ✅ Clean |
| Native Maestro release suite | ⚠️ Not run: `e2e/check-sim.js` found no booted iOS simulator; the repo's own remaining-work report documents unresolved failures and a Browse crash |

The Jest run also emitted non-fatal test-harness warnings (overlapping/unwrapped `act`, one missing child key, Watchman recrawl noise, and forced exit from open handles). They do not fail the suite, but should be cleaned up after the P0 release gates.

## 🎯 Recommended pre-release sequence

1. 🔴 Fix the nine type errors, then rerun Type check, lint, and Jest.
2. 🔴 Reproduce the Browse Maestro crash and get `test:e2e:mock` green on the supported simulator; include or explicitly defer `server_drag_reorder` and `tree_server_headers` with a recorded decision.
3. 🔴 Choose Feature 35's consent model and complete Feature 36's production/privacy/store checks, including raw Sentry-event inspection.
4. 🟡 Run physical-device smoke checks for new-session navigation, two-file attachment send/response, Hub expansion on a large project, abandoned-empty-session behavior, QR pairing, search-anchor navigation, and theme switching.
5. 🟢 Reconcile `BACKLOG.md` and `ROADMAP.md`: close or rewrite stale entries so the next release review starts from current truth.
