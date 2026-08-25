#!/usr/bin/env bash
# altool can print a validation failure while exiting zero. Treat Apple's
# explicit success marker as the upload contract instead of trusting the
# process status alone.

set -euo pipefail

UPLOAD_LOG="${1:-${UPLOAD_LOG:-build/upload.log}}"
[[ -f "$UPLOAD_LOG" ]] || { echo "Upload log not found: $UPLOAD_LOG" >&2; exit 1; }

if grep -Fq 'UPLOAD FAILED' "$UPLOAD_LOG" ||
   grep -Fq 'Upload failed.' "$UPLOAD_LOG" ||
   grep -Fq 'Validation failed' "$UPLOAD_LOG"; then
  echo "Apple did not accept the upload. See $UPLOAD_LOG for the validation error." >&2
  exit 1
fi

if ! grep -Fq 'UPLOAD SUCCEEDED with no errors' "$UPLOAD_LOG"; then
  echo "Apple did not accept the upload: altool emitted no success marker. See $UPLOAD_LOG." >&2
  exit 1
fi

echo "Apple accepted the upload."
