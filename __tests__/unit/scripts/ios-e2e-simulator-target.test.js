/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

function stepScript(name) {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const start = source.indexOf(`      - name: ${name}\n`);
  expect(start).toBeGreaterThan(-1);

  const step = source.slice(start);
  const match = step.match(/^        run: \|\n((?:          .*\n)+)/m);
  expect(match).not.toBeNull();
  return match[1].replace(/^          /gm, '');
}

test('builds for the simulator selected by the boot step', () => {
  const bootSimulator = stepScript('Boot iOS simulator');
  const buildApp = stepScript('Build and install iOS app (Release)');

  expect(bootSimulator).toContain('echo "IOS_UDID=$DEVICE" >> "$GITHUB_ENV"');
  expect(buildApp).toContain('-destination "platform=iOS Simulator,id=$IOS_UDID"');
  expect(buildApp).not.toMatch(/name=iPhone/);
});
