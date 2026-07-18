
## 21:16 | main
Updated privacy policy URLs in threadbase-landing-page (PR #61 opened: biometric auth clarification across 4 locales en/he/ru/ar) + fixed Play Console privacy URL from `https://threadbase.sh/privacy` → `https://threadbase.sh/privacy-policy` to match iOS correction.
## 21:20 | main
Verified Play Console privacy URL fix (`/privacy` → `/privacy-policy`) persists correctly; discovered & auditing gap: Sentry crash logs + optional feedback email should be declared in Play Data Safety form (currently under-declared), delegated code audit to confirm exact data fields + mapping to Play categories.
## 23:53 | feat/cache-warmup-status
Added npm script to reset cache, reinstall deps, rebuild pods, accept device UDID as positional arg, and run native tunnel mode in single command.
## 00:41 | feat/cache-warmup-status
Created `dev-tunnel-native-reset` npm script + bash impl that clears Metro cache, reinstalls node_modules/Pods, runs native tunnel; committed to new worktree branch `chore/dev-tunnel-native-reset`, merged as PR #344, then merged PRs #331, #332, #342 in sequence.