/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

function parseWorkflow() {
  return YAML.parse(fs.readFileSync(WORKFLOW, 'utf8'));
}

function checkoutStep(job) {
  return (job.steps || []).find((step) => String(step.uses || '').startsWith('actions/checkout'));
}

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

test('pins every build and shard checkout to the immutable resolved SHA', () => {
  const workflow = parseWorkflow();
  expect(workflow.jobs.resolve.outputs.sha).toBe('${{ steps.head.outputs.sha }}');
  expect(checkoutStep(workflow.jobs.resolve).with.ref).toBe('${{ steps.resolve.outputs.ref }}');

  const recordResolved = workflow.jobs.resolve.steps.find(
    (step) => step.name === 'Record resolved SHA',
  );
  expect(recordResolved.id).toBe('head');
  expect(recordResolved.run).toContain('git rev-parse HEAD');

  for (const jobName of ['android-apk', 'android-maestro', 'ios-build', 'ios-maestro']) {
    expect(checkoutStep(workflow.jobs[jobName]).with.ref).toBe(
      '${{ needs.resolve.outputs.sha }}',
    );
  }

  const recordCheckedOut = workflow.jobs['android-apk'].steps.find(
    (step) => step.name === 'Record checked-out SHA',
  );
  expect(recordCheckedOut.id).toBe('head');
  expect(recordCheckedOut.env.RESOLVED_SHA).toBe('${{ needs.resolve.outputs.sha }}');
  expect(recordCheckedOut.run).toContain('git rev-parse HEAD');
  expect(recordCheckedOut.run).toMatch(/CHECKED_OUT_SHA|SHA=/);
  expect(recordCheckedOut.run).toContain('$RESOLVED_SHA');
});

test('uploads Maestro output on success and failure while keeping full artifacts on failure only', () => {
  const workflow = parseWorkflow();
  for (const jobName of ['android-maestro', 'ios-maestro']) {
    const platform = jobName.startsWith('android') ? 'android' : 'ios';
    const steps = workflow.jobs[jobName].steps;
    const results = steps.find((step) => step.name === 'Upload Maestro results');
    const failure = steps.find((step) => step.name === 'Upload Maestro artifacts on failure');
    expect(results.if).toContain('!cancelled()');
    expect(results.with.path).toBe('e2e/_artifacts/maestro-output/');
    expect(results.with.name).toBe(`maestro-results-${platform}-\${{ matrix.shard }}`);
    expect(results.with['retention-days']).toBe(1);
    expect(failure.if).toBe('failure()');
    expect(failure.with.path).toBe('e2e/_artifacts/');
    expect(failure.with['retention-days']).toBe(7);
  }
});
