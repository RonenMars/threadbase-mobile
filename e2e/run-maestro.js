#!/usr/bin/env node
'use strict'

const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_GRACE_MS = 5000
const DEFAULT_POLL_MS = 250
const XCTEST_CRASH_EXIT_CODE = 86
const FAULTING_SYMBOL = 'XCTAutomationSession initWithAccessibilityFramework:dataSource:'
const XCTEST_IMAGE_ID = 'com.apple.dt.XCTAutomationSupport'

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function diagnosticDirectories() {
  if (process.env.E2E_XCTEST_DIAGNOSTIC_DIRS) {
    return process.env.E2E_XCTEST_DIAGNOSTIC_DIRS.split(path.delimiter).filter(Boolean)
  }

  const userReports = path.join(os.homedir(), 'Library', 'Logs', 'DiagnosticReports')
  const systemReports = path.join(path.parse(process.cwd()).root, 'Library', 'Logs', 'DiagnosticReports')
  return [
    userReports,
    path.join(userReports, 'Retired'),
    systemReports,
    path.join(systemReports, 'Retired'),
  ]
}

function fileIdentity(stat) {
  return [stat.dev, stat.ino, stat.birthtimeMs].join('\0')
}

async function listCrashReports(directories, warnOnce) {
  const reports = new Map()

  for (const directory of directories) {
    let entries
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        warnOnce(
          `directory:${directory}`,
          `Warning: could not inspect diagnostic reports in ${directory}: ${error.message}`,
        )
      }
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.ips')) continue
      const filePath = path.join(directory, entry.name)
      try {
        const stat = await fs.promises.stat(filePath)
        reports.set(fileIdentity(stat), filePath)
      } catch {
        warnOnce(
          `stat:${filePath}`,
          `Warning: diagnostic report disappeared before it could be inspected: ${filePath}`,
        )
      }
    }
  }

  return reports
}

function parseJsonReport(content) {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    return JSON.parse(trimmed)
  } catch {}

  const firstLineEnd = trimmed.indexOf('\n')
  if (firstLineEnd === -1) return null

  try {
    JSON.parse(trimmed.slice(0, firstLineEnd))
    return JSON.parse(trimmed.slice(firstLineEnd + 1))
  } catch {
    return null
  }
}

function hasInvalidAddress(exception) {
  return (
    exception?.type === 'EXC_BAD_ACCESS' &&
    /KERN_INVALID_ADDRESS\s+at\s+0x0*20\b/i.test(exception?.subtype || '')
  )
}

function imageIdentifier(image) {
  return image?.CFBundleIdentifier || image?.bundleID || image?.identifier || null
}

function structuredReportMatches(report) {
  if (!hasInvalidAddress(report?.exception)) return false

  const threads = Array.isArray(report.threads) ? report.threads : []
  const faultingThread =
    threads.find((thread) => thread?.triggered) ||
    (Number.isInteger(report.faultingThread) ? threads[report.faultingThread] : null)
  const frames = Array.isArray(faultingThread?.frames) ? faultingThread.frames : []
  const images = Array.isArray(report.usedImages) ? report.usedImages : []

  return frames.some((frame) => {
    if (!String(frame?.symbol || '').includes(FAULTING_SYMBOL)) return false
    if (Number.isInteger(frame.imageIndex)) {
      return imageIdentifier(images[frame.imageIndex]) === XCTEST_IMAGE_ID
    }
    return imageIdentifier(frame) === XCTEST_IMAGE_ID
  })
}

function textReportMatches(content) {
  const hasException = /^Exception Type:\s+EXC_BAD_ACCESS\b/m.test(content)
  const hasAddress = /^Exception Subtype:\s+KERN_INVALID_ADDRESS\s+at\s+0x0*20\b/im.test(content)
  const hasFrame = new RegExp(
    `^\\s*0\\s+XCTAutomationSupport\\b.*${FAULTING_SYMBOL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'm',
  ).test(content)
  const hasImage = content.includes(XCTEST_IMAGE_ID)
  return hasException && hasAddress && hasFrame && hasImage
}

function classifyReport(content) {
  const structured = parseJsonReport(content)
  if (structured) {
    const hasCrashBody =
      structured.exception &&
      Array.isArray(structured.threads) &&
      Array.isArray(structured.usedImages)
    if (!hasCrashBody) return { parsed: false, matches: false }
    return { parsed: true, matches: structuredReportMatches(structured) }
  }

  if (/^Process:\s+/m.test(content) && /^Exception Type:\s+/m.test(content)) {
    return { parsed: true, matches: textReportMatches(content) }
  }

  return { parsed: false, matches: false }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function findNewMatchingReports(baseline, directories, graceMs, pollMs, warnOnce) {
  const deadline = Date.now() + graceMs
  const matched = new Map()
  const unparsed = new Map()
  const unrelated = new Set()

  do {
    const current = await listCrashReports(directories, warnOnce)
    for (const [identity, filePath] of current) {
      if (baseline.has(identity) || matched.has(identity) || unrelated.has(identity)) continue

      let content
      try {
        content = await fs.promises.readFile(filePath, 'utf8')
      } catch (error) {
        unparsed.set(identity, { filePath, error: error.message })
        continue
      }

      const classification = classifyReport(content)
      if (classification.matches) {
        matched.set(identity, { filePath, content })
        unparsed.delete(identity)
      } else if (classification.parsed) {
        unrelated.add(identity)
        unparsed.delete(identity)
      } else {
        unparsed.set(identity, { filePath })
      }
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await delay(Math.min(pollMs, remaining))
  } while (true)

  for (const { filePath, error } of unparsed.values()) {
    warnOnce(
      `parse:${filePath}`,
      `Warning: could not parse new diagnostic report ${filePath}${error ? `: ${error}` : ''}`,
    )
  }

  return [...matched.values()]
}

async function copyReports(reports, artifactDirectory, warnOnce) {
  if (reports.length === 0) return []
  await fs.promises.mkdir(artifactDirectory, { recursive: true })
  const copied = []

  for (const { filePath: reportPath, content } of reports) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const basename = path.basename(reportPath).replace(/[^a-zA-Z0-9._-]/g, '_')
    let destination = path.join(artifactDirectory, `${timestamp}-${basename}`)
    let suffix = 1
    while (fs.existsSync(destination)) {
      destination = path.join(artifactDirectory, `${timestamp}-${suffix}-${basename}`)
      suffix += 1
    }

    try {
      await fs.promises.copyFile(reportPath, destination)
      copied.push(destination)
    } catch (error) {
      try {
        await fs.promises.writeFile(destination, content)
        copied.push(destination)
        warnOnce(
          `copy-source:${reportPath}`,
          `Warning: ${reportPath} moved or disappeared; preserved its last readable content instead.`,
        )
      } catch (writeError) {
        warnOnce(
          `copy:${reportPath}`,
          `Warning: detected XCTest crash report but could not copy ${reportPath}: ${writeError.message || error.message}`,
        )
      }
    }
  }

  return copied
}

function runMaestro(args) {
  return new Promise((resolve) => {
    const command = process.env.MAESTRO_BIN || 'maestro'
    const child = spawn(command, args, { stdio: 'inherit', shell: false })
    let settled = false
    let forwardedSignal = null
    const signalHandlers = new Map()

    const finish = (result) => {
      if (settled) return
      settled = true
      for (const [signal, handler] of signalHandlers) process.off(signal, handler)
      resolve({ ...result, forwardedSignal })
    }

    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      const handler = () => {
        forwardedSignal = forwardedSignal || signal
        if (!child.killed) child.kill(signal)
      }
      signalHandlers.set(signal, handler)
      process.on(signal, handler)
    }

    child.once('error', (error) => {
      console.error(`Error: could not start Maestro: ${error.message}`)
      finish({ code: 1, signal: null })
    })
    child.once('close', (code, signal) => finish({ code: code ?? 1, signal }))
  })
}

async function main() {
  const warnings = new Set()
  const warnOnce = (key, message) => {
    if (warnings.has(key)) return
    warnings.add(key)
    console.warn(message)
  }
  const directories = diagnosticDirectories()
  const graceMs = positiveInteger(process.env.E2E_XCTEST_CRASH_GRACE_MS, DEFAULT_GRACE_MS)
  const pollMs = Math.max(1, positiveInteger(process.env.E2E_XCTEST_CRASH_POLL_MS, DEFAULT_POLL_MS))
  const artifactDirectory =
    process.env.E2E_XCTEST_CRASH_ARTIFACT_DIR ||
    path.join(process.cwd(), 'e2e', '_artifacts', 'xctest-crashes')

  const baseline = await listCrashReports(directories, warnOnce)
  const maestroResult = await runMaestro(process.argv.slice(2))
  const terminationSignal = maestroResult.signal || maestroResult.forwardedSignal
  const matchingReports = await findNewMatchingReports(
    baseline,
    directories,
    terminationSignal ? 0 : graceMs,
    pollMs,
    warnOnce,
  )
  const copiedReports = await copyReports(matchingReports, artifactDirectory, warnOnce)

  if (matchingReports.length > 0) {
    console.error(
      [
        '',
        'Error: detected an iOS XCTest infrastructure crash during Maestro teardown.',
        'The Maestro result is invalid, even if Maestro reported success.',
        'Further hierarchy-based acceptance testing must stop for this simulator session.',
        `Upstream issue: Maestro #3494 (${`https://github.com/mobile-dev-inc/Maestro/issues/3494`})`,
        copiedReports.length > 0
          ? `Crash report${copiedReports.length === 1 ? '' : 's'} copied to ${artifactDirectory}`
          : 'The matching report could not be copied; see the warning above.',
        'Recover manually by shutting down and rebooting the affected simulator before retrying.',
        'This guard detects and contains the failure; it does not repair the Apple XCTest defect.',
      ].join('\n'),
    )
  }

  if (terminationSignal) {
    process.kill(process.pid, terminationSignal)
    return
  }

  process.exitCode =
    maestroResult.code !== 0
      ? maestroResult.code
      : matchingReports.length > 0
        ? XCTEST_CRASH_EXIT_CODE
        : 0
}

main().catch((error) => {
  console.error(`Error: Maestro crash guard failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
