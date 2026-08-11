#!/usr/bin/env bash
# Revert ios/Podfile.lock when `pod install` only rewrote the four SPEC CHECKSUM
# entries that encode the checkout's absolute path.
#
# ExpoModulesCore, ExpoWidgets and hermes-engine generate their podspecs at install
# time and bake absolute paths into them (hermes-engine's HERMES_CLI_PATH, the
# precompiled ExpoModulesCore tarball `file://` URL, the ExpoWidgets bundle copy
# script). A pod's SPEC CHECKSUM is the SHA1 of its generated podspec, so those
# checksums are a function of *where* the repo is checked out: every worktree, every
# machine and every CI runner produces a different set. Committing them makes
# ios/Podfile.lock ping-pong between whoever ran pod install last, which is the usual
# source of checksum conflicts when rebasing.
#
# RNSentry behaves the same way and was missed when this list was first written. Across
# the last 30 revisions of the lockfile it alternates between exactly two checksums with
# its version pinned at 8.18.0 throughout, and one of the two appears only on
# `chore(ios): bump build number` commits — i.e. it tracks which machine ran pod install,
# not what the pod contains.
#
# A diff limited to those lines carries no information — a genuine pod change also moves
# that pod's version line — so it is safe to drop.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
LOCK="ios/Podfile.lock"

if git diff --quiet HEAD -- "$LOCK"; then
  exit 0
fi

# -U0 keeps only changed lines; the +++/--- file headers are not part of the change.
DRIFT=$(git diff -U0 HEAD -- "$LOCK" | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' || true)
NOISE='^[+-]  (ExpoModulesCore|ExpoWidgets|hermes-engine|RNSentry): [0-9a-f]{40}$'

if grep -qvE "$NOISE" <<<"$DRIFT"; then
  exit 0
fi

git checkout HEAD -- "$LOCK"

# `pod install` writes the same bytes to Pods/Manifest.lock, and Xcode's
# "[CP] Check Pods Manifest.lock" phase diffs the two. Reverting only the
# lockfile fails the archive with "The sandbox is not in sync with the
# Podfile.lock" — the checksums differ but the installed pods do not.
MANIFEST="ios/Pods/Manifest.lock"
if [[ -f "$MANIFEST" ]]; then
  cp "$LOCK" "$MANIFEST"
fi

echo "▸ reverted path-dependent SPEC CHECKSUM drift in $LOCK"
