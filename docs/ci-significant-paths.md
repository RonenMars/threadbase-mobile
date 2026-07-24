# CI-Significant Paths

The canonical list of folders and files that affect **app functionality**, **tests**, or **CI**.

Used by the `commit-msg` git hook (`scripts/git-hooks/commit-msg`): when a commit
touches **none** of these paths, the hook appends `[skip-ci]` to the commit title and
body. The CI gate (`.github/workflows/test.yml`) greps the commit message for the
bracketed `[skip-ci]` tag and skips the heavy jobs (typecheck / unit / integration /
lint), reporting the required checks green in seconds.

CI runs: `tsc --noEmit` (all `.ts`/`.tsx`), jest (`test:unit` / `test:integration` /
`test:scripts`), `eslint "**/*.{ts,tsx}"`. Deploy ships via `scripts/`.

The machine-readable source of truth is **`scripts/git-hooks/ci-paths.txt`** — one
glob/prefix per line. Edit that file to change what counts; this doc explains it.

## Affects functionality / tests / CI

### Requested base list

- `app/` — app entry + routing; imports all feature screens
- `.github/` — CI/CD workflows + composite actions (defines every CI job)
- `app.json` — Expo config (version, build number, plugins, native config, icon paths)
- `android/` — native Android project (tracked; input to `ship-android.sh`)
- `ios/` — native iOS project (tracked; input to `ship-ios.sh`)
- `e2e/` — Maestro flows + mock servers (monthly CI e2e job)
- `package.json` / `package-lock.json` — deps + npm scripts; reproducible builds

### Found by scan — also affects functionality / tests / CI

Source dirs (consumed at runtime or by tests):

- `components/` — UI components
- `hooks/` — React hooks
- `services/` — API clients, WebSocket manager
- `stores/` — Zustand state
- `constants/` — theme/colors/UI constants
- `contexts/` — React context providers
- `types/` — TS API type defs
- `lib/` — utility libraries
- `utils/` — shared utilities
- `locales/` — i18n JSON, imported at runtime
- `plugins/` — Expo config plugins
- `assets/` — icons referenced by `app.json`

Tests + test infra:

- `__tests__/` — jest unit/integration suites (run in CI)
- `__mocks__/` — jest mocks
- `test-utils/` — shared test helpers

Build / lint / type config (any change can flip CI):

- `tsconfig.json` — TS compile config (strict, path aliases, includes)
- `babel.config.js` — Babel transpilation (test + prod)
- `metro.config.js` — Metro bundler (NativeWind, polyfills)
- `jest.setup.js` — global jest mocks + setup
- `jest.config.scripts.js` — config for `test:scripts`
- `eslint.config.js` — lint config (CI `lint` job)
- `tailwind.config.js` — NativeWind content paths
- `react-native.config.js` — RN autolinking fix
- `global.css` — Tailwind global import
- `nativewind-env.d.ts` — NativeWind type decls

Native / deploy pipeline:

- `scripts/` — build/deploy/signing/version scripts (deploy workflow)
- `fastlane/` — iOS TestFlight lanes (invoked by `ship-ios.sh`)
- `eas.json` — EAS build config
- `Gemfile` — Ruby deps for Fastlane + CocoaPods
- `patches/` — patch-package fixes applied to node_modules on install (e.g. iOS build fixes for vendored native/Swift sources); a patch can go stale or start/stop applying without any package.json change

## Does NOT affect (excluded from the trigger list)

- Docs / notes: `docs/`, `README.md`, `DESIGN.md`, `CLAUDE.md`, `AGENTS.md`,
  `TESTFLIGHT.md`, `DEPLOYMENT-SUMMARY.md`, `LICENSE`, `onboarding/` (design docs)
- Build artifacts / binaries: `build/`, `*.ipa`, `*.dSYM.zip`, `ThreadbaseMobile.zip`,
  `crash-log.txt`, `d.crash`
- Local state / caches (mostly gitignored): `node_modules/`, `.expo/`, `logs/`,
  `.claude/`, `.agents/`, `.codex/`, `.serena/`, `.remember/`, `.scratch/`,
  `.worktrees/`, `.playwright-mcp/`, `vendor/`, `.bundle/`, `progress/`,
  `.threadbase-uploads/`, `testflight_feedback_tmp/`, `design/` (prototyping only)

### Gitignored — can never be staged, so deliberately omitted

These the scan flagged as "affects," but `.gitignore` keeps them out of every commit,
so a commit-msg hook never sees them: `.env`, `.env.prod`, `.env.signing`,
`.env.signing.android`, `.mcp.json`, `Gemfile.lock`, `expo-env.d.ts`. Template/meta
files that are committed but inert: `.env.example`, `.mcp.example.json`, `.nvmrc`,
`.gitignore`, `.github/dependabot.yml` are left out of the trigger list because a
change to them alone does not change app behavior, tests, or CI execution.
