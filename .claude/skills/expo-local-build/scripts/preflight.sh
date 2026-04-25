#!/usr/bin/env bash
# preflight.sh — non-interactive prerequisite check for the ship pipeline.
#
# Runs every check in turn, prints PASS/FAIL per row, exits non-zero on the
# first failure with a remediation hint. Call from CI, ship.sh, or a
# developer's terminal.
#
# Usage:
#   ./scripts/preflight.sh                  # iOS-only by default
#   PLATFORM=android ./scripts/preflight.sh # Android-only
#   PLATFORM=both    ./scripts/preflight.sh # both
#   SKIP_SECRETS=1   ./scripts/preflight.sh # skip 1Password / ASC checks

set -euo pipefail

PLATFORM="${PLATFORM:-ios}"
SKIP_SECRETS="${SKIP_SECRETS:-0}"

ok=0; fail=0
log_pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; ok=$((ok + 1)); }
log_fail() { printf '  \033[31m✗\033[0m %s\n     fix: %s\n' "$1" "$2"; fail=$((fail + 1)); }

check() { # check "label" "command" "fix-hint"
  if eval "$2" >/dev/null 2>&1; then log_pass "$1"; else log_fail "$1" "$3"; fi
}

echo "▸ Toolchain"
check "Node.js >= 18"             "node -v | grep -E '^v(1[89]|[2-9][0-9])\.'" "brew install node || nvm install 20"
check "Watchman installed"        "command -v watchman"                        "brew install watchman"
check "Expo CLI reachable"        "npx --no-install expo --version"            "npm i || yarn || pnpm i (lockfile present)"
check "jq installed"              "command -v jq"                              "brew install jq"
check "openssl available"         "command -v openssl"                         "ships with macOS — broken install?"

if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
  echo
  echo "▸ iOS toolchain"
  check "Xcode CLT installed"     "xcode-select -p"                            "xcode-select --install"
  check "iOS SDK present"         "xcrun --sdk iphoneos --show-sdk-path"       "xcodebuild -downloadPlatform iOS"
  check "Simulator runtime"       "xcrun simctl list runtimes -j | jq -e '.runtimes[] | select(.name | startswith(\"iOS\"))'" "xcodebuild -downloadPlatform iOS"
  check "CocoaPods installed"     "command -v pod"                             "sudo gem install cocoapods (or brew install cocoapods)"
fi

if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
  echo
  echo "▸ Android toolchain"
  check "ANDROID_HOME set"        "[[ -n \${ANDROID_HOME:-} && -d \$ANDROID_HOME ]]" "export ANDROID_HOME=\$HOME/Library/Android/sdk in ~/.zshrc"
  check "JAVA_HOME points at 17"  "[[ -n \${JAVA_HOME:-} ]] && \${JAVA_HOME}/bin/java -version 2>&1 | grep -q 'version \"17'" "export JAVA_HOME=\$(/usr/libexec/java_home -v 17)"
  check "AVD configured"          "[[ -n \"\$( [[ -d \${ANDROID_HOME:-}/emulator ]] && \${ANDROID_HOME}/emulator/emulator -list-avds 2>/dev/null )\" ]]" "avdmanager create avd -n Pixel_API_34 -k 'system-images;android-34;google_apis;arm64-v8a' -d pixel"
fi

echo
echo "▸ Project"
check "app.json exists"           "[[ -f app.json ]]"                          "run from project root"
check "ios.bundleIdentifier set"  "jq -e '.expo.ios.bundleIdentifier' app.json" "set expo.ios.bundleIdentifier in app.json"
check "Lockfile present"          "[[ -f package-lock.json || -f yarn.lock || -f pnpm-lock.yaml || -f bun.lockb || -f bun.lock ]]" "commit your package manager's lockfile"

if [[ "$SKIP_SECRETS" != "1" ]]; then
  echo
  echo "▸ Ship secrets (set SKIP_SECRETS=1 to bypass)"
  check "1Password CLI installed" "command -v op"                              "brew install --cask 1password-cli"
  check "1Password signed in"     "op whoami"                                  "eval \"\$(op signin)\" — or set OP_SERVICE_ACCOUNT_TOKEN for CI"
fi

echo
if (( fail == 0 )); then
  printf '\033[32m%d/%d checks passed.\033[0m\n' "$ok" "$((ok + fail))"
  exit 0
else
  printf '\033[31m%d/%d checks failed.\033[0m Fix the rows marked ✗ then re-run.\n' "$fail" "$((ok + fail))"
  exit 1
fi
