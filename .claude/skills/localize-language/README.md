# localize-language

Install globally by copying the `localize-language` directory to `~/.claude/skills/`, or into a repository's `.claude/skills/` for project-specific use. Start Claude Code at the repository root.

Examples:
- `/localize-language uk` — add Ukrainian (default implement mode)
- `/localize-language uk update` — reconcile source changes
- `/localize-language uk review` — review and fix translations
- `/localize-language uk audit` — read-only review
- `/localize-language de` — add German

Recommended: Sonnet High for implementation and updates; Opus Medium in a fresh session for independent review. Select models/effort in Claude Code rather than hardcoding them in the skill. The skill is explicitly invoked, so ordinary coding tasks won't automatically start localization.

The skill has no external dependencies or custom executable scripts. It relies on repository-native tooling. It includes optional guidance for Threadbase Mobile and Ukrainian. Runtime execution and translation acceptance testing have not been performed as part of packaging.
