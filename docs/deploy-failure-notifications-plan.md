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

The shipped job posts exactly this, and nothing else:

```bash
PAYLOAD=$(jq -n --arg t "E2E scheduled run failed: $WORKFLOW_NAME — $RUN_URL" '{text: $t}')
curl -sf -X POST "$WEBHOOK_URL" -H 'Content-Type: application/json' -d "$PAYLOAD"
```

So the only question for any destination is whether it accepts `{"text": "..."}`. That is **not** universal, despite what an earlier revision of this doc implied.

It matters more than it looks: the step runs under `set -euo pipefail` with `curl -sf`, so a destination that rejects the body returns non-2xx and **fails the notify job**. A mis-shaped URL turns every real failure into two red jobs rather than one.

| Channel | Secret value | Accepts `{"text"}`? |
| --- | --- | --- |
| **Telegram** | `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>` | ✅ `chat_id` rides in the query string, so `text` is the only body field needed. |
| **Slack** | Incoming-webhook URL | ✅ `{"text"}` is Slack's native shape. |
| **Discord** | Webhook URL **with `/slack` appended** | ⚠️ A bare Discord webhook requires `content`, not `text`, and returns **HTTP 400**. The `/slack` suffix switches it to Slack-compatible mode, which accepts `{"text"}`. |
| **ntfy** | `https://ntfy.sh/<topic>` | ⚠️ Delivers, but ntfy publishes the raw body, so the notification reads as the literal JSON. Needs a `{topic, message}` payload against `https://ntfy.sh/` to render cleanly. |
| **WhatsApp** | — | ❌ No first-party webhook. Twilio or Meta Cloud API, business account, approved template, paid per message. Disproportionate for CI alerts. |

## Decision — Telegram, plus GitHub's built-in email

Chosen 2026-08-11. Two layers, deliberately:

**Telegram** takes the shipped payload verbatim, needs no workspace, and pushes to a phone.

**GitHub's built-in Actions failure email** is the zero-config floor and is independent of `CI_ALERT_WEBHOOK` — it keeps working if the token is revoked, the bot is deleted, or the webhook step itself breaks. Given the scheduled job failed three months running with nobody noticing, one channel is what got us here.

### Telegram setup

1. Message `@BotFather`, send `/newbot`, and keep the token.
2. Send your new bot any message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `result[0].message.chat.id`.
3. Add the repo secret **`CI_ALERT_WEBHOOK`** with the full URL, chat id included:
   `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>`
4. Verify before trusting it:
   ```sh
   curl -sf -X POST "<the same URL>" \
     -H 'Content-Type: application/json' \
     -d '{"text": "test alert"}'
   ```
   A message should arrive. Anything other than a 2xx means the job would fail rather than notify.

The token is a credential: it lives in the repo secret only, never in a workflow file or a doc.

### Built-in email

GitHub → Settings → Notifications → Actions → enable failure notifications. Per-user, not per-repo, so each maintainer sets it independently.

## Trigger scope

| Option | Behavior | Verdict |
| --- | --- | --- |
| **Failure only** | Alert only when a deploy job fails (`if: failure()`). | **Recommended.** Lowest noise — you only hear from it when action is needed. |
| **Failure + success** | Also ping on a successful TestFlight/Play upload ("shipped build N"). | Optional. Useful as a ship log, but adds routine noise. Add later if wanted. |

Start failure-only.

## Decisions still open

1. ~~**Channel**~~ — **Resolved 2026-08-11: Telegram, plus GitHub's built-in Actions failure email.** See the decision section above.
2. **Trigger scope** — failure-only (default) vs failure+success.
3. **Message richness** — plain text + run link (MVP) vs. structured (platform name, branch, commit, "View logs" button). MVP first.

## Implementation checklist (when approved)

- [x] `e2e.yml`: scheduled-run failure alert shipped (`notify-schedule-failure` job). Fires only when `github.event_name == 'schedule'` and the `e2e-maestro` job fails; no-ops cleanly (exits 0, doesn't fail the run) when `CI_ALERT_WEBHOOK` is unset.
- [ ] Create the Telegram bot via `@BotFather` and read the target `chat_id` from `getUpdates` — see the setup steps above.
- [ ] Add the secret to the repo: `CI_ALERT_WEBHOOK` = `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>`. The name is generic so `deploy.yml` can share it rather than minting a second secret. If you ever repoint it, check the destination actually accepts `{"text": "..."}` — the compatibility table above exists because most do not.
- [ ] Enable GitHub's built-in Actions failure email as the independent second layer (per-user, in notification settings).
- [ ] Append the `notify-failure` job to `.github/workflows/deploy.yml`.
- [ ] Build the JSON payload with `jq -n` (no raw `${{ }}` interpolation into the body).
- [ ] Include a deep link: `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`.
- [ ] Test by triggering a deliberately-failing deploy (e.g. on a throwaway branch) and confirming the alert lands with a working link.
- [ ] (Optional) Mirror the same job into `test.yml` if CI-test failures also warrant a push alert.

## Related

- `docs/deployment.md` — the ship paths this would wrap.
- `.github/workflows/deploy.yml` — where the `notify-failure` job lands.
