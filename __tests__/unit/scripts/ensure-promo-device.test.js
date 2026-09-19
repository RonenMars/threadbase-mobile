/**
 * @jest-environment node
 *
 * Promo capture used to require a human to boot the emulator/simulator first.
 * ensure-promo-device.sh is the pre-start that either reuses a running device
 * or starts one. A hang or a start when a device is already up is the failure.
 */

'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const SCRIPT = path.resolve(__dirname, '../../../e2e/ensure-promo-device.sh')
const ANDROID_RUNNER = path.resolve(__dirname, '../../../e2e/run-promo-screenshots-android.sh')
const IOS_RUNNER = path.resolve(__dirname, '../../../e2e/run-promo-screenshots-ios.sh')
const PACKAGE_JSON = path.resolve(__dirname, '../../../package.json')

function runEnsure(platform, { stubs, env = {}, extraFiles = {} }) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'promo-device-')))
  const bin = path.join(dir, 'bin')
  const sdk = path.join(dir, 'sdk')
  fs.mkdirSync(path.join(sdk, 'platform-tools'), { recursive: true })
  fs.mkdirSync(path.join(sdk, 'emulator'), { recursive: true })
  fs.mkdirSync(bin, { recursive: true })

  const stubEnv = `STUB_DIR=${JSON.stringify(dir)}`
  fs.writeFileSync(path.join(sdk, 'platform-tools', 'adb'), `#!/bin/bash\n${stubEnv}\n${stubs.adb}\n`, {
    mode: 0o755,
  })
  fs.writeFileSync(path.join(sdk, 'emulator', 'emulator'), `#!/bin/bash\n${stubEnv}\n${stubs.emulator || 'exit 0'}\n`, {
    mode: 0o755,
  })
  if (stubs.xcrun) {
    fs.writeFileSync(path.join(bin, 'xcrun'), `#!/bin/bash\n${stubEnv}\n${stubs.xcrun}\n`, { mode: 0o755 })
  }
  if (stubs.open) {
    fs.writeFileSync(path.join(bin, 'open'), `#!/bin/bash\n${stubEnv}\n${stubs.open}\n`, { mode: 0o755 })
  }
  for (const [rel, body] of Object.entries(extraFiles)) {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }

  const result = spawnSync('/bin/bash', [SCRIPT, platform], {
    cwd: dir,
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      HOME: dir,
      ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk,
      E2E_DEVICE_WAIT_SECONDS: '4',
      E2E_DEVICE_POLL_SECONDS: '0',
      ...env,
    },
    encoding: 'utf8',
    timeout: 15_000,
  })

  const emuArgs = fs.existsSync(path.join(dir, 'emu-args'))
    ? fs.readFileSync(path.join(dir, 'emu-args'), 'utf8')
    : ''
  const simctlArgs = fs.existsSync(path.join(dir, 'simctl-args'))
    ? fs.readFileSync(path.join(dir, 'simctl-args'), 'utf8')
    : ''
  fs.rmSync(dir, { recursive: true, force: true })
  return { result, emuArgs, simctlArgs }
}

const ADB_BOOTED = `
if [ "$1" = "devices" ]; then
  echo "List of devices attached"
  printf 'emulator-5554\\tdevice\\n'
  exit 0
fi
if [ "$1" = "-s" ]; then shift; shift; fi
if [ "$1" = "shell" ] && [ "$2" = "getprop" ] && [ "$3" = "sys.boot_completed" ]; then
  echo 1
  exit 0
fi
exit 0
`

const ADB_STARTS_AFTER_EMU = `
if [ "$1" = "devices" ]; then
  echo "List of devices attached"
  if [ -f "$STUB_DIR/emu-started" ]; then
    printf 'emulator-5554\\tdevice\\n'
  fi
  exit 0
fi
if [ "$1" = "-s" ]; then shift; shift; fi
if [ "$1" = "shell" ] && [ "$2" = "getprop" ] && [ "$3" = "sys.boot_completed" ]; then
  if [ -f "$STUB_DIR/emu-started" ]; then echo 1; else echo 0; fi
  exit 0
fi
exit 0
`

const EMU_LIST_AND_START = `
if [ "$1" = "-list-avds" ]; then
  echo "Pixel_API_35"
  exit 0
fi
echo "$*" >> "$STUB_DIR/emu-args"
touch "$STUB_DIR/emu-started"
exit 0
`

describe('ensure-promo-device.sh', () => {
  it('is the pre-start for both promo screenshot runners', () => {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
    expect(pkg.scripts['test:e2e:promo:ensure-emulator']).toBe('./e2e/ensure-promo-device.sh android')
    expect(pkg.scripts['test:e2e:promo:ensure-simulator']).toBe('./e2e/ensure-promo-device.sh ios')
    expect(fs.readFileSync(ANDROID_RUNNER, 'utf8')).toContain('ensure_promo_emulator')
    expect(fs.readFileSync(IOS_RUNNER, 'utf8')).toContain('ensure_promo_simulator')
    expect(fs.readFileSync(IOS_RUNNER, 'utf8')).toContain('reset_promo_ios_app')
    expect(fs.readFileSync(IOS_RUNNER, 'utf8')).toContain('E2E_REBUILD_STALE=1')
    expect(fs.readFileSync(IOS_RUNNER, 'utf8')).toContain('ensure_promo_mock_ports')
  })

  it('reuses a booted Android emulator instead of starting another', () => {
    const { result, emuArgs } = runEnsure('android', {
      stubs: { adb: ADB_BOOTED, emulator: 'echo started >> "$STUB_DIR/emu-args"; exit 1' },
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/already-running Android emulator emulator-5554/)
    expect(emuArgs).toBe('')
  })

  it('starts an AVD when no emulator is running', () => {
    const { result, emuArgs } = runEnsure('android', {
      stubs: { adb: ADB_STARTS_AFTER_EMU, emulator: EMU_LIST_AND_START },
      extraFiles: {
        '.android/avd/Pixel_API_35.avd/config.ini': 'image.sysdir.1=system-images/android-35/google_apis/arm64-v8a/\n',
      },
    })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Starting Android emulator AVD Pixel_API_35/)
    expect(result.stdout).toMatch(/Android emulator is running: emulator-5554/)
    expect(emuArgs).toMatch(/-avd Pixel_API_35/)
  })

  it('fails clearly when no AVD exists', () => {
    const { result } = runEnsure('android', {
      stubs: {
        adb: 'echo "List of devices attached"; exit 0',
        emulator: 'if [ "$1" = "-list-avds" ]; then exit 0; fi; exit 1',
      },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/no Android Virtual Devices found/)
  })

  it('reuses a booted iOS simulator instead of starting another', () => {
    const { result, simctlArgs } = runEnsure('ios', {
      stubs: {
        adb: 'exit 0',
        xcrun: `
if [ "$1" = "simctl" ] && [ "$2" = "list" ] && [ "$3" = "devices" ] && [ "$4" = "booted" ]; then
  echo "    iPhone 17 Pro (AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE) (Booted)"
  exit 0
fi
echo "$*" >> "$STUB_DIR/simctl-args"
exit 1
`,
      },
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/already-running iOS simulator AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE/)
    expect(simctlArgs).toBe('')
  })
})
