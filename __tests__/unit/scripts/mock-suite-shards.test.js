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
  it('round-robins so later flows are not all parked on the last shard', () => {
    const shards = splitFlows(['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml', 'e.yaml'], 3);
    expect(shards).toEqual([
      { shard: '1', total: '3', flows: 'a.yaml d.yaml' },
      { shard: '2', total: '3', flows: 'b.yaml e.yaml' },
      { shard: '3', total: '3', flows: 'c.yaml' },
    ]);
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

describe('planShards', () => {
  it('emits three Android shards and two iOS shards for the full suite', () => {
    const plan = planShards({
      eventName: 'schedule',
      platformInput: '',
      flowsInput: '',
      mockScript: MOCK_SCRIPT,
    });
    expect(ANDROID_SHARD_COUNT).toBe(3);
    expect(IOS_SHARD_COUNT).toBe(2);
    expect(plan.androidShards).toHaveLength(3);
    expect(plan.iosShards).toHaveLength(2);
    expect(plan.androidShards.flatMap((shard) => shard.flows.split(' ')).sort()).toEqual(
      plan.flows.slice().sort(),
    );
    expect(plan.iosShards.flatMap((shard) => shard.flows.split(' ')).sort()).toEqual(
      plan.flows.slice().sort(),
    );
  });

  it('keeps a custom flows input on a single shard', () => {
    const plan = planShards({
      eventName: 'workflow_dispatch',
      platformInput: 'android',
      flowsInput: 'e2e/codex_parity.yaml e2e/browse.yaml',
      mockScript: MOCK_SCRIPT,
    });
    expect(plan.androidShards).toEqual([
      { shard: '1', total: '1', flows: 'e2e/codex_parity.yaml e2e/browse.yaml' },
    ]);
    expect(plan.iosShards).toEqual([]);
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
});
