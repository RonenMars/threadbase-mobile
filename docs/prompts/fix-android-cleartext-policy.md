# Prompt — decide and implement the Android cleartext policy (#727)

Hand this to a fresh agent session opened in `~/dev/ai-tools/tb-mobile`.

> **Work in a new git worktree, outside the repo root.** Sibling directory, e.g. `../tb-mobile-worktrees/android-cleartext-policy`, never nested inside the checkout — repo-root tools walk into a nested worktree and report phantom results. Run your own `npm ci` in it.
>
> Read [#727](https://github.com/RonenMars/threadbase-mobile/issues/727) in full first. It is the canonical description and it already contains the decision framing; this file is context the issue does not carry.

---

## The defect, confirmed

An Android **release** build cannot open a plain-HTTP connection to any host. Pairing to `http://192.168.x.x:8766` — the app's primary documented flow, and the example the onboarding copy gives — fails with a generic "Could not reach that server", and **no request reaches the server at all**.

`versionCode 54` is on the Play alpha track carrying this.

This was confirmed on hardware on 2026-08-15, not inferred. On a physical Xiaomi 11 Lite, in the same two minutes: Chrome fetched `http://192.168.68.102:8766/healthz` and the server logged a `200` with the Android Chrome UA; the app's pair exchange against the same address produced **nothing** server-side; and `https://tb.rbv1000.win` worked with `okhttp/4.9.2` requests logged. The only variable is the scheme.

The mechanism: `usesCleartextTraffic="true"` is set only in `android/app/src/debug/AndroidManifest.xml:6` and `src/debugOptimized/AndroidManifest.xml:6`, both build-type source sets that never merge into a release build. `src/main/AndroidManifest.xml` sets neither that nor `networkSecurityConfig`. At `targetSdkVersion` 36 the platform default is cleartext denied. Every developer build permits it, which is why this survived months of development.

## What this is *not*

Do not connect this to the Android E2E suite. On 2026-08-15 the Maestro flows were failing for an unrelated reason — `${E2E_MOCK_SERVER_URL}` was never substituted, so the app dialled the literal host `undefined` — fixed in #735. An earlier diagnosis blamed cleartext for those failures and was wrong. If you find yourself reasoning from E2E results, stop.

## The decision this needs before any code

**This is a policy call, not a manifest edit.** Three options, laid out in #727:

- **(a) `cleartextTrafficPermitted="true"` in `base-config`** — restores the documented flow. A security review on 2026-08-15 recommended this, on the grounds that the app exists to reach servers the user runs themselves; requiring TLS on a home server does not harden that flow so much as delete it, and pushes users onto the tunnel where traffic passes through a third party in plaintext by design.
- **(b) Permit private ranges only** — **not expressible.** Android's `<domain>` matching is hostname-based with no CIDR support; emulating it needs a runtime trust manager, which is a larger hazard than the thing it guards.
- **(c) Require HTTPS** — defensible, but it removes `http://192.168.x.x` as a supported path and the onboarding and add-server copy must change with it.

If (a) is chosen, three things travel with it and are not optional: `http://` servers marked as unencrypted **persistently** in the server list and at pairing rather than behind a dismissible warning; application-layer encryption named as the actual protection (#698, `threadbase-streamer#590`, with the per-server control in `threadbase-streamer#591`); and the decision written down with its reasoning so the next reader of the manifest does not "fix" it.

**Surface the choice and its consequences, and let the repo owner decide.** Do not pick silently.

## Constraints that will cost you time if you rediscover them

An earlier, unlanded attempt is archived at `docs/archive/2026-08-15-android-loopback-cleartext-attempt.md`. **Read it before writing any config.** It is obsolete as a fix — it permits only `localhost`, `127.0.0.1` and `10.0.2.2`, which helps no real user — but its findings hold:

- **A network security config overrides `usesCleartextTraffic` entirely.** Putting one in `src/main/` silently revokes the blanket cleartext the debug variants rely on, breaking local development in a way that looks unrelated.
- **`npx expo prebuild` regenerates `android/` and drops hand edits without a word.** An Expo config plugin that writes the files is the durable form; `plugins/` already holds several. Commit the plugin, its output, and a test asserting the plugin is registered.
- **Verify into the artifact, not the source.** `aapt2 dump xmltree --file AndroidManifest.xml` on the built APK, and `aapt2 dump resources` to resolve the config reference, is how the archived attempt proved the policy actually shipped through R8 and resource shrinking.

## Also needed, whatever the policy

A blocked cleartext request currently surfaces as a generic "Could not reach that server", which is unguessable and cost two sessions' worth of misdiagnosis. Android raises `java.io.IOException: Cleartext HTTP traffic to <host> not permitted`, detectable at a single boundary — `services/authed-fetch.ts`, which became the one fetch seam in #701. Shape a distinct error like the existing `AuthError` in that file, carrying the remedy ("use https:// or the tunnel"). #720 covers the render-site pattern for typed failures.

`TROUBLESHOOTING.md` already documents the symptom and how to tell it apart from a network fault; update it once the behaviour changes.

## Verification

**A green E2E suite proves nothing here.** The Maestro mock server sits at `http://10.0.2.2:7071`, so a fix scoped to loopback leaves the suite green and every real user broken.

The bar is a physical Android device running a release build, pairing over `http://` to a LAN address, with the request appearing in the streamer's log. If you cannot test on hardware, say so plainly rather than implying the change is verified.

Also confirm you have not broken the debug path: a debug build must still reach cleartext hosts.

## Gates

`npm run lint` (0 errors; warnings are fine), `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:i18n`, `npm run test:scripts`.

## Environment traps

- **`npm ci` intermittently produces a partial install** — packages land with `build/` and `LICENSE` but no `package.json`, surfacing as `Cannot find module 'eslint/config'` or `MODULE_NOT_FOUND … jest-util`. Fix: `rm -rf node_modules && npm ci`. It happened five times on 2026-08-15; it is not a real failure.
- **`npm ci` sometimes leaves a stray `versionCode` bump** in `app.json` and `android/app/build.gradle`. Not yours — `git checkout --` those and keep them out of the diff.
- Use the absolute git binary `/opt/homebrew/bin/git`; a shell function shadows `git`.
- If you run `expo prebuild` at all it must be `--no-clean`, or it wipes the hand-maintained native config.

## Workflow

```bash
git -C ~/dev/ai-tools/tb-mobile fetch origin
git -C ~/dev/ai-tools/tb-mobile worktree add ../tb-mobile-worktrees/android-cleartext-policy -b fix/android-cleartext-policy origin/main
cd ~/dev/ai-tools/tb-mobile-worktrees/android-cleartext-policy
npm ci
```

Then: surface the decision, implement what is chosen, run the gates, `npx eslint` the staged files, and open a PR against `main`. One sentence per line in the PR body. No AI attribution anywhere. State plainly what you verified and what you did not.
