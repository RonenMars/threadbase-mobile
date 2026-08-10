# Deploy Failure Notifications — Plan

**Status:** Partially implemented. The scheduled-E2E half shipped in `.github/workflows/e2e.yml` (`notify-schedule-failure` job, gated on a `CI_ALERT_WEBHOOK` repo secret) to close the blind spot described in `docs/followups/repo-health/01-scheduled-run-notifications.md`. The `deploy.yml` half below (`notify-failure`) is still not implemented — when it is, reuse the same `CI_ALERT_WEBHOOK` secret rather than minting a second one.

## Motivation

The `Deploy` workflow (`.github/workflows/deploy.yml`) is `workflow_dispatch` and ships from `main`. When a job fails, there is currently **no push notification** — you only find out by opening the Actions tab or being handed a run URL. The 2026-06-15 session burned several round-trips reconstructing failures from run links by hand (preflight → sed → iOS bump → pod `--deployment` → Android jitpack → iOS Xcode/Swift). A failure alert carrying the **job name + a direct log link** would have removed every one of those round-trips.

Goal: when `Ship iOS` or `Ship Android` fails, get an immediate message in a channel we already watch, deep-linking to the failed run.

## Recommended approach

**One `notify-failure` job appended to `deploy.yml`**, gated on `if: failure()` with `needs: [deploy-ios, deploy-android]`. A single job keeps the alert logic in one place and fires if *either* platform fails.

```yaml
  notify-failure:
    name: Notify on deploy failure
    needs: [deploy-ios, deploy-android]
    if: failure()            # fires if either needed job failed
    runs-on: ubuntu-latest
    steps:
      - name: Send alert
        env:
          WEBHOOK_URL: ${{ secrets.DEPLOY_ALERT_WEBHOOK }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          curl -sf -X POST "$WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "$(jq -n --arg t "🔴 Deploy failed: ${{ github.workflow }} — $RUN_URL" '{text:$t}')"
```

Notes baked into the snippet (do these for real when implementing):
- Build the JSON payload with `jq -n`, never string-interpolate `${{ }}` straight into a shell-quoted JSON body (workflow-injection hygiene — the repo's PostToolUse hook flags this).
- `if: failure()` on a job that `needs:` both deploy jobs evaluates against the needed jobs' results, so it triggers when *any* needed job fails. Skipped jobs (e.g. `platform == ios` skips `deploy-android`) do **not** count as failures.

### Per-job vs single job
- **Single `notify-failure` job (recommended):** one place to maintain, one secret, message can say "a deploy job failed" + link. Caller clicks through to see which.
- **Per-job `if: failure()` step inside each deploy job:** can name the exact platform in the message without a click, but duplicates the curl in two places and runs on the macOS/ubuntu runner mid-job. Only worth it if we want the platform in the alert text itself.

Start with the single job. Upgrade to per-job only if "which platform" in the message body proves to matter.

## Channel options

| Channel | Setup effort | Mechanism | Verdict |
| --- | --- | --- | --- |
| **Slack** | ~10 min | Incoming webhook URL → one `curl`. Rich formatting (blocks, a "View run" button). | **Best default** if a Slack workspace exists. Industry-standard for CI. |
| **Telegram** | ~10 min | Bot token + chat_id as secrets → `curl` to `https://api.telegram.org/bot<token>/sendMessage`. | **Strong** — a Telegram bot is already wired into the dev tooling. Good mobile push, dead simple API. |
| **Gmail / email** | Low–med | Either GitHub's **built-in** Actions failure email (zero work — just enable in notification settings), or an SMTP action (`dawidd6/action-send-mail`) + app password for a custom message. | Good zero-effort floor (built-in email). Custom email is fiddlier than Slack/Telegram. |
| **WhatsApp** | High | No first-party webhook. Requires Twilio or Meta Cloud API — business account, approved message template, paid per message. | **Not recommended** for CI alerts. Disproportionate friction. |

**Recommendation:** Telegram **or** Slack (whichever you check faster on your phone). Both are a single secret + one `curl` step. WhatsApp is not worth the integration cost; if you want a no-code floor today, just confirm GitHub's built-in failure email is enabled.

## Trigger scope

| Option | Behavior | Verdict |
| --- | --- | --- |
| **Failure only** | Alert only when a deploy job fails (`if: failure()`). | **Recommended.** Lowest noise — you only hear from it when action is needed. |
| **Failure + success** | Also ping on a successful TestFlight/Play upload ("shipped build N"). | Optional. Useful as a ship log, but adds routine noise. Add later if wanted. |

Start failure-only.

## Decisions still open

1. **Channel** — Slack vs Telegram (or just enable built-in email). _Pending user choice._
2. **Trigger scope** — failure-only (default) vs failure+success.
3. **Message richness** — plain text + run link (MVP) vs. structured (platform name, branch, commit, "View logs" button). MVP first.

## Implementation checklist (when approved)

- [x] `e2e.yml`: scheduled-run failure alert shipped (`notify-schedule-failure` job). Fires only when `github.event_name == 'schedule'` and the `e2e-maestro` job fails; no-ops cleanly (exits 0, doesn't fail the run) when `CI_ALERT_WEBHOOK` is unset.
- [ ] Create the channel endpoint:
  - Slack: create an Incoming Webhook, copy the URL.
  - Telegram: create/identify the bot, get its token + the target chat_id.
- [ ] Add the secret to the repo: `CI_ALERT_WEBHOOK` (already read by `e2e.yml`; a generic name so `deploy.yml` can share it instead of minting a second secret) pointing at a Slack Incoming Webhook, Discord webhook, ntfy topic, or similar — anything that accepts a plain `{"text": "..."}` POST body.
- [ ] Append the `notify-failure` job to `.github/workflows/deploy.yml`.
- [ ] Build the JSON payload with `jq -n` (no raw `${{ }}` interpolation into the body).
- [ ] Include a deep link: `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`.
- [ ] Test by triggering a deliberately-failing deploy (e.g. on a throwaway branch) and confirming the alert lands with a working link.
- [ ] (Optional) Mirror the same job into `test.yml` if CI-test failures also warrant a push alert.

## Related

- `docs/deployment.md` — the ship paths this would wrap.
- `.github/workflows/deploy.yml` — where the `notify-failure` job lands.
