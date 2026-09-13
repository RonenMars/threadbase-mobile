#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

// Wall-clock split for CI only. Android Maestro is ~38 min on one emulator;
// three shards overlap that under separate VMs after one APK job. iOS Maestro
// is ~19 min once the Release .app exists; two shards, because macos-26 is
// the expensive half and the build still serializes in front.
const ANDROID_SHARD_COUNT = 3
const IOS_SHARD_COUNT = 2
const FLOW_RE = /\be2e\/[\w.-]+\.yaml\b/g

function parseMockSuiteFlows(script) {
  const seen = new Set()
  const flows = []
  for (const match of script.matchAll(FLOW_RE)) {
    const flow = match[0]
    if (seen.has(flow)) continue
    seen.add(flow)
    flows.push(flow)
  }
  return flows
}

function parseFlowsInput(raw) {
  const flows = String(raw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  for (const flow of flows) {
    if (!/^e2e\/[\w.-]+\.yaml$/.test(flow)) {
      throw new Error(`Refusing flow '${flow}' — expected a path like e2e/<name>.yaml.`)
    }
  }
  return flows
}

function splitFlows(flows, shardCount) {
  if (flows.length === 0) {
    throw new Error('No mock-suite flows to shard.')
  }
  const n = Math.min(Math.max(1, shardCount), flows.length)
  const buckets = Array.from({ length: n }, () => [])
  flows.forEach((flow, index) => {
    buckets[index % n].push(flow)
  })
  return buckets.map((shardFlows, index) => ({
    shard: String(index + 1),
    total: String(n),
    flows: shardFlows.join(' '),
  }))
}

function planPlatforms(eventName, platformInput) {
  if (eventName === 'schedule') {
    return { android: true, ios: true }
  }
  const platform = platformInput || 'android'
  return {
    android: platform === 'android',
    ios: platform === 'ios',
  }
}

function planShards({
  eventName,
  platformInput,
  flowsInput,
  mockScript,
  androidShardCount = ANDROID_SHARD_COUNT,
  iosShardCount = IOS_SHARD_COUNT,
}) {
  const { android, ios } = planPlatforms(eventName, platformInput)
  const requested = parseFlowsInput(flowsInput)
  const allFlows = requested.length > 0 ? requested : parseMockSuiteFlows(mockScript)
  if (allFlows.length === 0) {
    throw new Error('test:e2e:mock does not list any e2e/*.yaml flows.')
  }
  const shardCountFor = (count) => (requested.length > 0 ? 1 : count)
  return {
    android,
    ios,
    androidShards: android ? splitFlows(allFlows, shardCountFor(androidShardCount)) : [],
    iosShards: ios ? splitFlows(allFlows, shardCountFor(iosShardCount)) : [],
    flows: allFlows,
  }
}

function writeOutput(file, name, value) {
  fs.appendFileSync(file, `${name}=${value}\n`)
}

function writeMultilineOutput(file, name, value) {
  fs.appendFileSync(file, `${name}<<EOF\n${value}\nEOF\n`)
}

// GitHub fails a job whose `strategy.matrix.include` is `[]`, even when that
// job's `if:` is false. A skipped platform still needs one dummy row; the
// job-level `if:` is what prevents it from running.
function shardsForMatrix(shards) {
  if (shards.length > 0) return shards
  return [{ shard: '1', total: '1', flows: 'e2e/launch.yaml' }]
}

function main() {
  const repoRoot = path.join(__dirname, '..')
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const plan = planShards({
    eventName: process.env.GITHUB_EVENT_NAME || '',
    platformInput: process.env.INPUT_PLATFORM || '',
    flowsInput: process.env.INPUT_FLOWS || '',
    mockScript: pkg.scripts['test:e2e:mock'],
  })
  const output = process.env.GITHUB_OUTPUT
  if (!output) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
    return
  }
  writeOutput(output, 'android', plan.android ? 'true' : 'false')
  writeOutput(output, 'ios', plan.ios ? 'true' : 'false')
  writeMultilineOutput(output, 'android-shards', JSON.stringify(shardsForMatrix(plan.androidShards)))
  writeMultilineOutput(output, 'ios-shards', JSON.stringify(shardsForMatrix(plan.iosShards)))
}

module.exports = {
  ANDROID_SHARD_COUNT,
  IOS_SHARD_COUNT,
  parseMockSuiteFlows,
  parseFlowsInput,
  splitFlows,
  planPlatforms,
  planShards,
  shardsForMatrix,
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
