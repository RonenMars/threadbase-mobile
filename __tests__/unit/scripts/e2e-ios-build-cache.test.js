/**
 * @jest-environment node
 *
 * The iOS E2E .app tarball is cached by exact tested SHA + workflow revision.
 * A prefix restore would install another commit's binary; a hit must skip the
 * native compile path entirely.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const WORKFLOW = path.resolve(__dirname, '../../../.github/workflows/e2e.yml');

function parseWorkflow() {
  return YAML.parse(fs.readFileSync(WORKFLOW, 'utf8'));
}

function stepIndex(steps, predicate) {
  const index = steps.findIndex(predicate);
  expect(index).toBeGreaterThan(-1);
  return index;
}

describe('e2e.yml iOS exact-build app cache', () => {
  const workflow = parseWorkflow();
  const steps = workflow.jobs['ios-build'].steps;

  it('keys the tarball exactly and never falls back to another commit', () => {
    const cache = steps.find((step) => step.id === 'ios-app-cache');
    expect(cache.with.path).toBe('e2e-ios-app.tgz');
    expect(cache.with['restore-keys']).toBeUndefined();
    expect(cache.with.key).toContain('needs.resolve.outputs.sha');
    expect(cache.with.key).toContain('github.workflow_sha');
    expect(cache.with.key).toContain('steps.toolchain.outputs.xcode-build');
    expect(cache.with.key).toContain('e2e-ios-app-v1-');
    expect(cache.with.key).toContain('Release-development');
    expect(JSON.stringify(cache)).not.toMatch(/restore-keys/);
  });

  it('skips native setup and compilation on a cache hit', () => {
    for (const name of ['Install dependencies', 'Install CocoaPods', 'Build iOS app (Release)']) {
      expect(steps.find((step) => step.name === name).if).toContain(
        "steps.ios-app-cache.outputs.cache-hit != 'true'",
      );
    }
    const setupNode = steps.find((step) => String(step.uses || '').startsWith('actions/setup-node'));
    const setupRuby = steps.find((step) => String(step.uses || '').startsWith('ruby/setup-ruby'));
    const derivedData = steps.find((step) => step.name === 'Restore iOS DerivedData cache');
    const resolveEnv = steps.find((step) => step.name === 'Resolve app env (skips the Sentry source-map upload)');
    const exportCcache = steps.find((step) => step.name === 'Export Ccache directory');
    const restoreCcache = steps.find((step) => step.name === 'Restore iOS Ccache');
    const configureCcache = steps.find((step) => step.name === 'Configure Ccache');
    for (const step of [setupNode, setupRuby, derivedData, resolveEnv, exportCcache, restoreCcache, configureCcache]) {
      expect(step.if).toContain("steps.ios-app-cache.outputs.cache-hit != 'true'");
    }
  });

  it('selects Xcode and records the toolchain before the binary cache lookup', () => {
    const selectXcode = stepIndex(steps, (step) => step.name === 'Select Xcode 26');
    const toolchain = stepIndex(steps, (step) => step.id === 'toolchain');
    const cache = stepIndex(steps, (step) => step.id === 'ios-app-cache');
    const setupNode = stepIndex(steps, (step) =>
      String(step.uses || '').startsWith('actions/setup-node'),
    );
    const derivedData = stepIndex(steps, (step) => step.name === 'Restore iOS DerivedData cache');
    const pods = stepIndex(steps, (step) => step.name === 'Install CocoaPods');
    const build = stepIndex(steps, (step) => step.name === 'Build iOS app (Release)');
    expect(steps[toolchain].name).toBeTruthy();
    expect(steps[toolchain].run).toContain('xcodebuild -version');
    expect(selectXcode).toBeLessThan(toolchain);
    expect(toolchain).toBeLessThan(cache);
    expect(cache).toBeLessThan(setupNode);
    expect(cache).toBeLessThan(derivedData);
    expect(cache).toBeLessThan(pods);
    expect(cache).toBeLessThan(build);
  });

  it('validates and uploads the tarball on both cache paths', () => {
    const cache = stepIndex(steps, (step) => step.id === 'ios-app-cache');
    const validate = stepIndex(steps, (step) => step.name === 'Validate iOS Release app tarball');
    const upload = stepIndex(steps, (step) => step.name === 'Upload iOS Release app');
    const hitSummary = steps.find((step) => step.name === 'Note iOS app cache hit');
    expect(hitSummary.if).toContain("steps.ios-app-cache.outputs.cache-hit == 'true'");
    expect(hitSummary.run).toContain('TEST_SHA');
    expect(hitSummary.env.TEST_SHA).toBe('${{ needs.resolve.outputs.sha }}');
    expect(hitSummary.env.WORKFLOW_SHA).toBe('${{ github.workflow_sha }}');
    expect(hitSummary.env.CACHE_KEY).toContain('needs.resolve.outputs.sha');
    expect(hitSummary.env.CACHE_KEY).toContain('github.workflow_sha');
    expect(steps[validate].if).toBeUndefined();
    expect(steps[upload].if).toBeUndefined();
    expect(steps[validate].run).toContain('Threadbase.app/Info.plist');
    expect(steps[validate].run).toContain('Threadbase.app/Threadbase');
    expect(cache).toBeLessThan(validate);
    expect(validate).toBeLessThan(upload);
    expect(steps[upload].with.path).toBe('e2e-ios-app.tgz');
    expect(steps[upload].with.name).toBe('e2e-ios-app');
  });
});

const NATIVE_HASH_FILES =
  "hashFiles('package-lock.json', 'ios/Podfile', 'ios/Podfile.lock', 'ios/Podfile.properties.json', 'app.json')";

describe('e2e.yml iOS native compiler caches', () => {
  const workflow = parseWorkflow();
  const steps = workflow.jobs['ios-build'].steps;

  it('exports Ccache, restores it, then resets per-build stats before CocoaPods', () => {
    const exportCcache = stepIndex(steps, (step) => step.name === 'Export Ccache directory');
    const restoreCcache = stepIndex(steps, (step) => step.name === 'Restore iOS Ccache');
    const configureCcache = stepIndex(steps, (step) => step.name === 'Configure Ccache');
    const pods = stepIndex(steps, (step) => step.name === 'Install CocoaPods');
    const build = stepIndex(steps, (step) => step.name === 'Build iOS app (Release)');
    expect(exportCcache).toBeLessThan(restoreCcache);
    expect(restoreCcache).toBeLessThan(configureCcache);
    expect(configureCcache).toBeLessThan(pods);
    expect(pods).toBeLessThan(build);
    expect(steps[exportCcache].run).toContain('command -v ccache');
    expect(steps[exportCcache].run).toContain('brew install ccache');
    expect(steps[exportCcache].run).toContain('CCACHE_DIR="$HOME/.cache/tb-e2e-ccache"');
    expect(steps[configureCcache].run).toContain('compiler_check=content');
    expect(steps[configureCcache].run).toContain('max_size=2G');
    expect(steps[configureCcache].run).toContain('--zero-stats');
    expect(steps[pods].env.USE_CCACHE).toBe('1');
    expect(steps[build].env.USE_CCACHE).toBe('1');
  });

  it('shares the recorded toolchain identity and allows same-toolchain native reuse', () => {
    const appCache = steps.find((step) => step.id === 'ios-app-cache');
    const ccache = steps.find((step) => step.name === 'Restore iOS Ccache');
    const derived = steps.find((step) => step.name === 'Restore iOS DerivedData cache');
    expect(ccache.with.path).toBe('~/.cache/tb-e2e-ccache');
    expect(ccache.with.key).toContain('steps.toolchain.outputs.xcode-build');
    expect(ccache.with.key).toContain('needs.resolve.outputs.sha');
    expect(ccache.with.key).toContain(NATIVE_HASH_FILES);
    expect(ccache.with['restore-keys']).toContain('steps.toolchain.outputs.xcode-build');
    expect(ccache.with['restore-keys']).toContain('runner.arch');
    expect(derived.with.key).toContain('steps.toolchain.outputs.xcode-build');
    expect(derived.with.key).toContain('needs.resolve.outputs.sha');
    expect(derived.with.key).toContain(NATIVE_HASH_FILES);
    expect(derived.with.key).not.toContain('xcode26.3');
    expect(derived.with['restore-keys']).toContain('steps.toolchain.outputs.xcode-build');
    expect(derived.with['restore-keys']).toContain('runner.arch');
    expect(appCache.with['restore-keys']).toBeUndefined();
  });

  it('reports Ccache stats after the compile without masking a build failure', () => {
    const build = stepIndex(steps, (step) => step.name === 'Build iOS app (Release)');
    const stats = stepIndex(steps, (step) => step.name === 'Show Ccache stats');
    expect(build).toBeLessThan(stats);
    expect(steps[stats].if).toContain('always()');
    expect(steps[stats].if).toContain("steps.ios-app-cache.outputs.cache-hit != 'true'");
    expect(steps[stats].run).toContain('ccache --show-stats');
  });
});
