/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '../../../e2e/mock-suite-shards.js');
const {
  ANDROID_SHARD_COUNT,
  IOS_SHARD_COUNT,
  parseMockSuiteFlows,
  parseFlowsInput,
  splitFlows,
  planPlatforms,
  planShards,
} = require('../../../e2e/mock-suite-shards.js');

const MOCK_SCRIPT =
  'node e2e/run-maestro.js test e2e/launch.yaml e2e/browse.yaml e2e/session_lifecycle.yaml e2e/server_drag_reorder.yaml';

describe('parseMockSuiteFlows', () => {
  it('reads unique e2e/*.yaml paths in order from test:e2e:mock', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
    );
    const flows = parseMockSuiteFlows(pkg.scripts['test:e2e:mock']);
    expect(flows[0]).toBe('e2e/launch.yaml');
    expect(flows).toContain('e2e/07_conversation_scroll_gaps.yaml');
    expect(new Set(flows).size).toBe(flows.length);
    expect(flows.length).toBeGreaterThanOrEqual(16);
    for (const flow of flows) {
      expect(flow).toMatch(/^e2e\/[\w.-]+\.yaml$/);
      expect(fs.existsSync(path.resolve(__dirname, '../../..', flow))).toBe(true);
    }
  });
});

describe('parseFlowsInput', () => {
  it('rejects paths outside e2e/*.yaml', () => {
    expect(() => parseFlowsInput('e2e/../package.json')).toThrow(/Refusing flow/);
    expect(() => parseFlowsInput('/tmp/x.yaml')).toThrow(/Refusing flow/);
  });

  it('accepts a space-separated subset', () => {
    expect(parseFlowsInput('e2e/launch.yaml e2e/browse.yaml')).toEqual([
      'e2e/launch.yaml',
      'e2e/browse.yaml',
    ]);
  });
});

describe('splitFlows', () => {
  it('assigns longest jobs first and restores original order inside each shard', () => {
    const flows = ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml'];
    const weights = { 'a.yaml': 8, 'b.yaml': 7, 'c.yaml': 6, 'd.yaml': 5 };
    expect(splitFlows(flows, 2, weights)).toEqual([
      { shard: '1', total: '2', flows: 'a.yaml d.yaml' },
      { shard: '2', total: '2', flows: 'b.yaml c.yaml' },
    ]);
    expect(flows).toEqual(['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml']);
  });

  it('conserves membership without duplicates or empty shards', () => {
    const flows = ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml', 'e.yaml'];
    const weights = { 'a.yaml': 10, 'b.yaml': 9, 'c.yaml': 3, 'd.yaml': 3, 'e.yaml': 2 };
    const shards = splitFlows(flows, 3, weights);
    const assigned = shards.flatMap((shard) => shard.flows.split(' '));
    expect(shards).toHaveLength(3);
    expect(shards.every((shard) => shard.flows.length > 0)).toBe(true);
    expect(assigned.sort()).toEqual(flows.slice().sort());
    expect(new Set(assigned).size).toBe(flows.length);
  });

  it('breaks equal-duration ties by original list position and equal load by bucket index', () => {
    expect(
      splitFlows(['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml'], 2, {
        'a.yaml': 5,
        'b.yaml': 5,
        'c.yaml': 5,
        'd.yaml': 5,
      }),
    ).toEqual([
      { shard: '1', total: '2', flows: 'a.yaml c.yaml' },
      { shard: '2', total: '2', flows: 'b.yaml d.yaml' },
    ]);
  });

  it('uses 120s for unknown, zero, negative, nonnumeric, and nonfinite weights', () => {
    const fallback = splitFlows(['a.yaml', 'b.yaml', 'c.yaml'], 2, {});
    expect(fallback).toEqual([
      { shard: '1', total: '2', flows: 'a.yaml c.yaml' },
      { shard: '2', total: '2', flows: 'b.yaml' },
    ]);
    expect(
      splitFlows(['a.yaml', 'b.yaml', 'c.yaml'], 2, {
        'a.yaml': 0,
        'b.yaml': -4,
        'c.yaml': Number.NaN,
      }),
    ).toEqual(fallback);
    expect(
      splitFlows(['a.yaml', 'b.yaml', 'c.yaml'], 2, {
        'a.yaml': Number.POSITIVE_INFINITY,
        'b.yaml': 'nope',
      }),
    ).toEqual(fallback);
  });

  it('does not emit empty shards when there are fewer flows than requested', () => {
    expect(splitFlows(['e2e/launch.yaml'], 3)).toEqual([
      { shard: '1', total: '1', flows: 'e2e/launch.yaml' },
    ]);
  });
});

describe('planPlatforms', () => {
  it('runs both platforms on the weekly schedule', () => {
    expect(planPlatforms('schedule', '')).toEqual({ android: true, ios: true });
  });

  it('defaults a manual dispatch to Android', () => {
    expect(planPlatforms('workflow_dispatch', '')).toEqual({ android: true, ios: false });
    expect(planPlatforms('workflow_dispatch', 'ios')).toEqual({ android: false, ios: true });
  });
});

function collectFlows(shards) {
  return shards.flatMap((shard) => shard.flows.split(' ').filter(Boolean));
}

describe('planShards', () => {
  it('emits three duration-weighted shards per scheduled platform with no duplicates', () => {
    const plan = planShards({
      eventName: 'schedule',
      platformInput: '',
      flowsInput: '',
      mockScript: MOCK_SCRIPT,
      durationWeights: {
        android: { 'e2e/launch.yaml': 30, 'e2e/browse.yaml': 10, 'e2e/session_lifecycle.yaml': 10, 'e2e/server_drag_reorder.yaml': 10 },
        ios: { 'e2e/launch.yaml': 10, 'e2e/browse.yaml': 30, 'e2e/session_lifecycle.yaml': 10, 'e2e/server_drag_reorder.yaml': 10 },
      },
    });
    expect(ANDROID_SHARD_COUNT).toBe(3);
    expect(IOS_SHARD_COUNT).toBe(3);
    expect(plan.androidShards).toHaveLength(3);
    expect(plan.iosShards).toHaveLength(3);
    expect(plan.androidShards.every((shard) => shard.flows.length > 0)).toBe(true);
    expect(plan.iosShards.every((shard) => shard.flows.length > 0)).toBe(true);
    expect(collectFlows(plan.androidShards).sort()).toEqual(plan.flows.slice().sort());
    expect(collectFlows(plan.iosShards).sort()).toEqual(plan.flows.slice().sort());
    expect(new Set(collectFlows(plan.androidShards)).size).toBe(plan.flows.length);
    expect(new Set(collectFlows(plan.iosShards)).size).toBe(plan.flows.length);
    expect(plan.androidShards).not.toEqual(plan.iosShards);
  });

  it('keeps a custom flows input on a single shard in the supplied order', () => {
    const reversed = 'e2e/browse.yaml e2e/codex_parity.yaml';
    const android = planShards({
      eventName: 'workflow_dispatch',
      platformInput: 'android',
      flowsInput: reversed,
      mockScript: MOCK_SCRIPT,
      durationWeights: { android: { 'e2e/codex_parity.yaml': 999 }, ios: {} },
    });
    const ios = planShards({
      eventName: 'workflow_dispatch',
      platformInput: 'ios',
      flowsInput: reversed,
      mockScript: MOCK_SCRIPT,
      durationWeights: { android: {}, ios: { 'e2e/codex_parity.yaml': 999 } },
    });
    expect(android.androidShards).toEqual([
      { shard: '1', total: '1', flows: reversed },
    ]);
    expect(android.iosShards).toEqual([]);
    expect(ios.iosShards).toEqual([{ shard: '1', total: '1', flows: reversed }]);
    expect(ios.androidShards).toEqual([]);
  });

  it('never promotes a duration-only path into the suite and still runs unweighted suite flows', () => {
    const plan = planShards({
      eventName: 'schedule',
      platformInput: '',
      flowsInput: '',
      mockScript: MOCK_SCRIPT,
      durationWeights: {
        android: { 'e2e/not-in-suite.yaml': 999 },
        ios: { 'e2e/not-in-suite.yaml': 999 },
      },
    });
    expect(collectFlows(plan.androidShards).sort()).toEqual(plan.flows.slice().sort());
    expect(collectFlows(plan.iosShards).sort()).toEqual(plan.flows.slice().sort());
    expect(plan.flows).not.toContain('e2e/not-in-suite.yaml');
    expect(collectFlows(plan.androidShards)).toContain('e2e/launch.yaml');
  });
});

describe('mock-suite-shards CLI', () => {
  it('writes GitHub Actions outputs without interpolating flows into the shell', () => {
    const output = path.join(os.tmpdir(), `e2e-shards-${process.pid}.txt`);
    fs.writeFileSync(output, '');
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        INPUT_PLATFORM: 'android',
        INPUT_FLOWS: '',
      },
    });
    expect(result.status).toBe(0);
    const body = fs.readFileSync(output, 'utf8');
    fs.unlinkSync(output);
    expect(body).toMatch(/^android=true$/m);
    expect(body).toMatch(/^ios=false$/m);
    expect(body).toContain('android-shards<<EOF');
    expect(body).toContain('"shard":"1"');
    expect(JSON.parse(body.split('ios-shards<<EOF\n')[1].split('\nEOF')[0])).toEqual([
      { shard: '1', total: '1', flows: 'e2e/launch.yaml' },
    ]);
  });

  it('records historical shard estimates in the step summary', () => {
    const output = path.join(os.tmpdir(), `e2e-shards-summary-${process.pid}.txt`);
    const summary = path.join(os.tmpdir(), `e2e-shards-summary-md-${process.pid}.md`);
    fs.writeFileSync(output, '');
    fs.writeFileSync(summary, '');
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
        GITHUB_EVENT_NAME: 'schedule',
        INPUT_PLATFORM: '',
        INPUT_FLOWS: '',
      },
    });
    expect(result.status).toBe(0);
    const body = fs.readFileSync(summary, 'utf8');
    fs.unlinkSync(output);
    fs.unlinkSync(summary);
    expect(body).toMatch(/Android shards \(historical weights\)/);
    expect(body).toMatch(/iOS shards \(historical weights\)/);
    expect(body).toMatch(/shard 1\/3:/);
    expect(body).toMatch(/e2e\/07_conversation_scroll_gaps\.yaml/);
  });
});
