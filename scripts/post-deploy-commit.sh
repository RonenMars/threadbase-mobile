#!/usr/bin/env bash
# post-deploy-commit.sh — run after a successful ship to:
#   1. Commit the version bump (app.json / build.gradle) on a new branch and push.
#   2. Check for other files modified during the pipeline (npm install, pod install, etc.)
#      and interactively offer to commit them too.
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

# Derive the version number used in both branch and commit message names.
if [[ "$PLATFORM" == "ios" ]]; then
  BUMP_NUMBER="$BUILD_NUMBER"
else
  BUMP_NUMBER="$VERSION_CODE"
fi

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

  # Return to original branch
  git checkout "$ORIGINAL_BRANCH"
  echo "  ✓ returned to '$ORIGINAL_BRANCH'"
fi

# ── Step 2: check for other dirty files ───────────────────────────────────────

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

git checkout -b "$EXTRA_BRANCH"
git add "${DIRTY_FILES[@]}"
git commit -m "$EXTRA_MSG"
git push -u origin "$EXTRA_BRANCH"

echo "  ✓ committed and pushed on branch '$EXTRA_BRANCH'"

git checkout "$ORIGINAL_BRANCH"
echo "  ✓ returned to '$ORIGINAL_BRANCH'"
