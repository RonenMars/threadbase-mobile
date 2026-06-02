#!/usr/bin/env bash
# Bootstrap HOME with the seed corpus and the tb-streamer config, then exec
# the streamer. Designed to be idempotent so the entrypoint can run on every
# cold boot of the Fly machine without clobbering reviewer state from prior
# sessions (the Fly volume mounted at /data persists across restarts).
set -euo pipefail

mkdir -p "${HOME}/.claude/projects" "${HOME}/.threadbase"

# -n keeps existing files — Fly volume state wins over the baked seed once a
# reviewer has paired and the streamer has rewritten its cache.
cp -rn /seed/. "${HOME}/.claude/projects/"

# The seed JSONLs reference cwd paths like /home/demo/projects/threadbase-mobile.
# When a reviewer resumes a session, tb-streamer's PTYManager spawns claude with
# cwd set to that projectPath — if the directory does not exist, the PTY exits
# immediately with "chdir(2) failed: No such file or directory" and the session
# screen shows the error instead of the claude-code-stub banner.
# Create the referenced project directories so the chdir succeeds. The
# directories are intentionally empty; claude-code-stub does not read from them.
mkdir -p \
    /home/demo/projects/threadbase-mobile \
    /home/demo/projects/experiments \
    /home/demo/projects/personal-website

# Public demo accepts any non-empty Bearer key for parity with the prior mock
# server (documented in the App Review notes). We still write a placeholder
# api_key line so tb-streamer's loadOrCreateApiKey() does not generate a new
# random key on every boot.
DEMO_API_KEY="${DEMO_API_KEY:-tb_public_demo_reviewer_key}"

cat > "${HOME}/.threadbase/server.yaml" <<EOF
api_key: ${DEMO_API_KEY}
public_url: ${THREADBASE_PUBLIC_URL}
browse_root: /data/.claude/projects
EOF
chmod 600 "${HOME}/.threadbase/server.yaml"

cd /opt/tb-streamer
exec node dist/cli.cjs serve \
    --port "${PORT}" \
    --prod \
    --no-pair-qr \
    --browse-root "/data/.claude/projects"
