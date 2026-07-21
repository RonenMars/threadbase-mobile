# Combining in-flight PRs into one verification build — best-practice research

**Question researched:** what is the common/popular, industry-standard way to take several *open, not-yet-merged* pull requests, combine them into a single build, deploy that build to verify the changes work together, and identify/trigger it cleanly — before merging each PR individually?

This is adjacent to version management but is really its own discipline: **pre-merge integration verification** (a.k.a. "combined QA builds", "release-candidate integration").
Below are the three most relevant established practices for *our* case (a small-team Expo / React-Native app that ships to TestFlight & Play, opens several PRs against `main`, and wants a named, easy-to-deploy combined snapshot), sorted by fit, followed by two adjacent patterns worth knowing and a concrete recommendation.

---

## TL;DR ranking

| # | Practice | What it gives us | Why this rank for our case |
|---|----------|------------------|----------------------------|
| 1 | **Integration / QA snapshot ref** (branch *or* immutable tag) | One buildable ref that contains all the open PRs | It is *exactly* what we already do (the `merge-open-prs` worktree + `test-<env>/…` tag). Canonical, zero new infra, works with our existing `deploy_ref`. |
| 2 | **Build-once / promote-many with an immutable RC identifier** (SemVer pre-release + build metadata) | A stable *identity* for the snapshot and a way to move the same artifact through dev → pre-release → prod | This is the "version-management-but-not-exactly" layer we intuited; it justifies the tag-over-branch decision and maps to our dev/pre-release/production envs. |
| 3 | **Expo per-PR EAS Update channels + internal distribution** | One installed binary; testers flip between PR bundles from an in-app picker ("dropdown") with no rebuild | Mobile-native and uncannily close to the "pick the deployed thing from a dropdown" wish — but OTA-only, so it complements rather than replaces a real combined build. |

Adjacent (not top-3 for us, but where this evolves): **GitHub Merge Queue** and **Trunk-Based Development + feature flags**.

---

## 1. Integration / QA snapshot ref — combine the PRs into one buildable ref

**The pattern.** Create a single throwaway ref that merges all the in-flight PR branches together, point CI at it, and build/deploy from it. This is the textbook answer to "test several features together before release." The build/integration branch "is used to test code with other features and components, is usually locked down from developers, and merges are automatically made using your build automation tool" ([Perforce](https://www.perforce.com/blog/vcs/how-set-your-ci-cd-branching-strategy)). A common concrete form is a **"running QA branch"** that "collect[s] all completed features that are flagged for inclusion in the next release" ([branch-per-feature](https://github.com/affinitybridge/git-bpf/wiki/Branch-per-feature-process)).

**Why it's #1 for us.** It's precisely our current practice — the `merge-open-prs` worktree that fast-forwards/merges every open PR — and it needs no new tooling: our `deploy.yml` already takes a `deploy_ref`, so the snapshot ref *is* the deploy target.

**Best-practice refinements that matter here:**
- **Prefer an immutable *tag* over a long-lived *branch* as the deploy target.** A branch invites "just one more commit" and drifts; a tag is a frozen point-in-time snapshot — which is the decision we already landed on (`test-<env>/v<version>-<sha>-<date>`). See §2 for why immutability is the important property.
- **Treat it as throwaway and short-lived.** The integration ref is disposable; delete it once the constituent PRs merge individually. Long-lived integration branches are where "merge hell" and stale-drift bugs breed ([JetBrains](https://www.jetbrains.com/teamcity/ci-cd-guide/concepts/branching-strategy/)).
- **Re-cut it whenever a constituent PR changes.** The snapshot is only trustworthy against the exact commits it captured; if PR #345 gets new commits, the old snapshot no longer represents reality.
- **Rebase constituents on `main` first.** "Regularly merge the main branch into each feature branch to keep them up-to-date" so the combined build reflects what will actually land ([GitHub best practices](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/best-practices-for-pull-requests)).

**Limitation.** It's a manual, point-in-time act — it answers "do these N PRs work together *right now*", not "will PR X still be safe after PR Y merges." That continuous guarantee is what Merge Queue (below) automates.

---

## 2. Build-once / promote-many with an immutable release-candidate identifier

**The pattern.** Give the snapshot a **stable, immutable identity**, build the artifact **once**, and **promote the same bytes** across environments instead of rebuilding per environment. "A build artifact is the immutable, versioned package a CI pipeline produces — built once, deployed unchanged to every environment from staging to prod" ([deployment.to](https://glossary.deployment.to/artifact/)). Rebuilding per environment "introduces risk … build tools change, dependencies update, and network issues cause subtle differences" ([oneuptime](https://oneuptime.com/blog/post/2026-01-30-artifact-promotion/view)); promotion is "metadata — a tag move, a route update — not a rebuild."

**Why this is the "version management, but not exactly" layer we sensed.** SemVer already has purpose-built slots for exactly this snapshot-identity problem ([semver.org](https://semver.org/)):
- **Pre-release** identifier (`1.0.0-rc.1`) — "indicates that the version is unstable and might not satisfy the intended compatibility requirements." This is the right tag for a release *candidate*.
- **Build metadata** (`+<sha>` / `+20260720`) — "MUST be ignored when determining version precedence. Thus two versions that differ only in the build metadata have the same precedence." This is *exactly* the right home for a throwaway snapshot's git SHA and date: it identifies the build without pretending to be a new version. Canonical example from the spec: `1.0.0-beta+exp.sha.5114f85`.

So a fully SemVer-aligned name for our snapshot would be, e.g., `1.0.0-rc.1+bfc800d.20260720` — the `-rc.1` says "candidate", the `+bfc800d.20260720` says "this exact build" without affecting ordering. Our chosen `test-<env>/v1.0.0-bfc800d-2026-07-20` carries the same three facts (version, sha, date) in a git-ref-legal form, which is a reasonable pragmatic adaptation.

**Why immutability argues for a tag (reinforces §1's decision).** Promotion works by *moving the same artifact forward*; that only makes sense if the source ref can't change underneath you. A tag is immutable-by-convention; a branch is a moving pointer. This is the core reason to pick a tag as the deploy target — and it maps directly onto our `dev` / `pre-release` / `production` env taxonomy: one snapshot, built once, promoted through those three gates.

**Limitation for our exact case.** Classic RC promotion assumes the candidate is cut from an *already-integrated* mainline. Ours is a candidate assembled from *un-merged* PRs, so it's a slightly unusual hybrid: use the RC *identity + promotion discipline* from this practice, but source the commit from the §1 integration snapshot rather than from `main`.

---

## 3. Expo per-PR EAS Update channels + internal distribution (the mobile-native "dropdown")

**The pattern.** Because we're on Expo, there's a mobile-native answer that maps startlingly well onto the "pick the deployed thing from a dropdown" wish. EAS **internal distribution** produces one installable binary shared via a URL ([Expo docs](https://docs.expo.dev/build/internal-distribution/)); EAS **Update channels** then let that one binary receive different JS/asset bundles. For multiple PRs, "you might set your channel … to `preview-feature-a` … then `preview-feature-b`", and — the key part — since **expo-updates v29 (Aug 2025)** an app can **switch which channel it talks to at runtime** ("channel surfing"), so "one internal binary [lets] any tester … flip between every open PR's branch in seconds" via an **in-app channel picker**, with the CI/CD pipeline publishing a channel per PR ([Expo preview docs](https://docs.expo.dev/eas-update/preview/), [MAAI Software](https://maaisoftwareinc.ca/en/blog/mobile-engineering/channel-surfing-expo-updates)). That in-app picker *is* a dropdown of deployable versions.

**Why it's relevant but ranked #3.**
- It's the closest thing to a literal "dropdown of what to deploy," and it's the fastest inner loop — no new store build per PR.
- **But it's OTA-only.** EAS Update ships JS and assets bound to a **runtime version**; channel surfing is explicitly for "cases where the app runtime doesn't change often" ([Expo preview docs](https://docs.expo.dev/eas-update/preview/)). **Native changes — new pods, config-plugin changes, native config — still require a fresh build.** This repo carries a lot of hand-maintained native config (the `ios/Podfile` hooks, Android heap/bouncycastle pins, Sentry native config), so a meaningful share of our PRs touch native code and can't be verified by an update alone.
- It also tends to test PRs *individually per channel* rather than all-combined-into-one (though a combined channel is possible).

**Net:** adopt it as the fast path for JS-only PRs, but keep a §1/§2 snapshot *build* for anything touching native.

---

## Adjacent patterns worth knowing (not top-3 for us)

### GitHub Merge Queue — the automated evolution of "test the combination before merge"
Native to GitHub. When PRs enter the queue, it "group[s] [changes] into a `merge_group` with the latest version of the `base_branch` as well as changes from pull requests ahead of it," creates temporary `gh-readonly-queue/{base}` refs, runs required checks on that combination, and merges FIFO — "every pull request is automatically tested on top of all the pull requests that came before it" ([GitHub docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [Mergify](https://mergify.com/product/merge-queue)).
**Why not #1 for us:** it *gates and performs real merges* against automated required checks; it does not hand you a throwaway, human-QA'd mobile artifact you name and deploy. It's the right thing to adopt when "does the combination pass CI" matters more than "does the combined build feel right on a device," i.e. as the team/PR-volume grows.

### Trunk-Based Development + feature flags — the pattern that dissolves the need
The modern-CI "north star": instead of combining un-merged branches, integrate every change to trunk continuously behind a **feature flag** (dark launch), then test on trunk with flags toggled. "Instead of branching off … code can be committed directly to the main branch, but kept inactive under the feature flag until it's ready" ([Flagsmith](https://www.flagsmith.com/blog/trunk-based-development-feature-flags)). If there are never long-lived un-merged PRs, there's nothing to combine.
**Why not #1 for us:** it "require[s] fast CI, feature flags, and frequent integration [as] prerequisites — not nice-to-haves" ([Atlassian](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development)), plus flag infrastructure and discipline we don't have today. Worth treating as the direction to grow toward.

---

## Recommendation for this repo

1. **Keep #1 as-is** — the immutable `test-<env>/…` snapshot tag combining open PRs is the correct, standard mechanism, and it's already wired to `deploy.yml`'s `deploy_ref`.
2. **Layer #2's discipline on top** — build the snapshot artifact once and *promote* the same build through dev → pre-release → production rather than rebuilding per env; keep the SemVer intuition (`-rc.N` = candidate, `+<sha>.<date>` = build id that doesn't affect precedence) in mind when naming.
3. **Use #3 (Expo channels) as the fast inner loop** for JS-only PRs, but always fall back to a snapshot *build* when a PR touches native config.
4. **Revisit Merge Queue** once PR volume or contributor count grows enough that "keep `main` always-green under combination" outweighs the manual snapshot's simplicity.

---

## Sources

- Perforce — [How to set up your CI/CD branching strategy](https://www.perforce.com/blog/vcs/how-set-your-ci-cd-branching-strategy)
- Branch-per-feature process — [running QA branch](https://github.com/affinitybridge/git-bpf/wiki/Branch-per-feature-process)
- JetBrains TeamCity — [Branching strategies for CI/CD](https://www.jetbrains.com/teamcity/ci-cd-guide/concepts/branching-strategy/)
- GitHub Docs — [Best practices for pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/best-practices-for-pull-requests)
- deployment.to — [What is a build artifact in CI/CD?](https://glossary.deployment.to/artifact/)
- OneUptime — [How to create artifact promotion](https://oneuptime.com/blog/post/2026-01-30-artifact-promotion/view)
- Medium (Aslam Thachapalli) — [Build once, deploy many](https://medium.com/@aslam.develop912/build-once-deploy-many-the-core-ci-cd-principle-youre-probably-missing-d9fcdc34a854)
- Semantic Versioning 2.0.0 — [semver.org](https://semver.org/)
- Expo Docs — [Internal distribution](https://docs.expo.dev/build/internal-distribution/), [Preview updates](https://docs.expo.dev/eas-update/preview/)
- MAAI Software — [Channel surfing: test every PR's bundle without a new TestFlight build](https://maaisoftwareinc.ca/en/blog/mobile-engineering/channel-surfing-expo-updates)
- GitHub Docs — [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- Mergify — [Merge Queue for GitHub](https://mergify.com/product/merge-queue)
- Atlassian — [Trunk-based development](https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development)
- Flagsmith — [Feature flags for trunk-based development](https://www.flagsmith.com/blog/trunk-based-development-feature-flags)
