#!/usr/bin/env node
// Claude Code PreToolUse hook: blocks a Bash command that would ship iOS and
// Android together. CLAUDE.md says to ask which platform(s) before any deploy,
// but every `cc` launch skips permission prompts, so nothing else would stop it.
//
// Blocked: `npm run ship:all`; `ship-ios` and `ship-android` chained in one
// command; `gh workflow run deploy|qa` without `platform=ios|android` (the
// workflows default to `all`). `ship-qa.sh` is not matched: it exits 2 without
// --platform by itself.
//
// Matching is anchored to a command start (line start, or after ; & | or `(`),
// so prose that only mentions a command does not match. A command inside
// `bash -c "..."` or a separate Bash call per platform is not caught.

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    if (data.tool_name !== 'Bash') return;
    // join `\`-continued lines so `gh workflow run ... \ -f platform=ios` is one command
    const command = ((data.tool_input && data.tool_input.command) || '').replace(/\\\n/g, ' ');

    const start = '(^|[;&|(])\\s*';
    const runner = '(?:(?:npm|pnpm|yarn|bun)(?:\\s+run)?\\s+|(?:bash|sh)\\s+)?';
    const end = '(?=\\s|$|[;&|)])';
    const ship = p => new RegExp(`${start}${runner}(?:ship:${p}|\\S*ship-${p}\\.sh)${end}`, 'm');

    const shipAll = new RegExp(`${start}(?:npm|pnpm|yarn|bun)(?:\\s+run)?\\s+ship:all${end}`, 'm');
    const bothShips = ship('ios').test(command) && ship('android').test(command);
    const workflow = new RegExp(`${start}gh\\s+workflow\\s+run\\s+["']?(?:deploy|qa)\\b`, 'mi');
    const workflowAll = workflow.test(command) && !/platform=(?:ios|android)\b/.test(command);

    if (shipAll.test(command) || bothShips || workflowAll) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: 'BLOCKED: this ships iOS and Android together. Ask the user which platform(s) to deploy, then run one platform per command (ship:ios, ship:android, or `gh workflow run ... -f platform=ios|android`).',
      }));
    }
  } catch (e) {}
});
