#!/usr/bin/env bash
# Mint a short-lived ES256 JWT for the App Store Connect API.
#
# Reads ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH from the environment
# (set by `source .env.signing`) and prints the JWT on stdout.
#
# Usage:
#   JWT=$(./scripts/asc-jwt.sh)
#   curl -sH "Authorization: Bearer $JWT" \
#     https://api.appstoreconnect.apple.com/v1/apps

set -euo pipefail

: "${ASC_KEY_ID:?ASC_KEY_ID not set — source .env.signing first}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set — source .env.signing first}"
: "${ASC_KEY_PATH:?ASC_KEY_PATH not set — source .env.signing first}"

[[ -r "$ASC_KEY_PATH" ]] || { echo "Cannot read .p8 at $ASC_KEY_PATH" >&2; exit 1; }

NOW=$(date +%s)
EXP=$((NOW + 1140))   # 19 min — under Apple's 20-min hard cap

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

HEADER=$(printf '{"alg":"ES256","kid":"%s","typ":"JWT"}' "$ASC_KEY_ID" | b64url)
PAYLOAD=$(printf '{"iss":"%s","iat":%s,"exp":%s,"aud":"appstoreconnect-v1"}' \
  "$ASC_ISSUER_ID" "$NOW" "$EXP" | b64url)
SIG=$(printf '%s.%s' "$HEADER" "$PAYLOAD" \
  | openssl dgst -sha256 -binary -sign "$ASC_KEY_PATH" | b64url)

printf '%s.%s.%s\n' "$HEADER" "$PAYLOAD" "$SIG"
