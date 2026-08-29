/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

function jobSection(source, name) {
  const start = source.indexOf(`  ${name}:\n`);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start);
}

test('runs Android and iOS E2E every week while keeping manual platform selection', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const maestroJob = jobSection(source, 'e2e-maestro');

  expect(source).toContain("- cron: '0 0 * * 0'");
  expect(maestroJob).toContain("fromJSON('[\"android\", \"ios\"]')");
  expect(maestroJob).toContain("fromJSON(format('[\"{0}\"]', inputs.platform))");
  expect(maestroJob).toContain("matrix.platform == 'ios'");
  expect(maestroJob).toContain("matrix.platform == 'android'");
});

test('notifies for every failed E2E run after all platform jobs complete', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const notificationJob = jobSection(source, 'notify-e2e-failure');

  expect(notificationJob).toContain("if: ${{ always() && needs.e2e-maestro.result == 'failure' }}");
  expect(notificationJob).toContain('Threadbase Mobile E2E Weekly 🤖');
  expect(notificationJob).toContain('🚨 E2E run failed');
  expect(notificationJob).not.toContain("if: failure() && github.event_name == 'schedule'");
});
