#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

// Wall-clock split for CI only. Android Maestro is ~38 min on one emulator;
// three shards overlap that under separate VMs after one APK job. iOS Maestro
// is duration-weighted across three shards once the Release .app exists.
const ANDROID_SHARD_COUNT = 3
const IOS_SHARD_COUNT = 3
const DEFAULT_FLOW_DURATION_S = 120
const FLOW_RE = /\be2e\/[\w.-]+\.yaml\b/g
const DURATIONS_PATH = path.join(__dirname, 'mock-suite-durations.json')

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

function durationOf(flow, durations) {
  const raw = durations == null ? undefined : durations[flow]
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_FLOW_DURATION_S
  return value
}

function splitFlows(flows, shardCount, durations = {}) {
  if (flows.length === 0) {
    throw new Error('No mock-suite flows to shard.')
  }
  const n = Math.min(Math.max(1, shardCount), flows.length)
  const ranked = flows
    .map((flow, index) => ({ flow, index, duration: durationOf(flow, durations) }))
    .sort((left, right) => {
      if (right.duration !== left.duration) return right.duration - left.duration
      return left.index - right.index
    })
  const buckets = Array.from({ length: n }, () => ({ total: 0, items: [] }))
  for (const item of ranked) {
    let best = 0
    for (let i = 1; i < n; i += 1) {
      if (buckets[i].total < buckets[best].total) best = i
    }
    buckets[best].items.push(item)
    buckets[best].total += item.duration
  }
  return buckets.map((bucket, index) => ({
    shard: String(index + 1),
    total: String(n),
    flows: bucket.items
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((item) => item.flow)
      .join(' '),
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
  durationWeights = { android: {}, ios: {} },
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
    androidShards: android
      ? splitFlows(allFlows, shardCountFor(androidShardCount), durationWeights.android)
      : [],
    iosShards: ios ? splitFlows(allFlows, shardCountFor(iosShardCount), durationWeights.ios) : [],
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

function loadDurationWeights() {
  const data = JSON.parse(fs.readFileSync(DURATIONS_PATH, 'utf8'))
  return {
    android: data.android || {},
    ios: data.ios || {},
  }
}

function shardEstimateSeconds(shard, durations) {
  return shard.flows
    .split(' ')
    .filter(Boolean)
    .reduce((sum, flow) => sum + durationOf(flow, durations), 0)
}

function writePlanSummary(plan, durationWeights) {
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (!summary) return
  const lines = []
  const describe = (label, shards, durations) => {
    if (shards.length === 0) return
    lines.push(`## ${label} shards (historical weights)`)
    for (const shard of shards) {
      const seconds = shardEstimateSeconds(shard, durations)
      lines.push(`- shard ${shard.shard}/${shard.total}: ${seconds}s — ${shard.flows}`)
    }
  }
  describe('Android', plan.androidShards, durationWeights.android)
  describe('iOS', plan.iosShards, durationWeights.ios)
  if (lines.length > 0) {
    fs.appendFileSync(summary, `${lines.join('\n')}\n`)
  }
}

function main() {
  const repoRoot = path.join(__dirname, '..')
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const durationWeights = loadDurationWeights()
  const plan = planShards({
    eventName: process.env.GITHUB_EVENT_NAME || '',
    platformInput: process.env.INPUT_PLATFORM || '',
    flowsInput: process.env.INPUT_FLOWS || '',
    mockScript: pkg.scripts['test:e2e:mock'],
    durationWeights,
  })
  writePlanSummary(plan, durationWeights)
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
