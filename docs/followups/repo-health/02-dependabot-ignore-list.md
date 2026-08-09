# 02 — `dependabot.yml` has no `ignore` list

**Priority: high. Smallest change in this set — roughly six lines of YAML, no code.**

## State of play

`.github/dependabot.yml` is the stock file: npm, `/`, weekly, nothing else. So two structurally unmergeable PRs are re-raised indefinitely.

| PR | Bump | Why it cannot merge |
|----|------|---------------------|
| #557 | `jest` 29 → 30, `@types/jest` 29 → 30 | `jest-expo@57` depends on the jest 29 family (`babel-jest`, `jest-environment-jsdom`, `jest-snapshot`, all `^29.2.1`). npm hoists `jest-mock@29` under `jest-runtime@30`; every suite dies at `resetModules` with `this._moduleMocker.clearMocksOnScope is not a function`. **Zero tests run.** |
| #291 | `typescript` 6.0.3 → 7.0.2 | `@typescript-eslint/typescript-estree@8.61.0` declares `typescript >=4.8.4 <6.1.0`. TS 7 crashes it at load on `ts.Extension.Cjs`. |

Both were merged into an integration branch in early August and broke **every** PR targeting it until reverted by #577. They remain open against `main` and red for exactly these reasons — independent confirmation on a second branch.

**The visible error is not the cause.** Jest 30 renamed `--testPathPattern` → `--testPathPatterns`, so the jobs die at argument parsing first. Fixing only the flag moves the failure one step later into the runtime mismatch. Do not "fix" the scripts as a way of accepting the bump.

Equally: `tsc --noEmit` stays **green** under TS 7. "Type check passes" is not evidence that bump is safe — the break is in the lint toolchain.

## The change

```yaml
      ignore:
        - dependency-name: "jest"
          versions: ["30.x"]          # jest-expo@57 pins the jest 29 family
        - dependency-name: "@types/jest"
          versions: ["30.x"]
        - dependency-name: "typescript"
          versions: ["7.x"]           # outside @typescript-eslint peer range <6.1.0
```

Each entry lifts when the real constraint lifts — jest when Expo ships a jest-30 preset (an SDK upgrade, not a package bump), typescript when `eslint-config-expo` moves to a typescript-eslint that parses TS 7. Say so in a comment so a future reader knows what to watch for rather than deleting the pin on a hunch.

## Done when

- `.github/dependabot.yml` carries the ignore entries, each with its reason.
- #557 and #291 are closed.
- Neither reappears on the following weekly run. **Check this** — an `ignore` entry that does not match the dependency name silently does nothing.
