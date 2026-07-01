#!/usr/bin/env bash
# Regenerate a functional .env.signing for LOCAL ships by pulling the ASC secrets from
# 1Password (op CLI). The Distribution cert is read from the login keychain and the
# App Store provisioning profile from Xcode's local cache — neither the .p12 nor the
# .mobileprovision live in 1Password, and they don't need to.
#
# Nothing secret is written to disk except the .p8 / .env.signing that
# bootstrap-ios-signing.sh already produces (both gitignored).
#
# Setup:
#   1. cp scripts/.env.signing-op.example scripts/.env.signing-op   (gitignored)
#      then edit it so OP_VAULT / OP_ITEM / OP_*_FIELD point at YOUR 1Password entry.
#   2. op signin        (or eval "$(op signin)")
#   3. ./scripts/bootstrap-local-signing-op.sh
#   4. source .env.signing && npm run ship:ios
#
# Where each piece comes from:
#   - ASC API key + issuer/team/key ids + the profile UUID: your 1Password item
#     (configured via scripts/.env.signing-op).
#   - Distribution cert: the login-keychain "Apple Distribution" identity — so we skip
#     the cert import.
#   - The .mobileprovision file: Xcode's local cache (re-downloadable from Apple).

set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

command -v op >/dev/null || { echo "1Password CLI (op) not installed: brew install 1password-cli" >&2; exit 1; }

# Load the op reference config (vault / item / field names). Not secret — just the map
# of where to read from. A committed *.example documents the shape; the real file is
# gitignored so each developer can point at their own vault without editing this script.
OP_CONFIG="scripts/.env.signing-op"
[[ -f "$OP_CONFIG" ]] || { echo "Missing $OP_CONFIG — copy scripts/.env.signing-op.example to it and set your vault/item names." >&2; exit 1; }
# shellcheck disable=SC1090
source "$OP_CONFIG"

: "${OP_VAULT:?set OP_VAULT in $OP_CONFIG}"
: "${OP_ITEM:?set OP_ITEM in $OP_CONFIG}"

op vault list >/dev/null 2>&1 || { echo "Not signed in to op. Run: eval \"\$(op signin)\"" >&2; exit 1; }

# op read helper: op://<vault>/<item>/<field>
opread() { op read "op://${OP_VAULT}/${OP_ITEM}/$1"; }

# ── ASC secrets + profile UUID from 1Password ───────────────────────────────────
export ASC_KEY_ID="$(opread "${OP_KEY_ID_FIELD:-key_id}")"
export ASC_ISSUER_ID="$(opread "${OP_ISSUER_ID_FIELD:-issuer_id}")"
export ASC_TEAM_ID="$(opread "${OP_TEAM_ID_FIELD:-team_id}")"
export ASC_AUTH_KEY_B64="$(opread "${OP_AUTH_KEY_B64_FIELD:-auth_key_b64}")"
export IOS_PROVISION_PROFILE_UUID="$(opread "${OP_PROFILE_UUID_FIELD:-provision_profile_uuid}")"

# ── Provisioning profile file: from Xcode's local cache (not stored in op) ───────
XCODE_PROFILE="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/${IOS_PROVISION_PROFILE_UUID}.mobileprovision"
DEST_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
if [[ -f "$XCODE_PROFILE" ]]; then
  mkdir -p "$DEST_DIR"
  cp "$XCODE_PROFILE" "$DEST_DIR/${IOS_PROVISION_PROFILE_UUID}.mobileprovision"
  echo "  Provisioning profile installed from Xcode cache: ${IOS_PROVISION_PROFILE_UUID}"
else
  echo "WARNING: profile ${IOS_PROVISION_PROFILE_UUID} not found in Xcode cache." >&2
  echo "  Open Xcode > Settings > Accounts > Download Manual Profiles, or re-run a device build, then retry." >&2
fi

# Distribution cert is already in the login keychain — leave IOS_DIST_CERT_* unset so
# bootstrap-ios-signing.sh skips its cert-import block and xcodebuild uses the keychain
# identity directly. RUNNER_TEMP is only referenced inside that (skipped) block, but set
# it anyway so `set -u` is happy if the block is ever entered.
export RUNNER_TEMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

./scripts/bootstrap-ios-signing.sh
echo
echo "✓ .env.signing regenerated. Next: source .env.signing && npm run ship:ios"
