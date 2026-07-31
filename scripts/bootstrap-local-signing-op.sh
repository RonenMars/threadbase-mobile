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
#   - ASC API key + issuer/team/key ids + both profile UUIDs: your 1Password item
#     (configured via scripts/.env.signing-op).
#   - Distribution cert: the login-keychain "Apple Distribution" identity — so we skip
#     the cert import.
#   - The .mobileprovision file: Xcode's local cache (re-downloadable from Apple).

set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

# --dry-run: report what every input resolves to and stop. Writes nothing — no .p8,
# no .env.signing, no profiles installed — so it is safe to run against real signing
# config at any time. Secret values are never printed, only whether they resolved.
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) echo "Usage: $0 [--dry-run]"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done
(( DRY_RUN )) && echo "▸ DRY RUN — nothing will be written"

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
# Reads one required field, naming the missing field rather than letting `op` fail
# with a bare error. Reports presence only — values are never echoed.
MISSING_FIELDS=0
require_field() {
  local var="$1" field="$2" value
  if ! value="$(op read "op://${OP_VAULT}/${OP_ITEM}/${field}" 2>/dev/null)" || [[ -z "$value" ]]; then
    echo "  MISSING field '${field}' on item '${OP_ITEM}' (vault '${OP_VAULT}')" >&2
    MISSING_FIELDS=$((MISSING_FIELDS + 1))
    return 0
  fi
  printf -v "$var" '%s' "$value"
  export "${var?}"
  (( DRY_RUN )) && echo "  ${field}: OK"
  return 0
}

require_field ASC_KEY_ID       "${OP_KEY_ID_FIELD:-key_id}"
require_field ASC_ISSUER_ID    "${OP_ISSUER_ID_FIELD:-issuer_id}"
require_field ASC_TEAM_ID      "${OP_TEAM_ID_FIELD:-team_id}"
require_field ASC_AUTH_KEY_B64 "${OP_AUTH_KEY_B64_FIELD:-auth_key_b64}"

# Profile items (preferred): 1Password items that carry the .mobileprovision as an
# attachment. The UUID is derived from the file itself rather than read from a
# separate field — a hand-maintained UUID field can drift from the profile it names,
# and did: it pointed at an Xcode-managed profile with no App Groups entitlement,
# which failed only at archive time with four misleading signing errors.
# Falls back to the UUID fields + Xcode cache when no profile item is configured.
profile_from_item() {
  local vault="$1" item="$2" label="$3" uuid_var="$4" b64_var="$5"
  local json file tmp uuid
  json="$(op item get "$item" --vault "$vault" --format json 2>/dev/null)" || {
    echo "  ${label} profile item '${item}' not found in vault '${vault}'" >&2; return 1; }
  file="$(printf '%s' "$json" | jq -r '.files[0].name // empty')"
  [[ -n "$file" ]] || { echo "  ${label} profile item '${item}' has no attachment" >&2; return 1; }
  tmp="$(mktemp -t prof)"
  op read "op://${vault}/${item}/${file}" --out-file "$tmp" --force >/dev/null 2>&1 || {
    echo "  could not download '${file}' from '${item}'" >&2; rm -f "$tmp"; return 1; }
  uuid="$(security cms -D -i "$tmp" 2>/dev/null | plutil -extract UUID raw - 2>/dev/null)"
  [[ -n "$uuid" ]] || { echo "  '${file}' is not a readable .mobileprovision" >&2; rm -f "$tmp"; return 1; }
  printf -v "$uuid_var" '%s' "$uuid"
  printf -v "$b64_var" '%s' "$(base64 -i "$tmp")"
  export "${uuid_var?}" "${b64_var?}"
  # grep the decoded plist directly: `plutil -extract` treats dots in the key
  # com.apple.security.application-groups as a keypath and silently finds nothing.
  local groups="none"
  security cms -D -i "$tmp" 2>/dev/null | grep -q 'application-groups' && groups="present"
  echo "  ${label} profile from 1Password '${item}': ${uuid} (app-groups: ${groups})"
  rm -f "$tmp"
}

IOS_PROVISION_PROFILE_UUID=""; IOS_PROVISION_PROFILE_B64=""
IOS_WIDGET_PROVISION_PROFILE_UUID=""; IOS_WIDGET_PROVISION_PROFILE_B64=""
USE_PROFILE_ITEMS=0
if [[ -n "${OP_PROFILE_VAULT:-}" && -n "${OP_APP_PROFILE_ITEM:-}" && -n "${OP_WIDGET_PROFILE_ITEM:-}" ]]; then
  USE_PROFILE_ITEMS=1
  profile_from_item "$OP_PROFILE_VAULT" "$OP_APP_PROFILE_ITEM" "App" \
    IOS_PROVISION_PROFILE_UUID IOS_PROVISION_PROFILE_B64 || MISSING_FIELDS=$((MISSING_FIELDS + 1))
  profile_from_item "$OP_PROFILE_VAULT" "$OP_WIDGET_PROFILE_ITEM" "Widget" \
    IOS_WIDGET_PROVISION_PROFILE_UUID IOS_WIDGET_PROVISION_PROFILE_B64 || MISSING_FIELDS=$((MISSING_FIELDS + 1))
else
  require_field IOS_PROVISION_PROFILE_UUID        "${OP_PROFILE_UUID_FIELD:-provision_profile_uuid}"
  require_field IOS_WIDGET_PROVISION_PROFILE_UUID "${OP_WIDGET_PROFILE_UUID_FIELD:-widget_provision_profile_uuid}"
fi

if (( MISSING_FIELDS > 0 )); then
  echo "${MISSING_FIELDS} required field(s) missing from 1Password — cannot continue." >&2
  exit 1
fi

# ── Provisioning profile files ──────────────────────────────────────────────────
# Xcode's cache first — it is the freshest copy and costs nothing. When a profile
# is absent there (new machine, cleared DerivedData, a target added after the last
# device build), fall back to a base64 copy in 1Password. Before that fallback
# existed a cache miss only produced a warning here, and the ship then died much
# later inside xcodebuild on a profile UUID it could not resolve.
XCODE_CACHE="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
DEST_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"

# opread_optional: empty string instead of a hard failure when the field is absent,
# so the B64 fields stay optional for anyone whose Xcode cache is already populated.
opread_optional() { op read "op://${OP_VAULT}/${OP_ITEM}/$1" 2>/dev/null || true; }

resolve_profile() {
  local uuid="$1" op_field="$2" label="$3" out_var="$4"
  if [[ -f "$XCODE_CACHE/${uuid}.mobileprovision" ]]; then
    if (( DRY_RUN )); then
      echo "  ${label} profile: OK — found in Xcode cache (${uuid})"
    else
      mkdir -p "$DEST_DIR"
      cp "$XCODE_CACHE/${uuid}.mobileprovision" "$DEST_DIR/${uuid}.mobileprovision"
      echo "  ${label} profile installed from Xcode cache: ${uuid}"
    fi
    return 0
  fi
  local b64
  b64="$(opread_optional "$op_field")"
  if [[ -n "$b64" ]]; then
    # Handing the base64 to bootstrap-ios-signing.sh rather than decoding here keeps
    # one install path, which also validates the decode.
    printf -v "$out_var" '%s' "$b64"
    if (( DRY_RUN )); then
      # Decode-check here too, so a truncated secret is caught by the dry run
      # rather than surfacing mid-archive on the real ship.
      if printf '%s' "$b64" | base64 -d 2>/dev/null | grep -qa 'DOCTYPE plist\|<?xml'; then
        echo "  ${label} profile: OK — not in Xcode cache, valid base64 in 1Password field '${op_field}'"
      else
        echo "  ${label} profile: FAIL — 1Password field '${op_field}' is not a valid .mobileprovision" >&2
        return 1
      fi
    else
      echo "  ${label} profile not in Xcode cache — using 1Password field '${op_field}'"
    fi
    return 0
  fi
  echo "WARNING: ${label} profile ${uuid} not in Xcode cache and no '${op_field}' field in 1Password." >&2
  echo "  Fix either source: Xcode > Settings > Accounts > Download Manual Profiles," >&2
  echo "  or add the profile to the item:" >&2
  echo "    base64 -i <profile>.mobileprovision | op item edit '${OP_ITEM}' --vault '${OP_VAULT}' '${op_field}[password]=-'" >&2
}

if (( ! USE_PROFILE_ITEMS )); then
  resolve_profile "${IOS_PROVISION_PROFILE_UUID}" \
    "${OP_PROFILE_B64_FIELD:-provision_profile_b64}" "App" IOS_PROVISION_PROFILE_B64
  resolve_profile "${IOS_WIDGET_PROVISION_PROFILE_UUID}" \
    "${OP_WIDGET_PROFILE_B64_FIELD:-widget_provision_profile_b64}" "Widget" IOS_WIDGET_PROVISION_PROFILE_B64
fi
export IOS_PROVISION_PROFILE_B64 IOS_WIDGET_PROVISION_PROFILE_B64

# Distribution cert is already in the login keychain — leave IOS_DIST_CERT_* unset so
# bootstrap-ios-signing.sh skips its cert-import block and xcodebuild uses the keychain
# identity directly. RUNNER_TEMP is only referenced inside that (skipped) block, but set
# it anyway so `set -u` is happy if the block is ever entered.
export RUNNER_TEMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

if (( DRY_RUN )); then
  echo
  echo "  Distribution cert: $(security find-identity -v -p codesigning 2>/dev/null | grep -c 'Apple Distribution') matching identity/identities in login keychain"
  echo
  echo "▸ DRY RUN complete — nothing written."
  echo "  Re-run without --dry-run to write .p8, build/ExportOptions.plist and .env.signing."
  exit 0
fi

./scripts/bootstrap-ios-signing.sh
echo
echo "✓ .env.signing regenerated. Next: source .env.signing && npm run ship:ios"
