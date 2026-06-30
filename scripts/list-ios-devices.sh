#!/usr/bin/env bash
# List physical iOS devices with their legacy UDIDs for use with expo run:ios --device.
# Legacy UDID format: 8 hex chars + dash + 16 hex chars (25 chars, e.g. XXXXXXXX-XXXXXXXXXXXXXXXX).
# Do not confuse with CoreDevice IDs (different namespace) or simulator UUIDs (36-char, 4 dashes).

set -euo pipefail

echo "Physical iOS devices (plug in via USB first):"
echo
xcrun xctrace list devices 2>&1 \
  | grep -i "iphone\|ipad" \
  | grep -v "[Ss]imulator" \
  || echo "  No physical devices found — plug in via USB and unlock the device."
