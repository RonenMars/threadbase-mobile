# localize-language

This skill adds, updates, reviews, or audits one application locale against the repository's canonical source. Read [SKILL.md](SKILL.md) and its [Threadbase](references/threadbase.md) and [Ukrainian](references/uk.md) references before using it. The references are starting guidance; the current checkout determines resource paths, commands, and integration requirements.

## Install and invoke

For Claude Code, keep this directory in the repository's `.claude/skills/` (as installed here), or copy the entire directory to `~/.claude/skills/` for global use. Start a fresh session at the repository root. The first argument is a BCP 47 locale; the optional second argument is `implement`, `update`, `review`, or `audit`. `implement` is the default.

```text
/localize-language uk implement
/localize-language uk update
/localize-language uk review
/localize-language uk audit
```

For Codex, this `.claude/skills/` installation is not a verified Codex skill registration. Open the repository root in Codex and give it the file path and mode explicitly. For example:

```text
Read .claude/skills/localize-language/SKILL.md and both files in its references/ directory. Follow that skill for locale uk in implement mode. Inspect the repository first, preserve unrelated changes, and report validation results. Do not commit or push.
```

For the other stages, use a fresh Codex chat and replace `implement` with `update`, `review`, or `audit`. For `audit`, add: `Do not modify files or run repository-writing commands; report findings with paths, keys, and proposed corrections.` A Codex installation that explicitly registers this directory as a Codex skill may offer a shorter command, but verify that registration before relying on one.

## Recommended sequence and models

Run implementation or update first, then start a fresh session for independent review. Use audit when you need findings without edits. Review can apply justified corrections; audit is strictly read-only. A fresh reviewer should inspect source usage and target resources independently, without treating the implementer's choices as authoritative.

| Step | Claude Code recommendation | Codex recommendation |
| --- | --- | --- |
| Implement a new locale | Sonnet, high effort | GPT-6.2 Sol, high effort |
| Update an existing locale | Sonnet, high effort | GPT-6.2 Sol, medium or high effort |
| Independent review and fixes | Opus, medium or high effort, in a fresh session | GPT-6.2 Astra, high effort, in a fresh chat |
| Read-only audit | Opus, medium effort, in a fresh session | GPT-6.2 Astra, medium effort, in a fresh chat |

These are workflow recommendations, not proof that a particular model is available to your account. Claude Code's installed CLI accepts `--model` aliases such as `sonnet` and `opus`, and `--effort` levels; check `/model`, `/effort`, or `claude --help` in your installation. For example, from the repository root:

```sh
claude --model sonnet --effort high
# Then enter: /localize-language uk implement

claude --model opus --effort medium
# In a fresh session, enter: /localize-language uk audit
```

Codex model labels and reasoning settings vary by product, account, and version. Confirm the offered model in the Codex model picker or your CLI before starting; do not assume an API model name is enabled in Codex. The CLI accepts `--model`, and its reasoning effort can be set through `-c model_reasoning_effort=high` when supported by that model. For example, after confirming availability:

```sh
codex -C . --model gpt-6.2-sol -c model_reasoning_effort=high
# Then enter the explicit SKILL.md prompt above.
```

The recommendations reflect the distinct job: broad resource editing benefits from a capable coding model, while an independent review benefits from stronger semantic judgment. Neither model choice replaces native-speaker acceptance or runtime checks. [Claude Code settings](https://code.claude.com/docs/en/settings) and [OpenAI model selection](https://developers.openai.com/api/docs/guides/model-selection) describe current controls and model tradeoffs; recheck them as products change.

## Validate and maintain

The skill has no custom executable or external dependency. Discover the repository's actual localization and test commands before running them. In Threadbase Mobile, start with the current `AGENTS.md` and package scripts; its localization check is `npm run test:i18n`, and its standard checks are `npm run lint`, `npm run typecheck`, `npm run test:ci`, and `npm run test:scripts`. Run the relevant checks, record actual results and any baseline failures, and inspect the final diff. Where feasible, verify language switching, persistence, fallback, plural counts, formatting, compact layouts, and accessibility labels on the app. Mark visual or native checks as unrun when they were not performed.

When English source strings or integration code change, run `update` for affected locales, then a fresh `review` or `audit`. Keep the glossary and locale guidance aligned with real UI usage. Update resource paths, scripts, and model examples in this README when the repository or tooling changes; do not loosen validation or mark untranslated strings current to make a check pass. The skill never commits, pushes, publishes, or uploads translations unless separately requested.
