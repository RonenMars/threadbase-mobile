/**
 * @jest-environment node
 *
 * Tests for .claude/hooks/block-multi-platform-deploy.js. Every `cc` launch
 * skips permission prompts, so this hook is the only thing between a "ship"
 * request and both stores. A false negative ships the wrong platform; a false
 * positive blocks a legitimate single-platform ship.
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.resolve(__dirname, '../../../.claude/hooks/block-multi-platform-deploy.js');

function blocked(command, toolName = 'Bash') {
  const out = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { command } }),
    encoding: 'utf8',
  }).stdout;
  return out.includes('"decision":"block"');
}

describe('block-multi-platform-deploy', () => {
  it.each([
    ['ship:all', 'npm run ship:all'],
    ['ship:all via pnpm', 'pnpm ship:all'],
    ['ship:all after cd', 'cd /tmp && npm run ship:all'],
    ['ship scripts chained', './scripts/ship-ios.sh && ./scripts/ship-android.sh'],
    ['ship scripts with ;', 'bash scripts/ship-ios.sh; bash scripts/ship-android.sh'],
    ['npm ship scripts chained', 'npm run ship:ios && npm run ship:android'],
    ['deploy workflow, platform defaults to all', 'gh workflow run deploy.yml --ref main -f target=testflight'],
    ['deploy workflow, platform=all', 'gh workflow run deploy.yml -f platform=all'],
    ['qa workflow by name', 'gh workflow run "QA (Firebase)" --ref main'],
    ['continued lines without a platform', 'gh workflow run deploy.yml --ref main \\\n  -f target=testflight'],
  ])('blocks %s', (_name, command) => {
    expect(blocked(command)).toBe(true);
  });

  it.each([
    ['one iOS ship', 'npm run ship:ios'],
    ['one Android ship', './scripts/ship-android.sh'],
    ['ship-qa with a platform', './scripts/ship-qa.sh --platform ios'],
    ['deploy workflow, platform=ios', 'gh workflow run deploy.yml -f platform=ios -f target=testflight'],
    ['continued lines with platform=android', 'gh workflow run deploy.yml --ref main \\\n  -f platform=android'],
    ['E2E workflow', 'gh workflow run E2E -f platform=ios'],
    ['commit message naming the command', 'git commit -m "docs: explain npm run ship:all"'],
    ['reading both scripts', 'cat scripts/ship-ios.sh scripts/ship-android.sh'],
    ['command named mid-line in a heredoc', 'cat <<EOF\nuse `npm run ship:all` carefully\nEOF'],
    ['unrelated command', 'git status'],
  ])('allows %s', (_name, command) => {
    expect(blocked(command)).toBe(false);
  });

  it('ignores other tools', () => {
    expect(blocked('npm run ship:all', 'Read')).toBe(false);
  });
});
