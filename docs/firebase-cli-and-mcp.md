# Firebase CLI and Firebase MCP server

How an agent or a developer uses the two Firebase tools installed on the maintainer's machine, and what each can and cannot do for the Firebase QA channel.
The channel itself (`scripts/ship-qa.sh`, TbDev, tester groups) is in [`deployment.md`](./deployment.md) → "Path F"; the Firebase project state is in [`tbdev.md`](./tbdev.md).

Both tools were checked against `firebase-tools` 15.36.0 on 2026-11-17.
Re-run the commands in "Where the exact text lives" before relying on a flag in a newer version.

## At a glance

| Need | Firebase CLI | Firebase MCP server | `ship-qa.sh` / REST |
|---|---|---|---|
| Upload a build and notify testers | `appdistribution:distribute` | no tool | `ship-qa.sh` (what this repo uses) |
| List or manage tester groups and testers | `appdistribution:groups:*`, `appdistribution:testers:*` | no tool | the script only reads group counts |
| List App Distribution **releases** | no command | no tool | REST `releases` (see `deployment.md`) |
| List projects and apps, read an app's SDK config | `projects:list`, `apps:list`, `apps:sdkconfig` | `firebase_list_projects`, `firebase_list_apps`, `firebase_get_sdk_config` | no |
| Check who is signed in, switch the active project | `login:list`, `use` | `firebase_get_environment`, `firebase_update_environment` | no |
| Read Firebase documentation | no | `developerknowledge_search_documents` and friends | no |

For a QA release the repo uses `ship-qa.sh`, never `appdistribution:distribute`.
The script builds the TbDev binary with the enforced-tracking flag, signs it with the Ad Hoc profiles, and refuses a group with no testers; a bare `distribute` skips all of that.

## Firebase CLI

### Install

Homebrew, not npm.
This machine allows exactly one Node runtime, managed by nvm, and the user chose the Homebrew `firebase-cli` formula over an npm global under nvm (2026-11-16).
The formula depends on the `node` formula, so a second Node (26.x) exists on disk; nvm's Node still comes first on `PATH`.

```bash
brew install firebase-cli
/opt/homebrew/bin/firebase --version      # 15.36.0
```

Call it by absolute path in agent shells (`/opt/homebrew/bin/firebase`), as with `git`.

### Sign in

```bash
/opt/homebrew/bin/firebase login:list     # "Logged in as <email>"
/opt/homebrew/bin/firebase login          # interactive; the user runs it with `! firebase login`
```

`--token` is deprecated in favour of service-account or application-default credentials; do not build new flows on it.
The CLI's login is separate from gcloud's.
`ship-qa.sh` uses neither: it takes `FIREBASE_ACCESS_TOKEN` or a gcloud token ([`deployment.md`](./deployment.md) → "Agent runbook").

### Global options (every command)

| Option | Meaning |
|---|---|
| `-P, --project <alias_or_project_id>` | The Firebase project to use. This repo's project is `threadbase-10d42`. |
| `--non-interactive` | Fail instead of prompting. Use in agent shells. |
| `--debug` | Verbose output; keeps a debug log. |
| `--token <token>` | Deprecated. |

### App Distribution commands

```text
firebase appdistribution:distribute [options] <release-binary-file>
firebase appdistribution:groups:list
firebase appdistribution:groups:create <displayName> [alias]
firebase appdistribution:groups:delete <alias>
firebase appdistribution:testers:list [group]
firebase appdistribution:testers:add [options] [emails...]
firebase appdistribution:testers:remove [options] [emails...]
firebase appdistribution:testcases ...        # automated test cases (beta)
```

`groups:*` also answers to the singular `appdistribution:group:*`.

`appdistribution:distribute` options, as printed by `--help`:

| Option | Meaning |
|---|---|
| `--app <app_id>` | The Firebase app ID. For TbDev iOS that is `1:863079924487:ios:710948614c0bdb1694bba2` (full table in `tbdev.md`). |
| `--release-notes <string>`, `--release-notes-file <file>` | Release notes. |
| `--groups <aliases>`, `--groups-file <file>` | Comma-separated group aliases to notify. This repo's group is `qa`. |
| `--testers <emails>`, `--testers-file <file>` | Comma-separated tester emails. |
| `--test-devices <string>`, `--test-devices-file <file>` | Beta: devices for automated tests, `model=<id>,version=<os>,locale=<l>,orientation=<o>`, separated by `;`. |
| `--test-username`, `--test-password`, `--test-password-file`, `--test-username-resource`, `--test-password-resource` | Automatic login for those tests. Use the file form for a real password. |
| `--test-non-blocking` | Do not wait for the automated tests. |
| `--test-case-ids`, `--test-case-ids-file` | Which test cases to run. |
| `--results-bucket <bucket>` | GCS bucket for raw results; a non-default bucket can bill. |

Examples that are safe to run:

```bash
/opt/homebrew/bin/firebase appdistribution:groups:list -P threadbase-10d42 --non-interactive
/opt/homebrew/bin/firebase appdistribution:testers:list qa -P threadbase-10d42 --non-interactive
```

Both were run on 2026-11-17 and worked.
`groups:list` prints a table with `Tester Count` and `Release Count` per group (`qa`: 2 testers, 87 releases), which is a quick way to see that the group `ship-qa.sh` checks is not empty and that a distribution raised the count.
`testers:list` prints tester emails, which are personal data: do not paste its output into a PR, issue or commit.

Examples that change what testers see; run them only with the user's explicit go, per the platform and approval rules in [`AGENTS.md`](../AGENTS.md):

```bash
firebase appdistribution:testers:add --group-alias qa someone@example.com -P threadbase-10d42
firebase appdistribution:distribute build/export-qa/Threadbase.ipa --app <app_id> --groups qa --release-notes "…"
```

`testers:add` takes `--group-alias <alias>` and `--file <file>` (per its `--help`); the two commands above are shown for their shape and were not run.

### What the CLI cannot do here

It has no command that lists or reads App Distribution releases.
To confirm that a release exists, use the REST call in [`deployment.md`](./deployment.md) → "Agent runbook", which needs `x-goog-user-project: threadbase-10d42`.

## Firebase MCP server

### What it is

A local stdio MCP server shipped inside the Firebase CLI (`firebase mcp`).
It runs on the machine with the credentials the CLI is signed in with, so it can reach every project that account can.
The official page is <https://firebase.google.com/docs/ai-assistance/mcp-server>.

### Registration on this machine

Registered at user scope for Claude Code on 2026-11-16, pointing at the Homebrew binary rather than `npx`:

```bash
claude mcp add --scope user firebase -- /opt/homebrew/bin/firebase mcp
claude mcp get firebase       # Scope: User config, Status: ✔ Connected, Type: stdio, Args: mcp
claude mcp remove firebase -s user
```

The official instructions use `npx` instead (`claude mcp add firebase npx -- -y firebase-tools@latest mcp`), and the Claude plugin route is `claude plugin marketplace add firebase/firebase-tools` then `claude plugin install firebase@firebase`.
This repo uses the Homebrew binary so no second copy of `firebase-tools` is fetched.
Codex needs its own registration; it does not read Claude's config.

The tools appear only after a session starts, and they are deferred: load them with `ToolSearch("firebase")` before calling one.

### `firebase mcp` options

| Option | Meaning |
|---|---|
| `--dir <path>` | Project root, a directory with `firebase.json`. Defaults to the working directory. |
| `--only <features>` | Comma-separated feature groups to expose; disables auto-detection for the others. Core tools are always on. |
| `--tools <tools>` | Load exactly these tools by name; disables auto-detection. |
| `--mode <stdio\|sse>` | Transport. Default `stdio`. |
| `--port <port>` | Port in `sse` mode. Default 3000. |
| `--generate-tool-list` | Print the full tool table and exit. |

Without `--only`, the server auto-detects tools from `firebase.json`, the project's enabled Google Cloud APIs and the SDKs in the project files.
This repo has no `firebase.json`, so a session sees the core group plus the documentation tools.

### Tools this session exposes

Core group, as seen on 2026-11-17: `firebase_login`, `firebase_logout`, `firebase_get_environment`, `firebase_update_environment`, `firebase_get_project`, `firebase_list_projects`, `firebase_list_apps`, `firebase_get_sdk_config`, `firebase_create_project`, `firebase_create_app`, `firebase_create_android_sha`, `firebase_init`, `firebase_get_security_rules`, `firebase_read_resources`, `firebase_deploy`, `firebase_deploy_status`.
Documentation group: `developerknowledge_search_documents`, `developerknowledge_get_documents`, `developerknowledge_answer_query`.
Other feature groups exist (`apphosting`, `auth`, `crashlytics`, `dataconnect`, `firestore`, `functions`, `messaging`, `realtimedatabase`, `remoteconfig`, `storage`) and load only when detected or named with `--only`.
There is **no App Distribution group**, so the MCP server cannot list releases, groups or testers.

### How to use it, in order

1. `firebase_get_environment`: shows the signed-in user, the active project and detected app IDs. `Active Project ID: <NONE>` is normal in this repo.
2. `firebase_update_environment` with `active_project: "threadbase-10d42"`: tools that need a project fail with `PRECONDITION_FAILED: To proceed requires an active project` until it is set.
3. `firebase_list_apps` (optionally `platform: "ios"`): TbDev iOS should be `ACTIVE` with bundle `com.ronenmars.threadbase.dev`. The removed Threadbase iOS app is not listed.
4. `firebase_get_sdk_config` with `app_id` or `platform`, when a config file's contents are needed.
5. `developerknowledge_search_documents`, then `developerknowledge_get_documents` with the `parent` it returns, for Firebase and Google documentation; cite the document name.

### Do not use from an agent without an explicit ask

`firebase_deploy` deploys whatever `firebase.json` configures, `firebase_create_project` and `firebase_create_app` create billable or permanent resources, and `firebase_logout` signs the CLI out for every project and for the CLI itself.
None of them is part of a QA release.

### Do not probe it by hand

Piping JSON-RPC into `firebase mcp` from a shell to "test" it was refused by the user on 2026-11-16.
`claude mcp get firebase` and the tools themselves are the check.

## Where the exact text lives

```bash
/opt/homebrew/bin/firebase --help
/opt/homebrew/bin/firebase appdistribution --help
/opt/homebrew/bin/firebase appdistribution:distribute --help
/opt/homebrew/bin/firebase appdistribution:groups --help
/opt/homebrew/bin/firebase appdistribution:testers --help
/opt/homebrew/bin/firebase mcp --help
/opt/homebrew/bin/firebase mcp --generate-tool-list
```

Official pages: the [CLI reference](https://firebase.google.com/docs/cli) and the [MCP server page](https://firebase.google.com/docs/ai-assistance/mcp-server), which the `developerknowledge_*` tools can also fetch (`documents/firebase.google.com/docs/ai-assistance/mcp-server`).
