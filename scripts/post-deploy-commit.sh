#!/usr/bin/env bash
# post-deploy-commit.sh — run after a successful ship to:
#   1. Commit the version bump (app.json / build.gradle) on a new branch, open a
#      PR, and admin-squash-merge it into main (no manual step).
#   2. If other pipeline files are still dirty, do the same for a cleanup PR.
#
# In GitHub Actions, this script is a no-op: deploy.yml owns the bump PR +
# admin-merge after upload. Running both produced orphan chore/post-ship-*
# branches that never got a PR.
#
# Called by ship-ios.sh and ship-android.sh after upload succeeds.
#
# Usage:
#   ./scripts/post-deploy-commit.sh --platform ios --build-number 140 --version-bumped 1
#   ./scripts/post-deploy-commit.sh --platform android --version-code 20 --version-bumped 1

set -euo pipefail

PLATFORM=""
BUILD_NUMBER=""
VERSION_CODE=""
VERSION_BUMPED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)       PLATFORM="$2"; shift 2 ;;
    --build-number)   BUILD_NUMBER="$2"; shift 2 ;;
    --version-code)   VERSION_CODE="$2"; shift 2 ;;
    --version-bumped) VERSION_BUMPED="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$PLATFORM" ]] || { echo "ERROR: --platform required" >&2; exit 1; }

# CI deploy workflow commits the bump via an admin-merged PR; skip here so we
# do not leave orphan chore/post-ship-* branches with no PR.
if [[ "${GITHUB_ACTIONS:-}" == "true" || "${CI:-}" == "true" ]]; then
  echo
  echo "▸ post-deploy: skipping (CI) — deploy.yml owns the version bump PR + merge"
  exit 0
fi

# Derive the version number used in both branch and commit message names.
if [[ "$PLATFORM" == "ios" ]]; then
  BUMP_NUMBER="$BUILD_NUMBER"
else
  BUMP_NUMBER="$VERSION_CODE"
fi

# Open a PR for $1 and squash-merge it to main with --admin (owner can bypass
# required checks). Fails loudly if gh is missing or merge is refused.
open_and_merge_pr() {
  local branch="$1" title="$2" body="$3"
  if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: gh CLI required to land '$branch' on main automatically" >&2
    exit 1
  fi
  gh pr create --base main --head "$branch" --title "$title" --body "$body" \
    || echo "  PR already exists for $branch"
  gh pr merge "$branch" --squash --delete-branch --admin
  echo "  ✓ merged '$branch' into main"
}

# ── Step 1: commit the version bump ───────────────────────────────────────────

if (( VERSION_BUMPED == 0 )); then
  echo
  echo "▸ post-deploy: version was already at the correct value — no bump commit needed"
else
  echo
  echo "▸ post-deploy: committing version bump..."

  # Determine which files were bumped, the bump description, and the number
  # that goes into both the commit message and the branch name.
  if [[ "$PLATFORM" == "ios" ]]; then
    BUMP_FILES=("app.json")
    # Include Podfile.lock if pod install changed it during the pipeline
    [[ -n "$(git status --short ios/Podfile.lock)" ]] && BUMP_FILES+=("ios/Podfile.lock")
    BUMP_MSG="chore(ios): bump build number to ${BUILD_NUMBER} [skip-ci]"
  else
    BUMP_FILES=("app.json")
    GRADLE="android/app/build.gradle"
    [[ -f "$GRADLE" ]] && BUMP_FILES+=("$GRADLE")
    BUMP_MSG="chore(android): bump version code to ${VERSION_CODE} [skip-ci]"
  fi

  BRANCH="chore/bump-${PLATFORM}-version-${BUMP_NUMBER}"

  ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

  git checkout -b "$BRANCH"
  git add "${BUMP_FILES[@]}"
  git commit -m "$BUMP_MSG"
  git push -u origin "$BRANCH"

  echo "  ✓ bumped and pushed on branch '$BRANCH'"

  open_and_merge_pr "$BRANCH" "$BUMP_MSG" \
    "Automated version bump after successful ${PLATFORM} upload."

  # Return to original branch (bump branch may already be deleted by merge)
  git checkout "$ORIGINAL_BRANCH"
  git pull --ff-only origin main || true
  echo "  ✓ returned to '$ORIGINAL_BRANCH'"
fi

# ── Step 2: land any other dirty pipeline files on main ───────────────────────

# Collect modified tracked files, excluding build artifacts and the version
# files we already handled above.
DIRTY_FILES=()
while IFS= read -r line; do
  # git status --short: "XY filename" — skip untracked (??) and ignored (!!)
  status="${line:0:2}"
  file="${line:3}"
  [[ "$status" == "??" || "$status" == "!!" ]] && continue
  # Skip version bump files already committed above
  [[ "$file" == "app.json" ]] && (( VERSION_BUMPED )) && continue
  [[ "$file" == "android/app/build.gradle" ]] && (( VERSION_BUMPED )) && [[ "$PLATFORM" == "android" ]] && continue
  [[ "$file" == "ios/Podfile.lock" ]] && (( VERSION_BUMPED )) && [[ "$PLATFORM" == "ios" ]] && continue
  DIRTY_FILES+=("$file")
done < <(git status --short)

if [[ ${#DIRTY_FILES[@]} -eq 0 ]]; then
  echo
  echo "▸ post-deploy: no other modified files — all done."
  exit 0
fi

echo
echo "▸ post-deploy: the following files were modified during the pipeline:"
for f in "${DIRTY_FILES[@]}"; do
  echo "    $f"
done
echo

EXTRA_BRANCH="chore/post-ship-${PLATFORM}-${BUMP_NUMBER}"
EXTRA_MSG="chore(${PLATFORM}): post-ship cleanup [skip-ci]"

ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

git checkout -B "$EXTRA_BRANCH"
git add "${DIRTY_FILES[@]}"
git commit -m "$EXTRA_MSG"
git push -u origin "$EXTRA_BRANCH" --force-with-lease

echo "  ✓ committed and pushed on branch '$EXTRA_BRANCH'"

open_and_merge_pr "$EXTRA_BRANCH" "$EXTRA_MSG" \
  "Automated post-ship cleanup after successful ${PLATFORM} upload."

git checkout "$ORIGINAL_BRANCH"
git pull --ff-only origin main || true
echo "  ✓ returned to '$ORIGINAL_BRANCH'"
