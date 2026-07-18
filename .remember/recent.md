# Recent

```

# Recent

## 2026-07-17
Merged 10 PRs into `integration/all-prs` worktree (#324, #327, #326, #320, #323, #319, #322, #325, #328, #321); resolved step 9 conflict in `app/session/[id].tsx` per spec; fixed test failure via stable `mockQc` (9660f6b); checkpoint: tsc clean, 994/996 tests pass. Later attempted merge of 9 open PRs; #320 scope-crept to 10-commit feature relocating waking-UI, breaks step 9 conflict plan; paused for branch-state + reorder strategy confirm.

## 2026-07-16
Folded 6 mobile PRs (#303–313) into integration worktree; resolved conflicts, rebased 22 commits; tsc/jest 968/0 pass, E2E 7/12 (5 pre-existing flaky). Upgraded Maestro 2.0.10→2.6.1 (iOS 26.4); bumped MAX_SUPPORTED_IOS_MAJOR 18→26. Landed 7 branches rebase+squash to main (#316→#310); 961/972 local. Fixed browse→session nav race (#320), "Wait more" button (#321). Rebuilt conversation view on FlashList v2 native (removed JS orchestration, split components, fixed endless-skeleton via fetch-window keying, #323, 916/916). Added `Keyboard.dismiss()` to ChatComposer (#327). Mocked useQueryClient restart backstop (9660f6b, fix/waking-overlay-backstop ready).

## Identity Candidates
- IDENTITY CANDIDATE: Mobile PR folding campaign—aggressive merge-campaign under native FlashList patterns; conflict resolution via integration branch + worktree staging; scroll/modal race repair via backstop instrumentation + stable mock design.