#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const flowPath = process.argv[2]
if (!flowPath) {
  console.error('Usage: node scripts/record-simulator-flow.js <maestro-flow.yaml>')
  process.exit(1)
}
const repoRoot = process.cwd()
const artifactsDir = path.join(repoRoot, 'e2e', '_artifacts', 'simulator-recordings')
fs.mkdirSync(artifactsDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const videoPath = path.join(artifactsDir, `simulator-${timestamp}.mp4`)

const recordProc = spawn('xcrun', ['simctl', 'io', 'booted', 'recordVideo', '--codec', 'h264', '--force', videoPath], {
  stdio: ['ignore', 'ignore', 'pipe'],
})

let cleanedUp = false
let stopRecordingPromise = null
let maestroProc = null
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  if (!recordProc.killed) recordProc.kill('SIGINT')
}

function stopRecording() {
  if (stopRecordingPromise) return stopRecordingPromise
  stopRecordingPromise = new Promise((resolve, reject) => {
    recordProc.once('exit', (code, signal) => {
      if (signal && signal !== 'SIGINT') {
        reject(new Error(`simctl recordVideo exited with signal ${signal}`))
        return
      }
      if (typeof code === 'number' && code !== 0) {
        reject(new Error(`simctl recordVideo exited with code ${code}`))
        return
      }
      resolve()
    })
    recordProc.once('error', reject)
    cleanup()
  })
  return stopRecordingPromise
}

function waitForRecordingStart() {
  return new Promise((resolve, reject) => {
    let stderr = ''
    const onData = (chunk) => {
      stderr += chunk.toString()
      if (stderr.includes('Recording started')) {
        recordProc.stderr?.off('data', onData)
        resolve()
      }
    }
    recordProc.stderr?.on('data', onData)
    recordProc.once('exit', (code) => {
      recordProc.stderr?.off('data', onData)
      reject(new Error(`simctl recordVideo exited before starting (code ${code ?? 'unknown'})`))
    })
  })
}

process.on('SIGINT', () => {
  if (maestroProc && !maestroProc.killed) maestroProc.kill('SIGINT')
  stopRecording().finally(() => process.exit(130))
})

process.on('SIGTERM', () => {
  if (maestroProc && !maestroProc.killed) maestroProc.kill('SIGTERM')
  stopRecording().finally(() => process.exit(143))
});

(async () => {
  await waitForRecordingStart()
  maestroProc = spawn(
    process.execPath,
    [path.join(repoRoot, 'e2e/run-maestro.js'), 'test', '--debug-output', 'e2e/_artifacts/debug', flowPath],
    { stdio: 'inherit' },
  )

  maestroProc.on('exit', (code) => {
    stopRecording()
      .then(() => {
        console.log(`Simulator video saved to ${path.relative(repoRoot, videoPath)}`)
        process.exit(code ?? 1)
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(code ?? 1)
      })
  })
})().catch((error) => {
  stopRecording().finally(() => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
  })
})
