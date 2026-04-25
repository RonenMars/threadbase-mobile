#!/usr/bin/env bash
# Mint a short-lived ES256 JWT for the App Store Connect API.
# Reads ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH from env (`source .env.signing`).
# Prints the JWT on stdout. Token life: 19 min (under Apple's 20-min cap).

set -euo pipefail

: "${ASC_KEY_ID:?ASC_KEY_ID not set — source .env.signing}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID not set — source .env.signing}"
: "${ASC_KEY_PATH:?ASC_KEY_PATH not set — source .env.signing}"
[[ -r "$ASC_KEY_PATH" ]] || { echo "Cannot read .p8 at $ASC_KEY_PATH" >&2; exit 1; }

NOW=$(date +%s); EXP=$((NOW + 1140))
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

HEADER=$(printf '{"alg":"ES256","kid":"%s","typ":"JWT"}' "$ASC_KEY_ID" | b64url)
PAYLOAD=$(printf '{"iss":"%s","iat":%s,"exp":%s,"aud":"appstoreconnect-v1"}' \
  "$ASC_ISSUER_ID" "$NOW" "$EXP" | b64url)
SIG=$(printf '%s.%s' "$HEADER" "$PAYLOAD" \
  | openssl dgst -sha256 -binary -sign "$ASC_KEY_PATH" | b64url)

printf '%s.%s.%s\n' "$HEADER" "$PAYLOAD" "$SIG"
