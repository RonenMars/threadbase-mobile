# Public demo container for threadbase-demo.fly.dev. Runs a real
# @threadbase/streamer process against curated seed JSONL conversations, so the
# behaviour matches what the iOS app sees when paired against a user's own
# streamer on macOS. The `claude` binary on PATH is a scripted shim — it never
# talks to Anthropic, so the container has no API credentials and no token
# spend.
#
# The streamer's "linux-x64" GitHub release tarball ships darwin/win32 native
# prebuilds and is missing build-time peers (node-addon-api, bindings). We
# rebuild node-pty and better-sqlite3 from source in a builder stage, then
# copy the result into a slim runtime image.

# ─── builder ────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ARG TB_STREAMER_VERSION=1.2.0
WORKDIR /build
RUN curl -fsSL "https://github.com/RonenMars/threadbase-streamer/releases/download/v${TB_STREAMER_VERSION}/threadbase-streamer-${TB_STREAMER_VERSION}-linux-x64.tgz" \
    | tar -xz

# node-pty's `npm run install` script needs node-addon-api to compile.
# better-sqlite3 needs `bindings` at runtime. Neither is shipped in the tarball.
RUN cd node_modules/node-pty && npm install --no-save --no-audit --no-fund node-addon-api
RUN npm install --no-save --no-audit --no-fund bindings

# Rebuild native modules against linux-x86_64 from source.
RUN cd node_modules/node-pty && npm run install
RUN cd node_modules/better-sqlite3 && npm run build-release

# ─── runtime ────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim

# Runtime needs ca-certificates for outbound HTTPS; everything else stays out.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build /opt/tb-streamer

# Scripted `claude` shim. tb-streamer's PTYManager spawns the binary named
# `claude` on PATH, so we install ours there.
COPY mock-claude/ /opt/mock-claude/
RUN chmod +x /opt/mock-claude/claude.js \
    && ln -s /opt/mock-claude/claude.js /usr/local/bin/claude

# Seed corpus baked into the image. entrypoint.sh copies it into HOME at boot
# (idempotently — Fly volumes persist state across deploys).
COPY seed/ /seed/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV HOME=/data \
    THREADBASE_PUBLIC_URL=https://threadbase-demo.fly.dev \
    PORT=8080
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
