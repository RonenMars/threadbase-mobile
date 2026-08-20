/**
 * @jest-environment node
 *
 * The Android E2E APK is assembled before the emulator boots and cached per
 * checked-out SHA. A regression here is invisible until it has already burned
 * a runner: either every dispatch recompiles for 20 minutes, or a cache key
 * keyed on github.sha installs the workflow-file branch's APK against
 * different code under test.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

function workflowSource() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

function stepIndex(src, name) {
  const at = src.indexOf(name);
  expect(at).toBeGreaterThan(-1);
  return at;
}

describe('e2e.yml Android APK cache', () => {
  it('records the checked-out SHA rather than github.sha', () => {
    const src = workflowSource();
    const recordAt = stepIndex(src, 'Record checked-out SHA');
    const cacheAt = stepIndex(src, 'Cache Android Release APK');
    expect(recordAt).toBeLessThan(cacheAt);
    expect(src).toMatch(/key: e2e-android-apk-v1-\$\{\{ runner\.os \}\}-x86_64-\$\{\{ steps\.head\.outputs\.sha \}\}/);
    expect(src).not.toMatch(/e2e-android-apk-v1-.*github\.sha/);
  });

  it('assembles the APK before android-emulator-runner and skips assemble on a cache hit', () => {
    const src = workflowSource();
    const assembleAt = stepIndex(src, 'Assemble Android Release APK');
    const emulatorAt = src.indexOf('reactivecircus/android-emulator-runner');
    expect(emulatorAt).toBeGreaterThan(-1);
    expect(assembleAt).toBeLessThan(emulatorAt);
    expect(src).toMatch(/steps\.apk-cache\.outputs\.cache-hit != 'true'/);
  });

  it('lets a feature-branch warmup write the Gradle cache', () => {
    const src = workflowSource();
    const setupAt = src.indexOf('gradle/actions/setup-gradle');
    const readOnlyAt = src.indexOf('cache-read-only: false');
    expect(setupAt).toBeGreaterThan(-1);
    expect(readOnlyAt).toBeGreaterThan(setupAt);
  });
});
