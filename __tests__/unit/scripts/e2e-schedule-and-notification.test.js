/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

test('runs Android and iOS E2E every week while keeping manual platform selection', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');

  expect(source).toContain("- cron: '0 0 * * 0'");
  expect(source).toContain("needs.resolve.outputs.android == 'true'");
  expect(source).toContain("needs.resolve.outputs.ios == 'true'");
  expect(source).toContain('e2e/mock-suite-shards.js');
  expect(source).toContain('fromJSON(needs.resolve.outputs.android-shards)');
  expect(source).toContain('fromJSON(needs.resolve.outputs.ios-shards)');
});

test('builds once per platform then fans Maestro out across shards', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const androidMaestro = source.slice(source.indexOf('  android-maestro:\n'));
  const iosMaestro = source.slice(source.indexOf('  ios-maestro:\n'));

  expect(androidMaestro).toContain('needs: [resolve, android-apk]');
  expect(iosMaestro).toContain('needs: [resolve, ios-build]');
  expect(source).toMatch(/destination 'generic\/platform=iOS Simulator'/);
});

test('notifies for every failed E2E run after all platform jobs complete', () => {
  const source = fs.readFileSync(WORKFLOW, 'utf8');
  const start = source.indexOf('  notify-e2e-failure:\n');
  expect(start).toBeGreaterThan(-1);
  const notificationJob = source.slice(start);

  expect(notificationJob).toContain("if: ${{ always() && needs.e2e-maestro.result == 'failure' }}");
  expect(notificationJob).toContain('Threadbase Mobile E2E Weekly 🤖');
  expect(notificationJob).toContain('🚨 E2E run failed');
  expect(notificationJob).not.toContain("if: failure() && github.event_name == 'schedule'");
});
