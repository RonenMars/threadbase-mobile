# GPT-6 configuration audit and pilot plan

Date: 2026-10-03. Mobile baseline: `1fefd0d1`. Status: planning only; audit and pilot have not run.

## Goal

Determine whether GPT-6 improves Codex sessions managed through Threadbase and whether adopting it requires any configuration change.
There is no demonstrated need to migrate the mobile app: it delegates execution to the configured streamer and has no active OpenAI inference integration identified in this review.
The outcome may be to keep the current configuration.

Scope: a read-only streamer configuration audit, followed by a small pilot using an explicit model override for new disposable sessions.
Changing persistent defaults, adding mobile controls, converting API endpoints, changing prompts, and rolling out a release are outside this plan.
If the goal is only to use GPT-6 to develop this repository, select the model in the development chat; no product migration is needed.

## 1. Audit the current Codex execution path

Read the streamer's AGENTS.md and inspect the Codex launch/resume path and configuration precedence.
Record the installed CLI version, effective model and reasoning effort, the owner of those defaults, available per-session overrides, and account model availability without exposing credentials.
Distinguish source behavior from the running streamer's actual configuration.
Check whether existing transcript ingestion and session metadata can identify the selected model.

Deliverable: a short evidence-backed table of the current values, their configuration owners, and any unknowns.
Completion: identify a verified way to override the model for a new pilot session without changing persistent defaults.
If no such mechanism exists or access cannot be confirmed, report the exact blocker and stop before implementation.

## 2. Run a small comparison

Candidate: `gpt-6.1-sol` for ordinary coding sessions, based on [official OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).
This is a candidate to evaluate, not a proven improvement for this workload.
Preserve the baseline reasoning effort where supported; if it is `none` or `minimal`, use `low` for Sol and record the mismatch.
Use `medium` only if the baseline has no established effort setting.

Run the current model and Sol against the same two bounded tasks in separate disposable workspaces:

1. A narrow bug fix with a clear expected behavior and relevant existing tests.
2. A small multi-file change with explicit acceptance criteria, including an interruption and resume.

Keep instructions, tool permissions, starting code, and inputs equivalent.
Inspect tool execution, approval behavior, interruption/resume, and transcript delivery to mobile.
Confirm the actual model from authoritative provider/session evidence; a UI label alone is insufficient.

Deliverable: a comparison of correctness, unintended edits, elapsed time, and token/cost metrics where available.
Record missing metrics as unavailable; do not infer API cost from subscription usage.
Completion: both tasks have reviewable results and the session lifecycle checks have explicit pass/fail evidence.
A two-task pilot is an initial signal; report inconclusive or inconsistent results as such.

## 3. Make a decision

Recommend one of three outcomes:

- Keep the current setup if Sol provides no clear benefit or introduces regressions.
- Propose a separate configuration-only change if Sol improves results and existing provider support is sufficient.
- Propose a separately scoped compatibility fix if a concrete integration blocker prevents evaluation or adoption.

Do not expand this pilot into mobile model-picker work.
If adoption is recommended, name the exact setting to change, affected sessions, and how to restore its previous value.
Persistent configuration changes and publication remain a separate approval step under the applicable repository rules.

Completion: deliver the audit evidence, pilot results, recommendation, and any smallest follow-up; the plan succeeds even if the recommendation is no change.

## Kickoff message

> Audit the streamer's current Codex model, reasoning effort, configuration precedence, and per-session override support. Then, if supported and accessible, compare the current model with GPT-6.1 Sol on two bounded tasks in disposable sessions. Preserve persistent defaults and existing sessions. Report correctness, lifecycle behavior, latency, and available usage metrics, followed by a keep/change/inconclusive recommendation. Stop at that decision; implementation and rollout are separate work.
